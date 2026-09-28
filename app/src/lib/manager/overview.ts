/**
 * ภาพรวมสาขาของ Manager Dashboard แบบหน้าเดียว — ตามไฟล์ "Dashboard ผู้จัดการสาขา.html" (เจ้าของงานส่ง 28 ก.ย. 2569)
 * เฉพาะส่วนที่ข้อมูลของโมเดลทำได้ (เจ้าของงานเลือก): แถบสรุปสถานการณ์ · KPI เคลม · การเงินเทียบช่วงก่อน · กราฟ 6 เดือน ·
 * ค่าใช้จ่ายตามหมวด · รายได้แยกตามลูกค้า · สถานะรถ · การ์ดต้นทุน — ส่วนในไฟล์ที่ไม่มีข้อมูล (ส่งตรงเวลา · พัสดุค้าง · COD ·
 * คนขับ · พรุ่งนี้) ไม่ทำ
 *
 * srcs = MgrSrc (ไฟล์ต้นทุน + ใบใหม่) ที่กรองสาขาแล้ว · ช่วงของ "ใน" ช่วง = วันปล่อยรถอยู่ในช่วง (กติกาเดียวกับ releasedIn)
 */
import { addDaysISO } from "../record/date";
import { COST_PART_LABELS } from "../forecast/forecast";
import type { CostParts } from "../forecast/forecast";
import { latestPeriod, periodRange, runEnd } from "./manager";
import type { MgrPeriod, MgrSrc, Range, Todo } from "./manager";
import type { DebtorRow } from "../data/useDebtors";

export const inRange = (d: string, r: Range): boolean => d >= r.start && d <= r.end;

/** ช่วงก่อนหน้าชนิดเดียวกัน — วันก่อน · เดือนก่อน · ไตรมาสก่อน · ปีก่อน */
export function prevPeriod(p: MgrPeriod): MgrPeriod {
  return latestPeriod(p.kind, addDaysISO(periodRange(p).start, -1));
}

/** % เปลี่ยนแปลงเทียบช่วงก่อน · ช่วงก่อนเป็น 0 = null */
export const pctChange = (cur: number, prev: number): number | null => (prev ? (cur - prev) / Math.abs(prev) * 100 : null);

/* ---------------- การเงิน ---------------- */

export interface FinTotals { n: number; rev: number; cost: number; profit: number }
export function finTotals(srcs: MgrSrc[], r: Range): FinTotals {
  const t: FinTotals = { n: 0, rev: 0, cost: 0, profit: 0 };
  for (const s of srcs) if (inRange(s.d, r)) { t.n++; t.rev += s.rev; t.cost += s.cost; t.profit += s.profit; }
  return t;
}

/** รายได้ vs ค่าใช้จ่ายรายเดือน n เดือน นับย้อนจากเดือนของ endISO (รวมเดือนนั้น) · เดือนไม่มีเที่ยว = 0 */
export function monthlyFin(srcs: MgrSrc[], endISO: string, n = 6): { mo: string; rev: number; cost: number }[] {
  const months: string[] = [];
  let y = Number(endISO.slice(0, 4)), m = Number(endISO.slice(5, 7));
  for (let i = 0; i < n; i++) {
    months.unshift(`${y}-${String(m).padStart(2, "0")}`);
    if (--m === 0) { m = 12; y--; }
  }
  const acc = new Map(months.map((mo) => [mo, { mo, rev: 0, cost: 0 }]));
  for (const s of srcs) {
    const a = acc.get(s.d.slice(0, 7));
    if (a) { a.rev += s.rev; a.cost += s.cost; }
  }
  return months.map((mo) => acc.get(mo)!);
}

/**
 * ค่าใช้จ่ายตามหมวด (COST_PART_LABELS) ของช่วง + สัดส่วนเฉลี่ยของ 6 เดือนก่อนช่วง
 * — ไฟล์ต้นแบบเทียบ "งบ" แต่โมเดลไม่มีงบ จึงเทียบค่าเฉลี่ยของตัวเองในอดีตแทน (เจ้าของงานเลือก 28 ก.ย. 2569)
 * share/avgShare = สัดส่วนของต้นทุนรวม (%) · avgShare null = อดีตไม่มีต้นทุน · "อื่น ๆ" ติดลบได้ (ส่วนต่าง)
 */
export function costByPart(srcs: MgrSrc[], r: Range, refMonths = 6) {
  const refEnd = addDaysISO(r.start, -1);
  const y = Number(r.start.slice(0, 4)), m = Number(r.start.slice(5, 7)) - 1 - refMonths;
  const refStart = `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}-01`;
  const cur = { parts: {} as Record<keyof CostParts, number>, cost: 0 };
  const ref = { parts: {} as Record<keyof CostParts, number>, cost: 0 };
  for (const s of srcs) {
    const box = inRange(s.d, r) ? cur : s.d >= refStart && s.d <= refEnd ? ref : null;
    if (!box) continue;
    box.cost += s.cost;
    for (const { key } of COST_PART_LABELS) box.parts[key] = (box.parts[key] ?? 0) + (s.parts[key] ?? 0);
  }
  return COST_PART_LABELS.map(({ key, label }) => ({
    key, label, v: cur.parts[key] ?? 0,
    share: cur.cost ? (cur.parts[key] ?? 0) / cur.cost * 100 : 0,
    avgShare: ref.cost ? (ref.parts[key] ?? 0) / ref.cost * 100 : null,
  }));
}

