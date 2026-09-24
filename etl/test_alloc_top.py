"""
เทสต์คีย์ของ top.json (Rollup.top_by_period ใน build_alloc.py) — ตัวกรองของแอปเป็น ปี + ช่วงเดือน (24 ก.ย. 2569)
คีย์ต้องตรงกับ allocTopKey() ใน app/src/lib/data/useAlloc.ts
"""
from __future__ import annotations

from build_alloc import Rollup


def _roll(rows: list[tuple[str, str, float]]) -> Rollup:
    """rows = (รหัสลูกค้า, เดือน, กำไร) · รายได้ = 100 ทุกแถว"""
    r = Rollup()
    for code, month, profit in rows:
        v = r.cust_mo[("ผู้ส่ง", code, month)]
        v[1] += 100.0
        v[3] += profit
        r.cust[("ผู้ส่ง", code)]
    return r


def test_range_keys_sum_months_in_range() -> None:
    roll = _roll([
        ("A", "2026-01", 500.0),
        ("B", "2026-03", 300.0), ("B", "2026-04", 300.0),    # รวม มี.ค.–เม.ย. = 600 ชนะ A ในช่วงนั้น
        ("C", "2026-05", -50.0),
    ])
    index = {("ผู้ส่ง", c): i for i, c in enumerate("ABC")}
    top = roll.top_by_period(index)
    assert top["2026|03-04"]["gain"] == [1]
    assert top["2026|01-04"]["gain"] == [1, 0]                # B 600 · A 500
    assert top["2026|04-05"] == {"gain": [1], "loss": [2]}
    # คีย์เดิมยังอยู่ · ม.ค.–ธ.ค. ใช้คีย์ทั้งปี ไม่ซ้ำ · ช่วงที่ไม่มีเดือนไหนมีข้อมูลไม่ออกคีย์
    assert "2026|" in top and "2026|03" in top and "|03" in top and "|" in top
    assert "2026|01-12" not in top
    assert "2026|06-12" not in top
