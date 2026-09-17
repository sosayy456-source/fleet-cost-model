/**
 * เทสต์ lastEditedAt() — เวลาบันทึกล่าสุดของใบ ต้องหาได้จากฝ่ายไหนก็ได้ ไม่ใช่ยึด _accountAt ตัวเดียว
 * (ใบที่ยังกรอกไม่ครบ เช่นฝ่ายจัดรถกรอกแล้วแต่บัญชียังไม่กรอก ก็ต้องได้เวลาของฝ่ายจัดรถกลับมา)
 */
import { describe, expect, it } from "vitest";
import { lastEditedAt } from "./roles";
import type { TripRecord } from "../../types/record";

describe("lastEditedAt", () => {
  it("ใบที่ไม่มีเวลาฝ่ายไหนเลย ได้ null", () => {
    expect(lastEditedAt({} as Partial<TripRecord>)).toBeNull();
    expect(lastEditedAt(null)).toBeNull();
    expect(lastEditedAt(undefined)).toBeNull();
  });

  it("มีแค่ _dispatchAt ต้องได้ค่านั้นกลับมา", () => {
    const r = { _dispatchAt: "2569-09-17 09:00" } as Partial<TripRecord>;
    expect(lastEditedAt(r)).toBe("2569-09-17 09:00");
  });

  it("มีครบสามฝ่าย ต้องได้ตัวที่ล่าสุด (สตริงมากที่สุด)", () => {
    const r = {
      _csAt: "2569-09-15 08:00",
      _dispatchAt: "2569-09-17 09:00",
      _accountAt: "2569-09-16 10:00",
    } as Partial<TripRecord>;
    expect(lastEditedAt(r)).toBe("2569-09-17 09:00");
  });

  it("ฝ่ายบัญชีบันทึกล่าสุดจริง ก็ยังได้ค่าฝ่ายบัญชี", () => {
    const r = {
      _csAt: "2569-09-15 08:00",
      _dispatchAt: "2569-09-16 09:00",
      _accountAt: "2569-09-17 10:00",
    } as Partial<TripRecord>;
    expect(lastEditedAt(r)).toBe("2569-09-17 10:00");
  });
});
