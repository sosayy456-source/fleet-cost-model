/**
 * สูตรของแท็บ "ต้นทุนที่จมกับที่ว่าง" (Load Factor) — ตามเอกสาร lf_executive_dashboard.html
 * ส่วน "ข้อมูลสำหรับทีมโมเดล" หลังข้อแก้ 6 จุด (เจ้าของงานส่ง 22 ก.ย. 2569)
 *
 * ทุกอย่างคิดสดจาก LfTrip[] ที่กรองแล้ว — หน้าจอ (features/dash-costrev/lf/) ห้ามมีสูตรของตัวเอง
 *
 *   Idle Cost        = ต้นทุนรวม × MAX(0, 1 − Max LF)          (คิดไว้ใน LfTrip.idle ตอนโหลด)
 *   Recoverable      = ต้นทุนรวม × MAX(0, เป้า − Max LF)        (LfTrip.recov)
 *   Break-even LF    = Σต้นทุนรวม ÷ Σ(รายได้ ÷ Max LF)          ระดับกลุ่ม · c = 0 (ยังแยก VC ตามน้ำหนักไม่ได้)
 *   What-if          newLF = MIN(1, LF + Δ) เที่ยวที่ LF > 1 อยู่แล้วคงเดิม · ใช้ต้นทุนรวมทั้งสองฝั่ง
 *   เส้นประ 80%      แถวแรกที่ % สะสมของ Idle ≥ 80
 */
import type { LfTrip } from "../data/useLoadFactor";

/* ---------------- ยอดรวมของชุดที่กรอง ---------------- */
export interface LfSummary {
  n: number; cost: number; idle: number; recov: number;
  /** สัดส่วน Idle ต่อต้นทุนรวม (0–1) — "ทุก 100 บาท จม X บาท" = share × 100 */
  share: number;
  /** เที่ยวที่ LF ต่ำกว่าเป้าของกลุ่ม */
  below: number;
  avgLf: number; avgTg: number;
}

export function summarize(trips: LfTrip[]): LfSummary {
  let cost = 0, idle = 0, recov = 0, below = 0, lf = 0, tg = 0;
  for (const t of trips) {
    cost += t.cost; idle += t.idle; recov += t.recov; lf += t.lf; tg += t.tg;
    if (t.lf < t.tg) below++;
  }
  const n = trips.length;
  return { n, cost, idle, recov, share: cost ? idle / cost : 0, below, avgLf: n ? lf / n : 0, avgTg: n ? tg / n : 0 };
}

/* ---------------- ยุบตามกลุ่ม (ชนิดรถ / เส้นทาง) ---------------- */
export type LfGroupKey = "vk" | "rt";

export interface LfGroup {
  name: string; n: number; cost: number; idle: number; recov: number; profit: number;
  /** LF เฉลี่ย · เป้าเฉลี่ย (สัดส่วน) */
  lf: number; tg: number;
  /** Break-even LF ของกลุ่ม (สัดส่วน) · margin = lf − be (บวก = เผื่อไว้) */
  be: number; margin: number;
}

export function groupTrips(trips: LfTrip[], key: LfGroupKey): LfGroup[] {
  const m = new Map<string, { n: number; cost: number; idle: number; recov: number; profit: number; lf: number; tg: number; revFull: number }>();
  for (const t of trips) {
    const k = t[key];
    const g = m.get(k) ?? { n: 0, cost: 0, idle: 0, recov: 0, profit: 0, lf: 0, tg: 0, revFull: 0 };
    g.n++; g.cost += t.cost; g.idle += t.idle; g.recov += t.recov; g.profit += t.profit;
    g.lf += t.lf; g.tg += t.tg;
    // รายได้ที่จะได้ถ้าเต็ม 100% = รายได้ ÷ LF (ETL ตัด LF = 0 ทิ้งแล้ว)
    g.revFull += t.lf > 0 ? t.rev / t.lf : 0;
    m.set(k, g);
  }
  return [...m.entries()].map(([name, g]) => {
    const lf = g.lf / g.n, be = g.revFull > 0 ? g.cost / g.revFull : 0;
    return { name, n: g.n, cost: g.cost, idle: g.idle, recov: g.recov, profit: g.profit, lf, tg: g.tg / g.n, be, margin: lf - be };
  });
}

/* ---------------- จัดอันดับ + เส้นประ 80% ---------------- */
export interface LfRankRow extends LfGroup {
  /** สัดส่วน Idle ของกลุ่ม · สะสมถึงกลุ่มนี้ (0–1) · สัดส่วนจำนวนเที่ยว */
  share: number; cum: number; nShare: number;
}

