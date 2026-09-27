/** เค้าโครง Executive Summary จากไฟล์ต้นแบบของเจ้าของงาน · รอเชื่อมข้อมูลรายแท็บ */
import { useState } from "react";
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

function DataTable({ title, columns }: { title: string; columns: string[] }) {
  return <section className="es-panel" aria-label={title}>
    <h3>{title}</h3>
    <div className="es-table-scroll">
      <table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className="es-table-empty">รอข้อมูล</td></tr></tbody></table>
    </div>
  </section>;
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
    case "route": return <>
      <div className="es-grid es-grid-three">
        <Metric label="สินค้าทั่วไป" tone="good" />
        <Metric label="สินค้าแช่เย็น" tone="warn" />
        <Metric label="สินค้าแช่แข็ง" tone="good" />
      </div>
      <Panel title="กำไรต่อเที่ยว (บาท)" className="es-chart" />
    </>;
    case "fleet": return <>
      <div className="es-grid es-grid-two">
        <Metric label="Load Factor เฉลี่ย" />
        <Metric label="สูญเสียจากเที่ยวเปล่า" tone="bad" />
      </div>
      <DataTable title="ต้นทุนต่อเที่ยว / กม. / ตัน-กม. ตามชนิดรถ"
        columns={["ชนิดรถ", "บาท/เที่ยว", "บาท/กม.", "บาท/ตัน-กม."]} />
      <Panel title="ความคุ้มค่าค่าเสื่อมของรถบริษัท" className="es-chart" />
    </>;
    case "customer": return <>
      <Panel title="สัดส่วนลูกค้าที่มีกำไรและขาดทุน" className="es-chart" />
      <DataTable title="ลูกค้าขาดทุนสูงสุด" columns={["ลูกค้า", "ขาดทุน", "อัตรา"]} />
      <Panel title="อายุลูกหนี้ค้างชำระ (DSO aging)" className="es-chart" />
    </>;
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
        <div className="es-logo" aria-hidden="true">N</div>
        <div className="es-brand">นิ่มขนส่ง 1988<small>Executive Summary · รอเชื่อมข้อมูล</small></div>
        {page && <button type="button" className="es-switch-role" onClick={page.onSwitchRole}>เปลี่ยนหน้าที่</button>}
      </div>
      <nav className="es-tabbar" aria-label="แท็บ Executive Summary">{tabs}</nav>
      <div className="es-filterbar" aria-label="ตัวกรอง Executive Summary">
        <label><span className="es-visually-hidden">ช่วงเวลา</span><select disabled aria-label="ช่วงเวลา"><option>ทุกปี</option></select></label>
        <label><span className="es-visually-hidden">กลุ่มบริการ</span><select disabled aria-label="กลุ่มบริการ"><option>ทุกกลุ่มบริการ</option></select></label>
      </div>
    </header>
    <div className="es-page">
      <section id="es-tab-content" className="es-content" role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
        <h2>{tab === "recommendations" ? "Recommendations & Financial Impact" : TABS.find((item) => item.id === tab)?.label}</h2>
        <TabContent tab={tab} />
      </section>
    </div>
  </>;
}
