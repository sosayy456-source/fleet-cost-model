/**
 * กำไรส่วนเกินต่อตัน-กม. (Contribution per ton-km) — สไลด์ที่เจ้าของงานส่ง 23 ก.ย. 2569
 * ใช้ชุด loadfactor/ (ไฟล์เดียวกับแท็บ "ต้นทุนที่จมกับที่ว่าง") · หน้าจอห้ามมีสูตรของตัวเอง
 *
 *   ตัน-กม.        = น้ำหนักจริง (ตัน) × ระยะทาง (กม.)
 *   Contribution   = รายได้ − VC                       ไม่หัก FC (ค่าซ่อมตามเวลา + ค่าเสื่อม)
 *   อัตรา           = ΣContribution ÷ Σตัน-กม.          ★ รวมก่อนแล้วค่อยหาร ห้ามเฉลี่ยอัตรารายเที่ยว
 *                                                      (เที่ยวขนน้อยได้อัตราสูงผิดปกติ ชุดตัวอย่าง: ถูก 2.75 · เฉลี่ยตรง ๆ 4.56)
 *   Baseline       = 0.4 × อัตรา(ปี Y−2) + 0.6 × อัตรา(ปี Y−1)   ต่อชนิดรถ · ทั้งปี · **ไม่ใช้ปี Y** (กัน data leakage)
 *                    ปี Y = ปีที่กำลังวัด (สไลด์: ฐาน 2024/2025 วัด 2026)
 *                    มีปีฐานปีเดียว = ใช้อัตราปีนั้นปีเดียว ติดป้าย "1ปี" · ไม่มีเลย = "ไม่มีฐาน"
 *                    (สไลด์: "ชนิดรถที่อัตราไม่ครบ 2024+2025 → ติดป้าย 1ปี/ไม่มีฐาน" — เจ้าของงานยืนยัน 23 ก.ย. 2569)
 *                    ปีแรกของข้อมูลจึงไม่มีฐานเสมอ ปีที่สองได้ฐาน 1ปี ตั้งแต่ปีที่สามได้ 2ปี
 *   เป้าหมาย        = Baseline × (1 + X/100)             X ผู้ใช้กรอกเอง (ค่าเริ่มต้น 5)
 *   สถานะ           ≥ 100% ของเป้า = ถึงเป้า · 80–99% = ใกล้เป้า · < 80% = ต่ำกว่าเป้ามาก
 *
 * ★ Baseline ≤ 0 (สถานะ vcloss) ไม่คิดเป้า/% (เจ้าของงานเลือกทาง ก. 23 ก.ย. 2569) — Baseline × 1.05 ของค่าลบ
 *   ได้เป้าที่ "ขาดทุนมากขึ้น" และ ลบ ÷ ลบ = บวก ทำให้ยิ่งขาดทุนหนัก % ยิ่งสูงจนขึ้นสีเขียว
 *   ป้ายแสดง "ต่ำกว่าเป้า" ตามคำในสไลด์ (เจ้าของงานเปลี่ยนจาก "ขาดทุนผันแปร" วันเดียวกัน) และนับรวมในการ์ด
 *   "ต่ำกว่าเป้าเฉพาะตัว" — แต่คอลัมน์เป้า/% ยังเป็น "–" เพราะไม่มีเป้าที่มีความหมาย
 * ★ นับเฉพาะเที่ยวที่ตัน-กม. > 0 — วิ่งเปล่า/ไม่มีน้ำหนักหารไม่ได้ (ชุดตัวอย่าง 14 เที่ยว)
 *   ETL ตัดสถานะข้อมูลอื่นนอกจาก ปกติ/เฝ้าระวัง ทิ้งไปแล้วเหมือนแท็บ Load Factor
 */
import type { LfTrip } from "../data/useLoadFactor";

export const tonKmOf = (t: LfTrip): number => (t.km != null && t.wt != null ? t.km * t.wt : 0);
export const contribOf = (t: LfTrip): number => t.rev - (t.vc ?? 0);

/** ไฟล์มีคอลัมน์ครบให้คิดได้ไหม — trips.json รุ่นก่อน 23 ก.ย. 2569 ไม่มี */
export const hasTonKm = (trips: LfTrip[]): boolean =>
  trips.length > 0 && trips.every((t) => t.km != null && t.wt != null && t.vc != null);

