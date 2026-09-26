/**
 * สูตรของ Manager Dashboard (เจ้าของงานส่งสเปก 26 ก.ย. 2569 · หน้าจอ features/dash-manager/)
 *
 * ★ ข้อมูล = ไฟล์ต้นทุน (costrev · ชุด inProfitScope) + Load Factor จากไฟล์ LF จับคู่ด้วยเลขที่ใบรายการ
 *   ไม่ใช้ใบที่บันทึกใหม่ในโมเดล (เจ้าของงาน: หน้านี้ให้ผู้จัดการดูรายวัน/รายเดือนของสาขา)
 *   เที่ยววิ่งเปล่าไม่มีในไฟล์ LF → LF = 0% (ไม่ผ่านเกณฑ์) · เที่ยวอื่นที่จับคู่ไม่ได้ = "ไม่มี LF" ไม่นับเข้าสามสี
 * ★ ช่วงเวลา = วัน / เดือน / ไตรมาส ที่เลือก (ค่าตั้งต้น = ช่วงล่าสุดที่ไฟล์มีข้อมูล ไม่ใช่วันนี้ — ไฟล์เป็นข้อมูลย้อนหลัง)
 * ★ แท็บหน้างาน = เที่ยว "กำลังวิ่ง" ในช่วง = ช่วงวิ่ง [วันปล่อยรถ, วันที่คาดว่าถึง] ทับช่วงที่เลือก
 *   วันที่คาดว่าถึงใช้กฎเดียวกับสถานะกองรถ (lib/record/tripEta.ts): + max(1, ⌈ระยะทาง ÷ 500⌉) วัน ·
 *   ไม่รู้ระยะทาง = วิ่งแค่วันปล่อยรถ
 *   แท็บการเงิน = เที่ยวที่ **ปล่อยรถ** ในช่วง (นับเข้าช่วงเดียว ไม่ซ้ำข้ามเดือน)
 * ★ เกณฑ์ Load Factor ของหน้านี้ ≥ 70% ผ่าน · 40–<70% เฝ้าระวัง · < 40% ไม่ผ่าน (ตามสเปก — ต่างจาก Performance Index 84/47)
 * ★ ลูกหนี้ = ไฟล์ลูกหนี้ บิลที่ **วางในช่วง** · สถานะ ณ วันสุดท้ายของช่วง (lib/debtors/aging.ts ตัวเดียวกับ Customer Performance)
 *   DSO มาตรฐาน = ยอดค้าง ÷ ยอดวางบิล × จำนวนวัน (วันแรกของช่วง → วันอ้างอิง)
 */
import { addDaysISO } from "../record/date";
import { KM_PER_DAY } from "../record/tripEta";
import { ageBills, dayNum } from "../debtors/aging";
import type { Aged } from "../debtors/aging";
import type { Trip } from "../data/useCostRev";
import type { DebtorRow } from "../data/useDebtors";

/* ---------------- ช่วงเวลา ---------------- */

export type PeriodKind = "day" | "month" | "quarter";
/** value: วัน "YYYY-MM-DD" · เดือน "YYYY-MM" · ไตรมาส "YYYY-Qn" */
export interface MgrPeriod { kind: PeriodKind; value: string }
export interface Range { start: string; end: string }

const pad = (n: number): string => String(n).padStart(2, "0");
const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function periodRange(p: MgrPeriod): Range {
  if (p.kind === "day") return { start: p.value, end: p.value };
  if (p.kind === "month") {
    const [y, m] = p.value.split("-").map(Number);
    return { start: `${p.value}-01`, end: `${p.value}-${pad(lastDay(y!, m!))}` };
  }
  const y = Number(p.value.slice(0, 4)), q = Number(p.value.slice(-1));
  const m1 = (q - 1) * 3 + 1, m3 = m1 + 2;
  return { start: `${y}-${pad(m1)}-01`, end: `${y}-${pad(m3)}-${pad(lastDay(y, m3))}` };
}

