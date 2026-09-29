import { describe, expect, it } from "vitest";
import { evalPeriod, inWindow, monthsBack, noTime, refSet, refWindow } from "./baseline";
import { indexStatus, metricResult } from "./score";
import { coverageByVehicleMonth, tkmByVehicleMonth } from "./cost";
import { serviceMonthMarginValues } from "./route";
import type { VRow } from "../detail3/calc";
import type { MetricResult } from "./score";

describe("ช่วงอ้างอิง 12 เดือนล่าสุดของไฟล์ (InDex_revised v2.md)", () => {
  it("นับย้อน 12 เดือนปฏิทินจากเดือนล่าสุด ข้ามปีได้", () => {
    expect(monthsBack("2026-05", 11)).toBe("2025-06");
    const w = refWindow(["2024-01", "2025-06", "2025-12", "2026-05", ""])!;
    expect(w).toEqual({ from: "2025-06", to: "2026-05", months: 3 });
    expect([inWindow("2025-05", w), inWindow("2025-06", w), inWindow("2026-05", w)]).toEqual([false, true, true]);
    expect(refWindow([])).toBeNull();
  });
  it("ตัวกรองยกเว้นเวลา = ล้างปี/ช่วงเดือน/เดือนเดียว ตัวกรองอื่นคงไว้", () => {
    expect(noTime({ year: "2026", from: "03", to: "05", month: "04", vk: "รถ 10 ล้อ" }))
      .toEqual({ year: "", from: "01", to: "12", month: "", vk: "รถ 10 ล้อ" });
  });
  it("ไฟล์ไม่ครบ 12 เดือนบอกว่าเป็นเกณฑ์ชั่วคราว (DSO)", () => {
    expect(refSet([1, 2, NaN], "ลูกค้า", { from: "2025-12", to: "2026-11", months: 7 }).label)
      .toMatch(/จาก 2 ลูกค้า · 12 เดือนล่าสุด 2025-12 ถึง 2026-11 \(มีข้อมูล 7 เดือน/);
  });
});

describe("เกณฑ์ percentile มาจากชุดอ้างอิง ไม่ใช่ชุดที่ให้คะแนน", () => {
  // อดีต: margin 0–100 → P75 = 75 · ช่วงนี้ทุกเส้นทางดีขึ้นเกิน 75
  const past = Array.from({ length: 101 }, (_, i) => i);
  const now = [80, 90, 95, 99];
  it("ผลงานดีขึ้นกว่าอดีตทุกรายการ = เขียวหมด 10/10 (เดิมคิดจากชุดเดียวกัน ได้ 25% เขียว)", () => {
    const r = metricResult("route", now, { values: past, label: "อดีต" });
    expect(r.tally).toEqual({ g: 4, y: 0, r: 0, n: 4 });
    expect(r.score).toBe(10);
    expect(r.basis).toContain("P75 = 75%");
    expect(metricResult("route", now).score).toBeLessThan(10);
  });
  it("ขาดทุนยังแดงเสมอ ไม่ว่าเกณฑ์จะเป็นเท่าไร", () => {
    expect(metricResult("route", [-5, 10], { values: past, label: "อดีต" }).tally).toMatchObject({ r: 1, y: 1 });
  });
  it("ชุดอ้างอิงว่าง = คิดคะแนนไม่ได้ พร้อมบอกเหตุ", () => {
    const r = metricResult("tkm", [1, 2], { values: [], label: "ว่าง" });
    expect(r.score).toBeNull();
    expect(r.basis).toContain("ชุดอ้างอิงไม่มีรายการ");
  });
});

describe("สถานะของทุกหมวด: ผ่าน 15–20 · เฝ้าระวัง 10–14.99 · ไม่ผ่าน < 10", () => {
  const res = (a: number | null, b: number | null): MetricResult[] =>
    [a, b].map((score) => ({ key: "route", pending: false, tally: null, score }));
  it("ขอบเขตตามตาราง · ขาดตัวหนึ่ง = ไม่ขึ้นสถานะ", () => {
    expect([indexStatus(res(10, 5)), indexStatus(res(7, 7.99)), indexStatus(res(5, 5)), indexStatus(res(4.99, 5))])
      .toEqual(["pass", "watch", "watch", "fail"]);
    expect(indexStatus(res(10, null))).toBeNull();
  });
});

describe("ช่วงที่ประเมิน: ไม่เลือกปี = เดือนล่าสุดของไฟล์", () => {
  it("ไม่เลือกปีได้เดือนล่าสุด · เลือกปีแล้วใช้ช่วงที่เลือก", () => {
    const f0 = { year: "", from: "01", to: "12", vk: "x" };
    expect(evalPeriod(f0, ["2026-03", "2026-05", "2025-12"])).toEqual({ year: "2026", from: "05", to: "05", vk: "x" });
    const f1 = { year: "2025", from: "01", to: "06", vk: "" };
    expect(evalPeriod(f1, ["2026-05"])).toBe(f1);
  });
});

describe("รายการ × เดือน (Cost per Ton-km · Coverage · Service Group Margin)", () => {
  const v = (pl: string, d: string, cost: number, tkm: number, dep = 0, rev = 0, side: VRow["side"] = "comp") =>
    ({ pl, d, cost, tkm, dep, rev, side }) as VRow;
  it("Cost per Ton-km = Σต้นทุน ÷ Σตัน-กม. ของคันในเดือน · ตัน-กม./ต้นทุน 0 ไม่นับ", () => {
    const rows = [v("A", "2026-05-01", 100, 10), v("A", "2026-05-20", 300, 30), v("A", "2026-04-02", 50, 5),
      v("B", "2026-05-03", 0, 10), v("B", "2026-05-04", 90, 0)];
    expect(tkmByVehicleMonth(rows).sort()).toEqual([10, 10]);
  });
  it("Coverage = ΣCM ÷ Σค่าเสื่อม ของคันในเดือน · เฉพาะรถบริษัทที่มีค่าเสื่อม", () => {
    // CM = รายได้ − (ต้นทุน − ค่าเสื่อม): (500 − 400) + (200 − 250) = 50 · ค่าเสื่อม 100 + 50 = 150
    const rows = [v("A", "2026-05-01", 500, 0, 100, 500), v("A", "2026-05-09", 300, 0, 50, 200),
      v("R", "2026-05-01", 500, 0, 100, 900, "part"), v("A", "2026-05-02", 10, 0, 0, 10)];
    expect(coverageByVehicleMonth(rows)).toEqual([50 / 150]);
  });
  it("กลุ่มบริการ × เดือน · กลุ่มนอก 3 กลุ่มไม่นับ", () => {
    const t = (sg: string, mo: string, rev: number, profit: number) => ({ rt: "", sg, mo, rev, profit });
    expect(serviceMonthMarginValues([t("สินค้าทั่วไป", "2026-04", 100, 10), t("สินค้าทั่วไป", "2026-05", 100, -5),
      t("สินค้าแช่เย็น", "2026-05", 200, 20), t("ไม่ระบุ", "2026-05", 100, 50)]).sort((a, b) => a - b)).toEqual([-5, 10, 10]);
  });
});

describe("Depreciation Coverage: เขียวต้อง ≥ 1 เท่า · ติดลบแดง", () => {
  it("P75 ติดลบ (ชุดตัวอย่าง −1.77) → คันที่ไม่ถึง 1 เท่าไม่ได้เขียว", () => {
    const past = [-8, -7, -5, -3, -2, -1.77, -1, 0.5];
    const r = metricResult("coverage", [0.5, 1.2, -0.5, -9], { values: past, label: "อดีต" });
    // 0.5 ≥ P75 แต่ < 1 → เหลือง · 1.2 → เขียว · −0.5 ติดลบ → แดง · −9 < P25 → แดง
    expect(r.tally).toEqual({ g: 1, y: 1, r: 2, n: 4 });
  });
});
