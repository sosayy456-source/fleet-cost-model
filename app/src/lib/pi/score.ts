/**
 * Performance Index (PI) ของหน้า Demo — 5 หมวด × 2 ตัวชี้วัด × 10 คะแนน = 100
 *
 *   คะแนนของตัวชี้วัด = (จำนวนเขียว + 0.5 × จำนวนเหลือง) ÷ จำนวนรายการทั้งหมด × 10   (เขียว 1 · เหลือง 0.5 · แดง 0)
 *   "รายการ" = หน่วยที่ให้สีทีละตัว (เจ้าของงานเลือก) — ต่างกันตามตัวชี้วัด (unit)
 *   คะแนนหมวด = ผลรวมสองตัวชี้วัด (เต็ม 20) · คะแนนรวม = ผลรวม 5 หมวด (เต็ม 100)
 *
 * ★ เกณฑ์ตาม "แก้ Performance Index.pdf" (เจ้าของงานส่ง 28 ก.ย. 2569) — ทับเกณฑ์ตัวเลขตายตัวของ 25 ก.ย. ทั้งหมด
 *   · **เกณฑ์ = percentile ของชุดฐาน 12 เดือนล่าสุดของทั้งบริษัท ไม่ตามตัวกรอง** (lib/pi/baseline.ts · เจ้าของงานเลือก 29 ก.ย. 2569)
 *     แล้วให้สีรายการตามตัวกรองของหน้า — เดิม (28 ก.ย.) คิดจากรายการชุดเดียวกับที่ให้สี ตัวชี้วัด P25/P75 จึงได้ราว 5/10 เสมอ
 *     ยกเว้น Empty Return ที่ใช้เกณฑ์ของแท็บ Empty Trips (lib/pi/empty.ts) และ Damage ที่เทียบ P75 ของชุดอ้างอิงรายเดือน (lib/pi/damage.ts)
 *   · Margin (Route · Service Group · Customer Net Profit): ขาดทุน (< 0) แดง · ≥ P75 เขียว · 0 ถึง < P75 เหลือง
 *   · **ไฟล์เขียนทิศกลับกันสามตัว (≤ P25 แดง · > P75 เขียว) — เจ้าของงานให้กลับเป็น "ค่าต่ำ = เขียว"**:
 *     Empty Return · Cost per Ton-km · DSO (เที่ยวเปล่าน้อย ต้นทุนถูก เก็บเงินเร็ว = ดี)
 *   · DSO = วันเก็บเงินเฉลี่ยรายลูกค้า (เดิมวันที่จ่ายช้ารายบิล) · Damage = นับสีรายเดือน (เดิมคะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75))
 *   · On-time Delivery ตัดออกตั้งแต่ 25 ก.ย. — Service Quality เหลือ Damage Rate + Damage Incidence Rate
 */
import { percentileInc } from "../damage/damage";

export type Band = "g" | "y" | "r";

/** นับสีของรายการ · n = จำนวนรายการทั้งหมด */
export interface Tally { g: number; y: number; r: number; n: number }

export type MetricKey = "route" | "service" | "lf" | "empty" | "tkm" | "coverage" | "custProfit" | "dso" | "dr" | "dir";

/** เกณฑ์ที่คิดจากรายการ → ฟังก์ชันให้สี + ข้อความค่าเกณฑ์ (ป็อบอัพที่มาของคะแนน) · null = ไม่มีรายการให้คิด */
export type Rule = (values: number[]) => { band: (v: number) => Band; basis: string } | null;

export interface MetricDef {
  label: string;
  /** หน่วยของ "รายการ" ที่ให้สี — ใช้ในข้อความบอกจำนวน */
  unit: string;
  /** เกณฑ์ percentile ของรายการ · null = ให้สีที่อื่น (Empty Return · DR · DIR) แล้วนับผ่าน bandResult() */
  rule: Rule | null;
  /** ค่าที่วัดต่อรายการ — ป็อบอัพที่มาของคะแนน */
  measure: string;
  /** ข้อมูลที่ใช้และตัวกรองที่ตาม — ป็อบอัพที่มาของคะแนน */
  source: string;
  /** ข้อความเกณฑ์ เขียว · เหลือง · แดง */
  criteria: [string, string, string];
}

const fx = (v: number, d = 2): string => v.toLocaleString("en-US", { maximumFractionDigits: d });
const finite = (values: number[]): number[] => values.filter(Number.isFinite);

