/**
 * โครงหน้าแดชบอร์ดร่วมทุกหน้า — การ์ดหัวแบบ 1A "Command bar" + เนื้อหาของหน้า
 *
 *   แถว 1  หัวเรื่อง + ชิปข้อมูลตัวอย่าง · บรรทัดที่มาของข้อมูล · ปุ่มรีเฟรช + ตำแหน่ง/เปลี่ยนหน้าที่
 *   แถว 2  แท็บ (แคปซูล) · ตัวกรองของแท็บที่เปิดอยู่ (FilterBar portal ขึ้นมาที่ .dh-filters)
 *
 * โหมด capsule (Executive Dashboard · เจ้าของงานสั่ง 28 ก.ย. 2569) = แคปซูลยาวอันเดียวแทนการ์ดหัว:
 *   โลโก้ · หัวเรื่อง + บรรทัดรอง · แท็บ · เครื่องมือ (ปุ่มตัวกรอง) · รีเฟรช · เปลี่ยนหน้าที่ — ติดขอบบนตอนเลื่อน
 *   ที่มาของข้อมูล (ป้ายข้อมูลตัวอย่างหน้าสุด) อยู่ในแผงของปุ่ม ⓘ นอกแคปซูลฝั่งขวา · FilterBar portal เข้าแผงตัวกรอง (capsule.filters)
 *   หน้าที่ใช้โหมดนี้วางตัวกรองในแผงของปุ่มตัวกรองเอง
 *
 * ต้องครอบทั้งหัวและเนื้อหา เพราะตัวกรองอยู่ในแท็บ (ลูกของ children) แต่ไปแสดงที่หัว
 * สถานะโหลด/พัง/ไม่มีข้อมูลก็ใช้โครงนี้ ปุ่มรีเฟรชกับ "เปลี่ยนหน้าที่" จึงกดได้ตลอด
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import RefreshBtn from "./RefreshBtn";
import logo from "../../assets/logo-tiger.webp";
import { FilterSlotContext, FloatingFilterSlotContext, ShellSampleContext, ShellSourceContext, useDashPage } from "./dashContext";
import type { ShellSource } from "./dashContext";

export interface DashShellProps {
  /** ชุดข้อมูลตัวอย่าง → ชิป "ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท" · ข้อมูลจริง = ไม่แสดง */
  sample?: boolean;
  /** บรรทัดที่มาของข้อมูลใต้หัวเรื่อง — ใช้ <Meta> ช่วยใส่จุดคั่น */
  meta?: ReactNode;
  onRefresh: () => void;
  loading?: boolean;
  refreshTitle?: string;
  /** แถบแท็บ (.dash-tabs) — ไม่มีก็ได้ */
  tabs?: ReactNode;
  /** ใช้แทนหัวเรื่องจาก App (เช่นหน้าเดียวกันที่มีสองโหมด) */
  title?: string;
  /** มีแผงตัวกรองลอยเมื่อเลื่อนตัวกรองในหัวพ้นจอ */
  floatingFilters?: boolean;
  /**
   * หัวแบบแคปซูลยาว — tabs = ปุ่มแท็บ · sub = บรรทัดรองใต้หัวเรื่อง · tools = ปุ่มก่อนรีเฟรช
   * filters = ปุ่มตัวกรองมาตรฐาน: FilterBar ของแท็บที่เปิดอยู่ portal เข้าแผงของปุ่มนี้ (ตัวกรองเปลี่ยนตามแท็บเอง)
   */
  capsule?: { tabs: ReactNode; sub?: ReactNode; tools?: ReactNode; filters?: boolean };
  children?: ReactNode;
}

