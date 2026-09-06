/**
 * โครงแอปและเมนู — ยกโครงจาก index.html บน branch main
 *
 * แถบเมนูซ้ายสีครีม 252px ไม่มีบล็อกชื่อแบรนด์ · แถบตำแหน่งอยู่มุมบนขวาเห็นได้ทุกหน้า
 * แต่ละตำแหน่งเห็นเมนูไม่เท่ากันตาม ROLE_VIEWS
 *
 * ใช้ hash routing (#/records) แทน history API เพราะ GitHub Pages เป็น static host
 * ถ้าใช้ path จริงแล้วผู้ใช้กด refresh หน้ากลางทาง เซิร์ฟเวอร์จะหา path นั้นไม่เจอ → 404
 */
import { Suspense, lazy, useEffect, useState } from "react";
import EntryForm from "./features/entry/EntryForm";
import RecordsList from "./features/records/RecordsList";
import Drafts from "./features/drafts/Drafts";
import Debtors from "./features/debtors/Debtors";
import CustCode from "./features/custcode/CustCode";
import Settings from "./features/settings/Settings";
// แดชบอร์ดลากไลบรารีกราฟมาด้วยราว 400 KB แยกเป็นก้อนต่างหาก
// คนที่เข้ามาแค่กรอกข้อมูลจะได้ไม่ต้องโหลดตาม
const FleetDash = lazy(() => import("./features/dash-fleet/FleetDash"));
const RevenueDash = lazy(() => import("./features/dash-revenue/RevenueDash"));
const RouteProfit = lazy(() => import("./features/dash-join/RouteProfit"));
import { ROLES, ROLE_PICK, ROLE_VIEWS } from "./lib/record/roles";
import { migrateFromLocalStorage } from "./lib/store/records";
import { useRecords } from "./lib/store/useRecords";
import { IS_SAMPLE } from "./lib/dataset";
import type { RoleKey } from "./types/record";

const LS_ROLE = "modelRole";

/* ไอคอนเส้นชุดเดียวกับ main */
const I = {
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>,
  plus: <svg className="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  person: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5Z" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
  split: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>,
};

interface PageDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  h1: string;
  /** คำอธิบายใต้หัวเรื่อง — main ตัดออกในบางหน้า */
  sub?: string;
  badge?: "drafts";
}

const PAGES: PageDef[] = [
  { id: "dash-fleet", label: "แดชบอร์ด", icon: I.dash, h1: "แดชบอร์ด" },
  { id: "entry", label: "บันทึกข้อมูล", icon: I.plus, h1: "บันทึกข้อมูล",
    sub: "หน้านี้แสดงเฉพาะช่องที่ฝ่ายคุณกรอกได้ → บันทึก · ใบจะเข้า “รายการทั้งหมด” เมื่อครบทั้ง 3 ฝ่าย" },
  { id: "records", label: "รายการทั้งหมด", icon: I.list, h1: "รายการทั้งหมด",
    sub: "รายการที่บันทึกไว้ · บันทึกลง Google Sheet ของคุณ (จุดเขียว = ซิงก์แล้ว)" },
  { id: "drafts", label: "ใบที่ยังไม่ครบ", icon: I.check, h1: "ใบที่ยังไม่ครบ", badge: "drafts",
    sub: "ใบที่ยังกรอกไม่ครบทั้ง 3 ฝ่าย · กดที่แถวเพื่อเปิดใบนั้นมากรอกส่วนของคุณ" },
  { id: "debtors", label: "รายการลูกหนี้", icon: I.person, h1: "รายการลูกหนี้",
    sub: "แยกเป็นรายบิล · กดปุ่ม “ชำระ” เมื่อลูกหนี้มาจ่าย · ต้องจ่ายครบทุกรายในใบเดียวกัน สถานะใบจึงเปลี่ยนเป็นชำระแล้ว" },
  { id: "dash-revenue", label: "แดชบอร์ดรายได้", icon: I.chart, h1: "แดชบอร์ดรายได้",
    sub: "รายได้จากไฟล์บิลย้อนหลัง · กรองตามเดือนและมิติต่าง ๆ ได้" },
  { id: "route-profit", label: "กำไรรายเส้นทาง", icon: I.split, h1: "กำไรรายเส้นทาง",
    sub: "รวมรายได้จากไฟล์บิล เข้ากับต้นทุนจากโมเดลเดินรถ ด้วยคีย์ ต้นทาง → ปลายทาง" },
  { id: "custcode", label: "ค้นหารหัสลูกค้า", icon: I.search, h1: "ค้นหารหัสลูกค้า",
    sub: "เทียบรหัสย่อ (CUSxxxxxxx) กับรหัสต้นฉบับ · ค้นหาได้ทั้งสองทาง" },
  { id: "settings", label: "การตั้งค่า", icon: I.gear, h1: "การตั้งค่า" },
];

