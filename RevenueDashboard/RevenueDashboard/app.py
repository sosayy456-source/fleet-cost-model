"""
app.py
=======
Revenue Analysis Dashboard — แดชบอร์ดวิเคราะห์รายได้บิลขนส่ง (ทำงานบนเครื่อง Local เท่านั้น)

วิธีรัน:
    streamlit run app.py

ข้อมูลทั้งหมดอ่านจากโฟลเดอร์ data/ บนเครื่องนี้เท่านั้น ไม่มีการอัปโหลดออกไปที่ใด
เมื่อมีไฟล์ข้อมูลรายเดือนใหม่ ให้วางไฟล์ .xlsx ไว้ใน data/ แล้วกด "รีเฟรชข้อมูล" — ไม่ต้องแก้โค้ด

หมายเหตุด้านประสิทธิภาพ: หน้านี้ไม่คำนวณ KPI เองโดยตรง แต่เรียก
src.pipeline.build_dashboard_bundle() ซึ่ง cache ผลลัพธ์ทั้งหมดไว้เป็นก้อนเดียว
ทำให้การสลับเมนูรวดเร็ว แม้ข้อมูลจะมีหลายแสนถึงหลักล้านแถวก็ตาม (ดูรายละเอียดใน pipeline.py)
"""

import os
import sys

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.data_loader import DATA_DIR_DEFAULT, discover_files, folder_signature
from src.pipeline import build_dashboard_bundle
from src import insights as ins

# ----------------------------------------------------------------------------
# Page config & style
# ----------------------------------------------------------------------------
st.set_page_config(
    page_title="Revenue Analysis Dashboard",
    page_icon="🚚",
    layout="wide",
    initial_sidebar_state="expanded",
)

AMBER = "#E8A93C"
BLUE = "#5A8FBE"
RED = "#C1483F"
GREEN = "#6FA98A"
MUTE = "#8996A9"
PALETTE = [AMBER, BLUE, RED, GREEN, "#B08FD6", MUTE]

st.markdown("""
<style>
.block-container{padding-top:1.6rem; padding-bottom:3rem; max-width:1300px;}
[data-testid="stMetricValue"]{font-size:1.7rem; font-weight:700;}
[data-testid="stMetric"]{
    background:#161F2E; border:1px solid rgba(233,228,216,0.12); border-left:3px solid #E8A93C;
    border-radius:4px; padding:14px 16px 10px;
}
.insight-card{
    padding:12px 15px; border-radius:0 4px 4px 0; margin-bottom:8px; font-size:0.92rem; line-height:1.6;
    border-left:3px solid #E8A93C; background:rgba(233,228,216,0.04);
}
.insight-card.warn{border-left-color:#E8A93C;}
.insight-card.alert{border-left-color:#C1483F;}
.insight-card.ok{border-left-color:#6FA98A;}
.data-note{
    padding:10px 14px; border-radius:4px; background:rgba(193,72,63,0.10);
    border:1px solid rgba(193,72,63,0.35); font-size:0.85rem; margin-bottom:1rem;
}
</style>
""", unsafe_allow_html=True)

# ----------------------------------------------------------------------------
# Number formatting helpers — ทุกตัวเลขที่แสดงในแดชบอร์ดต้องมีเครื่องหมายคั่นหลักพัน
# ----------------------------------------------------------------------------
def fmt_thb(n) -> str:
    return f"฿{n:,.0f}"


def fmt_num(n) -> str:
    return f"{n:,.0f}"


def fmt_pct(n, digits: int = 1) -> str:
    return f"{n:.{digits}f}%"


MONEY_COL = lambda label: st.column_config.NumberColumn(label, format="%,.0f บาท")   # noqa: E731
COUNT_COL = lambda label: st.column_config.NumberColumn(label, format="%,d")          # noqa: E731

MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
DOW_TH = {"Monday": "จันทร์", "Tuesday": "อังคาร", "Wednesday": "พุธ", "Thursday": "พฤหัสฯ",
          "Friday": "ศุกร์", "Saturday": "เสาร์", "Sunday": "อาทิตย์"}


def month_label(period_str: str) -> str:
    try:
        y, m = period_str.split("-")
        return f"{MONTH_TH[int(m) - 1]} {int(y) + 543 - 2500}"
    except Exception:
        return period_str


def render_insight_cards(items):
    for it in items:
        st.markdown(f'<div class="insight-card {it["level"]}">{it["text"]}</div>', unsafe_allow_html=True)


