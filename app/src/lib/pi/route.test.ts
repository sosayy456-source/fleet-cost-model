import { describe, expect, it } from "vitest";
import { routeMargin, routeMarginValues, serviceMarginValues } from "./route";
import { emptyResult } from "./empty";
import { bandResult } from "./score";

const t = (rt: string, rev: number, profit: number, sg = "สินค้าทั่วไป") => ({ rt, sg, rev, profit });

describe("Route & Service — %Margin = Σกำไร ÷ Σรายได้", () => {
  it("รวมรายได้/กำไรทั้งเส้นทางก่อนหาร ไม่เฉลี่ย % รายเที่ยว", () => {
    // เที่ยวละ 10% กับ 50% → เฉลี่ยตรง ๆ 30% แต่ Σ÷Σ = 110 ÷ 1100 = 10%
    expect(routeMarginValues([t("A-B", 1000, 100), t("A-B", 100, 50)])).toEqual([150 / 1100 * 100]);
  });
  it("รายได้ 0 แล้วขาดทุน = −100% · รายได้ 0 ไม่ขาดทุน = ไม่นับ (NaN)", () => {
    expect(routeMargin(0, -500)).toBe(-100);
    expect(routeMargin(0, 0)).toBeNull();
    expect(routeMarginValues([t("X-Y", 0, 0)])).toEqual([NaN]);
  });
  it("กลุ่มบริการนับเฉพาะ 3 กลุ่มของการ์ด · กลุ่มที่ไม่มีเที่ยว = NaN (tally ข้าม)", () => {
    const v = serviceMarginValues([t("A-B", 100, 20), t("A-B", 100, 5, "สินค้าแช่เย็น"), t("A-B", 0, -50, "")]);
    expect(v).toEqual([20, 5, NaN]);
  });
});

describe("Empty Return — เกณฑ์ P25/P75 ของแท็บ Empty Trips นับสีทีละเส้นทาง", () => {
  const trips = (rt: string, n: number, empty: number) =>
    Array.from({ length: n }, (_, i) => ({ rt, empty: i < empty }));
  it("≤ P25 เขียว · P25–P75 เหลือง · เกิน P75 แดง", () => {
    // 4 เส้นทาง 0% · 25% · 50% · 100% → P25 = 18.75 · P75 = 62.5
    const all = [...trips("A", 4, 0), ...trips("B", 4, 1), ...trips("C", 4, 2), ...trips("D", 4, 4)];
    const r = emptyResult(all, all);
    expect(r.tally).toEqual({ g: 1, y: 2, r: 1, n: 4 });
    expect(r.score).toBe(5);
    expect(r.basis).toContain("P25 = 18.75%");
  });
  it("P25 = P75 → ไม่มีช่วงเหลือง", () => {
    const all = [...trips("A", 2, 0), ...trips("B", 2, 0), ...trips("C", 2, 0), ...trips("D", 2, 2)];
    expect(emptyResult(all, all).tally).toEqual({ g: 3, y: 0, r: 1, n: 4 });
  });
  it("ไม่มีข้อมูล = score null ไม่ใช่ 0", () => {
    expect(emptyResult(null, null)).toMatchObject({ pending: false, score: null });
    expect(bandResult("empty", [])).toMatchObject({ score: null });
  });
});
