/**
 * Reference Baseline ของ Performance Index — "ปรับปรุง Methodology ของ PI" (เจ้าของงานส่ง 29 ก.ย. 2569 · ทับ InDex_revised v2.md)
 *
 *   ช่วงประเมิน (Evaluation Period) = ช่วงที่เลือกบนหน้า ถึงระดับวัน · ไม่เลือกปี = เดือนล่าสุดของไฟล์นั้น (หลักเดิม)
 *   Reference Baseline = **12 เดือนปฏิทินเต็มก่อนเดือนของวันแรกในช่วงประเมิน** (ไม่รวมช่วงประเมิน · อดีตล้วน)
 *     ประเมิน พ.ค. 2569 · 15 พ.ค. · 1–20 พ.ค. → Baseline พ.ค. 2568 – เม.ย. 2569 ชุดเดียว (ข้อ 5 ของเอกสาร: ดูรายวันแล้ว Baseline ไม่เปลี่ยนตามวัน)
 *     ★ เจ้าของงานเลือก 29 ก.ย. 2569 ให้กลับเป็นรายเดือน — รุ่นแรกของวันเดียวกันเป็น "365 วันก่อนวันแรก" เกณฑ์ขยับทุกวันที่เลือก
 *   **ระดับบริษัท ไม่ตามตัวกรองใด ๆ ของหน้า** (สาขา · เส้นทาง · รถ · กลุ่มบริการ · เวลา) — ตัวกรองมีผลกับช่วงประเมินเท่านั้น
 *   percentile (P25 · P30 · P70 · P75) คิดจาก Baseline แล้วใช้ให้สีช่วงประเมิน — ห้ามคิดจากช่วงประเมินเอง
 *
 *   ความครบของ Baseline (เจ้าของงานเลือก 29 ก.ย. 2569):
 *   · ไฟล์ต้องมีข้อมูลตั้งแต่เดือนแรกของ Baseline (ย้อนหลังครบ 12 เดือน) — เดือนระหว่างทางขาดได้ ไม่เติม 0
 *     แสดง Coverage = เดือนที่มีข้อมูล / 12 · ไม่ครบ = N/A ไม่ให้คะแนน
 *   · ยกเว้น DSO (ไฟล์ลูกหนี้มีแค่ปี 2569) ใช้เท่าที่มีก่อนช่วงประเมิน · ไม่มีเลย = N/A · ครบปีเมื่อไรก็เป็น 12 เดือนเอง
 *   · ตัวกรองวันที่ของหน้าล็อกเดือนที่ไฟล์ต้นทุนมีข้อมูลย้อนหลังไม่ครบ 12 เดือน (minEvalStart)
 *
 *   รายการที่มีวันที่ (`d`) เทียบระดับวัน · มีแค่เดือน (ไฟล์ LF ที่ยังไม่มีวันที่ · กำไรลูกค้ารายเดือน):
 *   ช่วงประเมิน = ทั้งเดือนที่คร่อม ("overlap") · Baseline = เฉพาะเดือนที่อยู่ในช่วงทั้งเดือน ("inside") — สองฝั่งจึงไม่ทับกัน
 */
import { TH_MONTHS } from "../record/date";
import { PERIOD_ALL, periodBounds, periodLabel } from "../filter/period";
import type { Period } from "../filter/period";

/** ความยาวของ Baseline (เดือนปฏิทินเต็ม) */
export const BASELINE_MONTHS = 12;
/** ข้อความหัวของ Baseline (ข้อ 10 ของเอกสาร) */
export const BASELINE_TITLE = "Reference Baseline: Rolling 12 Months Prior to Evaluation Period";

const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
const dayMs = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
/** วันที่ ISO เลื่อนไป n วัน (ติดลบ = ย้อน) */
export const addDays = (d: string, n: number): string => iso(dayMs(d) + n * 86_400_000);
/** วันแรก/วันสุดท้ายของเดือน "YYYY-MM" */
export const monthStart = (mo: string): string => `${mo}-01`;
export const monthEnd = (mo: string): string =>
  iso(Date.UTC(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)), 0));

/** "2026-05-16" → "16 พ.ค. 2569" */
export const thDay = (d: string): string =>
  `${Number(d.slice(8, 10))} ${TH_MONTHS[Number(d.slice(5, 7)) - 1] ?? ""} ${Number(d.slice(0, 4)) + 543}`;

export interface Range { start: string; end: string }
export interface EvalRange extends Range { label: string }

/** เดือนล่าสุดใน mos ("YYYY-MM") · ว่าง = null */
const latest = (mos: Iterable<string>): string | null => {
  let m = "";
  for (const x of mos) if (x && x > m) m = x;
  return m || null;
};

