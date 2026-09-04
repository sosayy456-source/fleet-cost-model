"""
data_loader.py
================
รับผิดชอบการ "ค้นหาไฟล์" และ "โหลดข้อมูลดิบ" จากโฟลเดอร์ data/ โดยอัตโนมัติ

หลักการสำคัญ:
- ไม่ต้องแก้โค้ดเมื่อมีไฟล์รายเดือนใหม่เพิ่มเข้ามา แค่วางไฟล์ .xlsx ไว้ใน data/
- อ่านทุกไฟล์ .xlsx ในโฟลเดอร์ data/ (ไม่สนใจชื่อไฟล์ที่แน่นอน ขอแค่เป็น .xlsx)
- ใช้ st.cache_data โดยอิง "ลายเซ็นของโฟลเดอร์" (รายชื่อไฟล์ + เวลาแก้ไขล่าสุด + ขนาดไฟล์)
  เพื่อให้ Streamlit รู้ว่าต้องโหลดใหม่เมื่อมีไฟล์เพิ่ม/แก้ไข แต่ไม่ต้องโหลดใหม่ทุกครั้งที่รีเฟรชหน้า
- ข้อมูลทั้งหมดอยู่ในเครื่อง ไม่มีการอัปโหลดออกจากเครื่องนี้
"""

from __future__ import annotations
import os
import glob
from dataclasses import dataclass

import pandas as pd
import streamlit as st

DATA_DIR_DEFAULT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# คอลัมน์ที่คาดหวังจากไฟล์บิลขนส่ง (ตามพจนานุกรมข้อมูลที่ได้รับ)
EXPECTED_COLUMNS = [
    "เลขที่บิล", "วันที่", "ประเภทการชำระเงิน", "ประเภทสินค้า", "ต้นทาง", "ปลายทาง",
    "ชื่อสินค้า", "จำนวน", "หน่วย", "น้ำหนักต่อหน่วย", "กว้าง", "ยาว", "สูง",
    "น้ำหนักรวม", "ราคาต่อหน่วย", "ราคาต่อน้ำหนัก", "ราคารวม", "ประเภทการคิดราคา",
    "สายกระจาย", "สถานะบิล", "สถานะการชำระเงิน", "เลขที่ใบรายการ",
    "ผู้รับ_encoded", "ผู้ส่ง_encoded",
]


@dataclass
class DiscoveredFile:
    path: str
    name: str
    size: int
    mtime: float


def discover_files(data_dir: str) -> list[DiscoveredFile]:
    """ค้นหาไฟล์ .xlsx ทั้งหมดในโฟลเดอร์ data/ (ไม่ต้องแก้โค้ดเมื่อมีไฟล์ใหม่)"""
    if not os.path.isdir(data_dir):
        return []
    paths = sorted(glob.glob(os.path.join(data_dir, "*.xlsx")))
    files = []
    for p in paths:
        # ข้ามไฟล์ temp ของ Excel เช่น ~$bill.xlsx
        if os.path.basename(p).startswith("~$"):
            continue
        stat = os.stat(p)
        files.append(DiscoveredFile(path=p, name=os.path.basename(p), size=stat.st_size, mtime=stat.st_mtime))
    return files


def folder_signature(data_dir: str) -> tuple:
    """สร้าง signature ของโฟลเดอร์ (ใช้เป็น cache key) — เปลี่ยนเมื่อมีไฟล์เพิ่ม/ลบ/แก้ไขเท่านั้น"""
    files = discover_files(data_dir)
    return tuple((f.name, f.size, round(f.mtime)) for f in files)


def _strip_all_str_columns(df: pd.DataFrame) -> pd.DataFrame:
    """ตัดช่องว่างหน้า-หลังของทุกคอลัมน์ที่เป็นข้อความ (รองรับทั้ง object และ pandas StringDtype)"""
    for c in df.columns:
        if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c]):
            df[c] = df[c].astype("string").str.strip()
    return df