const quarterOf = (iso: string): string => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

/** ช่วงล่าสุดที่มีข้อมูล — วันสุดท้ายในไฟล์ / เดือนของวันนั้น / ไตรมาสของวันนั้น */
export function latestPeriod(kind: PeriodKind, maxDate: string): MgrPeriod {
  return { kind, value: kind === "day" ? maxDate : kind === "month" ? maxDate.slice(0, 7) : quarterOf(maxDate) };
}

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const be = (y: number | string): number => Number(y) + 543;

export function periodLabel(p: MgrPeriod): string {
  if (p.kind === "day") {
    const [y, m, d] = p.value.split("-");
    return `${Number(d)} ${TH_MONTH[Number(m) - 1]} ${be(y!)}`;
  }
  if (p.kind === "month") return `${TH_MONTH[Number(p.value.slice(5, 7)) - 1]} ${be(p.value.slice(0, 4))}`;
  return `ไตรมาส ${p.value.slice(-1)}/${be(p.value.slice(0, 4))}`;
}

/** ตัวเลือกเดือน/ไตรมาสในช่วงข้อมูล ใหม่สุดขึ้นก่อน */
export function periodOptions(kind: "month" | "quarter", minDate: string, maxDate: string): MgrPeriod[] {
  const out: MgrPeriod[] = [];
  let y = Number(minDate.slice(0, 4)), m = Number(minDate.slice(5, 7));
  const yEnd = Number(maxDate.slice(0, 4)), mEnd = Number(maxDate.slice(5, 7));
  const seen = new Set<string>();
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    const v = kind === "month" ? `${y}-${pad(m)}` : quarterOf(`${y}-${pad(m)}-01`);
    if (!seen.has(v)) { seen.add(v); out.push({ kind, value: v }); }
    if (++m > 12) { m = 1; y++; }
  }
  return out.reverse();
}

/* ---------------- เที่ยว ---------------- */

export type LfBand = "g" | "y" | "r";
/** เกณฑ์ของหน้านี้ — LF เป็น % */
export const lfBand = (lf: number): LfBand => (lf >= 70 ? "g" : lf >= 40 ? "y" : "r");
export const LF_BAND_LABEL: Record<LfBand | "na", string> = {
  g: "ผ่านเกณฑ์", y: "เฝ้าระวัง", r: "ไม่ผ่านเกณฑ์", na: "ไม่มี LF",
};

export const NO_BRANCH = "ไม่ระบุสาขา";
export const branchOf = (br: string): string => br || NO_BRANCH;

export interface MgrTrip {
  id: string; br: string; d: string;
  /** วันสุดท้ายที่ถือว่ายังวิ่ง */
  eta: string;
  o: string; de: string;
  /** Load Factor (%) · null = ไม่มีในไฟล์ LF */
  lf: number | null;
  band: LfBand | null;
  rev: number; cost: number; profit: number;
  empty: boolean;
}

/** วันสุดท้ายของช่วงวิ่ง — กฎเดียวกับ tripEta() · ไม่รู้ระยะทาง = วันปล่อยรถ */
export const runEnd = (d: string, km: number | null): string =>
  km && km > 0 ? addDaysISO(d, Math.max(1, Math.ceil(km / KM_PER_DAY))) : d;

/** เที่ยวของไฟล์ต้นทุน + LF จากไฟล์ LF (สัดส่วน 0–1.3 → %) · ผู้เรียกกรอง inProfitScope มาแล้ว */
export function buildTrips(trips: Trip[], lfById: ReadonlyMap<string, number>): MgrTrip[] {
  return trips.filter((t) => t.d).map((t) => {
    const raw = lfById.get(t.id);
    const lf = t.empty ? 0 : raw == null ? null : raw * 100;
    return {
      id: t.id, br: branchOf(t.br), d: t.d, eta: runEnd(t.d, t.km), o: t.o, de: t.de,
      lf, band: lf == null ? null : lfBand(lf), rev: t.rev, cost: t.cost, profit: t.profit, empty: t.empty,
    };
  });
}

