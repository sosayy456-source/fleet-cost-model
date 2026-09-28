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
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import type { LfData } from "../../lib/data/useLoadFactor";
import { vehicleRows } from "../../lib/detail3/calc";
import { totalDamage } from "../../lib/damage/damage";
import { INDEXES, METRICS, METRIC_MAX, STATUS_LABEL, STATUS_MEANING, STATUS_RANGE, TOTAL_MAX, indexStatus, metricResult, sumScores, withPeriod } from "../../lib/pi/score";
import { evalPeriod, inWindow, noTime, refSet, refWindow, windowLabel } from "../../lib/pi/baseline";
import { coverageByVehicleMonth, tkmByVehicleMonth } from "../../lib/pi/cost";
import { periodLabel } from "../../lib/filter/period";
import type { RefWindow } from "../../lib/pi/baseline";
import { routeMarginValues, serviceMonthMarginValues } from "../../lib/pi/route";
import { emptyResult } from "../../lib/pi/empty";
import { damageRef, damageResults } from "../../lib/pi/damage";
import type { DamageRef } from "../../lib/pi/damage";
import type { IndexDef, IndexStatus, MetricKey, MetricResult } from "../../lib/pi/score";
import type { Trip } from "../../lib/data/useCostRev";
import { fmt, pct } from "../dash-costrev/common";
import { passDemo, passLfDemo } from "./filter";
import type { DemoFilter } from "./filter";

/**
 * ชุดอ้างอิงของเกณฑ์ percentile (InDex_revised v2.md · lib/pi/baseline.ts) — เที่ยวในชุดกำไรที่อยู่ใน 12 เดือนล่าสุดของไฟล์
 * ตามตัวกรองของหน้ายกเว้นเวลา · all = ทุกเที่ยวในชุดกำไร (ไม่กรอง) — ช่วง 12 เดือนนับจากเดือนล่าสุดของทั้งไฟล์
 */
export interface TripRef { trips: Trip[]; w: RefWindow | null }

/**
 * เที่ยวของช่วงที่ประเมิน — ไม่เลือกปี = เดือนล่าสุดของไฟล์ (เจ้าของงานเลือก 28 ก.ย. 2569 "ประเมินเป็นรายเดือน")
 * · label = ป้ายช่วงที่ติดไปกับผล · all = ทุกเที่ยวในชุดกำไร (ไม่กรอง)
 */
export function tripEvalOf(all: Trip[], f: DemoFilter): { trips: Trip[]; label: string } {
  const pf = evalPeriod(f, all.map((t) => t.mo));
  return { trips: all.filter((t) => passDemo(t, pf)), label: periodLabel(pf) };
}
export function tripRefOf(all: Trip[], f: DemoFilter): TripRef {
  const w = refWindow(all.map((t) => t.mo));
  if (!w) return { trips: [], w };
  const nf = noTime(f);
  return { trips: all.filter((t) => inWindow(t.mo, w) && passDemo(t, nf)), w };
}

/** คะแนนทศนิยมไม่เกิน 1 ตำแหน่ง — 6.25 → "6.3" · 10 → "10" */
const sc = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

type Report = (id: string, results: MetricResult[]) => void;
const PiReportCtx = createContext<Report | null>(null);
export const PiReportProvider = PiReportCtx.Provider;

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
  metricResult("route", trips ? routeMarginValues(trips) : null, ref && refSet(routeMarginValues(ref.trips), "เส้นทาง", ref.w)),
  // กลุ่มบริการ × เดือน (เจ้าของงานเลือก 28 ก.ย. 2569) — 3 กลุ่มคิด percentile ไม่ได้ความหมาย
  metricResult("service", trips ? serviceMonthMarginValues(trips) : null, ref && refSet(serviceMonthMarginValues(ref.trips), "กลุ่ม × เดือน", ref.w)),
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