export default function App() {
  const [role, setRole] = useState<RoleKey | null>(
    () => (localStorage.getItem(LS_ROLE) as RoleKey | null) ?? null,
  );
  const [migrated, setMigrated] = useState<number | null>(null);
  const state = useRecords();

  /* เมนูที่ตำแหน่งนี้เข้าได้ */
  const allowed = role ? ROLE_VIEWS[role] : [];
  const pages = PAGES.filter((p) => allowed.includes(p.id));

  const readHash = (): string => {
    const h = location.hash.replace(/^#\/?/, "");
    return allowed.includes(h) ? h : (allowed[0] ?? "entry");
  };
  const [page, setPage] = useState<string>(readHash);

  useEffect(() => {
    const on = () => setPage(readHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  /* เปลี่ยนตำแหน่งแล้วหน้าเดิมอาจเข้าไม่ได้ → เด้งไปหน้าแรกที่เข้าได้ */
  useEffect(() => {
    if (role && !allowed.includes(page)) {
      const first = allowed[0] ?? "entry";
      location.hash = `#/${first}`;
      setPage(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    migrateFromLocalStorage()
      .then((r) => { if (!r.alreadyDone && r.migrated) setMigrated(r.migrated); })
      .catch(() => { /* private mode อาจใช้ IndexedDB ไม่ได้ ไม่ถือว่าพัง */ });
  }, []);

  const goto = (p: string) => { location.hash = `#/${p}`; setPage(p); };

  const draftCount = state.records.filter(
    (r) => !r._csDone || !r._dispatchDone || !r._accountDone,
  ).length;

  if (!role) return <RolePicker onPick={(k) => { localStorage.setItem(LS_ROLE, k); setRole(k); }} />;

  const cur = pages.find((p) => p.id === page) ?? pages[0];

  return (
    <>
      <aside className="sidebar">
        <nav className="nav">
          {pages.map((p) => (
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
        <div className="rolebar">
          <span className="who">{ROLES[role].label}</span>
          <button type="button" className="sw" onClick={() => setRole(null)}>เปลี่ยนหน้าที่</button>
        </div>

        {IS_SAMPLE && (
          <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</div>
        )}

        {cur && (
          <div className="page-h">
            <h1>{cur.h1}</h1>
            {cur.sub && <p>{cur.sub}</p>}
          </div>
        )}

        {migrated != null && (
          <div className="edit-banner" style={{ display: "flex" }}>
            ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {migrated} ใบ
            <button type="button" className="x" onClick={() => setMigrated(null)}>ปิด</button>
          </div>
        )}

        {page === "entry" && <EntryForm role={role} />}
        {page === "drafts" && <Drafts state={state} />}
        {page === "records" && <RecordsList state={state} />}
        {page === "debtors" && <Debtors state={state} />}
        {page === "settings" && <Settings />}
        <Suspense fallback={<div className="card"><p className="muted">กำลังโหลดแดชบอร์ด...</p></div>}>
          {page === "dash-fleet" && <FleetDash state={state} />}
          {page === "dash-revenue" && <RevenueDash />}
          {page === "route-profit" && <RouteProfit state={state} />}
        </Suspense>
        {page === "custcode" && <CustCode />}
      </main>
    </>
  );
}

/**
 * หน้าเลือกหน้าที่ — เต็มจอ ตามดีไซน์ Role Selection ของ main
 * ต้องเลือกการ์ดก่อนปุ่ม Continue จึงจะกดได้ และเลื่อนเลือกด้วยลูกศรได้
 */
function RolePicker({ onPick }: { onPick: (k: RoleKey) => void }) {
  const [sel, setSel] = useState<RoleKey | null>(null);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = ROLE_PICK[(i + d + ROLE_PICK.length) % ROLE_PICK.length]!;
    setSel(next);
    (e.currentTarget.parentElement?.children[ROLE_PICK.indexOf(next)] as HTMLElement)?.focus();
  };

  return (
    <div className="picker-ov">
      <div className="picker-bx">
        <div className="rs-head">
          <h1>Select your role</h1>
          <p>เลือกตำแหน่งของคุณเพื่อเข้าสู่หน้าจอการทำงานที่ตรงกับหน้าที่</p>
        </div>

        <div className="rs-grid" role="radiogroup" aria-label="Select your role">
          {ROLE_PICK.map((k, i) => (
            <button
              key={k} type="button" role="radio"
              aria-checked={sel === k}
              className={"ropt" + (k === "admin" ? " wide" : "")}
              onClick={() => setSel(k)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="ix">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="t">{ROLES[k].en}</span>
                <span className="d">{ROLES[k].desc}</span>
              </span>
              <span className="ring" />
            </button>
          ))}
        </div>

        <div className="rs-foot">
          <button
            type="button"
            className={"rs-cta" + (sel ? " on" : "")}
            disabled={!sel} aria-disabled={!sel}
            onClick={() => sel && onPick(sel)}
          >
            <span>{sel ? `Continue as ${ROLES[sel].en}` : "Continue"}</span>
            <span style={{ fontSize: 15 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
