/**
 * สูตรของ Manager Dashboard (เจ้าของงานส่งสเปก 26 ก.ย. 2569 · หน้าจอ features/dash-manager/)
 *
 * ★ ข้อมูล = ไฟล์ต้นทุน (costrev · ชุด inProfitScope) + Load Factor จากไฟล์ LF จับคู่ด้วยเลขที่ใบรายการ
 *   + ใบที่บันทึกใหม่ในโมเดลที่ไฟล์ยังไม่มี (recordSrc · เจ้าของงานสั่ง 27 ก.ย. 2569 — เดิม 26 ก.ย. ใช้แต่ไฟล์)
 *   เที่ยววิ่งเปล่าไม่มีในไฟล์ LF → LF = 0% (ไม่ผ่านเกณฑ์) · เที่ยวอื่นที่จับคู่ไม่ได้ = "ไม่มี LF" ให้สีตาม Margin อย่างเดียว
 * ★ สีของแท็บหน้างาน = สถานะรวม LF + Margin (overallBand · 27 ก.ย. 2569 — เดิมดู LF อย่างเดียว เที่ยวแดงกำไรดีกว่าเที่ยวเขียวได้)
 *   + คำแนะนำรายเที่ยว (tripAdvice) ชี้ด้านการบรรทุก และกลุ่มต้นทุน/รายได้ที่ผิดจากค่าเฉลี่ยเส้นทาง × ชนิดรถ
 * ★ ช่วงเวลา = วัน / เดือน / ไตรมาส / ปี ที่เลือก (ค่าตั้งต้น = ช่วงล่าสุดที่มีข้อมูล ทั้งไฟล์และใบใหม่ ไม่ใช่วันนี้)
 * ★ แท็บหน้างาน = เที่ยว "กำลังวิ่ง" ในช่วง = ช่วงวิ่ง [วันปล่อยรถ, วันที่คาดว่าถึง] ทับช่วงที่เลือก
 *   วันที่คาดว่าถึงใช้กฎเดียวกับสถานะกองรถ (lib/record/tripEta.ts): + max(1, ⌈ระยะทาง ÷ 500⌉) วัน ·
 *   ไม่รู้ระยะทาง = วิ่งแค่วันปล่อยรถ
 *   แท็บการเงิน = เที่ยวที่ **ปล่อยรถ** ในช่วง (นับเข้าช่วงเดียว ไม่ซ้ำข้ามเดือน)
 * ★ เกณฑ์ Load Factor ของหน้านี้ ≥ 70% ผ่าน · 40–<70% เฝ้าระวัง · < 40% ไม่ผ่าน (ตามสเปก — ต่างจาก Performance Index 84/47)
 * ★ ลูกหนี้ = ไฟล์ลูกหนี้ · ยอดคงค้าง ณ วันสิ้นช่วง แบ่งอายุหนี้ (lib/debtors/aging.ts ตัวเดียวกับ Customer Performance)
 *   DSO มาตรฐาน = ลูกหนี้คงค้าง ณ สิ้นช่วง ÷ ยอดวางบิลในช่วง × จำนวนวันในช่วง — ดูหัวข้อลูกหนี้ท้ายไฟล์
 */
import { addDaysISO } from "../record/date";
import { KM_PER_DAY } from "../record/tripEta";
import { ageBills, dayNum } from "../debtors/aging";
import { COST_PART_LABELS, forecastFor, partsOf, recordParts } from "../forecast/forecast";
import type { CostParts, ForecastTable } from "../forecast/forecast";
import { roleDone } from "../record/roles";
import type { TripRecord } from "../../types/record";
import type { Trip } from "../data/useCostRev";
import type { DebtorRow } from "../data/useDebtors";

/* ---------------- ช่วงเวลา ---------------- */

export type PeriodKind = "day" | "month" | "quarter" | "year";
/** value: วัน "YYYY-MM-DD" · เดือน "YYYY-MM" · ไตรมาส "YYYY-Qn" · ปี "YYYY" */
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
  if (p.kind === "year") return { start: `${p.value}-01-01`, end: `${p.value}-12-31` };
  const y = Number(p.value.slice(0, 4)), q = Number(p.value.slice(-1));
  const m1 = (q - 1) * 3 + 1, m3 = m1 + 2;
  return { start: `${y}-${pad(m1)}-01`, end: `${y}-${pad(m3)}-${pad(lastDay(y, m3))}` };
}

