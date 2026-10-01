/**
 * Overall Dashboard (เดิมชื่อ Executive Dashboard — เปลี่ยน 25 ก.ย. 2569 · ชื่อ Executive Dashboard ย้ายไปเป็นของเมนู Demo)
 *   แดชบอร์ดต้นทุน+รายได้รายเที่ยว จากไฟล์ realalldata
 *   ชุด inProfitScope() = เที่ยวที่จับคู่บิลรายได้ได้ หรือเที่ยวเปล่าที่มีต้นทุนแต่ไม่มีบิล
 *   ★ เมนู "Dashboard ค่าเดินทาง(ไม่ใช้)" (โหมด all = ทุกเที่ยวในไฟล์) ลบออกแล้ว 24 ก.ย. 2569 — ไม่มีโหมดอีก
 *
 * แท็บจากไฟล์ต้นทุน: การใช้ประโยชน์ของกองรถ · Damage Rate · เที่ยววิ่งเปล่า (docs/spec-เที่ยววิ่งเปล่า.md) · รายละเอียด ข้อ 3
 * ★ แท็บ "กำไรรายเที่ยว" (+ ตารางสรุป · ตารางกลุ่มบริการ · ตารางรายเที่ยว) และแท็บ "ต้นทุน" ลบโค้ดทิ้งแล้ว 25 ก.ย. 2569
 *   (เจ้าของงานสั่ง) — แท็บแรกจึงเป็น "การใช้ประโยชน์ของกองรถ"
 *
 * ★ แท็บ Dashboard รายได้ · Dashboard ลูกหนี้ (รวมแท็บย่อย "กำไรลูกค้า (ปันส่วนต้นทุน)") ลบออกแล้ว 24 ก.ย. 2569
 *   (เจ้าของงานสั่ง) — กำไรลูกค้าดูที่ Demo › กำไรลูกค้า · รายการลูกหนี้รายบิลอยู่ที่เมนู "รายการลูกหนี้"
 * ★ แท็บ "ต้นทุนที่จมกับที่ว่าง" (22 ก.ย. 2569) อ่านชุด loadfactor/ ของตัวเอง ไม่ใช้ trips เลย — อยู่ใน STANDALONE
 *   จึงวาดก่อนการตรวจ error/ว่างของ costrev เข้าได้แม้ไฟล์ต้นทุนหาย
 * ★ แท็บ "กำไรส่วนเกิน/ตัน-กม." (23 ก.ย. 2569) ใช้ชุด loadfactor/ เดียวกัน — STANDALONE เหมือนกัน
 *   การ์ดสรุปในเมนู Demo กดแล้วเปิดแท็บนี้ตรง ๆ ผ่าน openExecTab() (lib/ui/dashJump.ts)
 * ★ แท็บเที่ยววิ่งเปล่าแสดงทุกเที่ยวตามนิยามเดิม รวมเที่ยวที่จับคู่บิลไม่ได้
 *   แท็บกำไรหลักและแท็บอื่นใช้เฉพาะเที่ยวที่จับคู่ได้
 *
 * แยกขาดจากแดชบอร์ดเดิม (dash-fleet) ทั้งข้อมูลและโค้ด ใช้ร่วมแค่คอมโพเนนต์แสดงผล
 */
import { DataSourceFilter, DataSourceProvider, useDataSourceCtx } from "../../lib/data/dataSource";
import type { TripRecord } from "../../types/record";
import FilterBar from "../../lib/ui/FilterBar";
import { useEffect, useMemo, useState } from "react";
import { clearExecTab, peekExecTab } from "../../lib/ui/dashJump";
import DashShell, { Meta, dataRangeText } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev, inProfitScope } from "../../lib/data/useCostRev";
import { fmt } from "./common";
import FleetTab from "./FleetTab";
import DamageTab from "./DamageTab";
import EmptyTab from "./EmptyTab";
import LoadFactorTab from "./lf/LoadFactorTab";
import TonKmTab from "./tonkm/TonKmTab";
import Detail3Tab from "./detail3/Detail3Tab";
import TruckLoader from "../../lib/ui/TruckLoader";
import { OVERALL_TABS, clearOverallNav, clearOverallPending, peekOverallPending, registerOverallNav, setOverallActive } from "../../lib/ui/overallNav";
import type { OverallTabId } from "../../lib/ui/overallNav";
import ThemeScope from "../../lib/ui/ThemeScope";

type TabId = OverallTabId;
/** แท็บที่ไม่ใช้ trips — แสดงได้ทันทีโดยไม่รอ/ไม่สน error ของ costrev */
const STANDALONE: ReadonlySet<TabId> = new Set<TabId>(["lf", "tonkm"]);

/** ตัวกรองแหล่งข้อมูลร่วมกับ Executive Dashboard (lib/data/dataSource.tsx · 1 ต.ค. 2569) — Provider อยู่เหนือ hook ข้อมูลทุกตัว */
export default function CostRevDash({ records }: { records: TripRecord[] }) {
  return <DataSourceProvider records={records}><CostRevDashBody /></DataSourceProvider>;
}