/* ---------------- ยอดรวม ---------------- */
export interface TkAgg {
  /** จำนวนเที่ยวที่นับ (ตัน-กม. > 0) */
  n: number;
  contrib: number;
  tk: number;
  /** ΣContribution ÷ Σตัน-กม. · null = ไม่มีเที่ยวให้หาร */
  rate: number | null;
}

export function aggregate(trips: Iterable<LfTrip>): TkAgg {
  let n = 0, contrib = 0, tk = 0;
  for (const t of trips) {
    const k = tonKmOf(t);
    if (k <= 0) continue;
    n++; contrib += contribOf(t); tk += k;
  }
  return { n, contrib, tk, rate: tk > 0 ? contrib / tk : null };
}

function groupBy(trips: Iterable<LfTrip>, key: (t: LfTrip) => string): Map<string, TkAgg> {
  const acc = new Map<string, { n: number; contrib: number; tk: number }>();
  for (const t of trips) {
    const k = tonKmOf(t);
    if (k <= 0) continue;
    const id = key(t);
    const a = acc.get(id) ?? { n: 0, contrib: 0, tk: 0 };
    a.n++; a.contrib += contribOf(t); a.tk += k;
    acc.set(id, a);
  }
  const out = new Map<string, TkAgg>();
  for (const [id, a] of acc) out.set(id, { ...a, rate: a.tk > 0 ? a.contrib / a.tk : null });
  return out;
}

/* ---------------- เป้าหมาย + สถานะ ---------------- */
/** น้ำหนักของปีฐาน [ปี Y−2, ปี Y−1] — ปีใกล้ได้น้ำหนักมากกว่า */
export const BASE_W = [0.4, 0.6] as const;
export const DEFAULT_X = 5;

/** จำนวนปีฐานที่ใช้คิด — 2 = สูตร 40/60 · 1 = ปีเดียว · 0 = ไม่มีฐาน */
export type BaseYears = 0 | 1 | 2;

export function baselineOf(rY2: number | null, rY1: number | null): { base: number | null; baseN: BaseYears } {
  if (rY2 != null && rY1 != null) return { base: BASE_W[0] * rY2 + BASE_W[1] * rY1, baseN: 2 };
  if (rY1 != null) return { base: rY1, baseN: 1 };
  if (rY2 != null) return { base: rY2, baseN: 1 };
  return { base: null, baseN: 0 };
}

export type TkStatus = "ok" | "near" | "far" | "vcloss" | "nobase" | "nodata";

export const STATUS_LABEL: Record<TkStatus, string> = {
  ok: "ถึงเป้า",
  near: "ใกล้เป้า",
  far: "ต่ำกว่าเป้ามาก",
  vcloss: "ต่ำกว่าเป้า",
  nobase: "ไม่มีฐาน",
  nodata: "ไม่มีเที่ยว",
};

export interface TkJudge { status: TkStatus; target: number | null; pctOfTarget: number | null }

export function judge(rate: number | null, base: number | null, x: number): TkJudge {
  if (rate == null) return { status: "nodata", target: null, pctOfTarget: null };
  if (base == null) return { status: "nobase", target: null, pctOfTarget: null };
  if (base <= 0) return { status: "vcloss", target: null, pctOfTarget: null };
  const target = base * (1 + x / 100);
  const p = rate / target;
  return { status: p >= 1 ? "ok" : p >= 0.8 ? "near" : "far", target, pctOfTarget: p * 100 };
}

/** ต่ำกว่าเป้าเฉพาะตัว = มีเป้าแล้วไม่ถึง + Baseline ≤ 0 (ป้าย "ต่ำกว่าเป้า" เหมือนกัน) */
export const isBelow = (s: TkStatus): boolean => s === "near" || s === "far" || s === "vcloss";
/** ชนิดรถที่ตัดสินเทียบเป้าได้ — ตัวหารของการ์ด "ต่ำกว่าเป้าเฉพาะตัว" (ไม่มีฐาน/ไม่มีเที่ยว ไม่นับ) */
export const isJudged = (s: TkStatus): boolean => s !== "nobase" && s !== "nodata";

/* ---------------- ช่วงเวลา ---------------- */
export interface TkPeriod {
  /** ปี ค.ศ. */
  year: number;
  /** ช่วงเดือน "01"–"12" (from ≤ to) · 01–12 = ทั้งปี — เปลี่ยนจากเดือนเดียวเป็นช่วงเดือน 24 ก.ย. 2569 */
  from: string; to: string;
}

