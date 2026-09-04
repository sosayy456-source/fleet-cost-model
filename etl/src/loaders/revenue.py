"""
loaders/revenue.py
==================
อ่านไฟล์บิลขนส่งรายเดือน (.xlsx) จากโฟลเดอร์เดียว แล้วรวมเป็น DataFrame เดียว

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


def load_raw(data_dir: str) -> tuple[pd.DataFrame, list[DiscoveredFile], list[str]]:
    """คืน (DataFrame รวม, ไฟล์ที่อ่าน, คอลัมน์ที่ขาด)"""
    files = discover_files(data_dir)
    if not files:
        log.warning("ไม่พบไฟล์ .xlsx ในโฟลเดอร์ %s", data_dir)
        return pd.DataFrame(columns=EXPECTED_COLUMNS + ["source_file"]), [], list(EXPECTED_COLUMNS)

    frames, used = [], []
    for f in files:
        try:
            one = read_one_file(f.path)
        except Exception as e:
            # ไฟล์เสียหรือรูปแบบไม่ตรง -> ข้ามแต่บอกให้รู้ ไม่ทำให้ทั้ง build ล่ม
            log.error("ข้ามไฟล์ %s อ่านไม่สำเร็จ: %s", f.name, e)
            continue

        lacks = [c for c in REQUIRED_COLUMNS if c not in one.columns]
        if lacks:
            log.warning("ข้ามไฟล์ %s ไม่ใช่ไฟล์บิล (ขาดคอลัมน์ %s)", f.name, ", ".join(lacks))
            continue

        frames.append(one)
        used.append(f)
        log.info("อ่าน %s — %s แถว (%.1f MB)", f.name, f"{len(one):,}", f.size / 1048576)

    if not frames:
        return pd.DataFrame(columns=EXPECTED_COLUMNS + ["source_file"]), [], list(EXPECTED_COLUMNS)

    df = pd.concat(frames, ignore_index=True)
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        log.warning("ไฟล์ข้อมูลขาดคอลัมน์: %s — บางส่วนของแดชบอร์ดจะไม่ครบ", ", ".join(missing))

    return df, used, missing
