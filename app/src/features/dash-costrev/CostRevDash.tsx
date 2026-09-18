/**
 * แดชบอร์ดต้นทุน+รายได้รายเที่ยว จากไฟล์ realalldata — สองเมนู หน้าตาเดียวกัน ต่างกันที่ข้อมูล
 *
 *   Executive Dashboard  (mode "exec")  เฉพาะเที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง (m = true)
 *   Dashboard รวม         (mode "all")   ทุกเที่ยวในไฟล์
 *
 * ห้าแท็บจากไฟล์ต้นทุน: กำไรรายเที่ยว (สเปกส่วนที่ 2) · กองรถ (ส่วนที่ 1) · ต้นทุน (เอกสารจัดประเภทต้นทุน)
 *          · Damage Rate · เที่ยววิ่งเปล่า (docs/spec-เที่ยววิ่งเปล่า.md)
 * กำไรรายเที่ยวขึ้นก่อนตามที่ผู้บริหารขอ — เป็นคำถามแรกที่เปิดหน้านี้มาดู
 *
 * ★ Executive Dashboard มีอีกสองแท็บที่ย้ายมาจากเมนู "แดชบอร์ดรายได้" ที่ถูกยุบไป (17 ก.ย. 2569)
 *   Dashboard รายได้ · Dashboard ลูกหนี้ — ทั้งคู่ **ไม่ใช้ trips เลย** อ่านไฟล์ชุดของตัวเอง
 *   จึงต้องเข้าได้แม้ไฟล์ต้นทุนจะยังไม่มีหรือโหลดไม่ขึ้น ข้อความ "ยังไม่มีข้อมูล" และบรรทัดที่มา
 *   ของไฟล์ต้นทุนจึงอยู่ในเนื้อแท็บที่ใช้ trips ไม่ได้ครอบทั้งหน้าเหมือนเดิม
 *   (แท็บ "กำไรลูกค้า (ปันส่วนต้นทุน)" ย้ายลงไปเป็นแท็บย่อยของ Dashboard รายได้ตามที่สั่ง)
 * ส่วนรายการลูกหนี้รายบิลอยู่ที่เมนู "รายการลูกหนี้" เป็นข้อมูลเก่า ไม่ได้อยู่ในสองเมนูนี้
 *
 * แยกขาดจากแดชบอร์ดเดิม (dash-fleet) ทั้งข้อมูลและโค้ด ใช้ร่วมแค่คอมโพเนนต์แสดงผล
 */
import { useMemo, useRef, useState } from "react";
import { useDashInk } from "../../lib/chart/dashfx";
import DashShell, { Meta } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev } from "../../lib/data/useCostRev";
import { fmt } from "./common";
import DebtorBoard from "../dash-revenue/board/DebtorBoard";
import RevenueBoard from "../dash-revenue/board/RevenueBoard";
import FleetTab from "./FleetTab";
import ProfitTab from "./ProfitTab";
import CostTab from "./CostTab";
import DamageTab from "./DamageTab";
import EmptyTab from "./EmptyTab";
import type { RecordsState } from "../../lib/store/useRecords";

export type CostRevMode = "exec" | "all";

const TABS = [
  { id: "profit", label: "กำไรรายเที่ยว" },
  { id: "fleet", label: "กองรถ" },
  { id: "cost", label: "ต้นทุน" },
  { id: "damage", label: "Damage Rate" },
  { id: "empty", label: "เที่ยววิ่งเปล่า" },
  // สองแท็บนี้ไม่ใช้ trips เลย — อ่านไฟล์ชุดของตัวเองและโหลดเอง
  // มีเฉพาะ Executive Dashboard ตามที่เจ้าของข้อมูลสั่ง ส่วน Dashboard รวม ไม่มี
  { id: "rev", label: "Dashboard รายได้", execOnly: true },
  { id: "debt", label: "Dashboard ลูกหนี้", execOnly: true },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function CostRevDash({ mode, state }: { mode: CostRevMode; state: RecordsState }) {
  const { data, error, loading, reload } = useCostRev();
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/Dashboard real data/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("costrev");
  useAutoReloadOnEtl(etl, reload);
  const [tab, setTab] = useState<TabId>("profit");
  const barRef = useRef<HTMLDivElement>(null);
  const ready = !!data && !error;
  useDashInk(barRef, `${tab}:${ready}`);

  const trips = useMemo(() => {
    if (!data) return [];
    return mode === "exec" ? data.trips.filter((t) => t.m) : data.trips;
  }, [data, mode]);

  const refreshTitle = "ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่";
  const m = data?.manifest;
  const title = mode === "exec" ? "Executive Dashboard" : "Dashboard รวม";
  // บรรทัดที่มาของข้อมูลใต้หัวเรื่อง — ข้อความตามดีไซน์ 1A
  const meta = m && (mode === "exec"
    ? <Meta parts={[
        <><b>{fmt(m.matched)}</b> เที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
        `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
        <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
      ]} />
    : <Meta parts={[
        <><b>{fmt(m.rows)}</b> เที่ยวทั้งหมดในไฟล์</>,
        m.costFiles.join(", "),
        <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
      ]} />);

  const tabs = (mode === "exec" || (m && trips.length > 0)) && (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {TABS.filter((t) => !("execOnly" in t && t.execOnly) || mode === "exec").map((t) => (
        <button key={t.id} type="button" className={"dtab" + (tab === t.id ? " active" : "")}
          onClick={() => setTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );

  return (
    <>
      <EtlBanner status={etl} />
      <DashShell title={title} sample={m?.isSample} meta={meta || undefined}
        tabs={tabs || undefined} onRefresh={reload} loading={loading} refreshTitle={refreshTitle}>
        {error ? (
          <div className="card">
            <div className="banner">{error}</div>
            <p className="muted">
              สร้างไฟล์ข้อมูลด้วย <code>python etl/build_costrev.py --dataset sample</code> (หรือ <code>--dataset real</code>
              เมื่อวางไฟล์จริงใน <code>etl/data/Dashboard real data/</code> แล้ว)
            </p>
          </div>
        ) : !m ? (
          <div className="card"><p className="muted">กำลังโหลดข้อมูล...</p></div>
        ) : trips.length === 0 ? (
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
            {tab === "fleet" && <FleetTab trips={trips} />}
            {tab === "profit" && <ProfitTab trips={trips} fileRows={m.rows} />}
            {tab === "cost" && <CostTab trips={trips} />}
            {/* ความเสียหายมาจากบิลในไฟล์รายได้ จึงมีตัวเลขเฉพาะโหมด exec — โหมด all ขึ้นข้อจำกัดแทน */}
            {tab === "empty" && <EmptyTab trips={trips} />}
            {tab === "damage" && <DamageTab trips={trips} mode={mode} matchedTotal={m.matched} isSample={m.isSample} />}
            {tab === "rev" && mode === "exec" && <RevenueBoard trips={trips} manifest={m} />}
            {tab === "debt" && mode === "exec" && <DebtorBoard state={state} manifest={m} />}
          </>
        )}
      </DashShell>
    </>
  );
}
