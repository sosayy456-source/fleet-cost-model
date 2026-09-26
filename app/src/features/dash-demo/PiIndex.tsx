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
import { depreciation, vehicleRows } from "../../lib/detail3/calc";
import { totalDamage } from "../../lib/damage/damage";
import { INDEXES, METRICS, METRIC_MAX, TOTAL_MAX, metricResult, sumScores } from "../../lib/pi/score";
import { routeMarginValues, serviceMarginValues } from "../../lib/pi/route";
import { emptyResult } from "../../lib/pi/empty";
import { DAMAGE_STATUS_LABEL, damageRef, damageResults, damageStatus } from "../../lib/pi/damage";
import type { DamageStatus } from "../../lib/pi/damage";
import type { IndexDef, MetricKey, MetricResult } from "../../lib/pi/score";
import type { Trip } from "../../lib/data/useCostRev";
import { Hero } from "../dash-fleet/parts";
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

/** หมวดที่กล่องยังไม่ได้แจ้งผล (ยังไม่วาด/กำลังโหลด) — บรรทัดคะแนนรวมใช้แทนชั่วคราว */
const waitingOf = (index: IndexDef): MetricResult[] =>
  index.subs.map((key: MetricKey) => ({ key, pending: false, tally: null, score: null, na: "กำลังคำนวณ" }));

/**
 * Route & Service — %Margin รายเส้นทาง + 3 กลุ่มบริการ (lib/pi/route.ts) ชุดเดียวกับตาราง/การ์ดของ Profit Per Route
 * trips = เที่ยวที่กรองตามหน้าแล้ว · null = ไฟล์ต้นทุนยังไม่มี
 */
export function PiRoute({ trips }: { trips: Trip[] | null }) {
  const results = useMemo(() => [
    metricResult("route", trips ? routeMarginValues(trips) : null),
    metricResult("service", trips ? serviceMarginValues(trips) : null),
  ], [trips]);
  return <PiBox index={INDEXES.route} results={results} />;
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

/**
 * Fleet & Trip — Load Factor = Max LF รายเที่ยวของไฟล์ LF ตามตัวกรองเดียวกับกล่อง LF ของ Inefficient Transportation Cost
 *   Empty Return = เกณฑ์ของแท็บ Empty Trips (lib/pi/empty.ts) · all = ทุกเที่ยวในชุดกำไร (ยังไม่กรอง) · null = ไฟล์ต้นทุนยังไม่มี
 *   ให้สีตามตัวกรองของหน้า**ยกเว้นกลุ่มบริการ** (เที่ยวเปล่าไม่มีกลุ่มบริการ เลือกแล้วเที่ยวเปล่าหายหมด = เขียวทุกเส้นทาง)
 *   P25/P75 ไม่ตามต้นทาง/ปลายทาง กติกาเดียวกับแท็บ Empty Trips
 */
export function PiFleet({ f, all }: { f: DemoFilter; all: Trip[] | null }) {
  const { data: lf, error } = useLoadFactor();
  const lfResult = useMemo(
    () => metricResult("lf", error || !lf ? null : lf.trips.filter((t) => passLfDemo(t, f)).map((t) => t.lf)),
    [lf, error, f]);
  const empty = useMemo(() => (all
    ? emptyResult(all.filter((t) => passDemo(t, { ...f, sg: "" })), all.filter((t) => passDemo(t, { ...f, o: "", de: "", sg: "" })))
    : emptyResult(null, null)), [all, f]);
  const results = useMemo(() => [lfResult, empty], [lfResult, empty]);
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

/** บรรทัดสุดท้าย — คะแนนรวม XX/100 พร้อมฐานที่คิดได้และตัวชี้วัดที่ยังขาด · กดทั้งกล่อง = ป็อบอัพที่มาของคะแนน */
export function PiTotal({ reports }: { reports: Record<string, MetricResult[]> }) {
  const [open, setOpen] = useState(false);
  const groups = Object.values(INDEXES).map((ix) => ({ index: ix as IndexDef, results: reports[ix.id] ?? waitingOf(ix) }));
  const all = groups.flatMap((g) => g.results);
  const { score, max } = sumScores(all);
  const pending = all.filter((r) => r.pending).map((r) => METRICS[r.key].label);
  const noData = all.filter((r) => !r.pending && r.score == null).map((r) => METRICS[r.key].label);
  return (
    <>
      <section className="pi-total pi-click" role="button" tabIndex={0} aria-haspopup="dialog"
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
        <dd>{def.criteria
          ? <span className="pi-dm-crit">{def.criteria.map((c, i) => (
              <span key={i} className={`pi-dm-chip ${BAND_TXT[i]![0]}`}><i />{c}</span>))}</span>
          : "คะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75) — KPI 0 = 10 · เท่ากับ P75 = 5 · ถึง 2 × P75 = 0"}
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
                  <h4>{index.title}</h4>
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
