/**
 * ตัวกรองช่วงเวลา "ปี + ช่วงเดือน ตั้งแต่–ถึง" — รูปแบบเดียวกับแท็บ Damage Rate
 * (เจ้าของงานสั่ง 24 ก.ย. 2569 ให้ Demo · เที่ยววิ่งเปล่า · การใช้ประโยชน์กองรถ · ต้นทุนที่จม · ตัน-กม. · รายละเอียดข้อ 3 ใช้แบบเดียวกัน)
 *
 *   ปี ค.ศ. ว่าง = ทุกปี · ช่วงเดือน "01".."12" เลือกได้เฉพาะเมื่อเลือกปี (ล้างปี = ล้างช่วงเดือนกลับเป็นทั้งปี)
 *   ช่วงเดือนต้องไม่กลับหัว (from ≤ to) — หน้าจอบังคับตอนเลือก
 *
 * ★ รายวัน (Executive Dashboard · เจ้าของงานสั่ง 29 ก.ย. 2569 — ปี → เดือน → วัน): d1 = วันเริ่มในเดือน from · d2 = วันสุดท้ายในเดือน to
 *   ว่าง = ทั้งเดือน · ใช้ได้เมื่อเลือกปีแล้ว · รายการที่มีวันที่ (`d` "YYYY-MM-DD") กรองถึงระดับวัน
 *   รายการที่มีแค่เดือน (ไฟล์ LF รุ่นที่ยังไม่มีวันที่ · ชุดกำไรลูกค้ารายเดือน) นับทั้งเดือนที่คร่อมช่วง
 */
import { TH_MONTHS } from "../record/date";

export interface Period {
  year: string; from: string; to: string;
  /** วันเริ่ม (ในเดือน from) / วันสุดท้าย (ในเดือน to) "01".."31" — ว่าง/ไม่มี = ทั้งเดือน */
  d1?: string; d2?: string;
}
export const PERIOD_ALL: Period = { year: "", from: "01", to: "12" };
export const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

/** เดือนของปี (ไม่ดูปี) อยู่ในช่วงไหม — ใช้กับชุดที่ต้องเทียบหลายปีช่วงเดือนเดียวกัน · ไม่เลือกปี = ผ่านเสมอ */
export function inMonths(mo: string, p: Period): boolean {
  if (!p.year) return true;
  const m = mo.slice(5, 7);
  return m >= p.from && m <= p.to;
}

/** จำนวนวันของเดือน "MM" ในปี ค.ศ. "YYYY" (ไม่มีปี = ปีไม่อธิกสุรทิน) */
export const daysIn = (year: string, mm: string): number => new Date(Date.UTC(Number(year) || 2001, Number(mm), 0)).getUTCDate();
const dd = (n: number): string => String(n).padStart(2, "0");

/** วันเริ่ม/วันสุดท้ายที่ใช้จริง (ว่าง = ต้นเดือน/สิ้นเดือน) */
export const dayFrom = (p: Period): string => p.d1 || "01";
export const dayTo = (p: Period): string => p.d2 || dd(daysIn(p.year, p.to));

/** เลือกวันแคบกว่าทั้งเดือนอยู่ไหม (วันเริ่มไม่ใช่ 1 หรือวันสุดท้ายไม่ใช่สิ้นเดือน) */
export const hasDays = (p: Period): boolean => !!p.year && (dayFrom(p) !== "01" || dayTo(p) !== dd(daysIn(p.year, p.to)));

/** วันที่ "YYYY-MM-DD" อยู่ในช่วงวันไหม — เทียบแค่เดือน-วัน (ใช้คู่กับตัวกรองปี/ignoreYear) · ไม่เลือกวัน = ผ่านเสมอ */
export function inDays(d: string, p: Period): boolean {
  if (!hasDays(p)) return true;
  const md = d.slice(5, 10);
  return md >= `${p.from}-${dayFrom(p)}` && md <= `${p.to}-${dayTo(p)}`;
}

