"""
pipeline.py
============
รวมทุกขั้นตอน (โหลดไฟล์ → ทำความสะอาด → คำนวณ KPI ทั้งหมด) ไว้ใน "ฟังก์ชันเดียว" ที่ cache
ด้วย st.cache_data โดยอิง **เฉพาะ key ที่เป็นข้อมูลเล็กๆ** (path ของโฟลเดอร์ + ลายเซ็นของไฟล์)

ทำไมต้องรวมเป็นฟังก์ชันเดียว (เหตุผลด้านประสิทธิภาพ):
--------------------------------------------------------
เดิมโค้ดแยกเป็น 2 ฟังก์ชัน cache ต่อกัน คือ
    load_raw_data(data_dir, signature) -> df_raw     (cache ด้วย signature ซึ่งเบามาก โอเค)
    clean_data(df_raw) -> df_clean                    (cache ด้วยตัว df_raw เอง!)

ปัญหาคือ st.cache_data ต้อง "แฮช" อาร์กิวเมนต์ทุกตัวที่ส่งเข้าไป เพื่อเช็คว่าเคยเรียกด้วย
อินพุตนี้มาก่อนหรือยัง — การแฮช DataFrame ขนาดใหญ่ (เช่น หลักแสนถึงหลักล้านแถวเมื่อใช้ไฟล์จริง
ทั้ง 29 ไฟล์) ต้องไล่อ่านข้อมูลทั้งก้อนทุกครั้ง ซึ่งเกิดขึ้น **ทุกครั้งที่ Streamlit rerun สคริปต์**
(เช่น ทุกครั้งที่ผู้ใช้คลิกเปลี่ยนเมนูด้านซ้าย) แม้ข้อมูลจะไม่ได้เปลี่ยนเลยก็ตาม
นี่คือสาเหตุหลักที่แดชบอร์ดช้าเวลาสลับหน้าเมนูเมื่อข้อมูลมีขนาดใหญ่ขึ้น

วิธีแก้: รวมทุกอย่างเป็นฟังก์ชันเดียวที่รับเฉพาะ (data_dir, folder_signature) ซึ่งเป็นสตริง/ทูเพิล
เล็กๆ เป็น cache key — Streamlit เช็คแค่ key เล็กๆ นี้ (เร็วมาก แทบไม่มีต้นทุน) แล้วคืนผลลัพธ์
ที่คำนวณไว้แล้วจากหน่วยความจำทันที โดยไม่ต้องแตะ DataFrame ขนาดใหญ่เลยจนกว่าไฟล์ในโฟลเดอร์
จะเปลี่ยนแปลงจริง (มีไฟล์ใหม่ / ไฟล์ถูกแก้ / ไฟล์ถูกลบ)

ผลลัพธ์ที่คืนมาเป็น "bundle" (dict) ที่รวมเฉพาะตารางสรุปขนาดเล็ก (ไม่กี่สิบ-ไม่กี่ร้อยแถว)
ที่หน้าต่างๆ ของแอปต้องใช้ ทำให้แต่ละหน้าไม่ต้องคำนวณ groupby ซ้ำเองอีก
"""

from __future__ import annotations
import streamlit as st

from . import kpi
from .cleaning import clean_data
from .data_loader import load_raw_data, discover_files, folder_signature, DiscoveredFile


@st.cache_data(show_spinner="กำลังประมวลผลข้อมูลทั้งหมด (โหลด + ทำความสะอาด + คำนวณ KPI)...")
def build_dashboard_bundle(data_dir: str, folder_signature: tuple) -> dict:
    """
    จุดคำนวณเดียวของทั้งแอป — โหลด ทำความสะอาด และคำนวณ KPI ทุกตัวที่หน้าต่างๆ ต้องใช้
    cache key คือ (data_dir, folder_signature) เท่านั้น จึงเร็วมากเมื่อข้อมูลไม่เปลี่ยน
    """
    df_raw = load_raw_data(data_dir, folder_signature)
    df = clean_data(df_raw)

    if df.empty:
        return dict(is_empty=True)

    overview = kpi.overview_kpis(df)
    monthly = kpi.monthly_trend(df)
    payment = kpi.payment_method_summary(df)
    payment_monthly = kpi.payment_method_monthly(df)
    product = kpi.product_type_summary(df)
    pricing = kpi.pricing_type_summary(df)
    routes = kpi.top_routes(df, n=15)
    distline = kpi.top_by_column(df, "สายกระจาย", n=15)
    dow = kpi.day_of_week_summary(df)
    customer = kpi.customer_summary(df, "ผู้รับ_encoded")
    pareto = kpi.pareto_analysis(customer)
    dq = kpi.data_quality_report(df)

    # สรุปสถานะบิล (ใช้ในหน้า Bill Analysis)
    if "สถานะบิล" in df.columns:
        bill_status = df.groupby("สถานะบิล")["เลขที่บิล"].nunique().reset_index()
        bill_status.columns = ["สถานะบิล", "count"]
    else:
        bill_status = None

    # ยอดค้างชำระแยกตามวิธีชำระเงิน (ใช้ในหน้า Outstanding)
    if "flag_unpaid" in df.columns:
        unpaid_df = df[df["flag_unpaid"]]
        if len(unpaid_df):
            unpaid_by_payment = (
                unpaid_df.groupby("ประเภทการชำระเงิน")
                .agg(count=("เลขที่บิล", "nunique"), amount=("ราคารวม", "sum"))
                .reset_index()
            )
        else:
            unpaid_by_payment = None
    else:
        unpaid_by_payment = None

    # ตัวอย่างแถวที่มีปัญหา (ใช้ในหน้า Data Quality — เก็บแค่ตัวอย่างเล็กๆ ไม่ใช่ทั้งตาราง)
    dup_sample = df[df.duplicated(keep=False)].sort_values("เลขที่บิล").head(50)
    bad_dim_cols = [c for c in ["เลขที่บิล", "ชื่อสินค้า", "กว้าง", "ยาว", "สูง", "ราคารวม", "source_file"] if c in df.columns]
    bad_dim_sample = df.loc[df["flag_bad_dimension"], bad_dim_cols].head(50) if "flag_bad_dimension" in df.columns else None

    return dict(
        is_empty=False,
        overview=overview,
        monthly=monthly,
        payment=payment,
        payment_monthly=payment_monthly,
        product=product,
        pricing=pricing,
        bill_status=bill_status,
        routes=routes,
        distline=distline,
        dow=dow,
        customer=customer,
        pareto=pareto,
        dq=dq,
        unpaid_by_payment=unpaid_by_payment,
        dup_sample=dup_sample,
        bad_dim_sample=bad_dim_sample,
        n_rows=len(df),
    )
