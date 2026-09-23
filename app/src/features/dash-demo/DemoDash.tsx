/**
 * เมนู "Demo" — หน้าทดลอง เห็นเฉพาะผู้ดูแลระบบ (ROLE_VIEWS.admin)
 *
 * ใช้ข้อมูลชุดเดียวกับ Executive Dashboard คือ `costrev/trips.json` เฉพาะเที่ยวที่
 * **เลขที่ใบรายการฝั่งต้นทุนตรงกับฝั่งรายได้** (m = true) — เที่ยวที่จับคู่ไม่ได้ไม่มีบิล
 * จึงคิด จำนวนบิล / จำนวนลูกค้า ไม่ได้ ซึ่งเป็นตัวหารหลักของหน้านี้
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
import { useCostRev } from "../../lib/data/useCostRev";
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
/** แท็บที่ใช้ทุกแถวในไฟล์ต้นทุน ไม่กรองด้วย m — เที่ยวเปล่าไม่มีรายได้จึงไม่มีบิลให้จับคู่
 *  (กฎเดียวกับ ALL_TRIPS ของ CostRevDash · เจ้าของข้อมูลชี้ขาด 22 ก.ย. 2569) */
const ALL_TRIPS: ReadonlySet<TabId> = new Set<TabId>(["item2"]);

export default function DemoDash() {
  const { data, error, loading, reload } = useCostRev();
  const etl = useEtlStatus("costrev");
  useAutoReloadOnEtl(etl, reload);
  const [tab, setTab] = useState<TabId>("route");
  const barRef = useRef<HTMLDivElement>(null);
  const ready = !!data && !error;
  useDashInk(barRef, `${tab}:${ready}`);

  const trips = useMemo(() => (data ? data.trips.filter((t) => t.m) : []), [data]);
  /** ชุดที่แท็บปัจจุบันใช้ตัดสินว่า "มีข้อมูลไหม" — ปกติเฉพาะเที่ยวที่จับคู่ได้ ยกเว้นแท็บใน ALL_TRIPS */
  const shown = useMemo(() => (ALL_TRIPS.has(tab) ? data?.trips ?? [] : trips), [data, trips, tab]);

  const m = data?.manifest;
  const meta = m && (
    <Meta parts={[
      <><b>{fmt(m.matched)}</b> เที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
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
        ) : shown.length === 0 ? (
          <div className="card">
            <h2>ยังไม่มีข้อมูล</h2>
            <p className="muted">
              {ALL_TRIPS.has(tab)
                ? "ไฟล์ต้นทุนไม่มีแถวข้อมูล"
                : "ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง — ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่"}
            </p>
          </div>
        ) : (
          <>
            {tab === "route" && <RouteProfitTab trips={trips} />}
            {tab === "item2" && <Item2Tab allTrips={shown} />}
            {tab === "item3" && <Item3Tab trips={trips} />}
          </>
        )}
      </DashShell>
    </>
  );
}
