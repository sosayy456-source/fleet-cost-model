/**
 * คะแนนเที่ยววิ่งเปล่ารายเส้นทางด้วย percentile — แท็บ "เที่ยววิ่งเปล่า" ของ Executive Dashboard (เจ้าของงานสั่ง 24 ก.ย. 2569)
 *
 *   1. ต่อเส้นทาง: % เที่ยวเปล่า = จำนวนเที่ยววิ่งเปล่า ÷ จำนวนเที่ยววิ่งทั้งหมด × 100 (**นับเที่ยว ไม่ใช่ต้นทุน**)
 *   2. P25 / P50 / P75 = PERCENTILE.INC ของ Excel (ตัวเดียวกับ P75 ของแท็บ Damage)
 *   3. เกณฑ์ + คะแนน
 *        ดี (เป้า)   % ≤ P25              → 10
 *        ปานกลาง     P25 < % ≤ P75        → 10 × (P75 − %) ÷ (P75 − P25)   (ลดต่อเนื่อง 10 → 0)
 *        แย่มาก      % > P75              → (P75 − %) ÷ (P75 − P25) × 10   **ติดลบตามสูตร** (เจ้าของงานเลือก)
 *      P25 = P75 (หารด้วยศูนย์) → ≤ P25 ได้ 10 · เกินได้ 0 (เจ้าของงานเลือก)
 *
 * ★ ขอบเขตที่เจ้าของงานเลือก — ผู้เรียกกรองมาให้:
 *   เส้นทาง = ตามทิศ (จุดขึ้น-จุดลง `rt` แบบเดียวกับตาราง/กราฟของแท็บ) · **ทุกเส้นทางที่มีเที่ยววิ่ง** รวมที่ไม่เปล่าเลย (0%)
 *   เกณฑ์คิดตามช่วงเวลา + ประเภทรถ **ไม่ตามตัวกรองต้นทาง/ปลายทาง** (เกณฑ์ต้องเทียบทุกเส้นทางเสมอ)
 * ★ ชุดตัวอย่าง: เที่ยวเปล่าอยู่บนเส้นทางที่เปล่าล้วนเกือบทั้งหมด เส้นทางจึงเป็น 0% หรือ 100% → P25 = P75 = 0%
 */
import { percentileInc } from "../damage/damage";

/** ฟิลด์ที่ใช้ของ Trip — รับแค่นี้ เทสต์จะได้ไม่ต้องสร้าง Trip เต็มตัว */
export interface RouteTrip { rt: string; empty: boolean }

export interface RouteRate { rt: string; n: number; emptyN: number; pct: number }

/** % เที่ยวเปล่ารายเส้นทาง — ข้ามเที่ยวที่ไม่มีชื่อเส้นทาง (กติกาเดียวกับตารางของแท็บ) */
export function routeRates(trips: RouteTrip[]): RouteRate[] {
  const m = new Map<string, { n: number; e: number }>();
  for (const t of trips) {
    if (!t.rt) continue;
    const a = m.get(t.rt) ?? { n: 0, e: 0 };
    a.n++;
    if (t.empty) a.e++;
    m.set(t.rt, a);
  }
  return [...m].map(([rt, a]) => ({ rt, n: a.n, emptyN: a.e, pct: a.e / a.n * 100 }));
}

export interface EmptyThresholds { p25: number; p50: number; p75: number; routes: number }

/** P25/P50/P75 ของ % เที่ยวเปล่ารายเส้นทาง · ไม่มีเส้นทางเลย = null */
export function emptyThresholds(rates: RouteRate[]): EmptyThresholds | null {
  const v = rates.map((r) => r.pct);
  const p25 = percentileInc(v, 0.25), p50 = percentileInc(v, 0.5), p75 = percentileInc(v, 0.75);
  return p25 == null || p50 == null || p75 == null ? null : { p25, p50, p75, routes: v.length };
}

export type EmptyGrade = "good" | "mid" | "bad";

export const GRADES: Record<EmptyGrade, { label: string; emoji: string }> = {
  good: { label: "ดี (เป้า)", emoji: "🟢" },
  mid: { label: "ปานกลาง", emoji: "🟡" },
  bad: { label: "แย่มาก (เกณฑ์ต่ำ)", emoji: "🔴" },
};

/** ระดับ + คะแนนของเส้นทางที่มี % เที่ยวเปล่าเท่านี้ */
export function emptyScore(pct: number, th: EmptyThresholds): { grade: EmptyGrade; score: number } {
  if (pct <= th.p25) return { grade: "good", score: 10 };
  const span = th.p75 - th.p25;
  if (span <= 0) return { grade: "bad", score: 0 };       // P25 = P75 → ไม่มีช่วงกลาง หารไม่ได้
  const score = (th.p75 - pct) / span * 10;
  return { grade: pct <= th.p75 ? "mid" : "bad", score };
}
