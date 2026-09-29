/**
 * Service Quality Index = Damage Rate (DR) + Damage Incidence Rate (DIR) ตัวละ 10 คะแนน
 *
 * ★ "แก้ Performance Index.pdf" (เจ้าของงานส่ง 28 ก.ย. 2569) — **นับสีรายเดือน** แทนคะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75) เดิม
 *   รายการ = แต่ละเดือนในช่วงประเมิน (ภาพรวมของเดือนนั้น · เจ้าของงานเลือก) · DR/DIR ของเดือน = Σ ÷ Σ ของเดือนนั้น
 *   🟢 < P75 · 🟡 P75 ≤ ค่า < 2 × P75 · 🔴 ≥ 2 × P75 → คะแนน = (เขียว + 0.5 × เหลือง) ÷ จำนวนเดือน × 10 (สูตรเดียวกับตัวชี้วัดอื่น)
 *   เลือกเดือนเดียว/ไม่เต็มเดือน = มีรายการเดียว คะแนนออกได้แค่ 0 / 5 / 10
 *
 * ★ Methodology 29 ก.ย. 2569 (เจ้าของงานเลือกคง Observation Unit รายเดือนของบริษัท): P75 มาจาก **Reference Baseline
 *   = 12 เดือนปฏิทินก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรองใด ๆ** (ผู้เรียกตัดเที่ยวมาให้ · lib/pi/baseline.ts)
 *   KPI รายเดือนของ Baseline (เดือนหัว/ท้ายที่ไม่เต็มเดือนนับเป็นหนึ่งค่า) · PERCENTILE.INC ตัวเดียวกับแท็บ Damage
 *   ใช้รายเดือนไม่ใช่รายวัน × สาขา — ชุดตัวอย่างรายวัน × สาขา 96% ของกลุ่มไม่มีความเสียหาย P75 จึงเป็น 0 ใช้เป็นเกณฑ์ไม่ได้
 * ★ กรณีพิเศษ: เดือนที่รายได้ = 0 ไม่นับใน DR · เดือนที่เที่ยวน้อยกว่า 100 ÷ (2 × P75 ของ DIR) ไม่นับใน DIR
 *   (เสีย 1 เที่ยวก็แดงทันที) · ไม่เหลือเดือนให้นับ = "ประเมินไม่ได้" / "ข้อมูลไม่เพียงพอ" / "ไม่มีเที่ยว" ไม่นับเข้าฐาน
 *   P75 = 0 → ใช้ P75 ของเดือนที่มีค่า > 0 · Baseline ไม่เสียหายเลย (P75 null) → เดือนที่เป็น 0 เขียว มีความเสียหายแดง
 */
import { aggregateDamage, percentileInc, totalDamage } from "../damage/damage";
import type { DamageTrip } from "../damage/damage";
import { bandResult, baseOf, indexStatus, pctsOf, STATUS_LABEL, METRICS } from "./score";
import type { Band, IndexStatus, MetricResult, RefSet } from "./score";
import { refSet } from "./baseline";
import type { Baseline } from "./baseline";

/** P75 ของ Baseline — เป็น 0 (เดือนส่วนใหญ่ไม่เสียหาย) ถอยไปใช้เฉพาะเดือนที่มีค่า > 0 */
function refP75(values: number[]): number | null {
  const p = percentileInc(values, 0.75);
  if (p == null || p > 0) return p;
  return percentileInc(values.filter((v) => v > 0), 0.75);
}

export interface DamageRef {
  p75Dr: number | null; p75Dir: number | null; months: number; minTrips: number;
  /** KPI รายเดือนของ Baseline — P25/P30/P70/P75 ในป็อบอัพ */
  drValues: number[]; dirValues: number[];
  /** ช่วง/Coverage/ครบไหม ของ Baseline (lib/pi/baseline.ts refSet) — ok false = N/A */
  ref: RefSet;
}

/** baseTrips = เที่ยวใน Baseline (จับคู่บิลได้ ไม่ใช่เที่ยวเปล่า · ไม่ตามตัวกรอง) · b = ช่วง/Coverage ของ Baseline */
export function damageRef(baseTrips: DamageTrip[], b: Baseline | null, scope?: string): DamageRef {
  const monthly = aggregateDamage(baseTrips, (t) => t.mo);
  const drValues = monthly.flatMap((a) => (a.rate == null ? [] : [a.rate]));
  const dirValues = monthly.map((a) => a.incidence);
  const p75Dr = refP75(drValues);
  const p75Dir = refP75(dirValues);
  const ref: RefSet = refSet(dirValues, "เดือน", b, false, scope);
  return { p75Dr, p75Dir, months: monthly.length, drValues, dirValues, ref,
    minTrips: p75Dir ? Math.ceil(100 / (2 * p75Dir)) : 1 };
}

export type KpiTone = Band;
/** สีของค่า KPI เทียบ P75 (ตามไฟล์): < P75 เขียว · P75 ≤ ค่า < 2 × P75 เหลือง · ≥ 2 × P75 แดง · P75 ไม่มี/0 = 0 เขียว มีค่าแดง */
export function kpiTone(kpi: number, p75: number | null): KpiTone {
  if (p75 == null || p75 <= 0) return kpi > 0 ? "r" : "g";
  return kpi < p75 ? "g" : kpi < 2 * p75 ? "y" : "r";
}