function CostRevDashBody() {
  const { data, error, loading, reload } = useCostRev();
  const srcCtx = useDataSourceCtx();
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/Dashboard real data/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("costrev");
  // แถบที่หัวหน้า = สถานะรวมทุกงาน ETL (งานปันส่วนกำไรลูกค้าแปลงต่อหลังงานนี้อีกนาน)
  const etlAll = useEtlStatus("all");
  useAutoReloadOnEtl(etl, reload);
  // แท็บที่หน้าอื่นสั่งให้เปิด (lib/ui/dashJump.ts) — รับเฉพาะชื่อแท็บที่มีจริง
  const [tab, setTab] = useState<TabId>(() => {
    const want = peekOverallPending() ?? peekExecTab();
    return OVERALL_TABS.some((t) => t.id === want) ? (want as TabId) : "fleet";
  });
  useEffect(() => {
    clearExecTab();
    clearOverallPending();
    registerOverallNav(setTab);
    return clearOverallNav;
  }, []);
  useEffect(() => { setOverallActive(tab); }, [tab]);

  const trips = useMemo(() => {
    if (!data) return [];
    return data.trips.filter(inProfitScope);
  }, [data]);

  const refreshTitle = "ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่";
  const m = data?.manifest;
  const title = "Overall Dashboard";
  // บรรทัดที่มาของข้อมูลใต้หัวเรื่อง — ข้อความตามดีไซน์ 1A
  const meta = m && (
    <Meta parts={[
        <><b>{fmt(trips.length)}</b> เที่ยวที่นับกำไร (จับคู่บิลได้ {fmt(m.matched)} + เที่ยวเปล่าที่จับคู่ไม่ได้ {fmt(trips.length - m.matched)}) จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์ · แท็บเที่ยววิ่งเปล่าแสดงทุกเที่ยวตามเดิม</>,
        `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
        <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
      ]} />);

  // หัวแคปซูล (เจ้าของงานสั่ง 28 ก.ย. 2569 · แบบเดียวกับ Executive Dashboard) — แท็บใช้ชื่อย่อ ชื่อเต็มใน tooltip + หัวข้อแท็บ
  const tabs = OVERALL_TABS.map((t) => (
    <button key={t.id} type="button" className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "true" : undefined}
      title={t.label} onClick={() => setTab(t.id)}>{t.short}</button>
  ));
  const tabLabel = OVERALL_TABS.find((t) => t.id === tab)?.label;

  return (
    <>
      <EtlBanner status={etlAll} />
      <DashShell title={title} sample={m?.isSample} meta={meta || undefined}
        onRefresh={reload} loading={loading} refreshTitle={refreshTitle}
        capsule={{ tabs, filters: true, sub: m ? dataRangeText(m.dateRange.min, m.dateRange.max) : undefined }}>
        <h2 className="dm-part-h">{tabLabel}</h2>
        {/* อยู่ในแผงตัวกรองของทุกแท็บ (FilterBar portal เข้าแผงเดียวกับตัวกรองของแท็บ) */}
        <FilterBar><DataSourceFilter newCount={srcCtx?.trips?.length} /></FilterBar>
        {/* สีรายแท็บจากหน้าการตั้งค่า (lib/ui/ThemeScope.tsx) */}
        <ThemeScope scope={`overall:${tab}`}>
        {STANDALONE.has(tab) ? (
          <>{tab === "lf" && <LoadFactorTab />}{tab === "tonkm" && <TonKmTab />}</>
        ) : error ? (
          <div className="card">
            <div className="banner">{error}</div>
            <p className="muted">
              สร้างไฟล์ข้อมูลด้วย <code>python etl/build_costrev.py --dataset sample</code> (หรือ <code>--dataset real</code>
              เมื่อวางไฟล์จริงใน <code>etl/data/Dashboard real data/</code> แล้ว)
            </p>
          </div>
        ) : !m ? (
          <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
        ) : trips.length === 0 ? (
          <div className="card">
            <h2>ยังไม่มีข้อมูล</h2>
            <p className="muted">
              ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง — ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่
            </p>
          </div>
        ) : (
          <>
            {tab === "fleet" && <FleetTab trips={trips} />}
            {/* ชุด inProfitScope เหมือนทุกแท็บ (เจ้าของงานเคาะ 24 ก.ย. 2569) — 3a0d95c เผลอส่ง data.trips ทั้งไฟล์ ตัวหารเที่ยว/ต้นทุนจึงเกิน (แก้ 1 ต.ค. 2569) */}
            {tab === "empty" && <EmptyTab trips={trips} />}
            {tab === "damage" && <DamageTab trips={trips} matchedTotal={m.matched} isSample={m.isSample} />}
            {tab === "detail3" && <Detail3Tab trips={trips} />}
          </>
        )}
        </ThemeScope>
      </DashShell>
    </>
  );
}
