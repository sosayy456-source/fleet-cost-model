"""สร้างข้อมูลกำไรลูกค้าจากการปันส่วนต้นทุนเที่ยวรถ (วิธี ค) → app/public/data/<ds>/alloc/

    python etl/build_alloc.py --dataset real
        ต้นทุน  etl/data/travel/*.xlsx      (รายงานค่าเดินทาง เช่น "ค่าเดินทาง เดือน0167.xlsx")
        รายได้  etl/data/revenue/*.xlsx     (ไฟล์บิลรายเดือน)
    python etl/build_alloc.py --dataset sample
        ต้นทุน  etl/sample_data/ExampleCostandRevenue.xlsx
        รายได้  RevenueDashboard/RevenueDashboard/sample_data/bill_*.xlsx

ผลลัพธ์
    manifest.json   จำนวน/ยอดรวม/ช่วงวันที่/คุณภาพการจับคู่
    customers.json  1 ระเบียน = 1 ลูกค้า (ผู้จ่ายเงิน) เก็บเป็นคอลัมน์เพื่อให้ไฟล์เล็ก
    months.json     ยอดรายเดือน สำหรับกราฟแนวโน้ม
    unlinked.json   กลุ่ม "ข้อมูลไม่เชื่อมกัน" + ต้นทุนที่ไม่ปันเข้าลูกค้า (บล็อกล่างสุดของหน้า)

สูตรทั้งหมดอยู่ใน src/alloc.py ที่นี่แค่ประกอบร่าง — อ่านไฟล์ จับคู่ ยุบก้อน เขียน JSON

★ เดินไฟล์บิล "สองรอบ" ไม่เก็บรายการไว้ในหน่วยความจำ
  ไฟล์รายได้จริง 29 ไฟล์ = 5.2 ล้านแถว วัดแล้วกิน 5.5 GB ถ้าอ่านค้างไว้ทั้งก้อน
  (etl/src/loaders/revenue.py:160) รอบแรกเก็บแค่ตัวหารต่อเที่ยว รอบสองปันจริงแล้วยุบทันที
  วิธีนี้ยังถูกแม้บิลของเที่ยวเดียวกันอยู่คนละไฟล์เดือน ซึ่งถ้าปันแยกไฟล์จะได้สัดส่วนผิด

★ เลขที่ใบรายการเทียบเป็นสตริงเสมอ (13 หลัก) — txt() ตัด .0 ที่ calamine ใส่มาให้
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
    CLEARING_GOODS,
    DIST_EXACT,
    DIST_FALLBACK,
    DIST_MEDIAN,
    DIST_REVERSED,
    EMPTY_TRIP_TYPES,
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

COL_DOC = "เลขที่ใบรายการ"
COL_COST = "ต้นทุน"
COL_TTYPE = "ประเภทใบรายการ"


# ---------------------------------------------------------------- ต้นทุนรายเที่ยว
def load_trips(cost_files: list[Path]) -> tuple[dict[str, float], dict[str, str], int]:
    """คืน (ต้นทุนต่อเที่ยว, ประเภทใบรายการต่อเที่ยว, จำนวนแถวที่ช่องต้นทุนไม่ใช่ตัวเลข)

    เลขที่ใบรายการซ้ำหลายแถว/หลายไฟล์ → รวมต้นทุนเข้าด้วยกัน (สเปกข้อ 2.2)
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

        def g(row, key: str):
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


# ---------------------------------------------------------------- ไฟล์บิล
BILL_COLS = {
    "doc": COL_DOC,
    "bill": "เลขที่บิล",
    "origin": "ต้นทาง",
    "dest": "ปลายทาง",
    "weight": "น้ำหนักรวม",
    "qty": "จำนวน",
    "width": "กว้าง",
    "length": "ยาว",
    "height": "สูง",
    "name": "ชื่อสินค้า",
    "revenue": "ราคารวม",
    "payment": "ประเภทการชำระเงิน",
    "sender": "ผู้ส่ง_encoded",
    "receiver": "ผู้รับ_encoded",
    "goods": "ประเภทสินค้า",
    "date": "วันที่",
}


