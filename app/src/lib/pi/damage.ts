/**
 * Service Quality Index = Damage Rate (DR) + Damage Incidence Rate (DIR) ตัวละ 10 คะแนน
 *
 * ★ "แก้ Performance Index.pdf" (เจ้าของงานส่ง 28 ก.ย. 2569) — **นับสีรายเดือน** แทนคะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75) เดิม
 *   รายการ = แต่ละเดือนในชุดที่กรอง (ภาพรวมบริษัทของเดือนนั้น · เจ้าของงานเลือก) · DR/DIR ของเดือน = Σ ÷ Σ ของเดือนนั้น
 *   🟢 < P75 · 🟡 P75 ≤ ค่า < 2 × P75 · 🔴 ≥ 2 × P75 → คะแนน = (เขียว + 0.5 × เหลือง) ÷ จำนวนเดือน × 10 (สูตรเดียวกับตัวชี้วัดอื่น)
 *   เลือกเดือนเดียว = มีรายการเดียว คะแนนออกได้แค่ 0 / 5 / 10
 *   สถานะของหมวด (เกณฑ์ภายใน): ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–14.99 · ไม่ผ่านเกณฑ์ < 10 (ตารางในไฟล์ · เท่าเดิม)
 *
 * ★ P75 มาจาก "ชุดอ้างอิง" ไม่คิดใหม่ตามตัวกรอง = KPI รายเดือนของภาพรวมบริษัท **12 เดือนล่าสุด (Rolling 12 Months)**
 *   นับย้อนจากเดือนล่าสุดที่ไฟล์ต้นทุนมี ทั้ง DR และ DIR (ไฟล์ "dashboard คชจ.md" 27 ก.ย. 2569) · PERCENTILE.INC ตัวเดียวกับแท็บ Damage
 *   ใช้รายเดือนไม่ใช่รายวัน × สาขา — ชุดตัวอย่างรายวัน × สาขา 96% ของกลุ่มไม่มีความเสียหาย P75 จึงเป็น 0 ใช้เป็นเกณฑ์ไม่ได้
 * ★ กรณีพิเศษ: เดือนที่รายได้ = 0 ไม่นับใน DR · เดือนที่เที่ยวน้อยกว่า 100 ÷ (2 × P75 ของ DIR) ไม่นับใน DIR
 *   (เสีย 1 เที่ยวก็แดงทันที) · ไม่เหลือเดือนให้นับ = "ประเมินไม่ได้" / "ข้อมูลไม่เพียงพอ" / "ไม่มีเที่ยว" ไม่นับเข้าฐาน
 *   P75 = 0 → ใช้ P75 ของเดือนที่มีค่า > 0 · ชุดอ้างอิงไม่เสียหายเลย (P75 null) → เดือนที่เป็น 0 เขียว มีความเสียหายแดง
 */
import { aggregateDamage, percentileInc, totalDamage } from "../damage/damage";
import type { DamageTrip } from "../damage/damage";
import { bandResult } from "./score";
import type { Band, MetricResult } from "./score";

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

export type KpiTone = Band;
/** สีของค่า KPI เทียบ P75 (ตามไฟล์): < P75 เขียว · P75 ≤ ค่า < 2 × P75 เหลือง · ≥ 2 × P75 แดง · P75 ไม่มี/0 = 0 เขียว มีค่าแดง */
export function kpiTone(kpi: number, p75: number | null): KpiTone {
  if (p75 == null || p75 <= 0) return kpi > 0 ? "r" : "g";
  return kpi < p75 ? "g" : kpi < 2 * p75 ? "y" : "r";
}

const pctTxt = (v: number, d: number): string => `${v.toFixed(d)}%`;

/** DR + DIR ของช่วงที่ประเมิน → นับสีรายเดือน (score null + na = ประเมินไม่ได้) · tone = สีของค่ารวมทั้งช่วง (แสดงผล) */
export function damageResults(trips: DamageTrip[], ref: DamageRef): [MetricResult, MetricResult] {
  const months = aggregateDamage(trips, (t) => t.mo);
  const k = totalDamage(trips);
  const span = ref.from ? ` (${ref.from} ถึง ${ref.to})` : "";
  const basis = (p75: number | null, d: number) => (p75 == null ? `ชุดอ้างอิง ${ref.months} เดือนล่าสุดไม่มีความเสียหายเลย`
    : `P75 = ${pctTxt(p75, d)} · 2 × P75 = ${pctTxt(2 * p75, d)} จาก KPI รายเดือนของทั้งบริษัท ${REF_MONTHS} เดือนล่าสุด${span} มีข้อมูล ${ref.months} เดือน`);

  const drMonths = months.filter((m) => m.rate != null);
  const dr = !months.length ? bandResult("dr", null, { na: "ไม่มีเที่ยว", detail: "ไม่มีเที่ยวตามตัวกรอง" })
    : !drMonths.length ? bandResult("dr", null, { na: "ประเมินไม่ได้", detail: "ทุกเดือนรายได้ = 0 หาร Damage Rate ไม่ได้" })
      : bandResult("dr", drMonths.map((m) => kpiTone(m.rate!, ref.p75Dr)),
        { tone: k.rate == null ? undefined : kpiTone(k.rate, ref.p75Dr) });
  dr.basis = basis(ref.p75Dr, 3);

  const dirMonths = months.filter((m) => m.n >= ref.minTrips);
  const dir = !months.length ? bandResult("dir", null, { na: "ไม่มีเที่ยว", detail: "ไม่มีเที่ยววิ่งจริงตามตัวกรอง" })
    : !dirMonths.length ? bandResult("dir", null, { na: "ข้อมูลไม่เพียงพอ",
      detail: `ไม่มีเดือนที่มีเที่ยวถึง ${ref.minTrips} เที่ยว (= 100 ÷ (2 × P75 ${pctTxt(ref.p75Dir ?? 0, 2)})) — เสีย 1 เที่ยวก็แดงทันที` })
      : bandResult("dir", dirMonths.map((m) => kpiTone(m.incidence, ref.p75Dir)), { tone: kpiTone(k.incidence, ref.p75Dir) });
  dir.basis = basis(ref.p75Dir, 2) + ` · เดือนที่มีเที่ยวน้อยกว่า ${ref.minTrips} เที่ยวไม่นับ`
    + (dirMonths.length < months.length ? ` (ข้าม ${months.length - dirMonths.length} เดือน)` : "");
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
