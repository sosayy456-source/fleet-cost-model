/**
 * กล่อง Performance Index ของหน้า Demo (เจ้าของงานสั่ง 25 ก.ย. 2569) — สูตร/เกณฑ์อยู่ใน lib/pi/score.ts ที่เดียว
 *
 *   ท้ายส่วน Profit Per Route              → Route & Service Profitability Index (%Margin รายเส้นทาง · 3 กลุ่มบริการ)
 *   ท้ายส่วน Inefficient Transportation Cost → Fleet & Trip Efficiency Index (Load Factor จากไฟล์ LF · Empty Return เกณฑ์แท็บ Empty Trips)
 *   ท้ายส่วน Vehicle Utilization Cost      → Cost & Vehicle Utilization Index (Cost per Ton-km · Fixed Cost Coverage รายคัน)
 *   ท้ายส่วน Customer Performance          → Customer Profitability & Cash Flow Index (กล่องยาว)
 *                               → Service Quality Index (ซ้าย · DR + DIR เทียบ P75 · lib/pi/damage.ts) + การ์ด Damage Rate (ขวา)
 *                                 ขนาดเท่ากัน (เจ้าของงานย้าย 25 ก.ย. 2569) → คะแนนรวม XX/100 บรรทัดสุดท้าย
 *                                 **กดกล่องคะแนนรวม = ป็อบอัพที่มาของคะแนนทุกตัวชี้วัด** (PiDetailModal · เจ้าของงานขอ 25 ก.ย. 2569)
 * ★ หน้าตา (เจ้าของงานขอให้เด่นขึ้น 25 ก.ย. 2569): พื้นไล่สีชุดเดียวกับการ์ดเด่น (Hero) หนึ่งสีต่อหมวด (.pi-box.t-<id>)
 *   หลอดคะแนนของหมวด + ชิปรายตัวชี้วัดพร้อมหลอดเล็ก · บรรทัดคะแนนรวมพื้นกรมท่า
 *
 * ★ กล่องแต่ละใบคิดคะแนนจากข้อมูลของส่วนตัวเอง แล้วแจ้งผลขึ้นไปที่ DemoDash ผ่าน PiReportCtx ให้บรรทัดคะแนนรวมอ่าน
 *   (ข้อมูลคนละชุด คนละ hook — ส่วนกำไรลูกค้าโหลด alloc/debtors เอง และวันที่ของ DSO อยู่ในส่วน DSO)
 * ★ ตัวชี้วัดที่ยังไม่มีเกณฑ์ขึ้น "รอเกณฑ์" · ชุดข้อมูลหาย/ไม่มีรายการขึ้น "ไม่มีข้อมูล" — ทั้งสองแบบไม่นับเข้าฐาน
 *   คะแนนหมวด/คะแนนรวมจึงบอก "คิดได้ x จาก y" ไว้ด้วย (เจ้าของงานเลือก) ไม่งั้นอ่านผิดว่าได้คะแนนต่ำ
 */
// รูปกล่องพังของกล่อง Damage (เจ้าของงานส่ง 29 ก.ย. 2569 · ตัดพื้นขาวจากภาพที่ส่งมา)
import imgDamageBox from "../../assets/icons3d/damage-box.webp";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openExecTab } from "../../lib/ui/dashJump";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import type { LfData } from "../../lib/data/useLoadFactor";
import { vehicleRows } from "../../lib/detail3/calc";
import type { VRow } from "../../lib/detail3/calc";
import { totalDamage } from "../../lib/damage/damage";
import { BAND_MEANING, DAILY_NA, INDEXES, METRICS, METRIC_MAX, STATUS_LABEL, STATUS_MEANING, STATUS_RANGE, TOTAL_MAX, asDaily, indexStatus, metricResult, sumScores, withPeriod } from "../../lib/pi/score";
import { BASELINE_TITLE, BRANCH_MIN_MONTHLY, baselineOf, evalPeriod, evalRange, firstDay, inRange, refSet, scopedValues, selfRefSet } from "../../lib/pi/baseline";
import { coverageByVehicleMonth, tkmByVehicleMonth } from "../../lib/pi/cost";
import { PERIOD_ALL, periodLabel } from "../../lib/filter/period";
import type { Period } from "../../lib/filter/period";
import type { Baseline } from "../../lib/pi/baseline";
import { SERVICE_GROUPS, routeMargin, routeMarginValues, serviceMonthMarginValues } from "../../lib/pi/route";
import { routeRates } from "../../lib/empty/routeScore";
import { emptyResult } from "../../lib/pi/empty";
import { damageRef, damageResults } from "../../lib/pi/damage";
import type { DamageRef } from "../../lib/pi/damage";
import type { IndexDef, IndexStatus, MetricKey, MetricResult } from "../../lib/pi/score";
import { inProfitScope } from "../../lib/data/useCostRev";
import type { Trip } from "../../lib/data/useCostRev";
import { PeriodFF, fmt, pct } from "../dash-costrev/common";
import { DEMO_F0, passDemo, passLfDemo } from "./filter";
import type { DemoFilter } from "./filter";

/**
 * Reference Baseline ของตัวชี้วัดที่ใช้ไฟล์ต้นทุน (Methodology 29 ก.ย. 2569 · lib/pi/baseline.ts)
 * = เที่ยวในชุดกำไรช่วง 12 เดือนปฏิทินก่อนเดือนที่ประเมิน **ระดับบริษัท ไม่ตามตัวกรองใด ๆ** · b = ช่วง/Coverage (null = ไม่มีข้อมูล)
 */
export interface TripRef {
  trips: Trip[]; b: Baseline | null;
  /** สาขาที่เลือก + เที่ยวของสาขาใน Baseline (เลือกสาขาแล้ว Baseline ตามสาขาได้ · 29 ก.ย. 2569) · ไม่เลือก = "" / null */
  br: string; branch: Trip[] | null;
  /** ไม่เทียบ Baseline — trips = เที่ยวของช่วงที่ประเมินเอง เกณฑ์คิดจากชุดนี้ (f.noBase) */
  self?: boolean;
}

/** ค่า Baseline ระดับสาขา/บริษัท → RefSet (ถึงขั้นต่ำใช้สาขา ไม่ถึงใช้บริษัท + ป้าย) */
function scopedRef(ref: TripRef, valuesOf: (trips: Trip[]) => number[], unit: string, min?: number) {
  if (ref.self) return selfRefSet(valuesOf(ref.trips), unit);
  const sv = scopedValues(valuesOf(ref.trips), ref.branch && valuesOf(ref.branch), ref.br, unit, min);
  return refSet(sv.values, unit, ref.b, false, sv.scope);
}


/**
 * เที่ยวของช่วงที่ประเมิน — ไม่เลือกปี = เดือนล่าสุดของไฟล์ (เจ้าของงานเลือก 28 ก.ย. 2569 "ประเมินเป็นรายเดือน")
 * · label = ป้ายช่วงที่ติดไปกับผล · all = ทุกเที่ยวในชุดกำไร (ไม่กรอง)
 */
export function tripEvalOf(all: Trip[], f: DemoFilter): { trips: Trip[]; label: string } {
  // ไม่เทียบ Baseline = ช่วงของตัวกรองรวมตรง ๆ (ไม่เลือกปี = ทุกปี ไม่ใช่เดือนล่าสุด)
  if (f.noBase) return { trips: all.filter((t) => passDemo(t, f)), label: noBaseLabel(f) };
  const pf = evalPeriod(f, all.map((t) => t.mo));
  return { trips: all.filter((t) => passDemo(t, pf)), label: periodLabel(pf) };
}
export function tripRefOf(all: Trip[], f: DemoFilter): TripRef {
  if (f.noBase) return { trips: all.filter((t) => passDemo(t, f)), b: null, br: "", branch: null, self: true };
  const mos = all.map((t) => t.mo);
  const ev = evalRange(f, mos);
  if (!ev) return { trips: [], b: null, br: f.br, branch: null };
  const b = baselineOf(ev, firstDay(all), mos);
  const trips = all.filter((t) => inRange(t, b, "inside"));
  return { trips, b, br: f.br, branch: f.br ? trips.filter((t) => t.br === f.br) : null };
}

