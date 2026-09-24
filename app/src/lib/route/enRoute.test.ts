import { describe, expect, it } from "vitest";
import { defaultStops, onRouteOf, pairKey } from "./enRoute";

describe("จุดระหว่างทางตั้งต้น", () => {
  it("ขาขึ้น — จุดที่ผ่านก่อนถึงตามถนนสายหลัก", () => {
    expect(defaultStops("ตลาดไท", "เชียงราย")).toEqual(["กำแพงเพชร", "ตาก", "ลำปาง", "พะเยา"]);
    expect(defaultStops("ตลาดไท", "น่าน")).toEqual(["พิษณุโลก", "แพร่"]);
    expect(defaultStops("ตลาดไท", "กำแพงเพชร")).toEqual([]);
  });

  it("ขาล่อง — จุดส่งใกล้กัน + ทางผ่านฝั่งเหนือของเมือง ไม่รวมตัวปลายทางเอง", () => {
    expect(defaultStops("เชียงใหม่", "ปากคลองตลาด"))
      .toEqual(["ปากคลองตลาดใหม่", "สี่แยกมหานาค", "ตลาดไท", "สี่มุมเมือง"]);
    expect(defaultStops("เชียงใหม่", "ร่มเกล้า")).toEqual([]);
  });

  // เดิมใช้ ราชบุรี → ฝาง (ไม่มีเส้นไปเชียงดาว) — ตารางเส้นทาง 25 ก.ย. 2569 เพิ่มคู่นั้นแล้ว จึงเปลี่ยนตัวอย่าง
  it("ตัดจุดที่ต้นทางนั้นไปไม่ได้ออก — ราชบุรีไม่มีเส้นไปแพร่", () => {
    expect(defaultStops("ราชบุรี", "น่าน")).toEqual(["พิษณุโลก"]);
    expect(defaultStops("แม่สาย", "สี่มุมเมือง")).toEqual(["ตลาดไท"]);
  });
});

describe("บิลไปทางเดียวกับบิลแรกไหม", () => {
  const first = { origin: "ตลาดไท", dest: "เชียงราย" };
  it("ต้นทาง + ปลายทางเดียวกัน", () => {
    expect(onRouteOf(first, { origin: "ตลาดไท", dest: "เชียงราย" }, {})).toBe(true);
  });
  it("ปลายทางระหว่างทาง", () => {
    expect(onRouteOf(first, { origin: "ตลาดไท", dest: "พะเยา" }, {})).toBe(true);
    expect(onRouteOf(first, { origin: "ตลาดไท", dest: "แพร่" }, {})).toBe(false);
  });
  it("ต้นทางต้องตรงกัน", () => {
    expect(onRouteOf(first, { origin: "สี่มุมเมือง", dest: "พะเยา" }, {})).toBe(false);
  });
  it("ค่าที่แก้เองทับค่าเริ่มต้น", () => {
    const ovr = { [pairKey("ตลาดไท", "เชียงราย")]: ["แพร่"] };
    expect(onRouteOf(first, { origin: "ตลาดไท", dest: "แพร่" }, ovr)).toBe(true);
    expect(onRouteOf(first, { origin: "ตลาดไท", dest: "พะเยา" }, ovr)).toBe(false);
  });
});
