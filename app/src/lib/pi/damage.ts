/**
 * Service Quality Index = Damage Performance (สเปก "dashboard คชจ.pdf" ที่เจ้าของงานส่ง · ใช้ตามที่คุยกัน 25 ก.ย. 2569)
 *
 *   DR  = Σ มูลค่าบิลเคลียร์ ÷ Σ รายได้ × 100          DIR = เที่ยวที่มีบิลเคลียร์ ÷ เที่ยววิ่งจริง × 100
 *   (SUM ÷ SUM ของช่วงที่เลือก ห้ามเฉลี่ยคะแนนย่อย — totalDamage() ตัวเดียวกับแท็บ Damage)
 *   Score = MAX(0, 10 − 5 × KPI ÷ P75)  → KPI 0 = 10 · KPI = P75 = 5 · KPI ≥ 2 × P75 = 0 · ต่อเนื่อง ไม่ติดลบ
 *   Damage Performance = DR Score + DIR Score (เต็ม 20)
 *   สถานะ (เกณฑ์ภายในที่ออกแบบสำหรับ PI ไม่ใช่มาตรฐานสากล): ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–<15 · ไม่ผ่านเกณฑ์ < 10
 *
 * ★ P75 มาจาก "ชุดอ้างอิง" ไม่คิดใหม่ตามตัวกรอง = KPI รายเดือนของภาพรวมบริษัท **12 เดือนล่าสุด (Rolling 12 Months)**
 *   นับย้อนจากเดือนล่าสุดที่ไฟล์ต้นทุนมี ทั้ง DR และ DIR (ไฟล์ "dashboard คชจ.md" 27 ก.ย. 2569 · เจ้าของงานเลือกใช้กับทั้งคู่ —
 *   เดิมใช้ทุกเดือนในไฟล์ เดือนใหม่เข้ามาคะแนนของช่วงเก่าเปลี่ยนตาม) · PERCENTILE.INC ตัวเดียวกับแท็บ Damage
 *   (ต่างกันที่แท็บ Damage คิด P75 จากช่วงเวลาที่เลือก)
 * ★ สีของ KPI (แสดงผลเท่านั้น ไม่เปลี่ยนสูตรคะแนน): เขียว ≤ P75 · เหลือง < 2 × P75 · แดง ≥ 2 × P75 (kpiTone)
 *   ใช้รายเดือนไม่ใช่รายวัน × สาขา — ชุดตัวอย่างรายวัน × สาขา 96% ของกลุ่มไม่มีความเสียหาย P75 จึงเป็น 0 ใช้เป็นเกณฑ์ไม่ได้
 * ★ กติกากรณีพิเศษ (สเปกข้อ 10 · ตามที่เสนอไว้):
 *   รายได้ = 0 → DR "ประเมินไม่ได้" · เที่ยว = 0 → DIR "ไม่มีเที่ยว" — ไม่ใช่ 0 (0 แปลว่าไม่มีความเสียหาย) และไม่นับเข้าฐาน
 *   P75 = 0 → ใช้ P75 ของเดือนที่มีค่า > 0 · ไม่มีเดือนไหนเสียหายเลย → ช่วงที่ประเมินก็ต้องเป็น 0 ได้ 10
 *   เที่ยวน้อย → DIR "ข้อมูลไม่เพียงพอ" เมื่อ n < 100 ÷ (2 × P75 ของ DIR) คือจำนวนที่เสีย 1 เที่ยวแล้วยังไม่ถึง 0 คะแนนทันที
 *   (หาเกณฑ์จากข้อมูลจริงตามที่สเปกขอ ไม่ตั้งตัวเลขเอง)
 */
import { aggregateDamage, percentileInc, totalDamage } from "../damage/damage";
import type { DamageTrip } from "../damage/damage";
import { METRIC_MAX } from "./score";
import type { MetricResult } from "./score";

/** MAX(0, 10 − 5 × KPI ÷ P75) · P75 null (ชุดอ้างอิงไม่มีความเสียหายเลย) → KPI 0 ได้เต็ม */
export function p75Score(kpi: number, p75: number | null): number {
  if (p75 == null || p75 <= 0) return kpi > 0 ? 0 : METRIC_MAX;
  return Math.max(0, METRIC_MAX - 5 * kpi / p75);
}

/** P75 ของชุดอ้างอิง — เป็น 0 (เดือนส่วนใหญ่ไม่เสียหาย) ถอยไปใช้เฉพาะเดือนที่มีค่า > 0 */
function refP75(values: number[]): number | null {
  const p = percentileInc(values, 0.75);
  if (p == null || p > 0) return p;
  return percentileInc(values.filter((v) => v > 0), 0.75);
}

export interface DamageRef {
  p75Dr: number | null; p75Dir: number | null; months: number; minTrips: number;
  /** ช่วงเดือนของชุดอ้างอิง "YYYY-MM" (ว่าง = ไม่มีข้อมูล) */
  from: string; to: string;
}

/** จำนวนเดือนย้อนหลังของชุดอ้างอิง */
export const REF_MONTHS = 12;

/** "YYYY-MM" ย้อนไป n เดือน */
const monthsBack = (mo: string, n: number): string => {
  const y = Number(mo.slice(0, 4)), m = Number(mo.slice(5, 7)) - 1 - n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12 + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
};

/**
 * ชุดอ้างอิงจากเที่ยวทั้งไฟล์ (ไม่กรอง) ตัดเหลือ 12 เดือนปฏิทินล่าสุด นับย้อนจากเดือนล่าสุดที่มีเที่ยว
 * — ต้องเป็นเที่ยวที่จับคู่บิลได้และไม่ใช่เที่ยวเปล่า ชุดเดียวกับตัวหาร
 */
