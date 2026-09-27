import { describe, expect, it } from "vitest";
import { billTotalOf, billVolume, priceBaseOf } from "../../types/bill";
import { randomCargo } from "../sim/cargo";

describe("เกณฑ์คิดราคาของบิล", () => {
  const b = { weight: 500, qty: 10, volume: billVolume({ width: 100, length: 100, height: 50, qty: 10 }), unitPrice: 2 };
  it("น้ำหนัก / หน่วย / ปริมาตร", () => {
    expect(b.volume).toBe(5);
    expect(billTotalOf({ ...b, pricingType: "คิดตามน้ำหนัก" })).toBe(1000);
    expect(billTotalOf({ ...b, pricingType: "คิดตามหน่วย" })).toBe(20);
    expect(billTotalOf({ ...b, pricingType: "คิดตามปริมาตร" })).toBe(10);
  });
  it("เกณฑ์ที่ไม่รู้จัก = คิดตามหน่วยแบบเดิม · หน่วยของราคาบนหน้าจอ", () => {
    expect(billTotalOf({ ...b, pricingType: "" })).toBe(20);
    expect(priceBaseOf("คิดตามปริมาตร").unit).toBe("บาท/ลบ.ม.");
  });
  it("สินค้าสุ่ม: ราคารวมตามปริมาตรใกล้กับตามน้ำหนัก", () => {
    for (let i = 0; i < 50; i++) {
      const c = randomCargo({ distKm: 600 });
      const byKg = c.weight * c.perKg, byM3 = c.volume * c.perM3;
      expect(Math.abs(byM3 - byKg) / byKg).toBeLessThan(0.1);
    }
  });
});