/**
 * ช่วงประเมิน — เลือกปีแล้ว = ช่วงตามตัวกรอง (ปี → เดือน → วัน) · ไม่เลือกปี = เดือนล่าสุดของไฟล์ (mos ของไฟล์นั้น)
 * null = ไฟล์ไม่มีข้อมูล
 */
export function evalRange(f: Period, mos: Iterable<string>): EvalRange | null {
  const b = periodBounds(f);
  if (b) return { ...b, label: periodLabel(f) };
  const mo = latest(mos);
  if (!mo) return null;
  const p: Period = { ...PERIOD_ALL, year: mo.slice(0, 4), from: mo.slice(5, 7), to: mo.slice(5, 7) };
  return { start: monthStart(mo), end: monthEnd(mo), label: periodLabel(p) };
}

/** ตัวกรองที่แทนช่วงประเมิน (ใช้กับ passDemo/passLfDemo) — ไม่เลือกปี = เดือนล่าสุดของไฟล์ */
export function evalPeriod<T extends Period>(f: T, mos: Iterable<string>): T {
  if (f.year) return f;
  const mo = latest(mos);
  if (!mo) return f;
  return { ...f, year: mo.slice(0, 4), from: mo.slice(5, 7), to: mo.slice(5, 7), d1: "", d2: "" };
}

export interface Baseline extends Range {
  /** เดือนที่มีข้อมูลในช่วง / เดือนปฏิทินที่ช่วงคร่อม */
  months: number; spanMonths: number;
  /** ไฟล์มีข้อมูลย้อนไปถึงวันแรกของ Baseline (ย้อนหลังครบ 12 เดือน) */
  full: boolean;
  /** วันแรกที่ไฟล์มีข้อมูล (ว่าง = ไม่มี) */
  first: string;
}

/** จำนวนเดือนปฏิทินที่ช่วงคร่อม */
const spanOf = (r: Range): number =>
  (Number(r.end.slice(0, 4)) - Number(r.start.slice(0, 4))) * 12 + Number(r.end.slice(5, 7)) - Number(r.start.slice(5, 7)) + 1;

/** "YYYY-MM" เลื่อนไป n เดือน (ติดลบ = ย้อน) */
export function addMonths(mo: string, n: number): string {
  const m = Number(mo.slice(0, 4)) * 12 + Number(mo.slice(5, 7)) - 1 + n;
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
}

/**
 * Baseline ของช่วงประเมิน — 12 เดือนปฏิทินเต็มก่อนเดือนของวันแรกในช่วงประเมิน
 * first = วันแรกที่ไฟล์มีข้อมูล (ครบ = ไฟล์เริ่มภายในเดือนแรกของ Baseline หรือก่อนนั้น) · mos = เดือนที่มีข้อมูล (นับ Coverage)
 */
export function baselineOf(ev: Range, first: string | null, mos: Iterable<string>): Baseline {
  const evMo = ev.start.slice(0, 7);
  const sMo = addMonths(evMo, -BASELINE_MONTHS), eMo = addMonths(evMo, -1);
  const r = { start: monthStart(sMo), end: monthEnd(eMo) };
  const set = new Set<string>();
  for (const mo of mos) if (mo && mo >= sMo && mo <= eMo) set.add(mo);
  return { ...r, months: set.size, spanMonths: spanOf(r), full: !!first && first.slice(0, 7) <= sMo, first: first ?? "" };
}

/**
 * รายการอยู่ในช่วงไหม — มีวันที่ = เทียบวัน · มีแค่เดือน: "overlap" = เดือนคร่อมช่วง (ช่วงประเมิน)
 * "inside" = ทั้งเดือนอยู่ในช่วง (Baseline — กันเดือนที่คาบช่วงประเมิน)
 */
export function inRange(t: { mo: string; d?: string }, r: Range, mode: "overlap" | "inside"): boolean {
  if (t.d) return t.d >= r.start && t.d <= r.end;
  return mode === "overlap"
    ? monthEnd(t.mo) >= r.start && monthStart(t.mo) <= r.end
    : monthStart(t.mo) >= r.start && monthEnd(t.mo) <= r.end;
}

/** เดือนหัว/ท้ายที่ช่วงคร่อมไม่เต็มเดือน — ต้องใช้ข้อมูลรายวันของเดือนนั้น (กำไรลูกค้า cust_days) */
export function partialMonths(r: Range): string[] {
  const out = new Set<string>();
  if (r.start.slice(8, 10) !== "01") out.add(r.start.slice(0, 7));
  if (r.end !== monthEnd(r.end.slice(0, 7))) out.add(r.end.slice(0, 7));
  return [...out];
}

