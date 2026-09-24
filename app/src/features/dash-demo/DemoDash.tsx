/**
 * เมนู "Demo" — หน้าทดลอง เห็นเฉพาะผู้ดูแลระบบ (ROLE_VIEWS.admin)
 *
 * ใช้ `costrev/trips.json` ชุด `inProfitScope()` = **เที่ยวที่จับคู่เลขที่ใบรายการกับไฟล์รายได้ได้ (m)
 * + เที่ยววิ่งเปล่า** (เจ้าของงานเคาะ 24 ก.ย. 2569 — เดิมใช้ m อย่างเดียว เที่ยวเปล่าหลุดออกไปเองโดยไม่ได้ตั้งใจ
 * เพราะไม่มีบิลให้จับคู่ กำไรจึงสูงเกินจริง) · เที่ยวที่จับคู่ไม่ได้ทั้งที่มีรายได้ยังไม่นับ เพราะไม่มีบิล
 * คิด จำนวนบิล / จำนวนลูกค้า ไม่ได้ · เที่ยวเปล่ามีบิล 0 ลูกค้าว่าง กลุ่มบริการว่าง (ขึ้นเป็น "ไม่ระบุ")
 *
 * แท็บ "กำไรลูกค้า" (22 ก.ย. 2569) **ไม่ใช้ trips เลย** — อ่านชุด alloc/ กับ debtors/ ของตัวเอง
 * จึงต้องเข้าได้แม้ไฟล์ต้นทุนจะหาย/ยังโหลดไม่เสร็จ (ทำนองเดียวกับ STANDALONE ใน CostRevDash)
 * แถบแท็บจึงขึ้นเสมอ และข้อความ error/ว่างของ trips ขึ้นเฉพาะแท็บที่ใช้ trips
 */
import { useMemo, useRef, useState } from "react";
import { useDashInk } from "../../lib/chart/dashfx";
import DashShell, { Meta } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev, inProfitScope } from "../../lib/data/useCostRev";
import { fmt } from "../dash-costrev/common";
import RouteProfitTab from "./RouteProfitTab";
import Item2Tab from "./Item2Tab";
import Item3Tab from "./Item3Tab";
import CustomerProfitTab from "./CustomerProfitTab";
import TruckLoader from "../../lib/ui/TruckLoader";

const TABS = [
  { id: "route", label: "กำไรรายเส้นทาง" },
  { id: "item2", label: "ข้อ 2" },
  { id: "item3", label: "ข้อ 3" },
  { id: "cust", label: "กำไรลูกค้า" },
] as const;
type TabId = (typeof TABS)[number]["id"];
/** แท็บที่ไม่ใช้ trips — แสดงได้ทันทีโดยไม่รอ/ไม่สน error ของ costrev */
const STANDALONE: ReadonlySet<TabId> = new Set<TabId>(["cust"]);

export default function DemoDash() {
  const { data, error, loading, reload } = useCostRev();
  const etl = useEtlStatus("costrev");
  useAutoReloadOnEtl(etl, reload);
  const [tab, setTab] = useState<TabId>("route");
  const barRef = useRef<HTMLDivElement>(null);
  const ready = !!data && !error;
  useDashInk(barRef, `${tab}:${ready}`);

  const trips = useMemo(() => (data ? data.trips.filter(inProfitScope) : []), [data]);
  const emptyN = useMemo(() => trips.filter((t) => t.empty).length, [trips]);

  const m = data?.manifest;
  const meta = m && (
    <Meta parts={[
      <><b>{fmt(trips.length)}</b> เที่ยว = จับคู่กับข้อมูลรายได้ได้ <b>{fmt(trips.length - emptyN)}</b> + เที่ยววิ่งเปล่า <b>{fmt(emptyN)}</b> จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
      `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
      <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
    ]} />
  );

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
      <EtlBanner status={etl} />
      <DashShell sample={m?.isSample} meta={meta || undefined} tabs={tabs}
        onRefresh={reload} loading={loading} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่">
        {STANDALONE.has(tab) ? (
          <>{tab === "cust" && <CustomerProfitTab />}</>
        ) : error ? (
          <div className="card">
            <div className="banner">{error}</div>
            <p className="muted">
              สร้างไฟล์ข้อมูลด้วย <code>python etl/build_costrev.py --dataset sample</code> (หรือ <code>--dataset real</code>)
            </p>
          </div>
        ) : !m ? (
          <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
        ) : trips.length === 0 ? (
          <div className="card">
            <h2>ยังไม่มีข้อมูล</h2>
            <p className="muted">
              ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง และไม่มีเที่ยววิ่งเปล่า —
              ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่
            </p>
          </div>
        ) : (
          <>
            {tab === "route" && <RouteProfitTab trips={trips} />}
            {tab === "item2" && <Item2Tab allTrips={trips} />}
            {tab === "item3" && <Item3Tab trips={trips} />}
          </>
        )}
      </DashShell>
    </>
  );
}
