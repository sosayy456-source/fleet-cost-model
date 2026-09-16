"""
loaders/revenue.py
==================
อ่านไฟล์บิลขนส่งรายเดือน (.xlsx) จากโฟลเดอร์เดียว

build_json.py เป็นคนวนอ่านทีละไฟล์เอง (read_one_file -> clean_data -> shrink) แล้วค่อย
เรียก concat_shared() ต่อกันตอนท้าย — ที่นี่ไม่มีฟังก์ชันที่อ่านทุกไฟล์รวดเดียวแล้ว
เพราะข้อมูลจริงใหญ่เกินกว่าจะถือทั้งชุดดิบและชุดที่ล้างแล้วพร้อมกัน (ดูหมายเหตุท้ายไฟล์)

เขียนใหม่จาก RevenueDashboard/src/data_loader.py โดยตัด Streamlit ออกทั้งหมด:
- ไม่มี @st.cache_data — ETL เป็น batch job รันครั้งเดียวจบ ไม่มี rerun ให้ต้อง cache
  (กลไก folder_signature เดิมมีไว้เลี่ยงการแฮช DataFrame ใหญ่ทุกครั้งที่เปลี่ยนหน้าเมนู
   ซึ่งเป็นปัญหาเฉพาะของ Streamlit)
- st.warning -> logging

ของเดิมที่ต้องคงไว้เป๊ะ ๆ ไม่งั้นอ่านไฟล์จริงไม่ได้:
- หัวคอลัมน์จริงในไฟล์มีช่องว่างต่อท้าย เช่น 'น้ำหนักต่อหน่วย ' -> ต้อง .strip()
- ค่าในเซลล์ pad ช่องว่างยาวมาก เช่น 'สด ต้นทาง' + ช่องว่าง 90 ตัว -> ต้อง .strip()
- อ่านด้วย dtype=str เสมอ แล้วค่อยแปลงเป็นตัวเลขในขั้น cleaning
"""

from __future__ import annotations

import glob
import logging
import os
import re
from dataclasses import dataclass

import pandas as pd

log = logging.getLogger(__name__)

EXPECTED_COLUMNS = [
    "เลขที่บิล", "วันที่", "ประเภทการชำระเงิน", "ประเภทสินค้า", "ต้นทาง", "ปลายทาง",
    "ชื่อสินค้า", "จำนวน", "หน่วย", "น้ำหนักต่อหน่วย", "กว้าง", "ยาว", "สูง",
    "น้ำหนักรวม", "ราคาต่อหน่วย", "ราคาต่อน้ำหนัก", "ราคารวม", "ประเภทการคิดราคา",
    "สายกระจาย", "สถานะบิล", "สถานะการชำระเงิน", "เลขที่ใบรายการ",
    "ผู้รับ_encoded", "ผู้ส่ง_encoded",
]

CUSTOMER_ID_COLUMNS = ["ผู้รับ_encoded", "ผู้ส่ง_encoded"]

# คอลัมน์ขั้นต่ำที่ต้องมี ไม่งั้นไม่ใช่ไฟล์บิล
# มีไว้กันไฟล์ .xlsx อื่นที่บังเอิญอยู่โฟลเดอร์เดียวกันถูกอ่านปนเข้ามา
# (เคสจริง: แปลงรหัสลูกหนี้รวม.xlsx 584,941 แถว วางอยู่ใน sample_data ด้วย
#  ถ้าไม่กันจะถูกนับรวมเป็นบิลทั้งหมด ทำให้ยอดทุกตัวผิด)
REQUIRED_COLUMNS = ["เลขที่บิล", "วันที่", "ราคารวม"]

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_CUSCODE = re.compile(r"^CUS\d{7}$")


@dataclass
class DiscoveredFile:
    path: str
    name: str
    size: int


def discover_files(data_dir: str) -> list[DiscoveredFile]:
    """
    หาไฟล์ .xlsx ทุกไฟล์ในโฟลเดอร์ — ไม่ต้องแก้โค้ดเมื่อมีไฟล์เดือนใหม่

    ข้ามสองแบบ:
      ~$*          ไฟล์ล็อกที่ Excel สร้างตอนเปิดไฟล์ค้างไว้ (ของเดิมก็ข้าม)
      *.backup.*   ไฟล์สำรอง — ลงท้าย .xlsx เหมือนกัน ถ้าไม่กันจะถูกนับซ้ำทั้งเดือน
    """
    if not os.path.isdir(data_dir):
        return []

    files: list[DiscoveredFile] = []
    for path in sorted(glob.glob(os.path.join(data_dir, "*.xlsx"))):
        name = os.path.basename(path)
        if name.startswith("~$"):
            log.info("ข้ามไฟล์ล็อกของ Excel: %s", name)
            continue
        if ".backup." in name.lower():
            log.info("ข้ามไฟล์สำรอง: %s", name)
            continue
        files.append(DiscoveredFile(path=path, name=name, size=os.path.getsize(path)))
    return files


def _read_excel_fast(path: str) -> pd.DataFrame:
    """calamine เร็วกว่า openpyxl ราว 4 เท่า — สำคัญมากเมื่อข้อมูลจริงมี 29 ไฟล์"""
    try:
        return pd.read_excel(path, engine="calamine", dtype=str)
    except Exception:
        return pd.read_excel(path, engine="openpyxl", dtype=str)


def _strip_all_str_columns(df: pd.DataFrame) -> pd.DataFrame:
    for c in df.columns:
        if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c]):
            df[c] = df[c].astype("string").str.strip()
    return df


