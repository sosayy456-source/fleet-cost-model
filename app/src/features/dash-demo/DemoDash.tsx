/**
 * เมนู "Demo" — หน้าทดลอง เห็นเฉพาะผู้ดูแลระบบ (ROLE_VIEWS.admin)
 *
 * ★ หน้ายาวหน้าเดียว (เจ้าของงานสั่ง 24 ก.ย. 2569) — เดิมเป็น 4 แท็บ ตอนนี้วาดครบทั้ง 4 ส่วนเรียงลงมา
 *   ปุ่มแท็บ**ย้ายไปเป็นป็อบอัพของปุ่ม Demo ในแถบเมนูซ้ายแล้ว** (เจ้าของงานสั่ง 24 ก.ย. 2569 · lib/ui/demoNav.ts)
 *   กดแล้ว **เลื่อนไปหาส่วนนั้น** ไม่ใช่สลับหน้า · รายการในป็อบอัพไฮไลต์ตามส่วนที่เลื่อนถึง · หัวหน้าไม่มีแถบแท็บแล้ว
 * ★ ตัวกรองชุดเดียวคุมทั้งหน้า (filter.tsx) — แต่ละส่วนกรองเท่าที่ข้อมูลของตัวเองมี แล้วบอกข้อจำกัดในปุ่มข้อมูลด้วย FilterScope
 *   ยกเว้นลูกหนี้ DSO (กำไรลูกค้า ส่วนที่ 2) ที่มี "ข้อมูล ณ วันที่" ของตัวเองเหมือนเดิม
 * ★ หัวหน้าเป็นของไฟล์ต้นทุน (costrev/) เสมอ ช่วงข้อมูล + ข้อจำกัดของไฟล์ลูกหนี้อยู่ที่หัวส่วน DSO
 *
 * ใช้ `costrev/trips.json` ชุด `inProfitScope()` = เที่ยวที่จับคู่บิลได้ หรือเที่ยวเปล่า
 * เที่ยวเปล่าที่จับคู่ไม่ได้มีรายได้ 0 และหักต้นทุนจากกำไรเที่ยว แต่ไม่ปันเข้ากำไรลูกค้า
 *
 * ส่วน "กำไรลูกค้า" **ไม่ใช้ trips เลย** — อ่านชุด alloc/ กับ debtors/ ของตัวเอง
 * จึงวาดเสมอแม้ไฟล์ต้นทุนจะหาย/ยังโหลดไม่เสร็จ (สามส่วนแรกขึ้นข้อความแทน)
 *
 * ★ Performance Index (เจ้าของงานสั่ง 25 ก.ย. 2569 · PiIndex.tsx · สูตร lib/pi/score.ts) — กล่องยาวท้ายทุกส่วน
 *   วาดเสมอแม้ส่วนนั้นขึ้นข้อความแทนเนื้อหา (ขึ้น "ไม่มีข้อมูล" เอง) · คะแนนรวม XX/100 เป็นบรรทัดสุดท้ายของหน้า
 */
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import DashShell, { Meta, dataRangeText } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useCostRev, inProfitScope } from "../../lib/data/useCostRev";
import { useDebtors } from "../../lib/data/useDebtors";
import { ListFF, MultiFF, PeriodFF, duniq, fmt, isFiltered } from "../dash-costrev/common";
import RouteProfitTabRaw from "./RouteProfitTab";
import Item2TabRaw from "./Item2Tab";
import Item3TabRaw from "./Item3Tab";
import CustomerProfitTabRaw from "./CustomerProfitTab";
import { DEMO_F0, passDemo } from "./filter";
import type { DemoFilter } from "./filter";
import TruckLoader from "../../lib/ui/TruckLoader";
import { clearDemoNav, DEMO_PARTS, registerDemoNav, setDemoActive, takeDemoPending } from "../../lib/ui/demoNav";
import * as Pi from "./PiIndex";
import { firstDay, minEvalStart } from "../../lib/pi/baseline";
import { PiDailyProvider, PiPeriodProvider, PiRecommend, PiReportProvider, PiTotal, usePiReports } from "./PiIndex";
import { PERIOD_ALL, hasDays, periodBounds } from "../../lib/filter/period";
import type { Period } from "../../lib/filter/period";
import ThemeScope, { useThemeScope } from "../../lib/ui/ThemeScope";

