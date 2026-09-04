"""
kpi.py
=======
คำนวณตัวชี้วัด (KPI) และตารางสรุปต่างๆ จาก DataFrame ที่ทำความสะอาดแล้ว (clean_data ใน cleaning.py)

ทุกฟังก์ชันรับ DataFrame เข้ามาและคืนค่าเป็น DataFrame/dict ล้วนๆ (ไม่ผูกกับ UI)
เพื่อให้ app.py นำไปแสดงผลได้อย่างอิสระ และเขียนเทสต์ได้ง่ายในอนาคต
"""

from __future__ import annotations
import pandas as pd


def overview_kpis(df: pd.DataFrame) -> dict:
    if df.empty:
        return dict(total_revenue=0, distinct_bills=0, total_line_items=0,
                     avg_bill_value=0, date_min=None, date_max=None)
    return dict(
        total_revenue=float(df["ราคารวม"].sum()),
        distinct_bills=int(df["เลขที่บิล"].nunique()),
        total_line_items=int(len(df)),
        avg_bill_value=float(df.groupby("เลขที่บิล")["ราคารวม"].sum().mean()),
        date_min=df["date"].min(),
        date_max=df["date"].max(),
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
    if df.empty or "route" not in df.columns:
        return pd.DataFrame(columns=["route", "revenue", "lines"])
    return (
        df.groupby("route")
        .agg(revenue=("ราคารวม", "sum"), lines=("เลขที่บิล", "count"))
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


def data_quality_report(df: pd.DataFrame) -> dict:
    if df.empty:
        return dict(
            duplicate_rows=0, duplicate_revenue_at_risk=0.0,
            unpaid_count=0, unpaid_amount=0.0,
            uncleared_count=0, uncleared_amount=0.0,
            bad_dimension_rows=0, bad_date_rows=0,
            extreme_bill_threshold=0.0, extreme_bill_count=0,
        )

    dup_mask = df.duplicated()
    unpaid = df[df["flag_unpaid"]] if "flag_unpaid" in df.columns else df.iloc[0:0]
    uncleared = df[df["flag_uncleared"]] if "flag_uncleared" in df.columns else df.iloc[0:0]
    threshold = float(df["ราคารวม"].quantile(0.999)) if df["ราคารวม"].notna().any() else 0.0

    return dict(
        duplicate_rows=int(dup_mask.sum()),
        duplicate_revenue_at_risk=float(df.loc[dup_mask, "ราคารวม"].sum()),
        unpaid_count=int(unpaid["เลขที่บิล"].nunique()) if len(unpaid) else 0,
        unpaid_amount=float(unpaid["ราคารวม"].sum()) if len(unpaid) else 0.0,
        uncleared_count=int(uncleared["เลขที่บิล"].nunique()) if len(uncleared) else 0,
        uncleared_amount=float(uncleared["ราคารวม"].sum()) if len(uncleared) else 0.0,
        bad_dimension_rows=int(df["flag_bad_dimension"].sum()) if "flag_bad_dimension" in df.columns else 0,
        bad_date_rows=int(df["flag_bad_date"].sum()) if "flag_bad_date" in df.columns else 0,
        extreme_bill_threshold=threshold,
        extreme_bill_count=int((df["ราคารวม"] >= threshold).sum()) if threshold else 0,
    )
