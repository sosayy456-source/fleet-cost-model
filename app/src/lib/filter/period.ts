/**
 * ตัวกรองช่วงเวลา "ปี + ช่วงเดือน ตั้งแต่–ถึง" — รูปแบบเดียวกับแท็บ Damage Rate
 * (เจ้าของงานสั่ง 24 ก.ย. 2569 ให้ Demo · เที่ยววิ่งเปล่า · การใช้ประโยชน์กองรถ · ต้นทุนที่จม · ตัน-กม. · รายละเอียดข้อ 3 ใช้แบบเดียวกัน)
 *
 *   ปี ค.ศ. ว่าง = ทุกปี · ช่วงเดือน "01".."12" เลือกได้เฉพาะเมื่อเลือกปี (ล้างปี = ล้างช่วงเดือนกลับเป็นทั้งปี)
 *   ช่วงเดือนต้องไม่กลับหัว (from ≤ to) — หน้าจอบังคับตอนเลือก
 */
import { TH_MONTHS } from "../record/date";

export interface Period { year: string; from: string; to: string }
export const PERIOD_ALL: Period = { year: "", from: "01", to: "12" };
export const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

/** เดือนของปี (ไม่ดูปี) อยู่ในช่วงไหม — ใช้กับชุดที่ต้องเทียบหลายปีช่วงเดือนเดียวกัน · ไม่เลือกปี = ผ่านเสมอ */
export function inMonths(mo: string, p: Period): boolean {
  if (!p.year) return true;
  const m = mo.slice(5, 7);
  return m >= p.from && m <= p.to;
}

export function inPeriod(t: { y: number; mo: string }, p: Period): boolean {
  if (!p.year) return true;
  return String(t.y) === p.year && inMonths(t.mo, p);
}

/** เลือกช่วงเดือนแคบกว่าทั้งปีอยู่ไหม */
export const isPartialYear = (p: Period): boolean => !!p.year && (p.from !== "01" || p.to !== "12");

/** เปลี่ยนปี — ล้างปีแล้วช่วงเดือนกลับเป็นทั้งปี (เลือกเดือนโดยไม่มีปีไม่ได้) */
export const withYear = <T extends Period>(p: T, year: string): T =>
  (year ? { ...p, year } : { ...p, ...PERIOD_ALL });
/** เปลี่ยนเดือนเริ่ม — ถ้าเลยเดือนท้าย ดันเดือนท้ายตามไป */
export const withFrom = <T extends { from: string; to: string }>(p: T, from: string): T => ({ ...p, from, to: p.to < from ? from : p.to });
export const withTo = <T extends { from: string; to: string }>(p: T, to: string): T => ({ ...p, to });

/** ป้ายช่วงเดือน — "มี.ค." · "มี.ค.–พ.ค." · ทั้งปี = "" */
export function monthsLabel(p: Period): string {
  if (!isPartialYear(p)) return "";
  const a = TH_MONTHS[Number(p.from) - 1], b = TH_MONTHS[Number(p.to) - 1];
  return p.from === p.to ? `${a}` : `${a}–${b}`;
}

/** ป้ายช่วงเวลาเต็ม — "ทุกปี" · "พ.ศ. 2569" · "พ.ศ. 2569 · มี.ค.–พ.ค." */
export function periodLabel(p: Period): string {
  if (!p.year) return "ทุกปี";
  const m = monthsLabel(p);
  return `พ.ศ. ${+p.year + 543}${m ? ` · ${m}` : ""}`;
}
