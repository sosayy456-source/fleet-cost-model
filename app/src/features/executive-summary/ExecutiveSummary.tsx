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
import logoTiger from "../../assets/logo-tiger.webp";
import { useMemo, useState } from "react";
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
import { useDashPage } from "../../lib/ui/dashContext";
import "./ExecutiveSummary.css";

const TABS = [
  { id: "summary", label: "Executive Summary" },
  { id: "route", label: "Route Profitability" },
  { id: "fleet", label: "Fleet Utilization & Cost" },
  { id: "customer", label: "Customer Profitability & Cash Flow" },
  { id: "index", label: "Performance Index" },
  { id: "recommendations", label: "Recommendations" },
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

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case "summary": return <>
      <div className="es-grid es-grid-four">
        <Metric label="กำไรสุทธิ" tone="good" /><Metric label="รายได้รวม" />
        <Metric label="ต้นทุนรวม" /><Metric label="%Margin" />
      </div>
      <Panel title="คะแนนประสิทธิภาพรวม (Performance Index)" className="es-score" />
      <Panel title="ประเด็นสำคัญ" className="es-insight" />
      <Panel title="รายได้ → ต้นทุน → กำไร (ลบ.)" className="es-chart" />
    </>;
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

export default function ExecutiveSummary() {
  const [tab, setTab] = useState<TabId>("summary");
  const page = useDashPage();
  const tabs = <div className="es-tabs" role="tablist" aria-label="ส่วนของ Executive Summary"
    onKeyDown={(event) => {
      const current = TABS.findIndex((item) => item.id === tab);
      const next = event.key === "ArrowRight" ? (current + 1) % TABS.length
        : event.key === "ArrowLeft" ? (current - 1 + TABS.length) % TABS.length
          : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      setTab(TABS[next]!.id);
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
    }}>
    {TABS.map((item) => <button key={item.id} type="button" role="tab"
      aria-selected={tab === item.id} aria-controls="es-tab-content"
      tabIndex={tab === item.id ? 0 : -1}
      className={tab === item.id ? "active" : ""}
      onClick={() => setTab(item.id)}>{item.label}</button>)}
  </div>;

  return <>
    <header className="es-header">
      <div className="es-brandbar">
        <img className="es-logo" src={logoTiger} alt="" aria-hidden="true" />
        <div className="es-brand">นิ่มขนส่ง 1988<small>Executive Summary · รอเชื่อมข้อมูล</small></div>
        {page && <button type="button" className="es-switch-role" onClick={page.onSwitchRole}>เปลี่ยนหน้าที่</button>}
      </div>
      <nav className="es-tabbar" aria-label="แท็บ Executive Summary">{tabs}</nav>
      <div className="es-filterbar" aria-label="ตัวกรอง Executive Summary">
        <label><span className="es-visually-hidden">ช่วงเวลา</span><select disabled aria-label="ช่วงเวลา"><option>ทุกปี</option></select></label>
        <label><span className="es-visually-hidden">กลุ่มบริการ</span><select disabled aria-label="กลุ่มบริการ"><option>ทุกกลุ่มบริการ</option></select></label>
      </div>
    </header>
    <div className={tab === "route" || tab === "fleet" || tab === "customer" ? "es-page es-wide" : "es-page"}>
      <section id="es-tab-content" className="es-content" role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
        <h2>{tab === "recommendations" ? "Recommendations & Financial Impact" : TABS.find((item) => item.id === tab)?.label}</h2>
        <TabContent tab={tab} />
      </section>
    </div>
  </>;
}
