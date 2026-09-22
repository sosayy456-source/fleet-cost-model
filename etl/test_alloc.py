"""
เทสต์เครื่องปันส่วนต้นทุน (src/alloc.py) — เทียบกับตัวเลขในเอกสาร Cost Allocation Spec

เคสหลักคือตัวอย่างข้อ 7.1 ที่เอกสารให้ตัวเลขไว้ครบทุกขั้น:
    เที่ยว 5240111503464 เชียงใหม่ → ปากคลองตลาด ต้นทุนเที่ยว 10,920 บาท
    กะหล่ำปลีแช่เย็น 36x55x32 cm × 10 ก๋วย · น้ำหนักรวม 160 กก. · ราคารวม 430 บาท
    → D 720 · V 0.6336 · B 0.16 (เงื่อนไข 1) · Workload 115.2
    → สัดส่วน 0.02676345 · ต้นทุนจัดสรร 292.26 · กำไร 137.74

ระยะทางใช้ refdata/routes.json ของแอปจริง (326 คู่) ไม่ได้ hardcode ตัวเลขในเทสต์
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.alloc import (
    DIST_EXACT,
    DIST_FALLBACK,
    DIST_MEDIAN,
    DIST_REVERSED,
    DROPPED_TRIP_TYPES,
    EMPTY_TRIP_TYPES,
    NOT_LINKED,
    Item,
    allocate_trip,
    basis_of,
    is_number,
    lookup_distance,
    num,
    payer_of,
    status_of,
    txt,
    volume_cbm,
)

ROUTES_JSON = Path(__file__).resolve().parent.parent / "app" / "src" / "lib" / "refdata" / "routes.json"
ROUTES: dict[str, dict[str, float]] = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))

DOC = "5240111503464"
TRIP_COST = 10920.0


def cabbage() -> Item:
    """รายการตามตัวอย่างข้อ 7.1 — ไม่มีช่องขนาด ต้องดึงขนาดจากชื่อสินค้า"""
    return Item(doc=DOC, bill="1124010000023", origin="เชียงใหม่", dest="ปากคลองตลาด",
                weight=160.0, qty=10.0, name="กะหล่ำปลีแช่เย็น 36x55x32 cm",
                revenue=430.0, payment="เชื่อต้นทาง", sender="S1", receiver="R1")


def test_ระยะทางจากตารางจริง():
    km, src = lookup_distance(ROUTES, "เชียงใหม่", "ปากคลองตลาด")
    assert (km, src) == (720.0, DIST_EXACT)


def test_ปริมาตรจากชื่อสินค้า():
    assert volume_cbm(cabbage()) == pytest.approx(0.6336)


def test_น้ำหนักที่ใช้คิดและเงื่อนไขที่ใช้():
    it = cabbage()
    it.cbm = volume_cbm(it)
    b, cond = basis_of(it.weight, it.cbm, it.qty)
    assert cond == 1                       # น้ำหนัก+ปริมาตร (MAX)
    assert b == pytest.approx(0.16)        # max(0.16, 0.6336 × 0.167 = 0.1058)


def test_ภาระงานและต้นทุนจัดสรรตรงกับเอกสาร():
    """ประกอบเที่ยวให้ภาระงานรวมได้สัดส่วน 0.02676345 ตามที่เอกสารระบุ แล้วเทียบยอด"""
    target_share = 0.02676345
    total_workload = 115.2 / target_share
    other_workload = total_workload - 115.2
    other = Item(doc=DOC, bill="1124010000099", origin="เชียงใหม่", dest="ปากคลองตลาด",
                 weight=other_workload / 720 * 1000, qty=1.0, revenue=0.0)

    it = cabbage()
    res = allocate_trip([it, other], TRIP_COST, ROUTES)

    assert it.dist == 720.0
    assert it.workload == pytest.approx(115.2)
    assert it.share == pytest.approx(target_share, abs=1e-8)
    assert it.alloc == pytest.approx(292.26, abs=0.01)
    assert it.profit == pytest.approx(137.74, abs=0.01)
    assert status_of(it.profit) == "กำไร"
    # ขั้นที่ 5: ผลรวมต้นทุนจัดสรรของทุกรายการต้องเท่าต้นทุนเที่ยวพอดี
    assert sum(x.alloc for x in res.items) == pytest.approx(TRIP_COST)
    assert res.allocated == pytest.approx(TRIP_COST)
    assert res.unallocated == 0.0


class TestระยะทางTests:
    def test_สลับทิศ(self):
        km, src = lookup_distance(ROUTES, "ปากคลองตลาด", "เชียงใหม่")
        assert km == 720.0 and src == DIST_REVERSED

    def test_ไม่มีในตารางใช้ค่ากลางของเที่ยว(self):  # noqa: N802
        a = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=1000, qty=1)
        b = Item(doc="T", bill="b2", origin="ดาวอังคาร", dest="ดาวพฤหัส", weight=1000, qty=1)
        allocate_trip([a, b], 100.0, ROUTES)
        assert b.dist == 720.0 and b.dist_source == DIST_MEDIAN

    def test_ทั้งเที่ยวไม่มีระยะทางใช้หนึ่ง(self):  # noqa: N802
        a = Item(doc="T", bill="b1", origin="ดาวอังคาร", dest="ดาวพฤหัส", weight=1000, qty=1)
        allocate_trip([a], 100.0, ROUTES)
        assert a.dist == 1.0 and a.dist_source == DIST_FALLBACK


class Testปริมาตร:
    def test_ใช้ช่องขนาดก่อนชื่อสินค้า(self):  # noqa: N802
        it = Item(doc="T", bill="b", width=100, length=100, height=100, qty=2,
                  name="ของอะไรก็ไม่รู้ 10x10x10 cm")
        assert volume_cbm(it) == pytest.approx(2.0)     # 1 ลบ.ม. × 2

    def test_ด้านเกินพันเซนติเมตรถือว่ากรอกผิด(self):  # noqa: N802
        it = Item(doc="T", bill="b", width=100, length=6080, height=100, qty=1)
        assert volume_cbm(it) == 0.0                    # ข้อ 10.5

    def test_ไม่มีขนาดเลยได้ศูนย์(self):  # noqa: N802
        assert volume_cbm(Item(doc="T", bill="b", qty=5, name="ผักกาด")) == 0.0


class Testเงื่อนไขน้ำหนัก:
    def test_น้ำหนักอย่างเดียว(self):  # noqa: N802
        assert basis_of(2500, 0, 3) == (2.5, 2)

    def test_ปริมาตรอย่างเดียวต้องคูณศูนย์จุดหนึ่งหกเจ็ด(self):  # noqa: N802
        # ข้อ 10.1 — โค้ดเดิมไม่คูณ ทำให้รายการกลุ่มนี้รับต้นทุนเกินราว 6 เท่า
        b, cond = basis_of(0, 10, 3)
        assert cond == 3 and b == pytest.approx(1.67)

    def test_ไม่มีทั้งน้ำหนักและปริมาตรใช้จำนวนหน่วย(self):  # noqa: N802
        assert basis_of(0, 0, 7) == (7, 4)


class Testตัวถ่วงสำรอง:
    """ข้อ 10.3 — ต้นทุนเที่ยวต้องถูกปันครบเสมอ ไม่มี #DIV/0!"""

    def test_ภาระงานศูนย์ถอยไปใช้ราคารวม(self):  # noqa: N802
        a = Item(doc="T", bill="b1", origin="x", dest="y", revenue=300)
        b = Item(doc="T", bill="b2", origin="x", dest="y", revenue=100)
        res = allocate_trip([a, b], 400.0, ROUTES)
        assert res.weights_from == "ราคารวม"
        assert (a.alloc, b.alloc) == (300.0, 100.0)

    def test_ราคารวมศูนย์ถอยไปใช้จำนวน(self):  # noqa: N802
        a = Item(doc="T", bill="b1", qty=0)
        b = Item(doc="T", bill="b2", qty=0)
        res = allocate_trip([a, b], 500.0, ROUTES)
        assert res.weights_from == "หารเท่ากัน"
        assert a.alloc == b.alloc == 250.0


