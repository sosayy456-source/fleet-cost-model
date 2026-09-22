"""
ปันส่วนต้นทุนเที่ยวรถเข้าบิลลูกค้า — วิธี ค (ภาระงาน × ระยะทาง)

ตามเอกสาร "แนวคิดการปันส่วนต้นทุนเที่ยวรถเข้าบิลลูกค้า (Cost Allocation Spec)" ข้อ 5
    ภาระงาน = น้ำหนักที่ใช้คิด (ตันเทียบเท่า) × ระยะทาง (กม.)
    ต้นทุนจัดสรร = ต้นทุนเที่ยว × (ภาระงานของรายการ ÷ ภาระงานรวมทั้งเที่ยว)

ไฟล์นี้ไม่อ่านไฟล์และไม่ใช้ pandas — รับ Item แล้วคืนผลลัพธ์ เพื่อให้ทดสอบตัวเลข
ตามตัวอย่างในเอกสารได้ตรง ๆ ส่วนการแปลงชื่อคอลัมน์ไทยเป็น Item อยู่ที่ตัวเรียกใช้

กติกาที่เจ้าของข้อมูลชี้ขาด (16 ก.ย. 2569):
    ลูกค้า = ผู้จ่ายเงิน — สด/เชื่อต้นทาง → ผู้ส่ง · สด/เชื่อปลายทาง → ผู้รับ
    บิลเคลียร์ กับ เที่ยวตีเปล่า/รถว่างไปสาขา ตัดออกจากกำไรลูกค้า

★ รายการที่ถูกตัดยัง "รับ" ต้นทุนตามภาระงานของตัวเองเหมือนเดิม แค่ไม่ถูกนับเป็นลูกค้า
  ส่วนนั้นจึงไปโชว์เป็น "ต้นทุนที่ไม่ปันเข้าลูกค้า" ไม่ใช่ถูกบวกทับให้บิลปกติในเที่ยวเดียวกัน
  ถ้าหารใหม่เฉพาะรายการที่เหลือ ลูกค้าปกติจะรับต้นทุนสูงขึ้นเงียบ ๆ แทนบิลเคลียร์ซึ่งไม่ใช่
  ภาระของเขา และคุณสมบัติ Σ ต้นทุนจัดสรรทั้งเที่ยว = ต้นทุนเที่ยว (ข้อ 5 ขั้นที่ 5) ยังเป็นจริง
"""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field

VOL_TON = 0.167          # ตัน/CBM (= 167 กก./ลบ.ม.)
DIM_MAX = 1000.0         # ซม. — ด้านที่ยาวกว่านี้ถือว่ากรอกผิด (พบ ยาว 6,080 ซม.)

#: ประเภทใบรายการที่ **ตัดออกจากโมเดลทั้งระบบ** (เจ้าของงานสั่ง 20 ก.ย. 2569)
#: แถวพวกนี้ไม่ถูกเขียนลงไฟล์ผลลัพธ์ใด ๆ เลย ทั้ง costrev/trips.json และชุด alloc/
#: จึงไม่โผล่ในแท็บไหนของแอป และ **ไม่นับเป็นเที่ยววิ่งเปล่าด้วย** — ต่างจาก
#: EMPTY_TRIP_TYPES ข้างล่างที่ยังอยู่ในข้อมูล แค่ไม่ถูกนับเป็นลูกค้า
#: ★ ทั้ง build_costrev.py และ build_alloc.py ต้องกรองด้วยชุดนี้ เพราะสองตัวอ่านไฟล์
#:   รายงานค่าเดินทางแยกกันคนละรอบ ถ้ากรองที่เดียวตัวเลขสองฝั่งจะไม่ตรงกันเงียบ ๆ
DROPPED_TRIP_TYPES = frozenset({"ของเหมาตีเปล่า"})

#: ประเภทใบรายการที่ยังอยู่ในข้อมูลและยังรับต้นทุนของตัวเอง แต่ไม่ปันเข้าลูกค้า
#: (ต้นทุนไปโผล่เป็น "ต้นทุนที่ไม่ปันเข้าลูกค้า") — เจ้าของงานยืนยันให้เก็บไว้นับเป็น
#: เที่ยววิ่งเปล่าต่อไป 20 ก.ย. 2569
EMPTY_TRIP_TYPES = frozenset({"รถว่างไปสาขา"})
#: ประเภทสินค้าที่ไม่ปันเข้าลูกค้า (เรื่องบิลเคลียร์ทำแยกอยู่ ที่นี่แค่กันออก)
CLEARING_GOODS = "บิลเคลียร์"

PAYER_SENDER = frozenset({"สดต้นทาง", "เชื่อต้นทาง"})
PAYER_RECEIVER = frozenset({"สดปลายทาง", "เชื่อปลายทาง"})

