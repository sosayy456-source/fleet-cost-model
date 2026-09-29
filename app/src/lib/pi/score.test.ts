import { describe, expect, it } from "vitest";
import { DAILY_NA, METRICS, asDaily, metricResult, scoreOf, sumScores, tally } from "./score";

/** สีของทุกค่าตามเกณฑ์ percentile ที่คิดจากชุดเดียวกัน */
const bands = (k: keyof typeof METRICS, values: number[]) => {
  const r = METRICS[k].rule!(values, METRICS[k].show)!;
  return values.map(r.band);
};

describe("เกณฑ์ percentile ตาม \"แก้ Performance Index.pdf\" (28 ก.ย. 2569)", () => {
  it("Margin: ขาดทุนแดง · ≥ P75 เขียว · 0 ถึง < P75 เหลือง", () => {
    // P75 ของ [-10, 0, 10, 20, 30] = 20
    for (const k of ["route", "service", "custProfit"] as const) {
      expect(bands(k, [-10, 0, 10, 20, 30])).toEqual(["r", "y", "y", "g", "g"]);
    }
    // P75 ติดลบ (เกือบทุกเส้นทางขาดทุน) — ไม่ขาดทุนก็เขียว ขาดทุนยังแดง
    expect(bands("route", [-50, -40, -30, -20, 0])).toEqual(["r", "r", "r", "r", "g"]);
  });
  it("Load Factor: > P75 เขียว · P25–P75 เหลือง · < P25 แดง (ขอบพอดี = เหลือง)", () => {
    // 11 ค่า 0.0–1.0 → P25 = 0.25 · P75 = 0.75
    const v = Array.from({ length: 11 }, (_, i) => i / 10);
    expect(bands("lf", v)).toEqual(["r", "r", "r", "y", "y", "y", "y", "y", "g", "g", "g"]);
  });
  it("Cost per Ton-km / DSO ค่าต่ำ = เขียว (กลับทิศจากไฟล์ตามที่เจ้าของงานเลือก)", () => {
    // P25 = 2 · P75 = 4 ของ [1..5]
    for (const k of ["tkm", "dso"] as const) expect(bands(k, [1, 2, 3, 4, 5])).toEqual(["g", "g", "y", "y", "r"]);
  });
  it("Depreciation Coverage: ≥ P75 เขียว · P25 ถึง < P75 เหลือง · < P25 แดง", () => {
    expect(bands("coverage", [1, 2, 3, 4, 5])).toEqual(["r", "y", "y", "g", "g"]);
  });
  it("metricResult แนบค่าเกณฑ์ไว้ใน basis", () => {
    expect(metricResult("tkm", [1, 2, 3, 4, 5]).basis).toBe("P25 = 2 บาท · P75 = 4 บาท");
  });
});

describe("คะแนน (เขียว + 0.5 × เหลือง) ÷ รายการ × 10", () => {
  it("นับสีแล้วคิดคะแนน", () => {
    const t = tally([0.9, 0.9, 0.5, 0.1], (v) => (v > 0.7 ? "g" : v >= 0.3 ? "y" : "r"));
    expect(t).toEqual({ g: 2, y: 1, r: 1, n: 4 });
    expect(scoreOf(t)).toBe(6.25);
  });
  it("ค่าที่ไม่ใช่ตัวเลขจริงไม่นับเป็นรายการ", () => {
    expect(tally([NaN, Infinity, 50], () => "g")).toEqual({ g: 1, y: 0, r: 0, n: 1 });
  });
  it("ไม่มีรายการ = null ไม่ใช่ 0", () => {
    expect(scoreOf({ g: 0, y: 0, r: 0, n: 0 })).toBeNull();
  });
  it("ตัวที่ให้สีที่อื่น (rule: null) = รอเกณฑ์ · ไม่มีข้อมูล = ไม่นับเข้าฐานของคะแนนรวม", () => {
    // LF [0.9, 0.1] → P25 = 0.3 · P75 = 0.7 → เขียว 1 แดง 1 = 5 คะแนน
    const rs = [metricResult("empty", [1, 2]), metricResult("lf", [0.9, 0.1]), metricResult("tkm", null)];
    expect(rs[0]).toMatchObject({ pending: true, score: null });
    expect(rs[2]).toMatchObject({ pending: false, tally: null, score: null });
    expect(sumScores(rs)).toEqual({ score: 5, max: 10 });
  });
});

describe("Daily View (ช่วงไม่เต็มเดือน) — แสดงสีแต่ไม่คิดคะแนน (ข้อ 5 ของ Methodology 29 ก.ย. 2569)", () => {
  it("คงจำนวนสี · score = null · ป้าย ดูรายวัน · ไม่นับเข้าคะแนนรวม", () => {
    const r = metricResult("route", [-5, 10, 90], { values: Array.from({ length: 101 }, (_, i) => i), label: "B" });
    const d = asDaily(r);
    expect(d.tally).toEqual(r.tally);
    expect(d).toMatchObject({ score: null, daily: true, na: DAILY_NA });
    expect(sumScores([d]).max).toBe(0);
  });
});