class Testข้อมูลไม่เชื่อมกัน:
    def test_ไม่มีต้นทุนเที่ยวแถวยังอยู่แต่ไม่มียอด(self):  # noqa: N802
        it = cabbage()
        res = allocate_trip([it], None, ROUTES)
        assert res.cost is None
        assert it.workload == pytest.approx(115.2)      # คำนวณภาระงานให้ครบ
        assert it.share is None and it.alloc is None and it.profit is None
        assert status_of(it.profit) == NOT_LINKED

    def test_รู้ว่าช่องต้นทุนไม่ใช่ตัวเลข(self):  # noqa: N802
        """is_number ยังแยก "-" ออกได้ แต่ **ไม่ได้ใช้ตัดเที่ยวทิ้งแล้ว**

        เจ้าของงานสั่งให้ตี "-" เป็น 0 แล้วเชื่อมเที่ยวต่อ (20 ก.ย. 2569)
        ตอนนี้ค่าที่คืนมาใช้แค่นับจำนวนแถวลง manifest.zeroCost
        """
        assert is_number("-") is False and is_number("") is False
        assert is_number("1,234.5") is True and num("1,234.5") == 1234.5
        assert num("-") == 0.0        # ตัวที่ build_alloc ใช้จริงตอนบวกต้นทุน


