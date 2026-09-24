import { describe, expect, it } from "vitest";
import { emptyScore, emptyThresholds, routeRates } from "./routeScore";

describe("คะแนนเที่ยววิ่งเปล่ารายเส้นทาง (percentile)", () => {
  it("% เที่ยวเปล่านับเที่ยว รายเส้นทางตามทิศ · ข้ามเที่ยวที่ไม่มีชื่อเส้นทาง", () => {
    const r = routeRates([
      { rt: "ก-ข", empty: true }, { rt: "ก-ข", empty: false }, { rt: "ก-ข", empty: false }, { rt: "ก-ข", empty: false },
      { rt: "ข-ก", empty: true }, { rt: "", empty: true },
    ]);
    expect(r).toEqual([
      { rt: "ก-ข", n: 4, emptyN: 1, pct: 25 },
      { rt: "ข-ก", n: 1, emptyN: 1, pct: 100 },
    ]);
  });

  it("P25/P50/P75 = PERCENTILE.INC", () => {
    const th = emptyThresholds([10, 20, 30, 40, 50].map((pct, i) => ({ rt: String(i), n: 1, emptyN: 0, pct })));
    expect(th).toEqual({ p25: 20, p50: 30, p75: 40, routes: 5 });
  });

  it("ตัวอย่างจากสเปก: P25 18.4 · P75 43.3 · เส้นทาง 30.3% ≈ 5.22 คะแนน (ปานกลาง)", () => {
    const th = { p25: 18.4, p50: 30, p75: 43.3, routes: 10 };
    const s = emptyScore(30.3, th);
    expect(s.grade).toBe("mid");
    expect(s.score).toBeCloseTo(5.22, 2);   // 10 × (43.3 − 30.3) ÷ (43.3 − 18.4) = 10 × 13 ÷ 24.9
    expect(emptyScore(18.4, th)).toEqual({ grade: "good", score: 10 });   // เท่ากับ P25 = ดี
    expect(emptyScore(43.3, th)).toMatchObject({ grade: "mid", score: 0 }); // เท่ากับ P75 = ปานกลาง 0 คะแนน
  });

  it("เกิน P75 = แย่มาก คะแนนติดลบตามสูตร", () => {
    const s = emptyScore(55.75, { p25: 18.4, p50: 30, p75: 43.3, routes: 10 });
    expect(s.grade).toBe("bad");
    expect(s.score).toBeCloseTo(-5, 5);
  });

  it("P25 = P75 → ≤ P25 ได้ 10 · เกินได้ 0", () => {
    const th = { p25: 0, p50: 0, p75: 0, routes: 5 };
    expect(emptyScore(0, th)).toEqual({ grade: "good", score: 10 });
    expect(emptyScore(100, th)).toEqual({ grade: "bad", score: 0 });
  });

  it("ไม่มีเส้นทาง = ไม่มีเกณฑ์", () => {
    expect(emptyThresholds([])).toBeNull();
  });
});
