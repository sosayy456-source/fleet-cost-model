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
import { depreciation, vehicleRows } from "../../lib/detail3/calc";
import { totalDamage } from "../../lib/damage/damage";
import { INDEXES, METRICS, METRIC_MAX, TOTAL_MAX, metricResult, sumScores } from "../../lib/pi/score";
import { routeMarginValues, serviceMarginValues } from "../../lib/pi/route";
import { emptyResult } from "../../lib/pi/empty";
import { REC_LEVEL_LABEL, recommendations } from "../../lib/pi/recommend";
import { DAMAGE_STATUS_LABEL, damageRef, damageResults, damageStatus } from "../../lib/pi/damage";
import type { DamageRef, DamageStatus } from "../../lib/pi/damage";
import type { IndexDef, MetricKey, MetricResult } from "../../lib/pi/score";
import type { Trip } from "../../lib/data/useCostRev";
import { fmt, pct } from "../dash-costrev/common";
import { passDemo, passLfDemo } from "./filter";
import type { DemoFilter } from "./filter";

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

/** กล่องยาวของหนึ่งหมวด: ชื่อ · คะแนนเด่น (เต็ม 20) · บรรทัดคะแนนรายตัวชี้วัด · status = ป้ายสถานะ (เฉพาะ Service Quality) */
/**
 * กล่อง PI ของหมวด Fleet · Cost · Customer · Service — ตั้งแต่ 28 ก.ย. 2569 ใช้เลย์เอาต์แถวเดียวแบบ Route & Service ทุกหมวด
 * (เจ้าของงานสั่ง "performance index 2–5 ให้ทำตามแบบที่ 1") จึงส่งต่อให้ PiRow · status/note = ป้ายสถานะ + คำอธิบายหลังปุ่ม i ของ Service
 */
