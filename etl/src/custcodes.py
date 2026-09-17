"""แปลงรหัสต้นฉบับ (hash 64 ตัว) เป็นเลขรหัส CUS ตั้งแต่ตอน ETL

ทำไมต้องแปลงที่นี่ ไม่ใช่ที่แอป
---------------------------------
`app/public/custmap.bin` ใหญ่ 18 MB ฝั่งแอปจึงโหลดเฉพาะหน้า "ค้นหารหัสลูกค้า" กับ
หน้าบันทึกข้อมูลที่มีรหัสต้นฉบับอยู่ในใบจริง ๆ (กติกาใน CLAUDE.md)
แดชบอร์ดไม่เคยโหลด ชื่อลูกค้าบนกราฟกับตารางจึงขึ้นเป็น hash ย่อ

แต่ตัวแคชอยู่ระดับโมดูล พอเผลอแวะหน้าค้นรหัสก่อนแล้วกลับมา รหัสดันขึ้นให้
— ผลลัพธ์เลยไม่แน่นอน ขึ้นกับว่าเปิดหน้าไหนมาก่อน ซึ่งอธิบายกับคนใช้ไม่ได้

ETL รันบนเครื่องที่มีไฟล์อยู่แล้ว จึงแปลงให้เสร็จตั้งแต่ตอนสร้าง JSON
แอปอ่านเลขที่แปลงมาแล้วตรง ๆ ไม่ต้องโหลดอะไรเพิ่ม และได้ผลเหมือนกันทุกครั้ง

รูปแบบไฟล์
----------
    32 ไบต์ต่อระเบียน = รหัสต้นฉบับ 64 ตัวในรูปไบนารี (ไม่ใช่ข้อความ)
    ตำแหน่งระเบียน = เลขในรหัส — ระเบียนที่ 0 คือ CUS0000001
    ระเบียนที่เป็นศูนย์ทั้ง 32 ไบต์ = ช่องว่าง ไม่มีรหัสนั้นในไฟล์ต้นทาง
    รุ่นเก่าเก็บ 6 ไบต์ (12 ตัวแรก) — แยกด้วยขนาดไฟล์ที่หารลงตัว ลอง 32 ก่อนเสมอ
    ★ ลำดับการเดารุ่นต้องตรงกับ headCount()/build() ฝั่งแอป ไม่งั้นสองทางนับได้ไม่เท่ากัน

★ เดินไฟล์รอบเดียวแล้วเก็บเฉพาะรหัสที่ "มีคนถาม" (wanted) ไม่ได้ทำ dict ทั้ง 584,941 ระเบียน
  เพราะ build_json.py รันพร้อมข้อมูลจริงหลายล้านแถว หน่วยความจำตึงอยู่แล้ว
"""
from __future__ import annotations

from pathlib import Path

FULL_BYTES = 32
PREFIX_BYTES = 6
ZERO32 = bytes(FULL_BYTES)


def custmap_path(root: Path) -> Path:
    return root / "app" / "public" / "custmap.bin"


def record_size(n_bytes: int) -> int | None:
    """ขนาดระเบียนที่ไฟล์นี้ใช้ — None ถ้าขนาดไม่ลงตัวกับรุ่นไหนเลย"""
    for size in (FULL_BYTES, PREFIX_BYTES):
        if n_bytes and n_bytes % size == 0:
            return size
    return None


def custmap_count(root: Path) -> int:
    """จำนวนระเบียนในไฟล์ — 0 = ไม่มีไฟล์หรือไฟล์เสีย (ผู้เรียกต้องไม่ออกรหัสเอง)"""
    p = custmap_path(root)
    if not p.exists():
        return 0
    n = p.stat().st_size
    size = record_size(n)
    return n // size if size else 0


def resolve_codes(root: Path, wanted: set[str]) -> dict[str, int]:
    """รหัสต้นฉบับ -> เลขในรหัส CUS เฉพาะตัวที่อยู่ใน wanted

    คืน dict ว่างถ้าไม่มีไฟล์ / ไฟล์เสีย / ไฟล์เป็นรุ่นเก่า 6 ไบต์
    (รุ่นเก่าเก็บแค่ 12 ตัวแรก เทียบเป๊ะไม่ได้ ยอมไม่แปลงดีกว่าแปลงผิดคน)
    """
    if not wanted:
        return {}
    p = custmap_path(root)
    if not p.exists():
        return {}
    size = record_size(p.stat().st_size)
    if size != FULL_BYTES:
        return {}

    # แปลง hex -> ไบต์ครั้งเดียว แล้วเทียบกับไฟล์ตรง ๆ เร็วกว่าแปลงไฟล์เป็น hex ทีละระเบียน
    want: dict[bytes, str] = {}
    for h in wanted:
        s = str(h or "").strip().lower()
        if len(s) != FULL_BYTES * 2:
            continue                       # ไม่ใช่รหัสต้นฉบับ (เช่นชื่อบริษัทที่พิมพ์เอง)
        try:
            want[bytes.fromhex(s)] = s
        except ValueError:
            continue
    if not want:
        return {}

    out: dict[str, int] = {}
    CHUNK = FULL_BYTES * 65536            # อ่านทีละ 2 MB ไม่ยกไฟล์ 18 MB เข้าหน่วยความจำ
    index = 0
    with p.open("rb") as fh:
        while True:
            buf = fh.read(CHUNK)
            if not buf:
                break
            for off in range(0, len(buf) - FULL_BYTES + 1, FULL_BYTES):
                rec = buf[off:off + FULL_BYTES]
                index += 1                # ระเบียนที่ 1 = CUS0000001
                if rec == ZERO32:
                    continue
                hit = want.get(rec)
                if hit is not None:
                    out[hit] = index
                    if len(out) == len(want):
                        return out
    return out
