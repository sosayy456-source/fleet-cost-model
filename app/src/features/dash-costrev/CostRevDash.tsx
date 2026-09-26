/**
 * Overall Dashboard (เดิมชื่อ Executive Dashboard — เปลี่ยน 25 ก.ย. 2569 · ชื่อ Executive Dashboard ย้ายไปเป็นของเมนู Demo)
 *   แดชบอร์ดต้นทุน+รายได้รายเที่ยว จากไฟล์ realalldata
 *   ชุด inProfitScope() = จับคู่กับข้อมูลรายได้ได้ (m) + เที่ยววิ่งเปล่า (เจ้าของงานเคาะ 24 ก.ย. 2569 — ชุดเดียวกับเมนู Demo)
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
 * ★ ทุกแท็บของโหมด exec ใช้ชุดเดียวกัน (24 ก.ย. 2569) — เดิมแท็บ "เที่ยววิ่งเปล่า" เป็นข้อยกเว้นที่ใช้ทุกแถวในไฟล์
 *   (ALL_TRIPS) ส่วนแท็บอื่นใช้ m อย่างเดียว เที่ยวเปล่าจึงหลุดจากกำไร และ % เที่ยวเปล่าหารด้วยต้นทุนของเที่ยว
 *   ที่หน้าอื่นไม่นับ · ตอนนี้ทุกแท็บได้ m + เที่ยวเปล่า แท็บที่ไม่ควรนับเที่ยวเปล่าตัดออกเอง (Damage · ตารางสรุป)
 *
 * แยกขาดจากแดชบอร์ดเดิม (dash-fleet) ทั้งข้อมูลและโค้ด ใช้ร่วมแค่คอมโพเนนต์แสดงผล
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { clearExecTab, peekExecTab } from "../../lib/ui/dashJump";
import { useDashInk } from "../../lib/chart/dashfx";
import DashShell, { Meta } from "../../lib/ui/DashShell";
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

const TABS = [
  // ชื่อแท็บเปลี่ยนเป็นภาษาอังกฤษ 25 ก.ย. 2569 (เจ้าของงานสั่ง) — id เดิม · ชื่อไทยเดิมอยู่ท้ายบรรทัด
  { id: "fleet", label: "Vehicle Utilization" },            // การใช้ประโยชน์ของกองรถ
  { id: "damage", label: "Damage Rate" },
  { id: "empty", label: "Empty Trips" },                    // เที่ยววิ่งเปล่า
  { id: "lf", label: "Inefficient Transportation Cost" },  // ต้นทุนที่จมกับที่ว่าง
  { id: "tonkm", label: "Contribution Margin" },            // กำไรส่วนเกิน/ตัน-กม.
  // สเปก ข้อ3.pdf (23 ก.ย. 2569) — ใช้ trips ชุดเดียวกับแท็บอื่น (ตัน-กม. คิดได้เฉพาะเที่ยวที่มีน้ำหนัก wt จากบิล)
  { id: "detail3", label: "Vehicle Utilization Cost" },     // รายละเอียด ข้อ 3
] as const;
type TabId = (typeof TABS)[number]["id"];
/** แท็บที่ไม่ใช้ trips — แสดงได้ทันทีโดยไม่รอ/ไม่สน error ของ costrev */
const STANDALONE: ReadonlySet<TabId> = new Set<TabId>(["lf", "tonkm"]);

export default function CostRevDash() {
  const { data, error, loading, reload } = useCostRev();
  // dev server แปลงไฟล์ให้เองเมื่อวางไฟล์ใน etl/data/Dashboard real data/ — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("costrev");
  // แถบที่หัวหน้า = สถานะรวมทุกงาน ETL (งานปันส่วนกำไรลูกค้าแปลงต่อหลังงานนี้อีกนาน)
  const etlAll = useEtlStatus("all");
  useAutoReloadOnEtl(etl, reload);
  // แท็บที่หน้าอื่นสั่งให้เปิด (lib/ui/dashJump.ts) — รับเฉพาะชื่อแท็บที่มีจริง
  const [tab, setTab] = useState<TabId>(() => {
    const want = peekExecTab();
    return TABS.some((t) => t.id === want) ? (want as TabId) : "fleet";
  });
  useEffect(() => { clearExecTab(); }, []);
  const barRef = useRef<HTMLDivElement>(null);
  const ready = !!data && !error;
  useDashInk(barRef, `${tab}:${ready}`);
  // แถบแท็บเลื่อนด้านข้างได้ (จอแคบ/แท็บเยอะ) — เปิดตรงแท็บท้าย ๆ จากหน้าอื่นแล้วแท็บต้องไม่ถูกบังอยู่นอกจอ
  useEffect(() => {
    const bar = barRef.current, btn = bar?.querySelector<HTMLElement>(".dtab.active");
    if (bar && btn) bar.scrollTo({ left: btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2 });
  }, [tab]);

  const trips = useMemo(() => {
    if (!data) return [];
    return data.trips.filter(inProfitScope);
  }, [data]);
  const emptyN = useMemo(() => trips.filter((t) => t.empty).length, [trips]);

  const refreshTitle = "ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่";
  const m = data?.manifest;
  const title = "Overall Dashboard";
  // บรรทัดที่มาของข้อมูลใต้หัวเรื่อง — ข้อความตามดีไซน์ 1A
  const meta = m && (
    <Meta parts={[
        <><b>{fmt(trips.length)}</b> เที่ยว = จับคู่กับข้อมูลรายได้ได้ <b>{fmt(trips.length - emptyN)}</b> + เที่ยววิ่งเปล่า <b>{fmt(emptyN)}</b> จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
        `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
        <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
      ]} />);

  const tabs = (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {TABS.map((t) => (
        <button key={t.id} type="button" className={"dtab" + (tab === t.id ? " active" : "")}
          onClick={() => setTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );

  return (
    <>
      <EtlBanner status={etlAll} />
      <DashShell title={title} sample={m?.isSample} meta={meta || undefined}
        tabs={tabs} onRefresh={reload} loading={loading} refreshTitle={refreshTitle}>
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
            {tab === "empty" && <EmptyTab trips={trips} />}
            {tab === "damage" && <DamageTab trips={trips} matchedTotal={m.matched} isSample={m.isSample} />}
            {tab === "detail3" && <Detail3Tab trips={trips} />}
          </>
        )}
      </DashShell>
    </>
  );
}