# ขนาดในชื่อสินค้า เช่น "กะหล่ำปลี 36x55x32 cm" — ใช้เมื่อช่องกว้าง/ยาว/สูง ว่าง
_DIMS_IN_NAME = re.compile(
    r"(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)"
)

# เงื่อนไขที่ใช้หาน้ำหนักที่ใช้คิด (คอลัมน์ 28 ของไฟล์ผลลัพธ์)
BASIS_LABELS = {
    1: "1. น้ำหนัก+ปริมาตร (MAX)",
    2: "2. น้ำหนักอย่างเดียว (Ton-KM)",
    3: "3. ปริมาตรอย่างเดียว (CBM-KM)",
    4: "4. จำนวนหน่วย (Unit-KM)",
}

DIST_EXACT = "ตรงตัว"
DIST_REVERSED = "สลับทิศ"
DIST_MEDIAN = "ค่ากลางของเที่ยว"
DIST_FALLBACK = "ไม่มีในตาราง"
#: ที่มาระยะทางที่ถือว่า "ข้อมูลไม่เชื่อมกัน" (ข้อ 5 ขั้นที่ 1 กรณี 3-4)
DIST_UNLINKED = frozenset({DIST_MEDIAN, DIST_FALLBACK})

NOT_LINKED = "ข้อมูลไม่เชื่อมกัน"


def txt(v: object) -> str:
    """ค่าในเซลล์ → ข้อความที่ตัดช่องว่างแล้ว (ไฟล์บิลจริง pad ช่องว่างท้ายยาวมาก)

    ★ calamine คืนเซลล์ตัวเลขเป็น float เสมอ — เลขที่ใบรายการ 13 หลักจะกลายเป็น
      "6250753132426.0" แล้วจับคู่กับรายงานค่าเดินทางไม่ได้ จำนวนเต็มจึงตัด .0 ทิ้ง
      (กติกาเดียวกับ text() ใน build_costrev.py)
    """
    if v is None:
        return ""
    if isinstance(v, bool):
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def num(v: object) -> float:
    """ค่าในเซลล์ → ตัวเลข อ่านไม่ออกคืน 0.0 (ต่างจาก is_number ที่ใช้ตัดสินต้นทุน)"""
    if v is None or v == "" or isinstance(v, bool):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0


def is_number(v: object) -> bool:
    """ช่องต้นทุนเป็นตัวเลขจริงไหม

    ★ เดิมใช้ตัดสินว่า "-" = ข้อมูลไม่เชื่อมกัน (เอกสารข้อ 10.7 กลัวว่าอ่านเป็น 0 แล้ว
      บิลในเที่ยวนั้นจะดูกำไรเกินจริงทั้งเที่ยว) — **เจ้าของงานสั่งเปลี่ยนเป็นนับ "-" เป็น 0
      เพื่อให้เที่ยวเชื่อมกันได้ 20 ก.ย. 2569** ตอนนี้จึงเหลือหน้าที่แค่ "นับจำนวนแถว
      ที่ช่องต้นทุนไม่ใช่ตัวเลข" ไว้รายงานใน manifest ไม่ได้ตัดเที่ยวทิ้งอีกแล้ว
      (ผลข้างเคียงที่รู้อยู่: เที่ยวกลุ่มนี้ที่มีรายได้จะขึ้น Margin 100%)
    """
    if isinstance(v, bool) or v is None or v == "":
        return False
    if isinstance(v, (int, float)):
        return True
    try:
        float(str(v).replace(",", "").strip())
    except ValueError:
        return False
    return True


@dataclass
class Item:
    """1 รายการสินค้า = 1 แถวของไฟล์บิล (ค่าที่ผ่าน txt/num แล้ว)"""
    doc: str                 # เลขที่ใบรายการ — คีย์เชื่อมกับเที่ยวรถ
    bill: str                # เลขที่บิล
    origin: str = ""
    dest: str = ""
    weight: float = 0.0      # น้ำหนักรวม (กก.)
    qty: float = 0.0         # จำนวน
    width: float = 0.0       # ซม.
    length: float = 0.0
    height: float = 0.0
    name: str = ""           # ชื่อสินค้า — ใช้ดึงขนาดเมื่อไม่มีช่องขนาด
    revenue: float = 0.0     # ราคารวม
    payment: str = ""        # ประเภทการชำระเงิน
    sender: str = ""         # ผู้ส่ง_encoded
    receiver: str = ""       # ผู้รับ_encoded
    goods: str = ""          # ประเภทสินค้า
    #: เดือนของบิล YYYY-MM (จากคอลัมน์ วันที่) — ตัวเรียกใช้เติมให้
    month: str = ""
    #: คอลัมน์เพิ่มเฉพาะกิจของตัวเรียกใช้ เช่น ต้นทุนจัดสรรที่เครื่องภายนอกคิดมาแล้ว
    extra: dict[str, object] = field(default_factory=dict)

    # ผลการคำนวณ — เติมโดย allocate_trip()
    dist: float | None = None
    dist_source: str = ""
    cbm: float = 0.0
    basis: float = 0.0
    basis_cond: int = 0
    workload: float = 0.0
    share: float | None = None
    alloc: float | None = None
    profit: float | None = None
    excluded: str = ""       # เหตุผลที่ไม่นับเป็นลูกค้า ("" = นับ)


