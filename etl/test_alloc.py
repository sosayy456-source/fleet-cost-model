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

from src.alloc import FLAG_NO_SIZE, FLAG_OVERSIZE

from src.alloc import (
    DIST_EXACT,
    DIST_FALLBACK,
    DIST_MEDIAN,
    DIST_REVERSED,
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

    def test_ช่องต้นทุนขีดกลางไม่ใช่ศูนย์(self):  # noqa: N802
        assert is_number("-") is False and is_number("") is False
        assert is_number("1,234.5") is True and num("1,234.5") == 1234.5


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

    def test_เที่ยวตีเปล่าตัดทั้งเที่ยว(self):  # noqa: N802
        a = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=100, qty=1)
        res = allocate_trip([a], 3000.0, ROUTES, trip_type="ของเหมาตีเปล่า")
        assert a.excluded == "ของเหมาตีเปล่า"
        assert res.allocated == 0.0 and res.unallocated == pytest.approx(3000.0)


class Testอ่านค่าจากเซลล์:
    def test_ตัดจุดศูนย์ท้ายเลขที่ใบรายการ(self):  # noqa: N802
        assert txt(6250753132426.0) == "6250753132426"

    def test_ตัดช่องว่างหน้าหลัง(self):  # noqa: N802
        assert txt("  สด ต้นทาง   ") == "สด ต้นทาง"


def test_ติดธงข้อมูลที่ต้องตรวจสอบ():
    """ไม่เปลี่ยนการปัน — แค่บอกว่ารายการไหนน้ำหนัก/ขนาดเชื่อไม่ได้ (23 ก.ย. 2569)"""
    from src.alloc import FLAG_TINY, basis_of, data_flag, volume_cbm

    def mk(**kw):
        it = Item(doc="1", bill="1", **kw)
        it.cbm = volume_cbm(it)
        it.basis, it.basis_cond = basis_of(it.weight, it.cbm, it.qty)
        return it

    assert data_flag(mk(qty=3, name="ของสด แป้ง")) == FLAG_NO_SIZE                      # นับชิ้นเป็นตัน
    assert data_flag(mk(qty=2, weight=2, width=360, length=600, height=600)) == FLAG_OVERSIZE  # ยางรถไถ 259 ลบ.ม.
    assert data_flag(mk(qty=1, width=1, length=1, height=1)) == FLAG_TINY               # 1×1×1 ซม. ไม่มีน้ำหนัก
    assert data_flag(mk(qty=1, weight=5, width=1, length=1, height=1)) == ""            # มีน้ำหนักจริง ใช้ได้
    assert data_flag(mk(qty=20, weight=200, width=40, length=50, height=30)) == ""


class Testรายการผิดปกติปันตามรายได้:
    """23 ก.ย. 2569 — แบ่งต้นทุนเที่ยวสองก้อนตามสัดส่วนรายได้ ก้อนปกติยังใช้ภาระงาน"""

    def _trip(self):
        # ยางรถไถกรอกขนาด 360×600×600 ซม. (259 ลบ.ม.) รายได้ 200 · ผ้า 1,000 กก. รายได้ 3,000 · ผ้า 500 กก. รายได้ 1,800
        tire = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=2, qty=2,
                    width=360, length=600, height=600, revenue=200)
        a = Item(doc="T", bill="b2", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=1000, qty=1, revenue=3000)
        b = Item(doc="T", bill="b3", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=500, qty=1, revenue=1800)
        return tire, a, b

    def test_ขนาดเกินจริงรับตามสัดส่วนรายได้(self):  # noqa: N802
        tire, a, b = self._trip()
        res = allocate_trip([tire, a, b], 5000.0, ROUTES)
        assert tire.flag == FLAG_OVERSIZE
        assert res.by_revenue == pytest.approx(200 / 5000)
        assert tire.alloc == pytest.approx(5000 * 200 / 5000)                 # 200 บาท ไม่ใช่เกือบทั้งเที่ยว
        # ที่เหลือ 4,800 แบ่งตามภาระงาน 1,000 : 500
        assert a.alloc == pytest.approx(4800 * 1000 / 1500)
        assert b.alloc == pytest.approx(4800 * 500 / 1500)
        assert tire.alloc + a.alloc + b.alloc == pytest.approx(5000)          # ต้นทุนเที่ยวครบทุกบาท

    def test_ไม่มีน้ำหนักขนาดไม่ถูกนับชิ้นเป็นตัน(self):  # noqa: N802
        flour = Item(doc="T", bill="b1", origin="เชียงใหม่", dest="ปากคลองตลาด", qty=3, revenue=210)
        fish = Item(doc="T", bill="b2", origin="เชียงใหม่", dest="ปากคลองตลาด", weight=540, qty=9, revenue=990)
        allocate_trip([flour, fish], 1200.0, ROUTES)
        assert flour.flag == FLAG_NO_SIZE
        assert flour.alloc == pytest.approx(210.0)       # ตามรายได้ — เดิม 3 ชิ้น = 3 ตัน รับ 85%
        assert fish.alloc == pytest.approx(990.0)

    def test_รายได้รวมศูนย์ใช้ภาระงานทั้งเที่ยวตามเดิม(self):  # noqa: N802
        tire, a, b = self._trip()
        for it in (tire, a, b):
            it.revenue = 0
        res = allocate_trip([tire, a, b], 5000.0, ROUTES)
        assert res.by_revenue == 0
        assert tire.alloc > a.alloc                      # ยังใช้ภาระงาน (ไม่มีรายได้ให้แยกก้อน)
