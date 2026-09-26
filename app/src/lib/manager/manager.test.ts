import { describe, expect, it } from "vitest";
import {
  billsInPeriod, debtSummary, lfBand, lfSummary, onRoad, periodLabel, periodOptions, periodRange, releasedIn, runEnd,
} from "./manager";
import type { MgrTrip } from "./manager";
import type { DebtorRow } from "../data/useDebtors";

describe("ช่วงเวลา รายวัน / รายเดือน / รายไตรมาส", () => {
  it("ขอบเขตของแต่ละแบบ", () => {
    expect(periodRange({ kind: "day", value: "2026-05-31" })).toEqual({ start: "2026-05-31", end: "2026-05-31" });
    expect(periodRange({ kind: "month", value: "2024-02" })).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(periodRange({ kind: "quarter", value: "2026-Q2" })).toEqual({ start: "2026-04-01", end: "2026-06-30" });
  });
  it("ป้ายภาษาไทย ปี พ.ศ.", () => {
    expect(periodLabel({ kind: "day", value: "2026-05-31" })).toBe("31 พฤษภาคม 2569");
    expect(periodLabel({ kind: "quarter", value: "2026-Q2" })).toBe("ไตรมาส 2/2569");
  });
  it("ตัวเลือกไตรมาสไม่ซ้ำ ใหม่สุดก่อน", () => {
    expect(periodOptions("quarter", "2025-11-03", "2026-05-31").map((p) => p.value)).toEqual(["2026-Q2", "2026-Q1", "2025-Q4"]);
  });
});

describe("เกณฑ์ Load Factor ของหน้านี้ ≥ 70 / 40–<70 / < 40", () => {
  it("ขอบเขต", () => {
    expect([70, 69.9, 40, 39.9].map(lfBand)).toEqual(["g", "y", "y", "r"]);
  });
});

const trip = (d: string, km: number | null, lf: number | null = 80): MgrTrip => ({
  id: d, br: "เชียงใหม่", d, eta: runEnd(d, km), o: "ก", de: "ข", lf, band: lf == null ? null : lfBand(lf),
  rev: 0, cost: 0, profit: 0, empty: false,
});

describe("กำลังวิ่ง = [วันปล่อยรถ, วันที่คาดว่าถึง] ทับช่วงที่เลือก", () => {
  it("วันที่คาดว่าถึงตามกฎของสถานะกองรถ", () => {
    expect(runEnd("2026-05-30", 700)).toBe("2026-06-01");   // ⌈700 ÷ 500⌉ = 2 วัน
    expect(runEnd("2026-05-30", 100)).toBe("2026-05-31");   // อย่างน้อย 1 วัน
    expect(runEnd("2026-05-30", null)).toBe("2026-05-30");  // ไม่รู้ระยะทาง = วันปล่อยรถ
  });
  it("เที่ยวที่ปล่อยเดือนก่อนแต่ยังวิ่งข้ามเดือน นับเป็นกำลังวิ่ง แต่ไม่นับเป็นปล่อยรถในเดือนนี้", () => {
    const t = trip("2026-04-30", 900);
    const may = periodRange({ kind: "month", value: "2026-05" });
    expect(onRoad(t, may)).toBe(true);
    expect(releasedIn(t, may)).toBe(false);
  });
  it("นับสามสี + ไม่มี LF แยก", () => {
    expect(lfSummary([trip("2026-05-01", 1), trip("2026-05-01", 1, 50), trip("2026-05-01", 1, null)]))
      .toEqual({ n: 3, g: 1, y: 1, r: 0, na: 1 });
  });
});

const bill = (issue: string, due: string, close: string | null, amount: number): DebtorRow => ({
  doc: issue + due, cust: "x", br: "เชียงใหม่", term: 30, issue, mo: issue.slice(0, 7), y: 2026, due, close, amount,
  days: null, over: null,
});

describe("ลูกหนี้ — บิลที่วางในช่วง สถานะ ณ วันสุดท้ายของช่วง", () => {
  const may = periodRange({ kind: "month", value: "2026-05" });
  const rows = [
    bill("2026-04-20", "2026-05-20", null, 999),        // วางก่อนช่วง — ไม่นับ
    bill("2026-05-01", "2026-05-10", null, 100),        // ค้าง 21 วัน → 1–30
    bill("2026-05-01", "2026-04-20", null, 200),        // ค้าง 41 วัน → 31+
    bill("2026-05-05", "2026-06-05", null, 300),        // ยังไม่ถึงกำหนด
    bill("2026-05-02", "2026-05-10", "2026-05-15", 400), // ชำระแล้ว
  ];
  it("สถานะและวันค้าง", () => {
    const bs = billsInPeriod(rows, may);
    expect(bs.map((b) => [b.status, b.overdue])).toEqual([["late30", 21], ["late31", 41], ["notdue", 0], ["paid", 0]]);
  });
  it("ยอดค้างรวมไม่รวมบิลที่ชำระแล้ว · DSO = ค้าง ÷ วางบิล × วัน", () => {
    const s = debtSummary(billsInPeriod(rows, may), may);
    expect(s).toMatchObject({ billed: 1000, outstanding: 600, late30: 100, late31: 200, days: 31 });
    expect(s.dso).toBeCloseTo(600 / 1000 * 31);
  });
});
