/**
 * โครงแอปและเมนู — ยกโครงหน้าตาจาก โมเดลเดินรถ-gsheet-v5.html:358-393
 * แถบเมนูข้างสีกรมท่าตรึงซ้าย + พื้นที่เนื้อหา .app + หัวหน้า .page-h
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
import { IS_SAMPLE } from "./lib/dataset";
import type { RoleKey } from "./types/record";

const LS_ROLE = "modelRole";

/* ไอคอนเส้นชุดเดียวกับ v5 — เก็บไว้ตรงนี้เพราะใช้ที่เดียว */
const I = {
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>,
  plus: <svg className="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  baht: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
  split: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
};

interface PageDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  h1: string;
  sub: string;
  /** ตัวเลขแดงข้างเมนู */
  badge?: "drafts";
}

const PAGES: PageDef[] = [
  { id: "dash-fleet", label: "แดชบอร์ด", icon: I.dash, h1: "แดชบอร์ด",
    sub: "ภาพรวมการเงิน · ต้นทุน · ลูกหนี้ · รวมข้อมูลใหม่กับข้อมูลเก่าจากชีต" },
  { id: "entry", label: "บันทึกข้อมูล", icon: I.plus, h1: "บันทึกข้อมูล",
    sub: "หน้านี้แสดงเฉพาะช่องที่ฝ่ายคุณกรอกได้ → บันทึก · ใบจะเข้า “รายการทั้งหมด” เมื่อครบทั้ง 3 ฝ่าย" },
  { id: "records", label: "รายการทั้งหมด", icon: I.list, h1: "รายการทั้งหมด",
    sub: "รายการที่บันทึกไว้ · บันทึกลง Google Sheet ของคุณ (จุดเขียว = ซิงก์แล้ว)" },
  { id: "drafts", label: "ใบที่ยังไม่ครบ", icon: I.check, h1: "ใบที่ยังไม่ครบ", badge: "drafts",
    sub: "ใบที่ยังกรอกไม่ครบทั้ง 3 ฝ่าย · กดที่แถวเพื่อเปิดใบนั้นมากรอกส่วนของคุณ" },
  { id: "debtors", label: "รายการลูกหนี้", icon: I.baht, h1: "รายการลูกหนี้",
    sub: "แยกเป็นรายบิล (ลูกหนี้แต่ละราย) · กดปุ่ม “ชำระ” เมื่อลูกหนี้มาจ่าย · ต้องจ่ายครบทุกรายในใบรายการเดียวกัน สถานะในหน้า “รายการทั้งหมด” จึงเปลี่ยนเป็น ชำระแล้ว" },
  { id: "dash-revenue", label: "แดชบอร์ดรายได้", icon: I.chart, h1: "แดชบอร์ดรายได้",
    sub: "รายได้จากไฟล์บิลย้อนหลัง · กรองตามเดือนและมิติต่าง ๆ ได้" },
  { id: "route-profit", label: "กำไรรายเส้นทาง", icon: I.split, h1: "กำไรรายเส้นทาง",
    sub: "รวมรายได้จากไฟล์บิล เข้ากับต้นทุนจากโมเดลเดินรถ ด้วยคีย์ ต้นทาง → ปลายทาง" },
  { id: "custcode", label: "ค้นหารหัสลูกค้า", icon: I.search, h1: "ค้นหารหัสลูกค้า",
    sub: "เทียบรหัสย่อ (CUSxxxxxxx) กับรหัสต้นฉบับ · ค้นหาได้ทั้งสองทาง" },
];

function useHashPage(): [string, (p: string) => void] {
  const read = (): string => {
    const h = location.hash.replace(/^#\/?/, "");
    return PAGES.some((p) => p.id === h) ? h : "entry";
  };
  const [page, setPage] = useState<string>(read);
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

  const draftCount = state.records.filter(
    (r) => !r._csDone || !r._dispatchDone || !r._accountDone,
  ).length;

  /* หน้าจอเลือกฝ่าย — v5 เป็นกล่องซ้อนกลางจอ ไม่ใช่หน้าเต็ม */
  if (!role) {
    return (
      <div className="picker-ov">
        <div className="picker-bx">
          <h2>คุณอยู่ฝ่ายไหน</h2>
          <p>แต่ละฝ่ายกรอกเฉพาะส่วนของตัวเอง ใบจะสมบูรณ์เมื่อครบทั้ง 3 ฝ่าย เปลี่ยนทีหลังได้ตลอด</p>
          {ROLE_ORDER.map((k) => (
            <button key={k} type="button" className="ropt" onClick={() => pick(k)}>
              <span className="ic">{ROLES[k].icon}</span>
              <span>
                <div className="t">{ROLES[k].label}</div>
                <div className="d">{ROLES[k].desc}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cur = PAGES.find((p) => p.id === page)!;

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <div className="row">
            <span className="nm">โมเดลต้นทุน</span>
            {IS_SAMPLE && <span className="demo">เดโม</span>}
          </div>
          <div className="sub">ต้นทุนต่อเที่ยววิ่ง</div>
        </div>
        <nav className="navcol">
          {PAGES.map((p) => (
            <button
              key={p.id} type="button"
              className={"navitem" + (page === p.id ? " active" : "")}
              onClick={() => goto(p.id)}
            >
              {p.icon}
              {p.label}
              {p.badge === "drafts" && draftCount > 0 && (
                <span className="nav-count">{draftCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="app">
        {IS_SAMPLE && (
          <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</div>
        )}

        <div className="page-h">
          <h1>{cur.h1}</h1>
          <p>{cur.sub}</p>
        </div>

        {migrated != null && (
          <div className="edit-banner">
            ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {migrated} ใบ
            <span className="locknote"> (ของเดิมใน localStorage ยังอยู่ ไม่ได้ลบ)</span>
            <button type="button" className="x" onClick={() => setMigrated(null)}>ปิด</button>
          </div>
        )}

        {page === "entry" && (
          <>
            <div className="rolebar">
              <span className="who">{ROLES[role].icon} {ROLES[role].label}</span>
              <span className="hint">{ROLES[role].desc}</span>
              <button type="button" className="sw" onClick={() => setRole(null)}>🔁 เปลี่ยนหน้าที่</button>
            </div>
            <SheetSettings />
            <EntryForm role={role} />
          </>
        )}
        {page === "drafts" && <Drafts state={state} />}
        {page === "records" && <RecordsList state={state} />}
        {page === "debtors" && <Debtors state={state} />}
        <Suspense fallback={<div className="card"><p className="muted">กำลังโหลดแดชบอร์ด...</p></div>}>
          {page === "dash-fleet" && <FleetDash state={state} />}
          {page === "dash-revenue" && <RevenueDash />}
          {page === "route-profit" && <RouteProfit state={state} />}
        </Suspense>
        {page === "custcode" && <CustCode />}

        <div className="foot">
          โมเดลต้นทุนการเดินรถ · ข้อมูลใหม่บันทึกลง Google Sheet · ข้อมูลเก่าอ่านจากไฟล์บิลย้อนหลัง
        </div>
      </main>
    </>
  );
}
