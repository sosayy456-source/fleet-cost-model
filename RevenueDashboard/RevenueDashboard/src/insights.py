"""
insights.py
============
สร้าง "ข้อความ insight" อัตโนมัติจากตัวเลขที่คำนวณได้ (ไม่ใช่ข้อความตายตัว)
เพื่อให้เมื่อเปลี่ยนไฟล์ข้อมูลจริง (29 ไฟล์) ข้อความจะเปลี่ยนตามข้อมูลใหม่โดยอัตโนมัติ

แต่ละฟังก์ชันคืนค่าเป็น list[dict] ที่มี level ระบุความรุนแรง (info / warn / alert / ok)
เพื่อให้ app.py นำไปแสดงเป็นการ์ด insight ได้ง่าย

หมายเหตุ: ข้อความใช้แท็ก HTML <b>...</b> สำหรับตัวหนา (ไม่ใช้ **...** แบบ markdown)
เพราะ app.py แสดงผลข้อความเหล่านี้ผ่าน st.markdown(..., unsafe_allow_html=True)
ภายใน <div> ของตัวเอง ซึ่ง **...** จะไม่ถูกแปลงเป็นตัวหนาให้อัตโนมัติในบริบทนี้
"""

from __future__ import annotations
import pandas as pd


def _fmt_thb(n: float) -> str:
    """จัดรูปแบบจำนวนเงินบาท พร้อมเครื่องหมายคั่นหลักพัน เช่น ฿1,234,567"""
    return f"฿{n:,.0f}"


def _fmt_num(n: float) -> str:
    """จัดรูปแบบตัวเลขทั่วไป พร้อมเครื่องหมายคั่นหลักพัน เช่น 1,234"""
    return f"{n:,.0f}"


def _fmt_pct(n: float, digits: int = 1) -> str:
    return f"{n:.{digits}f}%"


MONTH_TH = {1: "ม.ค.", 2: "ก.พ.", 3: "มี.ค.", 4: "เม.ย.", 5: "พ.ค.", 6: "มิ.ย.",
            7: "ก.ค.", 8: "ส.ค.", 9: "ก.ย.", 10: "ต.ค.", 11: "พ.ย.", 12: "ธ.ค."}


def _month_label(period_str: str) -> str:
    try:
        y, m = period_str.split("-")
        return f"{MONTH_TH[int(m)]} {int(y) + 543 - 2500}"
    except Exception:
        return period_str


def revenue_insights(monthly_df: pd.DataFrame, total_revenue: float) -> list[dict]:
    out = []
    if monthly_df.empty or len(monthly_df) < 2:
        return [dict(level="info", text="ยังมีข้อมูลไม่พอสำหรับวิเคราะห์แนวโน้มรายเดือน (ต้องการอย่างน้อย 2 เดือน)")]

    best = monthly_df.loc[monthly_df["revenue"].idxmax()]
    worst = monthly_df.loc[monthly_df["revenue"].idxmin()]
    out.append(dict(
        level="info",
        text=(
            f"เดือนที่รายได้สูงสุดคือ <b>{_month_label(best['month'])}</b> ({_fmt_thb(best['revenue'])}) "
            f"ส่วนเดือนที่รายได้ต่ำสุดคือ <b>{_month_label(worst['month'])}</b> ({_fmt_thb(worst['revenue'])})"
        ),
    ))

    last = monthly_df.iloc[-1]
    if pd.notna(last.get("growth_pct")):
        direction = "เพิ่มขึ้น" if last["growth_pct"] >= 0 else "ลดลง"
        level = "warn" if last["growth_pct"] < -10 else "info"
        out.append(dict(
            level=level,
            text=(
                f"รายได้เดือนล่าสุด ({_month_label(last['month'])}) {direction} "
                f"<b>{_fmt_pct(abs(last['growth_pct']))}</b> เทียบกับเดือนก่อนหน้า"
            ),
        ))

    # เช็คความผันผวนของจำนวนบิลต่อเดือน (บ่งชี้ขนาดตัวอย่าง/ฤดูกาลไม่สม่ำเสมอ)
    if monthly_df["bills"].std() / monthly_df["bills"].mean() > 0.15:
        out.append(dict(
            level="warn",
            text=(
                "จำนวนบิลต่อเดือนมีความผันผวนค่อนข้างสูงระหว่างเดือน ควรตรวจสอบว่าเกิดจากฤดูกาลของธุรกิจจริง "
                "หรือจากขนาดข้อมูลที่ไม่เท่ากันในแต่ละไฟล์"
            ),
        ))

    return out