def bill_reader(path: Path):
    """คืนตัวไล่ (Item, เดือน YYYY-MM) ของไฟล์บิลหนึ่งไฟล์ — ไม่เก็บแถวไว้"""
    hdr, body = iter_sheet(path, 0)
    col = {h: i for i, h in enumerate(hdr)}
    for need in (COL_DOC, "เลขที่บิล", "ราคารวม"):
        if need not in col:
            sys.exit(f"ไฟล์ {path.name} ไม่ใช่ไฟล์บิล (ไม่มีคอลัมน์ '{need}')")

    idx = {k: col.get(v, -1) for k, v in BILL_COLS.items()}

    def g(row, key: str):
        i = idx[key]
        return row[i] if 0 <= i < len(row) else None

    for r in body:
        doc = txt(g(r, "doc"))
        if not doc:
            continue
        d = parse_date(g(r, "date"))
        yield Item(
            doc=doc,
            bill=txt(g(r, "bill")),
            origin=txt(g(r, "origin")),
            dest=txt(g(r, "dest")),
            weight=num(g(r, "weight")),
            qty=num(g(r, "qty")),
            width=num(g(r, "width")),
            length=num(g(r, "length")),
            height=num(g(r, "height")),
            name=txt(g(r, "name")),
            revenue=num(g(r, "revenue")),
            payment=txt(g(r, "payment")),
            sender=txt(g(r, "sender")),
            receiver=txt(g(r, "receiver")),
            goods=txt(g(r, "goods")),
        ), (d.isoformat()[:7] if d else "")


def measure(it: Item, routes: dict[str, dict[str, float]]) -> None:
    """เติมระยะทาง/ปริมาตร/น้ำหนักที่ใช้คิดให้รายการหนึ่ง (ข้อ 5 ขั้นที่ 1-3)

    ระยะทางที่หาไม่เจอยังเป็น None ตรงนี้ — ต้องรู้ค่ากลางของทั้งเที่ยวก่อนจึงเติมได้
    """
    it.dist, it.dist_source = lookup_distance(routes, it.origin, it.dest)
    it.cbm = volume_cbm(it)
    it.basis, it.basis_cond = basis_of(it.weight, it.cbm, it.qty)


class TripAcc:
    """ตัวสะสมของหนึ่งเที่ยวในรอบแรก — เก็บเท่าที่ต้องใช้หาตัวหาร ไม่เก็บรายการ"""

    __slots__ = ("dists", "wl_known", "basis_unknown", "revenue", "qty", "n")

    def __init__(self) -> None:
        self.dists: Counter[float] = Counter()   # ระยะทางที่หาเจอ (ค่าซ้ำเยอะ เก็บเป็นตัวนับ)
        self.wl_known = 0.0                      # Σ ภาระงานของรายการที่รู้ระยะทาง
        self.basis_unknown = 0.0                 # Σ น้ำหนักที่ใช้คิดของรายการที่ไม่รู้ระยะทาง
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
        """ระยะทางที่ใช้แทนของรายการที่หาไม่เจอ — ค่ากลางของเที่ยว ไม่มีเลยใช้ 1"""
        if not self.dists:
            return 1.0
        flat = list(self.dists.elements())
        return float(statistics.median(flat))

    def divisor(self) -> tuple[float, str]:
        wl = self.wl_known + self.basis_unknown * self.fill()
        return divisor_of(wl, self.revenue, self.qty, self.n)


