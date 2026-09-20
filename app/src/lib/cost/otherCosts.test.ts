import { describe, expect, it } from "vitest";
import { applyOtherCosts, otherCostTotals, readyOtherCosts } from "./otherCosts";
import { emptyRecord } from "../../features/entry/emptyRecord";
import { recomputeTotals } from "../store/save";
import type { OtherCost } from "../../types/record";

const oc = (label: string, amount: number, kind: OtherCost["kind"]): OtherCost =>
  ({ id: label, label, amount, kind });

describe("ค่าใช้จ่ายอื่นๆ", () => {
  it("แยกยอดทางตรง/ทางอ้อม และรวมเป็น otherNormal", () => {
    const t = otherCostTotals([oc("ค่าปรับ", 500, "direct"), oc("เช่าอุปกรณ์", 250.5, "indirect")]);
    expect(t).toEqual({ direct: 500, indirect: 250.5, total: 750.5 });
  });

  it("บันทึกซ้ำยอดไม่ขยับ และเข้าต้นทุนปกติ ไม่ใช่สูญเปล่า", () => {
    const base = { ...emptyRecord(), otherCosts: [oc("ค่าปรับ", 500, "direct"), oc("อื่น", 300, "indirect")] };
    const once = recomputeTotals(base);
    const twice = recomputeTotals(once);
    expect(once.otherNormal).toBe(800);
    expect(once.normal).toBe(800);
    expect(once.waste).toBe(0);
    expect(twice.normal).toBe(800);
    expect(applyOtherCosts(once).otherNormal).toBe(800);
  });

  it("ตัดแถวว่างทิ้ง", () => {
    expect(readyOtherCosts([oc("", 0, "direct"), oc("x", 0, "direct")])).toHaveLength(1);
  });
});