@dataclass
class TripResult:
    """สรุปผลของหนึ่งเที่ยว — ตัวเรียกใช้เอาไปรวมเป็นระดับบิล/ลูกค้า"""
    doc: str
    cost: float | None                 # None = หาต้นทุนไม่เจอ/ไม่ใช่ตัวเลข
    items: list[Item] = field(default_factory=list)
    allocated: float = 0.0             # ต้นทุนที่ปันเข้าลูกค้าได้
    unallocated: float = 0.0           # ต้นทุนของรายการที่ถูกตัดออก
    weights_from: str = "ภาระงาน"      # ตัวถ่วงที่ใช้จริง (ลำดับสำรองข้อ 5 ขั้นที่ 5)


def lookup_distance(routes: dict[str, dict[str, float]], origin: str, dest: str
                    ) -> tuple[float | None, str]:
    """ระยะทางจากตารางอ้างอิง — ตรงตัวก่อน แล้วค่อยสลับทิศ (ข้อ 5 ขั้นที่ 1 กรณี 1-2)

    ตารางคือ refdata/routes.json ของแอป (ต้นทาง → ปลายทาง → กม.) 326 คู่
    ซึ่งตรงกับ Sheet2 ของ ระยะทาง(1).xlsx ทุกคู่ และเป็น กม. จริงอยู่แล้ว
    ไม่ต้องหารกลับด้วย 15 แบบข้อ 10.4
    """
    o, d = origin.strip(), dest.strip()
    km = routes.get(o, {}).get(d)
    if isinstance(km, (int, float)) and km > 0:
        return float(km), DIST_EXACT
    km = routes.get(d, {}).get(o)
    if isinstance(km, (int, float)) and km > 0:
        return float(km), DIST_REVERSED
    return None, ""


def volume_cbm(it: Item) -> float:
    """ปริมาตร (CBM) จากช่องขนาดก่อน ไม่มีค่อยดึงจากชื่อสินค้า (ข้อ 5 ขั้นที่ 2)"""
    dims = (it.width, it.length, it.height)
    if all(d > 0 for d in dims) and all(d <= DIM_MAX for d in dims):
        return it.width * it.length * it.height / 1_000_000 * it.qty
    m = _DIMS_IN_NAME.search(it.name)
    if m:
        a, b, c = (float(x) for x in m.groups())
        if all(0 < d <= DIM_MAX for d in (a, b, c)):
            return a * b * c / 1_000_000 * it.qty
    return 0.0


def basis_of(weight_kg: float, cbm: float, qty: float) -> tuple[float, int]:
    """น้ำหนักที่ใช้คิด B (ตันเทียบเท่า) + เลขเงื่อนไข 1-4 (ข้อ 5 ขั้นที่ 3)

    ★ กรณี "ปริมาตรอย่างเดียว" ต้องคูณ 0.167 ด้วย (ข้อ 10.1) ไม่งั้นรายการกลุ่มนี้
      อยู่คนละหน่วยกับรายการอื่นในเที่ยวเดียวกัน แล้วรับต้นทุนมากเกินราว 6 เท่า
    """
    if weight_kg > 0 and cbm > 0:
        return max(weight_kg / 1000, cbm * VOL_TON), 1
    if weight_kg > 0:
        return weight_kg / 1000, 2
    if cbm > 0:
        return cbm * VOL_TON, 3
    return qty, 4


W_WORKLOAD = "ภาระงาน"
W_REVENUE = "ราคารวม"
W_QTY = "จำนวน"
W_EQUAL = "หารเท่ากัน"


def divisor_of(workload_sum: float, revenue_sum: float, qty_sum: float, n: int
               ) -> tuple[float, str]:
    """ตัวหารของเที่ยว + ชื่อตัวถ่วงที่ใช้ (ข้อ 5 ขั้นที่ 5 พร้อมลำดับสำรอง)

    ใช้ร่วมกันระหว่าง allocate_trip() (ทั้งเที่ยวอยู่ในหน่วยความจำ) กับ build_alloc.py
    (เดินไฟล์สองรอบ ไม่เก็บรายการไว้) — กฎสำรองต้องมีที่อยู่ที่เดียว ไม่งั้นสองทาง
    ปันไม่เท่ากันแล้วไม่มีอะไรจับได้
    """
    if workload_sum > 0:
        return workload_sum, W_WORKLOAD
    if revenue_sum > 0:
        return revenue_sum, W_REVENUE
    if qty_sum > 0:
        return qty_sum, W_QTY
    return float(n), W_EQUAL