const quarterOf = (iso: string): string => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

/** ช่วงล่าสุดที่มีข้อมูล — วันสุดท้ายในไฟล์ / เดือน / ไตรมาส / ปีของวันนั้น */
export function latestPeriod(kind: PeriodKind, maxDate: string): MgrPeriod {
  return { kind, value: kind === "day" ? maxDate : kind === "month" ? maxDate.slice(0, 7) : kind === "year" ? maxDate.slice(0, 4) : quarterOf(maxDate) };
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
  if (p.kind === "year") return `ปี ${be(p.value)}`;
  return `ไตรมาส ${p.value.slice(-1)}/${be(p.value.slice(0, 4))}`;
}

/** ตัวเลือกเดือน/ไตรมาส/ปีในช่วงข้อมูล ใหม่สุดขึ้นก่อน */
export function periodOptions(kind: "month" | "quarter" | "year", minDate: string, maxDate: string): MgrPeriod[] {
  const out: MgrPeriod[] = [];
  let y = Number(minDate.slice(0, 4)), m = Number(minDate.slice(5, 7));
  const yEnd = Number(maxDate.slice(0, 4)), mEnd = Number(maxDate.slice(5, 7));
  if (kind === "year") {
    for (let year = yEnd; year >= y; year--) out.push({ kind, value: String(year) });
    return out;
  }
  const seen = new Set<string>();
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    const v = kind === "month" ? `${y}-${pad(m)}` : quarterOf(`${y}-${pad(m)}-01`);
    if (!seen.has(v)) { seen.add(v); out.push({ kind, value: v }); }
    if (++m > 12) { m = 1; y++; }
  }
  return out.reverse();
}

/* ---------------- เที่ยว ---------------- */

export type Band = "g" | "y" | "r";
/** เกณฑ์ LF ของหน้านี้ — LF เป็น % */
export const lfBand = (lf: number): Band => (lf >= 70 ? "g" : lf >= 40 ? "y" : "r");
/** เกณฑ์ Margin — ชุดเดียวกับ Performance Index (> 10 / 5–10 / < 5 · 10 พอดี = เหลือง) */
export const marginBand = (m: number): Band => (m > 10 ? "g" : m >= 5 ? "y" : "r");
/** Margin (%) ของเที่ยว — รายได้ 0 แล้วขาดทุน = −100 (กติกาเดียวกับ routeMargin) · รายได้ 0 ไม่ขาดทุน = null */
export const marginOf = (rev: number, profit: number): number | null =>
  rev > 0 ? profit / rev * 100 : profit < 0 ? -100 : null;

const PTS: Record<Band, number> = { g: 1, y: 0.5, r: 0 };
/**
 * สถานะรวมของแท็บหน้างาน (เจ้าของงานเลือก 27 ก.ย. 2569) — คะแนน LF + Margin (เขียว 1 · เหลือง 0.5 · แดง 0)
 * ≥ 1.5 ผ่าน · 1 เฝ้าระวัง · ≤ 0.5 ไม่ผ่าน · **ขาดทุน = ไม่ผ่านเสมอ** · ไม่มี LF = ตาม Margin อย่างเดียว
 */
export function overallBand(lfb: Band | null, mb: Band | null, margin: number | null): Band | null {
  if (margin != null && margin < 0) return "r";
  if (lfb == null) return mb;
  if (mb == null) return lfb;
  const s = PTS[lfb] + PTS[mb];
  return s >= 1.5 ? "g" : s >= 1 ? "y" : "r";
}
export const BAND_LABEL: Record<Band | "na", string> = {
  g: "ผ่านเกณฑ์", y: "เฝ้าระวัง", r: "ไม่ผ่านเกณฑ์", na: "ไม่มีข้อมูล",
};

export const NO_BRANCH = "ไม่ระบุสาขา";
export const branchOf = (br: string): string => br || NO_BRANCH;

