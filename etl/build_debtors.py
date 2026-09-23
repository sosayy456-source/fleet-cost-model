"""แปลงไฟล์ลูกหนี้ (ใบวางบิล) เป็น JSON ให้แท็บ "Dashboard ลูกหนี้"

    python etl/build_debtors.py --dataset sample
        etl/sample_data/ExampleDebtors.xlsx
    python etl/build_debtors.py --dataset real
        etl/data/debtors/*.xlsx

ผลลัพธ์ app/public/data/<dataset>/debtors/
    manifest.json   สรุปจำนวน ช่วงวันที่ ยอดคงค้าง ยอดที่ปิดแล้ว
    debtors.json    1 แถว = 1 ใบวางบิล คีย์สั้น ๆ (ความหมายอยู่ใน interface DebtorRow ฝั่งแอป)
    codes.json      รหัสลูกหนี้ -> เลขในรหัส CUS (ดู "การออกรหัส CUS" ข้างล่าง)

การออกรหัส CUS
    รหัสลูกหนี้ในไฟล์นี้ยาว 40 ตัว (SHA-1) ส่วน custmap.bin เก็บรหัสต้นฉบับยาว 64 ตัว (SHA-256)
    จึงหากันไม่เจอตลอดกาล — ต้องออกเลขใหม่ให้ โดยรันต่อจากจำนวนระเบียนใน custmap.bin
    (584,941 ระเบียน -> ลูกหนี้รายแรกได้ CUS0584942)

    ★ อ่าน codes.json เดิมกลับมาก่อนเสมอ แล้วออกเลขให้เฉพาะรหัสที่ยังไม่เคยมี
      ถ้าไม่ทำ พอเดือนหน้ามีลูกหนี้รายใหม่แทรกเข้ามา ทุกคนจะถูกเรียงเลขใหม่หมด
      แล้วรหัสที่เคยพิมพ์ใส่เอกสารไปแล้วจะชี้ผิดคนโดยไม่มีอะไรบอก
    ★ เลขที่ออกที่นี่กับ localStorage "custNewCodes" ของแอปใช้พื้นที่เลขเดียวกัน
      ฝั่งแอปจึงต้องเอา codes.json มานับรวมใน nextNumber() ไม่งั้นออกเลขทับกัน

คอลัมน์ต้นทาง (ตามไฟล์ตัวอย่างที่เจ้าของข้อมูลส่งมา 17 ก.ย. 2569):
    ชื่อลูกหนี้        รหัสที่ hash ไว้แล้วตั้งแต่ต้นทาง (ตัวอย่างเป็น hex 40 ตัว = SHA-1
                      ไม่ใช่ 64 ตัวแบบไฟล์บิล จึงแมปกับ custmap.bin ไม่ได้ ตั้งใจให้แยกกัน)
    สาขา              ชื่อสาขาตรง ๆ ไม่ต้องย้อนหาจากใบรายการเหมือนของเดิม
    ระยะเวลาเครดิต     จำนวนวันเครดิต "รายบิล" ไม่ใช่ค่าเดียวทั้งบริษัท (ตัวอย่างมี 7 / 15 / 30)
    เลขที่ใบวางบิล      13 หลัก — เป็นสตริง ห้ามแปลงเป็นตัวเลข เลข 0 นำหน้าจะหาย
    วันที่วางบิลได้     วันที่เริ่มนับเครดิต (ไฟล์บางรุ่นใช้หัวว่า "วันที่วางบิล" — รับทั้งสองแบบ)
    วันที่จบ            วันที่ปิดบัญชี — ★ เว้นว่าง = ยังค้างชำระ (เจ้าของข้อมูลยืนยัน 17 ก.ย. 2569)
    จำนวนเงิน          ยอดของใบวางบิลใบนั้น

★ หัวคอลัมน์รับได้หลายชื่อต่อช่อง (ALIASES) และตัดช่องว่างซ้ำทิ้งก่อนเทียบ — ไฟล์จริงที่ส่งมา
  ใช้ "วันที่วางบิลได้" ส่วนที่อ่านจาก PDF ตอนแรกได้ "วันที่วางบิล" เพราะชั้นข้อความของ PDF
  สลับรูปสระไทยจนคำท้ายหาย ถ้าบังคับชื่อเดียว ETL จะล้มทั้งไฟล์เพราะคำเดียว

นิยามที่ใช้คำนวณ:
    ครบกำหนด          = วันที่วางบิล + ระยะเวลาเครดิต
    ระยะเวลาปิดบัญชี   = วันที่จบ − วันที่วางบิล   (เฉพาะใบที่ปิดแล้ว)
    ปิดช้ากว่ากำหนด    = ระยะเวลาปิดบัญชี > ระยะเวลาเครดิต
    อายุหนี้ (aging)   = asOf − วันครบกำหนด        (เฉพาะใบที่ยังค้าง)

★ asOf = **วันที่ล่าสุดที่ปรากฏในไฟล์** (max ของวันที่วางบิลกับวันที่จบ) ไม่ใช่วันที่รัน ETL
  ไฟล์เป็นรายงานที่ตัดยอด ณ วันหนึ่ง ถ้านับอายุหนี้ถึง "วันนี้" ช่วง Aging จะไหลไปกองที่
  ช่องท้ายเรื่อย ๆ ตามเวลาที่ผ่านไป ทั้งที่ข้อมูลไม่ได้เปลี่ยน แล้วเทียบกับรายงานที่พิมพ์ไว้
  ก่อนหน้าไม่ได้เลย — ชุดที่ส่งมาให้มีวันที่จบล่าสุด 17/07/2026 ซึ่งตรงกับ "ข้อมูล ณ วันที่"
  บนรายงานต้นฉบับพอดี ยืนยันว่าต้นทางก็คิดแบบเดียวกัน

★ ชุดข้อมูลนี้ "ไม่เชื่อมกับข้อมูลเก่า" — เลขที่ใบวางบิลเป็นคนละเลขกับเลขที่ใบรายการใน
  costrev/ และรหัสลูกหนี้ก็ยาวคนละขนาด จึงห้าม join สองฝั่งนี้เข้าด้วยกัน
★ ปีในไฟล์เป็นเลขสองหลัก (09/01/26) ดู parse_date ว่าตีความอย่างไร

ไฟล์รุ่นใหม่ "ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx" (22 ก.ย. 2569) — Sheet1 มี 7 คอลัมน์เดิมครบ
บวกคอลัมน์วิเคราะห์อีก 17 คอลัมน์ ซึ่ง ETL **ไม่อ่าน** (แอปคำนวณสถานะเองจาก issue/due/close
ตามวันที่ที่ผู้ใช้เลือก ผลจึงเท่ากับสูตรในชีตทุกวันที่ ไม่ใช่เฉพาะวันที่ที่ชีตล็อกไว้) ·
"วันที่จบ" ที่ว่างเขียนเป็นข้อความ "(ว่าง)" ซึ่ง parse_date คืน None ให้อยู่แล้ว = ยังค้างชำระ ·
ชีต "สรุปวิเคราะห์" มีเซลล์ "วันที่อ้างอิง (แทนวันนี้)" กับค่าในแถวถัดไป (K2) — อ่านมาใส่
manifest.refDate เป็น**ค่าเริ่มต้น**ของช่อง "ข้อมูล ณ วันที่" ในแท็บกำไรลูกค้าของ Demo
(ไม่แตะ asOf เดิม ซึ่งยังเป็นวันที่ล่าสุดในไฟล์ตามเหตุผลข้างบน)

นิยามสถานะ ณ วันที่อ้างอิง (ตามหมายเหตุท้ายชีตสรุปวิเคราะห์ — แอปใช้ชุดเดียวกัน):
    อยู่ในขอบเขต     = วางบิลไม่เกินวันที่อ้างอิง
    ชำระแล้ว         = ปิดบัญชีภายในวันที่อ้างอิง (วันที่จบ ≤ วันที่อ้างอิง)
    ค้างชำระ         = ยังไม่ปิด และเลยวันครบกำหนดแล้ว
    ยังไม่ถึงกำหนด   = ยังไม่ปิด และยังไม่เลยวันครบกำหนด
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

try:                      # calamine เร็วกว่า openpyxl ราว 10 เท่า — ไฟล์ลูกหนี้จริงอาจหลายหมื่นแถว
    import python_calamine as _calamine
except ImportError:
    _calamine = None

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_ROOT = ROOT / "app" / "public" / "data"

SAMPLE_FILE = HERE / "sample_data" / "ExampleDebtors.xlsx"
REAL_DIR = HERE / "data" / "debtors"
CUSTMAP_BIN = ROOT / "app" / "public" / "custmap.bin"
# ขนาดระเบียนของ custmap.bin — ลำดับการเดาต้องตรงกับ headCount() ฝั่งแอป (32 ก่อน แล้ว 6)
CUSTMAP_SIZES = (32, 6)

COL_NAME = "ชื่อลูกหนี้"
COL_BRANCH = "สาขา"
COL_TERM = "ระยะเวลาเครดิต"
COL_DOC = "เลขที่ใบวางบิล"
COL_ISSUE = "วันที่วางบิลได้"
COL_CLOSE = "วันที่จบ"
COL_AMOUNT = "จำนวนเงิน"
REQUIRED = [COL_NAME, COL_BRANCH, COL_TERM, COL_DOC, COL_ISSUE, COL_CLOSE, COL_AMOUNT]

# ชื่อหัวคอลัมน์ที่ยอมรับได้ต่อหนึ่งช่อง — ตัวแรกคือชื่อในไฟล์จริง
ALIASES: dict[str, tuple[str, ...]] = {
    COL_NAME: (COL_NAME, "ชื่อลูกค้า", "รหัสลูกหนี้"),
    COL_BRANCH: (COL_BRANCH,),
    COL_TERM: (COL_TERM, "เครดิต", "ระยะเวลาเครดิต (วัน)"),
    COL_DOC: (COL_DOC, "เลขที่ใบวางบิลได้", "เลขที่วางบิล"),
    COL_ISSUE: (COL_ISSUE, "วันที่วางบิล"),
    COL_CLOSE: (COL_CLOSE, "วันที่ปิดบัญชี", "วันที่รับชำระ"),
    COL_AMOUNT: (COL_AMOUNT, "จำนวนเงิน (บาท)", "ยอดเงิน"),
}


def norm_header(v) -> str:
    """ยุบช่องว่างทุกชนิดให้เหลือช่องเดียว — หัวตารางจาก Excel มักมี   หรือเว้นวรรคท้ายติดมา"""
    return " ".join(text(v).replace(" ", " ").split())


def text(v) -> str:
    """เซลล์ → ข้อความ · calamine คืนตัวเลขเป็น float เสมอ ต้องตัด .0 ทิ้งก่อน
    ไม่งั้นเลขที่ใบวางบิล 13 หลักจะกลายเป็น '1126010002014.0'"""
    if v is None:
        return ""
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def num(v) -> float:
    if v is None or str(v).strip() in ("", "-", "None"):
        return 0.0
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0


def parse_date(v) -> date | None:
    """dd/mm/yy · dd/mm/yyyy · yyyy-mm-dd · หรือ date ที่ตัวอ่าน Excel แปลงให้แล้ว

    ★ ไฟล์ตัวอย่างเขียนปีเป็นเลขสองหลัก (09/01/26) ซึ่งกำกวมระหว่าง ค.ศ. 2026 กับ พ.ศ. 2526
      ตัดสินด้วยเกณฑ์นี้: 00-49 = ค.ศ. 20xx · 50-99 = พ.ศ. 25xx
      เลข 26 จึงได้ ค.ศ. 2026 (ตรงกับเลขที่ใบวางบิลที่ฝังปีไว้เป็น '26') ส่วน 69 ได้ ค.ศ. 2026
      เหมือนกัน — รองรับทั้งสองแบบโดยไม่ต้องรู้ล่วงหน้าว่าไฟล์ไหนใช้แบบไหน
    """
    if v is None:
        return None
    if isinstance(v, datetime):
        v = v.date()
    if isinstance(v, date):
        return v.replace(year=v.year - 543) if v.year > 2400 else v
    s = str(v).strip()
    if not s:
        return None
    # ★ เลขลำดับวันของ Excel (นับจาก 30/12/1899) — ไฟล์ "สุ่ม 1200 บิล.xlsx" (23 ก.ย. 2569) จัดรูปแบบเซลล์วันที่
    #   เป็นตัวเลข จึงได้ 46030 แทน 09/01/2026 · ถ้าไม่รู้จัก ทุกแถวจะถูกข้ามว่า "ไม่มีวันที่วางบิล" (เจอจริง: 1,200/1,200)
    #   ช่วง 20000-80000 ตรงกับ toBEYear() ใน app/src/lib/repair/xlsx.ts (ปี ค.ศ. 1954-2119) ไม่ทับกับ dd/mm/yy
    if not isinstance(v, bool):
        try:
            serial = float(s.replace(",", ""))
        except ValueError:
            serial = None
        if serial is not None and 20000 <= serial <= 80000:
            return date(1899, 12, 30) + timedelta(days=int(serial))
    for sep in ("/", "-", "."):
        parts = [p.strip() for p in s.split(sep)]
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            a, b, c = (int(p) for p in parts)
            if len(parts[0]) == 4:            # yyyy-mm-dd
                y, m, d = a, b, c
            else:                             # dd/mm/yy หรือ dd/mm/yyyy
                d, m, y = a, b, c
            if y < 100:
                y = 2000 + y if y < 50 else 1957 + y   # 1957 + 69 = 2026 (พ.ศ. 2569)
            if y > 2400:
                y -= 543
            try:
                return date(y, m, d)
            except ValueError:
                return None
    return None


#: ชีตข้อมูลรายใบในไฟล์รุ่นใหม่ — ไฟล์รุ่นเก่ามีชีตเดียวจึงถอยไปใช้ชีตแรก
DATA_SHEET = "Sheet1"
#: ป้ายของเซลล์วันที่อ้างอิงในชีตสรุปวิเคราะห์ (J1) — ค่าอยู่แถวถัดไปถัดจากช่อง "ค่า:" (K2)
REF_LABEL = "วันที่อ้างอิง"


def _sheets(path: Path) -> dict[str, list[list]]:
    """ทุกชีต → แถวดิบ (calamine ก่อน ถอยไป openpyxl)"""
    if _calamine is not None:
        wb = _calamine.CalamineWorkbook.from_path(str(path))
        return {n: wb.get_sheet_by_name(n).to_python(skip_empty_area=False) for n in wb.sheet_names}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return {ws.title: [list(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}


def iter_sheet(path: Path):
    """คืน (หัวคอลัมน์, ตัวไล่แถว, วันที่อ้างอิง) — อ่านชีต Sheet1 ถ้ามี ไม่งั้นชีตแรก หัวตารางอยู่แถวบนสุด

    วันที่อ้างอิงมาจากชีตอื่นที่มีเซลล์ขึ้นต้นด้วย "วันที่อ้างอิง" (ค่าอยู่แถวถัดไป ช่องแรกที่เป็นวันที่นับจากคอลัมน์ป้าย)
    ไฟล์รุ่นเก่าไม่มี → None
    """
    sheets = _sheets(path)
    if not sheets:
        return [], iter(()), None
    rows = sheets.get(DATA_SHEET) or next(iter(sheets.values()))
    ref = None
    for name, grid in sheets.items():
        if name == DATA_SHEET or ref is not None:
            continue
        for i, r in enumerate(grid[:-1]):
            for j, c in enumerate(r):
                if isinstance(c, str) and c.strip().startswith(REF_LABEL):
                    # แถวถัดไปเป็น "ค่า:" (J2) แล้ววันที่อยู่ช่องถัดไป (K2) — กวาดจากคอลัมน์ป้ายไปทางขวา
                    # เอาช่องแรกที่อ่านเป็นวันที่ได้ จะได้ไม่ผูกกับตำแหน่งคอลัมน์ตายตัว
                    for v in grid[i + 1][j:]:
                        ref = parse_date(v)
                        if ref is not None:
                            break
                    break
            if ref is not None:
                break
    if not rows:
        return [], iter(()), ref
    hdr = [text(c) for c in rows[0]]
    body = (r for r in rows[1:] if any(c is not None and str(c).strip() != "" for c in r))
    return hdr, body, ref


def read_file(path: Path) -> tuple[list[dict], int, date | None]:
    hdr, body, ref = iter_sheet(path)
    idx = {name: hdr.index(name) for name in REQUIRED if name in hdr}
    missing = [c for c in REQUIRED if c not in idx]
    if missing:
        raise SystemExit(
            f"ไฟล์ {path.name} ไม่มีคอลัมน์: {', '.join(missing)}\n"
            f"  หัวตารางที่อ่านได้: {', '.join(h for h in hdr if h) or '(ว่าง)'}"
        )

    def g(row, name):
        i = idx[name]
        return row[i] if i < len(row) else None

    out: list[dict] = []
    skipped = 0
    for r in body:
        doc = text(g(r, COL_DOC))
        issue = parse_date(g(r, COL_ISSUE))
        if not doc or issue is None:
            skipped += 1        # ไม่มีเลขที่ใบหรือวันที่วางบิล = คำนวณอะไรต่อไม่ได้
            continue
        close = parse_date(g(r, COL_CLOSE))
        term = int(num(g(r, COL_TERM)))
        due = issue + timedelta(days=term)
        # over เติมทีหลังใน build() เพราะต้องรู้ asOf ของทั้งชุดก่อน
        out.append({
            "doc": doc,
            "cust": text(g(r, COL_NAME)),
            "br": text(g(r, COL_BRANCH)) or "(ไม่ระบุ)",
            "term": term,
            "issue": issue.isoformat(),
            "mo": issue.strftime("%Y-%m"),
            "y": issue.year,
            "due": due.isoformat(),
            "close": close.isoformat() if close else None,
            "amount": round(num(g(r, COL_AMOUNT)), 2),
            # ปิดแล้ว: กี่วันจึงปิด · ยังค้าง: เกินกำหนดมากี่วัน (เติมใน build)
            "days": (close - issue).days if close else None,
            "over": None,
        })
    return out, skipped, ref


def custmap_count() -> int:
    """จำนวนระเบียนใน custmap.bin — ฐานของเลขรหัสที่จะออกให้ลูกหนี้

    ไม่มีไฟล์ = คืน 0 แล้วผู้เรียกจะไม่ออกรหัสเลย ดีกว่าออกเลขทับของเดิม
    """
    if not CUSTMAP_BIN.exists():
        return 0
    n = CUSTMAP_BIN.stat().st_size
    for size in CUSTMAP_SIZES:
        if n % size == 0:
            return n // size
    return 0


def assign_codes(rows: list[dict], out_dir: Path) -> dict:
    """ออกเลขรหัสให้ลูกหนี้ — เก็บเลขเดิมไว้ ออกเพิ่มเฉพาะรายใหม่"""
    base = custmap_count()
    prev_path = out_dir / "codes.json"
    codes: dict[str, int] = {}
    prev_base = base
    if prev_path.exists():
        try:
            old = json.loads(prev_path.read_text(encoding="utf-8"))
            prev_base = int(old.get("base", base))
            codes = {k: int(v) for k, v in (old.get("codes") or {}).items() if int(v) > 0}
        except (ValueError, OSError):
            codes = {}          # ไฟล์เดิมพัง — ออกใหม่ทั้งชุดดีกว่าใช้เลขที่อ่านไม่ออก

    if base and prev_base and base != prev_base:
        print(f"  [!] custmap.bin เปลี่ยนขนาด ({prev_base:,} -> {base:,} ระเบียน) "
              f"เลขเดิมยังใช้ต่อ ไม่เรียงใหม่")

    if not base:
        print(f"  [!] ไม่พบ {CUSTMAP_BIN.name} หรือขนาดไม่ลงตัว — ไม่ออกรหัส CUS ให้ลูกหนี้รอบนี้")
        return {"base": 0, "next": 0, "issued": 0, "codes": {}}

    nxt = max([base, *codes.values()]) + 1
    issued = 0
    # เรียงตามวันที่วางบิลแล้วเลขที่ใบ เพื่อให้รายที่มาก่อนได้เลขก่อน (rows เรียงมาแล้ว)
    for r in rows:
        h = r["cust"]
        if not h or h in codes:
            continue
        codes[h] = nxt
        nxt += 1
        issued += 1

    return {"base": base, "next": nxt, "issued": issued,
            "codes": dict(sorted(codes.items(), key=lambda kv: kv[1]))}


def build(dataset: str) -> None:
    if dataset == "sample":
        files = [SAMPLE_FILE] if SAMPLE_FILE.exists() else []
    else:
        files = sorted(p for p in REAL_DIR.glob("*.xlsx") if not p.name.startswith("~$")) \
            if REAL_DIR.exists() else []
    if not files:
        where = SAMPLE_FILE if dataset == "sample" else REAL_DIR
        raise SystemExit(f"ไม่พบไฟล์ลูกหนี้ที่ {where}")

    rows: list[dict] = []
    skipped = 0
    ref_date: date | None = None
    for f in files:
        got, sk, ref = read_file(f)
        rows.extend(got)
        skipped += sk
        ref_date = ref_date or ref       # หลายไฟล์ก็ใช้วันที่อ้างอิงของไฟล์แรกที่มี
        print(f"  {f.name}: {len(got):,} ใบวางบิล" + (f" (ข้าม {sk})" if sk else "")
              + (f" · วันที่อ้างอิงในไฟล์ {ref.isoformat()}" if ref else ""))

    rows.sort(key=lambda r: (r["issue"], r["doc"]))

    # ★ asOf = วันที่ล่าสุดในไฟล์ ไม่ใช่วันนี้ (ดูเหตุผลใน docstring)
    #   ไฟล์ว่างหรืออ่านวันที่ไม่ได้เลยค่อยถอยไปใช้วันนี้
    stamps = [r["issue"] for r in rows] + [r["close"] for r in rows if r["close"]]
    as_of = date.fromisoformat(max(stamps)) if stamps else date.today()
    for r in rows:
        if r["close"] is None:
            r["over"] = (as_of - date.fromisoformat(r["due"])).days

    open_rows = [r for r in rows if r["close"] is None]
    closed = [r for r in rows if r["close"] is not None]
    late = [r for r in closed if r["days"] > r["term"]]
    dates = [r["issue"] for r in rows]

    out_dir = OUT_ROOT / dataset / "debtors"
    out_dir.mkdir(parents=True, exist_ok=True)
    codes = assign_codes(rows, out_dir)

    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceFiles": [f.name for f in files],
        "asOf": as_of.isoformat(),
        # วันที่อ้างอิงจากชีตสรุปวิเคราะห์ — null ถ้าไฟล์รุ่นเก่าไม่มีชีตนั้น (แอปถอยไปใช้ asOf)
        "refDate": ref_date.isoformat() if ref_date else None,
        "rows": len(rows),
        "skipped": skipped,
        "customers": len({r["cust"] for r in rows}),
        "branches": sorted({r["br"] for r in rows}),
        "terms": sorted({r["term"] for r in rows}),
        "dateRange": {"min": min(dates) if dates else None, "max": max(dates) if dates else None},
        "outstanding": {"bills": len(open_rows), "amount": round(sum(r["amount"] for r in open_rows), 2)},
        "closedBills": len(closed),
        "closedAmount": round(sum(r["amount"] for r in closed), 2),
        "avgClearDays": round(sum(r["days"] for r in closed) / len(closed), 4) if closed else None,
        "latePct": round(len(late) / len(closed) * 100, 4) if closed else None,
        "codes": {
            "base": codes["base"],
            "next": codes["next"],
            "issued": codes["issued"],
            "count": len(codes["codes"]),
        },
    }

    def dump(name: str, obj) -> None:
        (out_dir / name).write_text(
            json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    dump("debtors.json", rows)
    dump("codes.json", {k: codes[k] for k in ("base", "next", "codes")})
    dump("manifest.json", manifest)

    print(f"\nเขียนลง {out_dir}")
    print(f"  ใบวางบิล {len(rows):,} ใบ | ลูกหนี้ {manifest['customers']:,} ราย | "
          f"สาขา {len(manifest['branches'])} แห่ง")
    print(f"  ยังค้างชำระ {len(open_rows):,} ใบ {manifest['outstanding']['amount']:,.2f} บาท")
    print(f"  ปิดแล้ว {len(closed):,} ใบ | เฉลี่ย {manifest['avgClearDays']} วัน | "
          f"ปิดช้ากว่ากำหนด {manifest['latePct']}%")
    if codes["base"]:
        first = min(codes["codes"].values()) if codes["codes"] else 0
        last = max(codes["codes"].values()) if codes["codes"] else 0
        print(f"  รหัส CUS {len(codes['codes']):,} ราย (ออกใหม่รอบนี้ {codes['issued']:,}) | "
              f"CUS{first:07d} - CUS{last:07d} | ต่อจากไฟล์ {codes['base']:,} ระเบียน")


def main() -> int:
    ap = argparse.ArgumentParser(description="แปลงไฟล์ลูกหนี้เป็น JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="sample")
    build(ap.parse_args().dataset)
    return 0


if __name__ == "__main__":
    sys.exit(main())
