/**
 * เมนู "Demo" — หน้าทดลอง เห็นเฉพาะผู้ดูแลระบบ (ROLE_VIEWS.admin)
 *
 * ★ หน้ายาวหน้าเดียว (เจ้าของงานสั่ง 24 ก.ย. 2569) — เดิมเป็น 4 แท็บ ตอนนี้วาดครบทั้ง 4 ส่วนเรียงลงมา
 *   ปุ่มแท็บ**ย้ายไปเป็นป็อบอัพของปุ่ม Demo ในแถบเมนูซ้ายแล้ว** (เจ้าของงานสั่ง 24 ก.ย. 2569 · lib/ui/demoNav.ts)
 *   กดแล้ว **เลื่อนไปหาส่วนนั้น** ไม่ใช่สลับหน้า · รายการในป็อบอัพไฮไลต์ตามส่วนที่เลื่อนถึง · หัวหน้าไม่มีแถบแท็บแล้ว
 * ★ ตัวกรองชุดเดียวคุมทั้งหน้า (filter.tsx) — แต่ละส่วนกรองเท่าที่ข้อมูลของตัวเองมี แล้วบอกไว้ด้วย FilterScope
 *   ยกเว้นลูกหนี้ DSO (กำไรลูกค้า ส่วนที่ 2) ที่มี "ข้อมูล ณ วันที่" ของตัวเองเหมือนเดิม
 * ★ หัวหน้าเป็นของไฟล์ต้นทุน (costrev/) เสมอ ช่วงข้อมูล + ข้อจำกัดของไฟล์ลูกหนี้อยู่ที่หัวส่วน DSO
 *
 * ใช้ `costrev/trips.json` ชุด `inProfitScope()` = **เที่ยวที่จับคู่เลขที่ใบรายการกับไฟล์รายได้ได้ (m)
 * + เที่ยววิ่งเปล่า** (เจ้าของงานเคาะ 24 ก.ย. 2569 — เดิมใช้ m อย่างเดียว เที่ยวเปล่าหลุดออกไปเองโดยไม่ได้ตั้งใจ
 * เพราะไม่มีบิลให้จับคู่ กำไรจึงสูงเกินจริง) · เที่ยวที่จับคู่ไม่ได้ทั้งที่มีรายได้ยังไม่นับ เพราะไม่มีบิล
 * คิด จำนวนบิล / จำนวนลูกค้า ไม่ได้ · เที่ยวเปล่ามีบิล 0 ลูกค้าว่าง กลุ่มบริการว่าง (ขึ้นเป็น "ไม่ระบุ")
 *
 * ส่วน "กำไรลูกค้า" **ไม่ใช้ trips เลย** — อ่านชุด alloc/ กับ debtors/ ของตัวเอง
 * จึงวาดเสมอแม้ไฟล์ต้นทุนจะหาย/ยังโหลดไม่เสร็จ (สามส่วนแรกขึ้นข้อความแทน)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import DashShell, { Meta } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev, inProfitScope } from "../../lib/data/useCostRev";
import { ListFF, PeriodFF, duniq, fmt, isFiltered } from "../dash-costrev/common";
import RouteProfitTab from "./RouteProfitTab";
import Item2Tab from "./Item2Tab";
import Item3Tab from "./Item3Tab";
import CustomerProfitTab from "./CustomerProfitTab";
import { DEMO_F0, passDemo } from "./filter";
import type { DemoFilter } from "./filter";
import TruckLoader from "../../lib/ui/TruckLoader";
import { clearDemoNav, registerDemoNav, setDemoActive } from "../../lib/ui/demoNav";

const PARTS = [
  { id: "route", label: "กำไรรายเส้นทาง" },
  { id: "item2", label: "ข้อ 2" },
  { id: "item3", label: "ข้อ 3" },
  { id: "cust", label: "กำไรลูกค้า" },
] as const;
type PartId = (typeof PARTS)[number]["id"];
/** เส้นอ้างอิงของการไฮไลต์ตามการเลื่อน — ส่วนที่หัวของมันเลยเส้นนี้ขึ้นไปแล้ว = ส่วนที่กำลังอ่าน (px จากขอบบนจอ) */
const SPY_LINE = 160;

