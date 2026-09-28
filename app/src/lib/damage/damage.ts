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
  /** จำนวนเดือนที่ใช้คิด */
  months: number;
  /**
   * ใช้ P75 เป็นเกณฑ์ได้ไหม — ต้องมีอย่างน้อย 2 เดือน (ไฟล์ "dashboard คชจ.md" 27 ก.ย. 2569: เลือกเดือนเดียว
   * แสดง KPI ตามปกติแต่ไม่ใช้ P75 เป็นเกณฑ์ · เจ้าของงานเลือกให้ไม่จัดระดับ/คำแนะนำ ไม่มี Alert ซ่อนเส้น P75)
   */
  usable: boolean;
}

/** เกณฑ์ P75 จาก KPI รายเดือนของเที่ยวที่ส่งมา (ต้องเป็นชุดที่กรองเฉพาะเวลา — ดูหัวไฟล์) */
export function damageThresholds(trips: DamageTrip[]): DamageThresholds {
  const monthly = aggregateDamage(trips, (t) => t.mo);
  const p75Rate = percentileInc(monthly.flatMap((a) => (a.rate == null ? [] : [a.rate])), 0.75);
  const p75Incidence = percentileInc(monthly.map((a) => a.incidence), 0.75);
  return {
    // เดือนที่ไม่มีรายได้เลยหา Damage Rate ไม่ได้ จึงไม่นับเข้าเปอร์เซ็นไทล์ของ Damage Rate
    p75Rate, p75Incidence, months: monthly.length,
    usable: monthly.length >= 2 && p75Rate != null && p75Incidence != null,
  };
}

/* ---------------- ระดับความเสียหาย + คำแนะนำ ---------------- */

/**
 * ★ ไฟล์ "dashboard คชจ.md" (เจ้าของงานส่ง 27 ก.ย. 2569) แทนเกณฑ์ 5 กรณีของ 24 ก.ย. — สองชุดแยกกัน ตารางเส้นทางแสดงทั้งคู่ (เจ้าของงานเลือก):
 *   ระดับความเสียหาย 4 ระดับ: DR = 0 และ DIR = 0 → ไม่มี · ไม่เกินทั้งคู่ → ต่ำ · เกินตัวใดตัวหนึ่ง → ปานกลาง · เกินทั้งคู่ → สูง
 *   คำแนะนำ (logic ในไฟล์): DR = 0 → ติดตามผล · DR > 0 และ DIR ≤ P75 → ตรวจสอบ (ไฟล์เขียน "แก้ไขตามปกติ" ด้วย เจ้าของงานเลือก "ตรวจสอบ")
 *     · DIR > P75 และ DR ≤ P75 → ปรับปรุงกระบวนการ · เกินทั้งคู่ → เร่งตรวจสอบและแก้ไข
 *   ★ สองชุดไม่ตรงกันตรง "DR เกิน แต่ DIR ไม่เกิน" = ระดับปานกลาง แต่คำแนะนำ "ตรวจสอบ" — ตามไฟล์ ไม่ใช่บั๊ก
 *   "เท่ากับ P75" ไม่ถือว่าเกิน · มีความเสียหายแต่ไม่มีรายได้ (rate = null) = เกินเกณฑ์มูลค่าแน่นอน
 */
export type DamageLevel = "none" | "low" | "medium" | "high";

