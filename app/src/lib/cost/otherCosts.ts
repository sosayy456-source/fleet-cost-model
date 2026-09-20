/**
 * "6) ค่าใช้จ่ายอื่นๆ" — รายการที่ผู้กรอกพิมพ์เองว่าเป็นค่าอะไร เท่าไหร่ ทางตรงหรือทางอ้อม
 *
 * ทั้งสองแบบเป็นต้นทุนปกติ (รวมใน normal/sheetTotal ผ่าน otherNormal) ไม่ใช่สูญเปล่า
 * — ทางตรง/ทางอ้อมต่างกันแค่ป้ายที่ใช้แยกดูตอนสรุป ห้ามเอาไปรวมเข้า waste
 */
import type { OtherCost, TripRecord } from "../../types/record";

const money = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

let seq = 0;
export const emptyOtherCost = (): OtherCost => ({
  id: `oc${Date.now().toString(36)}${(seq++).toString(36)}`,
  label: "", amount: 0, kind: "direct",
});

export interface OtherCostTotals { direct: number; indirect: number; total: number }

export function otherCostTotals(list: OtherCost[] | undefined): OtherCostTotals {
  let direct = 0, indirect = 0;
  for (const c of list ?? []) {
    if (c.kind === "indirect") indirect += money(c.amount);
    else direct += money(c.amount);
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { direct: r2(direct), indirect: r2(indirect), total: r2(direct + indirect) };
}

/** เขียนยอดรวมลง otherNormal — เขียนทับ ไม่ใช่บวกทบ กดบันทึกซ้ำยอดต้องไม่ขยับ */
export function applyOtherCosts(rec: TripRecord): TripRecord {
  return { ...rec, otherNormal: otherCostTotals(rec.otherCosts).total };
}

/** ตัดแถวที่ไม่ได้กรอกอะไรเลยทิ้งก่อนบันทึก */
export const readyOtherCosts = (list: OtherCost[] | undefined): OtherCost[] =>
  (list ?? []).filter((c) => c.label.trim() || money(c.amount));