/** คอลัมน์ของตัวชี้วัดหนึ่งตัวในกล่องแถวเดียว — คะแนน · แถบสี · จำนวนสี · ปุ่ม "รายละเอียด" กางวิธีคิด */
function PiRowMetric({ r }: { r: MetricResult }) {
  const [open, setOpen] = useState(false);
  const def = METRICS[r.key];
  const t = r.tally;
  const f = formulaText(r);
  return (
    <div className={"pi-rm" + (r.score == null ? " na" : "")} title={subTitle(r)}>
      <div className="pi-rm-h"><span>{r.tone && <i className={`pi-tone ${r.tone}`} aria-hidden="true" />}{def.label}</span><b>{subValue(r)}</b></div>
      {t && t.n ? <>
        <span className="pi-rm-stack" aria-hidden="true">
          {BAND_TXT.map(([k]) => (t[k] ? <i key={k} className={k} style={{ flexGrow: t[k] }} /> : null))}
        </span>
        <span className="pi-rm-count">
          {BAND_TXT.map(([k, name]) => <span key={k}><i className={`pi-dm-dot ${k}`} />{name} {fmt(t[k])}</span>)}
          <span>จาก {fmt(t.n)} {def.unit}</span>
        </span>
      </> : <span className="pi-rm-count">{r.detail ?? (r.pending ? "ยังไม่มีเกณฑ์" : r.na ?? "ไม่มีรายการให้คิดตามตัวกรองที่เลือก")}</span>}
      <button type="button" className="pi-rm-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        รายละเอียด
      </button>
      {open && (
        <div className="pi-rm-detail">
          <p>{def.measure} เกณฑ์: เขียว {def.criteria[0]}, เหลือง {def.criteria[1]}, แดง {def.criteria[2]}.
            {r.basis && <> ({r.basis})</>}</p>
          {f && <p>คะแนน = {f}<b>{sc(r.score!)}</b></p>}
        </div>
      )}
    </div>
  );
}

/**
 * กล่อง PI แบบแถวเดียว (Route & Service ท้าย Profit Per Route · เจ้าของงานสั่ง 28 ก.ย. 2569):
 * กล่องคะแนน x/20 สั้น ๆ ซ้าย + ตัวชี้วัดเรียงไปทางขวา คอลัมน์ละตัว · ปุ่ม "รายละเอียด" กางวิธีคิดคะแนน
 * แจ้งผลขึ้นบรรทัดคะแนนรวมเหมือน PiBox (หมวดอื่นยังใช้ PiBox)
 */
export function PiRow({ index, results, note }: { index: IndexDef; results: MetricResult[]; note?: string }) {
  const report = useContext(PiReportCtx);
  useEffect(() => { report?.(index.id, results); }, [report, index.id, results]);
  const full = index.subs.length * METRIC_MAX;
  const { score, max } = sumScores(results);
  return (
    <section id={`pi-box-${index.id}`} className={`pi-box pi-row t-${index.id}`}>
      <div className="pi-row-sc">
        <h4 className="pi-t">{index.title} <small className="pi-bsc">{index.bsc}</small></h4>
        <StatusChip status={indexStatus(results)} />
        <div className="pi-score"><b>{max ? sc(score) : "–"}</b><span>/{full}</span></div>
        <Meter v={score} max={full} cls="pi-meter" />
        {max > 0 && max < full && <em className="pi-row-part">คิดได้ {max} จาก {full}</em>}
        {periodsOf(results) && <em className="pi-row-part">ประเมิน: {periodsOf(results)}</em>}
        {note && <PiNote text={note} />}
      </div>
      {results.map((r) => <PiRowMetric key={r.key} r={r} />)}
    </section>
  );
}

/**
 * Service Quality = Damage Performance (On-time Delivery ตัดออกแล้ว) — DR + DIR ตัวละ 10 เทียบ P75 (lib/pi/damage.ts)
 *   trips = เที่ยวที่กรองตามหน้า · refTrips = ชุดอ้างอิง 12 เดือนล่าสุดตามตัวกรองยกเว้นเวลา (tripRefOf · InDex_revised v2.md
 *   — เดิมภาพรวมบริษัทไม่ตามตัวกรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   นับเฉพาะเที่ยวที่จับคู่บิลได้และไม่ใช่เที่ยววิ่งเปล่า ตัวหารเดียวกับแท็บ Damage
 */