export interface MgrTrip {
  id: string; br: string; d: string;
  /** วันสุดท้ายที่ถือว่ายังวิ่ง */
  eta: string;
  o: string; de: string; vk: string;
  /** Load Factor (%) · null = ไม่มีข้อมูล LF */
  lf: number | null;
  lfb: Band | null;
  /** Margin (%) · null = รายได้และกำไรเป็น 0 */
  margin: number | null;
  mb: Band | null;
  /** สถานะรวม LF + Margin (overallBand) · null = ไม่มีทั้งสองอย่าง */
  band: Band | null;
  /** คำแนะนำว่าควรปรับที่จุดไหน (tripAdvice) */
  advice: string[];
  /** ปัญหาของเที่ยวเป็นคีย์ (tripAdvice) — ใช้นับ/กรองในแถบสรุปปัญหา · ว่าง = ไม่มีปัญหา */
  issues: IssueKey[];
  rev: number; cost: number; profit: number;
  empty: boolean;
  /** file = ไฟล์ของบริษัท · new = ใบที่บันทึกใหม่ในโมเดล (บันทึกบิล → จัดรถ → ฝ่ายบัญชี) */
  src: "file" | "new";
  /** ต้นทุนเป็นพยากรณ์ — ใบใหม่ที่ฝ่ายบัญชียังไม่ได้กรอกค่าใช้จ่าย */
  costEst: boolean;
}

/** วันสุดท้ายของช่วงวิ่ง — กฎเดียวกับ tripEta() · ไม่รู้ระยะทาง = วันปล่อยรถ */
export const runEnd = (d: string, km: number | null): string =>
  km && km > 0 ? addDaysISO(d, Math.max(1, Math.ceil(km / KM_PER_DAY))) : d;

/** เที่ยวก่อนแปลงเป็น MgrTrip — ทั้งสองแหล่งแปลงมาเป็นรูปนี้ก่อน แล้วผ่านเกณฑ์/คำแนะนำชุดเดียวกัน */
export interface MgrSrc {
  id: string; br: string; d: string; km: number | null; o: string; de: string; rt: string; vk: string;
  rev: number; cost: number; profit: number; empty: boolean; parts: CostParts;
  /** ทะเบียนรถคันที่ 1 · บิลเคลียร์ (จำนวนรายการ · มูลค่า) — ภาพรวมสาขา (lib/manager/overview.ts) · ใบใหม่ไม่มีบิลเคลียร์ = 0 */
  pl: string; clrN: number; clrAmt: number;
  /** Load Factor (%) · null = ไม่มี */
  lf: number | null;
  src: MgrTrip["src"]; costEst: boolean;
}

/* ---------------- คำแนะนำ ---------------- */

/** ค่าเฉลี่ยต่อเที่ยวที่ใช้เทียบ — เส้นทาง × ชนิดรถ ถ้ามี ≥ BENCH_MIN เที่ยว ไม่งั้นชนิดรถ */
export interface Bench { n: number; basis: "route-kind" | "kind"; rev: number; parts: CostParts }
export const BENCH_MIN = 3;
/** กลุ่มต้นทุนที่ชี้ได้ = สูงกว่าเฉลี่ย ≥ 20% และเกิน ≥ 300 บาท (ตัด "อื่น ๆ" — เป็นส่วนต่าง ติดลบได้ แก้ไม่ได้ตรง ๆ) */
export const OVER_PCT = 20;
export const OVER_BAHT = 300;
/** รายได้ต่ำกว่าเฉลี่ย ≥ 20% = ชี้ด้านราคา */
export const UNDER_REV_PCT = 20;