/** ป้ายช่วงของโหมดไม่เทียบ Baseline — "ทุกปี" หรือช่วงของตัวกรองรวม */
export const noBaseLabel = (f: DemoFilter): string => (f.year ? periodLabel(f) : "ทุกปี");

/** %Margin รวมของชุดเที่ยว (Actual) — Σกำไร ÷ Σรายได้ */
const marginAll = (trips: { rev: number; profit: number }[]): number | null => {
  let rev = 0, profit = 0;
  for (const t of trips) { rev += t.rev; profit += t.profit; }
  return routeMargin(rev, profit);
};

/** คะแนนทศนิยมไม่เกิน 1 ตำแหน่ง — 6.25 → "6.3" · 10 → "10" */
const sc = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** "(72.5%)" ตัวเล็กต่อท้าย x/20 ของกล่องหมวด — % ของคะแนนเต็มหมวด (เจ้าของงานขอ 1 ต.ค. 2569 · /10 กับ /100 ไม่ใส่) */
function PctOf({ v, full }: { v: number; full: number }) {
  return <small className="pi-pct">({sc(full ? v / full * 100 : 0)}%)</small>;
}

type Report = (id: string, results: MetricResult[]) => void;
const PiReportCtx = createContext<Report | null>(null);
export const PiReportProvider = PiReportCtx.Provider;
/**
 * ช่วงประเมินของหน้าไม่เต็มเดือน (Daily View) — กล่อง PI แสดงสี/Actual แต่ไม่คิดคะแนน (asDaily · ข้อ 5 ของ Methodology)
 * DemoDash ตั้งจาก hasDays(ตัวกรอง) · หน้าอื่น (Executive Summary) ไม่ตั้ง = Monthly View เสมอ
 */
const PiDailyCtx = createContext(false);
export const PiDailyProvider = PiDailyCtx.Provider;

/**
 * ช่วงประเมินของ PI แยกจากตัวกรองรวมของหน้า (เจ้าของงานสั่ง 30 ก.ย. 2569 — เดิม PI ใช้ปี/เดือนของตัวกรองรวม
 * ตัวกรองรวมจึงถูกล็อกเดือนที่ Baseline ไม่ครบ และไม่เลือกปี = ประเมินแค่เดือนล่าสุด)
 * ค่าเดียวใช้ร่วมทุกกล่อง PI + คะแนนรวม (เจ้าของงานเลือก "ชุดเดียวคุมทุกกล่อง") · ปุ่มอยู่ทุกกล่อง กดกล่องไหนก็เปลี่ยนทั้งหมด
 * value.year ว่าง = เดือนล่าสุดของแต่ละไฟล์ (evalPeriod) · ตัวกรองอื่น (สาขา · ประเภทรถ ฯลฯ) ยังตามตัวกรองรวม
 * ไม่มี Provider (Executive Summary) = ไม่มีปุ่ม
 */
export interface PiPeriodCtl { value: Period; set: (p: Period) => void; trips: { y: number }[]; minStart?: string }
const PiPeriodCtx = createContext<PiPeriodCtl | null>(null);
export const PiPeriodProvider = PiPeriodCtx.Provider;

/** ปุ่ม "ช่วงประเมิน" ของกล่อง PI — กางแผงเลือก ปี → เดือน → วัน (ล็อกช่วงที่ Baseline ไม่ครบ 12 เดือน) ลอยใต้ปุ่ม */
function PiPeriodPick() {
  const ctl = useContext(PiPeriodCtx);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); window.removeEventListener("resize", close); };
  }, [at]);
  if (!ctl) return null;
  // บรรทัดหลัก + บรรทัดรอง แยกกัน ไม่ให้คำถูกตัดกลางคำในคอลัมน์แคบ (เจ้าของงานแจ้ง 30 ก.ย. 2569)
  const label = ctl.value.year ? periodLabel(ctl.value) : "ตามตัวกรองของหน้า";
  const sub = ctl.value.year ? "เทียบ Baseline 12 เดือน" : "ไม่เทียบ Baseline";
  const toggle = () => {
    if (at) return setAt(null);
    const r = btn.current!.getBoundingClientRect();
    // position absolute ใน #view-dash (เลื่อนหน้าแล้วแผงไปกับปุ่ม) — พิกัดหน้า = จอ + scroll
    setAt({ top: r.bottom + window.scrollY + 8, left: Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - 400) });
  };
  const host = document.getElementById("view-dash") ?? document.body;
  return <>
    <button type="button" ref={btn} className={"pi-pp" + (at ? " on" : "")} aria-expanded={!!at} onClick={toggle}
      title="เลือกช่วงประเมินของ Performance Index — ใช้ร่วมทุกกล่อง PI แยกจากตัวกรองของหน้า">
      <span>ช่วงประเมิน</span><b>{label} <i aria-hidden="true">▾</i></b><small>{sub}</small>
    </button>
    {at && createPortal(
      <div className="pi-pp-pop" ref={pop} style={{ top: at.top, left: Math.max(8, at.left) }} role="dialog" aria-label="ช่วงประเมิน Performance Index">
        <div className="pi-pp-h">ช่วงประเมิน Performance Index</div>
        <p className="pi-pp-note">ใช้ร่วมทุกกล่อง PI · ไม่เลือก = ตามตัวกรองของหน้า (ทุกปีได้) ไม่เทียบ Baseline เกณฑ์คิดจากช่วงนั้นเอง ·
          เลือกช่วง = เทียบ Baseline 12 เดือนก่อนเดือนแรกของช่วง (ช่วงที่ย้อนหลังไม่ครบ 12 เดือนเลือกไม่ได้)</p>
        <div className="dz-filters pi-pp-f">
          <PeriodFF trips={ctl.trips} value={ctl.value} onChange={ctl.set} days minStart={ctl.minStart} allLabel="ตามตัวกรองของหน้า" />
        </div>
        <button type="button" className="pi-pp-reset" disabled={!ctl.value.year} onClick={() => ctl.set(PERIOD_ALL)}>
          กลับไปตามตัวกรองของหน้า (ไม่เทียบ Baseline)</button>
      </div>, host)}
  </>;
}

/** ผลของทุกหมวดที่กล่องแจ้งขึ้นมา — DemoDash ถือไว้ให้บรรทัดคะแนนรวม */
export function usePiReports() {
  const [reports, setReports] = useState<Record<string, MetricResult[]>>({});
  const report = useCallback<Report>((id, results) => setReports((p) => {
    const a = p[id];
    // ค่าเท่าเดิมไม่ต้องสร้าง object ใหม่ — กัน render วนเมื่อผู้เรียกส่ง array ใหม่ที่ค่าเดิม
    // เทียบทั้งก้อน (จำนวนสี/ที่มา) ไม่ใช่แค่คะแนน — ป็อบอัพที่มาของคะแนนอ่านค่าพวกนี้ด้วย
    return a && JSON.stringify(a) === JSON.stringify(results) ? p : { ...p, [id]: results };
  }), []);
  return { reports, report };
}

/** ค่าของตัวชี้วัดหนึ่งตัว — "6.3/10" · "รอเกณฑ์" · "ไม่มีข้อมูล" */
function subValue(r: MetricResult): string {
  return r.pending ? "รอเกณฑ์" : r.score == null ? r.na ?? "ไม่มีข้อมูล" : `${sc(r.score)}/${METRIC_MAX}`;
}

/** หลอดคะแนน — เต็มหลอด = คะแนนเต็ม */
function Meter({ v, max, cls }: { v: number; max: number; cls: string }) {
  return <span className={cls} aria-hidden="true"><i style={{ width: `${Math.min(100, max ? v / max * 100 : 0)}%` }} /></span>;
}