export function PiBox({ index, results, status, note }: {
  index: IndexDef; results: MetricResult[]; status?: DamageStatus | null; note?: string;
}) {
  return <PiRow index={index} results={results} status={status} note={note} />;
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
 * trips = เที่ยวที่กรองตามหน้าแล้ว · null = ไฟล์ต้นทุนยังไม่มี
 */
export const routePiResults = (trips: Trip[] | null): MetricResult[] => [
  metricResult("route", trips ? routeMarginValues(trips) : null),
  metricResult("service", trips ? serviceMarginValues(trips) : null),
];
export function PiRoute({ trips }: { trips: Trip[] | null }) {
  const results = useMemo(() => routePiResults(trips), [trips]);
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
        รายละเอียด <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
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
export function PiRow({ index, results, status, note }: {
  index: IndexDef; results: MetricResult[]; status?: DamageStatus | null; note?: string;
}) {
  const report = useContext(PiReportCtx);
  useEffect(() => { report?.(index.id, results); }, [report, index.id, results]);
  const full = index.subs.length * METRIC_MAX;
  const { score, max } = sumScores(results);
  return (
    <section id={`pi-box-${index.id}`} className={`pi-box pi-row t-${index.id}`}>
      <div className="pi-row-sc">
        <h4 className="pi-t">{index.title} <small className="pi-bsc">{index.bsc}</small></h4>
        {status && <i className={`pi-st ${status}`} title="เกณฑ์ภายในที่ออกแบบสำหรับ PI (ไม่ใช่มาตรฐานสากล): ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–<15 · ไม่ผ่านเกณฑ์ < 10">
          {DAMAGE_STATUS_LABEL[status]}</i>}
        <div className="pi-score"><b>{max ? sc(score) : "–"}</b><span>/{full}</span></div>
        <Meter v={score} max={full} cls="pi-meter" />
        {max > 0 && max < full && <em className="pi-row-part">คิดได้ {max} จาก {full}</em>}
        {note && <PiNote text={note} />}
      </div>
      {results.map((r) => <PiRowMetric key={r.key} r={r} />)}
    </section>
  );
}

/**
 * Service Quality = Damage Performance (On-time Delivery ตัดออกแล้ว) — DR + DIR ตัวละ 10 เทียบ P75 (lib/pi/damage.ts)
 *   trips = เที่ยวที่กรองตามหน้า · refTrips = ทุกเที่ยวในชุด (ชุดอ้างอิงคงที่ ไม่ตามตัวกรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   นับเฉพาะเที่ยวที่จับคู่บิลได้และไม่ใช่เที่ยววิ่งเปล่า ตัวหารเดียวกับแท็บ Damage
 */
export const serviceRef = (refTrips: Trip[] | null): DamageRef | null =>
  (refTrips ? damageRef(refTrips.filter((t) => t.m && !t.empty)) : null);
export const servicePiResults = (trips: Trip[] | null, ref: DamageRef | null): MetricResult[] =>
  (trips && ref ? damageResults(trips.filter((t) => t.m && !t.empty), ref)
    : INDEXES.service.subs.map((key) => ({ key, pending: false, tally: null, score: null })));
export function PiService({ trips, refTrips }: { trips: Trip[] | null; refTrips: Trip[] | null }) {
  const ref = useMemo(() => serviceRef(refTrips), [refTrips]);
  const results = useMemo(() => servicePiResults(trips, ref), [trips, ref]);
  const note = ref && (ref.p75Dr != null || ref.p75Dir != null)
    ? `นับสีรายเดือน: เขียว < P75 · เหลือง P75 ถึง < 2×P75 · แดง ≥ 2×P75 · P75 จาก KPI รายเดือนของภาพรวมบริษัท 12 เดือนล่าสุด (${ref.from} ถึง ${ref.to} · ไม่ตามตัวกรอง):`
      + ` Damage Rate ${ref.p75Dr == null ? "–" : `${ref.p75Dr.toFixed(3)}%`} · Damage Incidence Rate ${ref.p75Dir == null ? "–" : `${ref.p75Dir.toFixed(2)}%`}`
      + ` · เดือนที่มีเที่ยวน้อยกว่า ${fmt(ref.minTrips)} เที่ยวไม่นับใน Incidence`
    : undefined;
  return <PiBox index={INDEXES.service} results={results} status={damageStatus(results)} note={note} />;
}

/**
 * Fleet & Trip — Load Factor = Max LF รายเที่ยวของไฟล์ LF ตามตัวกรองเดียวกับกล่อง LF ของ Inefficient Transportation Cost
 *   Empty Return = เกณฑ์ของแท็บ Empty Trips (lib/pi/empty.ts) · all = ทุกเที่ยวในชุดกำไร (ยังไม่กรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   ให้สีตามตัวกรองของหน้า**ยกเว้นกลุ่มบริการ** (เที่ยวเปล่าไม่มีกลุ่มบริการ เลือกแล้วเที่ยวเปล่าหายหมด = เขียวทุกเส้นทาง)
 *   P25/P75 ไม่ตามต้นทาง/ปลายทาง กติกาเดียวกับแท็บ Empty Trips
 */
export const lfPiResult = (lf: LfData | null, f: DemoFilter): MetricResult =>
  metricResult("lf", lf ? lf.trips.filter((t) => passLfDemo(t, f)).map((t) => t.lf) : null);
export const emptyPiResult = (all: Trip[] | null, f: DemoFilter): MetricResult => (all
  ? emptyResult(all.filter((t) => passDemo(t, { ...f, sg: "" })), all.filter((t) => passDemo(t, { ...f, o: "", de: "", sg: "" })))
  : emptyResult(null, null));
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
export function costPiResults(trips: Trip[] | null): MetricResult[] {
  if (!trips) return [metricResult("tkm", null), metricResult("coverage", null)];
  const rows = vehicleRows(trips);
  return [
    metricResult("tkm", rows.flatMap((r) => (r.perTkm == null ? [] : [r.perTkm]))),
    metricResult("coverage", depreciation(rows).list.map((r) => r.coverage)),
  ];
}
export function PiCost({ trips }: { trips: Trip[] | null }) {
  const results = useMemo(() => costPiResults(trips), [trips]);
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
        <dt>ข้อมูล</dt><dd>{def.source}</dd>
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
              ตัวที่ไม่มีข้อมูลไม่นับเข้าฐาน · ตามตัวกรองที่เลือกอยู่
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
                return (
                  <tr key={index.id}>
                    <td>{index.title}</td>
                    <td>{results.map((r) => `${METRICS[r.key].label} ${r.score == null ? "–" : sc(r.score)}`).join(" + ")}</td>
                    <td className="n">{s.max ? sc(s.score) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>คะแนนรวม{max < TOTAL_MAX && ` (คิดได้ ${max} จาก ${TOTAL_MAX} คะแนน)`}</td>
                <td className="n">{max ? sc(score) : "–"}/{TOTAL_MAX}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}

/**
 * ส่วน "Recommendation" (เจ้าของงานสั่งเพิ่มแท็บ 28 ก.ย. 2569) — ตัวชี้วัด PI เรียงคะแนนน้อยไปมาก พร้อมแนวทาง
 * อ่านผลชุดเดียวกับกล่องคะแนนรวม ไม่คิดใหม่ · ข้อความแนวทางอยู่ที่ lib/pi/recommend.ts (ร่างแรก)
 * กดการ์ด = เลื่อนไปกล่อง Index ของตัวชี้วัดนั้น
 */
export function PiRecommend({ reports }: { reports: Record<string, MetricResult[]> }) {
  const list = useMemo(() => recommendations(reports), [reports]);
  if (!list.length) return <p className="dz-note">กำลังคิดคะแนน Performance Index… (ข้อเสนอแนะขึ้นเมื่อกล่อง PI คิดเสร็จ)</p>;
  return (
    <div className="pi-rec">
      {list.map((r, i) => (
        <button key={r.key} type="button" className={`pi-rec-card ${r.level}`} onClick={() => jumpToIndex(r.indexId)}
          title={`ไปที่ ${r.indexTitle}`}>
          <span className="pi-rec-no">{i + 1}</span>
          <span className="pi-rec-main">
            <span className="pi-rec-h">
              <b>{r.label}</b>
              <em className={`pi-rec-lv ${r.level}`}>{REC_LEVEL_LABEL[r.level]}</em>
            </span>
            <small>{r.indexTitle}{r.red != null && r.n ? ` · แดง ${fmt(r.red)} จาก ${fmt(r.n)} ${r.unit}` : ""}</small>
            <span className="pi-rec-a">{r.action}</span>
          </span>
          <span className="pi-rec-sc"><b>{sc(r.score)}</b>/{METRIC_MAX}</span>
        </button>
      ))}
    </div>
  );
}
