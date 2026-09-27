"""
เทสต์การปันส่วนต้นทุนเข้าบิลแบบใหม่ (เจ้าของงานสั่ง 27 ก.ย. 2569)

    CF = ความจุน้ำหนัก ÷ ความจุปริมาตร ของรถในเที่ยว · น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF)
    Metric = น้ำหนักเทียบเท่า × ระยะทาง · ต้นทุนบิล = ต้นทุนเที่ยว × Metric ÷ Σ Metric · Σ = ต้นทุนเที่ยวพอดีหลังปัดเศษ

ตัวอย่าง A/B/C ตามสเปกที่เจ้าของงานส่ง: รถ 20,000 กก. / 60 ลบ.ม. · ต้นทุนเที่ยว 10,000 บาท
"""
from __future__ import annotations

from pathlib import Path

import pytest

from src.alloc import Item, allocate_trip, basis_of, conversion_factor, round_allocs
from src.capacity import CF_MEDIAN, CF_VEHICLE, Capacity

#: ระยะทางของแต่ละรายการ (ต้นทาง O → ปลายทางของลูกค้า)
ROUTES = {"O": {"A": 100.0, "B": 300.0, "C": 500.0}}
VEHICLES = Path(__file__).resolve().parent.parent / "app" / "src" / "lib" / "refdata" / "vehicles.json"


def item(dest: str, weight: float, cbm: float, bill: str = "", revenue: float = 1000.0) -> Item:
    """ปริมาตรเป็นก้อนละ 1 ลบ.ม. (100×100×100 ซม.) × จำนวน — ให้ volume_cbm() ได้ cbm พอดี"""
    return Item(doc="T1", bill=bill or dest, origin="O", dest=dest, weight=weight, qty=cbm,
                width=100, length=100, height=100, revenue=revenue)


class TestConversionFactor:
    def test_มาจากความจุรถ(self):
        assert conversion_factor(20_000, 60) == pytest.approx(333.3333, rel=1e-6)
        assert conversion_factor(12_000, 45) == pytest.approx(266.6667, rel=1e-6)   # รถคนละแบบ = CF คนละค่า

    def test_ความจุไม่ครบ_หารศูนย์ไม่ได้(self):
        assert conversion_factor(20_000, 0) is None
        assert conversion_factor(0, 60) is None
        assert conversion_factor(None, 60) is None
        with pytest.raises(ValueError):
            basis_of(100, 1, 1, 0)


class TestEquivalentWeight:
    CF = 20_000 / 60

    def test_weight_heavy_ใช้น้ำหนักจริง(self):
        b, cond = basis_of(5_000, 10, 10, self.CF)
        assert cond == 1 and b == pytest.approx(5.0)            # MAX(5,000, 3,333.3) กก.

    def test_volume_heavy_ใช้ปริมาตร_คูณ_CF(self):
        b, _ = basis_of(1_000, 10, 10, self.CF)
        assert b * 1000 == pytest.approx(3_333.33, abs=0.01)     # MAX(1,000, 3,333.3) กก.

    def test_ค่าติดลบ_ไม่นับเป็นข้อมูล(self):
        assert basis_of(-50, 2, 2, self.CF)[1] == 3             # น้ำหนักติดลบ = ใช้ปริมาตรอย่างเดียว