/** tooltip บอกที่มาของคะแนน — จำนวนรายการแต่ละสี */
function subTitle(r: MetricResult): string | undefined {
  const t = r.tally;
  if (r.pending) return "ยังไม่มีเกณฑ์สีของตัวชี้วัดนี้";
  if (r.detail) return r.detail;
  if (!t || !t.n) return "ไม่มีรายการให้คิดคะแนนตามตัวกรองที่เลือก";
  return `เขียว ${fmt(t.g)} · เหลือง ${fmt(t.y)} · แดง ${fmt(t.r)} จาก ${fmt(t.n)} ${METRICS[r.key].unit}`
    + ` → (${fmt(t.g)} + 0.5 × ${fmt(t.y)}) ÷ ${fmt(t.n)} × ${METRIC_MAX}` + (r.basis ? `\nเกณฑ์: ${r.basis}` : "");
}

/** ช่วงที่ประเมินของหมวด — ตัวชี้วัดคนละไฟล์อาจเป็นคนละเดือน จึงรวมแบบไม่ซ้ำ */
const periodsOf = (results: MetricResult[]): string =>
  [...new Set(results.flatMap((r) => (r.period ? [r.period] : [])))].join(" · ");

/** ป้ายสถานะของหมวด (ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–14.99 · ไม่ผ่านเกณฑ์ < 10) — ทุกหมวด ตาม InDex_revised v2.md */
function StatusChip({ status }: { status: IndexStatus | null }) {
  if (!status) return null;
  return <i className={`pi-st ${status}`} title={`${STATUS_RANGE[status]} — ${STATUS_MEANING[status]}`}>{STATUS_LABEL[status]}</i>;
}

/**
 * กล่อง PI ของหมวด Fleet · Cost · Customer · Service — ตั้งแต่ 28 ก.ย. 2569 ใช้เลย์เอาต์แถวเดียวแบบ Route & Service ทุกหมวด
 * (เจ้าของงานสั่ง "performance index 2–5 ให้ทำตามแบบที่ 1") จึงส่งต่อให้ PiRow · note = คำอธิบายหลังปุ่ม i (ป้ายสถานะขึ้นทุกหมวดจาก indexStatus · InDex_revised v2.md)
 */
export function PiBox({ index, results, note }: { index: IndexDef; results: MetricResult[]; note?: string }) {
  return <PiRow index={index} results={results} note={note} />;
}

/** คำอธิบายเกณฑ์ใต้กล่อง — ซ่อนไว้หลังปุ่ม i กดแล้วกางลงมา (เจ้าของงานสั่ง 28 ก.ย. 2569 · เดิมโชว์ข้อความตลอด) */
function PiNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pi-note-w">
      <button type="button" className={"pi-info" + (open ? " on" : "")} aria-expanded={open}
        aria-label={open ? "ซ่อนคำอธิบาย" : "ดูคำอธิบายวิธีคิด"} title={open ? "ซ่อนคำอธิบาย" : "ดูคำอธิบายวิธีคิด"}
        onClick={() => setOpen((o) => !o)}>i</button>
      {open && <p className="pi-note">{text}</p>}
    </div>
  );
}

/** หมวดที่กล่องยังไม่ได้แจ้งผล (ยังไม่วาด/กำลังโหลด) — บรรทัดคะแนนรวมใช้แทนชั่วคราว */
const waitingOf = (index: IndexDef): MetricResult[] =>
  index.subs.map((key: MetricKey) => ({ key, pending: false, tally: null, score: null, na: "กำลังคำนวณ" }));

/**
 * Route & Service — %Margin รายเส้นทาง + 3 กลุ่มบริการ (lib/pi/route.ts) ชุดเดียวกับตาราง/การ์ดของ Profit Per Route
 * trips = เที่ยวที่กรองตามหน้าแล้ว · ref = ชุดอ้างอิง 12 เดือน (tripRefOf) · null = ไฟล์ต้นทุนยังไม่มี
 */
export const routePiResults = (trips: Trip[] | null, ref: TripRef | null, period?: string): MetricResult[] => [
  metricResult("route", trips ? routeMarginValues(trips) : null, ref && scopedRef(ref, routeMarginValues, "เส้นทาง"),
    trips && marginAll(trips)),
  // กลุ่มบริการ × เดือน (เจ้าของงานเลือก 28 ก.ย. 2569 · ยืนยัน 29 ก.ย. — Observation Unit ตาม Methodology เดิม) — 3 กลุ่มคิด percentile ไม่ได้ความหมาย
  metricResult("service", trips ? serviceMonthMarginValues(trips) : null, ref && scopedRef(ref, serviceMonthMarginValues, "กลุ่ม × เดือน", BRANCH_MIN_MONTHLY),
    trips && marginAll(trips.filter((t) => (SERVICE_GROUPS as readonly string[]).includes(t.sg)))),
].map((r) => withPeriod(r, period));
export function PiRoute({ trips, refs, period }: { trips: Trip[] | null; refs: TripRef | null; period?: string }) {
  const results = useMemo(() => routePiResults(trips, refs, period), [trips, refs, period]);
  return <PiRow index={INDEXES.route} results={results} />;
}

/** สูตรแทนค่าของตัวชี้วัดแบบนับสี — "(98 + 0.5×0) ÷ 114 × 10 = 8.6" */
function formulaText(r: MetricResult): string | null {
  const t = r.tally;
  if (!t || !t.n || r.score == null) return null;
  return `(${fmt(t.g)} + 0.5×${fmt(t.y)}) ÷ ${fmt(t.n)} × ${METRIC_MAX} = `;
}

/** ชื่อสี (ไทย) ของแถบ */
const BAND_NAME = { g: "เขียว", y: "เหลือง", r: "แดง" } as const;

/**
 * ความโปร่งใสของตัวชี้วัด (ข้อ 8 · 11 ของ Methodology 29 ก.ย. 2569): ช่วงประเมิน · Reference Baseline + Coverage ·
 * P25/P30/P70/P75 · Actual ของช่วงประเมิน → สี → ตีความดีขึ้น/แย่ลง (ตามทิศของ KPI)
 */
function Transparency({ r }: { r: MetricResult }) {
  return <>
    {r.period && <p><b>Evaluation:</b> {r.period}</p>}
    {r.baseline && <p><b>{r.baseline}</b></p>}
    {r.pcts && <p className="pi-pcts">P25 <b>{r.pcts.p25}</b> · P30 <b>{r.pcts.p30}</b> · P70 <b>{r.pcts.p70}</b> · P75 <b>{r.pcts.p75}</b></p>}
    {r.actual && <p className={`pi-act ${r.actual.band}`}>
      <i className={`pi-dm-dot ${r.actual.band}`} />Actual {r.actual.why} → {BAND_NAME[r.actual.band]} → {BAND_MEANING[r.actual.band]}
    </p>}
    {r.score == null && r.na && r.detail && <p className="pi-na">{r.na}: {r.detail}</p>}
  </>;
}

/**
 * คะแนนเทียบ Baseline หลังคะแนน (เจ้าของงานขอ 29 ก.ย. 2569): +1.1 เขียว ลูกศรชี้ขึ้นขวา · −0.8 แดง ลูกศรชี้ลงขวา · ±0 เทา
 * ปัดทศนิยม 1 ตำแหน่งก่อนตัดสินสี — ต่างกันไม่ถึง 0.05 นับเป็น 0
 */
function Delta({ v }: { v: number | null }) {
  if (v == null) return null;
  const d = Math.round(v * 10) / 10;
  const k = d > 0 ? "up" : d < 0 ? "down" : "flat";
  const txt = d > 0 ? `+${d.toFixed(1)}` : d < 0 ? `−${Math.abs(d).toFixed(1)}` : "±0.0";
  return (
    <span className={`pi-delta ${k}`} title="คะแนนเทียบกับคะแนน Baseline (12 เดือนก่อนช่วงประเมิน)">
      {k !== "flat" && <svg viewBox="0 0 12 12" aria-hidden="true">
        {k === "up" ? <path d="M2.5 9.5 9.5 2.5M4 2.5h5.5V8" /> : <path d="M2.5 2.5 9.5 9.5M4 9.5h5.5V4" />}
      </svg>}
      {txt}
    </span>
  );
}

