/**
 * เค้าโครง Executive Summary จากไฟล์ต้นแบบของเจ้าของงาน — คัดส่วนที่มีอยู่แล้วในโมเดลมาเรียงใหม่ (ไม่มีสูตรของตัวเอง)
 *
 * ★ ส่วนที่ใส่ตาม PDF ที่เจ้าของงานส่ง 27 ก.ย. 2569 (ใช้คอมโพเนนต์ตัวจริง แก้ต้นทางแล้วหน้านี้เปลี่ยนตาม):
 *   Route Profitability      = Executive Dashboard › Profit Per Route: การ์ดอัตรากำไร 3 กลุ่มบริการ + การ์ดแผนที่/จัดอันดับกำไรต่อเที่ยว
 *                              (RouteProfitTab summary)
 *   Fleet Utilization & Cost = Executive Dashboard › Vehicle Utilization Cost ส่วนที่ 1–2 (Item3Tab hideFleet) ·
 *                              Overall › Empty Trips: แผนที่เที่ยววิ่งเปล่า (EmptyMapSection) ·
 *                              Overall › Inefficient Transportation Cost: กราฟ LF รายเดือนเทียบปี + ต้นทุนที่จมเกิดจากตรงไหน
 *                              (LoadFactorTab summary — ชุด loadfactor/ ของตัวเอง)
 *   Customer Profitability & Cash Flow = Executive Dashboard › Customer Performance ทั้งส่วน (CustomerProfitTab ·
 *                              ส่วนที่ 1 กำไรลูกค้า alloc/ + ส่วนที่ 2 DSO debtors/ — ไม่ใช้ไฟล์ต้นทุน)
 * ★ ชุดเที่ยว = inProfitScope() ทุกเที่ยว ไม่กรอง (ตัวกรองหัวหน้ายังปิดไว้) · แท็บอื่นยังรอเชื่อมข้อมูล
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCostRev, inProfitScope } from "../../lib/data/useCostRev";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import TruckLoader from "../../lib/ui/TruckLoader";
import RouteProfitTab from "../dash-demo/RouteProfitTab";
import Item3Tab from "../dash-demo/Item3Tab";
import { DEMO_F0 } from "../dash-demo/filter";
import { EmptyMapSection } from "../dash-costrev/EmptyTab";
import LoadFactorTab from "../dash-costrev/lf/LoadFactorTab";
import CustomerProfitTab from "../dash-demo/CustomerProfitTab";
import DashShell, { Meta, dataRangeText } from "../../lib/ui/DashShell";
import { fmt } from "../dash-costrev/common";
import SummaryTab from "./SummaryTab";
import "./ExecutiveSummary.css";

/** short = ชื่อบนแท็บของแคปซูล (ชื่อเต็มอยู่ใน tooltip + หัวข้อแท็บ แบบ Overall Dashboard) */
const TABS = [
  { id: "summary", label: "Executive Summary", short: "Summary" },
  { id: "route", label: "Route Profitability", short: "Route" },
  { id: "fleet", label: "Fleet Utilization & Cost", short: "Fleet & Cost" },
  { id: "customer", label: "Customer Profitability & Cash Flow", short: "Customer & Cash" },
  { id: "index", label: "Performance Index", short: "Performance Index" },
  { id: "recommendations", label: "Recommendations", short: "Recommendations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Metric({ label, tone }: { label: string; tone?: "good" | "warn" | "bad" }) {
  return <div className={`es-metric${tone ? ` es-${tone}` : ""}`}>
    <span className="es-label">{label}</span>
    <strong className="es-empty-value" aria-label="ยังไม่มีข้อมูล">—</strong>
  </div>;
}

function Panel({ title, className = "" }: { title: string; className?: string }) {
  return <section className={`es-panel ${className}`} aria-label={title}>
    <h3>{title}</h3>
    <div className="es-placeholder">รอข้อมูล</div>
  </section>;
}

/** หัวข้อย่อยภายในแท็บ */
function Sub({ children }: { children: ReactNode }) {
  return <h3 className="es-sub">{children}</h3>;
}

/** แท็บที่ใช้ไฟล์ต้นทุน (costrev/) — โหลดข้อมูลครั้งเดียวแล้ววาดส่วนที่คัดมา */
function CostRevParts({ tab }: { tab: "route" | "fleet" }) {
  const { data, error, reload } = useCostRev();
  useAutoReloadOnEtl(useEtlStatus("costrev"), reload);
  const all = useMemo(() => (data ? data.trips.filter(inProfitScope) : []), [data]);
  if (error) return <div className="card"><div className="banner">{error}</div></div>;
  if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>;
  if (tab === "route") return <RouteProfitTab trips={all} f={DEMO_F0} summary />;
  return <>
    <Item3Tab trips={all} costTrips={all} year="" hideFleet />
    <Sub>เที่ยววิ่งเปล่า</Sub>
    <EmptyMapSection rows={all} />
    <Sub>Load Factor</Sub>
    <LoadFactorTab summary />
  </>;
}

function TabContent({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  switch (tab) {
    // การ์ด 4 ใบ · คะแนน PI รวม · ประเด็นสำคัญ · กราฟน้ำตก (ภาพที่เจ้าของงานส่ง 28 ก.ย. 2569)
    case "summary": return <SummaryTab onRecommend={() => onTab("recommendations")} />;
    case "route": return <CostRevParts tab="route" />;
    case "fleet": return <CostRevParts tab="fleet" />;
    // ทั้งส่วน Customer Performance ของ Executive Dashboard (กำไรลูกค้า + DSO) — ชุด alloc/ กับ debtors/ ของตัวเอง ไม่ใช้ไฟล์ต้นทุน
    case "customer": return <CustomerProfitTab f={DEMO_F0} />;
    case "index": return <>
      <div className="es-grid es-grid-three">
        <Metric label="Damage Rate" tone="good" />
        <Metric label="On-time delivery" tone="good" />
        <Metric label="จำนวนชิ้นสินค้ารวม" />
      </div>
      <Panel title="องค์ประกอบ Performance Index" className="es-chart" />
      <div className="es-total"><span>คะแนนรวม</span><strong aria-label="ยังไม่มีข้อมูล">— <small>/ 100</small></strong></div>
    </>;
    case "recommendations": return <>
      <div className="es-recommendations">
        {[1, 2, 3].map((number) => <Panel key={number} title={`ข้อเสนอแนะ ${number}`} className="es-recommendation" />)}
      </div>
    </>;
  }
}

/**
 * หัวแคปซูลแบบเดียวกับ Executive · Overall · Manager Dashboard (เจ้าของงานสั่ง 28 ก.ย. 2569 — เดิมมีหัวของตัวเอง
 * โลโก้ + แถบแท็บ + ตัวกรองที่ปิดไว้) · บรรทัดรอง/ที่มาของข้อมูล/ป้ายตัวอย่าง = ไฟล์ต้นทุน (costrev/) ที่แท็บส่วนใหญ่ใช้ ·
 * ยังไม่มีตัวกรอง (ตัวกรองเดิมเป็นช่องปิดไว้) จึงไม่มีปุ่มตัวกรองในแคปซูล
 */
export default function ExecutiveSummary() {
  const [tab, setTab] = useState<TabId>("summary");
  const cr = useCostRev();
  useAutoReloadOnEtl(useEtlStatus("costrev"), cr.reload);
  const m = cr.data?.manifest;
  // เปลี่ยนแท็บย่อย = เด้งไปบนสุดของหน้าทันที (เจ้าของงานสั่ง 28 ก.ย. 2569 — เดิมเลื่อนค้างตำแหน่งของแท็บก่อน)
  // ครอบทุกทาง: กดแท็บในแคปซูล · ลิงก์ในหน้า Summary (onTab) · ข้ามรอบแรกที่เพิ่งเปิดหน้า
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return; }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);
  const tabs = TABS.map((item) => (
    <button key={item.id} type="button" className={tab === item.id ? "on" : ""} aria-current={tab === item.id ? "true" : undefined}
      title={item.label} onClick={() => setTab(item.id)}>{item.short}</button>
  ));
  const meta = m && <Meta parts={[
    <>ไฟล์ต้นทุน <b>{fmt(m.rows)}</b> เที่ยว · จับคู่รายได้ได้ {fmt(m.matched)}</>,
    <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
    "แท็บ Customer ใช้ชุดกำไรลูกค้า/ลูกหนี้ของตัวเอง",
  ]} />;
  const label = TABS.find((item) => item.id === tab)?.label;

  return (
    <DashShell title="Executive Summary" sample={m?.isSample} meta={meta || undefined}
      onRefresh={cr.reload} loading={!cr.data && !cr.error} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้มาใหม่"
      capsule={{ tabs, sub: m ? dataRangeText(m.dateRange.min, m.dateRange.max) : undefined }}>
      <div className={tab === "summary" || tab === "route" || tab === "fleet" || tab === "customer" ? "es-page es-wide" : "es-page"}>
        <section id="es-tab-content" className="es-content" aria-label={label}>
          <h2 className="dm-part-h">{tab === "recommendations" ? "Recommendations & Financial Impact" : label}</h2>
          <TabContent tab={tab} onTab={setTab} />
        </section>
      </div>
    </DashShell>
  );
}