class TestAllocateABC:
    """ตัวอย่างในสเปก — ลูกค้า 3 รายในเที่ยวเดียวกัน"""
    CF = conversion_factor(20_000, 60)

    def run(self, cost: float = 10_000.0):
        a, b, c = item("A", 5_000, 10), item("B", 1_000, 10), item("C", 2_000, 20)
        res = allocate_trip([a, b, c], cost, ROUTES, cf=self.CF)
        return res, (a, b, c)

    def test_น้ำหนักเทียบเท่าและ_metric(self):
        _, (a, b, c) = self.run()
        assert [round(x.basis * 1000, 1) for x in (a, b, c)] == [5_000.0, 3_333.3, 6_666.7]
        # Metric (กก.-กม.) = น้ำหนักเทียบเท่า × ระยะทาง
        assert [round(x.workload * 1000) for x in (a, b, c)] == [500_000, 1_000_000, 3_333_333]
        assert all(x.cf == pytest.approx(333.3333, rel=1e-6) for x in (a, b, c))

    def test_ปันตามสัดส่วน_metric_และรวมเท่าต้นทุนเที่ยว(self):
        res, (a, b, c) = self.run()
        total = sum(x.workload for x in (a, b, c))
        for x in (a, b, c):
            assert x.share == pytest.approx(x.workload / total)
        assert [a.alloc, b.alloc, c.alloc] == [1_034.48, 2_068.97, 6_896.55]
        assert round(a.alloc + b.alloc + c.alloc, 2) == 10_000.00
        assert round(res.allocated, 2) == 10_000.00

    def test_รถคนละแบบ_ได้ผลต่างกัน(self):
        # A หนักแต่เล็ก · B เบาแต่เปลืองที่ — CF สูงขึ้น B ต้องรับต้นทุนมากขึ้น
        a, b = item("A", 5_000, 1), item("A", 100, 10, bill="b")
        allocate_trip([a, b], 1_000.0, ROUTES, cf=conversion_factor(20_000, 60))     # CF 333.3
        a2, b2 = item("A", 5_000, 1), item("A", 100, 10, bill="b")
        allocate_trip([a2, b2], 1_000.0, ROUTES, cf=conversion_factor(3_000, 5))     # ปิกอัพ CF 600
        assert b.alloc == pytest.approx(1_000 * 3_333.33 / (5_000 + 3_333.33), abs=0.01)
        assert b2.alloc == pytest.approx(1_000 * 6_000 / (5_000 + 6_000), abs=0.01)
        assert b2.alloc > b.alloc

    def test_ต้นทุนเที่ยวติดลบ_ปันไม่ได้(self):
        with pytest.raises(ValueError):
            self.run(-1.0)


class TestRounding:
    def test_หารไม่ลงตัว_ส่วนต่างไปรายการที่มากสุด(self):
        assert round_allocs([100 / 3] * 3, 100) == [33.34, 33.33, 33.33]
        assert sum(round_allocs([100 / 3] * 3, 100)) == pytest.approx(100.0)

    def test_หลายลูกค้า_รวมตรงทุกสตางค์(self):
        items = [item("A", 100 + i * 7, 1 + i % 3, bill=f"b{i}") for i in range(13)]
        res = allocate_trip(items, 9_999.99, ROUTES, cf=conversion_factor(12_000, 45))
        assert round(sum(x.alloc for x in items), 2) == 9_999.99
        assert round(res.allocated, 2) == 9_999.99


class TestCapacity:
    cap = Capacity(VEHICLES)

    def test_หัว_บวก_หาง(self):
        cf, src, unknown = self.cap.trip_cf(["รถ 10 ล้อ", "หางพ่วงคอก"])
        assert src == CF_VEHICLE and not unknown
        assert cf == pytest.approx((12_000 + 12_000) / (45 + 34))

    def test_ชื่อในไฟล์ต่างจากตาราง(self):
        assert self.cap.of("รถเทรเล่อร์(แม่)") == self.cap.of("รถเทรเลอร์")   # ไม่สนช่องว่าง + ชื่อเก่า
        assert self.cap.of("รถปิกอัพ") == self.cap.of("รถปิกอัพ 3 ตัน")

    def test_หาไม่เจอ_ใช้ค่ากลางของตาราง(self):
        cf, src, unknown = self.cap.trip_cf(["รถที่ไม่มีในตาราง"])
        assert src == CF_MEDIAN and unknown == ["รถที่ไม่มีในตาราง"]
        assert cf == pytest.approx(self.cap.median_cf)