export function damageRef(refTrips: DamageTrip[]): DamageRef {
  const to = refTrips.reduce((m, t) => (t.mo > m ? t.mo : m), "");
  const from = to ? monthsBack(to, REF_MONTHS - 1) : "";
  const monthly = aggregateDamage(refTrips.filter((t) => t.mo >= from && t.mo <= to), (t) => t.mo);
  const p75Dr = refP75(monthly.flatMap((a) => (a.rate == null ? [] : [a.rate])));
  const p75Dir = refP75(monthly.map((a) => a.incidence));
  return { p75Dr, p75Dir, months: monthly.length, from, to,
    minTrips: p75Dir ? Math.ceil(100 / (2 * p75Dir)) : 1 };
}

export type KpiTone = "g" | "y" | "r";
/** สีแสดงผลของ KPI เทียบ P75 — ไม่เกี่ยวกับสูตรคะแนน · P75 ไม่มี/0 = ไม่มีความเสียหายเขียว มีแดง */
export function kpiTone(kpi: number, p75: number | null): KpiTone {
  if (p75 == null || p75 <= 0) return kpi > 0 ? "r" : "g";
  return kpi <= p75 ? "g" : kpi < 2 * p75 ? "y" : "r";
}
const TONE_TXT: Record<KpiTone, string> = { g: "เขียว (≤ P75)", y: "เหลือง (P75 – 2×P75)", r: "แดง (≥ 2×P75)" };

const pctTxt = (v: number, d: number): string => `${v.toFixed(d)}%`;

/** DR + DIR ของช่วงที่ประเมิน → ผลสองตัวชี้วัด (score null + na = ประเมินไม่ได้) */
export function damageResults(trips: DamageTrip[], ref: DamageRef): [MetricResult, MetricResult] {
  const k = totalDamage(trips);
  const why = (kpi: number, p75: number | null, d: number, s: number) =>
    p75 ? `${pctTxt(kpi, d)} เทียบ P75 ${pctTxt(p75, d)} → 10 − 5 × ${(kpi / p75).toFixed(2)} = ${s.toFixed(2)}`
      : `ชุดอ้างอิงไม่มีความเสียหายเลย → ${s}`;

  let dr: MetricResult;
  if (k.rate == null) dr = { key: "dr", pending: false, tally: null, score: null, na: "ประเมินไม่ได้", detail: "รายได้รวม = 0 หาร Damage Rate ไม่ได้" };
  else { const s = p75Score(k.rate, ref.p75Dr); dr = { key: "dr", pending: false, tally: null, score: s, detail: why(k.rate, ref.p75Dr, 3, s), tone: kpiTone(k.rate, ref.p75Dr) }; }

  let dir: MetricResult;
  if (!k.n) dir = { key: "dir", pending: false, tally: null, score: null, na: "ไม่มีเที่ยว", detail: "ไม่มีเที่ยววิ่งจริงตามตัวกรอง" };
  else if (k.n < ref.minTrips) dir = { key: "dir", pending: false, tally: null, score: null, na: "ข้อมูลไม่เพียงพอ",
    detail: `มี ${k.n} เที่ยว ต้องอย่างน้อย ${ref.minTrips} เที่ยว (= 100 ÷ (2 × P75 ${pctTxt(ref.p75Dir ?? 0, 2)})) — เสีย 1 เที่ยวจะได้ 0 ทันที` };
  else { const s = p75Score(k.incidence, ref.p75Dir); dir = { key: "dir", pending: false, tally: null, score: s, detail: why(k.incidence, ref.p75Dir, 2, s), tone: kpiTone(k.incidence, ref.p75Dir) }; }

  // ป็อบอัพที่มาของคะแนน — P75 ของชุดอ้างอิงที่ใช้เทียบ
  const span = ref.from ? ` (${ref.from} ถึง ${ref.to})` : "";
  const basis = (p75: number | null, d: number, tone?: KpiTone) => (p75 == null ? `ชุดอ้างอิง ${ref.months} เดือนล่าสุดไม่มีความเสียหายเลย`
    : `P75 = ${pctTxt(p75, d)} จาก KPI รายเดือนของทั้งบริษัท ${REF_MONTHS} เดือนล่าสุด${span} มีข้อมูล ${ref.months} เดือน`)
    + (tone ? ` · สี ${TONE_TXT[tone]}` : "");
  dr.basis = basis(ref.p75Dr, 3, dr.tone);
  dir.basis = basis(ref.p75Dir, 2, dir.tone) + ` · ต้องมีอย่างน้อย ${ref.minTrips} เที่ยว`;
  return [dr, dir];
}

export type DamageStatus = "pass" | "watch" | "fail";
export const DAMAGE_STATUS_LABEL: Record<DamageStatus, string> = { pass: "ผ่านเกณฑ์", watch: "เฝ้าระวัง", fail: "ไม่ผ่านเกณฑ์" };

/** สถานะของ Damage Performance (เต็ม 20) · คิดเฉพาะเมื่อได้ครบทั้ง DR และ DIR — ขาดตัวหนึ่งเทียบ 15/10 ไม่ได้ */
export function damageStatus(results: MetricResult[]): DamageStatus | null {
  if (results.some((r) => r.score == null)) return null;
  const total = results.reduce((s, r) => s + r.score!, 0);
  return total >= 15 ? "pass" : total >= 10 ? "watch" : "fail";
}
