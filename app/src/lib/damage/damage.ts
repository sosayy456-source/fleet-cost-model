/**
 * สูตรของแท็บ Damage Rate (สเปก `dashboard คชจ.pdf` + `ออกแบบ Dashboard.pdf` · เจ้าของงานเคาะ 23 ก.ย. 2569)
 *
 *   Damage Rate (%)           = มูลค่าบิลเคลียร์ ÷ รายได้รวม × 100
 *   Damage Incidence Rate (%) = เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด × 100
 *
 * ★ เกณฑ์ P75 = "Global Threshold" — คิดจาก KPI **รายเดือนของภาพรวมบริษัท** ในช่วงเวลาที่เลือก
 *   ไม่คิดแยกตามเส้นทาง/รถ แล้วเอาไปเทียบกับทุกกลุ่ม เส้นทาง × ประเภทรถ × ชนิดรถ
 *   ผู้เรียกจึงต้องส่งเที่ยวที่ผ่าน**ตัวกรองเวลาอย่างเดียว**เข้า `damageThresholds()` ห้ามส่งชุดที่กรองเส้นทาง/รถแล้ว
 * ★ P75 ใช้สูตรเดียวกับ `PERCENTILE.INC` ของ Excel เพื่อให้ตรวจตัวเลขใน Excel ได้ตรง ๆ
 *   นับทุกเดือนที่มีเที่ยวในช่วง รวมเดือนที่มีเที่ยวน้อยด้วย (เจ้าของงานเคาะ — ตามสเปก ไม่ตัดทิ้ง)
 * ★ เลือกเดือนเดียวก็ยังใช้ P75 เป็นเกณฑ์ (P75 ของค่าเดียว = ค่านั้นเอง) แต่หน้าจอต้องขึ้นโน้ต
 *   ให้เลือกอย่างน้อย 2 เดือน — เจ้าของงานเลือกทางนี้แทน "ไม่จัดระดับ" ตามที่สเปกเขียน
 */

/** ขั้นต่ำของเที่ยวที่นับกลุ่มเข้า Damage Alert / กราฟอันดับ — กลุ่มเที่ยวเดียวเสียหายได้ Incidence 100% ทันที */
export const MIN_TRIPS_ALERT = 5;

/** เที่ยวหนึ่งเที่ยวเท่าที่สูตรนี้ต้องใช้ — Trip ของ costrev มีครบ */
export interface DamageTrip {
  mo: string;
  rev: number;
  clrAmt: number;
  clrN: number;
}

export interface DamageAgg {
  key: string;
  /** จำนวนเที่ยวทั้งหมด · เที่ยวที่มีบิลเคลียร์อย่างน้อย 1 รายการ */
  n: number; dmgTrips: number;
  rev: number; clrAmt: number;
  /** null เมื่อไม่มีรายได้ — หารไม่ได้ ห้ามแสดงเป็น 0 */
  rate: number | null;
  incidence: number;
}

/** รวมยอดตามคีย์ — keyOf ต้องคืนค่าที่ไม่ว่างเสมอ ไม่งั้นยอดรวมไม่ครบตามจำนวนเที่ยว */
export function aggregateDamage<T extends DamageTrip>(trips: T[], keyOf: (t: T) => string): DamageAgg[] {
  const m = new Map<string, DamageAgg>();
  for (const t of trips) {
    const k = keyOf(t);
    const a = m.get(k) ?? { key: k, n: 0, dmgTrips: 0, rev: 0, clrAmt: 0, rate: null, incidence: 0 };
    a.n++; a.rev += t.rev; a.clrAmt += t.clrAmt;
    if (t.clrN > 0) a.dmgTrips++;
    m.set(k, a);
  }
  return [...m.values()].map(finish);
}

/** ยอดรวมก้อนเดียว — รวมจากเที่ยวตรง ๆ ไม่ใช่เฉลี่ยจากรายกลุ่ม (เฉลี่ยของอัตราไม่ใช่อัตรารวม) */
export function totalDamage(trips: DamageTrip[]): DamageAgg {
  return aggregateDamage(trips, () => "*")[0] ?? finish({ key: "*", n: 0, dmgTrips: 0, rev: 0, clrAmt: 0, rate: null, incidence: 0 });
}

function finish(a: DamageAgg): DamageAgg {
  return { ...a, rate: a.rev ? a.clrAmt / a.rev * 100 : null, incidence: a.n ? a.dmgTrips / a.n * 100 : 0 };
}

/**
 * เปอร์เซ็นไทล์แบบ `PERCENTILE.INC` ของ Excel (ประมาณค่าเชิงเส้นระหว่างอันดับ)
 * p อยู่ในช่วง 0–1 · คืน null ถ้าไม่มีค่าเลย
 */
export function percentileInc(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const r = p * (s.length - 1);
  const lo = Math.floor(r);
  const hi = Math.ceil(r);
  return s[lo]! + (s[hi]! - s[lo]!) * (r - lo);
}

