/**
 * โครงแอปและเมนู — ยกโครงจาก index.html บน branch main
 *
 * แถบเมนูซ้ายสีครีม 252px ไม่มีบล็อกชื่อแบรนด์ · แถบตำแหน่งอยู่มุมบนขวาเห็นได้ทุกหน้า
 * แต่ละตำแหน่งเห็นเมนูไม่เท่ากันตาม ROLE_VIEWS
 *
 * ใช้ hash routing (#/records) แทน history API เพราะ GitHub Pages เป็น static host
 * ถ้าใช้ path จริงแล้วผู้ใช้กด refresh หน้ากลางทาง เซิร์ฟเวอร์จะหา path นั้นไม่เจอ → 404
 */
import { Suspense, useEffect, useRef, useState } from "react";
import EntryForm from "./features/entry/EntryForm";
import EntryAll from "./features/entry/EntryAll";
import BillEntry from "./features/bills/BillEntry";
import DispatchPage from "./features/dispatch/DispatchPage";
import RecordsList from "./features/records/RecordsList";
import Drafts from "./features/drafts/Drafts";
import Debtors from "./features/debtors/Debtors";
import CustCode from "./features/custcode/CustCode";
import Settings from "./features/settings/Settings";
import CostToServe from "./features/costserve/CostToServe";
import DriverJobs from "./features/driver/DriverJobs";
import { lazyPage } from "./lib/ui/lazyPage";
// แดชบอร์ดลากไลบรารีกราฟมาด้วยราว 400 KB แยกเป็นก้อนต่างหาก
// คนที่เข้ามาแค่กรอกข้อมูลจะได้ไม่ต้องโหลดตาม
// หน้าสถานะกองรถเดี่ยว ๆ ของฝ่ายจัดรถ — แท็บเดียวกับในแดชบอร์ดเต็ม อยู่ในก้อนเดียวกัน
const FleetStatus = lazyPage(() => import("./features/dash-fleet/FleetDash")
  .then((m) => ({ default: m.FleetStatusPage })));
const CostRevDash = lazyPage(() => import("./features/dash-costrev/CostRevDash"));
const DemoDash = lazyPage(() => import("./features/dash-demo/DemoDash"));
// Manager Dashboard (เมนู dash-fleet) แทนเนื้อหา FleetDash ทั้งหน้า 26 ก.ย. 2569 — FleetDash ยังใช้ที่สถานะกองรถ
const ManagerDash = lazyPage(() => import("./features/dash-manager/ManagerDash"));
import ErrorBoundary from "./lib/ui/ErrorBoundary";
import { DashPageContext } from "./lib/ui/dashContext";
import { ROLES, ROLE_PICK, ROLE_VIEWS, roleAllDone, roleDone } from "./lib/record/roles";
import { billIsPaid, recBills } from "./lib/record/payment";
import { useRecords } from "./lib/store/useRecords";
import { useActiveDataset } from "./lib/dataset";
import { loadSessionRole, saveSessionRole } from "./lib/store/sessionRole";
import { loadSessionBranch, saveSessionBranch } from "./lib/store/sessionBranch";
import BranchGate from "./features/dash-manager/BranchGate";
import type { RoleKey } from "./types/record";
import TruckLoader from "./lib/ui/TruckLoader";
import { DEMO_PARTS, demoGo, useDemoNav } from "./lib/ui/demoNav";
import { clearReturnPoints, goBack, hasReturnPoint } from "./lib/ui/returnPoint";

/* ไอคอนเส้นชุดเดียวกับ main */
const I = {
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>,
  plus: <svg className="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  person: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5Z" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  /* chart: เมนู "แดชบอร์ดรายได้" แล้วก็ Executive Dashboard (demo) เคยใช้ — ตอนนี้ไม่มีเมนูไหนใช้ เก็บไว้เผื่อเมนูใหม่ */
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
  split: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V6h11v11" /><path d="M14 10h4l3 3v4h-7" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>,
};

