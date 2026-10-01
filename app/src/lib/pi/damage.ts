/**
 * Service Quality Index = Damage Performance = Damage Rate (DR) + Damage Incidence Rate (DIR) ตัวละ 10 คะแนน (เต็ม 20)
 *
 * ★ เจ้าของงานเลือก 1 ต.ค. 2569 (หลัง "dashboard คชจ (3).pdf" — ทับ Band Scoring 10/5/0 และ MAX(0, 10 − 5 × KPI ÷ P75) ของวันเดียวกัน)
 *   **ให้สีรายเดือน แล้วนับสี** แบบตัวชี้วัดอื่น: คะแนน = (เขียว + 0.5 × เหลือง) ÷ จำนวนเดือน × 10 (`scoreOf` ใน score.ts)
 *   สีของแต่ละเดือนตามตารางเงื่อนไขของไฟล์ (เกณฑ์เดียวกันทั้ง DR และ DIR · KPI ยิ่งต่ำยิ่งดี):
 *     🟢 KPI ≤ P25 · 🟡 P25 < KPI ≤ P75 · 🔴 KPI > P75 (`kpiBand`) — P75 = 0: เดือนที่ KPI 0 เขียว · > 0 แดง ตามเงื่อนไขเอง
 *   DR = มูลค่าบิลเคลียร์ ÷ รายได้รวม × 100 · DIR = เที่ยวที่มีบิลเคลียร์ ÷ เที่ยววิ่งจริง × 100 (สูตรเดิม · lib/damage/damage.ts)
 *   KPI รายเดือนตามตัวกรอง **ปี / ช่วงเดือน / วันที่ / สาขา เท่านั้น** (ไม่ตามเส้นทาง/ประเภทรถ/ชนิดรถ/กลุ่มบริการ — ผู้เรียกตัดเที่ยวมาให้) ·
 *   เดือนหัว/ท้ายที่ช่วงคร่อมไม่เต็มเดือนคิดจากเที่ยวเท่าที่อยู่ในช่วง · เดือนที่รายได้ 0 ไม่นับใน DR (หารไม่ได้)
 *   ค่ารวมของช่วง (Σ ÷ Σ) เหลือไว้ตีความ (Actual) อย่างเดียว ไม่ใช่ที่มาของคะแนน
 * ★ Reference = **KPI รายเดือนของทั้งบริษัท** ในช่วงอ้างอิง · P25/P75 = PERCENTILE.INC ล้วน ·
 *   ไม่ตามตัวกรองใด ๆ · ช่วงอ้างอิง = 12 เดือนก่อนช่วงประเมิน (Reference Baseline เดียวกับ PI ตัวอื่น — เจ้าของงานเลือก 1 ต.ค. 2569) ·
 *   ไม่เทียบ Baseline (ช่วงประเมินว่าง) = KPI รายเดือนของบริษัทในช่วงที่เลือกเอง · ไม่ใช้ Baseline ระดับสาขา (ไฟล์กำหนด "ระดับทั้งบริษัท")
 * ★ ไม่มีกติกา "ข้อมูลไม่เพียงพอ" ของ DIR (ให้คะแนนเสมอ) · ช่วงไม่เต็มเดือนก็คิดคะแนน (ไม่ใช้ Daily View) ·
 *   คะแนน Baseline = เดือนในช่วงอ้างอิงให้สีด้วย P25/P75 ชุดเดียวกัน แล้วนับสีสูตรเดียวกัน (≈ 5 เสมอ เหมือนตัวชี้วัด percentile อื่น) ·
 *   รายได้ 0 ทั้งช่วง = DR "ประเมินไม่ได้" · ไม่มีเที่ยว = "ไม่มีเที่ยว"
 */
import { aggregateDamage, percentileInc, totalDamage } from "../damage/damage";
import type { DamageTrip } from "../damage/damage";
import { bandResult, baseOf, indexStatus, pctsOf, STATUS_LABEL, METRICS } from "./score";
import type { Band, IndexStatus, MetricResult, RefSet } from "./score";
import { refSet } from "./baseline";
import type { Baseline } from "./baseline";

export interface DamageRef {
  p25Dr: number | null; p75Dr: number | null; p25Dir: number | null; p75Dir: number | null; months: number;
  /** KPI รายเดือนของชุดอ้างอิง — ที่มาของ P25/P75 และคะแนน Baseline · DR ไม่นับเดือนที่รายได้ 0 */
  drValues: number[]; dirValues: number[];
  /** ช่วง/Coverage/ครบไหม ของชุดอ้างอิง (lib/pi/baseline.ts refSet) — ok false = N/A */
  ref: RefSet;
}

/** KPI รายเดือน — DR ไม่นับเดือนที่รายได้ 0 (หารไม่ได้) */
function monthlyKpi(trips: DamageTrip[]): { dr: number[]; dir: number[] } {
  const monthly = aggregateDamage(trips, (t) => t.mo);
  return { dr: monthly.flatMap((a) => (a.rate == null ? [] : [a.rate])), dir: monthly.map((a) => a.incidence) };
}

