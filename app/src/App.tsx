/**
 * โครงแอปและเมนู
 *
 * ใช้ hash routing (#/records) แทน history API เพราะ GitHub Pages เป็น static host
 * ถ้าใช้ path จริงแล้วผู้ใช้กด refresh หน้ากลางทาง เซิร์ฟเวอร์จะหา path นั้นไม่เจอ → 404
 */
import { Suspense, lazy, useEffect, useState } from "react";
import EntryForm from "./features/entry/EntryForm";
import SheetSettings from "./features/settings/SheetSettings";
import RecordsList from "./features/records/RecordsList";
import Drafts from "./features/drafts/Drafts";
import Debtors from "./features/debtors/Debtors";
import CustCode from "./features/custcode/CustCode";
// แดชบอร์ดลากไลบรารีกราฟมาด้วยราว 400 KB แยกเป็นก้อนต่างหาก
// คนที่เข้ามาแค่กรอกข้อมูลจะได้ไม่ต้องโหลดตาม
const FleetDash = lazy(() => import("./features/dash-fleet/FleetDash"));
const RevenueDash = lazy(() => import("./features/dash-revenue/RevenueDash"));
const RouteProfit = lazy(() => import("./features/dash-join/RouteProfit"));
import { ROLES, ROLE_ORDER } from "./lib/record/roles";
import { migrateFromLocalStorage } from "./lib/store/records";
import { useRecords } from "./lib/store/useRecords";
import { DATASET, IS_SAMPLE } from "./lib/dataset";
import type { RoleKey } from "./types/record";

const LS_ROLE = "modelRole";

const PAGES = [
  { id: "entry", label: "กรอกข้อมูล" },
  { id: "drafts", label: "ใบที่ยังไม่ครบ" },
  { id: "records", label: "รายการทั้งหมด" },
  { id: "debtors", label: "ลูกหนี้" },
  { id: "dash-fleet", label: "แดชบอร์ดต้นทุน" },
  { id: "dash-revenue", label: "แดชบอร์ดรายได้" },
  { id: "route-profit", label: "กำไรรายเส้นทาง" },
  { id: "custcode", label: "รหัสลูกค้า" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

function useHashPage(): [PageId, (p: PageId) => void] {
  const read = (): PageId => {
    const h = location.hash.replace(/^#\/?/, "");
    return (PAGES.some((p) => p.id === h) ? h : "entry") as PageId;
  };
  const [page, setPage] = useState<PageId>(read);
  useEffect(() => {
    const on = () => setPage(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return [page, (p) => { location.hash = `#/${p}`; setPage(p); }];
}

export default function App() {
  const [role, setRole] = useState<RoleKey | null>(
    () => (localStorage.getItem(LS_ROLE) as RoleKey | null) ?? null,
  );
  const [page, goto] = useHashPage();
  const [migrated, setMigrated] = useState<number | null>(null);
  const state = useRecords();

  useEffect(() => {
    migrateFromLocalStorage()
      .then((r) => { if (!r.alreadyDone && r.migrated) setMigrated(r.migrated); })
      .catch(() => { /* private mode อาจใช้ IndexedDB ไม่ได้ ไม่ถือว่าพัง */ });
  }, []);

  const pick = (k: RoleKey) => { localStorage.setItem(LS_ROLE, k); setRole(k); };

  if (!role) {
    return (
      <div className="wrap">
        {IS_SAMPLE && <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท (dataset: {DATASET})</div>}
        <h1>โมเดลต้นทุนการเดินรถ</h1>
        <p className="sub">เลือกฝ่ายของคุณก่อนเริ่มใช้งาน</p>
        <div className="card">
          <h2>คุณอยู่ฝ่ายไหน</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            แต่ละฝ่ายกรอกเฉพาะส่วนของตัวเอง ใบจะสมบูรณ์เมื่อครบทั้ง 3 ฝ่าย เปลี่ยนทีหลังได้ตลอด
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ROLE_ORDER.map((k) => (
              <button key={k} type="button" onClick={() => pick(k)} style={{ textAlign: "left" }}>
                <b>{ROLES[k].icon} {ROLES[k].label}</b><br />
                <span className="muted" style={{ fontSize: 12 }}>{ROLES[k].desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      {IS_SAMPLE && <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท (dataset: {DATASET})</div>}

      <h1>โมเดลต้นทุนการเดินรถ</h1>
      <p className="sub">
        กำลังใช้งานในฐานะ <b>{ROLES[role].icon} {ROLES[role].label}</b>{" "}
        <button type="button" className="link" onClick={() => setRole(null)}>เปลี่ยนฝ่าย</button>
      </p>

      <nav className="nav">
        {PAGES.map((p) => (
          <button
            key={p.id} type="button"
            className={"nav-item" + (page === p.id ? " nav-active" : "")}
            onClick={() => goto(p.id)}
          >
            {p.label}
            {p.id === "drafts" && state.records.filter((r) => !r._csDone || !r._dispatchDone || !r._accountDone).length > 0 && (
              <span className="nav-badge">
                {state.records.filter((r) => !r._csDone || !r._dispatchDone || !r._accountDone).length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {migrated != null && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {migrated} ใบ
          <span className="muted"> (ของเดิมใน localStorage ยังอยู่ ไม่ได้ลบ)</span>
        </div>
      )}

      {page === "entry" && <><SheetSettings /><EntryForm role={role} /></>}
      {page === "drafts" && <Drafts state={state} />}
      {page === "records" && <RecordsList state={state} />}
      {page === "debtors" && <Debtors state={state} />}
      <Suspense fallback={<div className="card"><p className="muted">กำลังโหลดแดชบอร์ด...</p></div>}>
        {page === "dash-fleet" && <FleetDash state={state} />}
        {page === "dash-revenue" && <RevenueDash />}
        {page === "route-profit" && <RouteProfit state={state} />}
      </Suspense>
      {page === "custcode" && <CustCode />}
    </div>
  );
}
