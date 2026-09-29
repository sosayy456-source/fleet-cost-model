/**
 * Performance Index (PI) ของหน้า Demo — 5 หมวด × 2 ตัวชี้วัด × 10 คะแนน = 100
 *
 *   คะแนนของตัวชี้วัด = (จำนวนเขียว + 0.5 × จำนวนเหลือง) ÷ จำนวนรายการทั้งหมด × 10   (เขียว 1 · เหลือง 0.5 · แดง 0)
 *   "รายการ" = หน่วยที่ให้สีทีละตัว (เจ้าของงานเลือก) — ต่างกันตามตัวชี้วัด (unit)
 *   คะแนนหมวด = ผลรวมสองตัวชี้วัด (เต็ม 20) · คะแนนรวม = ผลรวม 5 หมวด (เต็ม 100)
 *
 * ★ เกณฑ์ตาม "InDex_revised v2.md" (เจ้าของงานส่ง 28 ก.ย. 2569 · ทับ "แก้ Performance Index.pdf" เรื่องที่มาของ percentile)
 *   · **เกณฑ์ percentile คิดจาก Reference Baseline = 12 เดือนปฏิทินก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง**
 *     (Methodology 29 ก.ย. 2569 · lib/pi/baseline.ts — ทับ "12 เดือนล่าสุดของไฟล์ ตามตัวกรองยกเว้นเวลา" ของ InDex_revised v2.md)
 *     แล้วใช้ให้สีรายการของช่วงที่ประเมิน (ตามตัวกรองทุกตัว) — เดิมคิดจากชุดเดียวกับที่ให้สี คะแนนจึงติดที่ราว 5/10 เสมอ
 *     Empty Return ใช้ P25/P75 แบบแท็บ Empty Trips จากชุดอ้างอิงเดียวกัน (lib/pi/empty.ts) · Damage เทียบ P75 รายเดือน (lib/pi/damage.ts)
 *   · สถานะของทุกหมวด (เต็ม 20): ผ่านเกณฑ์ 15–20 · เฝ้าระวัง 10–14.99 · ไม่ผ่านเกณฑ์ < 10 (indexStatus — เดิมมีแค่ Service Quality)
 *   · Margin (Route · Service Group · Customer Net Profit): ขาดทุน (< 0) แดง · ≥ P75 เขียว · 0 ถึง < P75 เหลือง
 *   · **ไฟล์เขียนทิศกลับกันสามตัว (≤ P25 แดง · > P75 เขียว) — เจ้าของงานให้กลับเป็น "ค่าต่ำ = เขียว"**:
 *     Empty Return · Cost per Ton-km · DSO (เที่ยวเปล่าน้อย ต้นทุนถูก เก็บเงินเร็ว = ดี)
 *   · DSO = วันเก็บเงินเฉลี่ยรายลูกค้า (เดิมวันที่จ่ายช้ารายบิล) · Damage = นับสีรายเดือน (เดิมคะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75))
 *   · On-time Delivery ตัดออกตั้งแต่ 25 ก.ย. — Service Quality เหลือ Damage Rate + Damage Incidence Rate
 */
import { percentileInc } from "../damage/damage";
import { DEP_BREAKEVEN } from "../detail3/calc";

export type Band = "g" | "y" | "r";

/** นับสีของรายการ · n = จำนวนรายการทั้งหมด */
export interface Tally { g: number; y: number; r: number; n: number }

export type MetricKey = "route" | "service" | "lf" | "empty" | "tkm" | "coverage" | "custProfit" | "dso" | "dr" | "dir";

/**
 * เกณฑ์ที่คิดจากรายการ → ฟังก์ชันให้สี + ข้อความค่าเกณฑ์ (ป็อบอัพที่มาของคะแนน) · null = ไม่มีรายการให้คิด
 * why(v) = ค่าเทียบเกณฑ์ตัวไหน เช่น "88% > P70 85%" — ใช้ตีความ Actual ของช่วงประเมิน (ข้อ 11 ของ Methodology 29 ก.ย. 2569)
 */
export type Rule = (values: number[], show: (v: number) => string) =>
  { band: (v: number) => Band; basis: string; why: (v: number) => string } | null;

