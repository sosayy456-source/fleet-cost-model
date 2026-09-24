/**
 * Performance Index (PI) ของหน้า Demo — 5 หมวด × 2 ตัวชี้วัด × 10 คะแนน = 100 (เจ้าของงานส่งตาราง 25 ก.ย. 2569)
 *
 *   คะแนนของตัวชี้วัด = (จำนวนเขียว + 0.5 × จำนวนเหลือง) ÷ จำนวนรายการทั้งหมด × 10   (เขียว 1 · เหลือง 0.5 · แดง 0)
 *   "รายการ" = หน่วยที่ให้สีทีละตัว (เจ้าของงานเลือก) — ต่างกันตามตัวชี้วัด ดู UNIT ข้างล่าง
 *   คะแนนหมวด = ผลรวมสองตัวชี้วัด (เต็ม 20) · คะแนนรวม = ผลรวม 5 หมวด (เต็ม 100)
 *
 * ★ เกณฑ์สีเป็นตัวเลขตายตัวตามตารางของเจ้าของงาน (เจ้าของงานเลือก — ไม่คิด percentile สดจากข้อมูล)
 *   ช่องที่ตารางยังว่าง = band: null → "รอเกณฑ์" ไม่นับทั้งคะแนนและฐาน (คะแนนรวมบอกฐานที่คิดได้ไว้ด้วย)
 *   ชุดตัวอย่างมี Cost per Ton-km แพงกว่าเกณฑ์มาก (P25 ≈ 5.7 บาท) เกือบทุกคันจึงเป็นแดง — ผลของเกณฑ์ ไม่ใช่บั๊ก
 * ★ On-time Delivery ตัดออก (เจ้าของงานสั่ง) หมวด Service Quality เหลือ Damage Rate (DR) + Damage Incidence Rate (DIR)
 *   ตัวละ 10 คะแนน ให้คะแนนรวมยังเต็ม 100 · **สองตัวนี้ไม่ใช้การนับสี** — คิดคะแนนต่อเนื่องเทียบ P75 ตามสเปก
 *   "dashboard คชจ.pdf" (lib/pi/damage.ts) จึงมี band: null แต่ไม่ได้ "รอเกณฑ์"
 */

export type Band = "g" | "y" | "r";

/** นับสีของรายการ · n = จำนวนรายการทั้งหมด */
export interface Tally { g: number; y: number; r: number; n: number }

export type MetricKey = "route" | "service" | "lf" | "empty" | "tkm" | "coverage" | "custProfit" | "dso" | "dr" | "dir";

export interface MetricDef {
  label: string;
  /** หน่วยของ "รายการ" ที่ให้สี — ใช้ในข้อความบอกจำนวน */
  unit: string;
  /** ให้สีรายการหนึ่งจากค่าของมัน · null = ยังไม่มีเกณฑ์ (รอตารางอัปเดต) */
  band: ((v: number) => Band) | null;
}

/** ค่ามาก = ดี · green ≤ v → เขียว · yellow ≤ v → เหลือง · ต่ำกว่านั้นแดง */
const higher = (green: number, yellow: number) => (v: number): Band => (v >= green ? "g" : v >= yellow ? "y" : "r");
/** ค่าน้อย = ดี · v ≤ green → เขียว · v ≤ yellow → เหลือง · เกินนั้นแดง */
const lower = (green: number, yellow: number) => (v: number): Band => (v <= green ? "g" : v <= yellow ? "y" : "r");

export const METRICS: Record<MetricKey, MetricDef> = {
  route: { label: "Route", unit: "เส้นทาง", band: null },
  service: { label: "Service group", unit: "กลุ่มบริการ", band: null },
  // Max LF รายเที่ยวของไฟล์ Load Factor (สัดส่วน 0–1.3) · ≥ 84% / 47–84% / < 47%
  lf: { label: "Load Factor", unit: "เที่ยว", band: higher(0.84, 0.47) },
  empty: { label: "Empty Return", unit: "เที่ยว", band: null },
  // บาท ÷ ตัน-กม. รายคัน (VRow.perTkm ของหน้ารายละเอียด ข้อ 3) · ≤ 1.28 / 1.28–2.64 / > 2.64
  tkm: { label: "Cost per Ton-km", unit: "คัน", band: lower(1.28, 2.64) },
  // Contribution ÷ ค่าเสื่อม (เท่า) รายคัน เฉพาะรถบริษัทที่มีค่าเสื่อม · ≥ 47.27 / 12.93–47.27 / < 12.93
  coverage: { label: "Fixed Cost Coverage", unit: "คัน", band: higher(47.27, 12.93) },
  // %Margin รายลูกค้า (marginOf ของหน้ากำไรลูกค้า) · ≥ 10% / 0–10% / < 0%
  custProfit: { label: "Customer Net Profit", unit: "ลูกค้า", band: higher(10, 0) },
  // วันที่จ่ายช้ากว่ากำหนดรายบิล (ตามไฟล์ลูกหนี้ ณ วันที่เลือก) · ตรงกำหนด / ช้า 1–30 วัน / ช้าเกิน 30 วัน
  dso: { label: "DSO", unit: "บิล", band: lower(0, 30) },
  // คะแนนต่อเนื่อง MAX(0, 10 − 5 × KPI ÷ P75) — lib/pi/damage.ts ไม่ผ่าน band
  dr: { label: "Damage Rate", unit: "", band: null },
  dir: { label: "Damage Incidence Rate", unit: "", band: null },
};

export interface IndexDef { id: string; title: string; subs: [MetricKey, MetricKey] }

export const INDEXES = {
  route: { id: "route", title: "Route & Service Profitability Index", subs: ["route", "service"] },
  fleet: { id: "fleet", title: "Fleet & Trip Efficiency Index", subs: ["lf", "empty"] },
  cost: { id: "cost", title: "Cost & Vehicle Utilization Index", subs: ["tkm", "coverage"] },
  cust: { id: "cust", title: "Customer Profitability & Cash Flow Index", subs: ["custProfit", "dso"] },
  service: { id: "service", title: "Service Quality Index", subs: ["dr", "dir"] },
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
 * na = ป้ายแทน "ไม่มีข้อมูล" เมื่อมีเหตุเฉพาะ (เช่น "ข้อมูลไม่เพียงพอ") · detail = ที่มาของคะแนนสำหรับ tooltip (ตัวที่ไม่ได้นับสี)
 */
export interface MetricResult {
  key: MetricKey; pending: boolean; tally: Tally | null; score: number | null;
  na?: string; detail?: string;
}

/** ค่าของทุกรายการ → ผลของตัวชี้วัด · values null = ชุดข้อมูลยังไม่มี/โหลดไม่ได้ */
export function metricResult(key: MetricKey, values: number[] | null): MetricResult {
  const band = METRICS[key].band;
  if (!band) return { key, pending: true, tally: null, score: null };
  const t = values ? tally(values, band) : null;
  return { key, pending: false, tally: t, score: t ? scoreOf(t) : null };
}

/** รวมคะแนนเฉพาะตัวที่คิดได้ · max = ฐานของตัวที่คิดได้ (10 ต่อตัว) */
export function sumScores(results: MetricResult[]): { score: number; max: number } {
  let score = 0, max = 0;
  for (const r of results) if (r.score != null) { score += r.score; max += METRIC_MAX; }
  return { score, max };
}