export interface LfRank {
  rows: LfRankRow[];
  total: number; totalN: number;
  /** จำนวนแถวที่รวมกันได้ ≥ 80% ของ Idle — เส้นประวาดหลังแถวที่ k80 (ถ้า k80 < rows.length) */
  k80: number;
}

export function rankGroups(groups: LfGroup[]): LfRank {
  const total = groups.reduce((s, g) => s + g.idle, 0);
  const totalN = groups.reduce((s, g) => s + g.n, 0);
  const sorted = [...groups].sort((a, b) => b.idle - a.idle);
  let cum = 0, k80 = sorted.length, found = false;
  const rows = sorted.map((g, i) => {
    cum += g.idle;
    const c = total ? cum / total : 0;
    if (!found && c >= 0.8 - 1e-9) { found = true; k80 = i + 1; }
    return { ...g, share: total ? g.idle / total : 0, cum: c, nShare: totalN ? g.n / totalN : 0 };
  });
  return { rows, total, totalN, k80 };
}

/* ---------------- สถานะจุดคุ้มทุน ---------------- */
export type BeTone = "good" | "warn" | "bad";
/** แดง < 0 จุด · เหลือง 0–10 จุด · เขียว ≥ 10 จุด (เอกสารส่วนที่ 3) */
export const beTone = (margin: number): BeTone => (margin < 0 ? "bad" : margin < 0.10 ? "warn" : "good");
export const BE_LABEL: Record<BeTone, string> = { bad: "ต่ำกว่าคุ้มทุน", warn: "ใกล้คุ้มทุน", good: "ปลอดภัย" };

/* ---------------- 4 กลุ่มของกราฟจุด ---------------- */
export type Quad = "star" | "price" | "value" | "waste";
export const QUAD: Record<Quad, { name: string; act: string }> = {
  star: { name: "ดาวเด่น", act: "รักษาไว้ และขยายรูปแบบนี้ไปเส้นทางอื่น" },
  price: { name: "เต็มแต่กำไรน้อย", act: "ปัญหาอยู่ที่ราคาหรือต้นทุน ไม่ใช่การบรรทุก" },
  value: { name: "ว่างแต่กำไรดี", act: "สินค้ามูลค่าสูง ไม่ต้องรีบยัดของเพิ่ม" },
  waste: { name: "ว่างและกำไรน้อย", act: "รวมเที่ยว เปลี่ยนเป็นรถเล็ก หรือทบทวนเส้นทาง" },
};
export const QUAD_ORDER: Quad[] = ["star", "price", "value", "waste"];
export const quadOf = (full: boolean, profitable: boolean): Quad =>
  full ? (profitable ? "star" : "price") : (profitable ? "value" : "waste");

/** จุดหนึ่งจุดบนกราฟ — เที่ยวเดียว หรือกลุ่ม (ค่าเฉลี่ยต่อเที่ยว) */
export interface LfPoint {
  name: string; sub: string;
  /** แกน X: LF (โหมดค่าเฉลี่ย) หรือ LF − เป้า (โหมดเป้า) เป็นสัดส่วน */
  x: number;
  /** แกน Y: กำไรต่อเที่ยว (บาท) */
  y: number;
  /** ขนาดจุด = ต้นทุนรวม */
  size: number;
  n: number; idle: number; lf: number; tg: number; profit: number;
}

export type MatrixMode = "avg" | "target";

export function pointsOfTrips(trips: LfTrip[], mode: MatrixMode): LfPoint[] {
  return trips.map((t) => ({
    name: t.pl || t.id, sub: `${t.vk} · ${t.rt} · ${t.mo}`,
    x: mode === "avg" ? t.lf : t.lf - t.tg, y: t.profit, size: t.cost,
    n: 1, idle: t.idle, lf: t.lf, tg: t.tg, profit: t.profit,
  }));
}

export function pointsOfGroups(groups: LfGroup[], mode: MatrixMode, unit: string): LfPoint[] {
  return groups.map((g) => ({
    name: g.name, sub: `${unit} · ${g.n} เที่ยว`,
    x: mode === "avg" ? g.lf : g.lf - g.tg, y: g.profit / g.n, size: g.cost,
    n: g.n, idle: g.idle, lf: g.lf, tg: g.tg, profit: g.profit / g.n,
  }));
}

export interface MatrixResult {
  points: (LfPoint & { q: Quad })[];
  /** เส้นแบ่ง — โหมดค่าเฉลี่ย: LF เฉลี่ยกับกำไรเฉลี่ย (ถ่วงด้วยจำนวนเที่ยว) · โหมดเป้า: X = 0 */
  xLine: number; yLine: number;
  quads: Record<Quad, { n: number; points: number; idle: number }>;
}