/** กำลังวิ่งในช่วง = ช่วงวิ่งทับช่วงที่เลือก */
export const onRoad = (t: MgrTrip, r: Range): boolean => t.d <= r.end && t.eta >= r.start;
/** ปล่อยรถในช่วง */
export const releasedIn = (t: MgrTrip, r: Range): boolean => t.d >= r.start && t.d <= r.end;

export interface LfSummary { n: number; g: number; y: number; r: number; na: number }
export function lfSummary(ts: MgrTrip[]): LfSummary {
  const s: LfSummary = { n: ts.length, g: 0, y: 0, r: 0, na: 0 };
  for (const t of ts) s[t.band ?? "na"]++;
  return s;
}

export interface FinSummary { n: number; rev: number; cost: number; profit: number }
export function finSummary(ts: MgrTrip[]): FinSummary {
  const s: FinSummary = { n: ts.length, rev: 0, cost: 0, profit: 0 };
  for (const t of ts) { s.rev += t.rev; s.cost += t.cost; s.profit += t.profit; }
  return s;
}

/** จัดกลุ่มตามสาขา — ตารางเปรียบเทียบของผู้ดูแลระบบ */
export function byBranch<T extends { br: string }, S>(items: T[], sum: (xs: T[]) => S): (S & { br: string })[] {
  const m = new Map<string, T[]>();
  for (const x of items) { const a = m.get(x.br); if (a) a.push(x); else m.set(x.br, [x]); }
  return [...m].map(([br, xs]) => ({ ...sum(xs), br }));
}

/* ---------------- ลูกหนี้ ---------------- */

export type DebtStatus = "notdue" | "late30" | "late31" | "paid";
export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  notdue: "ยังไม่ถึงกำหนด", late30: "เกินกำหนด 1–30 วัน", late31: "เกินกำหนด 31 วันขึ้นไป", paid: "ชำระแล้ว",
};

export interface MgrBill { doc: string; cust: string; br: string; amount: number; issue: string; due: string;
  /** วันที่ค้างเกินกำหนด ณ วันอ้างอิง — ยังไม่ถึงกำหนด/ชำระแล้ว = 0 */
  overdue: number; status: DebtStatus }

const statusOf = (a: Aged): DebtStatus =>
  a.status === "paid" ? "paid" : a.status === "notdue" ? "notdue" : a.over <= 30 ? "late30" : "late31";

/** บิลที่วางในช่วง พร้อมสถานะ ณ วันสุดท้ายของช่วง */
export function billsInPeriod(rows: DebtorRow[], r: Range): MgrBill[] {
  return ageBills(rows, r.end).filter((a) => a.r.issue >= r.start).map((a) => {
    const status = statusOf(a);
    return { doc: a.r.doc, cust: a.r.cust, br: branchOf(a.r.br), amount: a.r.amount, issue: a.r.issue, due: a.r.due,
      overdue: status === "late30" || status === "late31" ? a.over : 0, status };
  });
}

export interface DebtSummary {
  billed: number; outstanding: number; late30: number; late31: number;
  /** null = ไม่มีบิลในช่วง */
  dso: number | null; days: number;
}

/** ยอดค้างรวม = ยังไม่ชำระทั้งหมด (รวมยังไม่ถึงกำหนด) · DSO = ยอดค้าง ÷ ยอดวางบิล × วัน */
export function debtSummary(bills: MgrBill[], r: Range): DebtSummary {
  let billed = 0, outstanding = 0, late30 = 0, late31 = 0;
  for (const b of bills) {
    billed += b.amount;
    if (b.status !== "paid") outstanding += b.amount;
    if (b.status === "late30") late30 += b.amount;
    if (b.status === "late31") late31 += b.amount;
  }
  const days = dayNum(r.end) - dayNum(r.start) + 1;
  return { billed, outstanding, late30, late31, dso: billed > 0 ? outstanding / billed * days : null, days };
}