interface PageDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  h1: string;
  /**
   * id ของ <section class="view"> ตามที่ main ตั้งไว้
   * สำคัญมาก: โทเคนสีทั้งชุดของแดชบอร์ด (--d-card, --d-ink, ฟอนต์ ฯลฯ)
   * ถูกประกาศไว้ใต้ #view-dash เท่านั้น ถ้าไม่มี element นี้ครอบ กราฟจะได้สีว่างเปล่า
   */
  view: string;
  /** ตัวเลขสีแดงท้ายเมนู — main มีสองอัน: ใบที่ยังไม่ครบ และ ลูกหนี้ค้างชำระ */
  badge?: "drafts" | "debt";
}

const PAGES: PageDef[] = [
  // ★ เมนู Demo เดิม — ย้ายขึ้นบนสุดและเปลี่ยนชื่อเป็น "Executive Dashboard" (เจ้าของงานสั่ง 25 ก.ย. 2569)
  //   id ยังเป็น "demo" (hash #/demo · demoNav) · เห็นเฉพาะผู้ดูแลระบบเหมือนเดิม (เจ้าของงานเลือก)
  //   ไอคอนเดียวกับ Dashboard อื่น (I.dash · เจ้าของงานสั่ง 25 ก.ย. 2569 — เดิม I.chart)
  { id: "demo", view: "dash", label: "Executive Dashboard", icon: I.dash, h1: "Executive Dashboard" },
  // ★ เดิมชื่อ "Executive Dashboard" — เปลี่ยนเป็น "Overall Dashboard" 25 ก.ย. 2569 (id exec-dash เหมือนเดิม)
  //   อยู่ใต้ Executive Dashboard ทันที (เจ้าของงานสั่ง 25 ก.ย. 2569 — เดิมอยู่ท้ายเมนูก่อนการตั้งค่า)
  { id: "exec-dash", view: "dash", label: "Overall Dashboard", icon: I.dash, h1: "Overall Dashboard" },
  // เปลี่ยนชื่อจาก "แดชบอร์ด" (เจ้าของงานสั่ง 24 ก.ย. 2569) · id เดิม — เนื้อหาเป็น ManagerDash ตั้งแต่ 26 ก.ย. 2569 (features/dash-manager/)
  { id: "dash-fleet", view: "dash", label: "Manager Dashboard", icon: I.dash, h1: "Manager Dashboard" },
  // ฝ่ายบริการลูกค้ากรอกบิล (ไม่มีเลขที่ใบรายการ) — ใบรายการเกิดที่หน้า "จัดรถ" ของฝ่ายจัดรถ
  { id: "bills", view: "form", label: "บันทึกบิล", icon: I.plus, h1: "บันทึกบิล" },
  { id: "dispatch", view: "form", label: "จัดรถ", icon: I.truck, h1: "จัดรถ" },
  { id: "entry", view: "form", label: "บันทึกข้อมูล", icon: I.plus, h1: "บันทึกข้อมูล" },
  // ผู้ดูแลระบบเห็นหน้านี้หน้าเดียวแทน บันทึกบิล/จัดรถ/เที่ยวรถของฉัน/บันทึกข้อมูล — เอาหน้าจริงของ 4 ฝ่ายมาเรียงต่อกัน
  // (features/entry/EntryAll.tsx · เจ้าของงานสั่ง 24 ก.ย. 2569) ฝ่ายอื่นยังเห็นหน้าของตัวเองแยกเหมือนเดิม
  { id: "entry-all", view: "form", label: "บันทึกข้อมูลรวม", icon: I.plus, h1: "บันทึกข้อมูลรวม" },
  // ฝ่ายเจ้าหน้าที่จัดรถเห็นแท็บนี้ต่อจาก "บันทึกข้อมูล" — เนื้อหาเดียวกับแท็บ "สถานะกองรถ"
  // ในแดชบอร์ดเต็มของผู้จัดการ/ผู้ดูแลระบบ
  { id: "fleet-status", view: "dash", label: "สถานะกองรถ", icon: I.truck, h1: "สถานะกองรถ" },
  { id: "records", view: "records", label: "รายการทั้งหมด", icon: I.list, h1: "รายการทั้งหมด" },
  { id: "drafts", view: "drafts", label: "ใบที่ยังไม่ครบ", icon: I.check, h1: "ใบที่ยังไม่ครบ", badge: "drafts" },
  { id: "debtors", view: "debtors", label: "รายการลูกหนี้", icon: I.person, h1: "รายการลูกหนี้", badge: "debt" },
  { id: "custcode", view: "custcode", label: "ค้นหารหัสลูกค้า", icon: I.search, h1: "ค้นหารหัสลูกค้า" },
  // เมนู "กำไรรายเส้นทาง" (route-profit · features/dash-join/) ลบโค้ดทิ้งแล้ว 25 ก.ย. 2569 (เจ้าของงานสั่ง)
  // แดชบอร์ดจากไฟล์ต้นทุน+รายได้รายเที่ยว (realalldata) · เมนู "Dashboard ค่าเดินทาง(ไม่ใช้)" ลบแล้ว 24 ก.ย. 2569
  // Overall Dashboard (exec-dash) ย้ายขึ้นไปใต้ Executive Dashboard แล้ว (25 ก.ย. 2569)
  // แท็บ "Dashboard รายได้" / "Dashboard ลูกหนี้" / "กำไรลูกค้า (ปันส่วนต้นทุน)" ลบออกแล้ว 24 ก.ย. 2569 (เจ้าของงานสั่ง)
  // หน้าของคนขับ — ใช้ view "records" เพราะเป็นการ์ด/ตารางธรรมดา ไม่มีกราฟที่ต้องใช้โทเคนของ #view-dash
  { id: "driver", view: "records", label: "เที่ยวรถของฉัน", icon: null, h1: "เที่ยวรถของฉัน (คนขับ)" },
  // ★ "การตั้งค่า" อยู่ท้ายอาร์เรย์นี้ (สั่ง 23 ก.ย. 2569) — แถบเมนูเรียงตาม PAGES ไม่ใช่ตาม ROLE_VIEWS
  //   ยกเว้น "Cost to Serve" ที่เจ้าของงานสั่งให้อยู่ใต้การตั้งค่า (25 ก.ย. 2569 · เห็นเฉพาะผู้ดูแลระบบ) — ห้ามแทรกอะไรเพิ่มต่อท้าย
  { id: "settings", view: "settings", label: "การตั้งค่า", icon: I.gear, h1: "การตั้งค่า" },
  // เครื่องคำนวณตามไฟล์ที่เจ้าของงานส่ง ไม่เชื่อมข้อมูลในโมเดล (features/costserve/CostToServe.tsx)
  { id: "cost-to-serve", view: "records", label: "Cost to Serve", icon: I.split, h1: "Cost to Serve" },
];

