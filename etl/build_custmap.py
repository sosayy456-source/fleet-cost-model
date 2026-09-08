"""สร้าง custmap.bin จาก แปลงรหัสลูกหนี้รวม.xlsx

ไฟล์ต้นทางมีสองคอลัมน์: "รหัสที่แปลงแล้ว" (CUS0000001) กับ "รหัสต้นฉบับ"
(SHA-256 64 ตัวอักษร) — 584,941 แถว

โครงสร้างไฟล์ที่เขียนออก (รุ่น 2):
    32 ไบต์ต่อระเบียน = รหัสต้นฉบับเต็ม ๆ ในรูปไบนารี
    ตำแหน่งระเบียนคือเลขในรหัส CUS: CUS0000001 อยู่ที่ไบต์ 0-31

    ระเบียนที่เป็นศูนย์ทั้ง 32 ไบต์ = ไม่มีรหัสนั้นในไฟล์ต้นทาง

ต่างจากรุ่น 1 (6 ไบต์ = 12 hex แรก) ที่ค้นย้อนกลับได้แค่ตัวขึ้นต้น
ทำให้หน้าค้นรหัสแสดงรหัสต้นฉบับไม่ครบ และเทียบแบบเป๊ะ ๆ ไม่ได้
รุ่น 1 ยังอ่านได้อยู่ ตัวโหลดแยกด้วยขนาดไฟล์ (หารลงตัวด้วย 32 หรือ 6)

    python etl/build_custmap.py "แปลงรหัสลูกหนี้รวม.xlsx"
    python etl/build_custmap.py <ไฟล์.xlsx> -o app/public/custmap.bin

★ ไฟล์ต้นทางกับไฟล์ผลลัพธ์มาจากข้อมูลลูกค้าจริง ทั้งคู่ติด .gitignore ไว้แล้ว
"""
from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
BYTES_PER_RECORD = 32
CODE_RE = re.compile(r"^CUS(\d{7})$")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def read_shared_strings(z: zipfile.ZipFile) -> list[str]:
    """ตาราง sharedStrings ของ xlsx — ไฟล์นี้มีราว 1.17 ล้านรายการ"""
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root.iter(NS + "si")]


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    """ค่าในเซลล์ — เป็นได้ทั้ง sharedString (t="s") และ inlineStr"""
    v = cell.find(NS + "v")
    if v is None:
        inline = cell.find(NS + "is")
        if inline is None:
            return ""
        return "".join(t.text or "" for t in inline.iter(NS + "t"))
    if cell.get("t") == "s":
        idx = int(v.text or "0")
        return shared[idx] if 0 <= idx < len(shared) else ""
    return v.text or ""


def col_of(ref: str) -> str:
    """'B123' -> 'B' — ใช้จับคู่คอลัมน์แทนการนับลำดับ เพราะเซลล์ว่างถูกข้ามใน xml"""
    return ref.rstrip("0123456789")


def build(src: Path, out: Path) -> None:
    with zipfile.ZipFile(src) as z:
        shared = read_shared_strings(z)
        sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
        if not sheets:
            sys.exit("ไม่พบชีตในไฟล์")
        sheet = ET.fromstring(z.read(sorted(sheets)[0]))

    rows = list(sheet.iter(NS + "row"))
    if not rows:
        sys.exit("ชีตว่าง")

    # แถวแรกเป็นหัวตาราง — หาว่าคอลัมน์ไหนคือรหัสที่แปลงแล้ว คอลัมน์ไหนคือรหัสต้นฉบับ
    header = {col_of(c.get("r") or ""): cell_value(c, shared).strip() for c in rows[0]}
    code_col = next((k for k, v in header.items() if "แปลง" in v), None)
    hash_col = next((k for k, v in header.items() if "ต้นฉบับ" in v), None)
    if not code_col or not hash_col:
        sys.exit(f"หาหัวคอลัมน์ไม่เจอ — เจอ {header}")
    print(f"คอลัมน์ {code_col} = รหัสที่แปลงแล้ว / {hash_col} = รหัสต้นฉบับ")

    pairs: dict[int, bytes] = {}
    bad_code = bad_hash = 0
    dup = 0
    for r in rows[1:]:
        cells = {col_of(c.get("r") or ""): c for c in r}
        code = cell_value(cells[code_col], shared).strip() if code_col in cells else ""
        h = cell_value(cells[hash_col], shared).strip().lower() if hash_col in cells else ""
        if not code and not h:
            continue
        m = CODE_RE.match(code)
        if not m:
            bad_code += 1
            continue
        if not HASH_RE.match(h):
            bad_hash += 1
            continue
        n = int(m.group(1))
        if n in pairs:
            dup += 1
            continue
        pairs[n] = bytes.fromhex(h)

    if not pairs:
        sys.exit("ไม่ได้คู่รหัสสักคู่ — ตรวจว่าไฟล์ถูกตัวไหม")

    count = max(pairs)
    buf = bytearray(count * BYTES_PER_RECORD)
    for n, raw in pairs.items():
        buf[(n - 1) * BYTES_PER_RECORD:n * BYTES_PER_RECORD] = raw

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(buf)

    holes = count - len(pairs)
    print(f"เขียน {out}")
    print(f"  {len(pairs):,} รหัส / สูงสุด CUS{count:07d} / {len(buf) / 1048576:.1f} MB")
    if holes:
        print(f"  [!] เลขที่ขาดหายไป {holes:,} ตำแหน่ง (ระเบียนเป็นศูนย์ ค้นแล้วจะไม่เจอ)")
    if bad_code or bad_hash or dup:
        print(f"  [!] ข้ามแถว: รหัส CUS ผิดรูป {bad_code:,} / hash ผิดรูป {bad_hash:,} / ซ้ำ {dup:,}")
    first = buf[:BYTES_PER_RECORD].hex()
    print(f"  ระเบียนแรก CUS0000001 = {first}")


def main() -> None:
    ap = argparse.ArgumentParser(description="สร้าง custmap.bin จากไฟล์แปลงรหัสลูกหนี้")
    ap.add_argument("src", type=Path, help="ไฟล์ แปลงรหัสลูกหนี้รวม.xlsx")
    ap.add_argument("-o", "--out", type=Path, default=Path("app/public/custmap.bin"))
    a = ap.parse_args()
    if not a.src.exists():
        sys.exit(f"ไม่พบไฟล์ {a.src}")
    build(a.src, a.out)


if __name__ == "__main__":
    main()
