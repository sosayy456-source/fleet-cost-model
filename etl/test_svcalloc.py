"""
เทสต์ปันต้นทุนเข้ากลุ่มบริการ (src/svcalloc.py)

หลักตรวจ: ผลรวมของกลุ่มต้องเท่ากับที่ allocate_trip() (ตัวเต็มใน src/alloc.py) ปันให้รายการเดียวกัน
เพราะสองทางต้องใช้วิธี ค ชุดเดียวกัน — ถ้าเลขต่างกันแสดงว่ากฎสำรอง/ค่ากลางระยะทางเพี้ยนไปจากกัน
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.alloc import Item, allocate_trip
from src.svcalloc import NO_GROUP, SvcAlloc

ROUTES = json.loads((Path(__file__).resolve().parent.parent / "app" / "src" / "lib" / "refdata" / "routes.json")
                    .read_text(encoding="utf-8"))
DOC = "5240111503464"


def item(goods: str, weight: float, revenue: float, dest: str = "ปากคลองตลาด", qty: float = 1) -> Item:
    return Item(doc=DOC, bill="B", origin="เชียงใหม่", dest=dest, weight=weight, qty=qty,
                revenue=revenue, goods=goods)


def run(items: list[Item], cost: float, rev: float):
    s = SvcAlloc(ROUTES)
    for it in items:
        s.add(it)
    return {g: (n, r, c) for g, n, r, c in s.finalize(DOC, cost, rev)}


def test_ผลรวมกลุ่มเท่าต้นทุนและรายได้เที่ยว():
    out = run([item("สินค้าทั่วไป", 500, 800), item("สินค้าแช่เย็น", 200, 400), item("สินค้าทั่วไป", 300, 300)],
              cost=10_000, rev=1_600)
    assert sum(c for _, _, c in out.values()) == pytest.approx(10_000)
    assert sum(r for _, r, _ in out.values()) == pytest.approx(1_600)
    assert out["สินค้าทั่วไป"][0] == 2


def test_ตรงกับ_allocate_trip():
    items = [item("A", 500, 800), item("B", 200, 400), item("A", 300, 300, dest="ที่ไม่มีในตาราง")]
    ref = allocate_trip([item("A", 500, 800), item("B", 200, 400), item("A", 300, 300, dest="ที่ไม่มีในตาราง")],
                        10_000, ROUTES)
    want: dict[str, float] = {}
    for it in ref.items:
        want[it.goods] = want.get(it.goods, 0.0) + (it.alloc or 0.0)
    got = run(items, 10_000, 1_500)
    for g, v in want.items():
        assert got[g][2] == pytest.approx(v)


def test_ไม่มีน้ำหนักใช้ตัวถ่วงสำรองแล้วยังปันครบ():
    out = run([item("A", 0, 100, qty=0), item("B", 0, 300, qty=0)], cost=1_000, rev=400)
    assert out["A"][2] == pytest.approx(250)
    assert out["B"][2] == pytest.approx(750)


def test_ประเภทสินค้าว่างเป็นไม่ระบุ_และใบที่ไม่มีบิลคืนว่าง():
    s = SvcAlloc(ROUTES)
    s.add(item("", 100, 50))
    assert [g for g, *_ in s.finalize(DOC, 10, 50)] == [NO_GROUP]
    assert s.finalize("ไม่มีใบนี้", 10, 50) == []


def test_ยอดบิลรวมเป็นศูนย์ปันรายได้ตามตัวถ่วงต้นทุน():
    out = run([item("A", 100, 0), item("B", 300, 0)], cost=400, rev=200)
    assert out["A"][1] == pytest.approx(50)
    assert out["B"][1] == pytest.approx(150)
