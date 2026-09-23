/**
 * ต้นทุนพยากรณ์ของเที่ยวใหม่ — ค่าเฉลี่ยต้นทุนจริงของข้อมูลเก่า N เดือนล่าสุด
 * (สเปก "ปรับปรุงโมเดล" 22 ก.ย. 2569 · เจ้าของงานเคาะฐานข้อมูล = ไฟล์ต้นทุนรายเที่ยว costrev/trips.json)
 *
 * ใช้สองที่: กล่องสรุปของฝ่ายจัดรถ (แทนกล่องต้นทุนที่ตัดออก) และป็อบอัพ "จริงเทียบพยากรณ์" ของฝ่ายบัญชี
 *
 * วิธีคิด — ไล่จากละเอียดไปหยาบ ใช้ชั้นแรกที่มีข้อมูลพอ:
 *   1. เส้นทาง × ชนิดรถ   (ตรงตามสเปก)
 *   2. ชนิดรถ              (เส้นทางนั้นยังไม่เคยมีรถชนิดนี้วิ่ง)
 *   3. เส้นทาง             (ชนิดรถใหม่ที่ไม่มีประวัติ)
 *   4. ค่าเฉลี่ยทั้งชุด     (ข้อมูลน้อยมาก)
 * ทุกชั้นคืน "ต้นทุนเฉลี่ยต่อเที่ยว" แยกตามกลุ่มต้นทุนด้วย เพื่อให้เทียบกับต้นทุนจริงรายกลุ่มได้
 *
 * ★ ไม่รวมเที่ยววิ่งเปล่า — เที่ยวเปล่าไม่มีรายได้และโครงสร้างต้นทุนต่างจากเที่ยวปกติ
 *   ถ้านับรวมค่าเฉลี่ยจะต่ำกว่าความจริง
 * ★ จำนวนเดือนตั้งค่าได้ในหน้า "การตั้งค่า" (ค่าเริ่มต้น 5 เดือน) — นับจากเดือนล่าสุดที่มีในไฟล์
 *   ไม่ใช่เดือนปัจจุบัน เพราะไฟล์ข้อมูลเก่าตัดยอดไว้ที่เดือนหนึ่งแล้วไม่ขยับตามเวลา
 */
import type { Trip } from "../data/useCostRev";

/** คีย์ของกลุ่มต้นทุนที่พยากรณ์ — ชุดเดียวกับที่แดชบอร์ดต้นทุนใช้ */
export interface CostParts {
  fuel: number; allow: number; fee: number; repair: number; dep: number; rent: number; waste: number;
  /** ส่วนที่เหลือจากต้นทุนรวม — ค่าแก๊ส/Fleet Card/เพิ่มย้อนหลัง ฯลฯ */
  other: number;
}

/**
 * ชื่อกลุ่มต้นทุนตามลำดับที่แสดง — ใช้ทั้งหน้าจัดรถ (รายละเอียดต้นทุนพยากรณ์) และป็อบอัพ "จริงเทียบพยากรณ์"
 * ของฝ่ายบัญชี ห้ามเขียนรายการนี้ซ้ำในหน้าจอ ไม่งั้นสองหน้าจะเรียกกลุ่มเดียวกันคนละชื่อ
 */
export const COST_PART_LABELS: { key: keyof CostParts; label: string }[] = [
  { key: "fuel", label: "ค่าน้ำมัน" },
  { key: "allow", label: "ค่าเบี้ยเลี้ยง/ค่าแรง" },
  { key: "fee", label: "ค่าธรรมเนียม" },
  { key: "repair", label: "ค่าซ่อม" },
  { key: "dep", label: "ค่าเสื่อม" },
  { key: "rent", label: "ค่าเช่า" },
  { key: "waste", label: "ต้นทุนสูญเปล่า" },
  { key: "other", label: "อื่น ๆ" },
];

export interface ForecastResult {
  /** ต้นทุนรวมเฉลี่ยต่อเที่ยว (บาท) */
  cost: number;
  parts: CostParts;
  /** จำนวนเที่ยวที่ใช้หาค่าเฉลี่ย */
  n: number;
  /** ชั้นที่ใช้จริง — เอาไว้บอกผู้ใช้ว่าตัวเลขมาจากอะไร */
  basis: "route-kind" | "kind" | "route" | "all";
  /** ข้อความอธิบายที่มา */
  note: string;
  /** ช่วงเดือนที่ใช้ */
  from: string; to: string;
}

const EMPTY_PARTS: CostParts = { fuel: 0, allow: 0, fee: 0, repair: 0, dep: 0, rent: 0, waste: 0, other: 0 };

const partsOf = (t: Trip): CostParts => ({
  fuel: t.fuel, allow: t.allow, fee: t.fee, repair: t.repair, dep: t.dep, rent: t.rent, waste: t.waste,
  other: t.cost - t.fuel - t.allow - t.fee - t.repair - t.dep - t.rent - t.waste,
});