/** ช่วงวันที่เต็มของตัวกรอง "YYYY-MM-DD" ทั้งสองปลาย · ไม่เลือกปี = null */
export function periodBounds(p: Period): { start: string; end: string } | null {
  if (!p.year) return null;
  return { start: `${p.year}-${p.from}-${dayFrom(p)}`, end: `${p.year}-${p.to}-${dayTo(p)}` };
}

/** รายการผ่านช่วงเวลาไหม — มีวันที่ (`d`) = ถึงระดับวัน · มีแค่เดือน = ทั้งเดือนที่คร่อมช่วง */
export function inPeriod(t: { y: number; mo: string; d?: string }, p: Period): boolean {
  if (!p.year) return true;
  return String(t.y) === p.year && inMonths(t.mo, p) && (!t.d || inDays(t.d, p));
}

/** เลือกช่วงแคบกว่าทั้งปีอยู่ไหม (ช่วงเดือนหรือช่วงวัน) */
export const isPartialYear = (p: Period): boolean => !!p.year && (p.from !== "01" || p.to !== "12" || hasDays(p));

/** เปลี่ยนปี — ล้างปีแล้วช่วงเดือน/วันกลับเป็นทั้งปี (เลือกเดือนโดยไม่มีปีไม่ได้) · เปลี่ยนปี = ล้างวัน (วันที่ 29 ก.พ. อาจไม่มี) */
export const withYear = <T extends Period>(p: T, year: string): T =>
  (year ? { ...p, year, d1: "", d2: "" } : { ...p, ...PERIOD_ALL, d1: "", d2: "" });
/** เปลี่ยนเดือนเริ่ม — ถ้าเลยเดือนท้าย ดันเดือนท้ายตามไป · ล้างวันเริ่ม (และวันสุดท้ายถ้าเดือนท้ายถูกดัน) */
export const withFrom = <T extends { from: string; to: string; d1?: string; d2?: string }>(p: T, from: string): T =>
  ({ ...p, from, to: p.to < from ? from : p.to, d1: "", d2: p.to < from ? "" : p.d2 });
export const withTo = <T extends { from: string; to: string; d2?: string }>(p: T, to: string): T => ({ ...p, to, d2: "" });
/** เปลี่ยนวันเริ่ม/วันสุดท้าย — เดือนเดียวกันแล้ววันกลับหัว ดันอีกฝั่งตาม */
export const withD1 = <T extends Period>(p: T, d1: string): T =>
  ({ ...p, d1, d2: p.from === p.to && p.d2 && p.d2 < d1 ? d1 : p.d2 });
export const withD2 = <T extends Period>(p: T, d2: string): T => ({ ...p, d2 });

/** ป้ายช่วงเดือน/วัน — "มี.ค." · "มี.ค.–พ.ค." · "1–15 พ.ค." · "20 เม.ย.–10 พ.ค." · ทั้งปี = "" */
export function monthsLabel(p: Period): string {
  if (!isPartialYear(p)) return "";
  const a = TH_MONTHS[Number(p.from) - 1], b = TH_MONTHS[Number(p.to) - 1];
  if (hasDays(p)) {
    const x = Number(dayFrom(p)), y = Number(dayTo(p));
    return p.from === p.to ? (x === y ? `${x} ${a}` : `${x}–${y} ${a}`) : `${x} ${a}–${y} ${b}`;
  }
  return p.from === p.to ? `${a}` : `${a}–${b}`;
}

/** ป้ายช่วงเวลาเต็ม — "ทุกปี" · "พ.ศ. 2569" · "พ.ศ. 2569 · มี.ค.–พ.ค." */
export function periodLabel(p: Period): string {
  if (!p.year) return "ทุกปี";
  const m = monthsLabel(p);
  return `พ.ศ. ${+p.year + 543}${m ? ` · ${m}` : ""}`;
}