class Testลูกค้าคือผู้จ่ายเงิน:
    @pytest.mark.parametrize("pay,expect", [
        ("สดต้นทาง", ("ผู้ส่ง", "S1")),
        ("เชื่อต้นทาง", ("ผู้ส่ง", "S1")),
        ("สดปลายทาง", ("ผู้รับ", "R1")),
        ("เชื่อปลายทาง", ("ผู้รับ", "R1")),
        ("อย่างอื่น", ("", "")),
    ])
    def test_แยกตามประเภทการชำระเงิน(self, pay, expect):  # noqa: N802
        it = cabbage()
        it.payment = pay
        assert payer_of(it) == expect

    def test_ช่องว่างท้ายค่าไม่ทำให้พลาด(self):  # noqa: N802
        it = cabbage()
        it.payment = "สดปลายทาง" + " " * 90     # ไฟล์จริง pad ช่องว่างแบบนี้
        assert payer_of(it) == ("ผู้รับ", "R1")


class Testรายการที่ตัดออก:
    def test_บิลเคลียร์ไม่นับเป็นลูกค้าแต่ยังรับต้นทุนของตัวเอง(self):  # noqa: N802
        a = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด",
                 weight=8000, qty=1, revenue=5000, goods="ผักสด")
        b = Item(doc="T", bill="b2", origin="เชียงใหม่", dest="ปากคลองตลาด",
                 weight=2000, qty=1, revenue=100, goods="บิลเคลียร์")
        res = allocate_trip([a, b], 10000.0, ROUTES)
        assert b.excluded == "บิลเคลียร์" and a.excluded == ""
        assert a.alloc == pytest.approx(8000.0)          # ไม่ถูกบวกส่วนของบิลเคลียร์ทับ
        assert res.allocated == pytest.approx(8000.0)
        assert res.unallocated == pytest.approx(2000.0)
        assert res.allocated + res.unallocated == pytest.approx(10000.0)

    def test_รถว่างไปสาขาตัดทั้งเที่ยว(self):  # noqa: N802
        """ยังรับต้นทุนของตัวเองแต่ไม่ปันเข้าลูกค้า — เจ้าของงานยืนยันให้คงไว้ 20 ก.ย. 2569"""
        a = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=100, qty=1)
        res = allocate_trip([a], 3000.0, ROUTES, trip_type="รถว่างไปสาขา")
        assert a.excluded == "รถว่างไปสาขา"
        assert res.allocated == 0.0 and res.unallocated == pytest.approx(3000.0)

    def test_ของเหมาตีเปล่าไม่ใช่หน้าที่ของallocate_tripแล้ว(self):  # noqa: N802
        """ถูกตัดทิ้งตั้งแต่ตอนอ่านไฟล์ (DROPPED_TRIP_TYPES) จึงไม่มีทางมาถึงตรงนี้

        ★ ถ้าหลุดมาได้ แปลว่าตัวกรองใน build_costrev.py/build_alloc.py หายไปข้างหนึ่ง
          แล้วตัวเลขลูกค้าสองแท็บจะไม่ตรงกันอีก
        """
        assert "ของเหมาตีเปล่า" in DROPPED_TRIP_TYPES
        assert "ของเหมาตีเปล่า" not in EMPTY_TRIP_TYPES
        assert "รถว่างไปสาขา" in EMPTY_TRIP_TYPES and "รถว่างไปสาขา" not in DROPPED_TRIP_TYPES