/*
 * ★ ทุกส่วนห่อ memo (26 ก.ย. 2569 · docs/แผนแก้-ข้อมูลจริงช้า.md ข้อ 2)
 *   กล่อง PI แต่ละกล่องแจ้งคะแนนขึ้นมาที่หน้านี้ (setReports) — เดิมทุกครั้งที่แจ้ง ทั้ง 4 ส่วนวาดใหม่หมด
 *   ตอนเปิดหน้าจึงคิดทั้งหน้าซ้ำ 5–6 รอบ · ห่อแล้ววาดใหม่เฉพาะส่วนที่ props เปลี่ยนจริง ตัวเลขเท่าเดิม
 *   props ที่ส่งเข้าต้องคงที่ (useMemo / ค่าจาก state) ไม่งั้น memo ไม่มีผล
 */
const RouteProfitTab = memo(RouteProfitTabRaw);
const Item2Tab = memo(Item2TabRaw);
const Item3Tab = memo(Item3TabRaw);
const CustomerProfitTab = memo(CustomerProfitTabRaw);
const PiRoute = memo(Pi.PiRoute);
const PiFleet = memo(Pi.PiFleet);
const PiCost = memo(Pi.PiCost);
const PiService = memo(Pi.PiService);
const DamageRateBox = memo(Pi.DamageRateBox);

const PARTS = DEMO_PARTS;
const ROUTE_LABEL = PARTS.find((p) => p.id === "route")!.label;
type PartId = (typeof PARTS)[number]["id"];
type InfoId = PartId | "cust-debtors";
type SectionInfo = { content: ReactNode; sample?: boolean };
/** เส้นอ้างอิงของการไฮไลต์ตามการเลื่อน — ส่วนที่หัวของมันเลยเส้นนี้ขึ้นไปแล้ว = ส่วนที่กำลังอ่าน (px จากขอบบนจอ) */
const SPY_LINE = 160;

