import { describe, expect, it } from "vitest";
import { damageRef, damageResults, damageStatus, kpiTone, p75Score } from "./damage";
import type { DamageTrip } from "../damage/damage";

describe("Score = MAX(0, 10 − 5 × KPI ÷ P75) — ตารางในสเปกข้อ 6", () => {
  it("ได้คะแนนตามตารางทุกขั้น", () => {
    const p = 2;
    expect([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map((x) => p75Score(x * p, p)))
      .toEqual([10, 8.75, 7.5, 6.25, 5, 3.75, 2.5, 1.25, 0, 0]);
  });
  it("ชุดอ้างอิงไม่มีความเสียหาย (P75 null) — KPI 0 ได้เต็ม", () => {
    expect(p75Score(0, null)).toBe(10);
  });
});

/** เดือนละ n เที่ยว เสีย d เที่ยว มูลค่าบิลเคลียร์ c ต่อเที่ยวที่เสีย รายได้ 1,000 ต่อเที่ยว */
const month = (mo: string, n: number, d: number, c = 10): DamageTrip[] =>
  Array.from({ length: n }, (_, i) => ({ mo, rev: 1000, clrAmt: i < d ? c : 0, clrN: i < d ? 1 : 0 }));

describe("ชุดอ้างอิง 12 เดือนล่าสุด + สีของ KPI (dashboard คชจ.md 27 ก.ย. 2569)", () => {
  it("ใช้เฉพาะ 12 เดือนปฏิทินล่าสุด นับย้อนจากเดือนล่าสุดที่มีเที่ยว", () => {
    // ปีก่อนเสียหายหนัก 30% — ถ้านับทุกเดือน P75 จะสูง · 12 เดือนล่าสุด (2025-08..2026-07) ไม่มีเดือนนั้น
    const old = month("2024-12", 10, 3);
    const recent = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06", "2026-07"].flatMap((mo) => month(mo, 50, 1));
    const ref = damageRef([...old, ...recent]);
    expect(ref).toMatchObject({ from: "2025-08", to: "2026-07", months: 12, p75Dir: 2 });
  });
  it("สี: เขียว ≤ P75 · เหลือง < 2×P75 · แดง ≥ 2×P75", () => {
    expect([1, 2, 3, 3.99, 4, 9].map((k) => kpiTone(k, 2))).toEqual(["g", "g", "y", "y", "r", "r"]);
    expect([kpiTone(0, null), kpiTone(1, null)]).toEqual(["g", "r"]);
  });
});

describe("ชุดอ้างอิง + กรณีพิเศษ (สเปกข้อ 10)", () => {
  it("P75 = 0 (เดือนส่วนใหญ่ไม่เสียหาย) ถอยไปใช้เดือนที่มีค่า > 0", () => {
    const ref = damageRef([...month("2026-01", 50, 0), ...month("2026-02", 50, 0), ...month("2026-03", 50, 0),
      ...month("2026-04", 50, 0), ...month("2026-05", 50, 2), ...month("2026-06", 50, 4)]);
    // Incidence รายเดือน 0,0,0,0,4,8 → P75 = 3 (ไม่ใช่ 0) · ถ้าได้ 0 ก็ถอยไปใช้ [4, 8]
    expect(ref.p75Dir).toBe(3);
    const zero = damageRef([...month("2026-01", 50, 0), ...month("2026-02", 50, 0), ...month("2026-03", 50, 0),
      ...month("2026-04", 50, 0), ...month("2026-05", 50, 2)]);
    expect(zero.p75Dir).toBe(4);           // P75 ของ [0,0,0,0,4] = 0 → ใช้เดือนที่มีค่า [4]
  });
  it("เที่ยวขั้นต่ำ = 100 ÷ (2 × P75 ของ DIR)", () => {
    const ref = { p75Dr: 0.04, p75Dir: 2.5, months: 12, minTrips: Math.ceil(100 / 5), from: "2025-08", to: "2026-07" };
    const [, few] = damageResults(month("2026-07", 19, 1), ref);
    expect(few).toMatchObject({ score: null, na: "ข้อมูลไม่เพียงพอ" });
    const [, ok] = damageResults(month("2026-07", 20, 0), ref);
    expect(ok.score).toBe(10);
  });
  it("รายได้ 0 → DR ประเมินไม่ได้ · ไม่มีเที่ยว → DIR ไม่มีเที่ยว (ไม่ใช่ 0)", () => {
    const ref = { p75Dr: 0.04, p75Dir: 2.5, months: 12, minTrips: 20, from: "2025-08", to: "2026-07" };
    const [dr, dir] = damageResults([], ref);
    expect(dr).toMatchObject({ score: null, na: "ประเมินไม่ได้" });
    expect(dir).toMatchObject({ score: null, na: "ไม่มีเที่ยว" });
  });
  it("สถานะ 15–20 ผ่าน · 10–<15 เฝ้าระวัง · < 10 ไม่ผ่าน · ขาดตัวใดตัวหนึ่ง = ไม่ตัดสิน", () => {
    const r = (a: number | null, b: number | null) => [
      { key: "dr" as const, pending: false, tally: null, score: a },
      { key: "dir" as const, pending: false, tally: null, score: b },
    ];
    expect(damageStatus(r(7.5, 7.5))).toBe("pass");
    expect(damageStatus(r(5, 5))).toBe("watch");
    expect(damageStatus(r(5, 4.99))).toBe("fail");
    expect(damageStatus(r(10, null))).toBeNull();
  });
});