class Testอ่านค่าจากเซลล์:
    def test_ตัดจุดศูนย์ท้ายเลขที่ใบรายการ(self):  # noqa: N802
        assert txt(6250753132426.0) == "6250753132426"

    def test_ตัดช่องว่างหน้าหลัง(self):  # noqa: N802
        assert txt("  สด ต้นทาง   ") == "สด ต้นทาง"


# ================================================================ ยุบก้อนเป็นรายลูกค้า
# ไฟล์สามตัวของแท็บ "กำไรลูกค้า" (custindex / custmonths / topbills) ถูกคัดมาจากตัวสะสม
# ชุดเดียวกับ customers.json จึงต้อง "ปิดยอด" กับมันเสมอ เทสต์กลุ่มนี้คือด่านที่จับได้ว่า
# การยุบฝ่ายผู้จ่าย มิติเดือน หรือการคัด 20 รายทำข้อมูลหายไประหว่างทางหรือเปล่า
from build_alloc import TOP_N, Rollup  # noqa: E402


def บิล(doc, bill, code, payment="สดต้นทาง", revenue=100.0, month="2026-01",  # noqa: N802,N803
        origin="เชียงใหม่", dest="ลำปาง"):
    return Item(doc=doc, bill=bill, sender=code, receiver=code, payment=payment,
                revenue=revenue, month=month, origin=origin, dest=dest)


def ยุบ(items_allocs):  # noqa: N802
    """ป้อนรายการแล้วคืนผลของ by_customer() เหมือนที่ write() เรียกจริง"""
    r = Rollup()
    for it, alloc in items_allocs:
        r.add(it, alloc, "")
    r.flush_file()
    rows = sorted(r.cust.items(), key=lambda kv: kv[1][3])
    mo_keys = sorted(k for k in r.months if k)
    ci, cm, tb, bc = r.by_customer(rows, {}, mo_keys)
    return r, ci, cm, tb, bc


class Testยุบฝ่ายผู้จ่าย:
    def test_ลูกค้าที่เป็นทั้งผู้ส่งและผู้รับเหลือแถวเดียว(self):  # noqa: N802
        _, ci, _, _, _ = ยุบ([
            (บิล("T1", "b1", "AAA", "สดต้นทาง", 300.0), 100.0),
            (บิล("T1", "b2", "AAA", "สดปลายทาง", 700.0), 200.0),
        ])
        assert ci["code"] == ["AAA"]
        assert ci["sides"] == [1 | 2]            # เป็นทั้งสองฝ่าย
        assert ci["bills"] == [2]                # 1 บิลอยู่ฝ่ายเดียวเสมอ จึงไม่นับซ้ำ
        assert ci["revenue"] == [1000.0] and ci["cost"] == [300.0]
        assert ci["profit"] == [700.0]

    def test_ฝ่ายเดียวได้บิตเดียว(self):  # noqa: N802
        _, ci, _, _, _ = ยุบ([(บิล("T1", "b1", "AAA", "เชื่อปลายทาง"), 10.0)])
        assert ci["sides"] == [2]

    def test_เรียงขาดทุนมากสุดขึ้นก่อนเหมือนcustomers(self):  # noqa: N802
        _, ci, _, _, _ = ยุบ([
            (บิล("T1", "b1", "กำไร", revenue=900.0), 100.0),
            (บิล("T1", "b2", "ขาดทุน", revenue=100.0), 900.0),
        ])
        assert ci["code"] == ["ขาดทุน", "กำไร"]


