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


def test_ตัดบิลน้ำหนักเกินพันตันอัตโนมัติ():
    from src.excluded_bills import ABSURD_KG, is_absurd_weight, weight_kg
    # บิล 5224060112113: 1 กล่อง × น้ำหนักต่อหน่วย 112,756,035,249,154 · น้ำหนักรวม 0
    assert is_absurd_weight(1, 112_756_035_249_154, 0)
    # ทรายแมวกรอกผิดหลักร้อยตัน — ยังไม่ตัด (ผิดแต่ไม่ถึงเกณฑ์)
    assert not is_absurd_weight(20, 23_976, 479_520)
    assert weight_kg(40, 1_200, 0) == 48_000
    assert not is_absurd_weight(0, 0, ABSURD_KG) and is_absurd_weight(0, 0, ABSURD_KG + 1)