/** คะแนนตอนนี้ − คะแนน Baseline ของตัวชี้วัด · ไม่มีตัวใดตัวหนึ่ง = null */
const deltaOf = (r: MetricResult): number | null =>
  (r.score != null && r.base?.score != null ? r.score - r.base.score : null);

/** ป็อบอัพคะแนน Baseline: บรรทัดแรกช่วง "ปีก่อนหน้า …" · บรรทัดสอง xx/10 (คะแนน Baseline) */
function PiBaseModal({ r, onClose }: { r: MetricResult; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  const b = r.base!;
  const t = b.tally;
  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal pi-bm" role="dialog" aria-modal="true" aria-label={`คะแนน Baseline ของ ${METRICS[r.key].label}`}>
        <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        <div className="pi-bm-k">{METRICS[r.key].label}</div>
        <p className="pi-bm-p">{b.period}</p>
        <p className="pi-bm-s">{b.score == null ? <b>{r.na ?? "ไม่มีข้อมูล"}</b> : <><b>{sc(b.score)}/{METRIC_MAX}</b> (คะแนน Baseline)</>}</p>
        {t && t.n > 0 && <p className="pi-bm-n">
          เขียว {fmt(t.g)} · เหลือง {fmt(t.y)} · แดง {fmt(t.r)} จาก {fmt(t.n)} {METRICS[r.key].unit} ใน Baseline
          — ให้สีด้วยเกณฑ์ของ Baseline เอง</p>}
      </div>
    </div>, host);
}

/** ย่อตัวอักษรได้ไม่ต่ำกว่า 70% ของขนาดเดิม — เล็กกว่านี้อ่านยาก ให้ขึ้นบรรทัดใหม่ขนาดเดิมแทน */
const FIT_MIN = 0.7;
/**
 * หัวตัวชี้วัด (ชื่อ · คะแนน · +/−) ให้อยู่บรรทัดเดียว (เจ้าของงานขอ 29 ก.ย. 2569): ไม่พอ = ย่อตัวอักษรทีละ 5%
 * ถึง FIT_MIN ยังไม่พอ (เช่น ชื่อยาวแบบ DSO) = กลับขนาดเดิมแล้วขึ้นบรรทัดใหม่ · คิดใหม่เมื่อกล่องเปลี่ยนความกว้าง
 * ขนาดเดิมอ่านจาก CSS (มี media query) — ล้าง inline ก่อนวัดทุกครั้ง
 */
function useFitLine<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parts = [...el.children] as HTMLElement[];
    const fit = () => {
      for (const p of parts) p.style.fontSize = "";
      el.classList.add("one");
      const base = parts.map((p) => parseFloat(getComputedStyle(p).fontSize));
      for (let k = 1; k >= FIT_MIN - 1e-9; k -= 0.05) {
        parts.forEach((p, i) => { p.style.fontSize = k < 1 ? `${base[i]! * k}px` : ""; });
        if (el.scrollWidth <= el.clientWidth + 1) return;
      }
      for (const p of parts) p.style.fontSize = "";
      el.classList.remove("one");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return ref;
}

