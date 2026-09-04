"""
cleaning.py
============
แปลงข้อมูลดิบ (raw) ให้พร้อมสำหรับการวิเคราะห์:
- แปลงวันที่ พ.ศ. (เช่น 17/07/2568) -> วันที่แบบ datetime (ค.ศ.)
- แปลงคอลัมน์ตัวเลขจาก string -> numeric
- สร้างคอลัมน์เสริม (เดือน, วันในสัปดาห์, เส้นทาง)
- ติดธง (flag) รายการที่น่าสงสัย เพื่อใช้ในหน้า "คุณภาพข้อมูล"

ฟังก์ชันในไฟล์นี้ไม่ผูกกับ Streamlit โดยตรง (คำนวณล้วนๆ) ทำให้ทดสอบและนำกลับมาใช้ซ้ำง่าย
ไฟล์นี้ไม่มี @st.cache_data ของตัวเอง เพราะฟังก์ชันนี้ถูกเรียกจากภายใน
pipeline.build_dashboard_bundle() ซึ่งเป็นจุดเดียวที่ทำ cache ไว้แล้ว (ดูเหตุผลใน pipeline.py
เรื่องการหลีกเลี่ยงการแฮช DataFrame ขนาดใหญ่ซ้ำๆ ทุกครั้งที่ผู้ใช้เปลี่ยนหน้าเมนู)
"""

from __future__ import annotations
import pandas as pd
import numpy as np

NUMERIC_COLUMNS = [
    "จำนวน", "น้ำหนักต่อหน่วย", "กว้าง", "ยาว", "สูง",
    "น้ำหนักรวม", "ราคาต่อหน่วย", "ราคาต่อน้ำหนัก", "ราคารวม",
]

# ค่าความกว้าง/ยาว/สูง (ซม.) ที่เกินกว่านี้ถือว่าเป็นไปไม่ได้ทางกายภาพ -> ข้อมูลป้อนผิดพลาด
MAX_PLAUSIBLE_DIMENSION_CM = 10_000  # 100 เมตร


def _parse_thai_date(s):
    """แปลงวันที่รูปแบบ DD/MM/YYYY(พ.ศ.) -> pandas.Timestamp (ค.ศ.)"""
    if not isinstance(s, str) or "/" not in s:
        return pd.NaT
    try:
        d, m, y = s.split("/")
        y_ce = int(y) - 543
        return pd.Timestamp(year=y_ce, month=int(m), day=int(d))
    except Exception:
        return pd.NaT


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
        df["flag_unpaid"] = df["สถานะการชำระเงิน"].astype(str).str.strip() == "ยังไม่ได้ชำระ"
    else:
        df["flag_unpaid"] = False

    if "สถานะบิล" in df.columns:
        df["flag_uncleared"] = df["สถานะบิล"].astype(str).str.strip() == "ตัดจบ"
    else:
        df["flag_uncleared"] = False

    return df
