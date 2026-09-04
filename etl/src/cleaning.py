"""
cleaning.py
============
แปลงข้อมูลดิบให้พร้อมวิเคราะห์ — ยกมาจาก RevenueDashboard/src/cleaning.py
พฤติกรรมการคำนวณเหมือนเดิมทุกอย่าง มีสามอย่างที่เปลี่ยน:

1. เปลี่ยนชื่อ flag_uncleared -> flag_cut_short
   ของเดิมชื่ออ่านกลับความหมาย: มันเป็น True เมื่อสถานะบิล == "ตัดจบ" ซึ่งเป็นสถานะ
   "ผิดปกติ" (ปกติคือ "จบ") แต่ชื่อ uncleared ทำให้เข้าใจว่ายังไม่เคลียร์

2. ย้าย month_label มาไว้ที่นี่ที่เดียว
   ของเดิมเขียนซ้ำใน app.py:91 และ insights.py:37

3. เพิ่ม validation_report() รายงานข้อมูลที่แปลงไม่ได้
   ของเดิมค่าที่อ่านไม่ออกจะกลายเป็น NaN เงียบ ๆ เช่น "1,234" ที่มีจุลภาค
   ตอนนี้นับและรายงานออกมาให้เห็นใน dq.json

ไม่ผูกกับ Streamlit — เป็น pandas ล้วน
"""

from __future__ import annotations

import re

import numpy as np
import pandas as pd

NUMERIC_COLUMNS = [
    "จำนวน", "น้ำหนักต่อหน่วย", "กว้าง", "ยาว", "สูง",
    "น้ำหนักรวม", "ราคาต่อหน่วย", "ราคาต่อน้ำหนัก", "ราคารวม",
]

# กว้าง/ยาว/สูง (ซม.) ที่เกินกว่านี้เป็นไปไม่ได้ทางกายภาพ = ป้อนข้อมูลผิด
MAX_PLAUSIBLE_DIMENSION_CM = 10_000  # 100 เมตร

# สถานะบิลที่ถือว่าผิดปกติ (ปกติคือ "จบ")
BILL_STATUS_CUT_SHORT = "ตัดจบ"
PAYMENT_STATUS_UNPAID = "ยังไม่ได้ชำระ"

_THAI_DATE = re.compile(r"^\s*\d{1,2}/\d{1,2}/\d{4}\s*$")
_TH_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]


def _parse_thai_date(s):
    """แปลง DD/MM/YYYY (พ.ศ.) -> pandas.Timestamp (ค.ศ.)"""
    if not isinstance(s, str) or "/" not in s:
        return pd.NaT
    try:
        d, m, y = s.split("/")
        y_ce = int(y) - 543
        return pd.Timestamp(year=y_ce, month=int(m), day=int(d))
    except Exception:
        return pd.NaT


def month_label(month: str) -> str:
    """'2025-07' -> 'ก.ค. 68' — จุดเดียวของทั้งระบบ"""
    try:
        y, m = str(month).split("-")
        return f"{_TH_MONTH_ABBR[int(m) - 1]} {int(y) + 543 - 2500}"
    except Exception:
        return str(month)


def validation_report(df_raw: pd.DataFrame) -> dict:
    """
    หาค่าที่จะแปลงไม่ได้ ก่อนที่มันจะกลายเป็น NaN แบบเงียบ ๆ

    สองเคสที่เจอบ่อย:
    - วันที่ไม่ใช่รูปแบบ DD/MM/YYYY (เช่น Excel serial date หรือช่องว่าง)
    - ตัวเลขที่มีจุลภาคคั่นหลัก เช่น "1,234" -> pd.to_numeric อ่านไม่ออก
    """
    report: dict = {"bad_date_samples": [], "bad_date_rows": 0,
                    "numeric_unparseable": {}, "comma_numbers": {}}
    if df_raw.empty:
        return report

    if "วันที่" in df_raw.columns:
        raw = df_raw["วันที่"].astype("string")
        bad = raw.notna() & ~raw.fillna("").str.match(_THAI_DATE)
        empty = raw.isna() | (raw.fillna("").str.strip() == "")
        bad_or_empty = bad | empty
        report["bad_date_rows"] = int(bad_or_empty.sum())
        report["bad_date_samples"] = (
            raw[bad & ~empty].dropna().unique()[:10].tolist()
        )

    for c in NUMERIC_COLUMNS:
        if c not in df_raw.columns:
            continue
        raw = df_raw[c].astype("string")
        has_value = raw.notna() & (raw.fillna("").str.strip() != "")
        parsed = pd.to_numeric(raw, errors="coerce")
        unparseable = has_value & parsed.isna()
        n = int(unparseable.sum())
        if n:
            report["numeric_unparseable"][c] = n
        n_comma = int((has_value & raw.fillna("").str.contains(",")).sum())
        if n_comma:
            report["comma_numbers"][c] = n_comma

    return report


def clean_data(df_raw: pd.DataFrame) -> pd.DataFrame:
    if df_raw.empty:
        return df_raw.copy()

    df = df_raw.copy()

    # ---- วันที่ ----
    if "วันที่" in df.columns:
        df["date"] = df["วันที่"].apply(_parse_thai_date)
    else:
        df["date"] = pd.NaT

    # ---- ตัวเลข ----
    for c in NUMERIC_COLUMNS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
        else:
            df[c] = np.nan

    # ---- คอลัมน์เสริม ----
    df["month"] = df["date"].dt.to_period("M").astype(str)
    df["month_th"] = df["month"].map(month_label)
    df["year_be"] = (df["date"].dt.year + 543).astype("Int64")
    df["month_num"] = df["date"].dt.month
    df["dow"] = df["date"].dt.day_name()

    if "ต้นทาง" in df.columns and "ปลายทาง" in df.columns:
        df["route"] = df["ต้นทาง"].fillna("") + " → " + df["ปลายทาง"].fillna("")

    # ---- ธงคุณภาพข้อมูล ----
    df["flag_bad_date"] = df["date"].isna()
    df["flag_bad_dimension"] = (
        (df.get("กว้าง", 0) > MAX_PLAUSIBLE_DIMENSION_CM)
        | (df.get("ยาว", 0) > MAX_PLAUSIBLE_DIMENSION_CM)
        | (df.get("สูง", 0) > MAX_PLAUSIBLE_DIMENSION_CM)
    )
    df["flag_zero_revenue"] = df.get("ราคารวม", pd.Series(dtype=float)) == 0
    df["flag_duplicate_row"] = df.duplicated(keep=False)

    if "สถานะการชำระเงิน" in df.columns:
        df["flag_unpaid"] = df["สถานะการชำระเงิน"].astype(str).str.strip() == PAYMENT_STATUS_UNPAID
    else:
        df["flag_unpaid"] = False

    # True = สถานะบิลเป็น "ตัดจบ" ซึ่งผิดปกติ (ปกติคือ "จบ")
    if "สถานะบิล" in df.columns:
        df["flag_cut_short"] = df["สถานะบิล"].astype(str).str.strip() == BILL_STATUS_CUT_SHORT
    else:
        df["flag_cut_short"] = False

    return df
