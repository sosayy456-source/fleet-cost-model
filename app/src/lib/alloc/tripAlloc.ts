/**
 * ปันต้นทุนเที่ยวรถเข้าบิลลูกค้า — สูตรเดียวกับ etl/src/alloc.py (เจ้าของงานสั่ง 27 ก.ย. 2569)
 * ใช้กับใบที่บันทึกใหม่ในโมเดล (ป็อบอัพรายละเอียดเที่ยว · features/records/TripDetailModal.tsx)
 *
 *   Conversion Factor (กก./ลบ.ม.) = ความจุน้ำหนักรวม ÷ ความจุปริมาตรรวม ของรถที่จัดจริง (หัว + หาง) — ห้ามใส่ค่าตายตัว
 *   น้ำหนักเทียบเท่า = MAX(น้ำหนักจริง, ปริมาตร × CF) · Metric = น้ำหนักเทียบเท่า × ระยะทาง (กก.-กม.)
 *   ต้นทุนบิล = ต้นทุนเที่ยว × Metric ÷ Σ Metric
 *   ระยะทาง = ต้นทางของบิล → ปลายทางของบิล ตามตารางมาตรฐาน (ไม่ใช่ระยะสะสมของเที่ยว — ต้นทุนเที่ยวคงที่
 *     ระยะทางเป็นแค่ตัวถ่วง ต้นทุนรวมจึงไม่บวมตามจำนวนจุดส่ง) · หาไม่เจอ = ค่ากลางของบิลอื่นในเที่ยว · ไม่มีเลย = 1
 *   บิลที่น้ำหนัก/ขนาดเชื่อไม่ได้ (ไม่มีทั้งคู่ · ชิ้นเดียวเกิน 10 ลบ.ม. · ไม่มีน้ำหนัก + ปริมาตร < 0.001) ปันตามรายได้แยกก้อน
 *     (เจ้าของงานเลือกคงไว้ 27 ก.ย. 2569 — กติกาเดียวกับ data_flag/pool_of ใน ETL)
 *   ปัดเศษ: ต้นทุนบิลละสตางค์ ส่วนต่างให้บิลที่ต้นทุนมากสุด (บิลแรกถ้าเท่ากัน) → Σ = ต้นทุนเที่ยวพอดี
 * ★ แก้สูตรที่นี่ต้องแก้ etl/src/alloc.py ให้ตรงกัน (ETL คิดเป็นตัน · ที่นี่คิดเป็นกิโลกรัม สัดส่วนเท่ากัน)
 */

export type AllocFlag = "" | "ไม่มีน้ำหนัก/ขนาด" | "ขนาดเกินจริง" | "ขนาดเล็กผิดปกติ";
export type DistSource = "ตารางระยะทาง" | "ค่ากลางของเที่ยว" | "ไม่มีในตาราง";

export interface AllocItem {
  key: string;
  weightKg: number;
  volumeM3: number;
  qty: number;
  /** ระยะทางจากตาราง (ต้นทาง → ปลายทางของบิล) · null = หาไม่เจอ */
  distKm: number | null;
  revenue: number;
}

export interface AllocRow extends AllocItem {
  dist: number; distSource: DistSource;
  cf: number;
  /** น้ำหนักเทียบเท่า (กก.) · เงื่อนไข 1 = MAX · 2 = น้ำหนักอย่างเดียว · 3 = ปริมาตรอย่างเดียว · 4 = ไม่มีทั้งคู่ */
  eqKg: number; cond: 1 | 2 | 3 | 4;
  /** กก.-กม. */
  metric: number;
  flag: AllocFlag;
  /** ปันตามรายได้ (ข้อมูลน้ำหนัก/ขนาดเชื่อไม่ได้) */
  byRevenue: boolean;
  /** สัดส่วนของต้นทุนเที่ยว 0–1 */
  share: number;
  /** ต้นทุนที่ปันให้ (ปัดสตางค์แล้ว Σ = ต้นทุนเที่ยว) */
  cost: number;
}

export interface AllocResult { rows: AllocRow[]; cf: number | null; totalMetric: number; error: string | null }

const PIECE_M3_MAX = 10;
const TINY_M3 = 0.001;

/** CF (กก./ลบ.ม.) = ความจุน้ำหนัก ÷ ความจุปริมาตร · null = ความจุไม่ครบ (กันหารศูนย์) */
export function conversionFactor(capKg: number | null | undefined, capM3: number | null | undefined): number | null {
  if (capKg == null || capM3 == null || !(capKg > 0) || !(capM3 > 0)) return null;
  return capKg / capM3;
}