export default function DemoDash() {
  const { data, error, loading, reload } = useCostRev();
  const debtors = useDebtors();
  const etl = useEtlStatus("costrev");
  // แถบที่หัวหน้า = สถานะรวมทุกงาน ETL (งานปันส่วนกำไรลูกค้าแปลงต่อหลังงานนี้อีกนาน)
  const etlAll = useEtlStatus("all");
  useAutoReloadOnEtl(etl, reload);
  const [f, setF] = useState<DemoFilter>(DEMO_F0);
  const [floatingFilterOpen, setFloatingFilterOpen] = useState(false);
  const floatingButton = useRef<HTMLButtonElement>(null);
  const floatingPanel = useRef<HTMLDivElement>(null);
  /**
   * ตัวกรองที่เนื้อหาใช้ — ตามหลัง f (ที่แถบตัวกรองโชว์) ด้วย useDeferredValue
   * เลือกตัวกรองแล้วช่องเลือกเปลี่ยนทันที ส่วนการคิดทั้งหน้าใหม่ทำเบื้องหลังแบบแบ่งช่วง (React หยุดให้เบราว์เซอร์
   * ตอบสนองได้ระหว่างวาดแต่ละส่วน) เปลี่ยนตัวกรองรัว ๆ ก็ทิ้งรอบที่ยังคิดไม่เสร็จ · ระหว่างรอเนื้อหาจางลง (stale)
   */
  const fv = useDeferredValue(f);
  const stale = fv !== f;
  const set = (k: keyof DemoFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [active, setActive] = useState<PartId>("route");
  const [activeInfo, setActiveInfo] = useState<InfoId>("route");
  const [sectionInfo, setSectionInfo] = useState<Partial<Record<InfoId, SectionInfo>>>({});
  const registerInfo = useCallback((id: InfoId, content: ReactNode, sample?: boolean) => {
    setSectionInfo((prev) => ({ ...prev, [id]: { content, sample } }));
  }, []);
  const registerItem2Info = useCallback((content: ReactNode, sample?: boolean) => registerInfo("item2", content, sample), [registerInfo]);
  const registerProfitInfo = useCallback((content: ReactNode, sample?: boolean) => registerInfo("cust", content, sample), [registerInfo]);
  const registerDebtorInfo = useCallback((content: ReactNode, sample?: boolean) => registerInfo("cust-debtors", content, sample), [registerInfo]);
  const pi = usePiReports();

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
    floatingPanel.current?.querySelector("select")?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [floatingFilterOpen]);

  const all = useMemo(() => (data ? data.trips.filter(inProfitScope) : []), [data]);
  const branches = useMemo(() => duniq([
    ...all.map((t) => t.br),
    ...(debtors.data?.rows ?? []).map((r) => r.br),
  ]), [all, debtors.data]);
  const filterOptions = useMemo(() => ({
    origins: duniq(all.map((t) => t.o)),
    dests: duniq(all.map((t) => t.de)),
    fleetTypes: duniq(all.map((t) => t.ft)),
    vehicles: duniq(all.map((t) => t.vk)),
    services: duniq(all.map((t) => t.sg || "ไม่ระบุ")),
  }), [all]);
  const emptyAll = useMemo(() => data?.trips ?? [], [data]);
  const emptyBranchTrips = useMemo(() => emptyAll.filter((t) => !fv.br || t.br === fv.br), [emptyAll, fv.br]);
  const emptyTrips = useMemo(() => emptyAll.filter((t) => passDemo(t, fv)), [emptyAll, fv]);
  const emptyTripsAnyYear = useMemo(() => emptyAll.filter((t) => passDemo(t, fv, { ignoreYear: true })), [emptyAll, fv]);
  const trips = useMemo(() => all.filter((t) => passDemo(t, fv)), [all, fv]);
  // ข้อ 3 ส่วนที่ 1 เทียบปีที่เลือกกับปีก่อนหน้า — ต้องได้เที่ยวทุกปีที่ผ่านตัวกรองอื่น
  const tripsAnyYear = useMemo(() => all.filter((t) => passDemo(t, fv, { ignoreYear: true })), [all, fv]);

  /* ---------- ปุ่มแท็บ = เลื่อนไปหาส่วน · ไฮไลต์ตามส่วนที่เลื่อนถึง ---------- */
  const partRefs = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  /** ช่วงที่กำลังเลื่อนเพราะกดปุ่ม — ไม่ให้ไฮไลต์วิ่งผ่านทุกส่วนระหว่างทาง */
  const lockUntil = useRef(0);
  const go = useCallback((id: PartId) => {
    setActive(id);
    setActiveInfo(id);
    lockUntil.current = Date.now() + 1000;
    partRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // ป็อบอัพของปุ่ม Demo ในแถบเมนูซ้าย — ลงทะเบียนตอนเปิดหน้า ล้างตอนออก
  useEffect(() => {
    registerDemoNav(PARTS, (id) => go(id as PartId));
    return clearDemoNav;
  }, [go]);
  useEffect(() => { setDemoActive(active); }, [active]);
  // กดแท็บย่อยจากหน้าอื่น → เปิดหน้านี้แล้วเลื่อนไปส่วนนั้นเมื่อข้อมูลมาแล้ว (ส่วนต่าง ๆ ถูกวาดแล้ว)
  useEffect(() => {
    if (!data) return;
    const id = takeDemoPending();
    if (!id) return;
    // เลื่อนซ้ำอีกรอบหลังกราฟ/แผนที่วาดเสร็จ — ส่วนบนสูงขึ้นหลังเลื่อนครั้งแรก หัวส่วนจึงไม่ถึงขอบบน
    // แล้วไฮไลต์เมนูไปติดส่วนก่อนหน้า (วัดจริง: ข้อ 3 ค้างที่ 182px)
    const raf = requestAnimationFrame(() => go(id as PartId));
    const t = setTimeout(() => go(id as PartId), 700);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [data, go]);
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
      const debtorStart = partRefs.current.cust?.querySelector<HTMLElement>('[data-demo-info="cust-debtors"]');
      setActiveInfo(cur === "cust" && debtorStart && debtorStart.getBoundingClientRect().top <= SPY_LINE ? "cust-debtors" : cur);
    };
    // capture: กล่องที่เลื่อนจริงอาจไม่ใช่ window — scroll ไม่ bubble แต่ดักตอน capture ได้ทุกกล่อง
    const on = () => { if (!raf) raf = requestAnimationFrame(spy); };
    document.addEventListener("scroll", on, { capture: true, passive: true });
    return () => { document.removeEventListener("scroll", on, { capture: true }); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const m = data?.manifest;
  /** วันแรกที่ประเมินได้ = เดือนแรกของชุดกำไร + 12 เดือน (lib/pi/baseline.ts minEvalStart) */
  const minStart = useMemo(() => { const d = firstDay(all); return d ? minEvalStart(d) : null; }, [all]);
  /** เที่ยวที่กรองแล้วสำหรับกล่อง PI — null = ไฟล์ต้นทุนยังไม่มี/โหลดไม่ได้ (กล่องขึ้น "ไม่มีข้อมูล") */
  // ช่วงที่ประเมินของ PI: ไม่เลือกปี = เดือนล่าสุดของไฟล์ (เจ้าของงานเลือก 28 ก.ย. 2569) — การ์ด/กราฟอื่นยังตามตัวกรองเดิม
  // ช่วงประเมินของ PI แยกจากตัวกรองรวม (30 ก.ย. 2569) — piF = ตัวกรองรวม แต่ปี/เดือน/วัน ของ PI
  const [piPeriod, setPiPeriod] = useState<Period>(PERIOD_ALL);
  // ตัวกรองรวมเปลี่ยนช่วงเวลา → ช่วงประเมินของ PI ตามให้อัตโนมัติ (เจ้าของงานสั่ง 30 ก.ย. 2569):
  // ช่วงของตัวกรองรวมเทียบ Baseline ได้ (วันแรก ≥ minStart) = ใช้ช่วงนั้นแบบเทียบ Baseline · เทียบไม่ได้/ทุกปี = ไม่เทียบ Baseline
  // ผู้ใช้ยังเปลี่ยนในแผงของ PI เองได้ จนกว่าจะเปลี่ยนช่วงของตัวกรองรวมอีกครั้ง
  useEffect(() => {
    const b = periodBounds(fv);
    const ok = !!b && !!minStart && b.start >= minStart;
    setPiPeriod(ok ? { year: fv.year, from: fv.from, to: fv.to, d1: fv.d1, d2: fv.d2 } : PERIOD_ALL);
  }, [fv.year, fv.from, fv.to, fv.d1, fv.d2, minStart]); // eslint-disable-line react-hooks/exhaustive-deps
  // ช่องช่วงประเมินว่าง = ตามช่วงของตัวกรองรวม (ทุกปีได้) ไม่เทียบ Baseline · เลือกช่วง = เทียบ Baseline 12 เดือน (เจ้าของงานสั่ง 30 ก.ย. 2569)
  const piF = useMemo<DemoFilter>(() => (!piPeriod.year ? { ...fv, noBase: true }
    : { ...fv, year: piPeriod.year, from: piPeriod.from, to: piPeriod.to, d1: piPeriod.d1, d2: piPeriod.d2 }), [fv, piPeriod]);
  const piCtl = useMemo(() => ({ value: piPeriod, set: setPiPeriod, trips: all, minStart: minStart ?? undefined }), [piPeriod, all, minStart]);
  const piEval = useMemo(() => (m && !error ? Pi.tripEvalOf(all, piF) : null), [m, error, all, piF]);
  const piTrips = piEval?.trips ?? null;
  /** ทุกเที่ยวในชุด ไม่ตามตัวกรอง — ชุดที่ Empty Return กรองเอง (ข้ามกลุ่มบริการ) */
  const piRef = m && !error ? all : null;
  /** ชุดอ้างอิงของเกณฑ์ percentile = 12 เดือนล่าสุดของไฟล์ ตามตัวกรองยกเว้นเวลา (InDex_revised v2.md · lib/pi/baseline.ts) */
  const piRefs = useMemo(() => (piRef ? Pi.tripRefOf(piRef, piF) : null), [piRef, piF]);
  const meta = m && (
    <Meta parts={[
      <><b>{fmt(all.length)}</b> เที่ยวที่นับกำไร (จับคู่บิลได้ {fmt(m.matched)} + เที่ยวเปล่าที่จับคู่ไม่ได้ {fmt(all.length - m.matched)}) จาก <b>{fmt(m.rows)}</b> เที่ยวในไฟล์</>,
      `ข้อมูลรายได้ ${m.revenueFiles} ไฟล์`,
      <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
    ]} />
  );
  const infoForScreen = sectionInfo[activeInfo];
  // ส่วนที่ไม่ได้ลงทะเบียนข้อมูลเอง (อ่านไฟล์ต้นทุนชุดเดียวกับหัว) = ชื่อส่วน + ที่มาของไฟล์ต้นทุน
  const costInfo = activeInfo === "route" || activeInfo === "item3" || activeInfo === "svc" || activeInfo === "pi" || activeInfo === "rec";
  const sectionLabel = PARTS.find((p) => p.id === activeInfo)?.label ?? "";
  const infoContent = costInfo
    ? <><h3>{sectionLabel}</h3>{meta && <p className="dh-meta">{meta}</p>}
      {(activeInfo === "pi" || activeInfo === "rec") && <p>คะแนนรวมจากกล่อง Performance Index ทุกส่วน — ตัวชี้วัดแต่ละตัวอ่านชุดข้อมูลของส่วนนั้น (ไฟล์ต้นทุน · Load Factor · ปันส่วนลูกค้า · ลูกหนี้)</p>}</>
    : infoForScreen?.content ?? <p>กำลังโหลดที่มาและข้อจำกัดของข้อมูลส่วนนี้…</p>;
  const infoSample = costInfo ? m?.isSample : infoForScreen?.sample;

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
    <PartFrame key={id} id={id} stale={stale} refCb={(el) => { partRefs.current[id] = el; }}>
      {/* สีรายส่วนจากหน้าการตั้งค่า (lib/ui/ThemeScope.tsx) — ครอบหัวส่วนด้วย สีหัวข้อบนพื้นหลังจึงตั้งรายส่วนได้ */}
      <ThemeScope scope={`demo:${id}`}>
        {/* Profit Per Route วาดชื่อส่วนเองเหนือแผนที่ (RouteProfitTab partTitle) — ไฟล์ต้นทุนยังไม่พร้อมค่อยวาดที่หัวส่วนตามเดิม */}
        {(id !== "route" || tripsState) && <h2 className="dm-part-h">{PARTS.find((p) => p.id === id)!.label}</h2>}
        {body}
      </ThemeScope>
    </PartFrame>
  );

  const renderFilters = () => <>
    {/* ปี → เดือน → วัน · วันที่ที่ไฟล์ต้นทุนมีข้อมูลย้อนหลังไม่ครบ 12 เดือนเลือกไม่ได้ (Baseline ของ PI ไม่ครบ · Methodology 29 ก.ย. 2569) */}
    <PeriodFF trips={all} value={f} onChange={setF} days />
    <ListFF label="สาขา" all="ทุกสาขา" value={f.br} onChange={set("br")} opts={branches} />
    <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={filterOptions.origins} />
    <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={filterOptions.dests} />
    <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={filterOptions.fleetTypes} />
    <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={filterOptions.vehicles} />
    <MultiFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.sg} onChange={set("sg")}
      opts={filterOptions.services} />
    <ClearFiltersBtn active={isFiltered(f, DEMO_F0)} onClick={() => setF(DEMO_F0)} />
  </>;

  /** ปุ่มตัวกรองในแคปซูล + แผงตัวกรอง (ชุดเดียวกับแผงลอยเดิม) — จุดแดง = มีตัวกรองอยู่ */
  const filterTool = (
    <div className="cap-filter">
      <button ref={floatingButton} type="button" className="dm-filter-toggle"
        aria-label={floatingFilterOpen ? "ปิดตัวกรอง" : "เปิดตัวกรอง"}
        aria-controls={floatingFilterOpen ? "dm-filter-panel" : undefined} aria-expanded={floatingFilterOpen}
        onClick={() => setFloatingFilterOpen((open) => !open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
        </svg>
        {isFiltered(f, DEMO_F0) && <span className="dm-filter-dot" aria-hidden="true" />}
      </button>
      {floatingFilterOpen && <div id="dm-filter-panel" ref={floatingPanel} className="dm-filter-panel" role="region" aria-label="ตัวกรอง Executive Dashboard">
        <div className="dm-filter-panel-head">
          <h2>ตัวกรอง</h2>
          <button type="button" aria-label="ปิดตัวกรอง" onClick={() => { setFloatingFilterOpen(false); floatingButton.current?.focus(); }}>✕</button>
        </div>
        <div className="dm-filter-fields">{renderFilters()}</div>
      </div>}
    </div>
  );
  /** แท็บทุกส่วนในแคปซูล = เลื่อนไปหาส่วน · ไฮไลต์ตามส่วนที่เลื่อนถึง (ชุดเดียวกับแท็บย่อยในเมนูซ้าย) */
  // 7 แท็บยาวเกินแคปซูล (เจ้าของงานสั่ง 28 ก.ย. 2569): แท็บที่ไม่ได้เลือกเหลือคำแรก + "…" · แท็บที่เลือกชื่อเต็ม · ชื่อเต็มใน tooltip
  const partTabs = PARTS.map((p) => {
    const on = active === p.id;
    const words = p.label.split(" ");
    const short = words.length > 1 ? `${words[0]}…` : p.label;
    return (
      <button key={p.id} type="button" className={on ? "on" : ""} aria-current={on ? "true" : undefined}
        title={p.label} aria-label={p.label} onClick={() => go(p.id)}>
        {/* ชี้เมาส์ = กางชื่อเต็ม (เจ้าของงานสั่ง 28 ก.ย. 2569) · แท็บที่เลือกเต็มเสมอ */}
        {on ? p.label : <><span className="cap-t-s">{short}</span><span className="cap-t-f">{p.label}</span></>}</button>
    );
  });

  return (
    <>
      <EtlBanner status={etlAll} />
      {/* หัวแคปซูล: โลโก้ · Executive Dashboard + ช่วงข้อมูล · แท็บข้อความ 4 ส่วน · ปุ่มตัวกรอง
          ตัวกรองอยู่ในแผงของปุ่มอย่างเดียว (เอากล่องตัวกรองในหัวออก) */}
      <DashShell sample={infoSample}
        onRefresh={reload} loading={loading} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้ (costrev/) มาใหม่"
        capsule={{ tabs: partTabs, sub: m ? dataRangeText(m.dateRange.min, m.dateRange.max) : undefined, tools: filterTool, info: infoContent }}>
        <PiReportProvider value={pi.report}>
        <PiPeriodProvider value={piCtl}>
        <PiDailyProvider value={!piF.noBase && hasDays(piF)}>
          {/* 6 กล่องภาพรวมอยู่นอกกรอบส่วน — ส่วน Profit Per Route เริ่มที่กราฟรายเดือน (เจ้าของงานสั่ง 28 ก.ย. 2569) */}
          {!tripsState && <div className={stale ? "dm-overview dm-stale" : "dm-overview"}><RouteProfitTab trips={all} f={fv} overview /></div>}
          {part("route", <>{tripsState ?? <RouteProfitTab trips={all} f={fv} partTitle={ROUTE_LABEL} />}<hr className="dm-pi-sep" />
            <PiRoute trips={piTrips} refs={piRefs} period={piEval?.label} /></>)}
          {part("item2", <>{tripsState ?? <Item2Tab all={emptyBranchTrips} trips={emptyTrips} tripsAnyYear={emptyTripsAnyYear} f={fv} costSample={m?.isSample}
            onInfo={registerItem2Info} />}
            <PiFleet f={piF} all={piRef} /></>)}
          {part("item3", <>{tripsState ?? <Item3Tab trips={trips} costTrips={tripsAnyYear} year={fv.year} />}
            <PiCost trips={piTrips} refs={piRefs} period={piEval?.label} /></>)}
          {part("cust", <>
            <CustomerProfitTab f={fv} piF={piF}
              onProfitInfo={registerProfitInfo} onDebtorInfo={registerDebtorInfo} />
          </>)}
          {/* 3 ส่วนท้ายแยกเป็นแท็บของตัวเอง (เจ้าของงานสั่ง 28 ก.ย. 2569 — เดิมอยู่ท้าย Customer Performance) */}
          {/* การ์ด Damage Rate (ซ้าย) + Service Quality (ขวา · แบ่งสองคอลัมน์ในกล่อง) — ตามภาพที่เจ้าของงานส่ง 28 ก.ย. 2569 */}
          {part("svc", <div className="pi-pair">
            {/* การ์ด Damage Rate ใบเดียวกับแท็บ Damage — ตามตัวกรองของหน้า ไม่ใช่ช่วงที่ประเมินของ PI */}
            <DamageRateBox trips={m && !error ? trips : null} />
            <PiService trips={piTrips} refs={piRefs} period={piEval?.label} />
          </div>)}
          {part("pi", <PiTotal reports={pi.reports} />)}
          {part("rec", <PiRecommend reports={pi.reports} />)}
        </PiDailyProvider>
        </PiPeriodProvider>
        </PiReportProvider>
      </DashShell>
    </>
  );
}

/**
 * กรอบของแต่ละส่วน (section.dm-part) — ใส่สีที่แท็บนั้นตั้งเองลงบนกรอบด้วย ไม่งั้นพื้น/ขอบกรอบ (--th-partBg/partAlpha/partBorder)
 * ตั้งรายแท็บไม่ได้ เพราะ ThemeScope อยู่ข้างในกรอบ (เจ้าของงานขอ 28 ก.ย. 2569) · ห้ามครอบ section ด้วย div — `.cap-bar ~ .dm-part` ต้องเป็นพี่น้องกัน
 */
function PartFrame({ id, stale, refCb, children }: {
  id: string; stale: boolean; refCb: (el: HTMLElement | null) => void; children: ReactNode;
}) {
  const style = useThemeScope(`demo:${id}`);
  return (
    <section id={`demo-${id}`} className={stale ? "dm-part dm-stale" : "dm-part"} ref={refCb} style={style}>
      {children}
    </section>
  );
}
