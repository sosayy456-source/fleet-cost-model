/**
 * กล่อง Performance Index ของหน้า Demo (เจ้าของงานสั่ง 25 ก.ย. 2569) — สูตร/เกณฑ์อยู่ใน lib/pi/score.ts ที่เดียว
 *
 *   ท้ายส่วน กำไรรายเส้นทาง  → Route & Service Profitability Index
 *   ท้ายส่วน ข้อ 2           → Fleet & Trip Efficiency Index        (Load Factor จากไฟล์ LF · Empty Return รอเกณฑ์)
 *   ท้ายส่วน ข้อ 3           → Cost & Vehicle Utilization Index      (Cost per Ton-km · Fixed Cost Coverage รายคัน)
 *   ท้ายส่วน กำไรลูกค้า       → Customer Profitability & Cash Flow Index (กล่องยาว)
 *                               → Service Quality Index (ซ้าย · DR + DIR เทียบ P75 · lib/pi/damage.ts) + การ์ด Damage Rate (ขวา)
 *                                 ขนาดเท่ากัน (เจ้าของงานย้าย 25 ก.ย. 2569) → คะแนนรวม XX/100 บรรทัดสุดท้าย
 * ★ หน้าตา (เจ้าของงานขอให้เด่นขึ้น 25 ก.ย. 2569): พื้นไล่สีชุดเดียวกับการ์ดเด่น (Hero) หนึ่งสีต่อหมวด (.pi-box.t-<id>)
 *   หลอดคะแนนของหมวด + ชิปรายตัวชี้วัดพร้อมหลอดเล็ก · บรรทัดคะแนนรวมพื้นกรมท่า
 *
 * ★ กล่องแต่ละใบคิดคะแนนจากข้อมูลของส่วนตัวเอง แล้วแจ้งผลขึ้นไปที่ DemoDash ผ่าน PiReportCtx ให้บรรทัดคะแนนรวมอ่าน
 *   (ข้อมูลคนละชุด คนละ hook — ส่วนกำไรลูกค้าโหลด alloc/debtors เอง และวันที่ของ DSO อยู่ในส่วน DSO)
 * ★ ตัวชี้วัดที่ยังไม่มีเกณฑ์ขึ้น "รอเกณฑ์" · ชุดข้อมูลหาย/ไม่มีรายการขึ้น "ไม่มีข้อมูล" — ทั้งสองแบบไม่นับเข้าฐาน
 *   คะแนนหมวด/คะแนนรวมจึงบอก "คิดได้ x จาก y" ไว้ด้วย (เจ้าของงานเลือก) ไม่งั้นอ่านผิดว่าได้คะแนนต่ำ
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { depreciation, vehicleRows } from "../../lib/detail3/calc";
import { totalDamage } from "../../lib/damage/damage";
import { INDEXES, METRICS, METRIC_MAX, TOTAL_MAX, metricResult, sumScores } from "../../lib/pi/score";
import { DAMAGE_STATUS_LABEL, damageRef, damageResults, damageStatus } from "../../lib/pi/damage";
import type { DamageStatus } from "../../lib/pi/damage";
import type { IndexDef, MetricKey, MetricResult } from "../../lib/pi/score";
import type { Trip } from "../../lib/data/useCostRev";
import { Hero } from "../dash-fleet/parts";
import { fmt, pct } from "../dash-costrev/common";
import { passLfDemo } from "./filter";
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
    const same = a && a.length === results.length
      && a.every((x, i) => x.key === results[i]!.key && x.pending === results[i]!.pending && x.score === results[i]!.score);
    return same ? p : { ...p, [id]: results };
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
    + ` → (${fmt(t.g)} + 0.5 × ${fmt(t.y)}) ÷ ${fmt(t.n)} × ${METRIC_MAX}`;
}

/** กล่องยาวของหนึ่งหมวด: ชื่อ · คะแนนเด่น (เต็ม 20) · บรรทัดคะแนนรายตัวชี้วัด · status = ป้ายสถานะ (เฉพาะ Service Quality) */
export function PiBox({ index, results, status, note }: {
  index: IndexDef; results: MetricResult[]; status?: DamageStatus | null; note?: string;
}) {
  const report = useContext(PiReportCtx);
  useEffect(() => { report?.(index.id, results); }, [report, index.id, results]);
  const full = index.subs.length * METRIC_MAX;
  const { score, max } = sumScores(results);
  return (
    <section className={`pi-box t-${index.id}`}>
      <div className="pi-head">
        <h4 className="pi-t">{index.title}</h4>
        {status && <i className={`pi-st ${status}`} title="เกณฑ์ภายในที่ออกแบบสำหรับ PI (ไม่ใช่มาตรฐานสากล): ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–<15 · ไม่ผ่านเกณฑ์ < 10">
          {DAMAGE_STATUS_LABEL[status]}</i>}
      </div>
      <div className="pi-score">
        <b>{max ? sc(score) : "–"}</b><span>/{full}</span>
        {max > 0 && max < full && <em>คิดได้ {max} จาก {full} คะแนน</em>}
      </div>
      <Meter v={score} max={full} cls="pi-meter" />
      <div className="pi-subs">
        {results.map((r) => (
          <div key={r.key} title={subTitle(r)} className={"pi-sub" + (r.pending || r.score == null ? " na" : "")}>
            <span>{METRICS[r.key].label}</span>
            <b>{subValue(r)}</b>
            <Meter v={r.score ?? 0} max={METRIC_MAX} cls="pi-bar" />
          </div>
        ))}
      </div>
      {note && <p className="pi-note">{note}</p>}
    </section>
  );
}