def sample_notice(files):
    if any("random" in f.name.lower() for f in files):
        st.markdown(
            '<div class="data-note">⚠️ <b>กำลังแสดงข้อมูลตัวอย่าง (Randomed sample)</b> — '
            'ตัวเลขในหน้านี้เป็นแค่ตัวอย่างสำหรับทดสอบโครงสร้างแดชบอร์ด ไม่ใช่ยอดรายได้จริง '
            'เมื่อนำไฟล์ข้อมูลจริงมาวางแทนใน data/ ตัวเลขทั้งหมดจะอัปเดตอัตโนมัติโดยไม่ต้องแก้โค้ด</div>',
            unsafe_allow_html=True,
        )


# ----------------------------------------------------------------------------
# Sidebar — data source config
# ----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 🚚 Revenue Dashboard")
    st.caption("แดชบอร์ดวิเคราะห์รายได้บิลขนส่ง — ทำงานบนเครื่อง Local เท่านั้น")

    data_dir = st.text_input("📁 โฟลเดอร์ข้อมูล (data folder)", value=DATA_DIR_DEFAULT)

    if st.button("🔄 รีเฟรชข้อมูล", width='stretch'):
        st.cache_data.clear()
        st.rerun()

    st.divider()

    # ลำดับเมนู: Insight อัตโนมัติ ย้ายไปเป็นลำดับสุดท้าย (รองจาก Data Quality)
    page = st.radio(
        "เมนู",
        [
            "🏠 ภาพรวม (Home)",
            "📈 แนวโน้มรายได้ (Revenue Trend)",
            "💳 การชำระเงิน (Payment)",
            "🧾 วิเคราะห์บิล (Bill Analysis)",
            "⏳ ลูกหนี้คงค้าง (Outstanding)",
            "👥 วิเคราะห์ลูกค้า (Customers)",
            "🩺 คุณภาพข้อมูล (Data Quality)",
            "💡 Insight อัตโนมัติ",
        ],
    )

    st.divider()
    st.caption("🔒 ข้อมูลทั้งหมดประมวลผลในเครื่องนี้เท่านั้น ไม่มีการส่งออกอินเทอร์เน็ต")


# ----------------------------------------------------------------------------
# Load data — เรียก pipeline ที่ cache ไว้เป็นก้อนเดียว (เร็วมากเมื่อข้อมูลไม่เปลี่ยน)
# ----------------------------------------------------------------------------
files = discover_files(data_dir)
signature = folder_signature(data_dir)
bundle = build_dashboard_bundle(data_dir, signature)

with st.sidebar:
    st.markdown(f"**ไฟล์ที่พบ:** {len(files)} ไฟล์")
    if files:
        with st.expander("ดูรายชื่อไฟล์"):
            for f in files:
                st.text(f"• {f.name}  ({f.size / 1024:,.0f} KB)")
    if bundle.get("n_rows"):
        st.caption(f"รวม {bundle['n_rows']:,} แถว")

# ----------------------------------------------------------------------------
# Empty state
# ----------------------------------------------------------------------------
if bundle.get("is_empty", True):
    st.title("🚚 Revenue Analysis Dashboard")
    st.info(
        f"ยังไม่พบไฟล์ข้อมูล .xlsx ในโฟลเดอร์ `{data_dir}`\n\n"
        "**วิธีเริ่มใช้งาน:**\n"
        "1. นำไฟล์บิลขนส่งรายเดือน (.xlsx) วางไว้ในโฟลเดอร์ `data/`\n"
        "2. ไฟล์แต่ละไฟล์ต้องมีคอลัมน์ตามพจนานุกรมข้อมูล (เลขที่บิล, วันที่, ราคารวม, ฯลฯ)\n"
        "3. กดปุ่ม **🔄 รีเฟรชข้อมูล** ที่แถบด้านซ้าย\n"
        "4. ไม่ต้องแก้โค้ดใดๆ ระบบจะรวมทุกไฟล์ในโฟลเดอร์ให้อัตโนมัติ"
    )
    st.stop()

overview = bundle["overview"]
monthly = bundle["monthly"]
dq = bundle["dq"]

if overview.get("date_min") is None:
    st.warning("⚠️ ไม่สามารถแปลงวันที่ในข้อมูลได้เลย — กรุณาตรวจสอบรูปแบบคอลัมน์ 'วันที่' (ควรเป็น DD/MM/YYYY แบบ พ.ศ.)")