type BenchKey = { rt: string; vk: string };
/** ตารางค่าเฉลี่ยจากเที่ยวของไฟล์ทั้งไฟล์ (ไม่รวมเที่ยวเปล่า · ทุกสาขา · ทุกช่วงเวลา) — ใบใหม่เทียบกับฐานเดียวกันนี้ */
export function buildBench(rows: MgrSrc[]): (t: BenchKey) => Bench | null {
  const acc = (list: MgrSrc[], basis: Bench["basis"]): Bench => {
    const parts: CostParts = { fuel: 0, allow: 0, fee: 0, repair: 0, dep: 0, rent: 0, waste: 0, other: 0 };
    let rev = 0;
    for (const t of list) {
      rev += t.rev;
      for (const k of Object.keys(parts) as (keyof CostParts)[]) parts[k] += t.parts[k];
    }
    for (const k of Object.keys(parts) as (keyof CostParts)[]) parts[k] /= list.length;
    return { n: list.length, basis, rev: rev / list.length, parts };
  };
  const group = (key: (t: MgrSrc) => string) => {
    const m = new Map<string, MgrSrc[]>();
    for (const t of rows) if (!t.empty) { const k = key(t); const a = m.get(k); if (a) a.push(t); else m.set(k, [t]); }
    return m;
  };
  const rk = group((t) => `${t.rt}|${t.vk}`), kd = group((t) => t.vk);
  const cache = new Map<string, Bench | null>();
  return (t) => {
    const key = `${t.rt}|${t.vk}`;
    if (!cache.has(key)) {
      const a = rk.get(key), b = kd.get(t.vk);
      cache.set(key, a && a.length >= BENCH_MIN ? acc(a, "route-kind") : b && b.length >= BENCH_MIN ? acc(b, "kind") : null);
    }
    return cache.get(key)!;
  };
}

const pctTxt = (x: number): string => `${Math.round(x)}%`;
const bahtTxt = (x: number): string => Math.round(x).toLocaleString("en-US");

/**
 * คำแนะนำรายเที่ยว (เจ้าของงานขอ 27 ก.ย. 2569) — ด้าน LF บอกเรื่องการบรรทุก · ด้าน Margin ชี้กลุ่มต้นทุนที่สูงกว่าเฉลี่ย
 * ของเส้นทาง × ชนิดรถเดียวกัน (หรือชนิดรถ) และรายได้ที่ต่ำกว่าเฉลี่ย · ไม่เจอจุดผิดปกติ = ให้ทบทวนราคา
 * ต้นทุนพยากรณ์ (ใบใหม่ที่ฝ่ายบัญชียังไม่กรอก) ไม่ชี้กลุ่มต้นทุน — พยากรณ์คือค่าเฉลี่ยอยู่แล้ว
 */
export function tripAdvice(t: MgrSrc, lfb: Band | null, mb: Band | null, margin: number | null, bench: Bench | null):
  { advice: string[]; issues: IssueKey[] } {
  if (t.empty) return { advice: ["เที่ยววิ่งเปล่า — หางานขากลับหรือรวมกับเที่ยวอื่น"], issues: ["empty"] };
  const out: string[] = [], issues: IssueKey[] = [];
  if (lfb === "r") { out.push("รถว่างมาก — รวมบิลเส้นทางเดียวกันเพิ่มหรือใช้รถคันเล็กลง"); issues.push("lfLow"); }
  else if (lfb === "y") { out.push("ยังเติมสินค้าได้อีก"); issues.push("lfMid"); }
  if (margin != null && margin < 0) issues.push("loss");
  if (mb && mb !== "g") {
    const head = margin != null && margin < 0 ? "ขาดทุน" : mb === "r" ? "Margin ต่ำมาก" : "Margin ต่ำ";
    const points: string[] = [];
    if (bench) {
      if (bench.rev > 0 && t.rev < bench.rev * (1 - UNDER_REV_PCT / 100)) {
        points.push(`รายได้ต่ำกว่าเฉลี่ย ${pctTxt((1 - t.rev / bench.rev) * 100)}`);
        issues.push("revLow");
      }
      if (!t.costEst) {
        const over = COST_PART_LABELS.filter(({ key }) => key !== "other").map(({ key, label }) => {
          const a = bench.parts[key], v = t.parts[key], ex = v - a;
          return { key, label, a, v, ex, ok: ex >= OVER_BAHT && (a <= 0 || v >= a * (1 + OVER_PCT / 100)) };
        }).filter((x) => x.ok).sort((x, y) => y.ex - x.ex).slice(0, 2);
        for (const x of over) {
          points.push(x.a > 0 ? `${x.label}สูงกว่าเฉลี่ย ${pctTxt((x.v / x.a - 1) * 100)} (+${bahtTxt(x.ex)} บาท)`
            : `มี${x.label} ${bahtTxt(x.v)} บาท (ปกติแทบไม่มี)`);
          issues.push(`cost:${x.key}`);
        }
      }
    }
    if (!points.length) issues.push("price");
    out.push(points.length ? `${head}: ${points.join(" · ")}`
      : t.costEst ? `${head} (ต้นทุนพยากรณ์) — ทบทวนราคาค่าขนส่ง` : `${head} — ต้นทุนใกล้ค่าเฉลี่ย ทบทวนราคาค่าขนส่ง`);
  }
  if (!out.length) out.push(lfb == null ? "Margin ดี" : "ดี — คงรูปแบบนี้ไว้");
  if (t.costEst) { out.push("รอฝ่ายบัญชีกรอกค่าใช้จ่าย (ตอนนี้ใช้ต้นทุนพยากรณ์)"); issues.push("costEst"); }
  return { advice: out, issues };
}

