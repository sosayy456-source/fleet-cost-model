/**
 * Empty Return ของ Performance Index — ใช้เกณฑ์ของแท็บ Empty Trips (lib/empty/routeScore.ts · เจ้าของงานสั่ง 25 ก.ย. 2569)
 *
 *   รายการ = เส้นทางตามทิศ · ค่า = % เที่ยววิ่งเปล่า (นับเที่ยว) · เกณฑ์ = P25/P75 ของทุกเส้นทาง
 *   ดี (≤ P25) = เขียว · ปานกลาง (P25–P75) = เหลือง · แย่มาก (> P75) = แดง → นับสีด้วยสูตรเดียวกับตัวชี้วัดอื่น
 *   (ไม่ใช้คะแนนต่อเนื่อง/ติดลบของแท็บ — PI ทุกตัวที่นับรายการใช้ เขียว + 0.5 × เหลือง ตามที่เจ้าของงานเลือก)
 * ★ Methodology 29 ก.ย. 2569: ref = เที่ยวใน Reference Baseline (12 เดือนก่อนเดือนที่ประเมิน · ระดับบริษัท ไม่ตามตัวกรองใด ๆ)
 *   Observation Unit ยังเป็นรายเส้นทาง (เจ้าของงานเลือก — รายเที่ยวมีแค่ 0%/100% ให้ P25 = P75 = 0 แยกสีไม่ได้)
 *   rated = เส้นทางของช่วงประเมิน (ตัวกรองของหน้า ยกเว้นกลุ่มบริการ — เที่ยวเปล่าไม่มีกลุ่มบริการ)
 */
import { emptyScore, emptyThresholds, routeRates } from "../empty/routeScore";
import type { EmptyGrade, RouteTrip } from "../empty/routeScore";
import { bandResult, baseOf, pctsOf, METRICS } from "./score";
import type { Band, MetricResult, RefSet } from "./score";

const BAND: Record<EmptyGrade, Band> = { good: "g", mid: "y", bad: "r" };

/** ref = ผลของ refSet() บนค่ารายเส้นทางของ Baseline (ช่วง · Coverage · ครบไหม) */
export function emptyResult(rated: RouteTrip[] | null, refTrips: RouteTrip[] | null, ref: RefSet | null): MetricResult {
  if (!rated || !refTrips || !ref) return bandResult("empty", null);
  const show = METRICS.empty.show;
  const refRates = routeRates(refTrips);
  const extra = { baseline: ref.label, scope: ref.scope, pcts: pctsOf(refRates.map((r) => r.pct), show) };
  if (ref.ok === false) return bandResult("empty", null, { na: ref.na ?? "Baseline ไม่ครบ", detail: ref.label, ...extra, base: baseOf(null, ref.period) });
  const th = emptyThresholds(refRates);
  if (!th) return bandResult("empty", null, extra);
  const basis = `P25 = ${show(th.p25)} · P75 = ${show(th.p75)} จาก ${th.routes.toLocaleString("en-US")} เส้นทาง · ${ref.label}`
    + (th.p25 === th.p75 ? " · P25 = P75 จึงไม่มีช่วงเหลือง (≤ P25 เขียว · เกินแดง)" : "");
  // Actual = % เที่ยวเปล่าของทั้งช่วงประเมิน (นับเที่ยว) — ใช้ตีความอย่างเดียว
  const n = rated.filter((t) => t.rt).length;
  const e = rated.filter((t) => t.rt && t.empty).length;
  const v = n ? e / n * 100 : null;
  const actual = v == null ? undefined : {
    v: show(v), band: BAND[emptyScore(v, th).grade],
    why: v <= th.p25 ? `${show(v)} ≤ P25 ${show(th.p25)}` : v <= th.p75 ? `P25 ${show(th.p25)} < ${show(v)} ≤ P75 ${show(th.p75)}` : `${show(v)} > P75 ${show(th.p75)}`,
  };
  const base = baseOf(refRates.map((r) => BAND[emptyScore(r.pct, th).grade]), ref.period);
  return bandResult("empty", routeRates(rated).map((r) => BAND[emptyScore(r.pct, th).grade]), { basis, actual, ...extra, base });
}
