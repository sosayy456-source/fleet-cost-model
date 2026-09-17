/**
 * แดชบอร์ดต้นทุน+รายได้รายเที่ยว จากไฟล์ realalldata — สองเมนู หน้าตาเดียวกัน ต่างกันที่ข้อมูล
 *
 *   Executive Dashboard  (mode "exec")  เฉพาะเที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง (m = true)
 *   Dashboard รวม         (mode "all")   ทุกเที่ยวในไฟล์
 *
 * สามแท็บจากไฟล์ต้นทุน: กองรถ (สเปกส่วนที่ 1) · กำไรรายเที่ยว (ส่วนที่ 2) · ต้นทุน (เอกสารจัดประเภทต้นทุน)
 *
 * ★ Executive Dashboard มีอีกสองแท็บที่ย้ายมาจากเมนู "แดชบอร์ดรายได้" ที่ถูกยุบไป (17 ก.ย. 2569)
 *   Dashboard รายได้ · Dashboard ลูกหนี้ — ทั้งคู่ **ไม่ใช้ trips เลย** อ่านไฟล์ชุดของตัวเอง
 *   จึงต้องเข้าได้แม้ไฟล์ต้นทุนจะยังไม่มีหรือโหลดไม่ขึ้น ข้อความ "ยังไม่มีข้อมูล" และแถบสรุป
 *   ของไฟล์ต้นทุนจึงอยู่ในตัวแท็บที่ใช้ trips ไม่ได้ครอบทั้งหน้าเหมือนเดิม
 *   (แท็บ "กำไรลูกค้า (ปันส่วนต้นทุน)" ย้ายลงไปเป็นแท็บย่อยของ Dashboard รายได้ตามที่สั่ง)
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
import DebtorBoard from "../dash-revenue/board/DebtorBoard";
import RevenueBoard from "../dash-revenue/board/RevenueBoard";
import FleetTab from "./FleetTab";
import ProfitTab from "./ProfitTab";
import CostTab from "./CostTab";
import type { RecordsState } from "../../lib/store/useRecords";

export type CostRevMode = "exec" | "all";

const TABS = [
  { id: "fleet", label: "กองรถ" },
  { id: "profit", label: "กำไรรายเที่ยว" },
  { id: "cost", label: "ต้นทุน" },
  // สองแท็บนี้ไม่ใช้ trips เลย — อ่านไฟล์ชุดของตัวเองและโหลดเอง
  // มีเฉพาะ Executive Dashboard ตามที่เจ้าของข้อมูลสั่ง ส่วน Dashboard รวม ไม่มี
  { id: "rev", label: "Dashboard รายได้", execOnly: true },
  { id: "debt", label: "Dashboard ลูกหนี้", execOnly: true },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** แท็บที่อ่านไฟล์ของตัวเอง ไม่ต้องรอ trips และไม่ต้องมีแถบสรุปของไฟล์ต้นทุน */
const STANDALONE: TabId[] = ["rev", "debt"];

export default function CostRevDash({ mode, state }: { mode: CostRevMode; state: RecordsState }) {
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

  const standalone = STANDALONE.includes(tab);
  const m = data?.manifest;
  const info = !m ? "" : mode === "exec"
    ? `${fmt(m.matched)} เที่ยวที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง จาก ${fmt(m.rows)} เที่ยวในไฟล์ · ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`
    : `${fmt(m.rows)} เที่ยวทั้งหมดในไฟล์ · ${m.costFiles.join(", ")}`;

  /** เนื้อของแท็บที่ต้องมี trips — สามสถานะที่เดิมเคยครอบทั้งหน้าไว้ ย้ายมาอยู่ในนี้แทน */
  const tripsBody = (node: () => React.ReactNode) => {
    if (error) {
      return (
        <div className="card">
          <h2>ไม่มีข้อมูลต้นทุน+รายได้รายเที่ยว</h2>
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
    if (trips.length === 0) {
      return (
        <div className="card">
          <h2>ยังไม่มีข้อมูล</h2>
          <p className="muted">
            {mode === "exec"
              ? "ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง — ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่"
              : "ไฟล์ต้นทุนไม่มีแถวข้อมูล"}
          </p>
        </div>
      );
    }
    return node();
  };

  return (
    <>
      {/* แถบสถานะ ETL กับแถบสรุปเป็นเรื่องของไฟล์ต้นทุน — สองแท็บที่อ่านไฟล์อื่นมีแถบของตัวเอง */}
      {!standalone && <EtlBanner status={etl} />}
      {!standalone && data && m && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {info} · {m.dateRange.min} → {m.dateRange.max}
              {m.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
            </span>
            <span style={{ marginLeft: "auto" }}>{refresh}</span>
          </div>
        </div>
      )}

      <div className="dash-tabs" ref={barRef}>
        <span className="dink" />
        {TABS.filter((t) => !("execOnly" in t && t.execOnly) || mode === "exec").map((t) => (
          <button key={t.id} type="button" className={"dtab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "fleet" && tripsBody(() => <FleetTab trips={trips} />)}
      {tab === "profit" && tripsBody(() => <ProfitTab trips={trips} />)}
      {tab === "cost" && tripsBody(() => <CostTab trips={trips} />)}
      {tab === "rev" && mode === "exec" && <RevenueBoard />}
      {tab === "debt" && mode === "exec" && <DebtorBoard state={state} />}
    </>
  );
}
