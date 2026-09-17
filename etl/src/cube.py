"""
cube.py
=======
ยุบข้อมูลรายแถวให้เป็นตารางสรุปหลายมิติ (cube) ที่ยังกรองได้ในเบราว์เซอร์

ทำไมต้องมี
----------
แดชบอร์ด Streamlit เดิมคำนวณผลรวมสำเร็จรูปแล้วทิ้ง DataFrame ทิ้ง (pipeline.py:37)
ทำให้ **กรองอะไรไม่ได้เลย** — ทั้งแอปไม่มี filter สักตัว
แต่จะส่งแถวดิบเข้าเบราว์เซอร์ก็ไม่ไหว ข้อมูลจริง 29 เดือนมีหลายล้านแถว

cube คือทางสายกลาง: ยุบตามชุดมิติที่ใช้กรองจริง เหลือหลักพันแถว
แล้วให้เบราว์เซอร์ re-aggregate เอาเองเมื่อผู้ใช้เปลี่ยน filter

ข้อควรระวังเรื่อง bills กับ trips
---------------------------------
`revenue` กับ `lines` เป็น sum/count จึงบวกข้ามเซลล์ได้ตรง
แต่ `bills` กับ `trips` เป็น nunique — ถ้าบิล/ใบรายการเดียวมีหลายรายการที่ตกคนละเซลล์
การบวกข้ามเซลล์จะ **นับเกิน** ค่าที่ได้จึงเป็นขอบบน ไม่ใช่ค่าจริง
ยอดที่ต้องเป๊ะให้ใช้ตัวเลขจาก overview.json / monthly.json ที่คำนวณจากแถวดิบแล้ว
(ดู field `bills_exact` ใน manifest ว่าจุดไหนเชื่อได้)

★ กติกาฝั่งหน้าจอ: **ไม่ได้กรอง = อ่านจาก overview.json (เป๊ะ) · กรองแล้ว = คำนวณจาก cube
  แล้วติดป้ายว่าจำนวนบิล/เที่ยวเป็นค่าประมาณขอบบน** ห้ามเอา bills จาก cube ไปโชว์เฉย ๆ
"""

from __future__ import annotations

import pandas as pd

# มิติที่ผู้ใช้กรองจริงบนหน้าแดชบอร์ด — ตรงกับแถบตัวกรองในสเปก (17 ก.ย. 2569)
#
# ★ เลือกเฉพาะที่ "มีช่องกรองจริง" เท่านั้น ทุกมิติที่เพิ่มเข้ามาคูณจำนวนแถวของ cube
#   วัดกับข้อมูลจริงเดือนเดียว (186,862 แถว):
#       5 มิติชุดนี้           704 แถว    269 KB
#       + เกณฑ์คิดราคา/สถานะบิล/สายกระจาย  2,885 แถว  1,632 KB   (6 เท่า)
#   สามมิติหลังไม่มีช่องกรองในสเปก และมีไฟล์ยอดรวมของตัวเองอยู่แล้ว
#   (pricing.json / bill_status.json / distline.json) จึงไม่ต้องอยู่ใน cube
#
# ★ route อยู่ใน cube ได้เพราะเป็นคู่ต้นทาง-ปลายทางที่ซ้ำกันเยอะ (244 เส้นทาง)
#   ส่วนลูกค้า (ผู้รับ_encoded) ยังใส่ไม่ได้ — ข้อมูลจริงมี 44,543 ราย cube จะระเบิด
CUBE_DIMENSIONS = [
    "month",
    "route",
    "ประเภทสินค้า",
    "ประเภทการชำระเงิน",
    "สถานะการชำระเงิน",
]

# มิติที่ cardinality สูงเกินจะใส่ใน cube (เส้นทาง/ลูกค้า) ส่งเป็นตาราง top-N แยก
HIGH_CARDINALITY = ["route", "ผู้รับ_encoded"]


def build_cube(df: pd.DataFrame, dimensions: list[str] | None = None) -> pd.DataFrame:
    """ยุบเป็นตารางสรุปตามมิติที่กำหนด"""
    dims = [d for d in (dimensions or CUBE_DIMENSIONS) if d in df.columns]
    if df.empty or not dims:
        return pd.DataFrame(columns=[*dims, "revenue", "lines", "bills"])

    # ★ ก๊อปเฉพาะคอลัมน์ที่ใช้ ไม่ใช่ทั้งตาราง — ข้อมูลจริงมี 5 ล้านแถว
    #   df.copy() ทั้งก้อนคือการจองหน่วยความจำเพิ่มอีกเท่าตัวโดยไม่ได้ใช้
    measures = [c for c in ("ราคารวม", "เลขที่บิล", "เลขที่ใบรายการ") if c in df.columns]
    work = df[[*dims, *measures]].copy()
    for d in dims:
        # แปลงเป็นสตริงทีละคอลัมน์แล้วยุบกลับเป็น category ทันที
        # ถ้าปล่อยทุกคอลัมน์เป็นสตริงค้างไว้ จะกินเพิ่มอีกหลายร้อย MB
        s = work[d].astype("string").fillna("(ไม่ระบุ)")
        work[d] = s.where(s.str.strip() != "", "(ไม่ระบุ)").astype("category")

    cube = (
        work.groupby(dims, dropna=False, observed=True)
        .agg(
            revenue=("ราคารวม", "sum"),
            lines=("เลขที่บิล", "count"),
            bills=("เลขที่บิล", "nunique"),
            **({"trips": ("เลขที่ใบรายการ", "nunique")}
               if "เลขที่ใบรายการ" in work.columns else {}),
        )
        .reset_index()
        .sort_values("revenue", ascending=False)
    )
    return cube


def dimension_values(cube: pd.DataFrame, dimensions: list[str] | None = None) -> dict:
    """รายการค่าที่เป็นไปได้ของแต่ละมิติ ไว้ให้ UI สร้าง dropdown"""
    dims = [d for d in (dimensions or CUBE_DIMENSIONS) if d in cube.columns]
    return {d: sorted(cube[d].dropna().unique().tolist()) for d in dims}


def cube_stats(df: pd.DataFrame, cube: pd.DataFrame) -> dict:
    """สรุปว่ายุบได้เท่าไหร่ และเตือนถ้า cube ใหญ่เกินจะส่งเข้าเบราว์เซอร์"""
    rows_in = int(len(df))
    rows_out = int(len(cube))
    return {
        "source_rows": rows_in,
        "cube_rows": rows_out,
        "compression": round(rows_in / rows_out, 1) if rows_out else None,
        "dimensions": [d for d in CUBE_DIMENSIONS if d in cube.columns],
    }
