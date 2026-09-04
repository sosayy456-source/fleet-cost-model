"""
test_etl.py
===========
เทสต์ ETL — รันได้ทั้งกับ pytest และรันตรง ๆ (ไม่ต้องลง pytest ก็ได้)

    python test_etl.py            # รันตรง
    python -m pytest test_etl.py  # ถ้ามี pytest

คุมสี่เรื่องที่เคยพลาดมาแล้วจริง ๆ ระหว่างพัฒนา:
1. ไฟล์ที่ไม่ใช่บิลถูกอ่านปนเข้ามา (แปลงรหัสลูกหนี้รวม.xlsx 584,941 แถว)
2. ไฟล์สำรองถูกนับซ้ำทั้งเดือน (bill_*.backup.xlsx)
3. month_label ต้องให้ผลตรงกับของเดิมเป๊ะ
4. cube ต้องยุบแล้วยอดรวมไม่หาย
"""

from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.cleaning import clean_data, month_label, validation_report  # noqa: E402
from src.cube import build_cube  # noqa: E402
from src.loaders.revenue import (  # noqa: E402
    REQUIRED_COLUMNS,
    classify_customer_id,
    customer_id_formats,
    discover_files,
)


def _touch(path: str) -> None:
    with open(path, "wb") as f:
        f.write(b"")


def test_discover_skips_backup_and_lock_files(tmp_path=None):
    """ไฟล์สำรองกับไฟล์ล็อกของ Excel ต้องไม่ถูกอ่าน"""
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        for name in [
            "bill_256807.xlsx",
            "bill_256807.backup.xlsx",
            "~$bill_256808.xlsx",
            "bill_256808.xlsx",
        ]:
            _touch(os.path.join(d, name))

        got = sorted(f.name for f in discover_files(d))
        assert got == ["bill_256807.xlsx", "bill_256808.xlsx"], got


def test_required_columns_guard():
    """คอลัมน์ขั้นต่ำต้องพอแยกไฟล์บิลออกจากไฟล์อื่นได้"""
    bill_like = pd.DataFrame(columns=["เลขที่บิล", "วันที่", "ราคารวม", "ต้นทาง"])
    custmap_like = pd.DataFrame(columns=["รหัสที่แปลงแล้ว", "รหัสต้นฉบับ"])

    assert all(c in bill_like.columns for c in REQUIRED_COLUMNS)
    assert not all(c in custmap_like.columns for c in REQUIRED_COLUMNS)


def test_month_label_matches_original():
    """ต้องให้ผลตรงกับ _month_label เดิมใน insights.py ทุกเคส"""
    month_th = {1: "ม.ค.", 2: "ก.พ.", 3: "มี.ค.", 4: "เม.ย.", 5: "พ.ค.", 6: "มิ.ย.",
                7: "ก.ค.", 8: "ส.ค.", 9: "ก.ย.", 10: "ต.ค.", 11: "พ.ย.", 12: "ธ.ค."}

    def original(period_str: str) -> str:
        try:
            y, m = period_str.split("-")
            return f"{month_th[int(m)]} {int(y) + 543 - 2500}"
        except Exception:
            return period_str

    for case in ["2024-01", "2025-07", "2026-12", "2569-13", "ไม่ใช่เดือน", "2025-1", "NaT"]:
        assert month_label(case) == original(case), case


def test_classify_customer_id():
    assert classify_customer_id("a" * 64) == "sha256"
    assert classify_customer_id("0" * 63 + "f") == "sha256"
    assert classify_customer_id("CUS0093762") == "cus"
    assert classify_customer_id("CUS123") == "other"
    assert classify_customer_id("A" * 64) == "other"   # ตัวพิมพ์ใหญ่ไม่ใช่ hex ที่เราใช้
    assert classify_customer_id("") == "empty"
    assert classify_customer_id(None) == "empty"


def test_mixed_customer_id_is_detected():
    """รหัสคนละรูปแบบในชุดเดียวกันต้องถูกจับได้ ไม่ใช่เงียบ"""
    df = pd.DataFrame({
        "ผู้รับ_encoded": ["a" * 64, "CUS0000001"],
        "ผู้ส่ง_encoded": ["b" * 64, "c" * 64],
        "source_file": ["m08.xlsx", "m07.xlsx"],
    })
    out = customer_id_formats(df)
    assert out["mixed"] is True
    assert set(out["formats_seen"]) == {"sha256", "cus"}


def test_cut_short_flag_replaces_uncleared():
    """ธงต้องเป็น True เมื่อสถานะบิล = ตัดจบ และชื่อใหม่ต้องมีอยู่จริง"""
    df = pd.DataFrame({
        "เลขที่บิล": ["1", "2"],
        "วันที่": ["01/07/2568", "02/07/2568"],
        "ราคารวม": ["100", "200"],
        "สถานะบิล": ["จบ", "ตัดจบ"],
    })
    out = clean_data(df)
    assert "flag_cut_short" in out.columns
    assert "flag_uncleared" not in out.columns
    assert out["flag_cut_short"].tolist() == [False, True]


def test_thai_date_and_validation():
    df = pd.DataFrame({
        "เลขที่บิล": ["1", "2", "3"],
        "วันที่": ["17/07/2568", "2025-07-17", ""],
        "ราคารวม": ["100", "1,234", "300"],
    })
    rep = validation_report(df)
    assert rep["bad_date_rows"] == 2                    # ISO และช่องว่าง อ่านไม่ออกทั้งคู่
    assert "2025-07-17" in rep["bad_date_samples"]
    assert rep["comma_numbers"].get("ราคารวม") == 1     # "1,234" ต้องถูกจับได้

    out = clean_data(df)
    assert out["date"].notna().tolist() == [True, False, False]
    assert out["month"].tolist()[0] == "2025-07"


def test_cube_preserves_totals():
    """ยุบแล้วยอดรวมกับจำนวนรายการต้องไม่หาย"""
    df = pd.DataFrame({
        "เลขที่บิล": ["b1", "b1", "b2", "b3"],
        "วันที่": ["01/07/2568"] * 4,
        "ราคารวม": ["100", "50", "200", "300"],
        "ประเภทการชำระเงิน": ["สดต้นทาง", "สดต้นทาง", "เชื่อปลายทาง", None],
        "ประเภทสินค้า": ["A", "A", "B", "B"],
    })
    clean = clean_data(df)
    cube = build_cube(clean)

    assert cube["revenue"].sum() == clean["ราคารวม"].sum() == 650
    assert cube["lines"].sum() == len(clean) == 4
    # ค่าว่างต้องกลายเป็น "(ไม่ระบุ)" ไม่ใช่หายไปจาก cube
    assert "(ไม่ระบุ)" in cube["ประเภทการชำระเงิน"].tolist()


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  ok   {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
        except Exception as e:
            failed += 1
            print(f"  ERR  {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} ผ่าน")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
