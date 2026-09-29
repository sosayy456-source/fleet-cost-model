/**
 * ชุดฐานของ Performance Index = **12 เดือนล่าสุดของทั้งบริษัท (รวมเดือนล่าสุด)** — เจ้าของงานเลือก 29 ก.ย. 2569
 * ให้ทุกตัวชี้วัดใช้แบบเดียวกับ Damage (lib/pi/damage.ts) แทน "percentile ของรายการชุดเดียวกับที่ให้สี"
 *
 *   ฐาน  = 12 เดือนนับย้อนจากเดือนล่าสุดที่ไฟล์นั้นมี (เช่นไฟล์ถึง พ.ค. 2569 → มิ.ย. 2568 – พ.ค. 2569)
 *          **ไม่ตามตัวกรองของหน้า** (ช่วงเวลา · สาขา · เส้นทาง · รถ · กลุ่มบริการ) — ทั้งบริษัทเสมอ
 *   ให้สี = รายการในช่วง/ตัวกรองที่เลือกอยู่ เทียบกับเส้นเกณฑ์ (P25/P75 · P30/P70 · P75) ที่คิดจากฐาน
 * ★ เหตุผล: เดิมคิดเกณฑ์จากชุดที่ให้สีเอง สัดส่วน 25/50/25 ตายตัว ตัวชี้วัด P25/P75 และ P30/P70 จึงได้ราว 5/10 เสมอ
 *   บอกไม่ได้ว่าดีขึ้นหรือแย่ลง · ฐานคงที่ทำให้ช่วงที่ดีกว่าปกติได้คะแนนสูงขึ้นจริง
 * ★ ไฟล์ที่มีไม่ถึง 12 เดือน = ใช้เท่าที่มี (ป็อบอัพบอกจำนวนเดือน)
 */
import { REF_MONTHS } from "./damage";

/** "YYYY-MM" ย้อนไป n เดือน */
export function monthsBack(mo: string, n: number): string {
  const [y, m] = mo.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export interface Baseline<T> {
  rows: T[];
  /** เดือนแรก–เดือนสุดท้ายของฐาน ("" = ไม่มีข้อมูล) */
  from: string; to: string;
  /** จำนวนเดือนที่มีข้อมูลจริงในฐาน (≤ 12) */
  months: number;
}

/** 12 เดือนล่าสุดของชุดข้อมูล (นับจากเดือนล่าสุดที่มี) · mo = เดือน "YYYY-MM" ของแถว */
export function lastMonths<T>(rows: T[], mo: (r: T) => string, n = REF_MONTHS): Baseline<T> {
  let to = "";
  for (const r of rows) { const m = mo(r); if (m > to) to = m; }
  if (!to) return { rows: [], from: "", to: "", months: 0 };
  const from = monthsBack(to, n - 1);
  const picked = rows.filter((r) => { const m = mo(r); return m >= from && m <= to; });
  return { rows: picked, from, to, months: new Set(picked.map(mo)).size };
}

/** ข้อความต่อท้ายค่าเกณฑ์ในป็อบอัพ */
export const baseSpan = (b: Pick<Baseline<unknown>, "from" | "to" | "months">): string =>
  b.from ? `จากฐาน 12 เดือนล่าสุดของทั้งบริษัท (${b.from} ถึง ${b.to} · มีข้อมูล ${b.months} เดือน)` : "ไม่มีข้อมูลฐาน";
