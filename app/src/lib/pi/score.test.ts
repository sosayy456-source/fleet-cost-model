import { describe, expect, it } from "vitest";
import { METRICS, metricResult, scoreOf, sumScores, tally } from "./score";

const bandOf = (k: keyof typeof METRICS) => METRICS[k].band!;

describe("เกณฑ์สีตามตารางของเจ้าของงาน — ขอบเขตรวมอยู่ฝั่งไหน", () => {
  it("Load Factor ≥ 84% / 47–84% / < 47%", () => {
    const b = bandOf("lf");
    expect([0.84, 0.8399, 0.47, 0.4699].map(b)).toEqual(["g", "y", "y", "r"]);
  });
  it("Cost per Ton-km ≤ 1.28 / ≤ 2.64 / เกิน", () => {
    const b = bandOf("tkm");
    expect([1.28, 1.2801, 2.64, 2.6401].map(b)).toEqual(["g", "y", "y", "r"]);
  });
  it("Fixed Cost Coverage ≥ 47.27 / ≥ 12.93 / ต่ำกว่า", () => {
    const b = bandOf("coverage");
    expect([47.27, 47.26, 12.93, 12.92].map(b)).toEqual(["g", "y", "y", "r"]);
  });
  it("Customer Net Profit ≥ 10% / 0–10% / ขาดทุน", () => {
    const b = bandOf("custProfit");
    expect([10, 9.99, 0, -0.01].map(b)).toEqual(["g", "y", "y", "r"]);
  });
  it("DSO รายบิล ตรงกำหนด / ช้า 1–30 วัน / ช้าเกิน 30 วัน", () => {
    const b = bandOf("dso");
    expect([-5, 0, 1, 30, 31].map(b)).toEqual(["g", "g", "y", "y", "r"]);
  });
});

describe("คะแนน (เขียว + 0.5 × เหลือง) ÷ รายการ × 10", () => {
  it("นับสีแล้วคิดคะแนน", () => {
    const t = tally([0.9, 0.9, 0.5, 0.1], bandOf("lf"));
    expect(t).toEqual({ g: 2, y: 1, r: 1, n: 4 });
    expect(scoreOf(t)).toBe(6.25);
  });
  it("ค่าที่ไม่ใช่ตัวเลขจริงไม่นับเป็นรายการ", () => {
    expect(tally([NaN, Infinity, 50], bandOf("coverage"))).toEqual({ g: 1, y: 0, r: 0, n: 1 });
  });
  it("ไม่มีรายการ = null ไม่ใช่ 0", () => {
    expect(scoreOf({ g: 0, y: 0, r: 0, n: 0 })).toBeNull();
  });
  it("ยังไม่มีเกณฑ์ = รอเกณฑ์ ไม่นับเข้าฐานของคะแนนรวม", () => {
    const rs = [metricResult("route", [1, 2]), metricResult("lf", [0.9, 0.1]), metricResult("tkm", null)];
    expect(rs[0]).toMatchObject({ pending: true, score: null });
    expect(rs[2]).toMatchObject({ pending: false, tally: null, score: null });
    expect(sumScores(rs)).toEqual({ score: 5, max: 10 });
  });
});