class Testมิติเดือน:
    def test_แยกเดือนแล้วรวมกลับได้เท่าเดิม(self):  # noqa: N802
        _, ci, cm, _, bc = ยุบ([
            (บิล("T1", "b1", "AAA", month="2026-01", revenue=100.0), 10.0),
            (บิล("T1", "b2", "AAA", month="2026-02", revenue=200.0), 20.0),
            (บิล("T1", "b3", "AAA", month="2026-02", revenue=300.0), 30.0),
        ])
        assert cm["ci"] == [0, 0] and cm["mi"] == [0, 1]
        assert cm["bills"] == [1, 2]
        assert cm["revenue"] == [100.0, 500.0]
        assert sum(cm["revenue"]) == ci["revenue"][0]
        assert sum(cm["cost"]) == ci["cost"][0]
        assert sum(cm["bills"]) == ci["bills"][0]
        assert bc["noMonth"]["bills"] == 0

    def test_บิลที่ไม่มีเดือนไม่หายเงียบแต่ไปอยู่ในnoMonth(self):  # noqa: N802
        _, ci, cm, _, bc = ยุบ([
            (บิล("T1", "b1", "AAA", month="", revenue=100.0), 10.0),
            (บิล("T1", "b2", "AAA", month="2026-02", revenue=200.0), 20.0),
        ])
        assert bc["noMonth"] == {"bills": 1, "revenue": 100.0, "cost": 10.0}
        assert sum(cm["revenue"]) + bc["noMonth"]["revenue"] == ci["revenue"][0]

    def test_นับบิลที่ขาดทุนแยกรายเดือน(self):  # noqa: N802
        _, ci, cm, _, _ = ยุบ([
            (บิล("T1", "b1", "AAA", month="2026-01", revenue=10.0), 900.0),
            (บิล("T1", "b2", "AAA", month="2026-02", revenue=900.0), 10.0),
        ])
        assert cm["lossBills"] == [1, 0]
        assert sum(cm["lossBills"]) == ci["lossBills"][0]


class Testรายการบิลของรายที่กดดูได้:
    def test_เก็บบิลเฉพาะรายที่อยู่ในdrill(self):  # noqa: N802
        # ลูกค้า 30 ราย กำไรไล่ขึ้น -> drill ต้องได้ 10 หัว + 10 ท้าย และบิลมีเฉพาะของพวกนั้น
        items = [(บิล("T1", f"b{i}", f"C{i:02d}", revenue=float(i) * 100), 500.0)
                 for i in range(30)]
        _, ci, _, tb, bc = ยุบ(items)
        assert len(ci["code"]) == 30
        assert ci["drill"] == list(range(TOP_N)) + list(range(30 - TOP_N, 30))
        assert sorted(set(tb["ci"])) == ci["drill"]
        assert bc["drillBills"] == len(tb["ci"]) == 2 * TOP_N

    def test_ยอดบิลปิดกับยอดรายลูกค้า(self):  # noqa: N802
        _, ci, _, tb, _ = ยุบ([
            (บิล("T1", "b1", "AAA", revenue=100.0), 10.0),
            (บิล("T1", "b2", "AAA", revenue=200.0), 20.0),
        ])
        assert sum(tb["revenue"]) == ci["revenue"][0]
        assert sum(tb["cost"]) == ci["cost"][0]
        assert len(tb["ci"]) == ci["bills"][0]

    def test_ลูกค้าน้อยกว่าสองเท่าของTOPไม่ซ้ำ(self):  # noqa: N802
        _, ci, _, _, _ = ยุบ([(บิล("T1", f"b{i}", f"C{i}"), 10.0) for i in range(3)])
        assert ci["drill"] == [0, 1, 2]           # ไม่ใช่ [0,1,2,0,1,2]

    def test_ชื่อสถานที่เก็บครั้งเดียวแล้วอ้างด้วยดัชนี(self):  # noqa: N802
        _, _, _, tb, _ = ยุบ([
            (บิล("T1", "b1", "AAA", origin="เชียงใหม่", dest="ลำปาง"), 10.0),
            (บิล("T1", "b2", "AAA", origin="เชียงใหม่", dest="ลำพูน"), 10.0),
        ])
        assert tb["place"] == ["เชียงใหม่", "ลำปาง", "ลำพูน"]
        assert tb["o"] == [0, 0] and tb["d"] == [1, 2]

    def test_เลขที่บิลคงรูปเดิมแม้ไม่ใช่ตัวเลข(self):  # noqa: N802
        _, _, _, tb, _ = ยุบ([
            (บิล("T1", "1126010002014", "AAA"), 10.0),
            (บิล("T1", "INV-00A", "AAA"), 10.0),
        ])
        assert sorted(tb["bill"]) == ["1126010002014", "INV-00A"]
