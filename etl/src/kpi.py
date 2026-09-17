"""
kpi.py
=======
คำนวณตัวชี้วัด (KPI) และตารางสรุปต่างๆ จาก DataFrame ที่ทำความสะอาดแล้ว (clean_data ใน cleaning.py)

ทุกฟังก์ชันรับ DataFrame เข้ามาและคืนค่าเป็น DataFrame/dict ล้วนๆ (ไม่ผูกกับ UI)
เพื่อให้ app.py นำไปแสดงผลได้อย่างอิสระ และเขียนเทสต์ได้ง่ายในอนาคต
"""

from __future__ import annotations
import pandas as pd


# ประเภทสินค้าที่ไม่ใช่ "สินค้า" จริง — นับแยกเป็น KPI ของตัวเอง
# ★ product_type_summary() ยังส่งออกครบทุกประเภทตามเดิม ให้ตารางเห็นของจริง
#   ฝั่งหน้าจอเป็นคนกันออกจากโดนัทเอง (เพื่อนถามไว้ในสเปกว่า "บิลเคลียร์ — ? เอาไหมนะ")
BILL_CLEAR = "บิลเคลียร์"
# ★ คิดจากฝั่ง "ยังไม่ได้ชำระ" แล้วหักออก ไม่ใช่จับคู่ป้ายฝั่งชำระ
#   ไฟล์จริงเขียนฝั่งชำระว่า "การเงินรับชำระเงิน" ไม่ใช่ "ชำระแล้ว" อย่างที่คาด
#   ถ้าจับคู่ป้ายฝั่งชำระตรง ๆ จะได้ยอดชำระ 0 กับ collection rate 0% เงียบ ๆ (เจอจริง)
#   ฝั่งค้างชำระมีป้ายเดียวมาตลอด เทียบทางนี้จึงทนกว่า
UNPAID_STATUS = "ยังไม่ได้ชำระ"


def _sum_where(df: pd.DataFrame, col: str, value: str) -> tuple[float, int]:
    """(ยอดรวม, จำนวนบิลไม่ซ้ำ) ของแถวที่คอลัมน์นั้นเท่ากับค่าที่ให้ — ไม่มีคอลัมน์ก็คืนศูนย์"""
    if col not in df.columns:
        return 0.0, 0
    hit = df[df[col].astype("string").str.strip() == value]
    if hit.empty:
        return 0.0, 0
    return float(hit["ราคารวม"].sum()), int(hit["เลขที่บิล"].nunique())


def overview_kpis(df: pd.DataFrame) -> dict:
    """ตัวเลขหัวหน้า Overview

    ★ trips นับจาก "เลขที่ใบรายการ" ที่ไม่ซ้ำ — หนึ่งใบรายการ = หนึ่งเที่ยววิ่ง
      ไม่ใช่จำนวนบิล (บิลหลายใบขึ้นรถเที่ยวเดียวกันได้) และไม่ใช่จำนวนแถว (หนึ่งบิลมีหลายรายการ)
    ★ ยอด "ชำระแล้ว/ยังไม่ชำระ" มาจากคอลัมน์ สถานะการชำระเงิน ในไฟล์บิล
      ซึ่ง **ไม่มีวันครบกำหนด** จึงแยก "เกินกำหนด" ไม่ได้ที่นี่ — อยู่ในชุดใบวางบิลเท่านั้น
    """
    if df.empty:
        return dict(total_revenue=0, distinct_bills=0, total_line_items=0,
                     avg_bill_value=0, date_min=None, date_max=None,
                     trips=0, customers=0, avg_trip_value=0, avg_customer_value=0,
                     paid_amount=0, paid_bills=0, unpaid_amount=0, unpaid_bills=0,
                     collection_rate=None, bill_clear_amount=0, bill_clear_bills=0,
                     bill_clear_pct=None)

    total = float(df["ราคารวม"].sum())
    trips = int(df["เลขที่ใบรายการ"].nunique()) if "เลขที่ใบรายการ" in df.columns else 0
    customers = int(df["ผู้รับ_encoded"].nunique()) if "ผู้รับ_encoded" in df.columns else 0
    unpaid_amt, unpaid_bills = _sum_where(df, "สถานะการชำระเงิน", UNPAID_STATUS)
    clear_amt, clear_bills = _sum_where(df, "ประเภทสินค้า", BILL_CLEAR)
    bills = int(df["เลขที่บิล"].nunique())

    return dict(
        total_revenue=total,
        distinct_bills=bills,
        total_line_items=int(len(df)),
        avg_bill_value=float(df.groupby("เลขที่บิล")["ราคารวม"].sum().mean()),
        date_min=df["date"].min(),
        date_max=df["date"].max(),
        trips=trips,
        customers=customers,
        avg_trip_value=total / trips if trips else 0.0,
        avg_customer_value=total / customers if customers else 0.0,
        paid_amount=total - unpaid_amt,
        paid_bills=max(bills - unpaid_bills, 0),
        unpaid_amount=unpaid_amt,
        unpaid_bills=unpaid_bills,
        collection_rate=(total - unpaid_amt) / total * 100 if total else None,
        bill_clear_amount=clear_amt,
        bill_clear_bills=clear_bills,
        bill_clear_pct=clear_bills / bills * 100 if bills else None,
    )