def weight_of(it: Item, source: str) -> float:
    """น้ำหนักของรายการตามตัวถ่วงที่ divisor_of() เลือกไว้"""
    if source == W_WORKLOAD:
        return it.workload
    if source == W_REVENUE:
        return it.revenue
    if source == W_QTY:
        return it.qty
    return 1.0


def payer_of(it: Item) -> tuple[str, str]:
    """ลูกค้าของรายการนี้ = ผู้จ่ายเงิน → (ฝ่าย, รหัสลูกค้า)"""
    p = it.payment.strip()
    if p in PAYER_SENDER:
        return "ผู้ส่ง", it.sender
    if p in PAYER_RECEIVER:
        return "ผู้รับ", it.receiver
    return "", ""


def exclusion_of(it: Item, trip_type: str = "") -> str:
    """เหตุผลที่ไม่นับรายการนี้เป็นลูกค้า — "" ถ้านับ"""
    t = trip_type.strip()
    if t in EMPTY_TRIP_TYPES:
        return t
    if it.goods.strip() == CLEARING_GOODS:
        return CLEARING_GOODS
    return ""


def allocate_trip(items: list[Item], trip_cost: float | None,
                  routes: dict[str, dict[str, float]], trip_type: str = "") -> TripResult:
    """
    ปันต้นทุนของหนึ่งเที่ยวลงทุกรายการในเที่ยวนั้น (ข้อ 5 ทั้ง 6 ขั้น)

    trip_cost = None (หาเลขที่ใบรายการในรายงานค่าเดินทางไม่เจอ หรือช่องต้นทุนไม่ใช่ตัวเลข)
    → คำนวณระยะทาง/ปริมาตร/ภาระงานให้ครบ แต่ share/alloc/profit เป็น None
      (ข้อ 8: แถวยังอยู่ ไม่ถูกตัดทิ้ง แค่ขึ้นว่าข้อมูลไม่เชื่อมกัน)
    """
    doc = items[0].doc if items else ""
    res = TripResult(doc=doc, cost=trip_cost, items=items)
    if not items:
        return res

    # ขั้นที่ 1-3 · ระยะทาง → ปริมาตร → น้ำหนักที่ใช้คิด
    for it in items:
        it.dist, it.dist_source = lookup_distance(routes, it.origin, it.dest)
        it.cbm = volume_cbm(it)
        it.basis, it.basis_cond = basis_of(it.weight, it.cbm, it.qty)
        it.excluded = exclusion_of(it, trip_type)

    # ระยะทางที่หาไม่เจอ → ค่ากลางของรายการอื่นในเที่ยวเดียวกัน → ทั้งเที่ยวไม่มีเลยใช้ 1
    # (ข้อ 10.2: ปล่อยเป็น 0 จะทำให้รายการนั้นไม่รับต้นทุนเลยเพราะข้อมูลขาด)
    known = [it.dist for it in items if it.dist is not None]
    fill = statistics.median(known) if known else 1.0
    for it in items:
        if it.dist is None:
            it.dist, it.dist_source = fill, (DIST_MEDIAN if known else DIST_FALLBACK)
        it.workload = it.basis * it.dist          # ขั้นที่ 4

    # ขั้นที่ 5 · ตัวถ่วง — ภาระงาน แล้วสำรองเป็น ราคารวม → จำนวน → เท่ากันทุกรายการ
    # (ข้อ 10.3: ทั้งเที่ยวภาระงาน 0 ต้องไม่กลายเป็นหารด้วยศูนย์ ต้นทุนเที่ยวต้องถูกปันครบเสมอ)
    total, res.weights_from = divisor_of(
        sum(it.workload for it in items),
        sum(it.revenue for it in items),
        sum(it.qty for it in items),
        len(items),
    )
    for it in items:
        w = weight_of(it, res.weights_from)
        if trip_cost is None:
            it.share = it.alloc = it.profit = None
            continue
        it.share = w / total
        it.alloc = trip_cost * it.share
        it.profit = it.revenue - it.alloc        # ขั้นที่ 6
        if it.excluded:
            res.unallocated += it.alloc
        else:
            res.allocated += it.alloc
    return res


def status_of(profit: float | None) -> str:
    """สถานะผลประกอบการ (คอลัมน์ 33 ของไฟล์ผลลัพธ์)"""
    if profit is None:
        return NOT_LINKED
    if profit > 0:
        return "กำไร"
    if profit < 0:
        return "ขาดทุน"
    return "เท่าทุน"