# ============================================================================
# PAGE: Home
# ============================================================================
if page.startswith("🏠"):
    st.title("🚚 Revenue Analysis Dashboard")
    st.caption("ภาพรวมรายได้บิลขนส่งสินค้าแบบเหมาคันไม่เต็มเที่ยว (LTL)")
    sample_notice(files)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("รายได้รวม (Total Revenue)", fmt_thb(overview["total_revenue"]))
    c2.metric("จำนวนบิล (Total Bills)", fmt_num(overview["distinct_bills"]))
    c3.metric("มูลค่าเฉลี่ยต่อบิล", fmt_thb(overview["avg_bill_value"]))
    c4.metric("ยอดค้างชำระ (Unpaid)", fmt_thb(dq["unpaid_amount"]), delta=f"{fmt_num(dq['unpaid_count'])} บิล", delta_color="inverse")

    if overview["date_min"] is not None:
        st.caption(
            f"ช่วงข้อมูล: {overview['date_min'].strftime('%d/%m/%Y')} – {overview['date_max'].strftime('%d/%m/%Y')} "
            f"· จากไฟล์ {len(files)} ไฟล์ · {fmt_num(overview['total_line_items'])} รายการ"
        )

    st.divider()
    col1, col2 = st.columns([1.4, 1])
    with col1:
        st.subheader("แนวโน้มรายได้รายเดือน")
        if not monthly.empty:
            fig = go.Figure()
            fig.add_bar(x=[month_label(m) for m in monthly["month"]], y=monthly["revenue"], name="รายได้",
                        marker_color=AMBER, hovertemplate="%{x}<br>รายได้: ฿%{y:,.0f}<extra></extra>")
            fig.add_trace(go.Scatter(x=[month_label(m) for m in monthly["month"]], y=monthly["avg_bill_value"],
                                      name="มูลค่าเฉลี่ย/บิล", yaxis="y2", line=dict(color=BLUE, width=2), mode="lines+markers",
                                      hovertemplate="%{x}<br>เฉลี่ย/บิล: ฿%{y:,.0f}<extra></extra>"))
            fig.update_layout(
                yaxis=dict(title="รายได้ (บาท)", tickformat=","), yaxis2=dict(title="เฉลี่ย/บิล", overlaying="y", side="right", tickformat=","),
                legend=dict(orientation="h", y=1.12), height=380, margin=dict(t=30, b=10),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig, width='stretch')
    with col2:
        st.subheader("สัดส่วนประเภทสินค้า")
        prod = bundle["product"]
        if not prod.empty:
            fig2 = px.pie(prod, names="ประเภทสินค้า", values="revenue", hole=0.55, color_discrete_sequence=PALETTE)
            fig2.update_traces(hovertemplate="%{label}<br>฿%{value:,.0f} (%{percent})<extra></extra>")
            fig2.update_layout(height=380, margin=dict(t=10, b=10), paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig2, width='stretch')

    st.subheader("💡 Insight เด่นประจำเดือนล่าสุด")
    top_insights = ins.revenue_insights(monthly, overview["total_revenue"])[:2]
    render_insight_cards(top_insights)