/** ค่าเริ่มต้นของจำนวนเดือนย้อนหลัง — สเปกเขียน "5 เดือนล่าสุด (ม.ค.-พ.ค.)" */
export const DEFAULT_FORECAST_MONTHS = 5;
const KEY = "forecastMonths";

export function getForecastMonths(): number {
  const v = Number(localStorage.getItem(KEY));
  return Number.isFinite(v) && v >= 1 && v <= 36 ? Math.round(v) : DEFAULT_FORECAST_MONTHS;
}

export function setForecastMonths(n: number): void {
  try { localStorage.setItem(KEY, String(Math.max(1, Math.min(36, Math.round(n))))); } catch { /* โหมดส่วนตัว */ }
}

/** ชุดเที่ยวที่อยู่ใน N เดือนล่าสุดของไฟล์ (ไม่รวมเที่ยววิ่งเปล่า) */
export function recentTrips(trips: Trip[], months: number): { rows: Trip[]; from: string; to: string } {
  const mos = [...new Set(trips.map((t) => t.mo))].sort();
  const keep = new Set(mos.slice(-Math.max(1, months)));
  const rows = trips.filter((t) => keep.has(t.mo) && !t.empty);
  const kept = [...keep].sort();
  return { rows, from: kept[0] ?? "", to: kept[kept.length - 1] ?? "" };
}

const avg = (rows: Trip[]): { cost: number; parts: CostParts } => {
  if (!rows.length) return { cost: 0, parts: { ...EMPTY_PARTS } };
  const acc: CostParts = { ...EMPTY_PARTS };
  let cost = 0;
  for (const t of rows) {
    cost += t.cost;
    const p = partsOf(t);
    for (const k of Object.keys(acc) as (keyof CostParts)[]) acc[k] += p[k];
  }
  const n = rows.length;
  for (const k of Object.keys(acc) as (keyof CostParts)[]) acc[k] = Math.round(acc[k] / n * 100) / 100;
  return { cost: Math.round(cost / n * 100) / 100, parts: acc };
};

/** ตารางค่าเฉลี่ยที่คิดครั้งเดียวแล้วใช้ซ้ำได้ทุกเที่ยว */
export interface ForecastTable {
  months: number; from: string; to: string; n: number;
  byRouteKind: Map<string, Trip[]>;
  byKind: Map<string, Trip[]>;
  byRoute: Map<string, Trip[]>;
  all: Trip[];
}

const routeKey = (origin: string, dest: string): string => `${origin}→${dest}`;

export function buildForecast(trips: Trip[], months = getForecastMonths()): ForecastTable {
  const { rows, from, to } = recentTrips(trips, months);
  const byRouteKind = new Map<string, Trip[]>();
  const byKind = new Map<string, Trip[]>();
  const byRoute = new Map<string, Trip[]>();
  const push = (m: Map<string, Trip[]>, k: string, t: Trip) => {
    const list = m.get(k);
    if (list) list.push(t); else m.set(k, [t]);
  };
  for (const t of rows) {
    const rk = routeKey(t.o, t.de);
    push(byRouteKind, `${rk}|${t.vk}`, t);
    push(byKind, t.vk, t);
    push(byRoute, rk, t);
  }
  return { months, from, to, n: rows.length, byRouteKind, byKind, byRoute, all: rows };
}

/** ต้นทุนพยากรณ์ของเที่ยวหนึ่ง — เส้นทาง + ชนิดรถ */
export function forecastFor(tb: ForecastTable, origin: string, dest: string, kind: string): ForecastResult {
  const rk = routeKey(origin, dest);
  const tries: { rows: Trip[] | undefined; basis: ForecastResult["basis"]; note: string }[] = [
    { rows: tb.byRouteKind.get(`${rk}|${kind}`), basis: "route-kind", note: `เส้นทาง ${rk} · ${kind}` },
    { rows: tb.byKind.get(kind), basis: "kind", note: `ชนิดรถ ${kind} ทุกเส้นทาง (เส้นทางนี้ยังไม่มีประวัติของรถชนิดนี้)` },
    { rows: tb.byRoute.get(rk), basis: "route", note: `เส้นทาง ${rk} ทุกชนิดรถ (ยังไม่มีประวัติของรถชนิดนี้)` },
    { rows: tb.all, basis: "all", note: "ค่าเฉลี่ยทุกเที่ยวในช่วงที่เลือก (ยังไม่มีประวัติที่ตรงกว่านี้)" },
  ];
  for (const t of tries) {
    if (t.rows && t.rows.length) {
      const a = avg(t.rows);
      return { ...a, n: t.rows.length, basis: t.basis, note: t.note, from: tb.from, to: tb.to };
    }
  }
  return { cost: 0, parts: { ...EMPTY_PARTS }, n: 0, basis: "all",
    note: "ยังไม่มีข้อมูลเก่าให้พยากรณ์", from: tb.from, to: tb.to };
}