/** หมวดที่ยังรอเกณฑ์ทั้งหมด — array คงที่ ไม่งั้นกล่องแจ้งผลซ้ำทุก render */
const pendingOf = (index: IndexDef): MetricResult[] => index.subs.map((k: MetricKey) => metricResult(k, null));
const ROUTE_PENDING = pendingOf(INDEXES.route);

/** Route & Service — ทั้งสองตัวรอเกณฑ์ (ตารางของเจ้าของงานยังว่าง) */
export function PiRoute() {
  return <PiBox index={INDEXES.route} results={ROUTE_PENDING} />;
}

/**
 * Service Quality = Damage Performance (On-time Delivery ตัดออกแล้ว) — DR + DIR ตัวละ 10 เทียบ P75 (lib/pi/damage.ts)
 *   trips = เที่ยวที่กรองตามหน้า · refTrips = ทุกเที่ยวในชุด (ชุดอ้างอิงคงที่ ไม่ตามตัวกรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   นับเฉพาะเที่ยวที่จับคู่บิลได้และไม่ใช่เที่ยววิ่งเปล่า ตัวหารเดียวกับแท็บ Damage
 */
export function PiService({ trips, refTrips }: { trips: Trip[] | null; refTrips: Trip[] | null }) {
  const ref = useMemo(() => (refTrips ? damageRef(refTrips.filter((t) => t.m && !t.empty)) : null), [refTrips]);
  const results = useMemo<MetricResult[]>(
    () => (trips && ref ? damageResults(trips.filter((t) => t.m && !t.empty), ref)
      : INDEXES.service.subs.map((key) => ({ key, pending: false, tally: null, score: null }))),
    [trips, ref]);
  const note = ref && (ref.p75Dr != null || ref.p75Dir != null)
    ? `Score = MAX(0, 10 − 5 × KPI ÷ P75) · P75 จาก KPI รายเดือนของภาพรวมบริษัททุกเดือนในไฟล์ (${ref.months} เดือน · ไม่ตามตัวกรอง):`
      + ` Damage Rate ${ref.p75Dr == null ? "–" : `${ref.p75Dr.toFixed(3)}%`} · Damage Incidence Rate ${ref.p75Dir == null ? "–" : `${ref.p75Dir.toFixed(2)}%`}`
      + ` · Incidence ต้องมีอย่างน้อย ${fmt(ref.minTrips)} เที่ยว`
    : undefined;
  return <PiBox index={INDEXES.service} results={results} status={damageStatus(results)} note={note} />;
}

/** Fleet & Trip — Load Factor = Max LF รายเที่ยวของไฟล์ LF ตามตัวกรองเดียวกับกล่อง LF ของข้อ 2 */
export function PiFleet({ f }: { f: DemoFilter }) {
  const { data: lf, error } = useLoadFactor();
  const results = useMemo(() => {
    const values = lf ? lf.trips.filter((t) => passLfDemo(t, f)).map((t) => t.lf) : null;
    return [metricResult("lf", error ? null : values), metricResult("empty", null)];
  }, [lf, error, f]);
  return <PiBox index={INDEXES.fleet} results={results} />;
}

/**
 * Cost & Vehicle — รายคัน (VRow) ชุดเดียวกับหน้า "รายละเอียด ข้อ 3"
 *   Cost per Ton-km = VRow.perTkm (คันที่ไม่มีน้ำหนัก/ระยะทางไม่นับ) · Coverage = Contribution ÷ ค่าเสื่อม ของ depreciation()
 *   (รถบริษัทที่มีค่าเสื่อมเท่านั้น) · trips null = ไฟล์ต้นทุนยังไม่มี
 */
export function PiCost({ trips }: { trips: Trip[] | null }) {
  const results = useMemo(() => {
    if (!trips) return [metricResult("tkm", null), metricResult("coverage", null)];
    const rows = vehicleRows(trips);
    return [
      metricResult("tkm", rows.flatMap((r) => (r.perTkm == null ? [] : [r.perTkm]))),
      metricResult("coverage", depreciation(rows).list.map((r) => r.coverage)),
    ];
  }, [trips]);
  return <PiBox index={INDEXES.cost} results={results} />;
}

/**
 * การ์ด Damage Rate ข้างกล่อง Service Quality — ใบเดียวกับการ์ดแรกของแท็บ Damage Rate ใน Executive Dashboard
 * นับเฉพาะเที่ยวที่จับคู่บิลได้ และไม่ใช่เที่ยววิ่งเปล่า (ตัวหารเดียวกับแท็บนั้น) · ตามตัวกรองของหน้า Demo
 */
export function DamageRateBox({ trips }: { trips: Trip[] | null }) {
  const kpi = useMemo(() => (trips ? totalDamage(trips.filter((t) => t.m && !t.empty)) : null), [trips]);
  return (
    <Hero kind="loss" l="Damage Rate" v={kpi?.rate == null ? "–" : pct(kpi.rate, 3)}
      s={kpi ? "มูลค่าบิลเคลียร์ ÷ รายได้รวม" : "ยังไม่มีไฟล์ต้นทุน"} />
  );
}

/** บรรทัดสุดท้าย — คะแนนรวม XX/100 พร้อมฐานที่คิดได้และตัวชี้วัดที่ยังขาด */
export function PiTotal({ reports }: { reports: Record<string, MetricResult[]> }) {
  const all = Object.values(INDEXES).flatMap((ix) => reports[ix.id] ?? pendingOf(ix));
  const { score, max } = sumScores(all);
  const pending = all.filter((r) => r.pending).map((r) => METRICS[r.key].label);
  const noData = all.filter((r) => !r.pending && r.score == null).map((r) => METRICS[r.key].label);
  return (
    <section className="pi-total">
      <span className="pi-total-l">คะแนนรวม Performance Index</span>
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
    </section>
  );
}