export const LEVELS: { key: DamageLevel; label: string; rank: number; when: string; meaning: string; action: string }[] = [
  { key: "high", label: "ระดับสูง", rank: 3, when: "DR > P75 และ DIR > P75",
    meaning: "ความเสียหายเกิดบ่อยและ/หรือมีผลกระทบด้านมูลค่าสูง ควรเร่งแก้ไข",
    action: "วิเคราะห์สาเหตุหลักและกำหนดมาตรการป้องกันการเกิดซ้ำ" },
  { key: "medium", label: "ระดับปานกลาง", rank: 2, when: "DR > P75 หรือ DIR > P75",
    meaning: "เริ่มพบความเสียหายที่ควรเฝ้าระวัง ทั้งด้านมูลค่าหรือจำนวนครั้ง",
    action: "ตรวจสอบสาเหตุและปรับปรุงกระบวนการ ติดตามปัจจัยที่ทำให้เกิดความเสียหาย" },
  { key: "low", label: "ระดับต่ำ", rank: 1, when: "DR ≤ P75 และ DIR ≤ P75",
    meaning: "ความเสียหายทั้งด้านมูลค่าและความถี่อยู่ในระดับอ้างอิง",
    action: "ตรวจสอบบิลเคลียร์/เหตุการณ์เป็นรายกรณีและหาวิธีป้องกัน" },   // เจ้าของงานแก้ 28 ก.ย. 2569
  { key: "none", label: "ไม่มีความเสียหาย", rank: 0, when: "DR = 0 และ DIR = 0",
    meaning: "ไม่พบความเสียหายจากการขนส่ง",
    action: "ติดตามผลการดำเนินงานอย่างต่อเนื่อง" },
];
export const levelOf = (k: DamageLevel) => LEVELS.find((l) => l.key === k)!;

export type DamageRec = "follow" | "check" | "improve" | "urgent";
/** ตาราง "คำแนะนำและแนวทางการดำเนินการ" ตามไฟล์ — ลำดับตามไฟล์ */
export const RECS: { key: DamageRec; label: string; when: string; action: string }[] = [
  { key: "follow", label: "ติดตามผล", when: "DR = 0",
    action: "ติดตาม KPI อย่างต่อเนื่องเพื่อรักษาระดับผลการดำเนินงาน" },
  { key: "check", label: "ตรวจสอบ", when: "DR > 0 และ DIR ≤ P75",
    action: "ตรวจสอบบิลเคลียร์/เหตุการณ์เป็นรายกรณี และแก้ไขตามกระบวนการปกติ" },
  { key: "improve", label: "ปรับปรุงกระบวนการ", when: "DR > 0 · DIR > P75 และ DR ≤ P75",
    action: "ตรวจสอบ Loading, Handling, Route หรือการปฏิบัติงาน เพื่อหาสาเหตุของการเกิดซ้ำ" },
  { key: "urgent", label: "เร่งตรวจสอบและแก้ไข", when: "DR > P75 และ DIR > P75",
    action: "หา Root Cause โดยเร็ว และกำหนดมาตรการแก้ไขและป้องกันการเกิดซ้ำ" },
];
export const recOf = (k: DamageRec) => RECS.find((r) => r.key === k)!;

type LevelInput = Pick<DamageAgg, "rate" | "incidence" | "clrAmt" | "dmgTrips">;
const over = (a: LevelInput, th: DamageThresholds) => ({
  rate: (a.rate ?? Infinity) > th.p75Rate!, inc: a.incidence > th.p75Incidence!,
});

/** ระดับความเสียหาย · null = ใช้ P75 ไม่ได้ (เดือนเดียว/ไม่มีข้อมูล) — ยกเว้นไม่มีความเสียหายเลย */
export function damageLevel(a: LevelInput, th: DamageThresholds): DamageLevel | null {
  if (!(a.clrAmt > 0) && !a.dmgTrips) return "none";
  if (!th.usable) return null;
  const o = over(a, th);
  return o.rate && o.inc ? "high" : o.rate || o.inc ? "medium" : "low";
}

/** คำแนะนำตาม logic ในไฟล์ · null = ใช้ P75 ไม่ได้ — ยกเว้น DR = 0 (ติดตามผล ไม่ต้องใช้เกณฑ์) */
export function damageRec(a: LevelInput, th: DamageThresholds): DamageRec | null {
  if (!(a.clrAmt > 0)) return "follow";
  if (!th.usable) return null;
  const o = over(a, th);
  return !o.inc ? "check" : o.rate ? "urgent" : "improve";
}

/* ---------------- ตัวกรองช่วงเวลา ---------------- */

/** ปี ค.ศ. (ว่าง = ทุกปี) + ช่วงเดือน "01".."12" ใช้ได้เฉพาะเมื่อเลือกปี — ย้ายไปใช้ร่วมที่ lib/filter/period.ts แล้ว */
export type { Period as DamagePeriod } from "../filter/period";
export { PERIOD_ALL, inPeriod, isPartialYear } from "../filter/period";
