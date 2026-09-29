import { describe, expect, it } from "vitest";
import { buildBench, buildTrips, fileSrc, issueCounts, issueLabel, managerTodo, marginBand, marginOf, overallBand, recordSrc, tripThresholds } from "./manager";

const TH = { lf: { p25: 40, p75: 70 }, margin: { p75: 10 } };
import { buildForecast } from "../forecast/forecast";
import type { Trip } from "../data/useCostRev";
import type { TripRecord } from "../../types/record";

describe("สถานะรวม LF + Margin ของแท็บหน้างาน", () => {
  it("เกณฑ์ Margin = เกณฑ์ PI: ขาดทุนแดง · ≥ P75 เขียว · ที่เหลือเหลือง", () => {
    expect([10, 9.9, 0, -0.1].map((v) => marginBand(v, TH))).toEqual(["g", "y", "y", "r"]);
    expect([marginBand(-5, { lf: null, margin: null }), marginBand(5, { lf: null, margin: null })]).toEqual(["r", null]);
  });
  it("tripThresholds = PERCENTILE.INC ของชุดอ้างอิง (LF P25/P75 · Margin P75)", () => {
    expect(tripThresholds([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], [0, 10, 20, 30, 40])).toEqual({ lf: { p25: 25, p75: 75 }, margin: { p75: 30 } });
    expect(tripThresholds([], [])).toEqual({ lf: null, margin: null });
  });
  it("Margin รายได้ 0 แล้วขาดทุน = −100 · ไม่มีรายได้และไม่ขาดทุน = null", () => {
    expect(marginOf(0, -500)).toBe(-100);
    expect(marginOf(0, 0)).toBeNull();
    expect(marginOf(1000, 150)).toBe(15);
  });
  it("ตารางคะแนน 3 × 3 (แถว = Margin · คอลัมน์ = LF)", () => {
    const bands = ["g", "y", "r"] as const;
    const grid = bands.map((mb) => bands.map((lfb) => overallBand(lfb, mb, 8)).join(""));
    expect(grid).toEqual(["ggy", "gyr", "yrr"]);
  });
  it("ขาดทุน = ไม่ผ่านเสมอ · ไม่มี LF = ตาม Margin", () => {
    expect(overallBand("g", "r", -3)).toBe("r");
    expect(overallBand(null, "g", 20)).toBe("g");
    expect(overallBand(null, null, null)).toBeNull();
  });
});

const T = (id: string, o: Partial<Trip>): Trip => ({
  id, d: "2026-05-10", mo: "2026-05", y: 2026, br: "เชียงใหม่", t: "", ft: "รถบริษัท", vk: "รถ 6 ล้อ", pl: "",
  o: "เชียงใหม่", de: "กรุงเทพ", rt: "เชียงใหม่-กรุงเทพ", dir: "", km: 700, rev: 10000, cost: 8000, profit: 2000,
  empty: false, clear: false, clrAmt: 0, clrN: 0, m: true,
  fuel: 5000, allow: 1000, fee: 500, repair: 500, dep: 1000, rent: 0, waste: 0,
  ...o,
} as Trip);

const F = (ts: Trip[], lf: [string, number][] = []) => fileSrc(ts, new Map(lf));