/** Margin: ขาดทุน (< 0) แดง · ≥ P75 เขียว · 0 ถึง < P75 เหลือง (P75 ติดลบ = ไม่ขาดทุนก็เขียว) */
const marginRule: Rule = (values) => {
  const p75 = percentileInc(finite(values), 0.75);
  if (p75 == null) return null;
  return { band: (v) => (v < 0 ? "r" : v >= p75 ? "g" : "y"), basis: `P75 = ${fx(p75)}%` };
};
/** ค่ามาก = ดี · > P70 เขียว · P30 ถึง P70 เหลือง · < P30 แดง (ขอบพอดี = เหลือง) — Load Factor */
const lfRule: Rule = (values) => {
  const a = percentileInc(finite(values), 0.3), b = percentileInc(finite(values), 0.7);
  if (a == null || b == null) return null;
  const pc = (v: number) => `${fx(v * 100, 1)}%`;
  return { band: (v) => (v > b ? "g" : v >= a ? "y" : "r"), basis: `P30 = ${pc(a)} · P70 = ${pc(b)}` };
};
/** ค่ามาก = ดี · ≥ P75 เขียว · P25 ถึง < P75 เหลือง · < P25 แดง — Depreciation Coverage */
const coverRule = (show: (v: number) => string): Rule => (values) => {
  const a = percentileInc(finite(values), 0.25), b = percentileInc(finite(values), 0.75);
  if (a == null || b == null) return null;
  return { band: (v) => (v >= b ? "g" : v >= a ? "y" : "r"), basis: `P25 = ${show(a)} · P75 = ${show(b)}` };
};
/** ค่าน้อย = ดี · ≤ P25 เขียว · P25 ถึง P75 เหลือง · > P75 แดง — Cost per Ton-km · DSO (ไฟล์เขียนทิศกลับ เจ้าของงานให้กลับ) */
const lowRule = (show: (v: number) => string): Rule => (values) => {
  const a = percentileInc(finite(values), 0.25), b = percentileInc(finite(values), 0.75);
  if (a == null || b == null) return null;
  return { band: (v) => (v <= a ? "g" : v <= b ? "y" : "r"), basis: `P25 = ${show(a)} · P75 = ${show(b)}` };
};