const inPeriod = (t: LfTrip, p: TkPeriod): boolean => {
  const m = t.mo.slice(5);
  return t.y === p.year && m >= p.from && m <= p.to;
};
export const isWholeYear = (p: TkPeriod): boolean => p.from === "01" && p.to === "12";

/** เดือนล่าสุดที่มีข้อมูล — การ์ดใน Demo ใช้ช่วงนี้เสมอ */
export function latestPeriod(trips: LfTrip[]): TkPeriod | null {
  let mo = "";
  for (const t of trips) if (t.mo > mo) mo = t.mo;
  return mo ? { year: Number(mo.slice(0, 4)), from: mo.slice(5), to: mo.slice(5) } : null;
}

/**
 * ช่วงที่การ์ดควรแสดงตามตัวกรอง ปี + ช่วงเดือน ของหน้า (Demo หน้ายาว — เจ้าของงานเลือก 24 ก.ย. 2569 ให้ตามตัวกรอง)
 *   เลือกปี → ช่วงเดือนนั้นของปีนั้น (ทั้งปีถ้าไม่ได้แคบลง) · ไม่เลือกปี → เดือนล่าสุดของไฟล์ (latestPeriod เหมือนเดิม)
 *   ช่วงที่ไม่มีข้อมูล = null · เลือกเดือนโดยไม่เลือกปีไม่ได้แล้ว (ตัวกรองแบบ Damage Rate)
 */
export function periodFor(trips: LfTrip[], year: string, from = "01", to = "12"): TkPeriod | null {
  if (!year) return latestPeriod(trips);
  const p = { year: Number(year), from, to };
  return trips.some((t) => inPeriod(t, p)) ? p : null;
}

/**
 * ช่วงก่อนหน้าไว้เทียบ = **ช่วงเดือนเดียวกันของปีก่อน** (เจ้าของงานเลือก 24 ก.ย. 2569 ตอนเปลี่ยนเป็นช่วงเดือน —
 * เดิมเลือกเดือนเดียวเทียบเดือนก่อน) · ทั้งปี = ปีก่อนทั้งปีเหมือนเดิม
 */
export function prevPeriod(p: TkPeriod): TkPeriod {
  return { ...p, year: p.year - 1 };
}

/* ---------------- รายชนิดรถของช่วงที่เลือก ---------------- */
export interface VkRow extends TkJudge {
  vk: string;
  /** ยอดของช่วงที่เลือก */
  cur: TkAgg;
  /** อัตราทั้งปีของปีฐาน Y−2 / Y−1 */
  rY2: number | null; rY1: number | null;
  base: number | null; baseN: BaseYears;
}

/**
 * ชนิดรถที่มีเที่ยวในช่วงที่เลือก — **ดึงจากข้อมูลล้วน ไม่มีรายชื่อตายตัว** ไฟล์ใหม่มีชนิดรถเพิ่มก็ขึ้นแถวเอง
 * ชนิดที่ไม่มีเที่ยวในช่วงนั้นไม่แสดง (เจ้าของงานยืนยัน 23 ก.ย. 2569)
 * Baseline ใช้ทั้งปีของปี Y−2 / Y−1 เสมอ แม้ช่วงที่เลือกจะเป็นเดือนเดียว (ตามสไลด์)
 */
export function vehicleRows(trips: LfTrip[], p: TkPeriod, x: number): VkRow[] {
  const cur = groupBy(trips.filter((t) => inPeriod(t, p)), (t) => t.vk);
  const y2 = groupBy(trips.filter((t) => t.y === p.year - 2), (t) => t.vk);
  const y1 = groupBy(trips.filter((t) => t.y === p.year - 1), (t) => t.vk);
  return [...cur.entries()].map(([vk, a]) => {
    const rY2 = y2.get(vk)?.rate ?? null, rY1 = y1.get(vk)?.rate ?? null;
    const b = baselineOf(rY2, rY1);
    return { vk, cur: a, rY2, rY1, ...b, ...judge(a.rate, b.base, x) };
  });
}

/* ---------------- การ์ด 4 ใบ ---------------- */
export interface TkOverview {
  period: TkPeriod;
  all: TkAgg;
  /** ช่วงก่อนหน้า (null = ไม่มีข้อมูล) · change = % เปลี่ยนของอัตรา */
  prev: TkPeriod; prevAll: TkAgg; change: number | null;
  rows: VkRow[];
  best: VkRow | null; worst: VkRow | null;
  below: number;
}

