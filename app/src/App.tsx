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
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import { ROLES, ROLE_PICK, ROLE_VIEWS, roleAllDone, roleDone } from "./lib/record/roles";
import { billIsPaid, recBills } from "./lib/record/payment";
import { useRecords } from "./lib/store/useRecords";
import { IS_SAMPLE } from "./lib/dataset";
import type { RoleKey } from "./types/record";

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
  /**
   * id ของ <section class="view"> ตามที่ main ตั้งไว้
   * สำคัญมาก: โทเคนสีทั้งชุดของแดชบอร์ด (--d-card, --d-ink, ฟอนต์ Anuphan ฯลฯ)
   * ถูกประกาศไว้ใต้ #view-dash เท่านั้น ถ้าไม่มี element นี้ครอบ กราฟจะได้สีว่างเปล่า
   */
  view: string;
  /** ตัวเลขสีแดงท้ายเมนู — main มีสองอัน: ใบที่ยังไม่ครบ และ ลูกหนี้ค้างชำระ */
  badge?: "drafts" | "debt";
}

const PAGES: PageDef[] = [
  { id: "dash-fleet", view: "dash", label: "แดชบอร์ด", icon: I.dash, h1: "แดชบอร์ด" },
  { id: "entry", view: "form", label: "บันทึกข้อมูล", icon: I.plus, h1: "บันทึกข้อมูล" },
  { id: "records", view: "records", label: "รายการทั้งหมด", icon: I.list, h1: "รายการทั้งหมด" },
  { id: "drafts", view: "drafts", label: "ใบที่ยังไม่ครบ", icon: I.check, h1: "ใบที่ยังไม่ครบ", badge: "drafts" },
  { id: "debtors", view: "debtors", label: "รายการลูกหนี้", icon: I.person, h1: "รายการลูกหนี้", badge: "debt" },
  { id: "custcode", view: "custcode", label: "ค้นหารหัสลูกค้า", icon: I.search, h1: "ค้นหารหัสลูกค้า" },
  { id: "settings", view: "settings", label: "การตั้งค่า", icon: I.gear, h1: "การตั้งค่า" },
  // สองหน้านี้ไม่มีใน index.html บน main — เป็นของที่โปรเจ็กต์นี้เพิ่ม (Phase 6-8)
  { id: "dash-revenue", view: "dash", label: "แดชบอร์ดรายได้", icon: I.chart, h1: "แดชบอร์ดรายได้" },
  { id: "route-profit", view: "dash", label: "กำไรรายเส้นทาง", icon: I.split, h1: "กำไรรายเส้นทาง" },
];

export default function App() {
  // เปิดเว็บทุกครั้งต้องเลือกตำแหน่งใหม่เสมอ ไม่จำไว้ในเครื่อง (ตรงตาม main:2129)
  const [role, setRole] = useState<RoleKey | null>(null);
  const state = useRecords();
  const [dismissed, setDismissed] = useState(false);

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

  /* เลือกตำแหน่งแล้วเปิดหน้าแรกของตำแหน่งนั้นเสมอ — main:2241 showView(ROLE_VIEWS[ROLE][0]) */
  useEffect(() => {
    if (!role) return;
    const first = allowed[0] ?? "entry";
    location.hash = `#/${first}`;
    setPage(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const goto = (p: string) => { location.hash = `#/${p}`; setPage(p); };

  // main:2355 — นับเฉพาะใบที่ยังไม่ครบ "และฝ่ายของเรายังไม่ได้กรอก" จึงเปลี่ยนตามตำแหน่ง
  const draftCount = state.records.filter((r) => !roleAllDone(r) && !(role && roleDone(r, role))).length;

  // main:3002 — นับบิลของใบใหม่ที่ยังไม่ได้ชำระ (ไม่รวมข้อมูลเก่าจากชีต)
  const debtCount = state.records.flatMap(recBills).filter((b) => !billIsPaid(b)).length;

  if (!role) return <RolePicker onPick={setRole} />;

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
              {p.badge === "debt" && debtCount > 0 && (
                <span className="nav-count">{debtCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="app">
        <div className="rolebar">
          <span className="who">{ROLES[role].en ?? ROLES[role].label}</span>
          <button type="button" className="sw" onClick={() => setRole(null)}>เปลี่ยนหน้าที่</button>
        </div>

        {IS_SAMPLE && (
          <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</div>
        )}

        {state.migrated != null && !dismissed && (
          <div className="edit-banner" style={{ display: "flex" }}>
            ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {state.migrated} ใบ
            <button type="button" className="x" onClick={() => setDismissed(true)}>ปิด</button>
          </div>
        )}

        <section className="view active" id={`view-${cur?.view ?? "form"}`}>
          {cur && <div className="page-h"><h1>{cur.h1}</h1></div>}

          {/* ครอบเฉพาะเนื้อหน้า เพื่อให้หน้าที่พังไม่ลากเมนูซ้ายไปด้วย — เปลี่ยนหน้าแล้วลองใหม่ได้เลย */}
          <ErrorBoundary resetKey={page} where={cur ? `หน้า “${cur.h1}”` : undefined}>
            {page === "entry" && <EntryForm role={role} state={state} />}
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
          </ErrorBoundary>
        </section>

        {/* บรรทัดท้ายหน้า — main มีอยู่นอก section ทุกหน้าจึงเห็นเหมือนกันหมด */}
        <p className="foot">
          ต่อยอดจากโมเดลเดิม · บันทึกลง Google Sheet ผ่าน Apps Script Web App ·
          ข้อมูลสำรองในเครื่อง (localStorage)
        </p>
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