export interface DamageThresholds {
  p75Rate: number | null;
  p75Incidence: number | null;
  /** จำนวนเดือนที่ใช้คิด — น้อยกว่า 2 ให้หน้าจอขึ้นโน้ตเตือน */
  months: number;
}

/** เกณฑ์ P75 จาก KPI รายเดือนของเที่ยวที่ส่งมา (ต้องเป็นชุดที่กรองเฉพาะเวลา — ดูหัวไฟล์) */
export function damageThresholds(trips: DamageTrip[]): DamageThresholds {
  const monthly = aggregateDamage(trips, (t) => t.mo);
  return {
    // เดือนที่ไม่มีรายได้เลยหา Damage Rate ไม่ได้ จึงไม่นับเข้าเปอร์เซ็นไทล์ของ Damage Rate
    p75Rate: percentileInc(monthly.flatMap((a) => (a.rate == null ? [] : [a.rate])), 0.75),
    p75Incidence: percentileInc(monthly.map((a) => a.incidence), 0.75),
    months: monthly.length,
  };
}

/* ---------------- ระดับความเสียหาย ---------------- */

/** เดิมสเปกเรียก "คำแนะนำ" — เจ้าของงานเปลี่ยนเป็น "ระดับความเสียหาย" 23 ก.ย. 2569 */
export type DamageLevel = "none" | "low" | "medium" | "high";

export const LEVELS: { key: DamageLevel; label: string; rank: number; when: string; action: string }[] = [
  { key: "high", label: "ระดับสูง", rank: 3,
    when: "Damage Rate > P75 และ Incidence Rate > P75",
    action: "เร่งตรวจสอบและแก้ไข หา Root Cause โดยเร็ว และกำหนดมาตรการแก้ไขและป้องกันการเกิดซ้ำ" },
  { key: "medium", label: "ระดับปานกลาง", rank: 2,
    when: "Damage Rate > 0 · Incidence Rate > P75 · Damage Rate ≤ P75",
    action: "ปรับปรุงกระบวนการ ตรวจสอบ Loading, Handling, Route หรือการปฏิบัติงาน เพื่อหาสาเหตุของการเกิดซ้ำ" },
  { key: "low", label: "ระดับต่ำ", rank: 1,
    when: "Damage Rate > 0 · Incidence Rate ≤ P75",
    action: "ตรวจสอบบิลเคลียร์/เหตุการณ์เป็นรายกรณี และแก้ไขตามกระบวนการปกติ" },
  { key: "none", label: "ไม่มีความเสียหาย", rank: 0,
    when: "Damage Rate = 0",
    action: "ติดตาม KPI อย่างต่อเนื่องเพื่อรักษาระดับผลการดำเนินงาน" },
];
export const levelOf = (k: DamageLevel) => LEVELS.find((l) => l.key === k)!;

/**
 * จัดระดับตาม logic หน้า 7 ของสเปก — ลำดับเงื่อนไขครอบทุกกรณีแล้ว:
 *   DR = 0 → none · DIR ≤ P75 → low · DR ≤ P75 → medium · ที่เหลือ (ทั้งคู่เกิน) → high
 * คืน null ถ้ายังไม่มีเกณฑ์ (ช่วงเวลาที่เลือกไม่มีข้อมูลเลย) — แยกระดับไม่ได้ ยกเว้นไม่มีความเสียหาย
 */
export function damageLevel(a: Pick<DamageAgg, "rate" | "incidence" | "clrAmt">, th: DamageThresholds): DamageLevel | null {
  if (!(a.clrAmt > 0)) return "none";
  if (th.p75Rate == null || th.p75Incidence == null) return null;
  // มีความเสียหายแต่ไม่มีรายได้ (rate = null) = เสียหายเท่าไรก็เกินทุกเกณฑ์
  const dr = a.rate ?? Infinity;
  if (a.incidence <= th.p75Incidence) return "low";
  if (dr <= th.p75Rate) return "medium";
  return "high";
}

/* ---------------- ตัวกรองช่วงเวลา ---------------- */

/** ปี ค.ศ. (ว่าง = ทุกปี) + ช่วงเดือน "01".."12" ใช้ได้เฉพาะเมื่อเลือกปี */
export interface DamagePeriod { year: string; from: string; to: string }
export const PERIOD_ALL: DamagePeriod = { year: "", from: "01", to: "12" };

export function inPeriod(t: { y: number; mo: string }, p: DamagePeriod): boolean {
  if (!p.year) return true;
  if (String(t.y) !== p.year) return false;
  const m = t.mo.slice(5);
  return m >= p.from && m <= p.to;
}

/** เลือกช่วงเดือนแคบกว่าทั้งปีอยู่ไหม */
export const isPartialYear = (p: DamagePeriod): boolean => !!p.year && (p.from !== "01" || p.to !== "12");
