"""ตรวจตัวอ่านวันที่ของไฟล์ลูกหนี้โดยไม่อ่านข้อมูลจริง"""
from datetime import date, datetime

from build_debtors import num, parse_date


def test_excel_serial_dates():
    # ไฟล์ "สุ่ม 1200 บิล.xlsx" เก็บวันที่เป็นเลขลำดับวัน — เดิมถูกข้ามทุกแถว
    assert parse_date(46023) == date(2026, 1, 1)
    assert parse_date(46030) == date(2026, 1, 8)
    assert parse_date(46030.0) == date(2026, 1, 8)
    assert parse_date("46043") == date(2026, 1, 21)


def test_text_and_date_cells_unchanged():
    assert parse_date("09/01/26") == date(2026, 1, 9)
    assert parse_date("09/01/69") == date(2026, 1, 9)
    assert parse_date("2026-01-09") == date(2026, 1, 9)
    assert parse_date(datetime(2569, 1, 9)) == date(2026, 1, 9)
    assert parse_date("") is None
    assert parse_date("(ว่าง)") is None
    assert parse_date(None) is None


def test_small_numbers_are_not_dates():
    # เลขเล็ก ๆ (เช่นระยะเวลาเครดิต) ต้องไม่ถูกตีความเป็นวันที่
    assert parse_date(7) is None
    assert parse_date("30") is None


def test_amount_with_thousands_separator():
    assert num("1,346.00") == 1346.0