export const serviceRef = (refTrips: Trip[] | null): DamageRef | null =>
  (refTrips ? damageRef(refTrips.filter((t) => t.m && !t.empty)) : null);
export const servicePiResults = (trips: Trip[] | null, ref: DamageRef | null, period?: string): MetricResult[] =>
  (trips && ref ? damageResults(trips.filter((t) => t.m && !t.empty), ref)
    : INDEXES.service.subs.map((key): MetricResult => ({ key, pending: false, tally: null, score: null }))).map((r) => withPeriod(r, period));
export function PiService({ trips, refTrips, period }: { trips: Trip[] | null; refTrips: Trip[] | null; period?: string }) {
  const ref = useMemo(() => serviceRef(refTrips), [refTrips]);
  const results = useMemo(() => servicePiResults(trips, ref, period), [trips, ref, period]);
  const note = ref && (ref.p75Dr != null || ref.p75Dir != null)
    ? `นับสีรายเดือน: เขียว < P75 · เหลือง P75 ถึง < 2×P75 · แดง ≥ 2×P75 · P75 จาก KPI รายเดือน 12 เดือนล่าสุด (${ref.from} ถึง ${ref.to} · ตามตัวกรองยกเว้นเวลา):`
      + ` Damage Rate ${ref.p75Dr == null ? "–" : `${ref.p75Dr.toFixed(3)}%`} · Damage Incidence Rate ${ref.p75Dir == null ? "–" : `${ref.p75Dir.toFixed(2)}%`}`
      + ` · เดือนที่มีเที่ยวน้อยกว่า ${fmt(ref.minTrips)} เที่ยวไม่นับใน Incidence`
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
  // ชุดอ้างอิง = 12 เดือนล่าสุดของไฟล์ Load Factor ตามตัวกรองยกเว้นเวลา (ไฟล์ LF มีช่วงเดือนของตัวเอง)
  const w = refWindow(lf.trips.map((t) => t.mo));
  const nf = noTime(f);
  const ref = w ? lf.trips.filter((t) => inWindow(t.mo, w) && passLfDemo(t, nf)).map((t) => t.lf) : [];
  const pf = evalPeriod(f, lf.trips.map((t) => t.mo));
  return withPeriod(metricResult("lf", lf.trips.filter((t) => passLfDemo(t, pf)).map((t) => t.lf), refSet(ref, "เที่ยว", w)), periodLabel(pf));
}
/** all = ทุกเที่ยวในชุดกำไร (ไม่กรอง) · ให้สีตามตัวกรองยกเว้นกลุ่มบริการ · P25/P75 จาก 12 เดือนล่าสุดตามตัวกรองยกเว้นเวลาและกลุ่มบริการ */
export function emptyPiResult(all: Trip[] | null, f: DemoFilter): MetricResult {
  if (!all) return emptyResult(null, null);
  const ref = tripRefOf(all, { ...f, sg: "" });
  const ev = tripEvalOf(all, { ...f, sg: "" });
  return withPeriod(emptyResult(ev.trips, ref.trips, windowLabel(ref.w)), ev.label);
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
  return [
    metricResult("tkm", tkmByVehicleMonth(rows), refRows && refSet(tkmByVehicleMonth(refRows), "คัน × เดือน", ref!.w)),
    metricResult("coverage", coverageByVehicleMonth(rows),
      refRows && refSet(coverageByVehicleMonth(refRows), "คัน × เดือน", ref!.w)),
  ].map((r) => withPeriod(r, period));
}
export function PiCost({ trips, refs, period }: { trips: Trip[] | null; refs: TripRef | null; period?: string }) {
  const results = useMemo(() => costPiResults(trips, refs, period), [trips, refs, period]);
  return <PiBox index={INDEXES.cost} results={results} />;
}

