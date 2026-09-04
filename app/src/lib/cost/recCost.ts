/**
 * แยกต้นทุนเป็นหมวดสำหรับตารางและแดชบอร์ด — ยกจาก recCost() ใน v5:2864
 *
 * ต่างจาก computeCost ตรงที่ตัวนี้ทำงานกับ "ใบที่บันทึกแล้ว" ซึ่งอาจมาจากชีตเก่า
 * ที่มีแต่ยอดรวม ไม่มีรายการย่อยพอจะคำนวณใหม่ จึงอ่านค่าที่เก็บไว้เป็นหลัก
 * และคำนวณสำรองให้เฉพาะตอนไม่มีค่านั้น
 */
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export interface CostBreakdown {
  fuel: number;
  driver: number;
  repair: number;
  other: number;
  waste: number;
  total: number;
}

/**
 * รับได้ทั้ง TripRecord และแถวดิบจากชีตเก่า
 * ใช้ object แทน Record<string, unknown> เพราะ interface ใน TS ไม่มี index signature
 * จึงไม่เข้ากับ Record โดยตรง
 */
export type CostSource = object;

export function recCost(rec: CostSource): CostBreakdown {
  const r = rec as Record<string, unknown>;
  const fuel = n(r.gas) + n(r.fuelSum);
  const driver = n(r.drv) + n(r.spare) + n(r.snd);
  const repair = r.repTotal != null ? n(r.repTotal) : n(r.repFix) + n(r.repVar);
  const other = n(r.feeTarp) + n(r.feePolice) + n(r.feeCont)
    + n(r.feePort) + n(r.feeDoc) + n(r.feeToll);
  const waste = r.waste != null ? n(r.waste)
    : n(r.fuelOff) + n(r.fuelDetour) + n(r.fuelOffFleet) + n(r.laborOff);

  return { fuel, driver, repair, other, waste, total: fuel + driver + repair + other + waste };
}

/** สินค้าประเภทนี้คือการตัดหนี้สูญทางบัญชี ไม่นับเป็นลูกหนี้ค้างชำระ (v5:3384) */
export const CLEARED_GOODS = "บิลเคลียร์";

/** ยอดตัดหนี้สูญของใบ — แดชบอร์ดหักออกจากกำไรเป็นค่าใช้จ่ายบริหาร */
export function adminWriteOff(rec: CostSource): number {
  const r = rec as Record<string, unknown>;
  const bills = Array.isArray(r.bills) ? (r.bills as Record<string, unknown>[]) : [];
  return bills
    .filter((b) => b.goodsType === CLEARED_GOODS)
    .reduce((s, b) => s + n(b.total), 0);
}

export const recProfit = (rec: CostSource): number =>
  n((rec as Record<string, unknown>).revenue) - recCost(rec).total - adminWriteOff(rec);