# ============================================================================
# PAGE: Revenue Trend
# ============================================================================
elif page.startswith("📈"):
    st.title("📈 แนวโน้มรายได้ (Revenue Trend)")
    sample_notice(files)

    if monthly.empty:
        st.info("ยังไม่มีข้อมูลเพียงพอสำหรับแสดงแนวโน้ม")
    else:
        fig = go.Figure()
        fig.add_bar(x=[month_label(m) for m in monthly["month"]], y=monthly["revenue"], name="รายได้",
                    marker_color=AMBER, hovertemplate="%{x}<br>รายได้: ฿%{y:,.0f}<extra></extra>")
        fig.update_layout(height=380, yaxis_title="รายได้ (บาท)", yaxis_tickformat=",",
                           paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig, width='stretch')

        c1, c2 = st.columns(2)
        with c1:
            st.subheader("จำนวนบิลต่อเดือน")
            fig3 = px.bar(monthly, x=[month_label(m) for m in monthly["month"]], y="bills", color_discrete_sequence=[BLUE])
            fig3.update_traces(hovertemplate="%{x}<br>%{y:,.0f} บิล<extra></extra>")
            fig3.update_layout(height=300, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                                xaxis_title="", yaxis_title="จำนวนบิล", yaxis_tickformat=",")
            st.plotly_chart(fig3, width='stretch')
        with c2:
            st.subheader("มูลค่าเฉลี่ยต่อบิล")
            fig4 = px.line(monthly, x=[month_label(m) for m in monthly["month"]], y="avg_bill_value", markers=True, color_discrete_sequence=[GREEN])
            fig4.update_traces(hovertemplate="%{x}<br>฿%{y:,.0f}<extra></extra>")
            fig4.update_layout(height=300, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                                xaxis_title="", yaxis_title="บาท/บิล", yaxis_tickformat=",")
            st.plotly_chart(fig4, width='stretch')

        st.subheader("รายได้ตามวันในสัปดาห์")
        dow = bundle["dow"]
        fig5 = px.bar(dow, x=[DOW_TH.get(d, d) for d in dow["dow"]], y="revenue", color_discrete_sequence=[AMBER])
        fig5.update_traces(hovertemplate="%{x}<br>฿%{y:,.0f}<extra></extra>")
        fig5.update_layout(height=300, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                            xaxis_title="", yaxis_title="รายได้ (บาท)", yaxis_tickformat=",")
        st.plotly_chart(fig5, width='stretch')

    st.subheader("💡 Insights")
    render_insight_cards(ins.revenue_insights(monthly, overview["total_revenue"]))


# ============================================================================
# PAGE: Payment
# ============================================================================
elif page.startswith("💳"):
    st.title("💳 การวิเคราะห์วิธีชำระเงิน (Payment Analysis)")
    sample_notice(files)

    pay = bundle["payment"]
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("สัดส่วนรายได้ตามวิธีชำระเงิน")
        if not pay.empty:
            fig = px.pie(pay, names="ประเภทการชำระเงิน", values="revenue", hole=0.55, color_discrete_sequence=PALETTE)
            fig.update_traces(hovertemplate="%{label}<br>฿%{value:,.0f} (%{percent})<extra></extra>")
            fig.update_layout(height=360, paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig, width='stretch')
    with c2:
        st.subheader("แนวโน้มวิธีชำระเงินรายเดือน")
        pm = bundle["payment_monthly"]
        if not pm.empty:
            pm = pm.copy()
            pm["month_label"] = pm["month"].apply(month_label)
            fig2 = px.bar(pm, x="month_label", y="ราคารวม", color="ประเภทการชำระเงิน", barmode="stack",
                          color_discrete_sequence=PALETTE)
            fig2.update_traces(hovertemplate="%{x}<br>฿%{y:,.0f}<extra></extra>")
            fig2.update_layout(height=360, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                                xaxis_title="", yaxis_title="รายได้ (บาท)", yaxis_tickformat=",")
            st.plotly_chart(fig2, width='stretch')

    st.subheader("ตารางสรุปวิธีชำระเงิน")
    st.dataframe(
        pay.rename(columns={"ประเภทการชำระเงิน": "วิธีชำระเงิน"}),
        column_config={"revenue": MONEY_COL("รายได้"), "bills": COUNT_COL("จำนวนบิล")},
        width='stretch', hide_index=True,
    )

    st.subheader("💡 Insights")
    render_insight_cards(ins.payment_insights(pay, overview["total_revenue"]))