def read_one_file(path: str) -> pd.DataFrame:
    df = _read_excel_fast(path)
    df.columns = [str(c).strip() for c in df.columns]

    # คอลัมน์ที่หลุดมาจากขั้นตอนสุ่มตัวอย่าง ไม่ใช่ข้อมูลจริง
    drop_cols = [c for c in df.columns if c.lower() in ("random", "unnamed: 0")]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    df = _strip_all_str_columns(df)
    df["source_file"] = os.path.basename(path)
    return df


def classify_customer_id(value: object) -> str:
    """บอกว่ารหัสลูกค้าค่านี้เป็นรูปแบบไหน — ใช้ตรวจว่าทั้งชุดสอดคล้องกันหรือไม่"""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "empty"
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none"):
        return "empty"
    if _SHA256.match(s):
        return "sha256"
    if _CUSCODE.match(s):
        return "cus"
    return "other"


def customer_id_formats(df: pd.DataFrame) -> dict:
    """
    นับรูปแบบรหัสลูกค้าแยกตามไฟล์ต้นทาง

    เจอมาแล้วในข้อมูลตัวอย่าง: bill_256807 ใช้รหัส CUS ส่วนอีก 5 เดือนใช้ SHA-256
    ทำให้ลูกค้าคนเดียวถูกนับเป็นสองคน จำนวนลูกค้าและ Pareto เพี้ยนทั้งหน้า
    ตรงนี้ทำให้ปัญหาโผล่ออกมาแทนที่จะเงียบ
    """
    out: dict = {"by_file": {}, "formats_seen": set(), "mixed": False}
    if df.empty:
        out["formats_seen"] = []
        return out

    for col in CUSTOMER_ID_COLUMNS:
        if col not in df.columns:
            continue
        for src, chunk in df.groupby("source_file", observed=True):
            counts = chunk[col].map(classify_customer_id).value_counts().to_dict()
            real = {k: int(v) for k, v in counts.items() if k != "empty"}
            if not real:
                continue
            out["by_file"].setdefault(str(src), {})[col] = real
            out["formats_seen"].update(real.keys())

    out["formats_seen"] = sorted(out["formats_seen"])
    out["mixed"] = len([f for f in out["formats_seen"] if f in ("sha256", "cus")]) > 1
    return out


# ---------------------------------------------------------------------------
# ประหยัดหน่วยความจำ
#
# ★ ข้อมูลจริง 29 ไฟล์ = ~5.2 ล้านแถว วัดจริงแล้วกิน 1.06 GB ต่อล้านแถว = 5.5 GB
#   บวกกับตอน pd.concat ที่ต้องมีทั้งก้อนเก่าและก้อนใหม่พร้อมกัน แล้วเกิน 10 GB
#   เครื่องพัฒนา 16 GB จะหมดหน่วยความจำ แล้ว Windows ฆ่าทั้ง python และ dev server
#   ที่เป็นแม่ของมันทิ้ง (อาการที่เห็น: หน้าเว็บขึ้น "Failed to fetch" แล้ว localhost
#   ปฏิเสธการเชื่อมต่อ) — คอลัมน์ข้างล่างค่าซ้ำกันเยอะ เก็บเป็น category เหลือ 4 ไบต์/แถว
# ---------------------------------------------------------------------------

CATEGORICAL_COLUMNS = [
    "วันที่", "ประเภทการชำระเงิน", "ประเภทสินค้า", "ต้นทาง", "ปลายทาง",
    "ชื่อสินค้า", "หน่วย", "ประเภทการคิดราคา", "สายกระจาย",
    "สถานะบิล", "สถานะการชำระเงิน", "เลขที่ใบรายการ",
    "ผู้รับ_encoded", "ผู้ส่ง_encoded", "source_file",
    # คอลัมน์ที่ clean_data สร้างเพิ่ม
    "month", "month_th", "dow", "route",
]
# "เลขที่บิล" ไม่อยู่ในรายการ — เกือบทุกแถวไม่ซ้ำ ทำเป็น category แล้วกินกว่าเดิม


def _is_cat(s: pd.Series) -> bool:
    return isinstance(s.dtype, pd.CategoricalDtype)


def shrink(df: pd.DataFrame) -> pd.DataFrame:
    """ยุบคอลัมน์ที่ค่าซ้ำเยอะเป็น category — เรียกทีละไฟล์ก่อนเอาไปต่อกัน"""
    for c in CATEGORICAL_COLUMNS:
        if c in df.columns and not _is_cat(df[c]):
            df[c] = df[c].astype("category")
    return df


def concat_shared(frames: list[pd.DataFrame]) -> pd.DataFrame:
    """
    ต่อ DataFrame ที่ผ่าน shrink() แล้วเข้าด้วยกัน

    ★ pd.concat จะคลาย category กลับเป็นสตริงถ้าแต่ละก้อนมีชุดหมวดไม่ตรงกัน
      ที่ประหยัดมาทั้งหมดจะหายในบรรทัดเดียว จึงต้องรวมชุดหมวดให้ตรงกันก่อน
      (ชุดหมวดเรียงแล้ว การ sort_values("month") จึงยังได้ลำดับเวลาเหมือนเดิม)
    """
    if not frames:
        return pd.DataFrame()
    if len(frames) == 1:
        return frames[0]

    for c in frames[0].columns:
        if not all(c in f.columns and _is_cat(f[c]) for f in frames):
            continue
        cats = sorted(set().union(*(set(f[c].cat.categories) for f in frames)))
        dtype = pd.CategoricalDtype(cats)
        for f in frames:
            f[c] = f[c].astype(dtype)

    return pd.concat(frames, ignore_index=True)


def missing_required(df: pd.DataFrame) -> list[str]:
    """คอลัมน์บังคับที่ไฟล์นี้ไม่มี — ถ้าไม่ว่างแปลว่าไม่ใช่ไฟล์บิล"""
    return [c for c in REQUIRED_COLUMNS if c not in df.columns]