/** น้ำหนักเทียบเท่า (กก.) = MAX(น้ำหนัก, ปริมาตร × CF) · ไม่มีทั้งคู่ = จำนวน × 1,000 (เงื่อนไข 4 เดิมของ ETL) */
export function equivalentKg(weightKg: number, volumeM3: number, qty: number, cf: number): { eqKg: number; cond: 1 | 2 | 3 | 4 } {
  const vol = volumeM3 * cf;
  if (weightKg > 0 && volumeM3 > 0) return { eqKg: Math.max(weightKg, vol), cond: 1 };
  if (weightKg > 0) return { eqKg: weightKg, cond: 2 };
  if (volumeM3 > 0) return { eqKg: vol, cond: 3 };
  return { eqKg: qty * 1000, cond: 4 };
}

function flagOf(it: AllocItem, cond: number): AllocFlag {
  if (cond === 4) return "ไม่มีน้ำหนัก/ขนาด";
  const perPiece = it.qty > 0 ? it.volumeM3 / it.qty : it.volumeM3;
  if (perPiece > PIECE_M3_MAX) return "ขนาดเกินจริง";
  if (it.weightKg <= 0 && it.volumeM3 > 0 && it.volumeM3 < TINY_M3) return "ขนาดเล็กผิดปกติ";
  return "";
}

/** ปัดรายการละสตางค์ ส่วนต่างให้รายการที่มากสุด (รายการแรกถ้าเท่ากัน) — round_allocs ใน ETL */
export function roundAllocs(values: number[], total: number): number[] {
  const r = values.map((v) => Math.round(v * 100) / 100);
  const diff = Math.round((total - r.reduce((s, v) => s + v, 0)) * 1e9) / 1e9;
  if (diff && r.length) {
    let i = 0;
    values.forEach((v, k) => { if (v > values[i]!) i = k; });
    r[i] = Math.round((r[i]! + diff) * 1e9) / 1e9;
  }
  return r;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** ปันต้นทุนหนึ่งเที่ยว · error ≠ null = คำนวณไม่ได้ (rows ว่าง) */
export function allocateTrip(items: AllocItem[], tripCost: number, cf: number | null): AllocResult {
  const fail = (error: string): AllocResult => ({ rows: [], cf, totalMetric: 0, error });
  if (!items.length) return fail("ใบนี้ยังไม่มีบิล");
  if (!Number.isFinite(tripCost) || tripCost < 0) return fail("ต้นทุนเที่ยวต้องไม่ติดลบ");
  if (cf == null || !(cf > 0)) return fail("ความจุรถไม่ครบ (ต้องมีทั้งน้ำหนัก กก. และปริมาตร ลบ.ม. มากกว่า 0) — คิด Conversion Factor ไม่ได้");
  const bad = items.find((it) => it.weightKg < 0 || it.volumeM3 < 0 || (it.distKm != null && it.distKm < 0));
  if (bad) return fail(`บิล ${bad.key}: น้ำหนัก ปริมาตร และระยะทางต้องไม่ติดลบ`);

  const known = items.flatMap((it) => (it.distKm != null && it.distKm > 0 ? [it.distKm] : []));
  const fill = known.length ? median(known) : 1;
  const rows: AllocRow[] = items.map((it) => {
    const hasDist = it.distKm != null && it.distKm > 0;
    const dist = hasDist ? it.distKm! : fill;
    const { eqKg, cond } = equivalentKg(it.weightKg, it.volumeM3, it.qty, cf);
    return {
      ...it, dist, distSource: hasDist ? "ตารางระยะทาง" : known.length ? "ค่ากลางของเที่ยว" : "ไม่มีในตาราง",
      cf, eqKg, cond, metric: eqKg * dist, flag: flagOf(it, cond), byRevenue: false, share: 0, cost: 0,
    };
  });

  // ก้อนบิลที่ข้อมูลเชื่อไม่ได้ปันตามรายได้ — ที่เหลือแบ่งตาม Metric (pool_of / share_in_trip ของ ETL)
  const revAll = rows.reduce((s, r) => s + r.revenue, 0);
  const revFlag = rows.reduce((s, r) => s + (r.flag ? r.revenue : 0), 0);
  const f = revAll > 0 && revFlag > 0 ? revFlag / revAll : 0;
  const normal = rows.filter((r) => !(f && r.flag));
  const totalMetric = normal.reduce((s, r) => s + r.metric, 0);
  if (normal.length && !(totalMetric > 0)) return fail("Total Metric = 0 — ไม่มีน้ำหนัก/ปริมาตร/ระยะทางให้ปันต้นทุน");
  for (const r of rows) {
    if (f && r.flag) { r.byRevenue = true; r.share = r.revenue / revAll; }
    else r.share = (1 - f) * r.metric / totalMetric;
  }
  roundAllocs(rows.map((r) => tripCost * r.share), tripCost).forEach((c, i) => { rows[i]!.cost = c; });
  return { rows, cf, totalMetric, error: null };
}