/** เคลม = บิลเคลียร์ของเที่ยวที่ปล่อยรถในช่วง (จำนวนรายการ · เที่ยวที่มี · มูลค่า) */
export function claimsIn(srcs: MgrSrc[], r: Range): { items: number; trips: number; amount: number } {
  let items = 0, trips = 0, amount = 0;
  for (const s of srcs) {
    if (!inRange(s.d, r) || !(s.clrN > 0 || s.clrAmt > 0)) continue;
    items += s.clrN; trips++; amount += s.clrAmt;
  }
  return { items, trips, amount };
}

/** การ์ดต้นทุน: ต้นทุนต่อเที่ยว · น้ำมันต่อ กม. · ต้นทุนต่อ กม. (เฉพาะเที่ยวที่รู้ระยะทาง) · Margin */
export function costKpis(srcs: MgrSrc[], r: Range) {
  let n = 0, cost = 0, rev = 0, profit = 0, km = 0, kmCost = 0, kmFuel = 0;
  for (const s of srcs) {
    if (!inRange(s.d, r)) continue;
    n++; cost += s.cost; rev += s.rev; profit += s.profit;
    if (s.km && s.km > 0) { km += s.km; kmCost += s.cost; kmFuel += s.parts.fuel ?? 0; }
  }
  return {
    perTrip: n ? cost / n : null, fuelPerKm: km ? kmFuel / km : null, costPerKm: km ? kmCost / km : null,
    margin: rev ? profit / rev * 100 : null,
  };
}

/* ---------------- รายได้แยกตามลูกค้า ---------------- */

/** ลดลงเกินเท่านี้เทียบช่วงก่อน = "เสี่ยงเสียลูกค้า" (ไฟล์ต้นแบบใช้ −12% เป็นตัวอย่าง) */
export const CUST_RISK_DROP = -10;
export interface CustRev { cust: string; br: string; amt: number; prev: number; change: number | null; risk: boolean }

/** ยอดวางบิลรายลูกค้าจากไฟล์ลูกหนี้ ในช่วง vs ช่วงก่อน · เรียงยอดมากไปน้อย · top3 = สัดส่วนของ 3 รายแรก (%) */
export function custRevenue(rows: DebtorRow[], r: Range, prev: Range): { list: CustRev[]; total: number; top3: number } {
  const m = new Map<string, CustRev>();
  for (const x of rows) {
    const cur = inRange(x.issue, r), old = inRange(x.issue, prev);
    if (!cur && !old) continue;
    const c = m.get(x.cust) ?? { cust: x.cust, br: x.br, amt: 0, prev: 0, change: null, risk: false };
    if (cur) c.amt += x.amount; else c.prev += x.amount;
    m.set(x.cust, c);
  }
  const list = [...m.values()].filter((c) => c.amt > 0 || c.prev > 0).map((c) => {
    const change = pctChange(c.amt, c.prev);
    return { ...c, change, risk: change != null && change <= CUST_RISK_DROP };
  }).sort((a, b) => b.amt - a.amt);
  const total = list.reduce((s, c) => s + c.amt, 0);
  const top3 = total ? list.slice(0, 3).reduce((s, c) => s + c.amt, 0) / total * 100 : 0;
  return { list, total, top3 };
}

/* ---------------- สถานะรถ ---------------- */

/**
 * รถของสาขา ณ วันสิ้นช่วง: วิ่งงาน = ทะเบียนที่มีเที่ยวกำลังวิ่งวันนั้น (กฎ tripEta) · ไม่พร้อมใช้งาน = สถานะในทะเบียนรถไม่ใช่ "ใช้งาน"
 * · ว่าง = ที่เหลือ · vehicles = ทะเบียนรถที่กรองสาขาแล้ว · srcs = เที่ยวของสาขา
 */
export function fleetStatusAt(vehicles: { plate: string; status: string }[], srcs: MgrSrc[], day: string) {
  const moving = new Set(srcs.filter((s) => s.pl && s.d <= day && runEnd(s.d, s.km) >= day).map((s) => s.pl));
  let running = 0, idle = 0, down = 0;
  for (const v of vehicles) {
    if (v.status !== "ใช้งาน") down++;
    else if (moving.has(v.plate)) running++;
    else idle++;
  }
  return { total: vehicles.length, running, idle, down };
}

/* ---------------- แถบสรุปสถานการณ์ ---------------- */

/** ระดับของช่วง: มีเรื่องแดง (ไม่ผ่านเกณฑ์/ค้างเกิน 30 วัน) = เสี่ยง · มีแค่เรื่องเหลือง = ควรติดตาม · ไม่มี = ปกติ */
export function verdictOf(todo: Todo, debts: boolean): { level: "bad" | "warn" | "ok"; count: number } {
  const red = (todo.fail ? 1 : 0) + (debts && todo.over30.bills ? 1 : 0);
  const yellow = (todo.topIssue ? 1 : 0) + (todo.est ? 1 : 0) + (debts && todo.soon.bills ? 1 : 0);
  return { level: red ? "bad" : yellow ? "warn" : "ok", count: red + yellow };
}