export default function DemoDash() {
  const { data, error, loading, reload } = useCostRev();
  const etl = useEtlStatus("costrev");
  useAutoReloadOnEtl(etl, reload);
  const [f, setF] = useState<DemoFilter>(DEMO_F0);
  const set = (k: keyof DemoFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [active, setActive] = useState<PartId>("route");

  const all = useMemo(() => (data ? data.trips.filter(inProfitScope) : []), [data]);
  const emptyN = useMemo(() => all.filter((t) => t.empty).length, [all]);
  const trips = useMemo(() => all.filter((t) => passDemo(t, f)), [all, f]);
  // ข้อ 3 ส่วนที่ 1 เทียบปีที่เลือกกับปีก่อนหน้า — ต้องได้เที่ยวทุกปีที่ผ่านตัวกรองอื่น
  const tripsAnyYear = useMemo(() => all.filter((t) => passDemo(t, f, { ignoreYear: true })), [all, f]);

  /* ---------- ปุ่มแท็บ = เลื่อนไปหาส่วน · ไฮไลต์ตามส่วนที่เลื่อนถึง ---------- */
  const partRefs = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  /** ช่วงที่กำลังเลื่อนเพราะกดปุ่ม — ไม่ให้ไฮไลต์วิ่งผ่านทุกส่วนระหว่างทาง */
  const lockUntil = useRef(0);
  const go = useCallback((id: PartId) => {
    setActive(id);
    lockUntil.current = Date.now() + 1000;
    partRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // ป็อบอัพของปุ่ม Demo ในแถบเมนูซ้าย — ลงทะเบียนตอนเปิดหน้า ล้างตอนออก
  useEffect(() => {
    registerDemoNav(PARTS, (id) => go(id as PartId));
    return clearDemoNav;
  }, [go]);
  useEffect(() => { setDemoActive(active); }, [active]);
  useEffect(() => {
    let raf = 0;
    const spy = () => {
      raf = 0;
      if (Date.now() < lockUntil.current) return;
      let cur: PartId = PARTS[0].id;
      for (const p of PARTS) {
        const el = partRefs.current[p.id];
        if (el && el.getBoundingClientRect().top <= SPY_LINE) cur = p.id;
      }
      setActive(cur);
    };
    // capture: กล่องที่เลื่อนจริงอาจไม่ใช่ window — scroll ไม่ bubble แต่ดักตอน capture ได้ทุกกล่อง
    const on = () => { if (!raf) raf = requestAnimationFrame(spy); };
    document.addEventListener("scroll", on, { capture: true, passive: true });
    return () => { document.removeEventListener("scroll", on, { capture: true }); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const m = data?.manifest;
  const meta = m && (
    <Meta parts={[
      <><b>{fmt(all.length)}</b> เที่ยว = จับคู่กับข้อมูลรายได้ได้ <b>{fmt(all.length - emptyN)}</b> + เที่ยววิ่งเปล่า <b>{fmt(emptyN)}</b> จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
      `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
      <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
    ]} />
  );

  /** สามส่วนแรกใช้ trips — ไฟล์ต้นทุนพัง/ยังโหลด/ว่าง ขึ้นข้อความแทนเนื้อหา แต่ส่วนกำไรลูกค้ายังวาดได้ */
  const tripsState: ReactNode = error ? (
    <div className="card">
      <div className="banner">{error}</div>
      <p className="muted">
        สร้างไฟล์ข้อมูลด้วย <code>python etl/build_costrev.py --dataset sample</code> (หรือ <code>--dataset real</code>)
      </p>
    </div>
  ) : !m ? (
    <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
  ) : all.length === 0 ? (
    <div className="card">
      <h2>ยังไม่มีข้อมูล</h2>
      <p className="muted">
        ไม่มีเที่ยวไหนที่เลขที่ใบรายการตรงกับข้อมูลรายได้จริง และไม่มีเที่ยววิ่งเปล่า —
        ตรวจว่าวางไฟล์รายได้ใน etl/data/revenue/ แล้วรัน ETL ใหม่
      </p>
    </div>
  ) : null;

  const part = (id: PartId, body: ReactNode) => (
    <section key={id} id={`demo-${id}`} className="dm-part" ref={(el) => { partRefs.current[id] = el; }}>
      <h2 className="dm-part-h">{PARTS.find((p) => p.id === id)!.label}</h2>
      {body}
    </section>
  );

  return (
    <>
      <EtlBanner status={etl} />
      <DashShell sample={m?.isSample} meta={meta || undefined}
        onRefresh={reload} loading={loading} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่">
        <FilterBar>
          <PeriodFF trips={all} value={f} onChange={setF} />
          <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(all.map((t) => t.o))} />
          <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(all.map((t) => t.de))} />
          <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(all.map((t) => t.ft))} />
          <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(all.map((t) => t.vk))} />
          <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.sg} onChange={set("sg")}
            opts={duniq(all.map((t) => t.sg || "ไม่ระบุ"))} />
          <ClearFiltersBtn active={isFiltered(f, DEMO_F0)} onClick={() => setF(DEMO_F0)} />
        </FilterBar>

        {part("route", tripsState ?? <RouteProfitTab trips={all} f={f} />)}
        {part("item2", tripsState ?? <Item2Tab all={all} trips={trips} tripsAnyYear={tripsAnyYear} f={f} />)}
        {part("item3", tripsState ?? <Item3Tab trips={trips} costTrips={tripsAnyYear} year={f.year} />)}
        {part("cust", <CustomerProfitTab f={f} />)}
      </DashShell>
    </>
  );
}