export function overview(trips: LfTrip[], p: TkPeriod, x: number): TkOverview {
  const all = aggregate(trips.filter((t) => inPeriod(t, p)));
  const prev = prevPeriod(p);
  const prevAll = aggregate(trips.filter((t) => inPeriod(t, prev)));
  // % เปลี่ยนเทียบค่าสัมบูรณ์ของฐาน — ช่วงก่อนติดลบแล้วดีขึ้นต้องได้บวก ไม่ใช่กลับเครื่องหมาย
  const change = all.rate != null && prevAll.rate != null && prevAll.rate !== 0
    ? (all.rate - prevAll.rate) / Math.abs(prevAll.rate) * 100 : null;
  const rows = vehicleRows(trips, p, x);
  const rated = rows.filter((r) => r.cur.rate != null).sort((a, b) => b.cur.rate! - a.cur.rate!);
  return {
    period: p, all, prev, prevAll, change, rows,
    best: rated[0] ?? null, worst: rated.length > 1 ? rated[rated.length - 1]! : null,
    below: rows.filter((r) => isBelow(r.status)).length,
  };
}

/* ---------------- ตารางรายปี × ชนิดรถ ---------------- */
export interface YearRow extends TkJudge {
  year: number; vk: string; agg: TkAgg; base: number | null; baseN: BaseYears;
  /** อัตราทั้งปีของปี Y−2 / Y−1 — ป็อบอัพโชว์ที่มาของ Baseline */
  rY2: number | null; rY1: number | null;
}

/** ทุกปี × ชนิดรถ ทั้งปี — Baseline ของปี Y ใช้ Y−2/Y−1 (ปีที่สองของข้อมูลได้ฐาน 1ปี · ปีแรกไม่มีฐาน) */
export function yearRows(trips: LfTrip[], x: number): YearRow[] {
  const g = groupBy(trips, (t) => `${t.y}|${t.vk}`);
  const rate = (y: number, vk: string) => g.get(`${y}|${vk}`)?.rate ?? null;
  return [...g.entries()].map(([k, agg]) => {
    const [ys, vk = ""] = k.split("|");
    const year = Number(ys);
    const rY2 = rate(year - 2, vk), rY1 = rate(year - 1, vk);
    const b = baselineOf(rY2, rY1);
    return { year, vk, agg, rY2, rY1, ...b, ...judge(agg.rate, b.base, x) };
  });
}

/* ---------------- ป็อบอัพรายละเอียดของหนึ่งแถว (ปี × ชนิดรถ) ---------------- */
export interface TkTripRow {
  id: string; mo: string; rt: string; pl: string; ft: string;
  wt: number; km: number; tk: number; rev: number; vc: number; contrib: number;
  /** อัตรารายเที่ยว — ดูประกอบเท่านั้น ยอดรวมของกลุ่มต้องใช้ ΣContribution ÷ Σตัน-กม. */
  rate: number;
}

export interface TkDetail {
  months: { mo: string; agg: TkAgg }[];
  routes: { rt: string; agg: TkAgg }[];
  trips: TkTripRow[];
  /** เที่ยวในกลุ่มนี้ที่ไม่นับเพราะตัน-กม. = 0 */
  skipped: number;
}

export function detailOf(trips: LfTrip[], year: number, vk: string): TkDetail {
  const mine = trips.filter((t) => t.y === year && t.vk === vk);
  const rows: TkTripRow[] = [];
  let skipped = 0;
  for (const t of mine) {
    const tk = tonKmOf(t);
    if (tk <= 0) { skipped++; continue; }
    const contrib = contribOf(t);
    rows.push({ id: t.id, mo: t.mo, rt: t.rt, pl: t.pl, ft: t.ft, wt: t.wt ?? 0, km: t.km ?? 0, tk,
      rev: t.rev, vc: t.vc ?? 0, contrib, rate: contrib / tk });
  }
  const months = [...groupBy(mine, (t) => t.mo).entries()].map(([mo, agg]) => ({ mo, agg })).sort((a, b) => a.mo.localeCompare(b.mo));
  const routes = [...groupBy(mine, (t) => t.rt).entries()].map(([rt, agg]) => ({ rt, agg }));
  return { months, routes, trips: rows, skipped };
}