def monthly_trend(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["month", "revenue", "bills", "lines", "avg_bill_value", "growth_pct"])
    m = (
        df.groupby("month")
        .agg(revenue=("ราคารวม", "sum"), bills=("เลขที่บิล", "nunique"), lines=("เลขที่บิล", "count"))
        .reset_index()
        .sort_values("month")
    )
    m["avg_bill_value"] = m["revenue"] / m["bills"].replace(0, pd.NA)
    m["growth_pct"] = m["revenue"].pct_change() * 100
    return m


def payment_method_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "ประเภทการชำระเงิน" not in df.columns:
        return pd.DataFrame(columns=["ประเภทการชำระเงิน", "revenue", "bills"])
    return (
        df.groupby("ประเภทการชำระเงิน")
        .agg(revenue=("ราคารวม", "sum"), bills=("เลขที่บิล", "nunique"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    )


def payment_method_monthly(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["month", "ประเภทการชำระเงิน", "ราคารวม"])
    return df.groupby(["month", "ประเภทการชำระเงิน"])["ราคารวม"].sum().reset_index()


def product_type_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "ประเภทสินค้า" not in df.columns:
        return pd.DataFrame(columns=["ประเภทสินค้า", "revenue", "lines"])
    return (
        df.groupby("ประเภทสินค้า")
        .agg(revenue=("ราคารวม", "sum"), lines=("เลขที่บิล", "count"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    )


def pricing_type_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "ประเภทการคิดราคา" not in df.columns:
        return pd.DataFrame(columns=["ประเภทการคิดราคา", "revenue", "lines"])
    return (
        df.groupby("ประเภทการคิดราคา")
        .agg(revenue=("ราคารวม", "sum"), lines=("เลขที่บิล", "count"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    )


def top_routes(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """เส้นทางเรียงตามรายได้ — มีจำนวนบิลกับจำนวนเที่ยวกำกับด้วย

    ★ lines = จำนวนแถว (รายการสินค้า) · bills = เลขที่บิลไม่ซ้ำ · trips = เลขที่ใบรายการไม่ซ้ำ
      สามอย่างนี้ไม่เท่ากันและหมายคนละอย่าง — ของเดิมมีแต่ lines ซึ่งอ่านผิดเป็น "จำนวนบิล" ได้ง่าย
    """
    if df.empty or "route" not in df.columns:
        return pd.DataFrame(columns=["route", "revenue", "lines", "bills", "trips"])
    agg = {"revenue": ("ราคารวม", "sum"), "lines": ("เลขที่บิล", "count"),
           "bills": ("เลขที่บิล", "nunique")}
    if "เลขที่ใบรายการ" in df.columns:
        agg["trips"] = ("เลขที่ใบรายการ", "nunique")
    return (
        df.groupby("route")
        .agg(**agg)
        .reset_index()
        .sort_values("revenue", ascending=False)
        .head(n)
    )


def top_by_column(df: pd.DataFrame, col: str, n: int = 15) -> pd.DataFrame:
    if df.empty or col not in df.columns:
        return pd.DataFrame(columns=[col, "revenue", "lines"])
    return (
        df.groupby(col)
        .agg(revenue=("ราคารวม", "sum"), lines=("เลขที่บิล", "count"))
        .reset_index()
        .sort_values("revenue", ascending=False)
        .head(n)
    )


def day_of_week_summary(df: pd.DataFrame) -> pd.DataFrame:
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if df.empty:
        return pd.DataFrame({"dow": order, "revenue": 0, "lines": 0})
    d = df.groupby("dow").agg(revenue=("ราคารวม", "sum"), lines=("เลขที่บิล", "count")).reindex(order).reset_index()
    return d


def customer_summary(df: pd.DataFrame, id_col: str = "ผู้รับ_encoded") -> pd.DataFrame:
    if df.empty or id_col not in df.columns:
        return pd.DataFrame(columns=[id_col, "revenue", "bills"])
    c = (
        df.groupby(id_col)
        .agg(revenue=("ราคารวม", "sum"), bills=("เลขที่บิล", "nunique"))
        .reset_index()
        .sort_values("revenue", ascending=False)
    )
    return c


def pareto_analysis(customer_df: pd.DataFrame) -> dict:
    """รับผลลัพธ์จาก customer_summary() แล้วคำนวณ Pareto (80/20) analysis"""
    if customer_df.empty:
        return dict(total_customers=0, n_for_80pct=0, pct_customers_for_80pct=0.0,
                     curve=pd.DataFrame(columns=["cust_pct", "cum_pct"]), concentration={})

    c = customer_df.sort_values("revenue", ascending=False).reset_index(drop=True)
    total_rev = c["revenue"].sum()
    if total_rev == 0:
        return dict(total_customers=len(c), n_for_80pct=0, pct_customers_for_80pct=0.0,
                     curve=pd.DataFrame(columns=["cust_pct", "cum_pct"]), concentration={})

    c["cum_revenue"] = c["revenue"].cumsum()
    c["cum_pct"] = c["cum_revenue"] / total_rev * 100
    c["cust_pct"] = (c.index + 1) / len(c) * 100

    n_for_80 = int((c["cum_pct"] <= 80).sum()) + 1
    pct_for_80 = n_for_80 / len(c) * 100

    step = max(1, len(c) // 300)
    curve = c.iloc[::step][["cust_pct", "cum_pct"]].reset_index(drop=True)

    concentration = {}
    for pct in (1, 5, 10, 20):
        k = max(1, int(len(c) * pct / 100))
        concentration[f"top_{pct}pct"] = float(c.iloc[:k]["revenue"].sum() / total_rev * 100)

    return dict(
        total_customers=len(c),
        n_for_80pct=n_for_80,
        pct_customers_for_80pct=float(pct_for_80),
        curve=curve,
        concentration=concentration,
    )


def customer_segments(customer_df: pd.DataFrame) -> dict:
    """แบ่งลูกค้าเป็นช่วงอันดับแล้วรวมรายได้ — "REVENUE BY CUSTOMER SEGMENT" ในสเปก

    ★ สเปกต้นฉบับซอยเป็น Top 10 / 11-50 / 51-125 เพราะ mock มีลูกค้าแค่ 125 ราย
      ข้อมูลจริงมีหลักหมื่นถึงแสน ช่วงท้ายจึงใช้ "ที่เหลือ" แทนเลขตายตัว
    """
    if customer_df.empty:
        return {"segments": [], "total": 0.0}
    c = customer_df.sort_values("revenue", ascending=False).reset_index(drop=True)
    total = float(c["revenue"].sum())
    bounds = [(0, 10, "Top 10"), (10, 50, "อันดับ 11-50"), (50, 100, "อันดับ 51-100")]
    out = []
    for lo, hi, label in bounds:
        part = c.iloc[lo:hi]
        if part.empty:
            continue
        out.append({"label": label, "customers": int(len(part)),
                    "revenue": float(part["revenue"].sum())})
    rest = c.iloc[100:]
    if not rest.empty:
        out.append({"label": f"ที่เหลือ ({len(rest):,} ราย)", "customers": int(len(rest)),
                    "revenue": float(rest["revenue"].sum())})
    return {"segments": out, "total": total}


def low_revenue_customers(customer_df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """ลูกค้าที่รายได้ต่ำสุด — "LOW REVENUE CUSTOMERS" ในสเปก

    ★ ตัดรายที่รายได้ <= 0 ออก ไม่งั้นตารางจะเต็มไปด้วยลูกค้าที่ยอดเป็นศูนย์
      (บิลเคลียร์/ยกเลิก) ซึ่งไม่ใช่ "ลูกค้าที่ซื้อน้อย" ตามที่สเปกต้องการ
    """
    if customer_df.empty:
        return customer_df
    c = customer_df[customer_df["revenue"] > 0]
    return c.sort_values("revenue", ascending=True).head(n)


def data_quality_report(df: pd.DataFrame) -> dict:
    if df.empty:
        return dict(
            duplicate_rows=0, duplicate_revenue_at_risk=0.0,
            unpaid_count=0, unpaid_amount=0.0,
            cut_short_count=0, cut_short_amount=0.0,
            bad_dimension_rows=0, bad_date_rows=0,
            extreme_bill_threshold=0.0, extreme_bill_count=0,
        )

    dup_mask = df.duplicated()
    unpaid = df[df["flag_unpaid"]] if "flag_unpaid" in df.columns else df.iloc[0:0]
    cut_short = df[df["flag_cut_short"]] if "flag_cut_short" in df.columns else df.iloc[0:0]
    threshold = float(df["ราคารวม"].quantile(0.999)) if df["ราคารวม"].notna().any() else 0.0

    return dict(
        duplicate_rows=int(dup_mask.sum()),
        duplicate_revenue_at_risk=float(df.loc[dup_mask, "ราคารวม"].sum()),
        unpaid_count=int(unpaid["เลขที่บิล"].nunique()) if len(unpaid) else 0,
        unpaid_amount=float(unpaid["ราคารวม"].sum()) if len(unpaid) else 0.0,
        cut_short_count=int(cut_short["เลขที่บิล"].nunique()) if len(cut_short) else 0,
        cut_short_amount=float(cut_short["ราคารวม"].sum()) if len(cut_short) else 0.0,
        bad_dimension_rows=int(df["flag_bad_dimension"].sum()) if "flag_bad_dimension" in df.columns else 0,
        bad_date_rows=int(df["flag_bad_date"].sum()) if "flag_bad_date" in df.columns else 0,
        extreme_bill_threshold=threshold,
        extreme_bill_count=int((df["ราคารวม"] >= threshold).sum()) if threshold else 0,
    )
