"""
เทสต์คีย์ของ top.json (Rollup.top_by_period ใน build_alloc.py) — ตัวกรองของแอปเป็น ปี + ช่วงเดือน (24 ก.ย. 2569)
คีย์ต้องตรงกับ allocTopKey() ใน app/src/lib/data/useAlloc.ts
"""
from __future__ import annotations

from types import SimpleNamespace

from build_alloc import Rollup, canonical_groups, cust_key, keep_recent_bills, side_label


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
    assert top["2026|04-05"]["gain"] == [1]
    assert top["2026|04-05"]["loss"] == [2]
    assert top["2026|04-05"]["margin"][0] == [2]
    # คีย์เดิมยังอยู่ · ม.ค.–ธ.ค. ใช้คีย์ทั้งปี ไม่ซ้ำ · ช่วงที่ไม่มีเดือนไหนมีข้อมูลไม่ออกคีย์
    assert "2026|" in top and "2026|03" in top and "|03" in top and "|" in top
    assert "2026|01-12" not in top
    assert "2026|06-12" not in top


def test_top_100_and_margin_10_use_profit_baht() -> None:
    rows = [(f"G{i:03}", "2026-01", float(i)) for i in range(1, 112)]
    rows += [(f"L{i:03}", "2026-01", -float(i)) for i in range(1, 112)]
    roll = _roll(rows)
    index = {("ผู้ส่ง", code): i for i, (code, _, _) in enumerate(rows)}
    top = roll.top_by_period(index)["2026|01"]
    assert len(top["gain"]) == len(top["loss"]) == 100
    assert top["gain"][0] == index[("ผู้ส่ง", "G111")]
    assert top["loss"][0] == index[("ผู้ส่ง", "L111")]
    assert len(top["margin"]) == 8
    assert top["margin"][0][0] == index[("ผู้ส่ง", "L111")]
    assert top["margin"][4][0] == index[("ผู้ส่ง", "G019")]
    assert all(len(bucket) <= 10 for bucket in top["margin"])


def test_detail_keeps_latest_100_bills_per_customer_per_month() -> None:
    kept = {}
    jan = [[0, f"B{i:03}", "2026-01-15", "D", "R", 100, 50] for i in range(120)]
    feb = [[0, "F001", "2026-02-01", "D", "R", 100, 50]]
    other = [[1, "O001", "2026-01-01", "D", "R", 100, 50]]
    seq = keep_recent_bills(kept, jan[:60] + feb + other, 0)
    keep_recent_bills(kept, jan[60:], seq)
    assert len(kept[(0, "2026-01")]) == 100
    assert {entry[3][1] for entry in kept[(0, "2026-01")]} == {f"B{i:03}" for i in range(20, 120)}
    assert len(kept[(0, "2026-02")]) == len(kept[(1, "2026-01")]) == 1


def test_same_payer_as_sender_and_receiver_is_one_customer() -> None:
    """รายเดียวกันจ่ายทั้งฐานะผู้ส่งและผู้รับ = ลูกค้าแถวเดียว (เจ้าของงานสั่ง 28 ก.ย. 2569 — เดิมแยกสองแถว)"""
    as_sender = SimpleNamespace(payment="สดต้นทาง", sender="X", receiver="Y")
    as_receiver = SimpleNamespace(payment="เชื่อปลายทาง", sender="Z", receiver="X")
    assert cust_key(as_sender) == cust_key(as_receiver) == ("", "X")
    assert side_label({"ผู้รับ", "ผู้ส่ง"}) == "ผู้ส่ง+ผู้รับ"
    assert side_label({"ผู้รับ"}) == "ผู้รับ"


def test_hash_and_cus_text_of_same_customer_merge() -> None:
    """ไฟล์บิลเขียนรายเดียวกันเป็น hash (แปลงได้เลข 21745) บ้าง ข้อความ CUS0021745 บ้าง = ลูกค้ารายเดียว ตัวแทน = hash"""
    h = "a" * 64
    alias, nums = canonical_groups([h, "CUS0021745", "cus0000009", "b" * 64], {h: 21745})
    assert alias[h] == alias["CUS0021745"] == h
    assert nums[h] == 21745
    assert alias["cus0000009"] == "cus0000009" and nums["cus0000009"] == 9
    assert alias["b" * 64] == "b" * 64 and "b" * 64 not in nums     # ไม่มีเลข = อยู่คนเดียว


def test_rollup_canonicalize_sums_rows_and_sides() -> None:
    r = Rollup()
    h = "c" * 64
    r.cust[("", h)][1] += 100.0; r.cust[("", h)][3] += -10.0
    r.cust[("", "CUS0000005")][1] += 50.0; r.cust[("", "CUS0000005")][3] += -5.0
    r.cust_mo[("", h, "2026-01")][1] += 100.0
    r.cust_mo[("", "CUS0000005", "2026-01")][1] += 50.0
    r.sides[h].add("ผู้ส่ง"); r.sides["CUS0000005"].add("ผู้รับ")
    alias = r.canonicalize(lambda _codes: {h: 5})
    assert list(r.cust) == [("", h)]
    assert r.cust[("", h)][1] == 150.0 and r.cust[("", h)][3] == -15.0
    assert r.cust_mo[("", h, "2026-01")][1] == 150.0
    assert side_label(r.sides[h]) == "ผู้ส่ง+ผู้รับ"
    assert alias["CUS0000005"] == h and r.numbers[h] == 5