/** วันแรกที่ชุดมีข้อมูล — รายการที่มีแค่เดือนนับวันที่ 1 · ว่าง = null */
export function firstDay(rows: { mo: string; d?: string }[]): string | null {
  let m = "";
  for (const r of rows) { const d = r.d || (r.mo ? monthStart(r.mo) : ""); if (d && (!m || d < m)) m = d; }
  return m || null;
}

/**
 * Baseline ระดับสาขา (เจ้าของงานสั่ง 29 ก.ย. 2569 — แก้ข้อ 3 ของ Methodology: เลือกสาขาแล้ว Baseline ตามสาขาได้)
 * สาขามีรายการใน Baseline ถึงขั้นต่ำ = ใช้ของสาขา · ไม่ถึง = ระดับบริษัท พร้อมป้ายบอกเหตุ · ตัวกรองอื่นยังไม่เปลี่ยน Baseline
 * ขั้นต่ำ: 30 รายการ (เที่ยว · เส้นทาง · ลูกค้า · คัน × เดือน) · 12 ค่าสำหรับตัวที่นับรายเดือน (Damage · กลุ่ม × เดือน)
 */
export const BRANCH_MIN = 30;
export const BRANCH_MIN_MONTHLY = 12;
export function scopedValues(company: number[], branch: number[] | null, br: string, unit: string, min = BRANCH_MIN):
  { values: number[]; scope: string } {
  if (!br || !branch) return { values: company, scope: "ระดับบริษัท" };
  const n = branch.filter(Number.isFinite).length;
  if (n >= min) return { values: branch, scope: `ระดับสาขา ${br}` };
  return { values: company, scope: `ระดับบริษัท (สาขา ${br} มี ${n.toLocaleString("en-US")} ${unit} ไม่ถึงขั้นต่ำ ${min})` };
}

/** วันแรกที่ประเมินได้ — วันที่ 1 ของเดือนที่ไฟล์ต้นทุนมีข้อมูลย้อนหลังครบ 12 เดือน (ล็อกตัวกรองวันที่ของหน้า) */
export const minEvalStart = (first: string): string => monthStart(addMonths(first.slice(0, 7), BASELINE_MONTHS));

const TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "ปีก่อนหน้า พฤษภาคม 2568 – เมษายน 2569" — บรรทัดแรกของป็อบอัพคะแนน Baseline */
export function baselinePeriod(b: Baseline): string {
  const full = (d: string) => `${TH_FULL[Number(d.slice(5, 7)) - 1] ?? ""} ${Number(d.slice(0, 4)) + 543}`;
  return `ปีก่อนหน้า ${full(b.start)} – ${full(b.end)}`;
}

/** "YYYY-MM" → "พ.ค. 2568" */
const thMonth = (mo: string): string => `${TH_MONTHS[Number(mo.slice(5, 7)) - 1] ?? ""} ${Number(mo.slice(0, 4)) + 543}`;

/** "Baseline: พ.ค. 2568 – เม.ย. 2569 | 12 เดือน · มีข้อมูล 12/12 เดือน" */
export function baselineLabel(b: Baseline): string {
  return `Baseline: ${thMonth(b.start.slice(0, 7))} – ${thMonth(b.end.slice(0, 7))} | ${BASELINE_MONTHS} เดือน · มีข้อมูล ${b.months}/${b.spanMonths} เดือน`;
}

/**
 * ชุด Baseline ของตัวชี้วัด → RefSet ของ metricResult
 * partialOk = DSO ใช้เท่าที่มี (ไฟล์เริ่มหลังวันแรกของ Baseline ก็ยังคิด) · ไม่มีรายการเลย = N/A เสมอ
 */
export function refSet(values: number[], unit: string, b: Baseline | null, partialOk = false, scope = "ระดับบริษัท"):
  { values: number[]; label: string; ok: boolean; na?: string; scope: string; period?: string } {
  const n = values.filter(Number.isFinite).length;
  if (!b) return { values, label: "ไม่มีข้อมูลก่อนช่วงประเมิน", ok: false, na: "ไม่มี Baseline", scope };
  const period = baselinePeriod(b);
  const label = `${baselineLabel(b)} · ${scope} · ${n.toLocaleString("en-US")} ${unit}`
    + (!b.full && partialOk && b.first ? ` · ไฟล์เริ่ม ${thDay(b.first)} ใช้เท่าที่มี (ยังไม่ครบ ${BASELINE_MONTHS} เดือน)` : "");
  if (!n) return { values, label, ok: false, na: "ไม่มี Baseline", scope, period };
  if (!b.full && !partialOk) return { values, label: `${label} · ไฟล์เริ่ม ${b.first ? thDay(b.first) : "–"} ย้อนหลังไม่ครบ ${BASELINE_MONTHS} เดือน`, ok: false, na: "Baseline ไม่ครบ", scope, period };
  return { values, label, ok: true, scope, period };
}