/** baseTrips = เที่ยวของชุดอ้างอิง (จับคู่บิลได้ + เที่ยวเปล่า · ทั้งบริษัท) · b = ช่วง/Coverage (null = ไม่เทียบ Baseline) */
export function damageRef(baseTrips: DamageTrip[], b: Baseline | null, scope?: string): DamageRef {
  const { dr: drValues, dir: dirValues } = monthlyKpi(baseTrips);
  return {
    p25Dr: percentileInc(drValues, 0.25), p75Dr: percentileInc(drValues, 0.75),
    p25Dir: percentileInc(dirValues, 0.25), p75Dir: percentileInc(dirValues, 0.75),
    months: dirValues.length, drValues, dirValues,
    ref: refSet(dirValues, "เดือน", b, false, scope),
  };
}

export type KpiTone = Band;
/** ระดับของ KPI (ยิ่งต่ำยิ่งดี): ≤ P25 เขียว · P25 < KPI ≤ P75 เหลือง · > P75 แดง · ไม่มีเกณฑ์ = null */
export function kpiBand(kpi: number, p25: number | null, p75: number | null): KpiTone | null {
  if (p25 == null || p75 == null) return null;
  return kpi <= p25 ? "g" : kpi <= p75 ? "y" : "r";
}

const pctTxt = (v: number, d: number): string => `${v.toFixed(d)}%`;
/** เหตุผลของระดับ (ตีความ Actual) */
const bandWhy = (v: number, p25: number, p75: number, d: number): string =>
  v <= p25 ? `${pctTxt(v, d)} ≤ P25 ${pctTxt(p25, d)}` : v <= p75 ? `P25 ${pctTxt(p25, d)} < ${pctTxt(v, d)} ≤ P75 ${pctTxt(p75, d)}`
    : `${pctTxt(v, d)} > P75 ${pctTxt(p75, d)}`;

/** DR + DIR ของช่วงประเมิน → ให้สีรายเดือนแล้วนับสี (score null + na = ประเมินไม่ได้) · tone/actual = ค่ารวมของช่วง (ตีความ) */
export function damageResults(trips: DamageTrip[], ref: DamageRef): [MetricResult, MetricResult] {
  const cur = monthlyKpi(trips);
  const k = totalDamage(trips);
  const one = (key: "dr" | "dir", kpi: number | null, noneNa: string, noneDetail: string, d: number): MetricResult => {
    const p25 = key === "dr" ? ref.p25Dr : ref.p25Dir, p75 = key === "dr" ? ref.p75Dr : ref.p75Dir;
    const refValues = key === "dr" ? ref.drValues : ref.dirValues;
    const bandsOf = (vs: number[]): Band[] | null => (p25 == null || p75 == null || !vs.length ? null : vs.map((v) => kpiBand(v, p25, p75)!));
    const extra = {
      baseline: ref.ref.label, scope: ref.ref.scope, pcts: pctsOf(refValues, METRICS[key].show),
      // คะแนน Baseline = เดือนในช่วงอ้างอิง ให้สีด้วยเกณฑ์ชุดเดียวกัน
      base: baseOf(ref.ref.ok === false ? null : bandsOf(refValues), ref.ref.period),
    };
    if (ref.ref.ok === false) return bandResult(key, null, { na: ref.ref.na ?? "Baseline ไม่ครบ", detail: ref.ref.label, ...extra });
    if (kpi == null) return bandResult(key, null, { na: noneNa, detail: noneDetail, ...extra });
    if (p25 == null || p75 == null) return bandResult(key, null, { na: "ไม่มีเกณฑ์", detail: `ชุดอ้างอิงไม่มี KPI รายเดือนให้คิด P25/P75 · ${ref.ref.label}`, ...extra });
    const band = kpiBand(kpi, p25, p75)!;
    const r = bandResult(key, bandsOf(key === "dr" ? cur.dr : cur.dir),
      { tone: band, actual: { v: pctTxt(kpi, d), band, why: bandWhy(kpi, p25, p75, d) }, ...extra });
    r.basis = `P25 = ${pctTxt(p25, d)} · P75 = ${pctTxt(p75, d)} จาก KPI รายเดือนของทั้งบริษัท ${ref.months} ค่า · ${ref.ref.label}`;
    return r;
  };
  return [
    one("dr", trips.length ? k.rate : null, trips.length ? "ประเมินไม่ได้" : "ไม่มีเที่ยว",
      trips.length ? "รายได้รวม = 0 หาร Damage Rate ไม่ได้" : "ไม่มีเที่ยวตามตัวกรอง", 3),
    one("dir", trips.length ? k.incidence : null, "ไม่มีเที่ยว", "ไม่มีเที่ยววิ่งจริงตามตัวกรอง", 2),
  ];
}

/** สถานะของหมวด — ย้ายไปใช้ร่วมทุกหมวดที่ lib/pi/score.ts (indexStatus · 28 ก.ย. 2569) ชื่อเดิมไว้ให้ผู้เรียกเก่า */
export type DamageStatus = IndexStatus;
export const DAMAGE_STATUS_LABEL = STATUS_LABEL;
export const damageStatus = (results: MetricResult[]): DamageStatus | null => indexStatus(results);