# ============================================================================
# PAGE: Bill Analysis
# ============================================================================
elif page.startswith("🧾"):
    st.title("🧾 วิเคราะห์บิล (Bill Analysis)")
    sample_notice(files)

    bill_status = bundle["bill_status"]

    c1, c2, c3 = st.columns(3)
    c1.metric("จำนวนบิลทั้งหมด", fmt_num(overview["distinct_bills"]))
    if bill_status is not None and not bill_status.empty:
        cleared = bill_status.loc[bill_status["สถานะบิล"].astype(str).str.strip() == "จบ", "count"].sum()
        c2.metric("บิลที่ปิดงานแล้ว (จบ)", fmt_num(cleared))
    c3.metric("จำนวนรายการสินค้า (line items)", fmt_num(overview["total_line_items"]))

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("สถานะบิล")
        if bill_status is not None and not bill_status.empty:
            fig = px.pie(bill_status, names="สถานะบิล", values="count", hole=0.55, color_discrete_sequence=PALETTE)
            fig.update_traces(hovertemplate="%{label}<br>%{value:,.0f} บิล (%{percent})<extra></extra>")
            fig.update_layout(height=340, paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig, width='stretch')
    with col2:
        st.subheader("ประเภทการคิดราคา")
        pricing = bundle["pricing"]
        if not pricing.empty:
            fig2 = px.bar(pricing, x="ประเภทการคิดราคา", y="revenue", color_discrete_sequence=[AMBER])
            fig2.update_traces(hovertemplate="%{x}<br>฿%{y:,.0f}<extra></extra>")
            fig2.update_layout(height=340, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                                xaxis_title="", yaxis_title="รายได้ (บาท)", yaxis_tickformat=",")
            st.plotly_chart(fig2, width='stretch')

    st.subheader("🛣️ เส้นทางที่ทำรายได้สูงสุด (Top Routes)")
    routes = bundle["routes"]
    st.dataframe(
        routes.rename(columns={"route": "เส้นทาง"}),
        column_config={"revenue": MONEY_COL("รายได้"), "lines": COUNT_COL("จำนวนรายการ")},
        width='stretch', hide_index=True,
    )

    st.subheader("📦 สายกระจายสินค้าที่ทำรายได้สูงสุด")
    distline = bundle["distline"]
    if not distline.empty:
        fig3 = px.bar(distline, x="revenue", y="สายกระจาย", orientation="h", color_discrete_sequence=[BLUE])
        fig3.update_traces(hovertemplate="฿%{x:,.0f}<extra></extra>")
        fig3.update_layout(height=400, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                            yaxis=dict(autorange="reversed"), xaxis_title="รายได้ (บาท)", xaxis_tickformat=",", yaxis_title="")
        st.plotly_chart(fig3, width='stretch')


# ============================================================================
# PAGE: Outstanding / AR
# ============================================================================
elif page.startswith("⏳"):
    st.title("⏳ ลูกหนี้คงค้าง (Accounts Receivable)")
    sample_notice(files)

    c1, c2, c3 = st.columns(3)
    c1.metric("บิลที่ยังไม่ชำระ", f"{fmt_num(dq['unpaid_count'])} บิล", fmt_thb(dq["unpaid_amount"]), delta_color="inverse")
    c2.metric("บิลสถานะตัดจบ", f"{fmt_num(dq['uncleared_count'])} บิล", fmt_thb(dq["uncleared_amount"]), delta_color="inverse")
    unpaid_share = (dq["unpaid_amount"] / overview["total_revenue"] * 100) if overview["total_revenue"] else 0
    c3.metric("สัดส่วนยอดค้างชำระ", fmt_pct(unpaid_share, 2), "ของรายได้รวม")

    st.info(
        "**ข้อจำกัดของข้อมูลชุดนี้:** ไม่มีคอลัมน์ 'วันครบกำหนดชำระ' หรือ 'วันที่ชำระจริง' "
        "จึงยังไม่สามารถคำนวณ Aging (อายุหนี้) หรือระยะเวลาการเคลียร์บิล (Bill Clearance Time) ได้ในขณะนี้ "
        "หากมีข้อมูลดังกล่าวในไฟล์จริง สามารถเพิ่มการคำนวณนี้ได้ในภายหลังโดยไม่ต้องปรับโครงสร้างแดชบอร์ด"
    )

    unpaid_by_payment = bundle["unpaid_by_payment"]
    if unpaid_by_payment is not None and not unpaid_by_payment.empty:
        st.subheader("ยอดค้างชำระแยกตามวิธีชำระเงิน")
        st.dataframe(
            unpaid_by_payment.rename(columns={"ประเภทการชำระเงิน": "วิธีชำระเงิน"}),
            column_config={"count": COUNT_COL("จำนวนบิล"), "amount": MONEY_COL("มูลค่า")},
            width='stretch', hide_index=True,
        )
    else:
        st.success("ไม่พบบิลค้างชำระในข้อมูลชุดนี้")


