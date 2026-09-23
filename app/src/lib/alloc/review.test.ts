import { describe, expect, it } from "vitest";
import { needsReview } from "./review";

describe("ลูกค้าที่ส่วนใหญ่ปันตามรายได้", () => {
  it("รายได้จากรายการที่ติดธง ≥ ครึ่งหนึ่ง = ติดป้าย", () => {
    expect(needsReview(40, 40)).toBe(true);        // บิลเดียว 1×1×1 ซม.
    expect(needsReview(980, 980)).toBe(true);      // ทุกบิลไม่มีน้ำหนัก/ขนาด
    expect(needsReview(1000, 500)).toBe(true);
  });
  it("รายใหญ่ที่มีบิลผิดไม่กี่ใบไม่ติดป้าย", () => {
    expect(needsReview(606296, 1200)).toBe(false);
    expect(needsReview(1000, 0)).toBe(false);
  });
  it("รายได้ 0 แต่มีรายการติดธง = ติดป้าย", () => {
    expect(needsReview(0, 0.01)).toBe(true);
  });
});
