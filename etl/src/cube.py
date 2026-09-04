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

ข้อควรระวังเรื่อง bills
-----------------------
`revenue` กับ `lines` เป็น sum/count จึงบวกข้ามเซลล์ได้ตรง
แต่ `bills` เป็น nunique ของเลขที่บิล — ถ้าบิลใบเดียวมีหลายรายการที่ตกคนละเซลล์
การบวก bills ข้ามเซลล์จะ **นับเกิน** ค่าที่ได้จึงเป็นขอบบน ไม่ใช่ค่าจริง
ยอดที่ต้องเป๊ะให้ใช้ตัวเลขจาก overview.json / monthly.json ที่คำนวณจากแถวดิบแล้ว
(ดู field `bills_exact` ใน manifest ว่าจุดไหนเชื่อได้)
"""

from __future__ import annotations

import pandas as pd

# มิติที่ผู้ใช้กรองจริงบนหน้าแดชบอร์ด
CUBE_DIMENSIONS = [
    "month",
    "ประเภทการชำระเงิน",
    "ประเภทสินค้า",
    "ประเภทการคิดราคา",
    "สถานะบิล",
    "สถานะการชำระเงิน",
    "สายกระจาย",
]

# มิติที่ cardinality สูงเกินจะใส่ใน cube (เส้นทาง/ลูกค้า) ส่งเป็นตาราง top-N แยก
HIGH_CARDINALITY = ["route", "ผู้รับ_encoded"]


def build_cube(df: pd.DataFrame, dimensions: list[str] | None = None) -> pd.DataFrame:
    """ยุบเป็นตารางสรุปตามมิติที่กำหนด"""
    dims = [d for d in (dimensions or CUBE_DIMENSIONS) if d in df.columns]
    if df.empty or not dims:
        return pd.DataFrame(columns=[*dims, "revenue", "lines", "bills"])

    work = df.copy()
    for d in dims:
        work[d] = work[d].astype("string").fillna("(ไม่ระบุ)")
        work.loc[work[d].str.strip() == "", d] = "(ไม่ระบุ)"

    cube = (
        work.groupby(dims, dropna=False, observed=True)
        .agg(
            revenue=("ราคารวม", "sum"),
            lines=("เลขที่บิล", "count"),
            bills=("เลขที่บิล", "nunique"),
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