def _read_excel_fast(path: str) -> pd.DataFrame:
    """
    อ่านไฟล์ .xlsx ให้เร็วที่สุดเท่าที่ทำได้ — ลองใช้ engine 'calamine' ก่อน (เร็วกว่า openpyxl
    ราว 4 เท่าจากการทดสอบ) และ fallback ไปใช้ 'openpyxl' ถ้าไม่มีไลบรารีหรืออ่านไม่สำเร็จ
    สำคัญมากเมื่อข้อมูลจริงมีจำนวนแถวมากกว่าไฟล์ตัวอย่างหลายเท่า
    """
    try:
        return pd.read_excel(path, engine="calamine", dtype=str)
    except Exception:
        return pd.read_excel(path, engine="openpyxl", dtype=str)


@st.cache_data(show_spinner=False)
def _read_one_file_cached(path: str, mtime: float, size: int) -> pd.DataFrame:
    """
    โหลดไฟล์เดียว โดย cache แยกรายไฟล์ (key = path+mtime+size)
    ทำให้เมื่อเพิ่มไฟล์ใหม่ 1 ไฟล์ใน data/ ไฟล์เดิมที่ไม่เปลี่ยนแปลงจะไม่ถูกอ่านซ้ำ
    """
    return _read_one_file(path)


def _read_one_file(path: str) -> pd.DataFrame:
    """อ่านไฟล์ .xlsx หนึ่งไฟล์ และทำความสะอาดเบื้องต้น (ตัดช่องว่าง, ตัดคอลัมน์แปลกปลอม)"""
    df = _read_excel_fast(path)
    df.columns = [str(c).strip() for c in df.columns]

    # ตัดคอลัมน์ที่ไม่ใช่ข้อมูลจริง (เช่นคอลัมน์ 'random' ที่หลุดมาจากขั้นตอนการสุ่มตัวอย่าง)
    drop_cols = [c for c in df.columns if c.lower() in ("random", "unnamed: 0")]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    df = _strip_all_str_columns(df)
    df["source_file"] = os.path.basename(path)
    return df


@st.cache_data(show_spinner="กำลังโหลดและรวมไฟล์ข้อมูลบิลขนส่งทั้งหมด...")
def load_raw_data(data_dir: str, folder_signature: tuple) -> pd.DataFrame:
    """
    โหลดและรวมไฟล์ทุกไฟล์ในโฟลเดอร์ data/ เป็น DataFrame เดียว
    folder_signature ใช้เป็น cache key เพื่อให้ Streamlit รู้ว่าต้องโหลดใหม่เมื่อไหร่
    (พารามิเตอร์นี้ไม่ได้ใช้ในตัวฟังก์ชันโดยตรง แต่จำเป็นสำหรับกลไก cache ของ Streamlit)
    """
    files = discover_files(data_dir)
    if not files:
        return pd.DataFrame(columns=EXPECTED_COLUMNS + ["source_file"])

    frames = []
    for f in files:
        try:
            frames.append(_read_one_file_cached(f.path, f.mtime, f.size))
        except Exception as e:  # ไฟล์เสียหรือรูปแบบไม่ตรง -> ข้ามแต่แจ้งเตือน ไม่ทำให้ทั้งแอปล่ม
            st.warning(f"⚠️ ข้ามไฟล์ **{f.name}** เนื่องจากอ่านไม่สำเร็จ: {e}")

    if not frames:
        return pd.DataFrame(columns=EXPECTED_COLUMNS + ["source_file"])

    df = pd.concat(frames, ignore_index=True)

    # ตรวจสอบคอลัมน์ที่ขาดหายไปเทียบกับที่คาดหวัง (เตือนแต่ไม่บล็อกการทำงาน)
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        st.warning(f"⚠️ พบว่าไฟล์ข้อมูลขาดคอลัมน์: {', '.join(missing)} — บางส่วนของแดชบอร์ดอาจแสดงผลไม่ครบ")

    return df


def get_data(data_dir: str = DATA_DIR_DEFAULT) -> tuple[pd.DataFrame, list[DiscoveredFile]]:
    """
    ฟังก์ชันเดิมที่คืนค่า (DataFrame ดิบ, รายการไฟล์) — เก็บไว้เพื่อความเข้ากันได้/ใช้ debug
    แอปหลัก (app.py) ใช้ pipeline.build_dashboard_bundle() แทน เพราะเร็วกว่ามากเมื่อสลับหน้าเมนู
    """
    files = discover_files(data_dir)
    signature = folder_signature(data_dir)
    df = load_raw_data(data_dir, signature)
    return df, files