export function matrix(points: LfPoint[], mode: MatrixMode): MatrixResult {
  const totalN = points.reduce((s, p) => s + p.n, 0) || 1;
  // ค่าเฉลี่ยถ่วงจำนวนเที่ยว — จุดกลุ่มแทนหลายเที่ยว จะได้เส้นแบ่งเดียวกับที่คิดจากรายเที่ยว
  const avgX = points.reduce((s, p) => s + p.x * p.n, 0) / totalN;
  const avgY = points.reduce((s, p) => s + p.y * p.n, 0) / totalN;
  const xLine = mode === "avg" ? avgX : 0, yLine = avgY;
  const quads: MatrixResult["quads"] = {
    star: { n: 0, points: 0, idle: 0 }, price: { n: 0, points: 0, idle: 0 },
    value: { n: 0, points: 0, idle: 0 }, waste: { n: 0, points: 0, idle: 0 },
  };
  const out = points.map((p) => {
    const q = quadOf(p.x >= xLine, p.y >= yLine);
    quads[q].n += p.n; quads[q].points++; quads[q].idle += p.idle;
    return { ...p, q };
  });
  return { points: out, xLine, yLine, quads };
}

/* ---------------- จำลองผล ---------------- */
export interface WhatIf {
  oldIdle: number; newIdle: number; saved: number; cost: number; avgCost: number;
  lfOld: number; lfNew: number; n: number;
  /** เที่ยวเทียบเท่า = ประหยัด ÷ ต้นทุนรวมเฉลี่ยต่อเที่ยว */
  tripsEq: number;
}

export function whatIf(trips: LfTrip[], delta: number): WhatIf {
  let oldIdle = 0, newIdle = 0, lfO = 0, lfN = 0, cost = 0;
  for (const t of trips) {
    const nl = Math.max(t.lf, Math.min(1, t.lf + delta));   // เกิน 100% อยู่แล้วคงเดิม
    oldIdle += t.idle;
    newIdle += t.cost * Math.max(0, 1 - nl);
    lfO += t.lf; lfN += nl; cost += t.cost;
  }
  const n = trips.length, avgCost = n ? cost / n : 0, saved = oldIdle - newIdle;
  return { oldIdle, newIdle, saved, cost, avgCost, lfOld: n ? lfO / n : 0, lfNew: n ? lfN / n : 0, n,
    tripsEq: avgCost ? saved / avgCost : 0 };
}

/* ---------------- แนวโน้มเทียบปี ---------------- */
export interface LfYearRow {
  year: number;
  /** เดือน 1–12 → LF เฉลี่ย (null = ไม่มีเที่ยว) */
  byMonth: (number | null)[];
  /** ช่วงเดือนเดียวกัน (เฉพาะเดือนที่ปีล่าสุดมีข้อมูล) — เทียบข้ามปีได้โดยตัดผลฤดูกาล */
  ytd: { n: number; lf: number; cost: number; idle: number; share: number } | null;
}

export interface LfTrend {
  years: LfYearRow[];
  /** เดือน (1–12) ที่ใช้เทียบ = เดือนที่ปีล่าสุดมีข้อมูล */
  months: number[];
}

export function trend(trips: LfTrip[]): LfTrend {
  const acc = new Map<number, Map<number, { n: number; lf: number; cost: number; idle: number }>>();
  for (const t of trips) {
    const m = Number(t.mo.slice(5));
    const y = acc.get(t.y) ?? new Map();
    const c = y.get(m) ?? { n: 0, lf: 0, cost: 0, idle: 0 };
    c.n++; c.lf += t.lf; c.cost += t.cost; c.idle += t.idle;
    y.set(m, c); acc.set(t.y, y);
  }
  const yearKeys = [...acc.keys()].sort();
  const latest = yearKeys[yearKeys.length - 1];
  const months = latest == null ? [] : [...acc.get(latest)!.keys()].sort((a, b) => a - b);
  const years = yearKeys.map((year) => {
    const y = acc.get(year)!;
    const byMonth = Array.from({ length: 12 }, (_, i) => { const c = y.get(i + 1); return c ? c.lf / c.n : null; });
    let n = 0, lf = 0, cost = 0, idle = 0;
    for (const m of months) { const c = y.get(m); if (c) { n += c.n; lf += c.lf; cost += c.cost; idle += c.idle; } }
    return { year, byMonth, ytd: n ? { n, lf: lf / n, cost, idle, share: cost ? idle / cost : 0 } : null };
  });
  return { years, months };
}