/** หน้าที่อ่าน state.oldRecords / oldDebtors / fileOld — หน้าอื่นไม่โหลดไฟล์ข้อมูลเก่า (useRecords) */
const FILE_OLD_PAGES = new Set(["records", "debtors", "fleet-status"]);

export default function App() {
  // เปิดเว็บใหม่ต้องเลือกตำแหน่งเสมอ ไม่จำลงเครื่อง (ตรงตาม main:2129)
  // แต่จำไว้ระดับ "แท็บ" เพื่อให้รีโหลดแล้วไม่ต้องเลือกซ้ำ — sessionStorage ตายตอนปิดแท็บ ดีไซน์เดิมจึงยังอยู่
  // (จำเป็นเพราะ lazyPage รีโหลดหน้าเองได้เมื่อมี deploy ทับระหว่างเปิดค้าง)
  const [role, setRoleState] = useState<RoleKey | null>(loadSessionRole);
  // ผู้จัดการเลือกสาขาหลังเข้าหน้า Dashboard; เปลี่ยนหน้าที่แล้วลืมสาขาเดิม
  const [managerBranch, setManagerBranch] = useState<string | null>(loadSessionBranch);
  const setRole = (r: RoleKey | null): void => {
    saveSessionBranch(null);
    setManagerBranch(null);
    if (r === "manager") setPage("dash-fleet");
    saveSessionRole(r); setRoleState(r);
  };
  const pickManagerBranch = (branch: string): void => {
    saveSessionBranch(branch);
    setManagerBranch(branch);
  };
  // true เฉพาะรอบแรกที่ตำแหน่งถูกกู้มาจากการรีโหลด — ใช้ตัดสินว่าจะอยู่หน้าเดิมหรือเด้งไปหน้าแรก
  const restoredRole = useRef(role !== null);
  const { isSample } = useActiveDataset();
  const [dismissed, setDismissed] = useState(false);

  /* เมนูที่ตำแหน่งนี้เข้าได้ */
  const allowed = role ? ROLE_VIEWS[role] : [];
  const pages = PAGES.filter((p) => allowed.includes(p.id));

  const readHash = (): string => {
    if (role === "manager" && !managerBranch) return "dash-fleet";
    const h = location.hash.replace(/^#\/?/, "");
    // ปุ่ม "แก้ไข" ในรายการทั้งหมด/ใบที่ยังไม่ครบ ส่งมาที่ #/entry — ผู้ดูแลระบบไม่มีหน้านั้นแล้ว ให้ไปหน้ารวมแทน
    if (h === "entry" && !allowed.includes(h) && allowed.includes("entry-all")) return "entry-all";
    return allowed.includes(h) ? h : (allowed[0] ?? "entry");
  };
  const [page, setPage] = useState<string>(readHash);
  // ข้อมูลเก่าจากไฟล์ (costrev/old_*.json) โหลดเฉพาะหน้าที่ใช้ — ข้อมูลจริงก้อนใหญ่ ไม่ต้องโหลดตอนเปิดทุกหน้า
  const state = useRecords(FILE_OLD_PAGES.has(page));

  useEffect(() => {
    const on = () => setPage(readHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, managerBranch]);

  /* เลือกตำแหน่งแล้วเปิดหน้าแรกของตำแหน่งนั้นเสมอ — main:2241 showView(ROLE_VIEWS[ROLE][0])
     ยกเว้นรอบที่กู้ตำแหน่งมาจากการรีโหลด ให้กลับไปหน้าเดิมตาม hash (readHash กรองหน้าที่เข้าไม่ได้ทิ้งให้แล้ว) */
  useEffect(() => {
    if (!role) return;
    const want = restoredRole.current ? readHash() : (allowed[0] ?? "entry");
    restoredRole.current = false;
    location.hash = `#/${want}`;
    setPage(want);
    // ใบที่ฝ่ายก่อนหน้าเพิ่งบันทึกต้องขึ้นทันทีที่เลือกหน้าที่ ไม่ต้องกดรีเฟรชเอง
    state.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // เปลี่ยนเมนูแล้วโหลดใบใหม่แบบเบาด้วย — หน้าถัดไปเห็นของล่าสุดเสมอ
  // กดเมนูเอง = เริ่มใหม่ ล้างจุดย้อนกลับของกล่องลิงก์ทิ้ง (lib/ui/returnPoint.ts)
  const goto = (p: string) => { clearReturnPoints(); location.hash = `#/${p}`; setPage(p); state.refresh(); };

  /* กดปุ่ม C = กลับไปจุดเดิมก่อนกดกล่องลิงก์ (เจ้าของงานขอ 25 ก.ย. 2569 — รุ่นแรกเป็นคลิกขวา แล้วเปลี่ยนเป็นปุ่ม C)
     ดูจาก e.code ("KeyC") ไม่ใช่ e.key — แป้นภาษาไทยปุ่มเดียวกันพิมพ์ "แ" ก็ยังใช้ได้ ·
     ไม่ทำงานตอนพิมพ์ในช่องกรอก และตอนกดคู่ Ctrl/⌘/Alt (Ctrl+C คัดลอกต้องใช้ได้ตามปกติ) · ไม่มีจุดให้กลับ = ไม่ทำอะไร */
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      if (e.code !== "KeyC" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as Element | null;
      if (t?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (!hasReturnPoint()) return;
      e.preventDefault();
      goBack();
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  // main:2355 — นับเฉพาะใบที่ยังไม่ครบ "และฝ่ายของเรายังไม่ได้กรอก" จึงเปลี่ยนตามตำแหน่ง
  const draftCount = state.records.filter((r) => !roleAllDone(r) && !(role && roleDone(r, role))).length;

  // main:3002 — นับบิลของใบใหม่ที่ยังไม่ได้ชำระ (ไม่รวมข้อมูลเก่าจากชีต)
  const debtCount = state.records.flatMap(recBills).filter((b) => !billIsPaid(b)).length;

  // แท็บย่อยของเมนู Demo — hook ต้องอยู่ก่อน return ของหน้าเลือกตำแหน่ง
  const demoNav = useDemoNav();
  if (!role) return <RolePicker onPick={setRole} />;

  const cur = pages.find((p) => p.id === page) ?? pages[0];
  // หน้าแดชบอร์ดมีการ์ดหัวของตัวเอง (DashShell · ดีไซน์ 1A) ที่รวมหัวเรื่อง ชิปข้อมูลตัวอย่าง
  // และปุ่มเปลี่ยนหน้าที่ไว้แล้ว — จึงไม่วาดแถบตำแหน่ง/แถบเตือน/หัวเรื่องของ App ซ้ำ
  const isDash = cur?.view === "dash";

  return (
    <>
      {/* แถบซ้ายแบบ IG — ปกติเหลือแค่ไอคอน · ชี้เมาส์/โฟกัสคีย์บอร์ด = กางทับเนื้อหา */}
      <aside className="sidebar">
        <nav className="nav">
          {pages.map((p) => {
            const btn = (
            <button
              key={p.id} type="button"
              className={"navitem" + (page === p.id ? " active" : "")}
              onClick={() => goto(p.id)}
            >
              {p.icon}
              <span className="navlabel">{p.label}</span>
              {p.badge === "drafts" && draftCount > 0 && (
                <span className="nav-count">{draftCount}</span>
              )}
              {p.badge === "debt" && debtCount > 0 && (
                <span className="nav-count">{debtCount}</span>
              )}
            </button>
            );
            if (p.id !== "demo") return btn;
            // Demo: ชี้เมาส์/โฟกัส = แท็บย่อย 4 ส่วนกางใต้ปุ่ม (lib/ui/demoNav.ts) · กด = เปิดหน้า Demo แล้วเลื่อนไปส่วนนั้น
            return (
              <div key={p.id} className="navgroup">
                {btn}
                <div className="navsub" role="group" aria-label="ส่วนของหน้า Executive Dashboard">
                  {DEMO_PARTS.map((x) => (
                    <button key={x.id} type="button"
                      className={"navsubitem" + (page === "demo" && demoNav.active === x.id ? " active" : "")}
                      onClick={() => { if (page !== "demo") goto("demo"); demoGo(x.id); }}>{x.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* data-page = หน้าที่วาดอยู่จริง — returnPoint.ts รอให้ตรงกับ hash ก่อนเลื่อนกลับจุดเดิม (hash เปลี่ยนก่อน React วาด) */}
      <main className="app" data-page={page}>
        {!isDash && (
          <div className="rolebar">
            {/* ใช้ดีไซน์เดียวกับ .dh-role ของหัวแดชบอร์ด (DashShell) ให้หน้าตาตรงกันทุกหน้า */}
            <div className="dh-role">
              <span>{ROLES[role].en ?? ROLES[role].label}</span>
              <button type="button" onClick={() => setRole(null)}>เปลี่ยนหน้าที่</button>
            </div>
          </div>
        )}

        {isSample && !isDash && (
          <div className="banner">ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</div>
        )}

        {state.migrated != null && !dismissed && (
          <div className="edit-banner" style={{ display: "flex" }}>
            ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {state.migrated} ใบ
            <button type="button" className="x" onClick={() => setDismissed(true)}>ปิด</button>
          </div>
        )}

        <section className="view active" id={`view-${cur?.view ?? "form"}`}>
          {cur && !isDash && (
            // หน้ารายการทั้งหมดค่อย ๆ โผล่แบบหน้าเลือกหน้าที่ — หัวเรื่องเป็นลำดับแรก (--i 0)
            <div className={"page-h" + (cur.id === "records" ? " rs-in" : "")}><h1>{cur.h1}</h1></div>
          )}

          {/* ครอบเฉพาะเนื้อหน้า เพื่อให้หน้าที่พังไม่ลากเมนูซ้ายไปด้วย — เปลี่ยนหน้าแล้วลองใหม่ได้เลย */}
          <ErrorBoundary resetKey={page} where={cur ? `หน้า “${cur.h1}”` : undefined}>
            {page === "bills" && <BillEntry />}
            {page === "dispatch" && <DispatchPage state={state} role={role} />}
            {page === "entry" && <EntryForm key="entry" role={role} state={state} />}
            {page === "entry-all" && <EntryAll role={role} state={state} />}
            {page === "drafts" && <Drafts state={state} />}
            {page === "records" && <RecordsList role={role} state={state} />}
            {page === "debtors" && <Debtors state={state} />}
            {page === "settings" && <Settings />}
            {page === "cost-to-serve" && <CostToServe />}
            <DashPageContext.Provider value={isDash && cur ? {
              title: cur.h1,
              roleLabel: ROLES[role].en ?? ROLES[role].label,
              onSwitchRole: () => setRole(null),
            } : null}>
              <Suspense fallback={<div className="card"><p className="muted">กำลังโหลดแดชบอร์ด... <TruckLoader label={null} /></p></div>}>
                {page === "dash-fleet" && <ManagerDash role={role} />}
                {page === "fleet-status" && <FleetStatus state={state} role={role} sample={isSample} />}
                {page === "exec-dash" && <CostRevDash />}
                {page === "demo" && <DemoDash />}
              </Suspense>
            </DashPageContext.Provider>
            {page === "driver" && <DriverJobs state={state} role={role} />}
          {page === "custcode" && <CustCode />}
          </ErrorBoundary>
        </section>

        {/* บรรทัดท้ายหน้า — main มีอยู่นอก section ทุกหน้าจึงเห็นเหมือนกันหมด */}
        <p className="foot">
          ต่อยอดจากโมเดลเดิม · บันทึกลง Google Sheet ผ่าน Apps Script Web App ·
          ข้อมูลสำรองในเครื่อง (localStorage)
        </p>
      </main>
      {role === "manager" && !managerBranch && (
        <BranchGate onPick={pickManagerBranch} onBack={() => setRole(null)} />
      )}
    </>
  );
}

/**
 * หน้าเลือกหน้าที่ — เต็มจอ ตามดีไซน์ Role Selection ของ main
 * ต้องเลือกการ์ดก่อนปุ่ม Continue จึงจะกดได้ และเลื่อนเลือกด้วยลูกศรได้
 */
function RolePicker({ onPick }: { onPick: (k: RoleKey) => void }) {
  const [sel, setSel] = useState<RoleKey | null>(null);
  const ready = !!sel;

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
          <h1 className="rs-in" style={{ "--i": 0 } as React.CSSProperties}>Select your role</h1>
          <p className="rs-in" style={{ "--i": 1 } as React.CSSProperties}>เลือกตำแหน่งของคุณเพื่อเข้าสู่หน้าจอการทำงานที่ตรงกับหน้าที่</p>
        </div>

        <div className="rs-grid" role="radiogroup" aria-label="Select your role">
          {ROLE_PICK.map((k, i) => (
            <button
              key={k} type="button" role="radio"
              aria-checked={sel === k}
              className="ropt rs-in"
              style={{ "--i": i + 2 } as React.CSSProperties}
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

        <div className="rs-foot rs-in" style={{ "--i": ROLE_PICK.length + 2 } as React.CSSProperties}>
          <button
            type="button"
            className={"rs-cta" + (ready ? " on" : "")}
            disabled={!ready} aria-disabled={!ready}
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
