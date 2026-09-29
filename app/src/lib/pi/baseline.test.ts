import { describe, expect, it } from "vitest";
import { addDays, baselineOf, evalPeriod, evalRange, inRange, minEvalStart, refSet, scopedValues } from "./baseline";
import { indexStatus, metricResult } from "./score";
import { coverageByVehicleMonth, tkmByVehicleMonth } from "./cost";
import { serviceMonthMarginValues } from "./route";
import type { VRow } from "../detail3/calc";
import type { MetricResult } from "./score";

describe("Reference Baseline = 12 เดือนปฏิทินก่อนเดือนที่ประเมิน (Methodology 29 ก.ย. 2569)", () => {
  it("ประเมิน พ.ค. 2569 → Baseline 1 พ.ค. 2568 – 30 เม.ย. 2569 · ไม่รวมช่วงประเมิน", () => {
    const ev = evalRange({ year: "2026", from: "05", to: "05" }, [])!;
    expect(ev).toMatchObject({ start: "2026-05-01", end: "2026-05-31" });
    const b = baselineOf(ev, "2024-01-01", ["2025-05", "2025-12", "2026-04", "2026-05"]);
    expect(b).toMatchObject({ start: "2025-05-01", end: "2026-04-30", months: 3, spanMonths: 12, full: true });
  });
  it("ประเมินถึงระดับวัน → Baseline ยังเป็น 12 เดือนเต็มชุดเดิม (ไม่เปลี่ยนตามวัน) · ไฟล์เริ่มหลังเดือนแรกของ Baseline = ไม่ครบ", () => {
    const ev = evalRange({ year: "2026", from: "05", to: "05", d1: "16", d2: "20" }, [])!;
    expect(ev).toMatchObject({ start: "2026-05-16", end: "2026-05-20" });
    expect(baselineOf(ev, "2025-05-20", [])).toMatchObject({ start: "2025-05-01", end: "2026-04-30", full: true });
    expect(baselineOf(ev, "2025-06-01", [])).toMatchObject({ full: false });
    expect(minEvalStart("2024-01-05")).toBe("2025-01-01");
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
  });
  it("ไม่เลือกปี = เดือนล่าสุดของไฟล์", () => {
    expect(evalRange({ year: "", from: "01", to: "12" }, ["2026-03", "2026-05"])).toMatchObject({ start: "2026-05-01", end: "2026-05-31" });
  });
  it("รายการที่มีแค่เดือน: Baseline นับเฉพาะเดือนเต็ม · ช่วงประเมินนับเดือนที่คร่อม", () => {
    const r = { start: "2025-05-16", end: "2026-05-15" };
    expect([inRange({ mo: "2025-05" }, r, "inside"), inRange({ mo: "2025-06" }, r, "inside"), inRange({ mo: "2026-05" }, r, "inside")])
      .toEqual([false, true, false]);
    expect(inRange({ mo: "2026-05" }, { start: "2026-05-16", end: "2026-05-20" }, "overlap")).toBe(true);
    expect(inRange({ mo: "2026-05", d: "2026-05-10" }, { start: "2026-05-16", end: "2026-05-20" }, "overlap")).toBe(false);
  });
  it("Baseline ไม่ครบ 365 วัน = N/A · DSO (partialOk) ใช้เท่าที่มี · ไม่มีรายการ = N/A", () => {
    const b = { start: "2025-05-01", end: "2026-04-30", months: 4, spanMonths: 12, full: false, first: "2026-01-02" };
    expect(refSet([1, 2], "ลูกค้า", b)).toMatchObject({ ok: false, na: "Baseline ไม่ครบ" });
    expect(refSet([1, 2], "ลูกค้า", b, true)).toMatchObject({ ok: true });
    expect(refSet([], "ลูกค้า", b, true)).toMatchObject({ ok: false, na: "ไม่มี Baseline" });
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
    expect(evalPeriod(f0, ["2026-03", "2026-05", "2025-12"])).toEqual({ year: "2026", from: "05", to: "05", vk: "x", d1: "", d2: "" });
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

describe("Baseline ระดับสาขา + ขั้นต่ำ (29 ก.ย. 2569)", () => {
  it("สาขามีรายการถึงขั้นต่ำใช้ของสาขา · ไม่ถึงใช้บริษัทพร้อมเหตุผล · ไม่เลือกสาขา = บริษัท", () => {
    const co = [1, 2, 3], br30 = Array.from({ length: 30 }, (_, i) => i), br5 = [1, 2, 3, 4, 5];
    expect(scopedValues(co, br30, "เชียงใหม่", "เส้นทาง")).toMatchObject({ values: br30, scope: "ระดับสาขา เชียงใหม่" });
    const few = scopedValues(co, br5, "เชียงใหม่", "เส้นทาง");
    expect(few.values).toBe(co);
    expect(few.scope).toContain("ไม่ถึงขั้นต่ำ 30");
    expect(scopedValues(co, null, "", "เส้นทาง")).toMatchObject({ values: co, scope: "ระดับบริษัท" });
    expect(scopedValues(co, Array(12).fill(1), "ลำปาง", "เดือน", 12).scope).toBe("ระดับสาขา ลำปาง");
  });
});

describe("คะแนน Baseline (เจ้าของงานขอ 29 ก.ย. 2569 · แบบที่ 1)", () => {
  const b = { start: "2025-05-01", end: "2026-04-30", months: 12, spanMonths: 12, full: true, first: "2024-01-01" };
  it("ช่วงของป็อบอัพเป็นชื่อเดือนเต็ม พ.ศ.", () => {
    expect(refSet([1], "เส้นทาง", b).period).toBe("ปีก่อนหน้า พฤษภาคม 2568 – เมษายน 2569");
  });
  it("รายการใน Baseline ให้สีด้วยเกณฑ์ของ Baseline เอง แล้วคิดสูตรเดียวกับคะแนนปัจจุบัน", () => {
    // Margin: P75 ของ [-10, 0, 10, 20, 30] = 20 → Baseline: แดง 1 · เหลือง 2 · เขียว 2 → (2 + 1) ÷ 5 × 10 = 6
    const r = metricResult("route", [25, 25], refSet([-10, 0, 10, 20, 30], "เส้นทาง", b));
    expect(r.score).toBe(10);
    expect(r.base?.score).toBe(6);
    expect(r.base?.tally).toEqual({ g: 2, y: 2, r: 1, n: 5 });
  });
  it("Baseline ไม่ครบ = ไม่มีคะแนน Baseline แต่ยังมีช่วง", () => {
    const r = metricResult("route", [25], refSet([1, 2], "เส้นทาง", { ...b, full: false }));
    expect(r.base).toEqual({ score: null, tally: null, period: "ปีก่อนหน้า พฤษภาคม 2568 – เมษายน 2569" });
  });
});