def build(dataset: str) -> None:
    if dataset == "real":
        cost_files = xlsx_files(REAL_COST_DIR) if REAL_COST_DIR.exists() else []
        rev_files = xlsx_files(REAL_REV_DIR) if REAL_REV_DIR.exists() else []
    else:
        cost_files = [SAMPLE_COST] if SAMPLE_COST.exists() else []
        rev_files = xlsx_files(SAMPLE_REV_DIR) if SAMPLE_REV_DIR.exists() else []
    if not cost_files:
        sys.exit(f"ไม่มีไฟล์รายงานค่าเดินทางใน {REAL_COST_DIR if dataset == 'real' else SAMPLE_COST}")
    if not rev_files:
        sys.exit(f"ไม่มีไฟล์บิลใน {REAL_REV_DIR if dataset == 'real' else SAMPLE_REV_DIR}")

    routes: dict[str, dict[str, float]] = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))
    print(f"ตารางระยะทาง {sum(len(v) for v in routes.values()):,} คู่")

    print("อ่านรายงานค่าเดินทาง")
    trip_cost, trip_type, bad_cost = load_trips(cost_files)
    print(f"  เที่ยวที่มีต้นทุน {len(trip_cost):,} · แถวที่ช่องต้นทุนไม่ใช่ตัวเลข {bad_cost:,}")

    # ---------------- รอบแรก · หาตัวหารของแต่ละเที่ยว ----------------
    print("รอบแรก: อ่านไฟล์บิลเพื่อหาตัวหารของแต่ละเที่ยว")
    acc: dict[str, TripAcc] = {}
    items_total = 0
    docs_in_bills: set[str] = set()
    for path in rev_files:
        n = 0
        for it, _mo in bill_reader(path):
            n += 1
            docs_in_bills.add(it.doc)
            if it.doc not in trip_cost:
                continue                      # ไม่มีต้นทุน ไม่ต้องหาตัวหาร
            measure(it, routes)
            acc.setdefault(it.doc, TripAcc()).add(it)
        items_total += n
        print(f"  {path.name}: {n:,} รายการ")

    divisor: dict[str, tuple[float, str]] = {}
    fill_km: dict[str, float] = {}
    fill_from_median: dict[str, bool] = {}
    for doc, a in acc.items():
        divisor[doc] = a.divisor()
        fill_km[doc] = a.fill()
        # แยกไว้ว่าค่าที่เติมมาจากค่ากลางของเที่ยวจริง ๆ หรือเป็น 1 เพราะทั้งเที่ยวหาไม่เจอ
        # (ดูจาก dists ไม่ใช่จากค่า 1.0 เพราะค่ากลางอาจเท่ากับ 1 กม. พอดีได้)
        fill_from_median[doc] = bool(a.dists)
    del acc

    # ---------------- รอบสอง · ปันจริงแล้วยุบก้อน ----------------
    print("รอบสอง: ปันต้นทุนแล้วยุบเป็นระดับลูกค้า")
    # ลูกค้า: (ฝ่าย, รหัส) -> [บิล, รายได้, ต้นทุนจัดสรร, กำไร, บิลที่ขาดทุน]
    cust: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
    months: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
    dist_src = Counter()
    basis_cond = Counter()
    excluded = Counter()            # เหตุผล -> ต้นทุนที่ไม่ปันเข้าลูกค้า
    excluded_items = Counter()
    no_payer = [0, 0.0]             # จำนวนรายการ/รายได้ ที่หาผู้จ่ายไม่ได้
    unlinked = {"trips": set(), "bills": set(), "items": 0, "revenue": 0.0}
    allocated = 0.0
    profit_items = Counter()        # สถานะ -> จำนวนรายการ

    for path in rev_files:
        # ระดับบิลรวมก่อนแล้วค่อยขึ้นเป็นลูกค้า — 1 เลขที่บิลอยู่ในเที่ยวเดียวเสมอ (ข้อ 2.1)
        bills: dict[str, list] = {}
        for it, mo in bill_reader(path):
            cost = trip_cost.get(it.doc)
            if cost is None:
                unlinked["trips"].add(it.doc)
                unlinked["bills"].add(it.bill)
                unlinked["items"] += 1
                unlinked["revenue"] += it.revenue
                continue

            measure(it, routes)
            if it.dist is None:
                it.dist = fill_km[it.doc]
                it.dist_source = DIST_MEDIAN if fill_from_median[it.doc] else DIST_FALLBACK
            it.workload = it.basis * it.dist
            total, source = divisor[it.doc]
            it.share = weight_of(it, source) / total if total > 0 else 0.0
            it.alloc = cost * it.share
            it.profit = it.revenue - it.alloc
            it.excluded = exclusion_of(it, trip_type.get(it.doc, ""))

            dist_src[it.dist_source] += 1
            basis_cond[it.basis_cond] += 1
            profit_items["กำไร" if it.profit > 0 else "ขาดทุน" if it.profit < 0 else "เท่าทุน"] += 1

            if it.excluded:
                excluded[it.excluded] += it.alloc
                excluded_items[it.excluded] += 1
                continue

            allocated += it.alloc
            side, code = payer_of(it)
            if not code:
                no_payer[0] += 1
                no_payer[1] += it.revenue
                continue

            m = months[mo]
            m[0] += it.revenue; m[1] += it.alloc; m[2] += it.profit; m[3] += 1

            b = bills.get(it.bill)
            if b is None:
                bills[it.bill] = [side, code, it.revenue, it.alloc]
            else:
                b[2] += it.revenue
                b[3] += it.alloc

        for side, code, rev, alc in bills.values():
            c = cust[(side, code)]
            c[0] += 1
            c[1] += rev
            c[2] += alc
            c[3] += rev - alc
            if rev - alc < 0:
                c[4] += 1
        print(f"  {path.name}: บิลที่ปันได้ {len(bills):,}")

    # ---------------- เขียนไฟล์ ----------------
    out = OUT_ROOT / dataset / "alloc"
    out.mkdir(parents=True, exist_ok=True)

    rows = sorted(cust.items(), key=lambda kv: kv[1][3])          # ขาดทุนมากสุดขึ้นก่อน
    customers = {
        "side": [k[0] for k, _ in rows],
        "code": [k[1] for k, _ in rows],
        "bills": [int(v[0]) for _, v in rows],
        "revenue": [round(v[1], 2) for _, v in rows],
        "cost": [round(v[2], 2) for _, v in rows],
        "profit": [round(v[3], 2) for _, v in rows],
        "lossBills": [int(v[4]) for _, v in rows],
    }

    mo_keys = sorted(k for k in months if k)
    months_json = {
        "month": mo_keys,
        "revenue": [round(months[k][0], 2) for k in mo_keys],
        "cost": [round(months[k][1], 2) for k in mo_keys],
        "profit": [round(months[k][2], 2) for k in mo_keys],
        "items": [int(months[k][3]) for k in mo_keys],
    }

    unlinked_json = {
        "notLinked": {
            "trips": len(unlinked["trips"]),
            "bills": len(unlinked["bills"]),
            "items": unlinked["items"],
            "revenue": round(unlinked["revenue"], 2),
        },
        "excludedCost": {k: round(v, 2) for k, v in excluded.most_common()},
        "excludedItems": dict(excluded_items.most_common()),
        "noPayer": {"items": no_payer[0], "revenue": round(no_payer[1], 2)},
        "distanceSource": dict(dist_src.most_common()),
        "basisCondition": {str(k): v for k, v in sorted(basis_cond.items())},
    }

    matched = sorted(docs_in_bills & set(trip_cost))
    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().replace(microsecond=0).isoformat(),
        "costFiles": [p.name for p in cost_files],
        "billFiles": len(rev_files),
        "items": items_total,
        "customers": len(rows),
        "trips": {
            "inCostReport": len(trip_cost),
            "inBills": len(docs_in_bills),
            "matched": len(matched),
        },
        "cost": {
            "inCostReport": round(sum(trip_cost.values()), 2),
            "allocatable": round(sum(trip_cost[d] for d in matched), 2),
            "toCustomers": round(allocated, 2),
            "notToCustomers": round(sum(excluded.values()), 2),
        },
        "revenue": {
            "toCustomers": round(sum(v[1] for _, v in rows), 2),
            "notLinked": round(unlinked["revenue"], 2),
        },
        "itemStatus": dict(profit_items.most_common()),
        "months": mo_keys,
    }

    for name, obj in (("manifest.json", manifest), ("customers.json", customers),
                      ("months.json", months_json), ("unlinked.json", unlinked_json)):
        p = out / name
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  {name:16} {p.stat().st_size / 1024:>9,.1f} KB")

    print(f"เขียน {out.relative_to(ROOT)}")
    c = manifest["cost"]
    print(f"  เที่ยวจับคู่ได้ {len(matched):,} จาก {len(docs_in_bills):,} ในไฟล์บิล "
          f"/ {len(trip_cost):,} ในรายงานค่าเดินทาง")
    print(f"  ต้นทุนที่ปันได้ {c['allocatable']:,.2f} = เข้าลูกค้า {c['toCustomers']:,.2f} "
          f"+ ไม่เข้าลูกค้า {c['notToCustomers']:,.2f}")
    print(f"  ลูกค้า {len(rows):,} ราย · รายได้ที่ปันได้ {manifest['revenue']['toCustomers']:,.2f}")
    print(f"  รายการ: {dict(profit_items.most_common())} · ไม่เชื่อมกัน {unlinked['items']:,}")
    if excluded:
        print("  ต้นทุนที่ไม่ปันเข้าลูกค้า: "
              + " · ".join(f"{k} {v:,.2f}" for k, v in excluded.most_common()))


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="ปันส่วนต้นทุนเที่ยวรถเข้าบิลลูกค้า แล้วสรุปเป็น JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="real")
    a = ap.parse_args()
    build(a.dataset)


if __name__ == "__main__":
    main()
