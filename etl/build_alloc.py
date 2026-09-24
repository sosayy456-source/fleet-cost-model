"""สร้างข้อมูลกำไรลูกค้าจากการปันส่วนต้นทุน → app/public/data/<ds>/alloc/

คำนวณเองจากไฟล์ดิบเสมอ — ไม่มีทางรับไฟล์ที่ปันเสร็จแล้วอีกแล้ว
      ไฟล์ต้นทุน etl/data/Dashboard real data/ + ไฟล์บิล etl/data/revenue/ + routes.json
      ใช้สูตรใน src/alloc.py (วิธี ค) ซึ่งตรวจแล้วตรงกับเอกสารข้อ 11 ทุกตัว

★ ไฟล์ต้นทุนชุดเดียวกับ build_costrev.py (Executive Dashboard / Demo) — เจ้าของงานเคาะ 24 ก.ย. 2569
  เดิมอ่าน etl/data/travel/ ซึ่งไม่มีไฟล์ ชุดจริงจึงไม่เคยถูกสร้างและแอปถอยไปใช้ข้อมูลตัวอย่างเงียบ ๆ
  (ชุดตัวอย่างใช้ ExampleCost.xlsx ไฟล์เดียวกันทั้งสองตัวมาตั้งแต่ต้น) · load_trips อ่านแค่ เลขที่ใบรายการ/ต้นทุน/
  ประเภทใบรายการ และหาแถวหัวเอง ไฟล์รุ่นใหม่ที่หัวตารางอยู่แถว 2 จึงอ่านได้โดยไม่ต้องแก้อะไร

    python etl/build_alloc.py --dataset real
    python etl/build_alloc.py --dataset sample

★ เดิม (16 ก.ย. 2569) เคยรับไฟล์จากเครื่องปันส่วนต้นทุน V2 ที่ etl/data/allocated/ เป็นทางหลัก
  เจ้าของข้อมูลสั่งตัดทิ้ง 17 ก.ย. 2569 เพราะไฟล์นั้นเป็นข้อมูลชุดเดียวกับที่ etl/data/revenue/
  กับ etl/data/travel/ มีอยู่แล้ว แค่ผ่านการคำนวณมาก่อน — เก็บไว้สองที่คือข้อมูลซ้ำซ้อน
  **ห้ามเติมทางรับไฟล์ที่ปันเสร็จกลับเข้ามาโดยไม่ถามก่อน**

ผลลัพธ์
    manifest.json   จำนวน/ยอดรวม/ช่วงเดือน/ที่มาของข้อมูล
    customers.json  1 ระเบียน = 1 ลูกค้า (ผู้จ่ายเงิน) เก็บเป็นคอลัมน์เพื่อให้ไฟล์เล็ก
                    คอลัมน์ n = เลขในรหัส CUS ที่แปลงจาก custmap.bin ให้แล้ว (0 = ไม่มีในไฟล์)
    months.json     ยอดรายเดือน สำหรับกราฟแนวโน้ม
    unlinked.json   กลุ่ม "ข้อมูลไม่เชื่อมกัน" + ต้นทุนที่ไม่ปันเข้าลูกค้า (บล็อกล่างสุดของหน้า)

    สามไฟล์ล่างนี้เพิ่ม 22 ก.ย. 2569 ให้แท็บ "กำไรลูกค้า" ของเมนู Demo (ตัวกรองปี/เดือน + ดูบิลรายลูกค้า)
    cust_months.json  1 ระเบียน = ลูกค้า × เดือน เก็บเป็นคอลัมน์ · ci = ดัชนีลูกค้าใน customers.json
                      mi = ดัชนีเดือนในลิสต์ month ของไฟล์เดียวกัน — แอปยุบกลับเป็นรายลูกค้าตามตัวกรองเอง
    top.json          "ปี|เดือน" → {gain: [ci…], loss: [ci…]} = 10 รายกำไรสูงสุดเป็นบาท (เฉพาะกำไร ≥ 0)
                      กับ 10 รายขาดทุนมากสุดเป็นบาท ของช่วงเวลานั้น (เดิมจัดด้วยอัตรากำไร % — ดู top_by_period) คีย์ว่างสองข้าง "|" = ทุกช่วง
                      "2025|" = ทั้งปี · "|07" = เดือน 7 ของทุกปี · "2025|07" = เดือนเดียว
                      · "2025|03-05" = ช่วงเดือนในปีเดียว (เพิ่ม 24 ก.ย. 2569 — ตัวกรองของแอปเป็น ปี + ช่วงเดือน
                      แบบแท็บ Damage Rate · คีย์ต้องตรงกับ allocTopKey() ใน app/src/lib/data/useAlloc.ts)
                      — คัดในนี้เพื่อให้ฝั่งแอปกับบิลที่แนบไปตรงกันเสมอ
    bills.json        บิลรายใบ **เฉพาะลูกค้าที่ติด Top 10 ของช่วงใดช่วงหนึ่ง** (ci · เลขที่บิล · วันที่ ·
                      เลขที่ใบรายการ · เส้นทาง · รายได้ · ต้นทุนจัดสรร) — ข้อมูลจริงมีบิลราว 2 ล้านใบ
                      เก็บทุกใบไม่ไหว จึงเดินไฟล์บิลรอบที่สามเก็บเฉพาะรายที่แอปเปิดดูได้ (ที่เหลือแอปโชว์
                      เป็นรายลูกค้าโดยกดดูบิลไม่ได้ และมีโน้ตบอกข้อจำกัดนี้)

กติกาที่เจ้าของข้อมูลชี้ขาด (16 ก.ย. 2569):
    ลูกค้า = ผู้จ่ายเงิน — สด/เชื่อต้นทาง → ผู้ส่ง · สด/เชื่อปลายทาง → ผู้รับ
    บิลเคลียร์ กับ เที่ยวตีเปล่า/รถว่างไปสาขา ไม่นับเป็นลูกค้า (แต่ยังรับต้นทุนของตัวเอง
    แล้วไปโชว์เป็น "ต้นทุนที่ไม่ปันเข้าลูกค้า")

★ เลขที่ใบรายการ/เลขที่บิลเทียบเป็นสตริงเสมอ txt() ตัด .0 ที่ calamine ใส่มาให้
"""
from __future__ import annotations