def payment_insights(payment_df: pd.DataFrame, total_revenue: float) -> list[dict]:
    if payment_df.empty or total_revenue == 0:
        return [dict(level="info", text="ยังไม่มีข้อมูลวิธีชำระเงินให้วิเคราะห์")]

    out = []
    top = payment_df.iloc[0]
    out.append(dict(
        level="info",
        text=(
            f"<b>{top['ประเภทการชำระเงิน']}</b> เป็นวิธีชำระเงินที่สร้างรายได้มากที่สุด คิดเป็น "
            f"<b>{_fmt_pct(top['revenue'] / total_revenue * 100)}</b> ของรายได้รวม "
            f"({_fmt_thb(top['revenue'])} จาก {_fmt_num(top['bills'])} บิล)"
        ),
    ))

    credit_mask = payment_df["ประเภทการชำระเงิน"].astype(str).str.startswith("เชื่อ")
    credit_rev = payment_df.loc[credit_mask, "revenue"].sum()
    credit_bills = payment_df.loc[credit_mask, "bills"].sum()
    if credit_rev > 0:
        level = "warn" if credit_rev / total_revenue > 0.3 else "info"
        out.append(dict(
            level=level,
            text=(
                f"บิลแบบเครดิตมีสัดส่วน <b>{_fmt_pct(credit_rev / total_revenue * 100)}</b> ของรายได้ "
                f"({_fmt_thb(credit_rev)} จาก {_fmt_num(credit_bills)} บิล) — "
                f"เป็นกลุ่มความเสี่ยงลูกหนี้การค้าหลักที่ควรติดตามอายุหนี้"
            ),
        ))

    return out


def customer_insights(pareto: dict) -> list[dict]:
    if pareto.get("total_customers", 0) == 0:
        return [dict(level="info", text="ยังไม่มีข้อมูลลูกค้าให้วิเคราะห์")]

    out = [dict(
        level="info",
        text=(
            f"ลูกค้าเพียง <b>{_fmt_pct(pareto['pct_customers_for_80pct'])}</b> ของฐานลูกค้าทั้งหมด "
            f"({_fmt_num(pareto['n_for_80pct'])} จาก {_fmt_num(pareto['total_customers'])} ราย) "
            f"สร้างรายได้ถึง <b>80%</b> ของรายได้รวม"
        ),
    )]

    c = pareto.get("concentration", {})
    if c.get("top_1pct") is not None:
        level = "warn" if c["top_1pct"] > 25 else "info"
        out.append(dict(
            level=level,
            text=(
                f"ลูกค้ากลุ่มบนสุด 1% สร้างรายได้ถึง <b>{_fmt_pct(c['top_1pct'])}</b> ของรายได้รวม — "
                f"บ่งชี้การพึ่งพาลูกค้ารายใหญ่จำนวนน้อย ควรมีมาตรการรักษาความสัมพันธ์เป็นพิเศษ"
            ),
        ))
    return out


def quality_insights(dq: dict) -> list[dict]:
    out = []
    if dq.get("duplicate_rows", 0) > 0:
        out.append(dict(
            level="alert",
            text=(
                f"พบแถวข้อมูลซ้ำสมบูรณ์ <b>{_fmt_num(dq['duplicate_rows'])} แถว</b> "
                f"(มูลค่าเสี่ยงนับซ้ำ {_fmt_thb(dq['duplicate_revenue_at_risk'])}) — ควรตรวจสอบก่อนใช้สรุปยอดทางการเงิน"
            ),
        ))
    if dq.get("unpaid_count", 0) > 0:
        out.append(dict(
            level="alert",
            text=(
                f"มีบิลที่ยังไม่ได้ชำระเงิน <b>{_fmt_num(dq['unpaid_count'])} บิล</b> "
                f"มูลค่ารวม {_fmt_thb(dq['unpaid_amount'])} — ควรติดตามร่วมกับฝ่ายบัญชีเพื่อประเมินความเสี่ยงกระแสเงินสด"
            ),
        ))
    if dq.get("uncleared_count", 0) > 0:
        out.append(dict(
            level="warn",
            text=(
                f"มีบิลสถานะ \"ตัดจบ\" (ไม่ใช่ \"จบ\" ตามปกติ) <b>{_fmt_num(dq['uncleared_count'])} บิล</b> "
                f"มูลค่ารวม {_fmt_thb(dq['uncleared_amount'])} ควรตรวจสอบความหมายกับฝ่ายที่เกี่ยวข้อง"
            ),
        ))
    if dq.get("bad_dimension_rows", 0) > 0:
        out.append(dict(
            level="warn",
            text=(
                f"พบ <b>{_fmt_num(dq['bad_dimension_rows'])} แถว</b> ที่ค่าขนาดสินค้า (กว้าง/ยาว/สูง) ผิดปกติ (เกิน 100 เมตร) "
                f"น่าจะเป็นข้อผิดพลาดจากการป้อนข้อมูล"
            ),
        ))
    if dq.get("bad_date_rows", 0) > 0:
        out.append(dict(
            level="alert",
            text=(
                f"พบ <b>{_fmt_num(dq['bad_date_rows'])} แถว</b> ที่แปลงวันที่ไม่สำเร็จ (รูปแบบวันที่ไม่ตรงตามที่คาด) — "
                f"แถวเหล่านี้จะไม่ถูกนับในกราฟแนวโน้มรายเดือน"
            ),
        ))
    if not out:
        out.append(dict(level="ok", text="ไม่พบความผิดปกติที่สำคัญในข้อมูลชุดนี้"))
    return out
