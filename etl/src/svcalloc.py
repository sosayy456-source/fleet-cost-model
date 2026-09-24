"""ปันต้นทุนเที่ยวรถเข้ากลุ่มบริการ — ใช้วิธี ค (ภาระงาน × ระยะทาง) ชุดเดียวกับ src/alloc.py

กลุ่มบริการ = ประเภทสินค้าของบิลรายได้ ("บิลเคลียร์" เป็นกลุ่มของตัวเอง เพราะยังรับต้นทุนตามภาระงาน
เหมือนกติกาใน alloc.py — ถ้าตัดออกแล้วหารใหม่ กลุ่มอื่นจะรับต้นทุนสูงขึ้นเงียบ ๆ)

    ต้นทุนของกลุ่ม = ต้นทุนเที่ยว × (ภาระงานของกลุ่ม ÷ ภาระงานรวมทั้งเที่ยว)
    รายได้ของกลุ่ม = รายได้เที่ยว × (ยอดบิลของกลุ่ม ÷ ยอดบิลรวมทั้งเที่ยว)

★ รายได้เที่ยวมาจากไฟล์ต้นทุน (ราคารวมจากรายได้) ไม่จำเป็นต้องเท่ายอดบิลรวม จึงปันตามสัดส่วนยอดบิล
  เพื่อให้ Σ รายได้ทุกกลุ่ม = รายได้เที่ยว และ Σ กำไรทุกกลุ่ม = กำไรเที่ยว เสมอ (ตรงกับแท็บกำไรรายเที่ยว)
  ถ้ายอดบิลรวมเป็น 0 ใช้สัดส่วนตัวถ่วงเดียวกับต้นทุนแทน
★ ไม่เก็บรายการสินค้าไว้ในหน่วยความจำ — สะสมเป็นก้อนเล็กต่อ (ใบรายการ, กลุ่ม) ข้อมูลจริง ~2 ล้านแถว
  ค่าตัวถ่วงต้องรู้ระยะทางกลางของทั้งเที่ยวก่อน (รายการที่หาระยะทางไม่เจอ) จึงเก็บภาระงานแยก
  "รู้ระยะทาง" กับ "ไม่รู้" แล้วค่อยเติมตอนปิดงาน — วิธีเดียวกับ TripAcc ใน build_alloc.py
"""
from __future__ import annotations

import statistics
from collections import Counter

from .alloc import (Item, W_QTY, W_REVENUE, W_WORKLOAD, basis_of, divisor_of,
                    lookup_distance, volume_cbm)

NO_GROUP = "ไม่ระบุ"


class _Grp:
    __slots__ = ("wl_known", "basis_unknown", "revenue", "qty", "n")

    def __init__(self) -> None:
        self.wl_known = 0.0
        self.basis_unknown = 0.0
        self.revenue = 0.0
        self.qty = 0.0
        self.n = 0


class SvcAlloc:
    def __init__(self, routes: dict[str, dict[str, float]]) -> None:
        self.routes = routes
        self.groups: dict[str, dict[str, _Grp]] = {}
        self.dists: dict[str, Counter] = {}

    def add(self, it: Item) -> None:
        """รับรายการสินค้า 1 แถว (ต้องเป็นใบที่มีในไฟล์ต้นทุนเท่านั้น — ผู้เรียกกรองมาแล้ว)"""
        dist, _ = lookup_distance(self.routes, it.origin, it.dest)
        basis, _ = basis_of(it.weight, volume_cbm(it), it.qty)
        g = self.groups.setdefault(it.doc, {}).setdefault(it.goods.strip() or NO_GROUP, _Grp())
        g.n += 1
        g.revenue += it.revenue
        g.qty += it.qty
        if dist is None:
            g.basis_unknown += basis
        else:
            g.wl_known += basis * dist
            self.dists.setdefault(it.doc, Counter())[dist] += 1

    def finalize(self, doc: str, cost: float, revenue: float) -> list[tuple[str, int, float, float]]:
        """คืน [(กลุ่ม, จำนวนรายการ, รายได้ที่ปัน, ต้นทุนที่ปัน)] ของใบนี้ — ไม่มีบิลของใบนี้คืนลิสต์ว่าง"""
        gs = self.groups.get(doc)
        if not gs:
            return []
        dc = self.dists.get(doc)
        fill = float(statistics.median(list(dc.elements()))) if dc else 1.0
        wl = {k: g.wl_known + g.basis_unknown * fill for k, g in gs.items()}
        total, source = divisor_of(sum(wl.values()), sum(g.revenue for g in gs.values()),
                                   sum(g.qty for g in gs.values()), sum(g.n for g in gs.values()))

        def w(k: str) -> float:
            g = gs[k]
            if source == W_WORKLOAD:
                return wl[k]
            if source == W_REVENUE:
                return g.revenue
            if source == W_QTY:
                return g.qty
            return float(g.n)          # W_EQUAL: รายการละเท่ากัน

        bill_sum = sum(g.revenue for g in gs.values())
        out = []
        for k, g in gs.items():
            cshare = w(k) / total if total > 0 else 0.0
            rshare = g.revenue / bill_sum if bill_sum > 0 else cshare
            out.append((k, g.n, revenue * rshare, cost * cshare))
        return out