/** คอลัมน์ของตัวชี้วัดหนึ่งตัวในกล่องแถวเดียว — คะแนน · แถบสี · จำนวนสี · ปุ่ม "รายละเอียด" กางวิธีคิด */
function PiRowMetric({ r }: { r: MetricResult }) {
  const [open, setOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const closeBase = useCallback(() => setBaseOpen(false), []);
  const def = METRICS[r.key];
  const t = r.tally;
  const f = formulaText(r);
  const share = (n: number) => (t && t.n ? ` (${(n / t.n * 100).toFixed(1)}%)` : "");
  const headRef = useFitLine<HTMLDivElement>(`${def.label}|${subValue(r)}|${deltaOf(r)}`);
  return (
    <div className={"pi-rm" + (r.score == null ? " na" : "")} title={subTitle(r)}>
      {/* หัว (ชื่อ · คะแนน · ป้าย Baseline) แยกกล่อง — CSS subgrid ให้หัวทุกคอลัมน์สูงเท่ากัน แถบสีจึงอยู่แนวเดียวกัน (29 ก.ย. 2569) */}
      <div className="pi-rm-top">
      <div className="pi-rm-h" ref={headRef}><span>{r.tone && <i className={`pi-tone ${r.tone}`} aria-hidden="true" />}{def.label}</span>
        <b>{subValue(r)}<Delta v={deltaOf(r)} /></b></div>
      {r.scope && <span className={"pi-scope" + (r.scope.startsWith("ระดับสาขา") ? " br" : "")} title={r.scope}>
        Baseline {r.scope.startsWith("ระดับสาขา") ? "สาขา" : "บริษัท"}{r.scope.includes("ไม่ถึง") || r.scope.includes("ไม่มีสาขา") ? " *" : ""}</span>}
      </div>
      <div className="pi-rm-body">
      {t && t.n ? <>
        <span className="pi-rm-stack" aria-hidden="true">
          {BAND_TXT.map(([k]) => (t[k] ? <i key={k} className={k} style={{ flexGrow: t[k] }} /> : null))}
        </span>
        <span className="pi-rm-count lines">
          {BAND_TXT.map(([k, name]) => <span key={k}><i className={`pi-dm-dot ${k}`} />{name} {fmt(t[k])}{share(t[k])}</span>)}
          <span>จาก {fmt(t.n)} {def.unit}</span>
        </span>
      </> : <span className="pi-rm-count">{r.detail ?? (r.pending ? "ยังไม่มีเกณฑ์" : r.na ?? "ไม่มีรายการให้คิดตามตัวกรองที่เลือก")}</span>}
      <div className="pi-rm-btns">
        <button type="button" className="pi-rm-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          รายละเอียด
        </button>
        {r.base && <button type="button" className="pi-rm-more" onClick={() => setBaseOpen(true)}>คะแนน Baseline</button>}
      </div>
      {baseOpen && r.base && <PiBaseModal r={r} onClose={closeBase} />}
      {open && (
        <div className="pi-rm-detail">
          <p>{def.measure} เกณฑ์: เขียว {def.criteria[0]}, เหลือง {def.criteria[1]}, แดง {def.criteria[2]}.</p>
          <Transparency r={r} />
          {f && <p>คะแนน = {f}<b>{sc(r.score!)}</b></p>}
        </div>
      )}
      </div>
    </div>
  );
}

/**
 * กล่อง PI แบบแถวเดียว (Route & Service ท้าย Profit Per Route · เจ้าของงานสั่ง 28 ก.ย. 2569):
 * กล่องคะแนน x/20 สั้น ๆ ซ้าย + ตัวชี้วัดเรียงไปทางขวา คอลัมน์ละตัว · ปุ่ม "รายละเอียด" กางวิธีคิดคะแนน
 * แจ้งผลขึ้นบรรทัดคะแนนรวมเหมือน PiBox (หมวดอื่นยังใช้ PiBox)
 */
export function PiRow({ index, results: raw, note }: { index: IndexDef; results: MetricResult[]; note?: string }) {
  const report = useContext(PiReportCtx);
  const daily = useContext(PiDailyCtx);
  const results = useMemo(() => (daily ? raw.map(asDaily) : raw), [daily, raw]);
  useEffect(() => { report?.(index.id, results); }, [report, index.id, results]);
  const full = index.subs.length * METRIC_MAX;
  const { score, max } = sumScores(results);
  // หมวดเทียบ Baseline เมื่อทุกตัวที่มีคะแนนมีคะแนน Baseline ด้วย (ฐานเดียวกัน) — ไม่งั้นไม่แสดง
  const scored = results.filter((r) => r.score != null);
  const catDelta = scored.length && scored.every((r) => deltaOf(r) != null)
    ? scored.reduce((s, r) => s + deltaOf(r)!, 0) : null;
  return (
    <section id={`pi-box-${index.id}`} className={`pi-box pi-row t-${index.id}`}>
      <div className="pi-row-sc">
        <h4 className="pi-t">{index.title} <small className="pi-bsc">{index.bsc}</small></h4>
        <StatusChip status={indexStatus(results)} />
        <div className="pi-score"><b>{max ? sc(score) : "–"}</b><span>/{full}{max > 0 && <PctOf v={score} full={full} />}</span><Delta v={catDelta} /></div>
        <Meter v={score} max={full} cls="pi-meter" />
        {daily ? <em className="pi-row-part">{DAILY_NA}</em>
          : max > 0 && max < full && <em className="pi-row-part">คิดได้ {max} จาก {full}</em>}
        <PiPeriodPick />
        {periodsOf(results) && <em className="pi-row-part">ประเมิน: {periodsOf(results)}</em>}
        {note && <PiNote text={note} />}
      </div>
      {results.map((r) => <PiRowMetric key={r.key} r={r} />)}
    </section>
  );
}

/**
 * Service Quality = Damage Performance — ให้สี DR / DIR รายเดือนด้วย P25/P75 แล้วนับสี (เจ้าของงานเลือก 1 ต.ค. 2569 · lib/pi/damage.ts)
 *   Current KPI ตามตัวกรอง ปี / ช่วงเดือน / วันที่ / สาขา เท่านั้น (ตัวกรองอื่นของหน้าไม่มีผล — ไฟล์กำหนด) ·
 *   ชุดอ้างอิง P25/P75 = KPI รายเดือนของทั้งบริษัท (ไม่ตามสาขา) ในช่วง Reference Baseline · ไม่เทียบ Baseline = ช่วงที่เลือกเอง
 *   นับเที่ยวที่จับคู่บิลได้ + เที่ยววิ่งเปล่า (inProfitScope · เจ้าของงานสั่ง 1 ต.ค. 2569) ตัวหารเดียวกับแท็บ Damage
 */
/** ตัวกรองของ Damage = เฉพาะเวลา + สาขาจากตัวกรองของ PI */
export const damageFilterOf = (f: DemoFilter): DemoFilter =>
  ({ ...DEMO_F0, year: f.year, from: f.from, to: f.to, d1: f.d1, d2: f.d2, br: f.br, noBase: f.noBase });
/** ชุดอ้างอิงของ Damage — ทั้งบริษัทเสมอ (ไม่ใช้ Baseline ระดับสาขา) */
export const serviceRef = (ref: TripRef | null): DamageRef | null => {
  if (!ref) return null;
  const base = ref.trips.filter(inProfitScope);
  if (ref.self) {
    const d = damageRef(base, null);
    return { ...d, ref: selfRefSet(d.dirValues, "เดือน") };
  }
  return damageRef(base, ref.b, "ระดับบริษัท");
};
export const servicePiResults = (trips: Trip[] | null, ref: DamageRef | null, period?: string): MetricResult[] =>
  (trips && ref ? damageResults(trips.filter(inProfitScope), ref)
    : INDEXES.service.subs.map((key): MetricResult => ({ key, pending: false, tally: null, score: null }))).map((r) => withPeriod(r, period));
/** all = ทุกเที่ยวในชุดกำไร (ไม่กรอง) · f = ตัวกรองของ PI (piF) — ใช้แค่เวลา + สาขา */
export function damagePiResults(all: Trip[] | null, f: DemoFilter): { results: MetricResult[]; ref: DamageRef | null } {
  if (!all) return { results: servicePiResults(null, null), ref: null };
  const df = damageFilterOf(f);
  const ev = tripEvalOf(all, df);
  const ref = serviceRef(tripRefOf(all, { ...df, br: "" }));
  return { results: servicePiResults(ev.trips, ref, ev.label), ref };
}
export function PiService({ all, f }: { all: Trip[] | null; f: DemoFilter }) {
  const { results, ref } = useMemo(() => damagePiResults(all, f), [all, f]);
  const note = ref && ref.p25Dr != null
    ? `ให้สีรายเดือน ≤ P25 เขียว · P25 – P75 เหลือง · > P75 แดง แล้วนับสี · P25/P75 จาก KPI รายเดือนของทั้งบริษัท (${ref.ref.label}):`
      + ` Damage Rate ${ref.p25Dr.toFixed(3)}% / ${ref.p75Dr == null ? "–" : `${ref.p75Dr.toFixed(3)}%`}`
      + ` · Damage Incidence Rate ${ref.p25Dir == null ? "–" : `${ref.p25Dir.toFixed(2)}%`} / ${ref.p75Dir == null ? "–" : `${ref.p75Dir.toFixed(2)}%`}`
      + " · ตามตัวกรอง ปี / ช่วงเดือน / วันที่ / สาขา เท่านั้น"
    : undefined;
  return <PiBox index={INDEXES.service} results={results} note={note} />;
}

/**
 * Fleet & Trip — Load Factor = Max LF รายเที่ยวของไฟล์ LF ตามตัวกรองเดียวกับกล่อง LF ของ Inefficient Transportation Cost
 *   Empty Return = เกณฑ์ของแท็บ Empty Trips (lib/pi/empty.ts) · all = ทุกเที่ยวในชุดกำไร (ยังไม่กรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   ให้สีตามตัวกรองของหน้า**ยกเว้นกลุ่มบริการ** (เที่ยวเปล่าไม่มีกลุ่มบริการ เลือกแล้วเที่ยวเปล่าหายหมด = เขียวทุกเส้นทาง)
 *   P25/P75 ไม่ตามต้นทาง/ปลายทาง กติกาเดียวกับแท็บ Empty Trips
 */
export function lfPiResult(lf: LfData | null, f: DemoFilter): MetricResult {
  if (!lf) return metricResult("lf", null);
  if (f.noBase) {
    const vals = lf.trips.filter((t) => passLfDemo(t, f)).map((t) => t.lf);
    const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    return withPeriod(metricResult("lf", vals, selfRefSet(vals, "เที่ยว"), mean), noBaseLabel(f));
  }
  // Baseline = 12 เดือนก่อนเดือนที่ประเมินของไฟล์ Load Factor (ไฟล์ LF มีช่วงเดือนของตัวเอง) · ระดับบริษัท ไม่ตามตัวกรอง
  // ไฟล์ LF ที่ยังไม่มีวันที่ = เทียบรายเดือน (inRange "inside")
  const mos = lf.trips.map((t) => t.mo);
  const ev = evalRange(f, mos);
  if (!ev) return metricResult("lf", null);
  const b = baselineOf(ev, firstDay(lf.trips), mos);
  const ref = lf.trips.filter((t) => inRange(t, b, "inside")).map((t) => t.lf);
  const pf = evalPeriod(f, mos);
  const vals = lf.trips.filter((t) => passLfDemo(t, pf)).map((t) => t.lf);
  const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  // ไฟล์ LF ไม่มีสาขา — Baseline ระดับบริษัทเสมอ (ช่วงประเมินก็ไม่ได้กรองสาขา)
  return withPeriod(metricResult("lf", vals, refSet(ref, "เที่ยว", b, false,
    f.br ? "ระดับบริษัท (ไฟล์ Load Factor ไม่มีสาขา)" : "ระดับบริษัท"), mean), periodLabel(pf));
}
/** all = ทุกเที่ยวในชุดกำไร (ไม่กรอง) · ให้สีตามตัวกรองยกเว้นกลุ่มบริการ · P25/P75 จาก 12 เดือนล่าสุดตามตัวกรองยกเว้นเวลาและกลุ่มบริการ */
export function emptyPiResult(all: Trip[] | null, f: DemoFilter): MetricResult {
  if (!all) return emptyResult(null, null, null);
  if (f.noBase) {
    const ev = tripEvalOf(all, { ...f, sg: "" });
    return withPeriod(emptyResult(ev.trips, ev.trips, selfRefSet(routeRates(ev.trips).map((r) => r.pct), "เส้นทาง")), ev.label);
  }
  const ref = tripRefOf(all, f);
  const ev = tripEvalOf(all, { ...f, sg: "" });
  const rates = (ts: Trip[]) => routeRates(ts).map((r) => r.pct);
  const sv = scopedValues(rates(ref.trips), ref.branch && rates(ref.branch), ref.br, "เส้นทาง");
  const useBranch = !!ref.branch && sv.scope.startsWith("ระดับสาขา");
  const rs = refSet(sv.values, "เส้นทาง", ref.b, false, sv.scope);
  return withPeriod(emptyResult(ev.trips, useBranch ? ref.branch! : ref.trips, rs), ev.label);
}
export function PiFleet({ f, all }: { f: DemoFilter; all: Trip[] | null }) {
  const { data: lf, error } = useLoadFactor();
  const lfResult = useMemo(() => lfPiResult(error ? null : lf, f), [lf, error, f]);
  const empty = useMemo(() => emptyPiResult(all, f), [all, f]);
  const results = useMemo(() => [lfResult, empty], [lfResult, empty]);
  return <PiBox index={INDEXES.fleet} results={results} />;
}

/**
 * Cost & Vehicle — รายคัน (VRow) ชุดเดียวกับหน้า "รายละเอียด ข้อ 3"
 *   Cost per Ton-km = VRow.perTkm (คันที่ไม่มีน้ำหนัก/ระยะทางไม่นับ) · Coverage = Contribution ÷ ค่าเสื่อม ของ depreciation()
 *   (รถบริษัทที่มีค่าเสื่อมเท่านั้น) · trips null = ไฟล์ต้นทุนยังไม่มี
 */
/** รายการ = คัน × เดือน (lib/pi/cost.ts · เจ้าของงานเลือก 28 ก.ย. 2569 — เดิมรายคันในแต่ละใบ) */
export function costPiResults(trips: Trip[] | null, ref: TripRef | null, period?: string): MetricResult[] {
  if (!trips) return [metricResult("tkm", null), metricResult("coverage", null)];
  const rows = vehicleRows(trips);
  const refRows = ref ? vehicleRows(ref.trips) : null;
  const branchRows = ref?.branch ? vehicleRows(ref.branch) : null;
  const sref = (f: (r: VRow[]) => number[]) => {
    if (ref!.self) return selfRefSet(f(refRows!), "คัน × เดือน");
    const sv = scopedValues(f(refRows!), branchRows && f(branchRows), ref!.br, "คัน × เดือน");
    return refSet(sv.values, "คัน × เดือน", ref!.b, false, sv.scope);
  };
  // Actual = ค่ารวมของช่วงประเมิน (ตีความอย่างเดียว) — Σต้นทุน ÷ Σตัน-กม. · ΣCM ÷ Σค่าเสื่อม (กติกาเดียวกับ lib/pi/cost.ts)
  let cost = 0, tkm = 0, cm = 0, dep = 0;
  for (const r of rows) {
    if (r.tkm > 0 && r.cost > 0) { cost += r.cost; tkm += r.tkm; }
    if (r.side === "comp" && r.dep > 0) { cm += r.rev - (r.cost - r.dep); dep += r.dep; }
  }
  return [
    metricResult("tkm", tkmByVehicleMonth(rows), refRows && sref(tkmByVehicleMonth), tkm ? cost / tkm : null),
    metricResult("coverage", coverageByVehicleMonth(rows), refRows && sref(coverageByVehicleMonth), dep ? cm / dep : null),
  ].map((r) => withPeriod(r, period));
}
export function PiCost({ trips, refs, period }: { trips: Trip[] | null; refs: TripRef | null; period?: string }) {
  const results = useMemo(() => costPiResults(trips, refs, period), [trips, refs, period]);
  return <PiBox index={INDEXES.cost} results={results} />;
}

/**
 * การ์ด Damage Rate ข้างกล่อง Service Quality — ใบเดียวกับการ์ดแรกของแท็บ Damage Rate ใน Executive Dashboard
 * นับเที่ยวที่จับคู่บิลได้ + เที่ยววิ่งเปล่า (ตัวหารเดียวกับแท็บนั้น) · ตามตัวกรองของหน้า Demo
 */
export function DamageRateBox({ trips }: { trips: Trip[] | null }) {
  const kpi = useMemo(() => (trips ? totalDamage(trips.filter(inProfitScope)) : null), [trips]);
  // 4 ตัวเลขชุดเดียวกับหัวแท็บ Damage Rate ของ Overall Dashboard (DamageTab.tsx) รวมในกล่องแดงกล่องเดียว เรียงบนลงล่าง
  // (เจ้าของงานสั่ง 28 ก.ย. 2569 — รุ่นแรกเป็น 4 การ์ด 2×2 แยกสี)
  const rows: { l: string; v: string; s: string }[] = [
    { l: "Damage Rate", v: kpi?.rate == null ? "–" : pct(kpi.rate, 3), s: kpi ? "มูลค่าบิลเคลียร์ ÷ รายได้รวม" : "ยังไม่มีไฟล์ต้นทุน" },
    { l: "Damage Incidence Rate", v: kpi ? pct(kpi.incidence, 2) : "–", s: "เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด" },
    { l: "มูลค่าบิลเคลียร์", v: kpi ? fmt(kpi.clrAmt, 2) : "–", s: "บาท · มูลค่าความเสียหาย" },
    { l: "จำนวนเที่ยวที่มีบิลเคลียร์", v: kpi ? fmt(kpi.dmgTrips) : "–", s: "เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" },
  ];
  return (
    // กดทั้งกล่อง = เปิดแท็บ Damage Rate ของ Overall Dashboard (เจ้าของงานสั่ง 29 ก.ย. 2569 · ปุ่ม C กลับจุดเดิมได้เหมือนกล่องลิงก์อื่น)
    <div className="dz-kc hero loss pi-dmg4 clickable" role="link" tabIndex={0} title="ดูรายละเอียดที่ Overall Dashboard › Damage Rate"
      onClick={() => openExecTab("damage")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openExecTab("damage"); } }}>
      <img className="pi-dmg-art" src={imgDamageBox} alt="" aria-hidden="true" />
      {rows.map((r) => (
        <div className="pi-dmg-row" key={r.l}>
          <div className="pi-dmg-l">{r.l}</div>
          <div className="pi-dmg-v num-fd" key={r.v}>{r.v}</div>
          <div className="pi-dmg-s">{r.s}</div>
        </div>
      ))}
    </div>
  );
}

