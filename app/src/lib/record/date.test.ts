import { describe, expect, it } from "vitest";
import { monthSpan, thMonthRange } from "./date";

describe("ช่วงเดือนแบบไทย (หัวแดชบอร์ดบอกช่วงข้อมูล)", () => {
  it("ปีเดียวกันเขียนปีครั้งเดียว", () => {
    expect(thMonthRange("2026-01-05", "2026-03-20")).toBe("ม.ค.–มี.ค. 2569");
  });
  it("เดือนเดียว", () => {
    expect(thMonthRange("2026-02", "2026-02")).toBe("ก.พ. 2569");
  });
  it("ข้ามปีเขียนปีทั้งสองฝั่ง", () => {
    expect(thMonthRange("2025-12-01", "2026-03-31")).toBe("ธ.ค. 2568 – มี.ค. 2569");
  });
  it("นับเดือนรวมเดือนต้นและท้าย — ใช้ตัดสินว่าข้อมูลครบปีหรือยัง", () => {
    expect(monthSpan("2026-01-05", "2026-03-20")).toBe(3);
    expect(monthSpan("2025-12", "2026-03")).toBe(4);
    expect(monthSpan("2024-01", "2024-12")).toBe(12);
  });
});