/* ---------------- สรุปปัญหา + สิ่งที่ต้องจัดการ (เจ้าของงานสั่ง 27 ก.ย. 2569) ---------------- */

/** ปัญหาของเที่ยวเป็นคีย์ — ออกมาจาก tripAdvice ชุดเดียวกับข้อความคำแนะนำ (ไม่แยกตีความข้อความ) */
export type IssueKey = "empty" | "lfLow" | "lfMid" | "loss" | "revLow" | "price" | "costEst" | `cost:${keyof CostParts}`;
export function issueLabel(k: IssueKey): string {
  if (k.startsWith("cost:")) {
    const part = COST_PART_LABELS.find((x) => x.key === k.slice(5));
    return `${part?.label ?? k.slice(5)}สูงกว่าเฉลี่ย`;
  }
  return ({ empty: "เที่ยววิ่งเปล่า", lfLow: "รถว่างมาก (LF < 40%)", lfMid: "ยังเติมสินค้าได้ (LF 40–70%)", loss: "ขาดทุน",
    revLow: "รายได้ต่ำกว่าเฉลี่ย", price: "Margin ต่ำแต่ต้นทุนปกติ (ทบทวนราคา)", costEst: "รอฝ่ายบัญชีกรอกค่าใช้จ่าย" } as Record<string, string>)[k] ?? k;
}
/** นับเที่ยวต่อปัญหา มากไปน้อย */
export function issueCounts(trips: MgrTrip[]): { key: IssueKey; n: number }[] {
  const m = new Map<IssueKey, number>();
  for (const t of trips) for (const k of new Set(t.issues)) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** บิลครบกำหนดภายในกี่วัน = "ใกล้ครบกำหนด" (ตามรอบโทรเตือนรายสัปดาห์) */
export const DUE_SOON_DAYS = 7;
export const dueSoon = (b: MgrBill): boolean => b.dueIn != null && b.dueIn <= DUE_SOON_DAYS;

/** กล่อง "ต้องจัดการ" บนสุดของ Manager Dashboard — นับจากชุดเดียวกับสองแท็บ (เที่ยวที่กำลังวิ่ง · ลูกหนี้คงค้าง ณ สิ้นช่วง) */
export interface Todo {
  fail: number; failLoss: number; est: number;
  topIssue: { key: IssueKey; n: number } | null;
  over30: { cust: number; amount: number; bills: number };
  soon: { cust: number; amount: number; bills: number };
}
export function managerTodo(running: MgrTrip[], open: MgrBill[]): Todo {
  const grp = (bs: MgrBill[]) => ({ cust: new Set(bs.map((b) => b.cust)).size, amount: bs.reduce((s, b) => s + b.amount, 0), bills: bs.length });
  // ปัญหาที่พบบ่อยสุด ไม่นับที่มีรายการของตัวเองในกล่องแล้ว (ขาดทุน · รอฝ่ายบัญชี)
  const top = issueCounts(running).find((x) => x.key !== "loss" && x.key !== "costEst") ?? null;
  return {
    fail: running.filter((t) => t.band === "r").length,
    failLoss: running.filter((t) => t.band === "r" && t.profit < 0).length,
    est: running.filter((t) => t.costEst).length,
    topIssue: top,
    over30: grp(open.filter((b) => b.status === "late60" || b.status === "late61")),
    soon: grp(open.filter(dueSoon)),
  };
}

/** เที่ยวของไฟล์ต้นทุน + LF จากไฟล์ LF (สัดส่วน 0–1.3 → %) · ผู้เรียกกรอง inProfitScope มาแล้ว */
export function fileSrc(trips: Trip[], lfById: ReadonlyMap<string, number>): MgrSrc[] {
  return trips.filter((t) => t.d).map((t) => {
    const raw = lfById.get(t.id);
    return {
      id: t.id, br: t.br, d: t.d, km: t.km, o: t.o, de: t.de, rt: t.rt, vk: t.vk,
      rev: t.rev, cost: t.cost, profit: t.profit, empty: t.empty, parts: partsOf(t),
      pl: t.pl ?? "", clrN: t.clrN ?? 0, clrAmt: t.clrAmt ?? 0,
      lf: t.empty ? 0 : raw == null ? null : raw * 100, src: "file", costEst: false,
    };
  });
}

/**
 * ใบที่บันทึกใหม่ในโมเดล (เจ้าของงานสั่ง 27 ก.ย. 2569) — ใช้เฉพาะใบที่มีเลขที่ใบรายการ และ**ไม่มีในไฟล์ของบริษัท**
 * (เลขซ้ำ = ใช้ไฟล์) · วันที่ = วันปล่อยรถ (ไม่มีใช้วันที่ใบ) · LF = น้ำหนักบรรทุก ÷ ความจุ (กก.) ที่หน้าจัดรถบันทึกไว้ ·
 * เที่ยวเปล่า (emptyLeg) = LF 0% · ฝ่ายบัญชีกรอกแล้ว = ต้นทุนจริง (normal + waste ชุดเดียวกับป็อบอัพรายละเอียดเที่ยว)
 * ยังไม่กรอก = ต้นทุนพยากรณ์ (forecastFor · เส้นทาง × ชนิดรถ แบบหน้าจัดรถ) ติดธง costEst
 */
export function recordSrc(records: TripRecord[], fileIds: ReadonlySet<string>, fc: ForecastTable | null): MgrSrc[] {
  const out: MgrSrc[] = [];
  for (const r of records) {
    const id = String(r.docNo ?? "").trim();
    const d = r.releaseDate || r.date;
    if (!id || !d || fileIds.has(id)) continue;
    const rev = Number(r.revenue) || 0;
    const done = roleDone(r, "account");
    let parts: CostParts, cost: number;
    if (done || !fc) {
      parts = recordParts(r);
      cost = (Number(r.normal) || 0) + (Number(r.waste) || 0);
    } else {
      const f = forecastFor(fc, r.origin, r.dest, r.vehicle);
      parts = f.parts; cost = f.cost;
    }
    const cap = Number(r.capacity) || 0, load = Number(r.loadActual) || 0;
    out.push({
      id, br: r.branch ?? "", d, km: Number(r.dist) || null, o: r.origin, de: r.dest, rt: `${r.origin}-${r.dest}`,
      vk: r.vehicle, rev, cost, profit: rev - cost, empty: !!r.emptyLeg, parts,
      pl: String(r.plate ?? ""), clrN: 0, clrAmt: 0,
      lf: r.emptyLeg ? 0 : cap > 0 ? load / cap * 100 : null, src: "new", costEst: !done && !!fc,
    });
  }
  return out;
}

/** ให้สี + คำแนะนำ — ค่าเฉลี่ยที่ใช้เทียบคิดจากเที่ยวของไฟล์เท่านั้น (ยอดปิดบัญชีของบริษัท) */
export function buildTrips(file: MgrSrc[], fresh: MgrSrc[] = []): MgrTrip[] {
  const bench = buildBench(file);
  return [...file, ...fresh].map((t) => {
    const lfb = t.lf == null ? null : lfBand(t.lf);
    const margin = marginOf(t.rev, t.profit);
    const mb = margin == null ? null : marginBand(margin);
    return {
      id: t.id, br: branchOf(t.br), d: t.d, eta: runEnd(t.d, t.km), o: t.o, de: t.de, vk: t.vk,
      lf: t.lf, lfb, margin, mb, band: overallBand(lfb, mb, margin),
      ...tripAdvice(t, lfb, mb, margin, mb && mb !== "g" ? bench(t) : null),
      rev: t.rev, cost: t.cost, profit: t.profit, empty: t.empty, src: t.src, costEst: t.costEst,
    };
  });
}

/** กำลังวิ่งในช่วง = ช่วงวิ่งทับช่วงที่เลือก */
export const onRoad = (t: MgrTrip, r: Range): boolean => t.d <= r.end && t.eta >= r.start;
/** ปล่อยรถในช่วง */
export const releasedIn = (t: MgrTrip, r: Range): boolean => t.d >= r.start && t.d <= r.end;

/** นับตามสถานะรวม · noLf = เที่ยวที่ไม่มีในไฟล์ LF (ให้สีตาม Margin อย่างเดียว) */
export interface LfSummary { n: number; g: number; y: number; r: number; na: number; noLf: number }
export function lfSummary(ts: MgrTrip[]): LfSummary {
  const s: LfSummary = { n: ts.length, g: 0, y: 0, r: 0, na: 0, noLf: 0 };
  for (const t of ts) { s[t.band ?? "na"]++; if (t.lf == null) s.noLf++; }
  return s;
}

/** fresh = ใบที่บันทึกใหม่ · est = ในนั้นที่ใช้ต้นทุนพยากรณ์ */
export interface FinSummary { n: number; rev: number; cost: number; profit: number; fresh: number; est: number }
export function finSummary(ts: MgrTrip[]): FinSummary {
  const s: FinSummary = { n: ts.length, rev: 0, cost: 0, profit: 0, fresh: 0, est: 0 };
  for (const t of ts) {
    s.rev += t.rev; s.cost += t.cost; s.profit += t.profit;
    if (t.src === "new") s.fresh++;
    if (t.costEst) s.est++;
  }
  return s;
}

/** จัดกลุ่มตามสาขา — ตารางเปรียบเทียบของผู้ดูแลระบบ */
export function byBranch<T extends { br: string }, S>(items: T[], sum: (xs: T[]) => S): (S & { br: string })[] {
  const m = new Map<string, T[]>();
  for (const x of items) { const a = m.get(x.br); if (a) a.push(x); else m.set(x.br, [x]); }
  return [...m].map(([br, xs]) => ({ ...sum(xs), br }));
}

/* ---------------- ลูกหนี้ ---------------- */

/*
 * ★ 27 ก.ย. 2569 (เจ้าของงานสั่ง) — เปลี่ยนจาก "บิลที่วางในช่วง" เป็น **ยอดคงค้าง ณ วันสิ้นช่วง** แบบรายงานอายุลูกหนี้:
 *   ทุกบิลที่วางแล้วและยังไม่ชำระ ณ วันสุดท้ายของช่วง ไม่ว่าวางเมื่อไหร่ · แบ่ง ยังไม่ถึงกำหนด / 1–30 / 31–60 / 61+ วัน
 *   (เดิมรายวัน/รายเดือนบิลยังไม่ทันเลยกำหนด การ์ด 31+ เป็น 0 เกือบตลอด และหนี้เก่าไม่ขึ้นเลย)
 *   กระแสของช่วงแยกไว้: วางบิลในช่วง (วันวางบิลอยู่ในช่วง) · เก็บเงินได้ในช่วง (วันที่จบอยู่ในช่วง)
 *   DSO มาตรฐาน = ลูกหนี้คงค้าง ณ สิ้นช่วง ÷ ยอดวางบิลในช่วง × จำนวนวันในช่วง
 * ★ เห็นเฉพาะบิลที่อยู่ในไฟล์ลูกหนี้ — หนี้ที่วางก่อนไฟล์เริ่มไม่มีทางรู้
 */
export type DebtStatus = "notdue" | "late30" | "late60" | "late61";
export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  notdue: "ยังไม่ถึงกำหนด", late30: "เกินกำหนด 1–30 วัน", late60: "เกินกำหนด 31–60 วัน", late61: "เกินกำหนด 61 วันขึ้นไป",
};