/** บรรทัดสุดท้าย — คะแนนรวม XX/100 พร้อมฐานที่คิดได้และตัวชี้วัดที่ยังขาด · กดทั้งกล่อง = ป็อบอัพที่มาของคะแนน */
/** เลื่อนไปกล่อง Index ในหน้า (id = pi-box-<หมวด>) แล้วกระพริบให้เห็นว่าคือกล่องไหน */
export function jumpToIndex(id: string): void {
  const el = document.getElementById(`pi-box-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.remove("pi-flash");
  void el.offsetWidth;
  el.classList.add("pi-flash");
  window.setTimeout(() => el.classList.remove("pi-flash"), 1800);
}

export function PiTotal({ reports }: { reports: Record<string, MetricResult[]> }) {
  const [open, setOpen] = useState(false);
  const groups = Object.values(INDEXES).map((ix) => ({ index: ix as IndexDef, results: reports[ix.id] ?? waitingOf(ix) }));
  const all = groups.flatMap((g) => g.results);
  const { score, max } = sumScores(all);
  const pending = all.filter((r) => r.pending).map((r) => METRICS[r.key].label);
  const daily = all.some((r) => r.daily);
  const noData = all.filter((r) => !r.pending && r.score == null).map((r) => METRICS[r.key].label);
  // Baseline ของไฟล์ต้นทุน (ตัวชี้วัดส่วนใหญ่) — ตัดจำนวนรายการท้ายข้อความออก
  const baseLabel = (reports[INDEXES.route.id]?.[0]?.baseline ?? "").split(" · ").slice(0, 2).join(" · ");
  return (
    <>
      <div className="pi-total-pp"><PiPeriodPick /></div>
      <section className="pi-total">
        {/* ส่วนบน (ชื่อ · คะแนน · แถบ) กดแล้วเปิดที่มาของคะแนน · กล่อง 5 หมวดข้างล่างเป็นปุ่มแยก — ห้ามซ้อนปุ่มในปุ่ม */}
        <div className="pi-total-main pi-click" role="button" tabIndex={0} aria-haspopup="dialog"
          title="กดเพื่อดูว่าคะแนนแต่ละตัวชี้วัดมาจากไหน" onClick={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}>
        <div className="pi-head">
          <span className="pi-total-l">คะแนนรวม Performance Index</span>
          <i className="pi-more">ดูที่มาของคะแนน ↗</i>
        </div>
        <div className="pi-score">
          <b>{max ? sc(score) : "–"}</b><span>/{TOTAL_MAX} คะแนน</span>
          {max > 0 && <i className={`pi-st pi-total-status ${score < 50 ? "fail" : score < 75 ? "watch" : "pass"}`}>
            {score < 50 ? "ไม่ผ่านเกณฑ์" : score < 75 ? "เฝ้าระวัง" : "ผ่านเกณฑ์"}
          </i>}
        </div>
        <Meter v={score} max={TOTAL_MAX} cls="pi-meter" />
        <p className="pi-note pi-bl">{baseLabel.startsWith("ไม่เทียบ Baseline")
          ? <>ไม่เทียบ Baseline — เกณฑ์ percentile คิดจากรายการในช่วงของตัวกรองหน้า · เลือก "ช่วงประเมิน" เพื่อเทียบ Baseline 12 เดือน</>
          : <>{BASELINE_TITLE}{baseLabel && <> · {baseLabel}</>}</>}</p>
        {daily ? <p className="pi-note"><b>{DAILY_NA}</b> — ช่วงที่เลือกไม่เต็มเดือน (Daily View) ใช้ติดตามงาน · สี/Actual ยังดูได้ในแต่ละกล่อง ·
          เลือกทั้งเดือนหรือหลายเดือนเต็มเพื่อดูคะแนน Performance Index</p>
        : max < TOTAL_MAX && (
          <p className="pi-note">
            คิดได้ {max} จาก {TOTAL_MAX} คะแนน
            {pending.length > 0 && <> · รอเกณฑ์: {pending.join(" · ")}</>}
            {noData.length > 0 && <> · ไม่มีข้อมูล: {noData.join(" · ")}</>}
          </p>
        )}
        </div>
        {/* กล่องคะแนนรายหมวด — กดแล้วเลื่อนขึ้นไปกล่อง Index นั้นในส่วนของมัน (เจ้าของงานขอ 28 ก.ย. 2569) */}
        <div className="pi-jumps">
          {groups.map((g, i) => {
            const full = g.index.subs.length * METRIC_MAX;
            const r = sumScores(g.results);
            return (
              <button key={g.index.id} type="button" className="pi-jump" onClick={() => jumpToIndex(g.index.id)}
                title={`ไปที่ ${g.index.title}`}>
                <span className="pi-jump-h"><i>{i + 1}</i>{g.index.title}</span>
                {/* คะแนน + ป้ายสถานะต่อท้ายตัวเลข (ชุดเดียวกับกล่อง Index ของหมวด · เจ้าของงานสั่ง 29 ก.ย. 2569) */}
                <span className="pi-jump-row">
                  <span className="pi-jump-sc"><b>{r.max ? sc(r.score) : "–"}</b>/{full}{r.max > 0 && <PctOf v={r.score} full={full} />}</span>
                  <StatusChip status={indexStatus(g.results)} />
                </span>
                <Meter v={r.score} max={full} cls="pi-bar" />
              </button>
            );
          })}
        </div>
      </section>
      {open && <PiDetailModal groups={groups} score={score} max={max} onClose={() => setOpen(false)} />}
    </>
  );
}

const BAND_TXT = [["g", "เขียว", "1 คะแนน"], ["y", "เหลือง", "0.5 คะแนน"], ["r", "แดง", "0 คะแนน"]] as const;

/** ที่มาของคะแนนตัวชี้วัดหนึ่งตัว — ค่าที่วัด · ข้อมูลที่ใช้ · เกณฑ์สี · จำนวนแต่ละสี · สูตรแทนค่า */
function MetricDetail({ r }: { r: MetricResult }) {
  const def = METRICS[r.key];
  const t = r.tally;
  return (
    <div className="pi-dm-m">
      <div className="pi-dm-mh">
        <b>{def.label}</b>
        <span className={"pi-dm-sc" + (r.score == null ? " na" : "")}>{subValue(r)}</span>
      </div>
      <dl className="pi-dm-dl">
        <dt>วัดอะไร</dt><dd>{def.measure}</dd>
        <dt>ข้อมูล</dt><dd>{def.source}</dd>
        <dt>Evaluation</dt><dd>{r.period ?? "–"}</dd>
        <dt>Baseline</dt><dd>{r.baseline ?? "–"}
          {r.pcts && <span className="pi-dm-basis">P25 {r.pcts.p25} · P30 {r.pcts.p30} · P70 {r.pcts.p70} · P75 {r.pcts.p75}</span>}</dd>
        <dt>Actual</dt><dd>{r.actual
          ? <span className={`pi-act ${r.actual.band}`}><i className={`pi-dm-dot ${r.actual.band}`} />{r.actual.why} → {BAND_NAME[r.actual.band]} → {BAND_MEANING[r.actual.band]}</span>
          : "–"}</dd>
        <dt>เกณฑ์</dt>
        <dd><span className="pi-dm-crit">{def.criteria.map((c, i) => (
              <span key={i} className={`pi-dm-chip ${BAND_TXT[i]![0]}`}><i />{c}</span>))}</span>
          {r.basis && <span className="pi-dm-basis">{r.basis}</span>}
        </dd>
        <dt>คะแนน</dt>
        <dd>{t && t.n ? (
          <>
            <span className="pi-dm-stack" aria-hidden="true">
              {BAND_TXT.map(([k]) => (t[k] ? <i key={k} className={k} style={{ flexGrow: t[k] }} /> : null))}
            </span>
            <span className="pi-dm-count">
              {BAND_TXT.map(([k, name]) => <span key={k}><i className={`pi-dm-dot ${k}`} />{name} {fmt(t[k])}</span>)}
              <span>จาก {fmt(t.n)} {def.unit}</span>
            </span>
            <span className="pi-dm-f">
              ({fmt(t.g)} + 0.5 × {fmt(t.y)}) ÷ {fmt(t.n)} × {METRIC_MAX} = <b>{sc(r.score!)}</b>
            </span>
          </>
        ) : r.detail ? <span className="pi-dm-f">{r.detail}</span>
          : r.pending ? "ยังไม่มีเกณฑ์ — ไม่นับเข้าคะแนนรวม"
          : `${r.na ?? "ไม่มีข้อมูล"} — ไม่มีรายการให้คิดตามตัวกรองที่เลือก จึงไม่นับเข้าฐานของคะแนนรวม`}</dd>
      </dl>
    </div>
  );
}

/**
 * ป็อบอัพที่มาของคะแนน Performance Index (เจ้าของงานขอ 25 ก.ย. 2569) — ทุกหมวด ทุกตัวชี้วัด อ่านจากผลที่กล่องแจ้งขึ้นมา
 * ไม่คิดซ้ำ · ★ portal ไป #view-dash ไม่ใช่ body (โทเคนสีของแดชบอร์ดอยู่ใต้ #view-dash เท่านั้น — ดู TripsModal)
 */
/** เอกสารอ้างอิงของหลักการ (InDex_revised v2.md) */
const PI_REFS = [
  "กองโลจิสติกส์ กรมส่งเสริมอุตสาหกรรม กระทรวงอุตสาหกรรม. (2564). Industrial Logistics Performance Index (ILPI). https://dol.dip.go.th/uploadcontent/DOL/Phoom/ILPI64.pdf",
  "American Productivity & Quality Center. (n.d.). Open Standards Benchmarking. https://www.apqc.org/what-we-do/benchmarking/open-standards-benchmarking",
  "Kaplan, R. S., & Cooper, R. (1998). Cost & effect: Using integrated cost systems to drive profitability and performance. Harvard Business School Press.",
  "Kaplan, R. S., & Norton, D. P. (1992). The balanced scorecard—Measures that drive performance. Harvard Business Review, 70(1), 71–79.",
  "Nardo, M., Saisana, M., Saltelli, A., Tarantola, S., Hoffmann, A., & Giovannini, E. (2008). Handbook on constructing composite indicators: Methodology and user guide. OECD Publishing.",
];

/** หลักการ · เกณฑ์สถานะของหมวด · เอกสารอ้างอิง — ท้ายป็อบอัพที่มาของคะแนน (เจ้าของงานเลือก 28 ก.ย. 2569 · ย่อจาก InDex_revised v2.md) */
function PiMethod() {
  const statuses: IndexStatus[] = ["pass", "watch", "fail"];
  return (
    <section className="pi-dm-method">
      <h4>หลักการของ Performance Index</h4>
      <ul>
        <li><b>Balanced Scorecard</b> (Kaplan & Norton, 1992) — 3 มุมมอง Financial · Customer · Internal Process
          (ไม่รวมมุมมองนวัตกรรมและการเรียนรู้เพราะข้อจำกัดด้านข้อมูล) · โครงสร้าง 5 หมวดอ้างอิงเบื้องต้นจาก ILPI/SCPI ปี 2564
          แต่เกณฑ์คะแนนประยุกต์กับข้อมูลจริงของบริษัท ไม่ได้ใช้มาตรฐานอุตสาหกรรมทั้งหมด</li>
        <li><b>Traffic Light Assessment</b> — 🟢 ผ่านเกณฑ์ · 🟡 ต้องเฝ้าระวัง · 🔴 ต่ำกว่าเกณฑ์ ·
          คะแนนตัวชี้วัด = (เขียว + 0.5 × เหลือง) ÷ จำนวนรายการ × 10</li>
        <li><b>เกณฑ์เปรียบเทียบภายใน (Internal Benchmark)</b> ตามแนวทาง Open Standards Benchmarking ของ APQC —
          P25 · P30 · P70 · P75 คิดจาก <b>Reference Baseline = 12 เดือนปฏิทินก่อนเดือนที่ประเมิน (Rolling 12 Months)</b>
          เลือกสาขาและมีข้อมูลถึงขั้นต่ำใช้เกณฑ์ของสาขา หากไม่ถึงหรือไฟล์ไม่มีสาขาใช้ระดับบริษัทตามป้ายของตัวชี้วัด
          ตัวกรองอื่นไม่เปลี่ยน Baseline แล้วใช้เทียบกับช่วงที่ประเมิน — ห้ามคิดจากช่วงที่กำลังประเมินเอง
          (ถ้าใช้ชุดเดียวกัน สัดส่วนจะเป็น 🟢 25% · 🟡 50% · 🔴 25% เสมอ คะแนนติดที่ราว 5/10) · คะแนนจึงตอบได้ว่าผลงาน
          <b>ดีขึ้นหรือแย่ลงเมื่อเทียบกับอดีต</b> ของบริษัทเอง ไม่ใช่มาตรฐานอุตสาหกรรม · ไฟล์ย้อนหลังไม่ครบ 12 เดือน = N/A
          (ยกเว้น DSO ใช้เท่าที่มี) · เดือนที่ไม่มีข้อมูลไม่เติม 0 แสดง Coverage แทน</li>
        <li><b>Equal Weighting</b> (OECD; Nardo et al., 2008) — ทุกหมวดน้ำหนักเท่ากันหมวดละ 20 คะแนน รวม 100</li>
      </ul>
      <table className="pi-dm-sum pi-dm-status">
        <thead><tr><th>ช่วงคะแนนของหมวด</th><th>สถานะ</th><th>ความหมาย</th></tr></thead>
        <tbody>{statuses.map((st) => (
          <tr key={st}><td>{STATUS_RANGE[st]}</td><td><i className={`pi-dm-st ${st}`}>{STATUS_LABEL[st]}</i></td><td>{STATUS_MEANING[st]}</td></tr>
        ))}</tbody>
      </table>
      <h4>เอกสารอ้างอิง</h4>
      <ol className="pi-dm-refs">{PI_REFS.map((r) => <li key={r}>{r}</li>)}</ol>
    </section>
  );
}

function PiDetailModal({ groups, score, max, onClose }: {
  groups: { index: IndexDef; results: MetricResult[] }[]; score: number; max: number; onClose: () => void;
}) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal pi-dm" role="dialog" aria-modal="true" aria-label="ที่มาของคะแนน Performance Index">
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">ที่มาของคะแนน Performance Index</div>
            <p>
              คะแนนตัวชี้วัด = (เขียว + 0.5 × เหลือง) ÷ จำนวนรายการ × {METRIC_MAX} · ให้สีทีละรายการ ·
              คะแนนหมวด = ผลรวม 2 ตัวชี้วัด (เต็ม 20) · คะแนนรวม = ผลรวม 5 หมวด (เต็ม {TOTAL_MAX}) ·
              ตัวที่ไม่มีข้อมูล/Baseline ไม่ครบไม่นับเข้าฐาน · รายการที่ให้สีตามตัวกรองที่เลือกอยู่ ·
              <b> {BASELINE_TITLE}</b> — P25/P30/P70/P75 คิดจาก 12 เดือนปฏิทินก่อนเดือนที่ประเมิน ใช้ระดับสาขาหรือบริษัทตามป้ายของแต่ละตัวชี้วัด
              ไม่คิดจากช่วงที่กำลังประเมิน · ไม่เลือกปี = ประเมินเดือนล่าสุดของแต่ละไฟล์
            </p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list pi-dm-body">
          {groups.map(({ index, results }) => {
            const s = sumScores(results);
            const full = index.subs.length * METRIC_MAX;
            return (
              <section key={index.id} className={`pi-dm-ix t-${index.id}`}>
                <div className="pi-dm-ixh">
                  <h4>{index.title} <small className="pi-bsc">{index.bsc}</small></h4>
                  <span><b>{s.max ? sc(s.score) : "–"}</b>/{full}{s.max > 0 && s.max < full && <em> (คิดได้ {s.max} จาก {full})</em>}</span>
                </div>
                {results.map((r) => <MetricDetail key={r.key} r={r} />)}
              </section>
            );
          })}
          <table className="pi-dm-sum">
            <tbody>
              {groups.map(({ index, results }) => {
                const s = sumScores(results);
                const st = indexStatus(results);
                return (
                  <tr key={index.id}>
                    <td>{index.title}</td>
                    <td>{results.map((r) => `${METRICS[r.key].label} ${r.score == null ? "–" : sc(r.score)}`).join(" + ")}</td>
                    <td className="n">{s.max ? sc(s.score) : "–"}</td>
                    <td className="n">{st ? <i className={`pi-dm-st ${st}`}>{STATUS_LABEL[st]}</i> : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>คะแนนรวม{max < TOTAL_MAX && ` (คิดได้ ${max} จาก ${TOTAL_MAX} คะแนน)`}</td>
                <td className="n">{max ? sc(score) : "–"}/{TOTAL_MAX}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <PiMethod />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}

