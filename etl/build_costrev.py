"""แปลงไฟล์ต้นทุน+รายได้รายเที่ยว (realalldata) เป็น JSON ให้แดชบอร์ด Executive / รวม

    python etl/build_costrev.py --dataset sample
        ต้นทุน  etl/sample_data/ExampleCostandRevenue.xlsx
        รายได้  RevenueDashboard/RevenueDashboard/sample_data/bill_*.xlsx
    python etl/build_costrev.py --dataset real
        ต้นทุน  etl/data/Dashboard real data/*.xlsx   (RealCostandRevenue.xlsx)
        รายได้  etl/data/revenue/*.xlsx                (ข้อมูลรายได้จริง)

ผลลัพธ์ app/public/data/<dataset>/costrev/
    manifest.json      สรุปจำนวน ช่วงวันที่ %จับคู่ระยะทาง
    trips.json         1 แถว = 1 เที่ยว (ทุกแถวในไฟล์) มีธง m = เลขที่ใบรายการตรงกับข้อมูลรายได้
    old_records.json   เที่ยวที่จับคู่ได้ ในรูปแถว "ข้อมูลเก่า" ของหน้ารายการทั้งหมด
    old_debtors.json   บิล "ที่ยังค้างชำระ" จากไฟล์รายได้ของเที่ยวที่จับคู่ได้ ในรูปแถว "ข้อมูลเก่า" ของหน้าลูกหนี้

กติกา (ตกลงกับเจ้าของข้อมูล 16 ก.ย. 2569):
    รายได้เที่ยว    = ราคารวมจากรายได้ ถ้าว่างใช้ ค่าบรรทุกทั้งใบรายการ
    ต้นทุนเที่ยว    = คอลัมน์ ต้นทุน (ตัวสุดท้าย รวมค่าเช่าแล้ว)
    เที่ยววิ่งเปล่า  = ราคารวมจากรายได้ = 0 และ ค่าบรรทุกทั้งใบรายการ = 0 พร้อมกัน (ช่องว่างนับเป็น 0)
                     ไม่จำกัดประเภทใบรายการ — ตกลง 17 ก.ย. 2569 (docs/spec-เที่ยววิ่งเปล่า.md)
                     ★ อ่านสองคอลัมน์แยกกัน ห้ามดูจาก revenue เพราะถ้าคอลัมน์แรกเป็น 0 จริง revenue
                       จะเป็น 0 โดยไม่ดูค่าบรรทุก
    สูญเปล่า        = 3 คอลัมน์น้ำมันนอกเส้นทาง (WASTE_COLS) — เอกสารฉบับแก้ 16 ก.ย. 2569 ย้าย
                     "เบี้ยเลี้ยงนอกเส้นทาง" ออกจากสูญเปล่าไปอยู่ในค่าเบี้ยเลี้ยง
    น้ำมัน          = 8 คอลัมน์ตามเอกสารจัดประเภทต้นทุน (ไม่มีแก๊ส/Fleet Card)
    เบี้ยเลี้ยง      = พขร. + สำรอง + นอกเส้นทาง
    ค่าธรรมเนียม    = ผ้าใบ ตำรวจ ประกัน + คืนตู้ ท่าเรือ ส่งเอกสาร ทางด่วน (เจ้าของยืนยันให้นับทั้ง 7)
    ค่าซ่อม          = "ต้นทุนคงที่กึ่งผันแปร" กลุ่มของตัวเอง ไม่อยู่ในผันแปร (ฉบับแก้ 16 ก.ย. 2569)
    ค่าเสื่อม        = ต้นทุนคงที่ · ค่าเช่าไม่รวมในกราฟกลุ่มต้นทุน
    กลุ่มบริการ (sg) = ประเภทสินค้าที่พบมากสุดในบิลรายได้ของใบนั้น — ไฟล์ต้นทุนไม่มีคอลัมน์นี้
                     เที่ยวที่จับคู่ไม่ได้จึงเป็น "" (แอปแสดง "ไม่ระบุ") ใช้ในกราฟจัดอันดับความคุ้มค่า
    ค่าเช่า          นับเป็นต้นทุนเฉพาะแถว หมายเหตุต้นทุน=ค่าเช่า (ต้นทุน = ค่าเช่ารวม ทั้งก้อน)
                     แถว "ค่าเดินทาง" ต้นทุน = Σ ค่าแก๊ส…ค่าซ่อมรวม (คอลัมน์ 13-42) ตรวจแล้ว 4,130/4,130 แถว
    อื่น ๆ           = ต้นทุนปกติ − ผันแปร − กึ่งผันแปร − คงที่ − ค่าเช่า (แก๊ส, Fleet Card เดินทาง, เพิ่มย้อนหลัง, SND)
    ระยะทาง         = routes.json ของแอป จับคู่ด้วย จุดขึ้น/จุดลง (ไม่ตรงก็ null)

★ ไฟล์ต้นทางใช้ openpyxl อ่านตรง ๆ ไม่ผ่าน pandas — pandas ใน venv ถูก Windows
  Application Control บล็อก DLL ของ pyarrow ตั้งแต่ 16 ก.ย. (build_json.py ยังพัง)
★ วันที่ปล่อยรถในไฟล์ปนปี ค.ศ. กับ พ.ศ. ในคอลัมน์เดียว — parse_date แปลงเป็น ค.ศ. ทั้งหมด
★ เลขที่ใบรายการต้องเทียบเป็นสตริงเป๊ะ ๆ (13 หลัก) ห้ามแปลงเป็นตัวเลข เลข 0 นำหน้าจะหาย
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl

try:                      # calamine อ่าน .xlsx เร็วกว่า openpyxl ราว 10 เท่า
    import python_calamine as _calamine   # ไฟล์รายได้จริงเดือนละ ~110k แถว 29 ไฟล์
except ImportError:       # ไม่มีก็ยังรันได้ แค่ช้ากว่า (openpyxl อยู่ใน requirements อยู่แล้ว)
    _calamine = None

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.custcodes import resolve_codes  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_ROOT = ROOT / "app" / "public" / "data"
ROUTES_JSON = ROOT / "app" / "src" / "lib" / "refdata" / "routes.json"

SAMPLE_COST = HERE / "sample_data" / "ExampleCostandRevenue.xlsx"
SAMPLE_REV_DIR = ROOT / "RevenueDashboard" / "RevenueDashboard" / "sample_data"
REAL_COST_DIR = HERE / "data" / "Dashboard real data"
REAL_REV_DIR = HERE / "data" / "revenue"

# ---- นิยามกลุ่มคอลัมน์ (ชื่อต้องตรงกับหัวตารางในไฟล์ทุกตัวอักษร) ----
WASTE_COLS = [
    "น้ำมันนอกเส้นทาง",
    "ค่าน้ำมันนอกเส้นทาง(Fleet Card)",
    "ค่าน้ำมันรถวิ่งอ้อม",
]
FUEL_COLS = {
    "cash":   ["ค่าน้ำมันเดินทาง(เงินสด)"],
    "down":   ["ค่าน้ำมันเดินทางขาล่อง(บิลน้ำมัน)", "จำนวนเงินขาล่อง"],
    "up":     ["ค่าน้ำมันเดินทางขาขึ้น (บิลน้ำมัน)", "จำนวนเงินขาขึ้น"],
    "pickup": ["ค่าน้ำมันไปเก็บสินค้า"],
    "call":   ["ค่าเรียกรถไปขึ้นของ (บิลน้ำมัน)", "ค่าเรียกรถไปขึ้นของ"],
}
ALLOW_COLS = {
    "drv":   ["ค่าเบี้ยเลี้ยงพขร."],
    "spare": ["ค่าเบี้ยเลี้ยงพขร.สำรอง"],
    "off":   ["เบี้ยเลี้ยงนอกเส้นทาง"],   # เคยอยู่ใน WASTE_COLS — เอกสารฉบับแก้ย้ายมาที่นี่
}
FEE_COLS = {
    "tarp":   ["ค่าปิดเปิดผ้าใบรถเทเลอร์"],
    "police": ["ค่าตำรวจ"],
    "insure": ["ค่าประกันสินค้า"],
    "cont":   ["ค่าธรรมเนียมคืนตู้"],
    "port":   ["ค่าเข้าท่าเรือ"],
    "doc":    ["ค่าส่งเอกสาร"],
    "toll":   ["ค่าทางด่วน"],
}
COL_REPAIR = "ค่าซ่อมรวม"
COL_DEP = "ค่าเสื่อม"
COL_RENT = "ค่าเช่ารวม"
COL_COST = "ต้นทุน"
COL_REV1 = "ราคารวมจากรายได้"
COL_REV2 = "ค่าบรรทุกทั้งใบรายการ"

PAYMENT_UNPAID = "ยังไม่ได้ชำระ"   # ตรงกับ PAYMENT_STATUS_UNPAID ใน etl/src/cleaning.py
GOODS_CLEARED = "บิลเคลียร์"       # ตรงกับ CLEARED_GOODS ใน app/src/lib/cost/recCost.ts
#: ลูกค้าของบิล = ผู้จ่ายเงิน — กติกาเดียวกับหน้ากำไรลูกค้า (src/alloc.py payer_of)
PAYER_SENDER = frozenset({"สดต้นทาง", "เชื่อต้นทาง"})
PAYER_RECEIVER = frozenset({"สดปลายทาง", "เชื่อปลายทาง"})


def num(v) -> float:
    if v is None or v == "" or v == "-":
        return 0.0
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0


def num_or_none(v) -> float | None:
    if v is None or str(v).strip() in ("", "-", "None"):
        return None
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def text(v) -> str:
    """
    ค่าในเซลล์ → ข้อความ

    ★ calamine คืนเซลล์ตัวเลขเป็น float เสมอ — เลขที่ใบรายการ 13 หลักจะกลายเป็น
      "6250753132426.0" ถ้าปล่อยให้ str() ทำงานตรง ๆ แล้วจับคู่กับไฟล์อีกฝั่งไม่ได้
      (ตอนพบ: จับคู่ได้ 526 แทนที่จะเป็น 536) จำนวนเต็มจึงต้องตัด .0 ทิ้งก่อน
    """
    if v is None:
        return ""
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def parse_date(v) -> date | None:
    """dd/mm/yyyy ที่ปีเป็น ค.ศ. หรือ พ.ศ. ก็ได้ · หรือ datetime ที่ openpyxl แปลงให้แล้ว"""
    if v is None:
        return None
    if isinstance(v, datetime):
        v = v.date()
    if isinstance(v, date):
        # ★ เซลล์ที่เป็นวันที่จริง ๆ ก็มีปี พ.ศ. ปนมาได้ (เจอ 1 แถวใน 4.6 ล้าน เป็นปี 2567)
        #   ถ้าไม่แปลงจะหลุดเป็น "2567-09-.." ใน JSON แล้วตัวกรองปีมีปีประหลาดโผล่มา
        return v.replace(year=v.year - 543) if v.year > 2400 else v
    s = str(v).strip()
    for sep in ("/", "-"):
        parts = s.split(sep)
        if len(parts) == 3 and all(p.strip().isdigit() for p in parts):
            a, b, c = (int(p) for p in parts)
            if len(parts[0].strip()) == 4:       # yyyy-mm-dd
                y, m, d = a, b, c
            else:                                # dd/mm/yyyy
                d, m, y = a, b, c
            if y > 2400:
                y -= 543
            try:
                return date(y, m, d)
            except ValueError:
                return None
    return None


def iter_sheet(path: Path, header_row: int):
    """คืน (หัวคอลัมน์, ตัวไล่แถวข้อมูล) — header_row นับจาก 0

    ★ คืนเป็น iterator ไม่ใช่ list เพราะไฟล์รายได้จริงรวมกันเกือบ 2 ล้านแถว
      ถ้าอ่านเข้าหน่วยความจำทั้งก้อนพร้อมกันจะกินหลาย GB
    """
    if _calamine is not None:
        rows = _calamine.CalamineWorkbook.from_path(str(path)).get_sheet_by_index(0).to_python(skip_empty_area=False)
        hdr = [text(c) for c in rows[header_row]]
        body = (r for r in rows[header_row + 1:] if any(c is not None and str(c).strip() != "" for c in r))
        return hdr, body
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    it = wb.worksheets[0].iter_rows(values_only=True)
    for _ in range(header_row):
        next(it)
    hdr = [text(c) for c in next(it)]
    body = (r for r in it if any(c is not None and str(c).strip() != "" for c in r))
    return hdr, body


def read_sheet(path: Path, header_row: int):
    """เหมือน iter_sheet แต่คืนแถวเป็น list — ใช้กับไฟล์ต้นทุนที่แถวไม่เยอะ"""
    hdr, body = iter_sheet(path, header_row)
    return hdr, list(body)


def find_header_row(path: Path, must_have: str) -> int:
    """ไฟล์ต้นทุนมีแถวหัวกลุ่มอยู่บนหัวคอลัมน์จริง — หาแถวที่มีคอลัมน์ที่ต้องการ"""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    for i, r in enumerate(ws.iter_rows(values_only=True, max_row=10)):
        if any(text(c) == must_have for c in r):
            wb.close()
            return i
    wb.close()
    sys.exit(f"หาแถวหัวคอลัมน์ที่มี '{must_have}' ไม่เจอใน 10 แถวแรกของ {path.name}")


def xlsx_files(folder: Path) -> list[Path]:
    out = []
    for p in sorted(folder.glob("*.xlsx")):
        n = p.name
        if n.startswith("~$") or ".backup." in n.lower():
            continue
        out.append(p)
    return out


# ---------------------------------------------------------------- รายได้
def load_revenue(rev_dir: Path, want: set[str]):
    """
    อ่านไฟล์รายได้ แล้วคืน (ใบรายการที่ตรงกับ want, บิลของใบเหล่านั้น, จำนวนไฟล์, จำนวนแถว,
    ยอดที่ชำระแล้ว, มูลค่าบิลเคลียร์ต่อใบ, จำนวนรายการบิลเคลียร์ต่อใบ)

    ★ เก็บเฉพาะบิลของใบที่มีในไฟล์ต้นทุน (want) — ข้อมูลรายได้จริง 29 ไฟล์รวมเกือบ 2 ล้านแถว
      ถ้าเก็บทุกใบไว้ในหน่วยความจำจะกินหลาย GB ทั้งที่ใช้จริงแค่ไม่กี่พันใบ

    ★ จำนวนบิล (bill_n) กับผู้จ่ายเงิน (payers) นับ ★ ทุกบิล ★ ของใบนั้น ไม่ใช่เฉพาะบิลค้างชำระ
      ที่เก็บไว้ใน bills — หน้า Demo ใช้เป็นตัวหารของ กำไร/บิล และ กำไร/ลูกค้า
      บิลเคลียร์นับเป็นบิล แต่ไม่นับเป็นลูกค้า (ไม่ใช่ประเภทสินค้าจริง — กติกาเดียวกับ src/alloc.py)
    """
    doc_set: set[str] = set()
    bills: dict[str, list[dict]] = {}
    clr_amt: dict[str, float] = {}
    clr_n: dict[str, int] = {}
    goods: dict[str, Counter] = {}     # ประเภทสินค้าที่พบในบิลของแต่ละใบ → กลุ่มบริการของเที่ยว
    bill_n: dict[str, int] = {}        # จำนวนบิลทั้งหมดของใบนั้น (รวมที่ชำระแล้ว)
    payers: dict[str, set[str]] = {}   # รหัสผู้จ่ายเงินของใบนั้น (ไม่ซ้ำ)
    rows_seen = 0
    paid_seen = 0
    paid_total = 0.0
    files = xlsx_files(rev_dir)
    for p in files:
        hdr, rows = iter_sheet(p, 0)
        col = {h: i for i, h in enumerate(hdr)}
        need = ["เลขที่ใบรายการ", "เลขที่บิล", "วันที่", "ราคารวม", "สถานะการชำระเงิน"]
        missing = [c for c in need if c not in col]
        if missing:
            print(f"  [!] ข้าม {p.name}: ขาดคอลัมน์ {missing}")
            continue
        g = lambda r, name: r[col[name]] if name in col else None  # noqa: E731
        n0 = rows_seen
        for r in rows:
            rows_seen += 1
            doc = text(g(r, "เลขที่ใบรายการ"))
            if not doc or doc not in want:
                continue
            doc_set.add(doc)
            # มูลค่าความเสียหาย = ราคารวมของบิลที่ประเภทสินค้าเป็น "บิลเคลียร์" (นิยามเดียวกับ
            # adminWriteOff ฝั่งแอป) — ต้องนับ ★ ก่อน ★ ตัวกรองสถานะชำระเงินข้างล่าง เพราะบิลที่
            # ชำระแล้วจะถูก continue ทิ้ง ถ้านับทีหลังบิลเคลียร์ที่ชำระแล้วจะหายไปเงียบ ๆ แล้ว
            # Damage Rate ต่ำกว่าจริง (ชุดตัวอย่างบังเอิญเป็น "ยังไม่ได้ชำระ" ครบ ข้อมูลจริงไม่รับประกัน)
            goods_type = text(g(r, "ประเภทสินค้า"))
            if goods_type == GOODS_CLEARED:
                clr_amt[doc] = clr_amt.get(doc, 0.0) + num(g(r, "ราคารวม"))
                clr_n[doc] = clr_n.get(doc, 0) + 1
            elif goods_type:
                # กลุ่มบริการ = ประเภทสินค้าที่พบมากสุดในใบ (ไม่นับบิลเคลียร์ เพราะไม่ใช่ประเภทสินค้าจริง)
                goods.setdefault(doc, Counter())[goods_type] += 1
            # จำนวนบิล + ลูกค้า (ผู้จ่ายเงิน) — ต้องนับก่อนตัวกรองสถานะชำระเงินเช่นกัน
            bill_n[doc] = bill_n.get(doc, 0) + 1
            if goods_type != GOODS_CLEARED:
                pay = text(g(r, "ประเภทการชำระเงิน")).strip()
                who = (text(g(r, "ผู้ส่ง_encoded")) if pay in PAYER_SENDER
                       else text(g(r, "ผู้รับ_encoded")) if pay in PAYER_RECEIVER else "")
                if who:
                    payers.setdefault(doc, set()).add(who)

            status = text(g(r, "สถานะการชำระเงิน"))
            if status != PAYMENT_UNPAID:
                # ★ เก็บเฉพาะบิลที่ยังค้างชำระ (เจ้าของข้อมูลเลือกทางนี้ 16 ก.ย. 2569)
                #   ข้อมูลจริงเกือบทุกใบที่จับคู่ได้มีบิลติดมาด้วย ค้างชำระจริงราว 0.5%
                #   ถ้าเขียนลงไฟล์ทั้งหมด old_debtors.json จะใหญ่ระดับ GB — เบราว์เซอร์โหลดไม่ไหว
                #   และ ETL เองต้องถือ dict หลายล้านก้อนจนหน่วยความจำไม่พอ
                #   ที่ชำระแล้วยังนับจำนวนกับยอดรวมเก็บไว้ใน manifest.debtorPaid ไม่ได้หายเฉย ๆ
                paid_seen += 1
                paid_total += num(g(r, "ราคารวม"))
                continue
            d = parse_date(g(r, "วันที่"))
            bills.setdefault(doc, []).append({
                "docNo": doc,
                "no": text(g(r, "เลขที่บิล")),
                "date": d.isoformat() if d else "",
                "goodsType": text(g(r, "ประเภทสินค้า")),
                "origin": text(g(r, "ต้นทาง")),
                "dest": text(g(r, "ปลายทาง")),
                "sender": text(g(r, "ผู้ส่ง_encoded")),
                "receiver": text(g(r, "ผู้รับ_encoded")),
                "payType": text(g(r, "ประเภทการชำระเงิน")),
                "status": status,
                "paid": status != PAYMENT_UNPAID,
                "qty": num(g(r, "จำนวน")),
                "total": num(g(r, "ราคารวม")),
                "billStatus": text(g(r, "สถานะบิล")),
            })
        print(f"  {p.name}: {rows_seen - n0:,} แถว (สะสม {len(doc_set):,} ใบที่ตรงกับไฟล์ต้นทุน)")
    return (doc_set, bills, len(files), rows_seen,
            {"bills": paid_seen, "total": round(paid_total, 2)}, clr_amt, clr_n, goods, bill_n, payers)


# ---------------------------------------------------------------- ต้นทุน
def build(dataset: str) -> None:
    if dataset == "sample":
        cost_files = [SAMPLE_COST]
        rev_dir = SAMPLE_REV_DIR
    else:
        cost_files = xlsx_files(REAL_COST_DIR)
        rev_dir = REAL_REV_DIR
    if not cost_files or not cost_files[0].exists():
        sys.exit(f"ไม่พบไฟล์ต้นทุนสำหรับ {dataset} — วาง .xlsx ใน {REAL_COST_DIR if dataset == 'real' else SAMPLE_COST}")

    routes = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))

    def distance(o: str, d: str) -> float | None:
        v = routes.get(o, {}).get(d)
        if v is None:
            v = routes.get(d, {}).get(o)
        return float(v) if v is not None else None

    trips: list[dict] = []
    skipped_no_doc = skipped_no_date = 0
    kinds = Counter()
    for cf in cost_files:
        hrow = find_header_row(cf, "เลขที่ใบรายการ")
        hdr, rows = read_sheet(cf, hrow)
        col = {h: i for i, h in enumerate(hdr)}
        missing = [c for c in [COL_COST, COL_REV2, "เลขที่ใบรายการ", "วันที่ปล่อยรถ", "ประเภทใบรายการ"] if c not in col]
        if missing:
            sys.exit(f"{cf.name} ขาดคอลัมน์ {missing}")
        for k in WASTE_COLS + [c for cs in FUEL_COLS.values() for c in cs] + [c for cs in ALLOW_COLS.values() for c in cs] \
                + [c for cs in FEE_COLS.values() for c in cs] + [COL_REPAIR, COL_DEP, COL_RENT]:
            if k not in col:
                print(f"  [!] {cf.name}: ไม่มีคอลัมน์ '{k}' — จะคิดเป็น 0")

        def g(r, name):
            i = col.get(name)
            return r[i] if i is not None and i < len(r) else None

        def gsum(r, names):
            return round(sum(num(g(r, n)) for n in names), 2)

        print(f"อ่าน {cf.name}: {len(rows):,} แถว")
        for r in rows:
            doc = text(g(r, "เลขที่ใบรายการ"))
            if not doc:
                skipped_no_doc += 1
                continue
            d = parse_date(g(r, "วันที่ปล่อยรถ"))
            if d is None:
                skipped_no_date += 1
                continue

            rev1 = num_or_none(g(r, COL_REV1))
            revenue = rev1 if rev1 is not None else num(g(r, COL_REV2))
            cost = num(g(r, COL_COST))
            ttype = text(g(r, "ประเภทใบรายการ"))
            empty = num(g(r, COL_REV1)) == 0 and num(g(r, COL_REV2)) == 0
            origin, dest = text(g(r, "จุดขึ้น")), text(g(r, "จุดลง"))
            kind = text(g(r, "ชนิดรถ"))
            kinds[kind] += 1

            fuel = {k: gsum(r, cs) for k, cs in FUEL_COLS.items()}
            allow = {k: gsum(r, cs) for k, cs in ALLOW_COLS.items()}
            fee = {k: gsum(r, cs) for k, cs in FEE_COLS.items()}
            waste = gsum(r, WASTE_COLS)
            repair = num(g(r, COL_REPAIR))
            dep = num(g(r, COL_DEP))
            # ค่าเช่าอยู่ใน "ต้นทุน" เฉพาะแถวที่ หมายเหตุต้นทุน = ค่าเช่า (ต้นทุน = ค่าเช่ารวม ทั้งก้อน)
            # แถว "ค่าเดินทาง" ต้นทุน = Σ คอลัมน์ค่าแก๊ส…ค่าซ่อมรวม ส่วน ค่าเช่ารวม เป็นแค่บันทึกประกอบ
            note = text(g(r, "หมายเหตุต้นทุน"))
            rent = num(g(r, COL_RENT)) if "ค่าเช่า" in note and abs(num(g(r, COL_RENT)) - cost) < 1 else 0.0
            fuel_t = round(sum(fuel.values()), 2)
            allow_t = round(sum(allow.values()), 2)
            fee_t = round(sum(fee.values()), 2)
            trips.append({
                "id": doc,
                "d": d.isoformat(),
                "mo": d.strftime("%Y-%m"),
                "y": d.year,
                "br": text(g(r, "สาขา")),
                "t": ttype,
                "ft": text(g(r, "ประเภทรถ")),
                "vk": kind,
                "pl": text(g(r, "ทะเบียนรถ")),
                "o": origin, "de": dest,
                "rt": text(g(r, "จุดขึ้น-จุดลง")) or f"{origin}-{dest}",
                "dir": text(g(r, "ขาขึ้น-ขาล่อง")),
                "km": distance(origin, dest),
                "rev": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(revenue - cost, 2),
                "empty": empty,
                "clear": text(g(r, "เป็นบิลเคลียร์")) == "ใช่",
                "m": False,   # เติมทีหลังเมื่ออ่านไฟล์รายได้เสร็จ
                # มูลค่า/จำนวนรายการบิลเคลียร์ — เติมทีหลังเหมือน m เพราะอยู่ในไฟล์รายได้คนละฝั่ง
                "clrAmt": 0.0, "clrN": 0,
                # จำนวนบิล + รหัสผู้จ่ายเงินของใบนั้น (หน้า Demo ใช้เป็นตัวหาร กำไร/บิล และ กำไร/ลูกค้า)
                "bn": 0, "cus": [],
                "sg": "",     # กลุ่มบริการ — เติมทีหลังจากบิลรายได้ (ดูกติกาข้างบน)
                # กลุ่มต้นทุน — ยอดที่คำนวณต่อได้ (ปกติ/ผันแปร/อื่น ๆ) ไม่เก็บ ให้ฝั่งแอปคิดเอง ไฟล์จะได้เล็ก
                "waste": waste, "fuel": fuel_t, "allow": allow_t, "fee": fee_t,
                "repair": repair, "dep": dep, "rent": rent,
                **{f"f_{k}": v for k, v in fuel.items()},
                **{f"a_{k}": v for k, v in allow.items()},
                **{f"fe_{k}": v for k, v in fee.items()},
            })

    if not trips:
        sys.exit("ไม่มีเที่ยวให้ประมวลผล")

    # อ่านรายได้ทีหลัง แล้วเก็บเฉพาะบิลของใบที่มีในไฟล์ต้นทุน (ดูเหตุผลใน load_revenue)
    print(f"อ่านข้อมูลรายได้จาก {rev_dir}")
    cost_docs = {t["id"] for t in trips}
    (rev_docs, rev_bills, rev_files, rev_rows, rev_paid, clr_amt, clr_n, goods,
     bill_n, payers) = load_revenue(rev_dir, cost_docs)
    print(f"  {rev_files} ไฟล์ · {rev_rows:,} แถว · ใบรายการที่ตรงกับไฟล์ต้นทุน {len(rev_docs):,}")
    for t in trips:
        t["m"] = t["id"] in rev_docs
        # ★ ธง clear (จากไฟล์ต้นทุน) กับ clrN (จากบิลจริง) ไม่เท่ากัน — ชุดตัวอย่าง 12 ไฟล์มีใบที่ธง "ใช่" 125 ใบ
        #   แต่หาบิลเคลียร์เจอแค่ 26 ใบ เพราะไฟล์รายได้ตัวอย่างถูกสุ่มมาบางส่วน
        #   แท็บ Damage Rate คิดจาก clrAmt/clrN เท่านั้น (มูลค่าจริง) ไม่ใช่ธง clear
        t["clrAmt"] = round(clr_amt.get(t["id"], 0.0), 2)
        t["clrN"] = clr_n.get(t["id"], 0)
        t["bn"] = bill_n.get(t["id"], 0)
        # เรียงให้ผลลัพธ์นิ่ง (set ไม่มีลำดับ) ไฟล์จะได้ diff ได้เวลาแก้ ETL
        t["cus"] = sorted(payers.get(t["id"], ()))
        gc = goods.get(t["id"])
        t["sg"] = gc.most_common(1)[0][0] if gc else ""

    matched = [t for t in trips if t["m"]]
    route_pairs = {(t["o"], t["de"]) for t in trips if t["o"] and t["de"]}
    route_hit = sum(1 for o, d in route_pairs if distance(o, d) is not None)
    trips_with_km = sum(1 for t in trips if t["km"] is not None)

    out_dir = OUT_ROOT / dataset / "costrev"
    out_dir.mkdir(parents=True, exist_ok=True)

    def dump(name: str, obj) -> None:
        (out_dir / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # แถวข้อมูลเก่าสำหรับหน้ารายการทั้งหมด — รูปเดียวกับ TripRecord เท่าที่ตารางใช้
    old_records = [{
        "id": f"file-{t['id']}", "docNo": t["id"], "source": "เก่า", "synced": True,
        "date": t["d"], "branch": t["br"], "docType": t["t"], "routeType": t["dir"],
        "origin": t["o"], "dest": t["de"], "dist": t["km"] or 0,
        "plate": t["pl"], "fleetType": t["ft"], "vehicle": t["vk"],
        "revenue": t["rev"], "normal": round(t["cost"] - t["waste"], 2), "waste": t["waste"],
        "sheetTotal": t["cost"], "repTotal": t["repair"], "profit": t["profit"],
        "bills": [], "_csDone": True, "_dispatchDone": True, "_accountDone": True,
    } for t in matched]

    old_debtors = [b for t in matched for b in rev_bills.get(t["id"], [])]
    # แปลงรหัสต้นฉบับของผู้ส่ง/ผู้รับเป็นเลข CUS ตั้งแต่ตอน ETL
    # หน้ารายการลูกหนี้กับแท็บ "จากข้อมูลบิล (เดิม)" จะได้ไม่ต้องโหลด custmap.bin 18 MB
    _codes = resolve_codes(ROOT, {str(b.get(k) or "") for b in old_debtors for k in ("sender", "receiver")})
    for b in old_debtors:
        b["senderN"] = _codes.get(str(b.get("sender") or ""), 0)
        b["receiverN"] = _codes.get(str(b.get("receiver") or ""), 0)
    print(f"  แปลงรหัสลูกค้าในบิลลูกหนี้เป็น CUS ได้ {len(_codes):,} รหัส")

    dates = sorted(t["d"] for t in trips)
    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "costFiles": [p.name for p in cost_files],
        "revenueFiles": rev_files,
        "rows": len(trips),
        "matched": len(matched),
        "revenueRows": rev_rows,
        "matchedDocs": len(rev_docs),
        "dateRange": {"min": dates[0], "max": dates[-1]},
        "years": sorted({t["y"] for t in trips}),
        "routeDistance": {"routes": len(route_pairs), "matched": route_hit,
                          "tripsWithKm": trips_with_km,
                          "pct": round(100 * trips_with_km / len(trips), 1)},
        "skipped": {"noDoc": skipped_no_doc, "noDate": skipped_no_date},
        "emptyRule": "เที่ยววิ่งเปล่า = ราคารวมจากรายได้ = 0 และ ค่าบรรทุกทั้งใบรายการ = 0 (ไม่จำกัดประเภทใบรายการ)",
        "debtorBills": len(old_debtors),
        # สรุปบิลเคลียร์เฉพาะฝั่งที่จับคู่ได้ — แท็บ Damage Rate ใช้ตรวจว่ายอดในหน้าเว็บตรงกับไฟล์
        "clear": {"trips": sum(1 for t in matched if t["clrN"]),
                  "bills": sum(t["clrN"] for t in matched),
                  "amount": round(sum(t["clrAmt"] for t in matched), 2)},
        # บิลที่ชำระแล้วไม่ได้เขียนลงไฟล์ (ดูเหตุผลใน load_revenue) เก็บไว้แค่จำนวนกับยอดรวม
        "debtorPaid": rev_paid,
    }
    dump("manifest.json", manifest)
    dump("trips.json", trips)
    dump("old_records.json", old_records)
    dump("old_debtors.json", old_debtors)

    print(f"เขียน {out_dir.relative_to(ROOT)}")
    print(f"  เที่ยว {len(trips):,} · จับคู่กับข้อมูลรายได้ได้ {len(matched):,} ({100*len(matched)/len(trips):.1f}%)")
    print(f"  ช่วงวันที่ {dates[0]} → {dates[-1]} · ปี {manifest['years']}")
    print(f"  ระยะทางจาก routes.json: เส้นทาง {route_hit}/{len(route_pairs)} · เที่ยวที่มี กม. {trips_with_km:,} ({manifest['routeDistance']['pct']}%)")
    print(f"  เที่ยววิ่งเปล่า {sum(1 for t in trips if t['empty']):,} · บิลเคลียร์ {sum(1 for t in trips if t['clear']):,}")
    clr = manifest["clear"]
    print(f"  บิลเคลียร์จากไฟล์รายได้ (เฉพาะใบที่จับคู่ได้) {clr['bills']:,} รายการ "
          f"ใน {clr['trips']:,} เที่ยว รวม {clr['amount']:,.2f} บาท")
    print(f"  บิลลูกหนี้ค้างชำระจากไฟล์รายได้ (เฉพาะใบที่จับคู่ได้) {len(old_debtors):,} รายการ")
    print(f"  บิลที่ชำระแล้ว {rev_paid['bills']:,} รายการ (ไม่เขียนลงไฟล์ เก็บแค่ยอดรวมใน manifest)")
    if skipped_no_doc or skipped_no_date:
        print(f"  [!] ข้ามแถว: ไม่มีเลขที่ใบรายการ {skipped_no_doc} · อ่านวันที่ไม่ออก {skipped_no_date}")
    tot = sum(t["cost"] for t in trips)
    grp = {k: sum(t[k] for t in trips) for k in ["waste", "fuel", "allow", "fee", "repair", "dep", "rent"]}
    grp["other"] = tot - sum(grp.values())
    print("  ตรวจผลรวมกลุ่มต้นทุน (ต้องบวกกันได้เท่าต้นทุนทั้งหมด):")
    print("   " + " / ".join(f"{k} {v:,.0f}" for k, v in grp.items()) + f" = {sum(grp.values()):,.0f} vs ต้นทุน {tot:,.0f}")


def utf8_stdout() -> None:
    """บังคับ stdout/stderr เป็น UTF-8 — คอนโซลไทยบน Windows เป็น cp874 ซึ่งไม่มีตัว "·"
    ที่ log ใช้คั่นข้อความ พิมพ์แล้วจะ UnicodeEncodeError ตายกลางทางทั้งที่แปลงไฟล์ไปได้แล้ว
    (plugin autoEtl ตั้ง PYTHONUTF8=1 ให้อยู่แล้ว ที่นี่กันเคสผู้ใช้รันเองใน terminal)
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):   # stdout ถูก redirect ไปที่อื่น — ปล่อยไป
            pass


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="แปลงไฟล์ต้นทุน+รายได้รายเที่ยวเป็น JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="sample")
    a = ap.parse_args()
    build(a.dataset)


if __name__ == "__main__":
    main()