export interface MgrBill { doc: string; cust: string; br: string; amount: number; issue: string; due: string;
  /** วันที่ค้างเกินกำหนด ณ วันสิ้นช่วง — ยังไม่ถึงกำหนด = 0 */
  overdue: number; status: DebtStatus;
  /** อีกกี่วันครบกำหนด (0 = ครบวันนั้น) — เฉพาะที่ยังไม่ถึงกำหนด · เกินแล้ว = null */
  dueIn: number | null }

const statusOf = (over: number): DebtStatus =>
  over <= 0 ? "notdue" : over <= 30 ? "late30" : over <= 60 ? "late60" : "late61";

/** บิลที่ยังไม่ชำระ ณ วันที่เลือก (วางแล้ว ไม่ว่าวางเมื่อไหร่) · ผู้เรียกกรองสาขามาแล้ว */
export function outstandingAt(rows: DebtorRow[], asOf: string): MgrBill[] {
  return ageBills(rows, asOf).filter((a) => a.status !== "paid").map((a) => {
    const status = statusOf(a.over);
    return { doc: a.r.doc, cust: a.r.cust, br: branchOf(a.r.br), amount: a.r.amount, issue: a.r.issue, due: a.r.due,
      overdue: status === "notdue" ? 0 : a.over, status, dueIn: status === "notdue" ? -a.over : null };
  });
}

