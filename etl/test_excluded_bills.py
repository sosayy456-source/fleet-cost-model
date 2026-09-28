"""บิลที่ ETL ข้ามทิ้ง (src/excluded_bills.py) — เทียบเลขเป็นสตริง รับทั้งแบบมี .0 ที่ calamine ใส่มา"""
from src.excluded_bills import EXCLUDED_BILLS, bill_key, is_excluded


def test_bill_key_ตัด_จุดศูนย์():
    assert bill_key(5224060112113.0) == "5224060112113"
    assert bill_key(" 5224060112113 ") == "5224060112113"
    assert bill_key(None) == ""


def test_บิลน้ำหนักผิด_28กย():
    assert "5224060112113" in EXCLUDED_BILLS
    assert is_excluded("5224060112113")
    assert is_excluded(5224060112113.0)
    assert not is_excluded("5224060112114")
    assert not is_excluded("")