const pctTxt = (v: number, d: number): string => `${v.toFixed(d)}%`;
/** เหตุผลของสี (ตีความ Actual) */
const toneWhy = (v: number, p75: number | null, d: number): string =>
  p75 == null || p75 <= 0 ? (v > 0 ? `${pctTxt(v, d)} > 0 (Baseline ไม่มีความเสียหาย)` : `${pctTxt(v, d)} = 0`)
    : v < p75 ? `${pctTxt(v, d)} < P75 ${pctTxt(p75, d)}` : v < 2 * p75 ? `P75 ${pctTxt(p75, d)} ≤ ${pctTxt(v, d)} < 2 × P75`
      : `${pctTxt(v, d)} ≥ 2 × P75 ${pctTxt(2 * p75, d)}`;

/** DR + DIR ของช่วงประเมิน → นับสีรายเดือน (score null + na = ประเมินไม่ได้) · tone/actual = สีของค่ารวมทั้งช่วง (ตีความ) */
export function damageResults(trips: DamageTrip[], ref: DamageRef): [MetricResult, MetricResult] {
  // คะแนน Baseline = เดือนใน Baseline ให้สีเทียบ P75 ของ Baseline เอง
  const extra = (values: number[], key: "dr" | "dir") => ({ baseline: ref.ref.label, scope: ref.ref.scope, pcts: pctsOf(values, METRICS[key].show),
    base: baseOf(ref.ref.ok === false ? null : values.map((v) => kpiTone(v, key === "dr" ? ref.p75Dr : ref.p75Dir)), ref.ref.period) });
  if (ref.ref.ok === false) {
    const na = ref.ref.na ?? "Baseline ไม่ครบ";
    return [bandResult("dr", null, { na, detail: ref.ref.label, ...extra(ref.drValues, "dr") }),
      bandResult("dir", null, { na, detail: ref.ref.label, ...extra(ref.dirValues, "dir") })];
  }
  const months = aggregateDamage(trips, (t) => t.mo);
  const k = totalDamage(trips);
  const basis = (p75: number | null, d: number) => (p75 == null ? `Baseline ไม่มีความเสียหายเลย · ${ref.ref.label}`
    : `P75 = ${pctTxt(p75, d)} · 2 × P75 = ${pctTxt(2 * p75, d)} จาก KPI รายเดือน ${ref.months} ค่า · ${ref.ref.label}`);

  const drMonths = months.filter((m) => m.rate != null);
  const drAct = k.rate == null ? undefined : { v: pctTxt(k.rate, 3), band: kpiTone(k.rate, ref.p75Dr), why: toneWhy(k.rate, ref.p75Dr, 3) };
  const dr = !months.length ? bandResult("dr", null, { na: "ไม่มีเที่ยว", detail: "ไม่มีเที่ยวตามตัวกรอง", ...extra(ref.drValues, "dr") })
    : !drMonths.length ? bandResult("dr", null, { na: "ประเมินไม่ได้", detail: "ทุกเดือนรายได้ = 0 หาร Damage Rate ไม่ได้", ...extra(ref.drValues, "dr") })
      : bandResult("dr", drMonths.map((m) => kpiTone(m.rate!, ref.p75Dr)),
        { tone: drAct?.band, actual: drAct, ...extra(ref.drValues, "dr") });
  dr.basis = basis(ref.p75Dr, 3);

  const dirMonths = months.filter((m) => m.n >= ref.minTrips);
  const dirAct = { v: pctTxt(k.incidence, 2), band: kpiTone(k.incidence, ref.p75Dir), why: toneWhy(k.incidence, ref.p75Dir, 2) };
  const dir = !months.length ? bandResult("dir", null, { na: "ไม่มีเที่ยว", detail: "ไม่มีเที่ยววิ่งจริงตามตัวกรอง", ...extra(ref.dirValues, "dir") })
    : !dirMonths.length ? bandResult("dir", null, { na: "ข้อมูลไม่เพียงพอ", ...extra(ref.dirValues, "dir"),
      detail: `ไม่มีเดือนที่มีเที่ยวถึง ${ref.minTrips} เที่ยว (= 100 ÷ (2 × P75 ${pctTxt(ref.p75Dir ?? 0, 2)})) — เสีย 1 เที่ยวก็แดงทันที` })
      : bandResult("dir", dirMonths.map((m) => kpiTone(m.incidence, ref.p75Dir)), { tone: dirAct.band, actual: dirAct, ...extra(ref.dirValues, "dir") });
  dir.basis = basis(ref.p75Dir, 2) + ` · เดือนที่มีเที่ยวน้อยกว่า ${ref.minTrips} เที่ยวไม่นับ`
    + (dirMonths.length < months.length ? ` (ข้าม ${months.length - dirMonths.length} เดือน)` : "");
  return [dr, dir];
}

/** สถานะของหมวด — ย้ายไปใช้ร่วมทุกหมวดที่ lib/pi/score.ts (indexStatus · 28 ก.ย. 2569) ชื่อเดิมไว้ให้ผู้เรียกเก่า */
export type DamageStatus = IndexStatus;
export const DAMAGE_STATUS_LABEL = STATUS_LABEL;
export const damageStatus = (results: MetricResult[]): DamageStatus | null => indexStatus(results);