import argparse
import heapq
import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from build_costrev import find_header_row, iter_sheet, parse_date, utf8_stdout, xlsx_files
from src.custcodes import resolve_codes
from src.alloc import (
    DIST_EXACT,
    DIST_FALLBACK,
    DIST_MEDIAN,
    DIST_REVERSED,
    FLAGS,
    Item,
    basis_of,
    data_flag,
    pool_of,
    share_in_trip,
    divisor_of,
    exclusion_of,
    is_number,
    lookup_distance,
    num,
    payer_of,
    txt,
    volume_cbm,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_ROOT = ROOT / "app" / "public" / "data"
ROUTES_JSON = ROOT / "app" / "src" / "lib" / "refdata" / "routes.json"

SAMPLE_COST = HERE / "sample_data" / "ExampleCost.xlsx"   # เปลี่ยนชื่อไฟล์ 22 ก.ย. 2569
SAMPLE_REV_DIR = ROOT / "RevenueDashboard" / "RevenueDashboard" / "sample_data"
REAL_COST_DIR = HERE / "data" / "Dashboard real data"   # = REAL_COST_DIR ของ build_costrev.py
REAL_REV_DIR = HERE / "data" / "revenue"

COL_DOC = "เลขที่ใบรายการ"
COL_BILL = "เลขที่บิล"
COL_COST = "ต้นทุน"
COL_TTYPE = "ประเภทใบรายการ"
#: คอลัมน์ผลการจัดสรรจากเครื่อง V2 (เอกสารข้อ 8 คอลัมน์ 25-33)
SRC_COMPUTE = "คำนวณในระบบจากไฟล์ดิบ (src/alloc.py วิธี ค)"
#: จำนวนรายต่อฝั่งใน top.json — เจ้าของงานเคาะ 22 ก.ย. 2569 (เดิมในสเปกเขียน 100 แล้วลดเหลือ 10)
TOP_N = 10
#: ลูกค้าที่รายได้จากรายการที่ปันตามรายได้ (น้ำหนัก/ขนาดเชื่อไม่ได้) ≥ สัดส่วนนี้ = ติดป้าย "ปันตามรายได้" ในแอป
#: ต้องตรงกับ REVIEW_SHARE ใน app/src/lib/alloc/review.ts · ครึ่งหนึ่งพอดีให้รายใหญ่ที่มีบิลผิดไม่กี่ใบไม่ติดป้าย
REVIEW_SHARE = 0.5
#: ตำแหน่งในอาร์เรย์ของ Rollup.cust / cust_mo — [บิล, รายได้, ต้นทุน, กำไร, บิลขาดทุน, รายได้ที่ปันตามรายได้, นับตามเหตุผล×3]
FLAG_REV = 5

CustKey = tuple[str, str]


def needs_review(revenue: float, flag_rev: float) -> bool:
    """ลูกค้าที่ต้นทุนส่วนใหญ่ปันตามรายได้ — กติกาเดียวกับ needsReview() ใน app/src/lib/alloc/review.ts"""
    if flag_rev <= 0:
        return False
    return revenue <= 0 or flag_rev / revenue >= REVIEW_SHARE


def flag_cols(vals: list[list[float]]) -> dict[str, list]:
    """คอลัมน์ "ต้องตรวจสอบ" ของ customers.json / cust_months.json — ไฟล์รุ่นก่อน 23 ก.ย. 2569 ไม่มี"""
    return {
        "flagRev": [round(v[FLAG_REV], 2) for v in vals],
        "fNoSize": [int(v[FLAG_REV + 1]) for v in vals],
        "fBig": [int(v[FLAG_REV + 2]) for v in vals],
        "fTiny": [int(v[FLAG_REV + 3]) for v in vals],
    }


def margin_of(revenue: float, profit: float) -> float:
    """อัตรากำไร % ของลูกค้า — กติกาเดียวกับฝั่งแอป (CustomerProfitTab.tsx) ห้ามแก้ข้างเดียว

    รายได้ 0 แล้วขาดทุน = −100 (เสียต้นทุนทั้งก้อนโดยไม่ได้อะไรกลับ กติกาเดียวกับตารางเส้นทางของ Demo)
    รายได้ 0 และไม่ขาดทุน = 0
    """
    if revenue > 0:
        return profit / revenue * 100
    return -100.0 if profit < 0 else 0.0


# ================================================================ ยุบก้อน
class Rollup:
    """สะสมผลการปันเป็นระดับลูกค้า/เดือน + เก็บของที่ไม่เข้ากำไรลูกค้าไว้รายงาน

    ป้อนทีละรายการสินค้าด้วย add() แล้วปิดไฟล์ด้วย flush_file() ทุกครั้งที่จบหนึ่งไฟล์
    (ระดับบิลรวมภายในไฟล์ก่อนแล้วค่อยขึ้นเป็นลูกค้า — 1 เลขที่บิลอยู่ในเที่ยวเดียวเสมอ
    ตามเอกสารข้อ 2.1 และแถวของบิลเดียวกันอยู่ไฟล์เดียวกันเพราะบิลมีวันที่เดียว)
    """

    def __init__(self) -> None:
        # (ฝ่าย, รหัส) -> [บิล, รายได้, ต้นทุนจัดสรร, กำไร, บิลที่ขาดทุน,
        #                  รายได้ของรายการที่ต้องตรวจสอบ, จำนวนรายการตามเหตุผล FLAGS ×3]
        self.cust: dict[CustKey, list[float]] = defaultdict(lambda: [0.0] * (FLAG_REV + 1 + len(FLAGS)))
        # (ฝ่าย, รหัส, เดือน) -> ชุดเดียวกัน — ให้แท็บกำไรลูกค้ากรองปี/เดือนได้ (บิลหนึ่งใบมีวันที่เดียว
        # จึงอยู่เดือนเดียว ผลรวมทุกเดือนของรายหนึ่งเท่ากับ self.cust เสมอ)
        self.cust_mo: dict[tuple[str, str, str], list[float]] = defaultdict(lambda: [0.0] * (FLAG_REV + 1 + len(FLAGS)))
        self.flag_items: Counter[str] = Counter()
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
            b = self._bills[it.bill] = [side, code, it.revenue, alloc, it.month, 0.0] + [0] * len(FLAGS)
        else:
            b[2] += it.revenue
            b[3] += alloc
        flag = it.flag or data_flag(it)
        if flag:
            b[5] += it.revenue
            b[6 + FLAGS.index(flag)] += 1
            self.flag_items[flag] += 1

    def flush_file(self) -> int:
        """ปิดไฟล์: ยกบิลที่สะสมไว้ขึ้นเป็นลูกค้า แล้วล้างถังของไฟล์นั้น"""
        n = len(self._bills)
        for side, code, rev, alc, month, frev, *fn in self._bills.values():
            for c in (self.cust[(side, code)], self.cust_mo[(side, code, month)]):
                c[0] += 1
                c[1] += rev
                c[2] += alc
                c[3] += rev - alc
                if rev - alc < 0:
                    c[4] += 1
                c[FLAG_REV] += frev
                for i, n in enumerate(fn):
                    c[FLAG_REV + 1 + i] += n
        self._bills = {}
        return n

    # ---------------- ลำดับลูกค้า + Top 10 ต่อช่วงเวลา ----------------
    def order(self) -> list[CustKey]:
        """ลำดับลูกค้าที่ใช้เป็นดัชนี ci ในทุกไฟล์ — ขาดทุนมากสุดขึ้นก่อน (ลำดับเดิมของ customers.json)"""
        return [k for k, _ in sorted(self.cust.items(), key=lambda kv: kv[1][3])]

    def top_by_period(self, index: dict[CustKey, int]) -> dict[str, dict[str, list[int]]]:
        """Top 10 กำไรสูงสุด/ขาดทุนมากสุด **เป็นบาท** ของทุกช่วงเวลาที่ตัวกรองปี/เดือนของแอปเลือกได้

        ★ เปลี่ยนจากอัตรากำไร % เป็นกำไรบาท 23 ก.ย. 2569 (เจ้าของงานเคาะ) — จัดด้วย % แล้ว Top 10 กำไรเต็มไปด้วย
          ลูกค้าบิลเดียวรายได้หลักร้อยที่ต้นทุนจัดสรร ~0 (บิลกรอกขนาด 1×1×1 ซม. ภาระงานเลยเกือบศูนย์) = 100% ทั้ง 10 ราย
          ตั้งเกณฑ์รายได้ ≥ 1,000 หรือ ≥ 5 บิลก็ยังได้ 99.6-100% เพราะต้นเหตุอยู่ที่ขนาดหลอก ไม่ใช่ขนาดลูกค้า
          · ฝั่งขาดทุนก็เช่นกัน (เดิมขึ้นแต่ราย −2,000% ถึง −8,000% ที่รายได้ไม่กี่สิบบาท) · อัตรากำไรใช้แค่ตัดสินเสมอ

        ★ ต้องคัดที่นี่ ไม่ใช่ฝั่งแอป — bills.json เก็บบิลเฉพาะรายที่ติดอันดับ ถ้าสองฝั่งจัดอันดับคนละสูตร
          แถวที่แอปบอกว่ากดได้จะไม่มีบิลให้ดู · ยุบตามเดือนก่อนแล้วค่อยรวมเป็นช่วง จะได้แตะแต่ละระเบียน
          ของ cust_mo แค่ไม่กี่ครั้ง (ทุกช่วง · ปี · เดือน · ปี-เดือน · ช่วงเดือนต่อยอด) ไม่ใช่ไล่ทั้งตารางซ้ำทุกคีย์
        """
        by_month: dict[str, dict[CustKey, list[float]]] = defaultdict(dict)
        for (side, code, month), v in self.cust_mo.items():
            if month:
                by_month[month][(side, code)] = v

        def add(acc: dict[CustKey, list[float]], month: str) -> None:
            for k, v in by_month[month].items():
                a = acc.get(k)
                if a is None:
                    acc[k] = [v[1], v[3], v[FLAG_REV]]   # [รายได้, กำไร, รายได้ที่ต้องตรวจสอบ]
                else:
                    a[0] += v[1]; a[1] += v[3]; a[2] += v[FLAG_REV]

        def merge(months: list[str]) -> dict[CustKey, list[float]]:
            acc: dict[CustKey, list[float]] = {}
            for m in months:
                add(acc, m)
            return acc

        def pick(agg: dict[CustKey, list[float]]) -> dict[str, list[int]]:
            # รายการผิดปกติปันตามรายได้แล้ว (23 ก.ย. 2569) ตัวเลขสมเหตุสมผล จึงติดอันดับได้ตามปกติ
            gain = [(p, margin_of(r, p), k) for k, (r, p, _f) in agg.items() if p >= 0]
            loss = [(p, margin_of(r, p), k) for k, (r, p, _f) in agg.items() if p < 0]
            return {
                "gain": [index[k] for _, _, k in heapq.nlargest(TOP_N, gain, key=lambda x: (x[0], x[1]))],
                "loss": [index[k] for _, _, k in heapq.nsmallest(TOP_N, loss, key=lambda x: (x[0], x[1]))],
            }

        months = sorted(by_month)
        years = sorted({m[:4] for m in months})
        mms = sorted({m[5:] for m in months})
        out: dict[str, dict[str, list[int]]] = {"|": pick(merge(months))}
        for y in years:
            out[f"{y}|"] = pick(merge([m for m in months if m[:4] == y]))
        for mm in mms:
            out[f"|{mm}"] = pick(merge([m for m in months if m[5:] == mm]))
        for m in months:
            out[f"{m[:4]}|{m[5:]}"] = pick(merge([m]))
        # ช่วงเดือนในปีเดียว (ตั้งแต่ a ถึง b · a < b · ไม่นับ ม.ค.–ธ.ค. ที่เป็นคีย์ทั้งปีแล้ว) — ต่อยอดทีละเดือน
        # ไม่รวมใหม่ทุกช่วง · ข้ามช่วงที่ยังไม่มีเดือนไหนมีข้อมูล (แอปไม่มีลูกค้าให้โชว์อยู่แล้ว)
        for y in years:
            ym = {m[5:]: m for m in months if m[:4] == y}
            for a in range(1, 13):
                acc: dict[CustKey, list[float]] = {}
                for b in range(a, 13):
                    m = ym.get(f"{b:02d}")
                    if m:
                        add(acc, m)
                    if b > a and acc and not (a == 1 and b == 12):
                        out[f"{y}|{a:02d}-{b:02d}"] = pick(acc)
        return out

    # ---------------- เขียนไฟล์ ----------------
    def write(self, out: Path, manifest: dict, top: dict[str, dict[str, list[int]]],
              bills: list[list]) -> None:
        out.mkdir(parents=True, exist_ok=True)
        order = self.order()                                        # ขาดทุนมากสุดขึ้นก่อน
        index = {k: i for i, k in enumerate(order)}
        rows = [(k, self.cust[k]) for k in order]
        # แปลงรหัสต้นฉบับเป็นเลข CUS ตั้งแต่ตรงนี้ — แดชบอร์ดจะได้ไม่ต้องโหลด custmap.bin 18 MB
        codes = resolve_codes(ROOT, {k[1] for k, _ in rows})
        customers = {
            "side": [k[0] for k, _ in rows],
            "code": [k[1] for k, _ in rows],
            "n": [codes.get(k[1], 0) for k, _ in rows],
            "bills": [int(v[0]) for _, v in rows],
            "revenue": [round(v[1], 2) for _, v in rows],
            "cost": [round(v[2], 2) for _, v in rows],
            "profit": [round(v[3], 2) for _, v in rows],
            "lossBills": [int(v[4]) for _, v in rows],
            **flag_cols([v for _, v in rows]),
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
        # ลูกค้า × เดือน — เรียงตาม (ลูกค้า, เดือน) ให้ diff อ่านง่าย · เดือนว่าง (บิลไม่มีวันที่) ทิ้ง
        mo_index = {m: i for i, m in enumerate(mo_keys)}
        cm = sorted(((index[(s, c)], mo_index[m], v) for (s, c, m), v in self.cust_mo.items() if m),
                    key=lambda x: (x[0], x[1]))
        cust_months = {
            "month": mo_keys,
            "ci": [ci for ci, _, _ in cm],
            "mi": [mi for _, mi, _ in cm],
            "bills": [int(v[0]) for _, _, v in cm],
            "revenue": [round(v[1], 2) for _, _, v in cm],
            "cost": [round(v[2], 2) for _, _, v in cm],
            "profit": [round(v[3], 2) for _, _, v in cm],
            "lossBills": [int(v[4]) for _, _, v in cm],
            **flag_cols([v for _, _, v in cm]),
        }
        bills.sort(key=lambda b: (b[0], b[2], b[1]))
        bills_out = {
            "ci": [b[0] for b in bills],
            "bill": [b[1] for b in bills],
            "date": [b[2] for b in bills],
            "doc": [b[3] for b in bills],
            "route": [b[4] for b in bills],
            "revenue": [round(b[5], 2) for b in bills],
            "cost": [round(b[6], 2) for b in bills],
        }
        manifest["byRevenue"] = {
            "share": REVIEW_SHARE,
            "items": dict(self.flag_items.most_common()),
            "customers": sum(1 for _, v in rows if needs_review(v[1], v[FLAG_REV])),
        }
        manifest["topCustomers"] = len({ci for v in top.values() for ci in v["gain"] + v["loss"]})
        manifest["billsKept"] = len(bills)
        for name, obj in (("manifest.json", manifest), ("customers.json", customers),
                          ("months.json", months), ("unlinked.json", unlinked),
                          ("cust_months.json", cust_months), ("top.json", top),
                          ("bills.json", bills_out)):
            p = out / name
            p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"  {name:16} {p.stat().st_size / 1024:>9,.1f} KB")

    def report(self) -> None:
        print(f"  ลูกค้า {len(self.cust):,} ราย · ต้นทุนเข้าลูกค้า {self.allocated:,.2f} บาท")
        print(f"  รายการ: {dict(self.status.most_common())} · ไม่เชื่อมกัน {self.nl_items:,}")
        if self.flag_items:
            n = sum(1 for v in self.cust.values() if needs_review(v[1], v[FLAG_REV]))
            print(f"  ปันตามรายได้ (น้ำหนัก/ขนาดเชื่อไม่ได้): {dict(self.flag_items.most_common())} · "
                  f"ลูกค้าที่ส่วนใหญ่ปันตามรายได้ {n:,} ราย")
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
            # ข้ามทั้งไฟล์แทนที่จะล้ม — กติกาเดียวกับ build_costrev/loaders/revenue.py
            # (เคสจริง: แปลงรหัสลูกหนี้รวม.xlsx วางอยู่ใน sample_data ด้วย ถ้าล้มจะทำ ETL ทั้งชุดใช้ไม่ได้)
            print(f"  [!] ข้าม {path.name}: ไม่ใช่ไฟล์บิล (ไม่มีคอลัมน์ '{need}')")
            return
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
        it.date = d.isoformat() if d else ""
        it.month = it.date[:7]
        it.extra = {k: (r[i] if 0 <= i < len(r) else None) for k, i in xidx.items()}
        yield it


def measure(it: Item, routes: dict[str, dict[str, float]]) -> None:
    """เติมระยะทาง/ปริมาตร/น้ำหนักที่ใช้คิด (ข้อ 5 ขั้นที่ 1-3)
    ระยะทางที่หาไม่เจอยังเป็น None — ต้องรู้ค่ากลางของทั้งเที่ยวก่อนจึงเติมได้
    """
    it.dist, it.dist_source = lookup_distance(routes, it.origin, it.dest)
    it.cbm = volume_cbm(it)
    it.basis, it.basis_cond = basis_of(it.weight, it.cbm, it.qty)
    it.flag = data_flag(it)


class TripAcc:
    """ตัวสะสมของหนึ่งเที่ยวในรอบแรก — เก็บเท่าที่ต้องใช้หาตัวหาร ไม่เก็บรายการ

    แยกยอดรายการปกติ (norm) กับรายการผิดปกติ (flag) ไว้ เพราะรายการผิดปกติปันตามรายได้แยกก้อน
    (pool_of) ตัวหารของรายการปกติจึงต้องไม่มีภาระงานของรายการผิดปกติปน · ระยะทางค่ากลางยังใช้ทุกรายการ
    """

    __slots__ = ("dists", "norm", "flag")

    def __init__(self) -> None:
        self.dists: Counter[float] = Counter()
        # [ภาระงานที่รู้ระยะทาง, น้ำหนักที่ใช้คิดของรายการที่ไม่รู้ระยะทาง, รายได้, จำนวน, รายการ]
        self.norm = [0.0, 0.0, 0.0, 0.0, 0]
        self.flag = [0.0, 0.0, 0.0, 0.0, 0]

    def add(self, it: Item) -> None:
        a = self.flag if it.flag else self.norm
        a[4] += 1
        a[2] += it.revenue
        a[3] += it.qty
        if it.dist is None:
            a[1] += it.basis
        else:
            self.dists[it.dist] += 1
            a[0] += it.basis * it.dist

    def fill(self) -> float:
        if not self.dists:
            return 1.0
        return float(statistics.median(list(self.dists.elements())))

    def divisor(self) -> tuple[float, str, float, float]:
        """(ตัวหารของรายการปกติ, ตัวถ่วง, สัดส่วนก้อนปันตามรายได้, รายได้ทั้งเที่ยว) — ส่งต่อให้ share_in_trip()"""
        rev_all = self.norm[2] + self.flag[2]
        f = pool_of(rev_all, self.flag[2])
        a = self.norm if f else [x + y for x, y in zip(self.norm, self.flag)]
        total, source = divisor_of(a[0] + a[1] * self.fill(), a[2], a[3], int(a[4]))
        return total, source, f, rev_all


# ================================================================ ปันส่วนจากไฟล์ดิบ
def from_raw(cost_files: list[Path], rev_files: list[Path],
             routes: dict[str, dict[str, float]]) -> tuple[Rollup, dict, dict, list[list]]:
    """คำนวณเองจากไฟล์ดิบด้วยสูตรใน src/alloc.py — เดินไฟล์บิลสองรอบ

    ★ ไม่เก็บรายการไว้ในหน่วยความจำ ข้อมูลจริง 29 ไฟล์ = 5.2 ล้านแถว ถ้าอ่านค้าง
      ทั้งก้อนกิน 5.5 GB (etl/src/loaders/revenue.py:160) รอบแรกสะสมแค่ตัวหารต่อเที่ยว
      รอบสองปันจริงแล้วยุบทันที · วิธีนี้ยังถูกแม้บิลของเที่ยวเดียวกันอยู่คนละไฟล์เดือน
    ★ รอบที่สาม (22 ก.ย. 2569) เดินไฟล์บิลอีกครั้งเพื่อเก็บบิลรายใบ **เฉพาะลูกค้าที่ติด Top 10**
      ของช่วงเวลาใดช่วงหนึ่ง (รู้ได้หลังรอบสองจบเท่านั้น) — อ่านซ้ำถูกกว่าเก็บบิลทุกใบไว้ในหน่วยความจำ
      ระหว่างรอบสอง ซึ่งกับข้อมูลจริงคือบิล ~2 ล้านใบ
    """
    print("อ่านรายงานค่าเดินทาง")
    trip_cost, ttype, bad_cost = load_trips(cost_files)
    print(f"  เที่ยวที่มีต้นทุน {len(trip_cost):,} · แถวที่ช่องต้นทุนไม่ใช่ตัวเลข {bad_cost:,}")

    print("รอบแรก: อ่านไฟล์บิลเพื่อหาตัวหารของแต่ละเที่ยว")
    acc: dict[str, TripAcc] = {}
    docs_in_bills: set[str] = set()
    bill_files: list[Path] = []          # เฉพาะไฟล์ที่เป็นไฟล์บิลจริง — รอบสอง/สามไม่ต้องเปิดไฟล์ที่ข้ามซ้ำ
    for path in rev_files:
        n = 0
        for it in item_reader(path):
            n += 1
            docs_in_bills.add(it.doc)
            if it.doc not in trip_cost:
                continue
            measure(it, routes)
            acc.setdefault(it.doc, TripAcc()).add(it)
        if n:
            bill_files.append(path)
            print(f"  {path.name}: {n:,} รายการ")
    rev_files = bill_files

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
            share = share_in_trip(it, *divisor[it.doc])
            roll.add(it, cost * share, exclusion_of(it, ttype.get(it.doc, "")))
        bills = roll.flush_file()
        print(f"  {path.name}: บิลที่ปันได้ {bills:,}")

    print("จัดอันดับ Top 10 อัตรากำไรต่อช่วงเวลา")
    order = roll.order()
    top = roll.top_by_period({k: i for i, k in enumerate(order)})
    wanted: dict[CustKey, int] = {}
    for v in top.values():
        for ci in v["gain"] + v["loss"]:
            wanted[order[ci]] = ci
    print(f"  ช่วงเวลา {len(top):,} ชุด · ลูกค้าที่ติดอันดับ {len(wanted):,} ราย")

    print("รอบสาม: เก็บบิลรายใบของลูกค้าที่ติดอันดับ")
    bills = collect_bills(rev_files, routes, trip_cost, ttype, divisor, fill_km, from_median, wanted)
    print(f"  บิลที่เก็บ {len(bills):,} ใบ")

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
    return roll, info, top, bills


def collect_bills(rev_files: list[Path], routes: dict[str, dict[str, float]],
                  trip_cost: dict[str, float], ttype: dict[str, str],
                  divisor: dict[str, tuple[float, str, float, float]], fill_km: dict[str, float],
                  from_median: dict[str, bool], wanted: dict[CustKey, int]) -> list[list]:
    """บิลรายใบของลูกค้าใน wanted — ปันต้นทุนซ้ำด้วยตัวหารชุดเดียวกับรอบสอง ผลจึงเท่ากันทุกสตางค์

    คืน [ci, เลขที่บิล, วันที่, เลขที่ใบรายการ, เส้นทาง, รายได้, ต้นทุนจัดสรร] ต่อบิล
    เส้นทาง/วันที่/ใบรายการเอาจากรายการแรกของบิล (บิลหนึ่งใบอยู่ในเที่ยวเดียวและมีวันที่เดียว)
    """
    acc: dict[str, list] = {}
    for path in rev_files:
        for it in item_reader(path):
            cost = trip_cost.get(it.doc)
            if cost is None or exclusion_of(it, ttype.get(it.doc, "")):
                continue
            ci = wanted.get(payer_of(it))
            if ci is None:
                continue
            measure(it, routes)
            if it.dist is None:
                it.dist = fill_km[it.doc]
                it.dist_source = DIST_MEDIAN if from_median[it.doc] else DIST_FALLBACK
            it.workload = it.basis * it.dist
            share = share_in_trip(it, *divisor[it.doc])
            b = acc.get(it.bill)
            if b is None:
                route = f"{it.origin}→{it.dest}" if it.origin and it.dest else it.origin or it.dest or "(ไม่ระบุ)"
                acc[it.bill] = [ci, it.bill, it.date, it.doc, route, it.revenue, cost * share]
            else:
                b[5] += it.revenue
                b[6] += cost * share
    return list(acc.values())


# ================================================================ ประกอบร่าง
def build(dataset: str) -> None:
    if dataset == "real":
        cost_files = xlsx_files(REAL_COST_DIR) if REAL_COST_DIR.exists() else []
        rev_files = xlsx_files(REAL_REV_DIR) if REAL_REV_DIR.exists() else []
    else:
        cost_files = [SAMPLE_COST] if SAMPLE_COST.exists() else []
        rev_files = xlsx_files(SAMPLE_REV_DIR) if SAMPLE_REV_DIR.exists() else []

    if not cost_files:
        sys.exit(f"ไม่มีไฟล์ต้นทุนใน {REAL_COST_DIR if dataset == 'real' else SAMPLE_COST}")
    if not rev_files:
        sys.exit(f"ไม่มีไฟล์บิลใน {REAL_REV_DIR if dataset == 'real' else SAMPLE_REV_DIR}")
    routes: dict[str, dict[str, float]] = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))
    print(f"ตารางระยะทาง {sum(len(v) for v in routes.values()):,} คู่")
    roll, info, top, bills = from_raw(cost_files, rev_files, routes)

    out = OUT_ROOT / dataset / "alloc"
    manifest = {
        "dataset": dataset,
        "isSample": dataset == "sample",
        "generatedAt": datetime.now().replace(microsecond=0).isoformat(),
        **info,
    }
    roll.write(out, manifest, top, bills)
    print(f"เขียน {out.relative_to(ROOT)}  (ที่มา: {info['source']})")
    roll.report()
    c = manifest["cost"]
    print(f"  ต้นทุนที่ปันได้ {c['allocatable']:,.2f} = เข้าลูกค้า {c['toCustomers']:,.2f} "
          f"+ ไม่เข้าลูกค้า {c['notToCustomers']:,.2f}")


def main() -> None:
    utf8_stdout()
    ap = argparse.ArgumentParser(description="กำไรลูกค้าจากการปันส่วนต้นทุนเที่ยวรถ → JSON")
    ap.add_argument("--dataset", choices=["sample", "real"], default="real")
    a = ap.parse_args()
    build(a.dataset)


if __name__ == "__main__":
    main()
