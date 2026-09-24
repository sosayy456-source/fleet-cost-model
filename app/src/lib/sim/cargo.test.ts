import { describe, expect, it } from "vitest";
import { COLD, GENERAL, randomCargo, ratePerKg } from "./cargo";

describe("สุ่มสินค้าที่สมเหตุสมผล", () => {
  it("ความหนาแน่น น้ำหนัก ปริมาตร ราคา อยู่ในช่วงของจริงทุกครั้ง", () => {
    for (let i = 0; i < 2000; i++) {
      const c = randomCargo({ cold: i % 2 === 0, distKm: 100 + (i % 900) });
      const density = c.weight / c.volume;                       // กก./ลบ.ม.
      expect(density).toBeGreaterThan(50);                       // เดิมได้ 12–22 กก./ลบ.ม.
      expect(density).toBeLessThan(1200);
      expect(c.weight).toBeLessThanOrEqual(2000);
      expect(c.volume).toBeLessThanOrEqual(5);
      expect(c.perKg).toBeGreaterThanOrEqual(2.5);
      expect(c.perKg).toBeLessThanOrEqual(9);
      // ราคาคิดตามหน่วยกับตามน้ำหนักออกมาใกล้กัน (ปัดเศษ 5 บาทต่อชิ้น)
      expect(Math.abs(c.perUnit * c.qty - c.perKg * c.weight)).toBeLessThanOrEqual(5 * c.qty);
    }
  });
  it("แช่เย็นได้กล่องโฟม/ถัง · ทั่วไปไม่ได้", () => {
    const cold = new Set(COLD.map((k) => k.name));
    expect(cold.has(randomCargo({ cold: true }).kind)).toBe(true);
    // สุ่มครั้งเดียวแล้วค่อยเทียบ — เดิมสุ่มใหม่ใน .some() ทุกรอบ ล้มเองราว 1 ใน 3 ครั้ง
    const general = randomCargo({ cold: false }).kind;
    expect(GENERAL.some((k) => k.name === general)).toBe(true);
  });
  it("ไกลขึ้น ค่าขนส่งต่อ กก. สูงขึ้น", () => {
    const mid = () => 0.5;
    expect(ratePerKg(100, mid)).toBeLessThan(ratePerKg(800, mid));
  });
  it("ตั้งน้ำหนักเป้าหมายได้ (ใช้เติมรถให้ได้ Load Factor)", () => {
    const c = randomCargo({ targetKg: 1000 });
    expect(Math.abs(c.weight - 1000)).toBeLessThanOrEqual(c.kgEach);
  });
});
