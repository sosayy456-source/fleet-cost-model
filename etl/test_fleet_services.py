"""ตรวจการรวบรวมกลุ่มบริการโดยไม่อ่านข้อมูลจริง"""
from pathlib import Path

import build_costrev as etl


def test_service_revenue_includes_paid_bills_and_excludes_cleared(monkeypatch):
    headers = ["เลขที่ใบรายการ", "เลขที่บิล", "วันที่", "ราคารวม", "สถานะการชำระเงิน", "ประเภทสินค้า"]
    rows = [
        ["001", "1", "", 600, "ชำระแล้ว", "แช่เย็น"],
        ["001", "2", "", 400, "ชำระแล้ว", "ทั่วไป"],
        ["001", "3", "", 200, "ชำระแล้ว", "แช่เย็น"],
        ["001", "4", "", 99, "ชำระแล้ว", etl.GOODS_CLEARED],
        ["002", "5", "", 9000, "ชำระแล้ว", "ทั่วไป"],
    ]
    monkeypatch.setattr(etl, "xlsx_files", lambda _: [Path("ตัวอย่าง.xlsx")])
    monkeypatch.setattr(etl, "iter_sheet", lambda *_: (headers, iter(rows)))
    result = etl.load_revenue(Path("ไม่ได้อ่านไฟล์"), {"001"})
    assert result[-1] == {"001": {"แช่เย็น": 800, "ทั่วไป": 400}}
    assert result[1] == {}
    assert result[5] == {"001": 99}


def test_service_revenue_preserves_unknown_zero_and_negative(monkeypatch):
    headers = ["เลขที่ใบรายการ", "เลขที่บิล", "วันที่", "ราคารวม", "สถานะการชำระเงิน", "ประเภทสินค้า"]
    rows = [["001", "1", "", 0, "ชำระแล้ว", ""], ["001", "2", "", -10, "ชำระแล้ว", "ทั่วไป"]]
    monkeypatch.setattr(etl, "xlsx_files", lambda _: [Path("ตัวอย่าง.xlsx")])
    monkeypatch.setattr(etl, "iter_sheet", lambda *_: (headers, iter(rows)))
    assert etl.load_revenue(Path("ไม่ได้อ่านไฟล์"), {"001"})[-1] == {"001": {"ไม่ระบุ": 0, "ทั่วไป": -10}}