export interface MetricDef {
  label: string;
  /** รูปแสดงค่าของตัวชี้วัด (Actual · P25/P30/P70/P75) */
  show: (v: number) => string;
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
const marginRule: Rule = (values, show) => {
  const p75 = percentileInc(finite(values), 0.75);
  if (p75 == null) return null;
  return { band: (v) => (v < 0 ? "r" : v >= p75 ? "g" : "y"), basis: `P75 = ${show(p75)}`,
    why: (v) => (v < 0 ? `${show(v)} < 0 (ขาดทุน)` : v >= p75 ? `${show(v)} ≥ P75 ${show(p75)}` : `0 ≤ ${show(v)} < P75 ${show(p75)}`) };
};
/** ค่ามาก = ดี · > P70 เขียว · P30 ถึง P70 เหลือง · < P30 แดง (ขอบพอดี = เหลือง) — Load Factor */
const lfRule: Rule = (values, show) => {
  const a = percentileInc(finite(values), 0.3), b = percentileInc(finite(values), 0.7);
  if (a == null || b == null) return null;
  return { band: (v) => (v > b ? "g" : v >= a ? "y" : "r"), basis: `P30 = ${show(a)} · P70 = ${show(b)}`,
    why: (v) => (v > b ? `${show(v)} > P70 ${show(b)}` : v >= a ? `P30 ${show(a)} ≤ ${show(v)} ≤ P70 ${show(b)}` : `${show(v)} < P30 ${show(a)}`) };
};
/**
 * Depreciation Coverage — ค่ามาก = ดี · percentile + เพดานตามหลักของเอกสาร (เจ้าของงานสั่งแก้ logic 28 ก.ย. 2569):
 *   🟢 ≥ P75 **และ ≥ 1 เท่า** (กำไรส่วนเกินครอบคลุมค่าเสื่อม) · 🔴 < P25 **หรือติดลบ** (CM ไม่พอแม้ต้นทุนผันแปร เทียบได้กับ "ขาดทุน")
 *   🟡 ที่เหลือ · เหตุ: ชุดตัวอย่าง P75 = −1.77 เท่า — percentile ล้วนทำให้รถที่ไม่คุ้มค่าเสื่อมได้เขียว ขัดกับ "≥ 1 เท่าจึงครอบคลุม"
 */
const coverRule: Rule = (values, show) => {
  const a = percentileInc(finite(values), 0.25), b = percentileInc(finite(values), 0.75);
  if (a == null || b == null) return null;
  return { band: (v) => (v >= b && v >= DEP_BREAKEVEN ? "g" : v < a || v < 0 ? "r" : "y"),
    basis: `P25 = ${show(a)} · P75 = ${show(b)} · เขียวต้อง ≥ ${DEP_BREAKEVEN} เท่า · ติดลบ = แดง`,
    why: (v) => (v >= b && v >= DEP_BREAKEVEN ? `${show(v)} ≥ P75 ${show(b)} และ ≥ ${DEP_BREAKEVEN} เท่า`
      : v < 0 ? `${show(v)} ติดลบ` : v < a ? `${show(v)} < P25 ${show(a)}`
        : `P25 ${show(a)} ≤ ${show(v)} (ยังไม่ถึง P75 ${show(b)} หรือ ${DEP_BREAKEVEN} เท่า)`) };
};
/** ค่าน้อย = ดี · ≤ P25 เขียว · P25 ถึง P75 เหลือง · > P75 แดง — Cost per Ton-km · DSO (ไฟล์เขียนทิศกลับ เจ้าของงานให้กลับ) */
const lowRule: Rule = (values, show) => {
  const a = percentileInc(finite(values), 0.25), b = percentileInc(finite(values), 0.75);
  if (a == null || b == null) return null;
  return { band: (v) => (v <= a ? "g" : v <= b ? "y" : "r"), basis: `P25 = ${show(a)} · P75 = ${show(b)}`,
    why: (v) => (v <= a ? `${show(v)} ≤ P25 ${show(a)}` : v <= b ? `P25 ${show(a)} < ${show(v)} ≤ P75 ${show(b)}` : `${show(v)} > P75 ${show(b)}`) };
};

const pctShow = (v: number): string => `${fx(v)}%`;

export const METRICS: Record<MetricKey, MetricDef> = {
  // %Margin รายเส้นทาง = Σกำไร ÷ Σรายได้ (lib/pi/route.ts)
  route: { label: "Route Margin", unit: "เส้นทาง", rule: marginRule, show: pctShow,
    measure: "%Margin ของแต่ละเส้นทาง = กำไร (ขาดทุน) ÷ รายได้ × 100 (รายได้ 0 แล้วขาดทุน = −100%)",
    source: "เที่ยวของ Profit Per Route ตามตัวกรองทุกตัวของหน้า · P75 จากทุกเส้นทางใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // %Margin ของ 3 กลุ่มบริการบนการ์ดท้าย Profit Per Route
  service: { label: "Service Group Margin", unit: "กลุ่ม × เดือน", rule: marginRule, show: pctShow,
    measure: "%Margin ของแต่ละกลุ่มบริการในแต่ละเดือน = กำไรรวม ÷ รายได้รวม × 100 (3 กลุ่มบนการ์ดท้าย Profit Per Route · รายการ = กลุ่ม × เดือน)",
    source: "เที่ยวของ Profit Per Route ตามตัวกรองทุกตัวของหน้า · P75 จากกลุ่ม × เดือนใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง (Observation Unit กลุ่ม × เดือนตาม Methodology เดิม · ราว 36 ค่า แทน 3 กลุ่มที่คิด percentile ไม่ได้ความหมาย)",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // Max LF รายเที่ยวของไฟล์ Load Factor (สัดส่วน 0–1.3)
  lf: { label: "Load Factor", unit: "เที่ยว", rule: lfRule, show: (v) => `${fx(v * 100, 1)}%`,
    measure: "สินค้าที่บรรทุกจริง ÷ ความสามารถในการบรรทุกของรถ (Max LF ของแต่ละเที่ยว — ฝั่งที่เต็มกว่าระหว่างน้ำหนักกับปริมาตร)",
    source: "ไฟล์ Load Factor ตามตัวกรอง ช่วงเวลา · ประเภทรถ · ชนิดรถ (ไฟล์ไม่มีต้นทาง/ปลายทาง/กลุ่มบริการ) · P30/P70 จากทุกเที่ยวใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["> P70", "P30 – P70", "< P30"] },
  // เกณฑ์ของแท็บ Empty Trips (P25/P75) — ให้สีใน lib/pi/empty.ts
  empty: { label: "Empty Return", unit: "เส้นทาง", rule: null, show: pctShow,
    measure: "% เที่ยววิ่งเปล่าของแต่ละเส้นทาง (ตามทิศ) = เที่ยวที่ไม่มีสินค้าบรรทุก ÷ เที่ยวทั้งหมด × 100",
    source: "เที่ยวในไฟล์ต้นทุนตามตัวกรองของหน้า ยกเว้นกลุ่มบริการ (เที่ยวเปล่าไม่มีกลุ่มบริการ) · "
      + "P25/P75 จากทุกเส้นทางใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง — วิธีจัดกลุ่มเดียวกับแท็บ Empty Trips",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // บาท ÷ ตัน-กม. รายคัน (VRow.perTkm ของแท็บ Vehicle Utilization Cost) — ถูก = ดี
  tkm: { label: "Cost per Ton-km", unit: "คัน × เดือน", rule: lowRule, show: (v) => `${fx(v)} บาท`,
    measure: "ต้นทุนขนส่งรวม ÷ Ton-km รวม ของแต่ละคันในแต่ละเดือน (บาท) — เที่ยวที่ไม่มีน้ำหนัก/ระยะทางไม่นับ (lib/pi/cost.ts)",
    source: "รายคันของแท็บ Vehicle Utilization Cost ตามตัวกรองทุกตัวของหน้า · P25/P75 จากทุกคัน × เดือนใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // Contribution ÷ ค่าเสื่อม (เท่า) รายคัน เฉพาะรถบริษัทที่มีค่าเสื่อม
  coverage: { label: "Depreciation Coverage", unit: "คัน × เดือน", rule: coverRule, show: (v) => `${fx(v)} เท่า`,
    measure: "Contribution Margin (CM) ÷ ค่าเสื่อมราคา ของแต่ละคันในแต่ละเดือน (เท่า) — เฉพาะรถบริษัทที่มีค่าเสื่อม · ≥ 1 เท่า = ครอบคลุมค่าเสื่อม",
    source: "รายคันของแท็บ Vehicle Utilization Cost ตามตัวกรองทุกตัวของหน้า · P25/P75 จากทุกคัน × เดือนใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["≥ P75 และ ≥ 1 เท่า", "ที่เหลือ", "< P25 หรือติดลบ"] },
  // %Margin รายลูกค้า (marginOf ของหน้ากำไรลูกค้า)
  custProfit: { label: "Customer Net Profit", unit: "ลูกค้า", rule: marginRule, show: pctShow,
    measure: "%Margin ของแต่ละลูกค้า = กำไร (ขาดทุน) ÷ รายได้ × 100 (หลังปันต้นทุนเข้าลูกค้า)",
    source: "ชุดปันส่วนต้นทุน (alloc/) ตามช่วงเวลา (วันที่บิล · ยุบรายเดือน) · P75 จากทุกลูกค้าใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["≥ P75", "0 ถึง < P75", "< 0 (ขาดทุน)"] },
  // วันเก็บเงินเฉลี่ยรายลูกค้า (collectionDays ใน lib/debtors/aging.ts) — เก็บเร็ว = ดี
  dso: { label: "Days Sales Outstanding (DSO)", unit: "ลูกค้า", rule: lowRule, show: (v) => `${fx(v, 1)} วัน`,
    measure: "ระยะเวลาเฉลี่ยในการเก็บหนี้ของแต่ละลูกค้า = เฉลี่ยของ (วันที่จบ − วันวางบิล) ทุกบิล · บิลที่ยังไม่ชำระนับถึงวันที่ข้อมูล",
    source: "ไฟล์ลูกหนี้ ลูกค้าที่วางบิลในช่วงประเมิน (สาขาที่เลือก) นับถึงวันสุดท้ายของช่วง · P25/P75 จากลูกค้าทุกสาขาที่วางบิลใน Reference Baseline (12 เดือนก่อนเดือนที่ประเมิน) นับถึงวันสุดท้ายของ Baseline — ไฟล์ยังไม่ครบปีใช้เท่าที่มี",
    criteria: ["≤ P25", "P25 – P75", "> P75"] },
  // นับสีรายเดือนเทียบ P75 ของชุดอ้างอิง — lib/pi/damage.ts
  dr: { label: "Damage Rate", unit: "เดือน", rule: null, show: (v) => `${fx(v, 3)}%`,
    measure: "(มูลค่าความเสียหายของสินค้า ÷ รายได้รวม) × 100 ของแต่ละเดือน (มูลค่าบิลเคลียร์ ÷ รายได้)",
    source: "เที่ยวที่จับคู่บิลได้ ไม่รวมเที่ยววิ่งเปล่า ตามตัวกรองทุกตัวของหน้า · P75 จาก KPI รายเดือนใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
    criteria: ["< P75", "P75 – < 2 × P75", "≥ 2 × P75"] },
  dir: { label: "Damage Incidence Rate", unit: "เดือน", rule: null, show: pctShow,
    measure: "(จำนวนเที่ยวที่เกิดความเสียหาย ÷ จำนวนเที่ยวทั้งหมด) × 100 ของแต่ละเดือน",
    source: "เที่ยวที่จับคู่บิลได้ ไม่รวมเที่ยววิ่งเปล่า ตามตัวกรองทุกตัวของหน้า · P75 จาก KPI รายเดือนใน Reference Baseline = 12 เดือนก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง",
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
  /** ช่วงที่ประเมิน เช่น "พ.ศ. 2569 · พ.ค." — ไม่เลือกปี = เดือนล่าสุดของไฟล์ (lib/pi/baseline.ts evalPeriod) */
  period?: string;
  /** Reference Baseline ของตัวชี้วัด — ช่วง · Coverage · จำนวนรายการ (lib/pi/baseline.ts refSet) */
  baseline?: string;
  /** ระดับของ Baseline — "ระดับบริษัท" · "ระดับสาขา X" · "ระดับบริษัท (สาขา X ไม่ถึงขั้นต่ำ)" (ป้ายในกล่อง) */
  scope?: string;
  /** P25 · P30 · P70 · P75 ของ Baseline (แสดงผล — ข้อ 8 ของ Methodology 29 ก.ย. 2569) */
  pcts?: { p25: string; p30: string; p70: string; p75: string };
  /** ค่ารวมของช่วงประเมิน + สีเทียบเกณฑ์ + เหตุผล — ใช้ตีความดีขึ้น/แย่ลงอย่างเดียว คะแนนยังนับสีรายการ */
  actual?: { v: string; band: Band; why: string };
  /** ช่วงประเมินไม่เต็มเดือน (Daily View) — แสดงสี/Actual แต่ไม่คิดคะแนน (ข้อ 5 ของ Methodology · เจ้าของงานเลือก 29 ก.ย. 2569) */
  daily?: boolean;
  /**
   * คะแนน Baseline (เจ้าของงานเลือกแบบที่ 1 · 29 ก.ย. 2569) = รายการใน Baseline ให้สีด้วยเกณฑ์ของ Baseline เอง
   * แล้วคิดสูตรเดียวกัน — กล่องแสดง คะแนนปัจจุบัน − คะแนนนี้ เป็น +/− หลังคะแนน · period = "ปีก่อนหน้า พฤษภาคม 2568 – เมษายน 2569"
   * ★ เพราะเทียบกับตัวเอง ตัวชี้วัดแบบ P25/P75 · P30/P70 ได้ค่าใกล้เดิมทุกครั้ง (≈ 5) — เจ้าของงานรับทราบแล้ว
   */
  base?: { score: number | null; tally: Tally | null; period: string };
}

/** คะแนน Baseline จากสีของรายการใน Baseline */
export function baseOf(bands: Band[] | null, period: string | undefined): MetricResult["base"] {
  if (!period) return undefined;
  if (!bands) return { score: null, tally: null, period };
  const t: Tally = { g: 0, y: 0, r: 0, n: bands.length };
  for (const b of bands) t[b]++;
  return { score: scoreOf(t), tally: t, period };
}

/** ข้อความแทนคะแนนตอนดูรายวัน */
export const DAILY_NA = "ดูรายวัน · คะแนนคิดเฉพาะเดือนเต็ม";

/**
 * Daily View (ช่วงประเมินไม่เต็มเดือน): ข้อ 5 ของ Methodology — รายวันใช้ติดตามงาน · คะแนนคิดเฉพาะ Monthly View
 * คงจำนวนสี/Actual/Baseline ไว้ให้ดู แต่ score = null จึงไม่นับเข้าคะแนนหมวด/รวม/สถานะ/ข้อเสนอแนะ
 */
export const asDaily = (r: MetricResult): MetricResult =>
  (r.pending ? r : { ...r, score: null, daily: true, na: r.score == null && r.na ? r.na : DAILY_NA });

/** ติดป้ายช่วงที่ประเมินให้ผล — ผู้เรียกรู้ว่าประเมินช่วงไหน (แต่ละไฟล์มีเดือนล่าสุดของตัวเอง) */
export const withPeriod = (r: MetricResult, period: string | undefined): MetricResult => (period ? { ...r, period } : r);

/** สีที่ให้มาแล้ว (เกณฑ์คิดที่อื่น เช่น Empty Return · Damage) → ผลของตัวชี้วัด · bands null = ไม่มีข้อมูล */
export function bandResult(key: MetricKey, bands: Band[] | null,
  extra?: Pick<MetricResult, "na" | "basis" | "detail" | "tone" | "baseline" | "pcts" | "actual" | "scope" | "base">): MetricResult {
  if (!bands) return { key, pending: false, tally: null, score: null, ...extra };
  const t: Tally = { g: 0, y: 0, r: 0, n: bands.length };
  for (const b of bands) t[b]++;
  return { key, pending: false, tally: t, score: scoreOf(t), ...extra };
}

/** ชุดอ้างอิงของเกณฑ์ percentile — values = ค่าของทุกรายการในช่วงอ้างอิง · label = ช่วงเดือน/จำนวนรายการ (ป็อบอัพ) */
export interface RefSet { values: number[]; label: string; ok?: boolean; na?: string; scope?: string; period?: string }

/** P25 · P30 · P70 · P75 ของชุด Baseline ในรูปแสดงผลของตัวชี้วัด · ว่าง = undefined */
export function pctsOf(values: number[], show: (v: number) => string): MetricResult["pcts"] {
  const v = finite(values);
  const q = (p: number) => percentileInc(v, p);
  const a = q(0.25), b = q(0.3), c = q(0.7), d = q(0.75);
  return a == null || b == null || c == null || d == null ? undefined : { p25: show(a), p30: show(b), p70: show(c), p75: show(d) };
}

/** ข้อความตีความของสี (ข้อ 11) */
export const BAND_MEANING: Record<Band, string> = {
  g: "Performance ดีขึ้นเมื่อเทียบกับ Reference Baseline",
  y: "อยู่ในช่วงเฝ้าระวังเมื่อเทียบกับ Reference Baseline",
  r: "Performance แย่ลงเมื่อเทียบกับ Reference Baseline",
};

/**
 * ค่าของทุกรายการ → ผลของตัวชี้วัด · values null = ชุดข้อมูลยังไม่มี/โหลดไม่ได้ · ไม่มีรายการ = score null
 * ref = ชุดอ้างอิง 12 เดือนล่าสุด (lib/pi/baseline.ts) — เกณฑ์ percentile คิดจากชุดนี้ ไม่ใช่จาก values
 *   ไม่ส่ง ref = คิดจาก values เอง (ไว้ให้เทสต์เดิม — หน้าจอส่ง ref ทุกตัวแล้ว)
 */
export function metricResult(key: MetricKey, values: number[] | null, ref?: RefSet | null, actual?: number | null): MetricResult {
  const def = METRICS[key];
  const rule = def.rule;
  if (!rule) return { key, pending: true, tally: null, score: null };
  if (!values) return { key, pending: false, tally: null, score: null };
  const extra = ref ? { baseline: ref.label, scope: ref.scope, pcts: pctsOf(ref.values, def.show) } : {};
  // Baseline ไม่ครบ/ไม่มี = N/A ไม่สร้างคะแนนจากข้อมูลที่ไม่พอ (ข้อ 7)
  if (ref && ref.ok === false) return { key, pending: false, tally: null, score: null, na: ref.na ?? "Baseline ไม่ครบ",
    detail: ref.label, ...extra, base: baseOf(null, ref.period) };
  const r = rule(ref ? ref.values : values, def.show);
  if (!r) return { key, pending: false, tally: { g: 0, y: 0, r: 0, n: 0 }, score: null,
    ...(ref ? { basis: `ชุดอ้างอิงไม่มีรายการให้คิดเกณฑ์ · ${ref.label}` } : {}), ...extra };
  const t = tally(values, r.band);
  const base = ref ? baseOf(ref.values.filter(Number.isFinite).map(r.band), ref.period) : undefined;
  const act = actual != null && Number.isFinite(actual)
    ? { actual: { v: def.show(actual), band: r.band(actual), why: r.why(actual) } } : {};
  return { key, pending: false, tally: t, score: scoreOf(t), basis: ref ? `${r.basis} · ${ref.label}` : r.basis, ...extra, ...act, base };
}

/** สถานะของหมวด (เต็ม 20) — ตารางใน "InDex_revised v2.md" ใช้กับทุกหมวด */
export type IndexStatus = "pass" | "watch" | "fail";
export const STATUS_LABEL: Record<IndexStatus, string> = { pass: "ผ่านเกณฑ์", watch: "เฝ้าระวัง", fail: "ไม่ผ่านเกณฑ์" };
export const STATUS_RANGE: Record<IndexStatus, string> = { pass: "15–20 คะแนน", watch: "10–14.99 คะแนน", fail: "0–9.99 คะแนน" };
export const STATUS_MEANING: Record<IndexStatus, string> = {
  pass: "ผลการดำเนินงานอยู่ในระดับที่ดี สามารถควบคุมได้",
  watch: "เริ่มมีแนวโน้มที่ควรติดตามและปรับปรุง",
  fail: "ผลการดำเนินงานต่ำกว่าเกณฑ์ ควรตรวจสอบสาเหตุและดำเนินการปรับปรุง",
};
/** คิดเฉพาะเมื่อได้คะแนนครบทุกตัวชี้วัดของหมวด — ขาดตัวหนึ่งเทียบ 15/10 ไม่ได้ */
export function indexStatus(results: MetricResult[]): IndexStatus | null {
  if (!results.length || results.some((r) => r.score == null)) return null;
  const total = results.reduce((s, r) => s + r.score!, 0);
  return total >= 15 ? "pass" : total >= 10 ? "watch" : "fail";
}

/** รวมคะแนนเฉพาะตัวที่คิดได้ · max = ฐานของตัวที่คิดได้ (10 ต่อตัว) */
export function sumScores(results: MetricResult[]): { score: number; max: number } {
  let score = 0, max = 0;
  for (const r of results) if (r.score != null) { score += r.score; max += METRIC_MAX; }
  return { score, max };
}