export interface DebtSummary {
  outstanding: number; notdue: number; late30: number; late60: number; late61: number;
  /** จำนวนบิลค้าง ทั้งหมด + รายช่วงอายุหนี้ (คู่กับยอดเงินข้างบน) */
  n: { all: number; notdue: number; late30: number; late60: number; late61: number };
  /** วางบิลในช่วง / เก็บเงินได้ในช่วง (บาท + จำนวนบิล) */
  billed: number; billedN: number; collected: number; collectedN: number;
  /** null = ไม่มีบิลวางในช่วง (หารไม่ได้) */
  dso: number | null; days: number;
}

/** open = outstandingAt(rows, r.end) · rows = บิลทั้งไฟล์ที่กรองสาขาแล้ว (ใช้หากระแสของช่วง) */
export function debtSummary(open: MgrBill[], rows: DebtorRow[], r: Range): DebtSummary {
  const s: DebtSummary = { outstanding: 0, notdue: 0, late30: 0, late60: 0, late61: 0,
    n: { all: 0, notdue: 0, late30: 0, late60: 0, late61: 0 },
    billed: 0, billedN: 0, collected: 0, collectedN: 0, dso: null, days: dayNum(r.end) - dayNum(r.start) + 1 };
  for (const b of open) { s.outstanding += b.amount; s[b.status] += b.amount; s.n.all++; s.n[b.status]++; }
  for (const x of rows) {
    if (x.issue >= r.start && x.issue <= r.end) { s.billed += x.amount; s.billedN++; }
    if (x.close && x.close >= r.start && x.close <= r.end) { s.collected += x.amount; s.collectedN++; }
  }
  s.dso = s.billed > 0 ? s.outstanding / s.billed * s.days : null;
  return s;
}

/** ลูกค้าที่ค้างชำระ — รวมบิลค้างรายลูกค้า · overdueAmt = ยอดที่เลยกำหนดแล้ว · maxOver = ค้างนานสุด (วัน) */
export interface DebtCust { cust: string; br: string; n: number; amount: number; overdueAmt: number; maxOver: number }
export function byCustomer(bills: MgrBill[]): DebtCust[] {
  const m = new Map<string, DebtCust & { brs: Set<string> }>();
  for (const b of bills) {
    let c = m.get(b.cust);
    if (!c) { c = { cust: b.cust, br: "", n: 0, amount: 0, overdueAmt: 0, maxOver: 0, brs: new Set() }; m.set(b.cust, c); }
    c.n++; c.amount += b.amount; c.brs.add(b.br);
    if (b.status !== "notdue") c.overdueAmt += b.amount;
    c.maxOver = Math.max(c.maxOver, b.overdue);
  }
  return [...m.values()].map(({ brs, ...c }) => ({ ...c, br: [...brs].sort((a, b) => a.localeCompare(b, "th")).join(", ") }));
}
