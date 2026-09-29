import { describe, expect, it } from "vitest";
import { lastMonths, monthsBack } from "./baseline";
import { metricResult } from "./score";

describe("ชุดฐาน 12 เดือนล่าสุด", () => {
  it("นับย้อนจากเดือนล่าสุดที่มี รวมเดือนล่าสุด", () => {
    const rows = ["2024-12", "2025-05", "2025-06", "2026-01", "2026-05"].map((mo) => ({ mo }));
    const b = lastMonths(rows, (r) => r.mo);
    expect(b.from).toBe("2025-06");
    expect(b.to).toBe("2026-05");
    expect(b.rows.map((r) => r.mo)).toEqual(["2025-06", "2026-01", "2026-05"]);
    expect(b.months).toBe(3);
  });
  it("ข้ามปีถูก", () => {
    expect(monthsBack("2026-01", 1)).toBe("2025-12");
    expect(monthsBack("2026-05", 11)).toBe("2025-06");
  });
  it("ไม่มีข้อมูล = ฐานว่าง", () => {
    expect(lastMonths([] as { mo: string }[], (r) => r.mo)).toMatchObject({ rows: [], from: "", months: 0 });
  });
});

describe("metricResult ใช้เกณฑ์จากชุดฐาน", () => {
  const base = { values: [2, 3, 4, 5, 6], span: "ฐาน" };  // P25 = 3 · P75 = 5
  it("ทุกคันถูกกว่าฐาน = เขียวหมด ได้ 10 (เดิมเทียบกันเองได้ราว 5)", () => {
    const cheap = [1, 1.5, 2, 2.5, 3];
    expect(metricResult("tkm", cheap, base).score).toBe(10);
    // วิธีเดิม (ไม่ส่งฐาน) เทียบกันเอง: เขียว 2 · เหลือง 2 · แดง 1 = 6 — ไม่สะท้อนว่าถูกกว่าฐาน
    expect(metricResult("tkm", cheap).score).toBe(6);
  });
  it("ทุกคันแพงกว่าฐาน = แดงหมด ได้ 0", () => {
    expect(metricResult("tkm", [6, 7, 8], base).score).toBe(0);
  });
  it("ค่าเกณฑ์ในป็อบอัพบอกช่วงฐาน", () => {
    expect(metricResult("tkm", [4], base).basis).toContain("ฐาน");
  });
});
