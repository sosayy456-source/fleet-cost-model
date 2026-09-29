import { describe, expect, it } from "vitest";
import { toStamp } from "./date";

describe("toStamp — เวลาประทับจากชีต → 'YYYY-MM-DD HH:mm' เวลาไทย", () => {
  it("รูปแบบเดิมคืนค่าเดิม", () => {
    expect(toStamp("2026-09-28 10:15")).toBe("2026-09-28 10:15");
    expect(toStamp("")).toBe("");
  });
  it("ข้อความ Date ของ Apps Script (ชีตแปลงเป็นเซลล์วันที่)", () => {
    expect(toStamp("Mon Sep 28 2026 10:15:00 GMT+0700 (Indochina Time)")).toBe("2026-09-28 10:15");
    expect(toStamp("2026-09-27T17:30:00.000Z")).toBe("2026-09-28 00:30");
  });
  it("อ่านไม่ออกคืนค่าเดิม", () => {
    expect(toStamp("ไม่ใช่วันที่")).toBe("ไม่ใช่วันที่");
  });
});