describe("คำแนะนำรายเที่ยว", () => {
  const base = [T("a", {}), T("b", {}), T("c", {})];
  it("ค่าเฉลี่ยเส้นทาง × ชนิดรถ ต้องมีอย่างน้อย 3 เที่ยว ไม่งั้นถอยไปชนิดรถ", () => {
    const bench = buildBench(F([...base, T("x", { rt: "ลำปาง-กรุงเทพ" })]));
    expect(bench(base[0]!)?.basis).toBe("route-kind");
    expect(bench(T("x", { rt: "ลำปาง-กรุงเทพ" }))?.basis).toBe("kind");
  });
  it("ชี้กลุ่มต้นทุนที่สูงกว่าเฉลี่ย", () => {
    const bad = T("bad", { fuel: 9000, cost: 12000, profit: -2000 });
    const [r] = buildTrips(F([bad, ...base], [["bad", 0.9]]), [], TH).filter((t) => t.id === "bad");
    expect(r!.band).toBe("r");
    expect(r!.advice.join(" ")).toMatch(/^ขาดทุน: ค่าน้ำมันสูงกว่าเฉลี่ย/);
    expect(r!.issues).toEqual(["loss", "cost:fuel"]);
    expect(issueLabel("cost:fuel")).toBe("ค่าน้ำมันสูงกว่าเฉลี่ย");
  });
  it("นับปัญหาต่อเที่ยว + กล่องต้องจัดการไม่ซ้ำรายการขาดทุน/รอบัญชี", () => {
    const bad = T("bad", { fuel: 9000, cost: 12000, profit: -2000 });
    const ts = buildTrips(F([bad, ...base], [["bad", 0.9], ["a", 0.3], ["b", 0.3]]), [], TH);
    expect(issueCounts(ts)).toEqual([{ key: "lfLow", n: 2 }, { key: "cost:fuel", n: 1 }, { key: "loss", n: 1 }]);
    const todo = managerTodo(ts, []);
    expect(todo).toMatchObject({ fail: 1, failLoss: 1, est: 0, topIssue: { key: "lfLow", n: 2 } });
  });
  it("LF ต่ำแต่กำไรดี = เฝ้าระวัง พร้อมคำแนะนำด้านการบรรทุก", () => {
    const [r] = buildTrips(F(base, [["a", 0.3]]), [], TH);
    expect(r!.band).toBe("y");
    expect(r!.advice).toEqual(["รถว่างมาก — รวมบิลเส้นทางเดียวกันเพิ่มหรือใช้รถคันเล็กลง"]);
  });
  it("ต้นทุนใกล้ค่าเฉลี่ยแต่ Margin ต่ำ = ให้ทบทวนราคา", () => {
    const low = base.map((t) => ({ ...t, rev: 8300, profit: 300 }));
    const [r] = buildTrips(F(low, [["a", 0.9]]), [], TH);
    expect(r!.advice).toEqual(["Margin ต่ำ — ต้นทุนใกล้ค่าเฉลี่ย ทบทวนราคาค่าขนส่ง"]);
  });
});

const R = (docNo: string, o: Partial<TripRecord>): TripRecord => ({
  id: "r" + docNo, docNo, date: "2026-05-20", releaseDate: "2026-05-21", branch: "เชียงใหม่",
  origin: "เชียงใหม่", dest: "กรุงเทพ", dist: 700, vehicle: "รถ 6 ล้อ", revenue: 10000,
  capacity: 5000, loadActual: 4000, emptyLeg: false, normal: 7000, waste: 0, fuelSum: 5000,
  ...o,
} as TripRecord);

describe("ใบที่บันทึกใหม่ในโมเดล", () => {
  const file = [T("6000000000001", {}), T("b", {}), T("c", {})];
  const fc = buildForecast(file, 5);
  const ids = new Set(file.map((t) => t.id));
  it("เลขซ้ำกับไฟล์ = ใช้ไฟล์ · ไม่มีเลขที่ใบ = ไม่นับ", () => {
    const rows = recordSrc([R("6000000000001", {}), R("", {}), R("6000000000009", {})], ids, fc);
    expect(rows.map((r) => r.id)).toEqual(["6000000000009"]);
  });
  it("ฝ่ายบัญชียังไม่กรอก = ต้นทุนพยากรณ์ · LF = น้ำหนัก ÷ ความจุ", () => {
    const [r] = recordSrc([R("6000000000009", {})], ids, fc);
    expect(r).toMatchObject({ src: "new", costEst: true, cost: 8000, profit: 2000, lf: 80, d: "2026-05-21" });
  });
  it("ฝ่ายบัญชีกรอกแล้ว = ต้นทุนจริง (normal + waste)", () => {
    const [r] = recordSrc([R("6000000000009", { _accountDone: true, waste: 500 } as Partial<TripRecord>)], ids, fc);
    expect(r).toMatchObject({ costEst: false, cost: 7500, profit: 2500 });
  });
  it("ต้นทุนพยากรณ์ขึ้นคำแนะนำรอฝ่ายบัญชี ไม่ชี้กลุ่มต้นทุน", () => {
    const [, , , n] = buildTrips(F(file), recordSrc([R("6000000000009", { revenue: 8300 })], ids, fc), TH);
    expect(n!.advice).toEqual(["Margin ต่ำ (ต้นทุนพยากรณ์) — ทบทวนราคาค่าขนส่ง", "รอฝ่ายบัญชีกรอกค่าใช้จ่าย (ตอนนี้ใช้ต้นทุนพยากรณ์)"]);
  });
});