# ============================================================================
# PAGE: Customers
# ============================================================================
elif page.startswith("👥"):
    st.title("👥 การวิเคราะห์ลูกค้า (Customer Analysis)")
    sample_notice(files)

    cust = bundle["customer"]
    pareto = bundle["pareto"]

    c1, c2, c3 = st.columns(3)
    c1.metric("จำนวนลูกค้าทั้งหมด", fmt_num(pareto["total_customers"]))
    c2.metric("ลูกค้าที่สร้าง 80% ของรายได้", fmt_pct(pareto["pct_customers_for_80pct"]), f"{fmt_num(pareto['n_for_80pct'])} ราย")
    top1 = pareto.get("concentration", {}).get("top_1pct", 0)
    c3.metric("Top 1% ของลูกค้า", fmt_pct(top1), "ของรายได้รวม")

    col1, col2 = st.columns([1.3, 1])
    with col1:
        st.subheader("Pareto Curve — สัดส่วนลูกค้า vs รายได้สะสม")
        if not pareto["curve"].empty:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=pareto["curve"]["cust_pct"], y=pareto["curve"]["cum_pct"],
                                      fill="tozeroy", line=dict(color=AMBER, width=2), name="% รายได้สะสม",
                                      hovertemplate="ลูกค้า %{x:.1f}%<br>รายได้สะสม %{y:.1f}%<extra></extra>"))
            fig.add_hline(y=80, line_dash="dash", line_color=RED, annotation_text="80%")
            fig.update_layout(height=380, xaxis_title="% ของลูกค้า (เรียงจากรายได้สูงสุด)", yaxis_title="% รายได้สะสม",
                               paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig, width='stretch')
    with col2:
        st.subheader("Top 10 ลูกค้าตามรายได้")
        top10 = cust.head(10).copy()
        top10.insert(0, "อันดับ", range(1, len(top10) + 1))
        top10["ผู้รับ_encoded"] = top10["ผู้รับ_encoded"].astype(str).str.slice(0, 10) + "…"
        st.dataframe(
            top10.rename(columns={"ผู้รับ_encoded": "รหัสลูกค้า (Encoded)"}),
            column_config={"revenue": MONEY_COL("รายได้"), "bills": COUNT_COL("จำนวนบิล")},
            width='stretch', hide_index=True,
        )

    st.subheader("💡 Insights")
    render_insight_cards(ins.customer_insights(pareto))


# ============================================================================
# PAGE: Data Quality
# ============================================================================
elif page.startswith("🩺"):
    st.title("🩺 คุณภาพข้อมูล (Data Quality)")
    sample_notice(files)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("แถวข้อมูลซ้ำ", fmt_num(dq["duplicate_rows"]), f"{fmt_thb(dq['duplicate_revenue_at_risk'])} เสี่ยงนับซ้ำ", delta_color="inverse")
    c2.metric("บิลยังไม่ชำระ", fmt_num(dq["unpaid_count"]), fmt_thb(dq["unpaid_amount"]), delta_color="inverse")
    c3.metric("ขนาดสินค้าผิดปกติ", f"{fmt_num(dq['bad_dimension_rows'])} แถว")
    c4.metric("วันที่แปลงไม่สำเร็จ", f"{fmt_num(dq['bad_date_rows'])} แถว")

    st.divider()
    st.subheader("💡 รายการที่ควรตรวจสอบ")
    render_insight_cards(ins.quality_insights(dq))

    with st.expander("🔍 ดูตัวอย่างแถวข้อมูลที่ซ้ำกัน"):
        dup_sample = bundle["dup_sample"]
        if dup_sample is not None and not dup_sample.empty:
            st.dataframe(dup_sample, width='stretch')
        else:
            st.write("ไม่พบแถวข้อมูลซ้ำ")

    with st.expander("🔍 ดูตัวอย่างแถวที่ขนาดสินค้าผิดปกติ"):
        bad_dim_sample = bundle["bad_dim_sample"]
        if bad_dim_sample is not None and not bad_dim_sample.empty:
            st.dataframe(bad_dim_sample, width='stretch')
        else:
            st.write("ไม่พบแถวที่ผิดปกติ")


# ============================================================================
# PAGE: Automatic Insights (ย้ายมาเป็นลำดับสุดท้ายของเมนู)
# ============================================================================
elif page.startswith("💡"):
    st.title("💡 Insight อัตโนมัติ (Automatic Business Insights)")
    st.caption("สรุปประเด็นสำคัญที่ระบบวิเคราะห์ได้จากข้อมูลปัจจุบันโดยอัตโนมัติ")
    sample_notice(files)

    st.subheader("📈 รายได้")
    render_insight_cards(ins.revenue_insights(monthly, overview["total_revenue"]))

    st.subheader("💳 การชำระเงิน")
    render_insight_cards(ins.payment_insights(bundle["payment"], overview["total_revenue"]))

    st.subheader("👥 ลูกค้า")
    render_insight_cards(ins.customer_insights(bundle["pareto"]))

    st.subheader("🩺 คุณภาพข้อมูล")
    render_insight_cards(ins.quality_insights(dq))
