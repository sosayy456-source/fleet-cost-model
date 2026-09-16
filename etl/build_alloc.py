"""สร้างข้อมูลกำไรลูกค้าจากการปันส่วนต้นทุน → app/public/data/<ds>/alloc/

รับได้สองทาง — ผลลัพธ์หน้าตาเดียวกัน หน้าจอไม่ต้องรู้ว่ามาจากทางไหน

  1. ไฟล์ที่ปันเสร็จแล้วจากเครื่องปันส่วนต้นทุน V2   (ทางหลัก)
       etl/data/allocated/*.xlsx   ชีท "การจัดสรรต้นทุน" 33 คอลัมน์ (เอกสารข้อ 8)
       ระบบอ่านคอลัมน์ "ต้นทุนจัดสรร" ที่คำนวณมาแล้วตรง ๆ ไม่คิดสูตรใหม่
  2. คำนวณเองจากไฟล์ดิบ                              (ทางสำรอง/ตัวสอบทาน)
       รายงานค่าเดินทาง etl/data/travel/ + ไฟล์บิล etl/data/revenue/ + routes.json
       ใช้สูตรใน src/alloc.py (วิธี ค) ซึ่งตรวจแล้วตรงกับเอกสารข้อ 11 ทุกตัว

    python etl/build_alloc.py --dataset real                 # มีไฟล์ที่ปันเสร็จก็ใช้อันนั้น
    python etl/build_alloc.py --dataset real --source compute # บังคับคำนวณเอง
    python etl/build_alloc.py --dataset sample

ผลลัพธ์
    manifest.json   จำนวน/ยอดรวม/ช่วงเดือน/ที่มาของข้อมูล
    customers.json  1 ระเบียน = 1 ลูกค้า (ผู้จ่ายเงิน) เก็บเป็นคอลัมน์เพื่อให้ไฟล์เล็ก
    months.json     ยอดรายเดือน สำหรับกราฟแนวโน้ม
    unlinked.json   กลุ่ม "ข้อมูลไม่เชื่อมกัน" + ต้นทุนที่ไม่ปันเข้าลูกค้า (บล็อกล่างสุดของหน้า)

กติกาที่เจ้าของข้อมูลชี้ขาด (16 ก.ย. 2569):
    ลูกค้า = ผู้จ่ายเงิน — สด/เชื่อต้นทาง → ผู้ส่ง · สด/เชื่อปลายทาง → ผู้รับ
    บิลเคลียร์ กับ เที่ยวตีเปล่า/รถว่างไปสาขา ไม่นับเป็นลูกค้า (แต่ยังรับต้นทุนของตัวเอง
    แล้วไปโชว์เป็น "ต้นทุนที่ไม่ปันเข้าลูกค้า")

★ ทั้งสองทางยุบก้อนด้วย Rollup ตัวเดียวกัน — ตัวเลขบนหน้าจอจึงนิยามเดียวกันเสมอ
★ เลขที่ใบรายการ/เลขที่บิลเทียบเป็นสตริงเสมอ txt() ตัด .0 ที่ calamine ใส่มาให้
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from build_costrev import find_header_row, iter_sheet, parse_date, utf8_stdout, xlsx_files
from src.alloc import (
    DIST_EXACT,
    DIST_FALLBACK,
    DIST_MEDIAN,
    DIST_REVERSED,
    Item,
    basis_of,
    divisor_of,
    exclusion_of,
    is_number,
    lookup_distance,
    num,
    payer_of,
    txt,
    volume_cbm,
    weight_of,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_ROOT = ROOT / "app" / "public" / "data"
ROUTES_JSON = ROOT / "app" / "src" / "lib" / "refdata" / "routes.json"

SAMPLE_COST = HERE / "sample_data" / "ExampleCostandRevenue.xlsx"
SAMPLE_REV_DIR = ROOT / "RevenueDashboard" / "RevenueDashboard" / "sample_data"
REAL_COST_DIR = HERE / "data" / "travel"
REAL_REV_DIR = HERE / "data" / "revenue"
REAL_ALLOCATED_DIR = HERE / "data" / "allocated"

COL_DOC = "เลขที่ใบรายการ"
COL_BILL = "เลขที่บิล"
COL_COST = "ต้นทุน"
COL_TTYPE = "ประเภทใบรายการ"
#: คอลัมน์ผลการจัดสรรจากเครื่อง V2 (เอกสารข้อ 8 คอลัมน์ 25-33)
COL_ALLOC = "ต้นทุนจัดสรร (บาท)"
COL_ALLOC_ALT = "ต้นทุนจัดสรร"          # เผื่อเครื่องรุ่นที่ไม่ใส่หน่วยในหัวคอลัมน์
COL_TRIPCOST = "ต้นทุนเที่ยวรถ (บาท)"
COL_DIST_OUT = "ระยะทาง (กม.)"
COL_BASIS_OUT = "เงื่อนไขที่ใช้"

SRC_MACHINE = "เครื่องปันส่วนต้นทุน V2 (ไฟล์ที่ปันเสร็จแล้ว)"
SRC_COMPUTE = "คำนวณในระบบจากไฟล์ดิบ (src/alloc.py วิธี ค)"


# ================================================================ ยุบก้อน
class Rollup:
    """สะสมผลการปันเป็นระดับลูกค้า/เดือน + เก็บของที่ไม่เข้ากำไรลูกค้าไว้รายงาน

    ป้อนทีละรายการสินค้าด้วย add() แล้วปิดไฟล์ด้วย flush_file() ทุกครั้งที่จบหนึ่งไฟล์
    (ระดับบิลรวมภายในไฟล์ก่อนแล้วค่อยขึ้นเป็นลูกค้า — 1 เลขที่บิลอยู่ในเที่ยวเดียวเสมอ
    ตามเอกสารข้อ 2.1 และแถวของบิลเดียวกันอยู่ไฟล์เดียวกันเพราะบิลมีวันที่เดียว)
    """

    def __init__(self) -> None:
        # (ฝ่าย, รหัส) -> [บิล, รายได้, ต้นทุนจัดสรร, กำไร, บิลที่ขาดทุน]
        self.cust: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
        self.months: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
        self.dist_src: Counter[str] = Counter()
        self.basis_cond: Counter[int] = Counter()
        self.excluded_cost: Counter[str] = Counter()
        self.excluded_items: Counter[str] = Counter()
        self.status: Counter[str] = Counter()
        self.no_payer = [0, 0.0]
        self.nl_trips: set[str] = set()
        self.nl_bills: set[str] = set()
        self.nl_items = 0
        self.nl_revenue = 0.0
        self.allocated = 0.0
        self.items = 0
        self._bills: dict[str, list] = {}

    def add(self, it: Item, alloc: float | None, excluded: str) -> None:
        """alloc = None → ข้อมูลไม่เชื่อมกัน (ไม่มีต้นทุนของเที่ยวนั้น)"""
        self.items += 1
        if it.dist_source:
            self.dist_src[it.dist_source] += 1
        if it.basis_cond:
            self.basis_cond[it.basis_cond] += 1

        if alloc is None:
            self.nl_trips.add(it.doc)
            self.nl_bills.add(it.bill)
            self.nl_items += 1
            self.nl_revenue += it.revenue
            return

        profit = it.revenue - alloc
        self.status["กำไร" if profit > 0 else "ขาดทุน" if profit < 0 else "เท่าทุน"] += 1

        if excluded:
            self.excluded_cost[excluded] += alloc
            self.excluded_items[excluded] += 1
            return

        self.allocated += alloc
        side, code = payer_of(it)
        if not code:
            self.no_payer[0] += 1
            self.no_payer[1] += it.revenue
            return

        if it.month:
            m = self.months[it.month]
            m[0] += it.revenue; m[1] += alloc; m[2] += profit; m[3] += 1

        b = self._bills.get(it.bill)
        if b is None:
            self._bills[it.bill] = [side, code, it.revenue, alloc]
        else:
            b[2] += it.revenue
            b[3] += alloc

    def flush_file(self) -> int:
        """ปิดไฟล์: ยกบิลที่สะสมไว้ขึ้นเป็นลูกค้า แล้วล้างถังของไฟล์นั้น"""
        n = len(self._bills)
        for side, code, rev, alc in self._bills.values():
            c = self.cust[(side, code)]
            c[0] += 1
            c[1] += rev
            c[2] += alc
            c[3] += rev - alc
            if rev - alc < 0:
                c[4] += 1
        self._bills = {}
        return n

    # ---------------- เขียนไฟล์ ----------------
    def write(self, out: Path, manifest: dict) -> None:
        out.mkdir(parents=True, exist_ok=True)
        rows = sorted(self.cust.items(), key=lambda kv: kv[1][3])   # ขาดทุนมากสุดขึ้นก่อน
        customers = {
            "side": [k[0] for k, _ in rows],
            "code": [k[1] for k, _ in rows],
            "bills": [int(v[0]) for _, v in rows],
            "revenue": [round(v[1], 2) for _, v in rows],
            "cost": [round(v[2], 2) for _, v in rows],
            "profit": [round(v[3], 2) for _, v in rows],
            "lossBills": [int(v[4]) for _, v in rows],
        }
        mo_keys = sorted(k for k in self.months if k)
        months = {
            "month": mo_keys,
            "revenue": [round(self.months[k][0], 2) for k in mo_keys],
            "cost": [round(self.months[k][1], 2) for k in mo_keys],
            "profit": [round(self.months[k][2], 2) for k in mo_keys],
            "items": [int(self.months[k][3]) for k in mo_keys],
        }
        unlinked = {
            "notLinked": {
                "trips": len(self.nl_trips), "bills": len(self.nl_bills),
                "items": self.nl_items, "revenue": round(self.nl_revenue, 2),
            },
            "excludedCost": {k: round(v, 2) for k, v in self.excluded_cost.most_common()},
            "excludedItems": dict(self.excluded_items.most_common()),
            "noPayer": {"items": self.no_payer[0], "revenue": round(self.no_payer[1], 2)},
            "distanceSource": dict(self.dist_src.most_common()),
            "basisCondition": {str(k): v for k, v in sorted(self.basis_cond.items())},
        }
        manifest |= {
            "items": self.items,
            "customers": len(rows),
            "itemStatus": dict(self.status.most_common()),
            "months": mo_keys,
            "revenue": {
                "toCustomers": round(sum(v[1] for _, v in rows), 2),
                "notLinked": round(self.nl_revenue, 2),
            },
        }
        for name, obj in (("manifest.json", manifest), ("customers.json", customers),
                          ("months.json", months), ("unlinked.json", unlinked)):
            p = out / name
            p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"  {name:16} {p.stat().st_size / 1024:>9,.1f} KB")

    def report(self) -> None:
        print(f"  ลูกค้า {len(self.cust):,} ราย · ต้นทุนเข้าลูกค้า {self.allocated:,.2f} บาท")
        print(f"  รายการ: {dict(self.status.most_common())} · ไม่เชื่อมกัน {self.nl_items:,}")
        if self.excluded_cost:
            print("  ต้นทุนที่ไม่ปันเข้าลูกค้า: "
                  + " · ".join(f"{k} {v:,.2f}" for k, v in self.excluded_cost.most_common()))
        if self.no_payer[0]:
            print(f"  ระบุผู้จ่ายเงินไม่ได้ {self.no_payer[0]:,} รายการ ({self.no_payer[1]:,.2f} บาท)")


# ================================================================ ต้นทุนรายเที่ยว
def load_trips(cost_files: list[Path]) -> tuple[dict[str, float], dict[str, str], int]:
    """คืน (ต้นทุนต่อเที่ยว, ประเภทใบรายการต่อเที่ยว, จำนวนแถวที่ช่องต้นทุนไม่ใช่ตัวเลข)

    เลขที่ใบรายการซ้ำหลายแถว/หลายไฟล์ → รวมต้นทุนเข้าด้วยกัน (เอกสารข้อ 2.2)
    ช่องต้นทุนไม่ใช่ตัวเลข (เช่น "-") → ไม่นับเป็น 0 แต่ถือว่าข้อมูลไม่เชื่อมกัน (ข้อ 10.7)
    """
    cost: dict[str, float] = defaultdict(float)
    ttype: dict[str, str] = {}
    bad = 0
    for path in cost_files:
        hdr, body = iter_sheet(path, find_header_row(path, COL_DOC))
        col = {h: i for i, h in enumerate(hdr)}
        for need in (COL_DOC, COL_COST):
            if need not in col:
                sys.exit(f"ไฟล์ {path.name} ไม่มีคอลัมน์ '{need}'")

        def g(row, key: str, col=col):
            i = col.get(key, -1)
            return row[i] if 0 <= i < len(row) else None

        rows = 0
        for r in body:
            doc = txt(g(r, COL_DOC))
            if not doc:
                continue
            rows += 1
            t = txt(g(r, COL_TTYPE))
            if t:
                ttype[doc] = t
            raw = g(r, COL_COST)
            if not is_number(raw):
                bad += 1
                continue
            cost[doc] += num(raw)
        print(f"  {path.name}: {rows:,} แถว")
    return dict(cost), ttype, bad


def trip_types_only(cost_files: list[Path]) -> dict[str, str]:
    """อ่านแค่ ประเภทใบรายการ ต่อเที่ยว — ทางไฟล์ที่ปันเสร็จแล้วต้องใช้กันเที่ยวตีเปล่าออก
    เพราะไฟล์จากเครื่อง V2 มีแต่ 24 คอลัมน์ของไฟล์บิล ซึ่งไม่มีคอลัมน์นี้
    """
    _cost, ttype, _bad = load_trips(cost_files)
    return ttype


# ================================================================ ไฟล์บิลดิบ
BILL_COLS = {
    "doc": COL_DOC, "bill": COL_BILL, "origin": "ต้นทาง", "dest": "ปลายทาง",
    "weight": "น้ำหนักรวม", "qty": "จำนวน", "width": "กว้าง", "length": "ยาว", "height": "สูง",
    "name": "ชื่อสินค้า", "revenue": "ราคารวม", "payment": "ประเภทการชำระเงิน",
    "sender": "ผู้ส่ง_encoded", "receiver": "ผู้รับ_encoded", "goods": "ประเภทสินค้า",
    "date": "วันที่",
}


def item_reader(path: Path, extra: dict[str, str] | None = None):
    """คืนตัวไล่ Item ของไฟล์หนึ่งไฟล์ — ใช้ได้ทั้งไฟล์บิลดิบและไฟล์ที่ปันเสร็จแล้ว
    (ไฟล์จากเครื่อง V2 มี 24 คอลัมน์เดิมของไฟล์บิลอยู่ครบ จึงอ่านด้วยตัวเดียวกันได้)

    extra = คอลัมน์เพิ่มที่อยากได้ {ชื่อในโค้ด: ชื่อคอลัมน์} — คืนมาใน it.extra
    """
    hdr, body = iter_sheet(path, 0)
    col = {h: i for i, h in enumerate(hdr)}
    for need in (COL_DOC, COL_BILL, "ราคารวม"):
        if need not in col:
            sys.exit(f"ไฟล์ {path.name} ไม่ใช่ไฟล์บิล/ไฟล์ที่ปันเสร็จแล้ว (ไม่มีคอลัมน์ '{need}')\n"
                     f"  หัวคอลัมน์ที่เจอ: {', '.join(h for h in hdr if h)[:400]}")
    idx = {k: col.get(v, -1) for k, v in BILL_COLS.items()}
    xidx = {k: col.get(v, -1) for k, v in (extra or {}).items()}

    for r in body:
        def g(key: str, r=r):
            i = idx[key]
            return r[i] if 0 <= i < len(r) else None

        doc = txt(g("doc"))
        if not doc:
            continue
        d = parse_date(g("date"))
        it = Item(
            doc=doc, bill=txt(g("bill")), origin=txt(g("origin")), dest=txt(g("dest")),
            weight=num(g("weight")), qty=num(g("qty")),
            width=num(g("width")), length=num(g("length")), height=num(g("height")),
            name=txt(g("name")), revenue=num(g("revenue")), payment=txt(g("payment")),
            sender=txt(g("sender")), receiver=txt(g("receiver")), goods=txt(g("goods")),
        )
        it.month = d.isoformat()[:7] if d else ""
        it.extra = {k: (r[i] if 0 <= i < len(r) else None) for k, i in xidx.items()}
        yield it


def measure(it: Item, routes: dict[str, dict[str, float]]) -> None:
    """เติมระยะทาง/ปริมาตร/น้ำหนักที่ใช้คิด (ข้อ 5 ขั้นที่ 1-3)
    ระยะทางที่หาไม่เจอยังเป็น None — ต้องรู้ค่ากลางของทั้งเที่ยวก่อนจึงเติมได้
    """
    it.dist, it.dist_source = lookup_distance(routes, it.origin, it.dest)
    it.cbm = volume_cbm(it)
    it.basis, it.basis_cond = basis_of(it.weight, it.cbm, it.qty)


class TripAcc:
    """ตัวสะสมของหนึ่งเที่ยวในรอบแรก — เก็บเท่าที่ต้องใช้หาตัวหาร ไม่เก็บรายการ"""

    __slots__ = ("dists", "wl_known", "basis_unknown", "revenue", "qty", "n")

    def __init__(self) -> None:
        self.dists: Counter[float] = Counter()
        self.wl_known = 0.0
        self.basis_unknown = 0.0
        self.revenue = 0.0
        self.qty = 0.0
        self.n = 0

    def add(self, it: Item) -> None:
        self.n += 1
        self.revenue += it.revenue
        self.qty += it.qty
        if it.dist is None:
            self.basis_unknown += it.basis
        else:
            self.dists[it.dist] += 1
            self.wl_known += it.basis * it.dist

    def fill(self) -> float:
        if not self.dists:
            return 1.0
        return float(statistics.median(list(self.dists.elements())))

    def divisor(self) -> tuple[float, str]:
        return divisor_of(self.wl_known + self.basis_unknown * self.fill(),
                          self.revenue, self.qty, self.n)


# ================================================================ ทาง 1 · ไฟล์ที่ปันเสร็จแล้ว
def from_machine(files: list[Path], ttype: dict[str, str]) -> tuple[Rollup, dict]:
    """อ่านไฟล์จากเครื่องปันส่วนต้นทุน V2 — ใช้คอลัมน์ "ต้นทุนจัดสรร" ตรง ๆ ไม่คิดใหม่

    ★ แถวที่เครื่องเขียนว่า "ข้อมูลไม่เชื่อมกัน" ในช่องต้นทุนจัดสรร (เอกสารข้อ 8)
      ต้องถือว่าไม่มีต้นทุน ไม่ใช่ต้นทุน 0 ไม่งั้นบิลกลุ่มนั้นจะดูกำไรเท่ารายได้ทั้งก้อน
    """
    roll = Rollup()
    extra = {"alloc": COL_ALLOC, "alloc2": COL_ALLOC_ALT, "tripcost": COL_TRIPCOST,
             "dist": COL_DIST_OUT, "cond": COL_BASIS_OUT}
    trip_cost: dict[str, float] = {}
    for path in files:
        n = 0
        for it in item_reader(path, extra):
            n += 1
            raw = it.extra.get("alloc")
            if raw is None or raw == "":
                raw = it.extra.get("alloc2")
            # ป้ายที่มาระยะทาง/เงื่อนไข เอาไว้รายงานอย่างเดียว ไม่มีก็ข้ามได้
            dist_raw = it.extra.get("dist")
            if is_number(dist_raw):
                it.dist = num(dist_raw)
                it.dist_source = DIST_EXACT
            elif txt(dist_raw):
                it.dist_source = DIST_MEDIAN
            cond = it.extra.get("cond")
            if txt(cond)[:1].isdigit():
                it.basis_cond = int(txt(cond)[0])

            tc = it.extra.get("tripcost")
            if is_number(tc):
                trip_cost[it.doc] = num(tc)

            alloc = num(raw) if is_number(raw) else None
            roll.add(it, alloc, exclusion_of(it, ttype.get(it.doc, "")))
        bills = roll.flush_file()
        print(f"  {path.name}: {n:,} รายการ · บิลที่ปันได้ {bills:,}")

    info = {
        "source": SRC_MACHINE,
        "costFiles": [p.name for p in files],
        "billFiles": len(files),
        "trips": {
            "inCostReport": len(trip_cost),
            "inBills": len(trip_cost) + len(roll.nl_trips),
            "matched": len(trip_cost),
        },
        "cost": {
            "inCostReport": round(sum(trip_cost.values()), 2),
            "allocatable": round(sum(trip_cost.values()), 2),
            "toCustomers": round(roll.allocated, 2),
            "notToCustomers": round(sum(roll.excluded_cost.values()), 2),
        },
    }
    return roll, info


# ================================================================ ทาง 2 · คำนวณเอง
def from_raw(cost_files: list[Path], rev_files: list[Path],
             routes: dict[str, dict[str, float]]) -> tuple[Rollup, dict]:
    """คำนวณเองจากไฟล์ดิบด้วยสูตรใน src/alloc.py — เดินไฟล์บิลสองรอบ

    ★ ไม่เก็บรายการไว้ในหน่วยความจำ ข้อมูลจริง 29 ไฟล์ = 5.2 ล้านแถว ถ้าอ่านค้าง
      ทั้งก้อนกิน 5.5 GB (etl/src/loaders/revenue.py:160) รอบแรกสะสมแค่ตัวหารต่อเที่ยว
      รอบสองปันจริงแล้วยุบทันที · วิธีนี้ยังถูกแม้บิลของเที่ยวเดียวกันอยู่คนละไฟล์เดือน
    """
    print("อ่านรายงานค่าเดินทาง")
    trip_cost, ttype, bad_cost = load_trips(cost_files)
    print(f"  เที่ยวที่มีต้นทุน {len(trip_cost):,} · แถวที่ช่องต้นทุนไม่ใช่ตัวเลข {bad_cost:,}")

    print("รอบแรก: อ่านไฟล์บิลเพื่อหาตัวหารของแต่ละเที่ยว")
    acc: dict[str, TripAcc] = {}
    docs_in_bills: set[str] = set()
    for path in rev_files:
        n = 0
        for it in item_reader(path):
            n += 1
            docs_in_bills.add(it.doc)
            if it.doc not in trip_cost:
                continue
            measure(it, routes)
            acc.setdefault(it.doc, TripAcc()).add(it)
        print(f"  {path.name}: {n:,} รายการ")

    divisor = {doc: a.divisor() for doc, a in acc.items()}
    fill_km = {doc: a.fill() for doc, a in acc.items()}
    # แยกไว้ว่าค่าที่เติมมาจากค่ากลางของเที่ยวจริง ๆ หรือเป็น 1 เพราะทั้งเที่ยวหาไม่เจอ
    # (ดูจาก dists ไม่ใช่จากค่า 1.0 เพราะค่ากลางอาจเท่ากับ 1 กม. พอดีได้)
    from_median = {doc: bool(a.dists) for doc, a in acc.items()}
    del acc

    print("รอบสอง: ปันต้นทุนแล้วยุบเป็นระดับลูกค้า")
    roll = Rollup()
    for path in rev_files:
        n = 0
        for it in item_reader(path):
            n += 1
            cost = trip_cost.get(it.doc)
            if cost is None:
                roll.add(it, None, "")
                continue
            measure(it, routes)
            if it.dist is None:
                it.dist = fill_km[it.doc]
                it.dist_source = DIST_MEDIAN if from_median[it.doc] else DIST_FALLBACK
            it.workload = it.basis * it.dist
            total, source = divisor[it.doc]
            share = weight_of(it, source) / total if total > 0 else 0.0
            roll.add(it, cost * share, exclusion_of(it, ttype.get(it.doc, "")))
        bills = roll.flush_file()
        print(f"  {path.name}: บิลที่ปันได้ {bills:,}")

    matched = sorted(docs_in_bills & set(trip_cost))
    info = {
        "source": SRC_COMPUTE,
        "costFiles": [p.name for p in cost_files],
        "billFiles": len(rev_files),
        "trips": {
            "inCostReport": len(trip_cost),
            "inBills": len(docs_in_bills),
            "matched": len(matched),
        },
        "cost": {
            "inCostReport": round(sum(trip_cost.values()), 2),
            "allocatable": round(sum(trip_cost[d] for d in matched), 2),
            "toCustomers": round(roll.allocated, 2),
            "notToCustomers": round(sum(roll.excluded_cost.values()), 2),
        },
    }
    return roll, info


# ================================================================ ประกอบร่าง
def build(dataset: str, source: str) -> None:
    if dataset == "real":
        cost_files = xlsx_files(REAL_COST_DIR) if REAL_COST_DIR.exists() else []
        rev_files = xlsx_files(REAL_REV_DIR) if REAL_REV_DIR.exists() else []
        done_files = xlsx_files(REAL_ALLOCATED_DIR) if REAL_ALLOCATED_DIR.exists() else []
    else:
        cost_files = [SAMPLE_COST] if SAMPLE_COST.exists() else []
        rev_files = xlsx_files(SAMPLE_REV_DIR) if SAMPLE_REV_DIR.exists() else []
        done_files = []

    use_machine = source == "machine" or (source == "auto" and done_files)
    if use_machine and not done_files:
        sys.exit(f"ไม่มีไฟล์ที่ปันเสร็จแล้วใน {REAL_ALLOCATED_DIR}")

    if use_machine:
        print(f"ใช้ไฟล์ที่ปันเสร็จแล้วจากเครื่องปันส่วนต้นทุน ({len(done_files)} ไฟล์)")
        ttype: dict[str, str] = {}
        if cost_files:
            print("อ่าน ประเภทใบรายการ จากรายงานค่าเดินทาง (ใช้กันเที่ยวตีเปล่าออก)")
            ttype = trip_types_only(cost_files)
        else:
            print("  [!] ไม่มีรายงานค่าเดินทางใน etl/data/travel/ — กันออกได้แค่บิลเคลียร์")
            print("      เที่ยวตีเปล่า/รถว่างไปสาขาจะถูกนับเป็นลูกค้าด้วย")
        roll, info = from_machine(done_files, ttype)
    else:
        if not cost_files:
            sys.exit(f"ไม่มีรายงานค่าเดินทางใน {REAL_COST_DIR if dataset == 'real' else SAMPLE_COST}")
        if not rev_files:
            sys.exit(f"ไม่มีไฟล์บิลใน {REAL_REV_DIR if dataset == 'real' else SAMPLE_REV_DIR}")
        routes: dict[str, dict[str, float]] = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))
        print(f"ตารางระยะทาง {sum(len(v) for v in routes.values()):,} คู่")
        roll, info = from_raw(cost_files, rev_files, routes)

    out = OUT_ROOT / dataset / "alloc"
    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().replace(microsecond=0).isoformat(),
        **info,
    }
    roll.write(out, manifest)
    print(f"เขียน {out.relative_to(ROOT)}  (ที่มา: {info['source']})")
    roll.report()
    c = manifest["cost"]
    print(f"  ต้นทุนที่ปันได้ {c['allocatable']:,.2f} = เข้าลูกค้า {c['toCustomers']:,.2f} "
          f"+ ไม่เข้าลูกค้า {c['notToCustomers']:,.2f}")


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="กำไรลูกค้าจากการปันส่วนต้นทุนเที่ยวรถ → JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="real")
    ap.add_argument("--source", choices=["auto", "machine", "compute"], default="auto",
                    help="auto = มีไฟล์ใน etl/data/allocated/ ก็ใช้อันนั้น ไม่มีก็คำนวณเอง")
    a = ap.parse_args()
    build(a.dataset, a.source)


if __name__ == "__main__":
    main()