/**
 * การ์ด Damage Rate ข้างกล่อง Service Quality — ใบเดียวกับการ์ดแรกของแท็บ Damage Rate ใน Executive Dashboard
 * นับเฉพาะเที่ยวที่จับคู่บิลได้ และไม่ใช่เที่ยววิ่งเปล่า (ตัวหารเดียวกับแท็บนั้น) · ตามตัวกรองของหน้า Demo
 */
export function DamageRateBox({ trips }: { trips: Trip[] | null }) {
  const kpi = useMemo(() => (trips ? totalDamage(trips.filter((t) => t.m && !t.empty)) : null), [trips]);
  // 4 ตัวเลขชุดเดียวกับหัวแท็บ Damage Rate ของ Overall Dashboard (DamageTab.tsx) รวมในกล่องแดงกล่องเดียว เรียงบนลงล่าง
  // (เจ้าของงานสั่ง 28 ก.ย. 2569 — รุ่นแรกเป็น 4 การ์ด 2×2 แยกสี)
  const rows: { l: string; v: string; s: string }[] = [
    { l: "Damage Rate", v: kpi?.rate == null ? "–" : pct(kpi.rate, 3), s: kpi ? "มูลค่าบิลเคลียร์ ÷ รายได้รวม" : "ยังไม่มีไฟล์ต้นทุน" },
    { l: "Damage Incidence Rate", v: kpi ? pct(kpi.incidence, 2) : "–", s: "เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด" },
    { l: "มูลค่าบิลเคลียร์", v: kpi ? fmt(kpi.clrAmt, 2) : "–", s: "บาท · มูลค่าความเสียหาย" },
    { l: "จำนวนเที่ยวที่มีบิลเคลียร์", v: kpi ? fmt(kpi.dmgTrips) : "–", s: "เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" },
  ];
  return (
    <div className="dz-kc hero loss pi-dmg4">
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
function jumpToIndex(id: string): void {
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
  const noData = all.filter((r) => !r.pending && r.score == null).map((r) => METRICS[r.key].label);
  return (
    <>
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
        </div>
        <Meter v={score} max={TOTAL_MAX} cls="pi-meter" />
        {max < TOTAL_MAX && (
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
                <span className="pi-jump-sc"><b>{r.max ? sc(r.score) : "–"}</b>/{full}</span>
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
        <dt>ข้อมูล</dt><dd>{def.source}{r.period && <span className="pi-dm-basis">ช่วงที่ประเมิน: {r.period}</span>}</dd>
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
          P25 · P30 · P70 · P75 คิดจาก <b>12 เดือนล่าสุด</b> แล้วใช้เทียบกับช่วงที่ประเมิน ไม่คิดใหม่จากชุดที่กำลังให้คะแนน
          (ถ้าใช้ชุดเดียวกัน สัดส่วนจะเป็น 🟢 25% · 🟡 50% · 🔴 25% เสมอ คะแนนติดที่ราว 5/10) · คะแนนจึงสะท้อนพัฒนาการเทียบกับอดีตของบริษัทเอง
          ไม่ใช่มาตรฐานอุตสาหกรรม · ข้อมูลที่มีไม่ถึง 12 เดือน (เช่น DSO) ใช้เท่าที่มีเป็นเกณฑ์ชั่วคราว · ทบทวนเกณฑ์ทุก 12 เดือน
          หรือเมื่อโครงสร้างการดำเนินงานเปลี่ยนมาก</li>
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
              ตัวที่ไม่มีข้อมูลไม่นับเข้าฐาน · รายการที่ให้สีตามตัวกรองที่เลือกอยู่ ·
              เกณฑ์ percentile จาก 12 เดือนล่าสุดของไฟล์ (ตามตัวกรองยกเว้นเวลา) · ไม่เลือกปี = ประเมินเดือนล่าสุด
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