export default function DashShell({
  sample, meta, onRefresh, loading, refreshTitle, tabs, title, floatingFilters = false, capsule, children,
}: DashShellProps) {
  const page = useDashPage();
  // callback ref → state เพื่อให้ FilterBar ในเนื้อหา re-render แล้ว portal ได้หลังกล่องถูกสร้าง
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // แผงของปุ่มตัวกรองในแคปซูล — เป็นช่องให้ FilterBar portal เข้ามาแทนแถวในหัว
  const [capSlot, setCapSlot] = useState<HTMLElement | null>(null);
  const [floatingSlot, setFloatingSlot] = useState<HTMLElement | null>(null);
  const [showFloatingFilter, setShowFloatingFilter] = useState(false);
  const [floatingFilterOpen, setFloatingFilterOpen] = useState(false);
  const [hasFloatingFilters, setHasFloatingFilters] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const floatingButton = useRef<HTMLButtonElement>(null);
  const floatingPanel = useRef<HTMLDivElement>(null);
  // แท็บที่อ่านชุดข้อมูลของตัวเองทับป้าย/บรรทัดที่มาได้ (useShellSource ใน dashContext.ts)
  const [src, setSrc] = useState<ShellSource | null>(null);
  const isSample = src ? src.sample : sample;
  const metaNode = src ? <Meta parts={src.parts} /> : meta;

  useEffect(() => {
    if (!floatingFilters || !barRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      const show = !entry!.isIntersecting && entry!.boundingClientRect.bottom < 72;
      setShowFloatingFilter(show);
      if (!show) setFloatingFilterOpen(false);
    }, { rootMargin: "-72px 0px 0px 0px" });
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [floatingFilters]);

  useEffect(() => {
    if (!floatingSlot) return;
    const update = () => setHasFloatingFilters(floatingSlot.childElementCount > 0);
    update();
    const observer = new MutationObserver(update);
    observer.observe(floatingSlot, { childList: true });
    return () => observer.disconnect();
  }, [floatingSlot]);

  useEffect(() => {
    if (!floatingFilterOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!floatingPanel.current?.contains(target) && !floatingButton.current?.contains(target)) {
        setFloatingFilterOpen(false);
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFloatingFilterOpen(false); floatingButton.current?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    floatingSlot?.querySelector<HTMLElement>("select, input")?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [floatingFilterOpen, floatingSlot]);

  return (
    <FilterSlotContext.Provider value={capsule ? capSlot : slot}>
    <FloatingFilterSlotContext.Provider value={floatingFilters ? floatingSlot : null}>
    <ShellSourceContext.Provider value={setSrc}>
    <ShellSampleContext.Provider value={isSample}>
      {capsule ? <CapsuleHead title={title ?? page?.title} isSample={isSample} meta={metaNode} {...capsule}
        tools={<>{capsule.tools}{capsule.filters && <CapFilter slotRef={setCapSlot} slot={capSlot} />}</>}
        onRefresh={onRefresh} loading={loading} refreshTitle={refreshTitle}
        onSwitchRole={page?.onSwitchRole} roleLabel={page?.roleLabel} /> :
      <header className="dh">
        <div className="dh-top">
          <div className="dh-titles">
            <div className="dh-titleline">
              <h1>{title ?? page?.title}</h1>
              {isSample && (
                <span className="dh-sample"><i aria-hidden="true" />ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</span>
              )}
            </div>
            {metaNode && <p className="dh-meta">{metaNode}</p>}
          </div>
          <div className="dh-actions">
            <RefreshBtn className="dh-refresh" onClick={onRefresh} loading={loading} title={refreshTitle} />
            {page && (
              <div className="dh-role">
                <span>{page.roleLabel}</span>
                <button type="button" onClick={page.onSwitchRole}>เปลี่ยนหน้าที่</button>
              </div>
            )}
          </div>
        </div>
        <div className="dh-bar" ref={barRef}>
          {tabs}
          <div className="dh-filters" ref={setSlot} />
        </div>
      </header>}
      {floatingFilters && <div className="dm-floating-filter">
        {showFloatingFilter && hasFloatingFilters && <button ref={floatingButton} type="button" className="dm-filter-toggle"
          aria-label={floatingFilterOpen ? "ปิดตัวกรอง" : "เปิดตัวกรอง"}
          aria-controls={floatingFilterOpen ? "dh-filter-panel" : undefined} aria-expanded={floatingFilterOpen}
          onClick={() => setFloatingFilterOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
          </svg>
        </button>}
        <div id="dh-filter-panel" ref={floatingPanel} className="dm-filter-panel" role="region"
          aria-label="ตัวกรองแดชบอร์ด" hidden={!floatingFilterOpen || !showFloatingFilter || !hasFloatingFilters}>
          <div className="dm-filter-panel-head">
            <h2>ตัวกรอง</h2>
            <button type="button" aria-label="ปิดตัวกรอง" onClick={() => { setFloatingFilterOpen(false); floatingButton.current?.focus(); }}>✕</button>
          </div>
          <div className="dm-filter-fields" ref={setFloatingSlot} />
        </div>
      </div>}
      {children}
    </ShellSampleContext.Provider>
    </ShellSourceContext.Provider>
    </FloatingFilterSlotContext.Provider>
    </FilterSlotContext.Provider>
  );
}

/**
 * ปุ่มตัวกรองในแคปซูล + แผง — แผงอยู่ใน DOM ตลอด (ซ่อนด้วย hidden) ให้ FilterBar portal เข้ามาได้ทุกเมื่อ
 * จุดแดง = มีปุ่ม "ล้างตัวกรอง" (.dh-clear) ในแผง แปลว่ามีตัวกรองเลือกอยู่ · แท็บที่ไม่มีตัวกรอง = ไม่แสดงปุ่ม
 */
function CapFilter({ slot, slotRef }: { slot: HTMLElement | null; slotRef: (el: HTMLElement | null) => void }) {
  const [open, setOpen] = useState(false);
  const [has, setHas] = useState(false);
  const [dot, setDot] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slot) return;
    const update = () => { setHas(slot.childElementCount > 0); setDot(!!slot.querySelector(".dh-clear")); };
    update();
    const mo = new MutationObserver(update);
    mo.observe(slot, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [slot]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    panel.current?.querySelector<HTMLElement>("select, input")?.focus();
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="cap-filter" hidden={!has}>
      <button ref={btn} type="button" className="dm-filter-toggle" aria-label={open ? "ปิดตัวกรอง" : "เปิดตัวกรอง"}
        aria-controls="cap-filter-panel" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
        </svg>
        {dot && <span className="dm-filter-dot" aria-hidden="true" />}
      </button>
      <div id="cap-filter-panel" ref={panel} className="dm-filter-panel" role="region" aria-label="ตัวกรอง" hidden={!open}>
        <div className="dm-filter-panel-head">
          <h2>ตัวกรอง</h2>
          <button type="button" aria-label="ปิดตัวกรอง" onClick={() => { setOpen(false); btn.current?.focus(); }}>✕</button>
        </div>
        <div className="dm-filter-fields" ref={slotRef} />
      </div>
    </div>
  );
}

/**
 * หัวแบบแคปซูล — แถวเดียวติดขอบบนตอนเลื่อน พร้อมปุ่ม ⓘ นอกแคปซูลฝั่งขวา
 * บรรทัดที่มาของข้อมูล + ป้าย "ข้อมูลตัวอย่าง" (หน้าสุด) อยู่ในแผงของปุ่มนั้น กดถึงจะโชว์ (เจ้าของงานสั่ง 28 ก.ย. 2569 รอบสาม ·
 * เดิมเป็นบรรทัดใต้แคปซูล) · ข้อมูลตัวอย่าง = ปุ่มมีจุดสีอำพันให้รู้โดยไม่ต้องกด
 */
function CapsuleHead({ title, isSample, meta, tabs, sub, tools, onRefresh, loading, refreshTitle, onSwitchRole, roleLabel }: {
  title?: string; isSample?: boolean; meta?: ReactNode; tabs: ReactNode; sub?: ReactNode; tools?: ReactNode;
  onRefresh: () => void; loading?: boolean; refreshTitle?: string; onSwitchRole?: () => void; roleLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);
  const hasInfo = !!meta || !!isSample;
  return (
    <div className="cap-bar">
      <header className="cap">
        <img className="cap-logo" src={logo} alt="" aria-hidden="true" />
        <div className="cap-title">
          <b>{title}</b>
          {sub && <small>{sub}</small>}
        </div>
        {tabs ? <nav className="cap-tabs" aria-label="ส่วนของหน้า">{tabs}</nav> : <span className="cap-gap" aria-hidden="true" />}
        <div className="cap-tools">
          {tools}
          {/* แคปซูลที่ว่างน้อย — ปุ่มรีเฟรชเป็นไอคอน ข้อความอยู่ใน tooltip */}
          <button type="button" className={"cap-icon" + (loading ? " spin" : "")} onClick={onRefresh} disabled={loading}
            title={loading ? "กำลังโหลด…" : `รีเฟรชข้อมูล${refreshTitle ? ` — ${refreshTitle}` : ""}`} aria-label="รีเฟรชข้อมูล">↻</button>
          {onSwitchRole && <button type="button" className="cap-role" onClick={onSwitchRole} title={roleLabel}>เปลี่ยนหน้าที่</button>}
        </div>
      </header>
      {hasInfo && (
        <div className="cap-info" ref={box}>
          <button type="button" className="cap-info-btn" aria-expanded={open} aria-controls="cap-info-panel"
            aria-label="ที่มาของข้อมูล" title={isSample ? "ข้อมูลตัวอย่าง — กดดูที่มาของข้อมูล" : "กดดูที่มาของข้อมูล"}
            onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.6" r=".6" fill="currentColor" />
            </svg>
            {isSample && <span className="cap-info-dot" aria-hidden="true" />}
          </button>
          {open && (
            <div id="cap-info-panel" className="cap-info-panel" role="region" aria-label="ที่มาของข้อมูล">
              {isSample && <span className="dh-sample"><i aria-hidden="true" />ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</span>}
              {meta && <p className="dh-meta">{meta}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** บรรทัดรองในแคปซูล — "2024-01-01", "2026-05-31" → "ข้อมูล 01/01/2024-31/05/2026" */
export function dataRangeText(min: string | null | undefined, max: string | null | undefined): string {
  const dmy = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "–");
  return `ข้อมูล ${dmy(min)}-${dmy(max)}`;
}

/** บรรทัด meta — ต่อชิ้นข้อความด้วยจุดคั่นสีจาง ข้ามชิ้นที่ว่าง */
export function Meta({ parts }: { parts: ReactNode[] }) {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <>
      {items.map((p, i) => (
        <span key={i}>{i > 0 && <span className="dh-sep" aria-hidden="true">·</span>}{p}</span>
      ))}
    </>
  );
}
