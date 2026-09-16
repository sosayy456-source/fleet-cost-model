/**
 * แดชบอร์ดต้นทุน+รายได้รายเที่ยว จากไฟล์ realalldata — สองเมนู หน้าตาเดียวกัน ต่างกันที่ข้อมูล
 *
 *   Executive Dashboard  (mode "exec")  เฉพาะเที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง (m = true)
 *   Dashboard รวม         (mode "all")   ทุกเที่ยวในไฟล์
 *
 * สามแท็บ: กองรถ (สเปกส่วนที่ 1) · กำไรรายเที่ยว (ส่วนที่ 2) · ต้นทุน (เอกสารจัดประเภทต้นทุน)
 * ทั้งสองเมนูไม่มีส่วนรายการลูกหนี้ — บิลจากไฟล์รายได้ไปแสดงที่เมนู "รายการลูกหนี้" เป็นข้อมูลเก่าแทน
 *
 * แยกขาดจากแดชบอร์ดเดิม (dash-fleet) ทั้งข้อมูลและโค้ด ใช้ร่วมแค่คอมโพเนนต์แสดงผล
 */
import { useMemo, useRef, useState } from "react";
import { useDashInk } from "../../lib/chart/dashfx";
import RefreshBtn from "../../lib/ui/RefreshBtn";
import EtlBanner from "../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev } from "../../lib/data/useCostRev";
import { fmt } from "./common";
import FleetTab from "./FleetTab";
import ProfitTab from "./ProfitTab";
import CostTab from "./CostTab";
import DamageTab from "./DamageTab";

export type CostRevMode = "exec" | "all";

const TABS = [
  { id: "fleet", label: "กองรถ" },
  { id: "profit", label: "กำไรรายเที่ยว" },
  { id: "cost", label: "ต้นทุน" },
  { id: "damage", label: "Damage Rate" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function CostRevDash({ mode }: { mode: CostRevMode }) {
  const { data, error, loading, reload } = useCostRev();
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/Dashboard real data/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("costrev");
  useAutoReloadOnEtl(etl, reload);
  const [tab, setTab] = useState<TabId>("fleet");
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, tab);

  const trips = useMemo(() => {
    if (!data) return [];
    return mode === "exec" ? data.trips.filter((t) => t.m) : data.trips;
  }, [data, mode]);

  const refresh = (
    <RefreshBtn className="dash-reload" onClick={reload} loading={loading}
      title="ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่" />
  );

  if (error) {
    return (
      <div className="card">
        <h2>{mode === "exec" ? "Executive Dashboard" : "Dashboard รวม"}</h2>
        <div className="banner">{error}</div>
        <p className="muted">
          สร้างไฟล์ข้อมูลด้วย <code>python etl/build_costrev.py --dataset sample</code> (หรือ <code>--dataset real</code>
          เมื่อวางไฟล์จริงใน <code>etl/data/Dashboard real data/</code> แล้ว)
        </p>
        <div style={{ marginTop: 12 }}>{refresh}</div>
      </div>
    );
  }
  if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูล...</p></div>;

  const m = data.manifest;
  const info = mode === "exec"
    ? `${fmt(m.matched)} เที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง จาก ${fmt(m.rows)} เที่ยวในไฟล์ · ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`
    : `${fmt(m.rows)} เที่ยวทั้งหมดในไฟล์ · ${m.costFiles.join(", ")}`;

  return (
    <>
      <EtlBanner status={etl} />
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {info} · {m.dateRange.min} → {m.dateRange.max}
            {m.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
          </span>
          <span style={{ marginLeft: "auto" }}>{refresh}</span>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="card">
          <h2>ยังไม่มีข้อมูล</h2>
          <p className="muted">
            {mode === "exec"
              ? "ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง — ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่"
              : "ไฟล์ต้นทุนไม่มีแถวข้อมูล"}
          </p>
        </div>
      ) : (
        <>
          <div className="dash-tabs" ref={barRef}>
            <span className="dink" />
            {TABS.map((t) => (
              <button key={t.id} type="button" className={"dtab" + (tab === t.id ? " active" : "")}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {tab === "fleet" && <FleetTab trips={trips} />}
          {tab === "profit" && <ProfitTab trips={trips} />}
          {tab === "cost" && <CostTab trips={trips} />}
          {/* ความเสียหายมาจากบิลในไฟล์รายได้ จึงมีตัวเลขเฉพาะโหมด exec — โหมด all ขึ้นข้อจำกัดแทน */}
          {tab === "damage" && <DamageTab trips={trips} mode={mode} matchedTotal={m.matched} isSample={m.isSample} />}
        </>
      )}
    </>
  );
}
