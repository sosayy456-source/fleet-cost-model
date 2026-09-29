/**
 * เกณฑ์ตั้งต้น (Baseline) ของ Performance Index — "InDex_revised v2.md" (เจ้าของงานส่ง 28 ก.ย. 2569)
 *
 *   เกณฑ์ percentile (P25 · P30 · P70 · P75) คิดจาก **12 เดือนล่าสุดของไฟล์** (Reference Period) แล้วใช้เทียบกับช่วงที่ประเมิน
 *   ไม่คิด percentile ใหม่จากชุดเดียวกับที่ให้คะแนน — ถ้าใช้ชุดเดียวกัน สัดส่วนจะเป็น เขียว 25% · เหลือง 50% · แดง 25% เสมอ
 *   คะแนนติดที่ราว 5/10 ไม่สะท้อนว่าผลงานดีขึ้นหรือแย่ลง
 *
 *   เจ้าของงานเลือก (28 ก.ย. 2569):
 *   · ช่วงอ้างอิง = 12 เดือนปฏิทินล่าสุดของไฟล์ นับย้อนจากเดือนล่าสุดที่ไฟล์มี (เลื่อนเองเมื่อมีไฟล์เดือนใหม่ · ทุกเครื่องได้ค่าเดียวกัน)
 *   · ชุดอ้างอิงตามตัวกรองของหน้า **ยกเว้นเวลา** (เลือกชนิดรถ = เทียบกับอดีตของชนิดนั้นเอง)
 *   · ช่วงที่ประเมินตามตัวกรองปี/เดือนของหน้าเหมือนเดิม · รายการของชุดอ้างอิงยุบรวมทั้ง 12 เดือน (เส้นทาง/ลูกค้า/คันละค่า)
 *   · ไฟล์ที่มีไม่ถึง 12 เดือน (DSO ตอนนี้ 7 เดือน) ใช้เท่าที่มีเป็นเกณฑ์ชั่วคราว
 */
import { PERIOD_ALL } from "../filter/period";

/** จำนวนเดือนของช่วงอ้างอิง */
export const BASELINE_MONTHS = 12;

/** "YYYY-MM" ย้อนไป n เดือน */
export function monthsBack(mo: string, n: number): string {
  const y = Number(mo.slice(0, 4)), m = Number(mo.slice(5, 7)) - 1 - n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12 + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** ช่วงอ้างอิง · months = จำนวนเดือนที่มีข้อมูลจริงในช่วง (ไฟล์ขาดเดือนได้) · ว่าง = ไม่มีข้อมูล */
export interface RefWindow { from: string; to: string; months: number }

/** 12 เดือนปฏิทินล่าสุด นับย้อนจากเดือนล่าสุดใน mos (ทั้งไฟล์ — ไม่ใช่ชุดที่กรองแล้ว) */
export function refWindow(mos: Iterable<string>): RefWindow | null {
  const set = new Set<string>();
  for (const mo of mos) if (mo) set.add(mo);
  if (!set.size) return null;
  const to = [...set].reduce((a, b) => (b > a ? b : a));
  const from = monthsBack(to, BASELINE_MONTHS - 1);
  let months = 0;
  for (const mo of set) if (mo >= from && mo <= to) months++;
  return { from, to, months };
}

export const inWindow = (mo: string, w: RefWindow): boolean => mo >= w.from && mo <= w.to;

/** ตัวกรองเดิมที่ล้างเวลาออก (ปี · ช่วงเดือน · เดือนเดียว) — ชุดอ้างอิง "ตามตัวกรองยกเว้นเวลา" */
export function noTime<T extends { year: string; from: string; to: string; month?: string }>(f: T): T {
  return { ...f, ...PERIOD_ALL, ...("month" in f ? { month: "" } : {}) };
}

/** ข้อความช่วงอ้างอิงในป็อบอัพ — "2025-06 ถึง 2026-05" + เตือนเมื่อไม่ครบ 12 เดือน */
export function windowLabel(w: RefWindow | null): string {
  if (!w) return "ไม่มีข้อมูลในช่วงอ้างอิง";
  return `12 เดือนล่าสุด ${w.from} ถึง ${w.to}`
    + (w.months < BASELINE_MONTHS ? ` (มีข้อมูล ${w.months} เดือน — ใช้เป็นเกณฑ์ชั่วคราวจนกว่าจะครบ ${BASELINE_MONTHS} เดือน)` : "");
}

/** ค่าของรายการในชุดอ้างอิง → RefSet ของ metricResult · unit = หน่วยของรายการ (เส้นทาง · คัน · ลูกค้า …) */
export function refSet(values: number[], unit: string, w: RefWindow | null): { values: number[]; label: string } {
  const n = values.filter(Number.isFinite).length;
  return { values, label: `จาก ${n.toLocaleString("en-US")} ${unit} · ${windowLabel(w)}` };
}

/**
 * ช่วงที่ประเมิน (เจ้าของงานเลือก 28 ก.ย. 2569 — "ประเมินเป็นรายเดือน"): หน้าไม่ได้เลือกปี = **เดือนล่าสุดของไฟล์นั้น**
 * เลือกปี/ช่วงเดือน = ช่วงนั้นตามเดิม · mos = เดือนของทั้งไฟล์ (แต่ละไฟล์มีเดือนล่าสุดของตัวเอง)
 */
export function evalPeriod<T extends { year: string; from: string; to: string }>(f: T, mos: Iterable<string>): T {
  if (f.year) return f;
  const w = refWindow(mos);
  if (!w) return f;
  const m = w.to.slice(5, 7);
  return { ...f, year: w.to.slice(0, 4), from: m, to: m };
}