export const METRICS: Record<MetricKey, MetricDef> = {
  // %Margin รายเส้นทาง = Σกำไร ÷ Σรายได้ (lib/pi/route.ts)
  route: { label: "Route Margin", unit: "เส้นทาง", rule: marginRule,
    measure: "%Margin ของแต่ละเส้นทาง = กำไร (ขาดทุน) ÷ รายได้ × 100 (รายได้ 0 แล้วขาดทุน = −100%)",
    source: "ให้สี: เส้นทางตามตัวกรองทุกตัวของหน้า · P75 จากทุกเส้นทางของทั้งบริษัท 12 เดือนล่าสุดในไฟล์ (ไม่ตามตัวกรอง)",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // %Margin ของ 3 กลุ่มบริการบนการ์ดท้าย Profit Per Route
  service: { label: "Service Group Margin", unit: "กลุ่มบริการ", rule: marginRule,
    measure: "%Margin ของแต่ละกลุ่มบริการ = กำไรรวม ÷ รายได้รวม × 100 (3 กลุ่มบนการ์ดท้าย Profit Per Route)",
    source: "ให้สี: 3 กลุ่มบริการตามตัวกรองทุกตัวของหน้า · P75 จาก %Margin เส้นทาง × กลุ่มบริการ ของทั้งบริษัท 12 เดือนล่าสุด",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // Max LF รายเที่ยวของไฟล์ Load Factor (สัดส่วน 0–1.3)
  lf: { label: "Load Factor", unit: "เที่ยว", rule: lfRule,
    measure: "สินค้าที่บรรทุกจริง ÷ ความสามารถในการบรรทุกของรถ (Max LF ของแต่ละเที่ยว — ฝั่งที่เต็มกว่าระหว่างน้ำหนักกับปริมาตร)",
    source: "ไฟล์ Load Factor ตามตัวกรอง ปี · ช่วงเดือน · ประเภทรถ · ชนิดรถ (ไฟล์ไม่มีต้นทาง/ปลายทาง/กลุ่มบริการ) · P30/P70 จากทุกเที่ยวในไฟล์ LF 12 เดือนล่าสุด (ไม่ตามตัวกรอง)",
    criteria: ["> P70", "P30 – P70", "< P30"] },
  // เกณฑ์ของแท็บ Empty Trips (P25/P75) — ให้สีใน lib/pi/empty.ts
  empty: { label: "Empty Return", unit: "เส้นทาง", rule: null,
    measure: "% เที่ยววิ่งเปล่าของแต่ละเส้นทาง (ตามทิศ) = เที่ยวที่ไม่มีสินค้าบรรทุก ÷ เที่ยวทั้งหมด × 100",
    source: "เที่ยวในไฟล์ต้นทุนตามตัวกรองของหน้า ยกเว้นกลุ่มบริการ (เที่ยวเปล่าไม่มีกลุ่มบริการ) · "
      + "P25/P75 คิดจากทุกเส้นทางของทั้งบริษัท 12 เดือนล่าสุด (ไม่ตามตัวกรอง) — แบ่งสีแบบเดียวกับแท็บ Empty Trips",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // บาท ÷ ตัน-กม. รายคัน (VRow.perTkm ของแท็บ Vehicle Utilization Cost) — ถูก = ดี
  tkm: { label: "Cost per Ton-km", unit: "คัน", rule: lowRule((v) => `${fx(v)} บาท`),
    measure: "ต้นทุนขนส่งรวม ÷ Ton-km รวม ของแต่ละคัน (บาท) — คันที่ไม่มีน้ำหนัก/ระยะทางไม่นับ",
    source: "ให้สี: รายคันตามตัวกรองทุกตัวของหน้า · P25/P75 จากทุกคันของทั้งบริษัท 12 เดือนล่าสุด (ไม่ตามตัวกรอง)",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // Contribution ÷ ค่าเสื่อม (เท่า) รายคัน เฉพาะรถบริษัทที่มีค่าเสื่อม
  coverage: { label: "Depreciation Coverage", unit: "คัน", rule: coverRule((v) => `${fx(v)} เท่า`),
    measure: "Contribution Margin (CM) ÷ ค่าเสื่อมราคา ของแต่ละคัน (เท่า) — เฉพาะรถบริษัทที่มีค่าเสื่อม",
    source: "ให้สี: รายคัน (รถบริษัท) ตามตัวกรองทุกตัวของหน้า · P25/P75 จากทุกคันของทั้งบริษัท 12 เดือนล่าสุด (ไม่ตามตัวกรอง)",
    criteria: ["≥ P75", "P25 – < P75", "< P25"] },
  // %Margin รายลูกค้า (marginOf ของหน้ากำไรลูกค้า)
  custProfit: { label: "Customer Net Profit", unit: "ลูกค้า", rule: marginRule,
    measure: "%Margin ของแต่ละลูกค้า = กำไร (ขาดทุน) ÷ รายได้ × 100 (หลังปันต้นทุนเข้าลูกค้า)",
    source: "ชุดปันส่วนต้นทุน (alloc/) ตามตัวกรอง ปี · ช่วงเดือน (วันที่บิล) · P75 จากทุกลูกค้า 12 เดือนล่าสุดในไฟล์ (ไม่ตามตัวกรอง)",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // วันเก็บเงินเฉลี่ยรายลูกค้า (collectionDays ใน lib/debtors/aging.ts) — เก็บเร็ว = ดี
  dso: { label: "DSO", unit: "ลูกค้า", rule: lowRule((v) => `${fx(v, 1)} วัน`),
    measure: "ระยะเวลาเฉลี่ยในการเก็บหนี้ของแต่ละลูกค้า = เฉลี่ยของ (วันที่จบ − วันวางบิล) ทุกบิล · บิลที่ยังไม่ชำระนับถึงวันที่ข้อมูล",
    source: "ไฟล์ลูกหนี้ ณ \"ข้อมูล ณ วันที่\" ของส่วน DSO (ไม่ตามตัวกรองของหน้า) · P25/P75 จากทุกลูกค้าทุกสาขา บิลที่วางใน 12 เดือนก่อนวันที่ข้อมูล",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // นับสีรายเดือนเทียบ P75 ของชุดอ้างอิง — lib/pi/damage.ts
  dr: { label: "Damage Rate", unit: "เดือน", rule: null,
    measure: "(มูลค่าความเสียหายของสินค้า ÷ รายได้รวม) × 100 ของแต่ละเดือน (มูลค่าบิลเคลียร์ ÷ รายได้)",
    source: "เที่ยวที่จับคู่บิลได้ ไม่รวมเที่ยววิ่งเปล่า ตามตัวกรองทุกตัวของหน้า · P75 จาก KPI รายเดือนของทั้งบริษัท 12 เดือนล่าสุด",
    criteria: ["< P75", "P75 – < 2 × P75", "≥ 2 × P75"] },
  dir: { label: "Damage Incidence Rate", unit: "เดือน", rule: null,
    measure: "(จำนวนเที่ยวที่เกิดความเสียหาย ÷ จำนวนเที่ยวทั้งหมด) × 100 ของแต่ละเดือน",
    source: "เที่ยวที่จับคู่บิลได้ ไม่รวมเที่ยววิ่งเปล่า ตามตัวกรองทุกตัวของหน้า · P75 จาก KPI รายเดือนของทั้งบริษัท 12 เดือนล่าสุด",
    criteria: ["< P75", "P75 – < 2 × P75", "≥ 2 × P75"] },
};

/** bsc = มุมมอง Balanced Scorecard ของหมวด (ตาราง "แก้ Performance Index.pdf") */
export interface IndexDef { id: string; title: string; bsc: string; subs: [MetricKey, MetricKey] }

export const INDEXES = {
  route: { id: "route", title: "Route & Service Profitability Index", bsc: "Financial", subs: ["route", "service"] },
  fleet: { id: "fleet", title: "Fleet & Trip Efficiency Index", bsc: "Internal Process", subs: ["lf", "empty"] },
  cost: { id: "cost", title: "Cost & Depreciation Coverage Index", bsc: "Internal Process", subs: ["tkm", "coverage"] },
  cust: { id: "cust", title: "Customer Profitability & Cash-Flow Index", bsc: "Financial", subs: ["custProfit", "dso"] },
  service: { id: "service", title: "Service Quality Index", bsc: "Customer", subs: ["dr", "dir"] },
} as const satisfies Record<string, IndexDef>;

export const METRIC_MAX = 10;
export const TOTAL_MAX = 100;

/** ให้สีทุกค่าแล้วนับ — ค่าที่ไม่ใช่ตัวเลขจริง (NaN/∞) ข้ามไป ไม่นับเป็นรายการ */
export function tally(values: number[], band: (v: number) => Band): Tally {
  const t: Tally = { g: 0, y: 0, r: 0, n: 0 };
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    t[band(v)]++;
    t.n++;
  }
  return t;
}

/** (เขียว + 0.5 × เหลือง) ÷ จำนวนรายการ × 10 · ไม่มีรายการ = null (ไม่ใช่ 0) */
export const scoreOf = (t: Tally): number | null => (t.n ? (t.g + 0.5 * t.y) / t.n * METRIC_MAX : null);

/**
 * ผลของตัวชี้วัดหนึ่งตัว — pending = ยังไม่มีเกณฑ์ · score null = ไม่มีข้อมูล/ประเมินไม่ได้
 * na = ป้ายแทน "ไม่มีข้อมูล" เมื่อมีเหตุเฉพาะ (เช่น "ข้อมูลไม่เพียงพอ") · detail = ที่มาของคะแนนสำหรับ tooltip
 * basis = ค่าเกณฑ์ที่คิดจากข้อมูล (P25/P75 · P30/P70 · P75 ของ DR/DIR) — ขึ้นในป็อบอัพที่มาของคะแนน
 */
export interface MetricResult {
  key: MetricKey; pending: boolean; tally: Tally | null; score: number | null;
  na?: string; detail?: string; basis?: string;
  /** สีแสดงผลของค่า KPI รวมของช่วง (Damage · เทียบ P75) — ไม่เกี่ยวกับคะแนน · ไม่มี = ไม่แสดงจุดสี */
  tone?: "g" | "y" | "r";
}

/** สีที่ให้มาแล้ว (เกณฑ์คิดที่อื่น เช่น Empty Return · Damage) → ผลของตัวชี้วัด · bands null = ไม่มีข้อมูล */
export function bandResult(key: MetricKey, bands: Band[] | null,
  extra?: Pick<MetricResult, "na" | "basis" | "detail" | "tone">): MetricResult {
  if (!bands) return { key, pending: false, tally: null, score: null, ...extra };
  const t: Tally = { g: 0, y: 0, r: 0, n: bands.length };
  for (const b of bands) t[b]++;
  return { key, pending: false, tally: t, score: scoreOf(t), ...extra };
}

/**
 * ค่าของทุกรายการ → ผลของตัวชี้วัด · values null = ชุดข้อมูลยังไม่มี/โหลดไม่ได้
 * **base = ค่าของชุดฐาน 12 เดือนล่าสุดของทั้งบริษัท** (lib/pi/baseline.ts · 29 ก.ย. 2569) — เกณฑ์ percentile คิดจาก base
 * แล้วให้สี values (รายการตามตัวกรอง) · ไม่ส่ง base = คิดจาก values เอง (วิธีเดิม เหลือไว้ให้เทสต์) · ไม่มีรายการ = score null
 */
export function metricResult(key: MetricKey, values: number[] | null, base?: { values: number[]; span: string } | null): MetricResult {
  const rule = METRICS[key].rule;
  if (!rule) return { key, pending: true, tally: null, score: null };
  if (!values) return { key, pending: false, tally: null, score: null };
  const r = rule(base ? base.values : values);
  if (!r) return { key, pending: false, tally: { g: 0, y: 0, r: 0, n: 0 }, score: null, basis: base?.span };
  const t = tally(values, r.band);
  return { key, pending: false, tally: t, score: scoreOf(t), basis: base ? `${r.basis} ${base.span}` : r.basis };
}

/** รวมคะแนนเฉพาะตัวที่คิดได้ · max = ฐานของตัวที่คิดได้ (10 ต่อตัว) */
export function sumScores(results: MetricResult[]): { score: number; max: number } {
  let score = 0, max = 0;
  for (const r of results) if (r.score != null) { score += r.score; max += METRIC_MAX; }
  return { score, max };
}
