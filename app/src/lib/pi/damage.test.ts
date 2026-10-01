import { describe, expect, it } from "vitest";
import { damageRef, damageResults, damageStatus, kpiBand } from "./damage";
import type { DamageRef } from "./damage";
import type { Baseline } from "./baseline";
import type { DamageTrip } from "../damage/damage";

/** เดือนละ n เที่ยว เสีย d เที่ยว มูลค่าบิลเคลียร์ c ต่อเที่ยวที่เสีย รายได้ 1,000 ต่อเที่ยว */
const month = (mo: string, n: number, d: number, c = 10): DamageTrip[] =>
  Array.from({ length: n }, (_, i) => ({ mo, rev: 1000, clrAmt: i < d ? c : 0, clrN: i < d ? 1 : 0 }));

/** Baseline ครบ 12 เดือน (ผู้เรียกตัดเที่ยวในช่วงมาให้แล้ว) */
const B: Baseline = { start: "2025-06-01", end: "2026-05-31", months: 12, spanMonths: 12, full: true, first: "2024-01-01" };
/** DamageRef ที่ตั้งค่าเอง — ทดสอบการให้สีโดยไม่ต้องสร้างเที่ยว Baseline */
const mk = (p25Dir: number, p75Dir: number, p25Dr = 0.01, p75Dr = 0.04): DamageRef => ({
  p25Dr, p75Dr, p25Dir, p75Dir, months: 12, drValues: [], dirValues: [],
  ref: { values: [1], label: "Baseline", ok: true },
});

describe("Damage Performance ให้สีรายเดือนแล้วนับสี (เจ้าของงานเลือก 1 ต.ค. 2569)", () => {
  it("ระดับ: ≤ P25 เขียว · P25 < KPI ≤ P75 เหลือง · > P75 แดง (ขอบพอดีอยู่ระดับที่ดีกว่า)", () => {
    expect([0, 1, 1.01, 3, 3.01].map((k) => kpiBand(k, 1, 3))).toEqual(["g", "g", "y", "y", "r"]);
    expect(kpiBand(1, null, 3)).toBeNull();
  });
  it("ให้สีทีละเดือน · คะแนน = (เขียว + 0.5 × เหลือง) ÷ จำนวนเดือน × 10", () => {
    // DIR รายเดือน 0% (เขียว) · 2% (เหลือง) · 4% (แดง) → (1 + 0.5) ÷ 3 × 10 = 5
    const [, dir] = damageResults([...month("2026-01", 50, 0), ...month("2026-02", 50, 1), ...month("2026-03", 50, 2)], mk(1, 3));
    expect(dir.tally).toEqual({ g: 1, y: 1, r: 1, n: 3 });
    expect(dir.score).toBe(5);
    // ค่ารวมของช่วง 2% ใช้ตีความ (Actual) อย่างเดียว
    expect(dir.tone).toBe("y");
    expect(dir.actual?.v).toBe("2.00%");
  });
  it("ไม่ใช่ค่ารวม: สองเดือนแดง + เขียว ได้ 5 แม้ค่ารวมจะเป็นเหลือง", () => {
    // DIR 0% กับ 4% → ค่ารวม 2% (เหลือง) แต่นับรายเดือน เขียว 1 แดง 1 = 5
    const [, dir] = damageResults([...month("2026-01", 50, 0), ...month("2026-02", 50, 2)], mk(1, 3));
    expect(dir.tally).toEqual({ g: 1, y: 0, r: 1, n: 2 });
    expect(dir.score).toBe(5);
  });
  it("P75 = 0: เดือนที่ไม่มีบิลเคลียร์เขียว · มีบิลเคลียร์แดง (ตามเงื่อนไขสี ไม่ต้องมีกรณีพิเศษ)", () => {
    const [, dir] = damageResults([...month("2026-01", 50, 0), ...month("2026-02", 50, 1)], mk(0, 0));
    expect(dir.tally).toEqual({ g: 1, y: 0, r: 1, n: 2 });
    expect(dir.score).toBe(5);
  });
  it("เดือนที่รายได้ 0 ไม่นับใน DR แต่ยังนับใน DIR", () => {
    const trips = [...month("2026-01", 50, 0), ...month("2026-02", 50, 0).map((t) => ({ ...t, rev: 0 }))];
    const [dr, dir] = damageResults(trips, mk(1, 3));
    expect(dr.tally?.n).toBe(1);
    expect(dir.tally?.n).toBe(2);
  });
  it("ไม่มีกติกาเที่ยวขั้นต่ำ — เที่ยวน้อยก็ให้คะแนน", () => {
    const [, few] = damageResults(month("2026-07", 3, 0), mk(1, 3));
    expect(few.score).toBe(10);
  });
  it("P25/P75 = PERCENTILE.INC ของ KPI รายเดือน · Baseline ไม่ครบ = N/A", () => {
    const base = ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10"].flatMap((mo, i) => month(mo, 50, i));
    // DIR รายเดือน 0, 2, 4, 6, 8 → P25 = 2 · P75 = 6
    expect(damageRef(base, B)).toMatchObject({ months: 5, p25Dir: 2, p75Dir: 6 });
    const short = damageRef(base, { ...B, full: false, first: "2025-06-01" });
    const [dr, dir] = damageResults(month("2026-06", 50, 1), short);
    expect(dr).toMatchObject({ score: null, na: "Baseline ไม่ครบ" });
    expect(dir).toMatchObject({ score: null, na: "Baseline ไม่ครบ" });
  });
  it("คะแนน Baseline = เดือนในช่วงอ้างอิง ให้สีด้วยเกณฑ์ชุดเดียวกัน แล้วนับสี", () => {
    const base = ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10"].flatMap((mo, i) => month(mo, 50, i));
    // DIR 0, 2 (≤ P25 2) เขียว · 4, 6 เหลือง · 8 แดง → (2 + 1) ÷ 5 × 10 = 6
    const [, dir] = damageResults(month("2026-06", 50, 0), damageRef(base, B));
    expect(dir.base?.tally).toEqual({ g: 2, y: 2, r: 1, n: 5 });
    expect(dir.base?.score).toBe(6);
    expect(dir.score).toBe(10);
  });
  it("ไม่มีเที่ยว → ไม่มีเที่ยว · รายได้รวม 0 → DR ประเมินไม่ได้ (ไม่ใช่ 0)", () => {
    const ref = mk(1, 3);
    const [dr, dir] = damageResults([], ref);
    expect(dr).toMatchObject({ score: null, na: "ไม่มีเที่ยว" });
    expect(dir).toMatchObject({ score: null, na: "ไม่มีเที่ยว" });
    const [dr0] = damageResults(month("2026-07", 30, 0).map((t) => ({ ...t, rev: 0 })), ref);
    expect(dr0).toMatchObject({ score: null, na: "ประเมินไม่ได้" });
  });
  it("สถานะ 15–20 ผ่าน · 10–<15 เฝ้าระวัง · < 10 ไม่ผ่าน · ขาดตัวใดตัวหนึ่ง = ไม่ตัดสิน", () => {
    const r = (a: number | null, b: number | null) => [
      { key: "dr" as const, pending: false, tally: null, score: a },
      { key: "dir" as const, pending: false, tally: null, score: b },
    ];
    expect(damageStatus(r(10, 5))).toBe("pass");
    expect(damageStatus(r(5, 5))).toBe("watch");
    expect(damageStatus(r(5, 0))).toBe("fail");
    expect(damageStatus(r(10, null))).toBeNull();
  });
});
