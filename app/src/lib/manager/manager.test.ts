import { describe, expect, it } from "vitest";
import {
  byCustomer, debtSummary, dueSoon, latestPeriod, managerTodo, lfBand, outstandingAt, lfSummary, onRoad, periodLabel, periodOptions, periodRange, releasedIn, runEnd,
} from "./manager";
import type { MgrTrip } from "./manager";
import type { DebtorRow } from "../data/useDebtors";

describe("ช่วงเวลา รายวัน / รายเดือน / รายไตรมาส / รายปี", () => {
  it("ขอบเขตของแต่ละแบบ", () => {
    expect(periodRange({ kind: "day", value: "2026-05-31" })).toEqual({ start: "2026-05-31", end: "2026-05-31" });
    expect(periodRange({ kind: "month", value: "2024-02" })).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(periodRange({ kind: "quarter", value: "2026-Q2" })).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(periodRange({ kind: "year", value: "2026" })).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("ป้ายภาษาไทย ปี พ.ศ.", () => {
    expect(periodLabel({ kind: "day", value: "2026-05-31" })).toBe("31 พฤษภาคม 2569");
    expect(periodLabel({ kind: "quarter", value: "2026-Q2" })).toBe("ไตรมาส 2/2569");
    expect(periodLabel({ kind: "year", value: "2026" })).toBe("ปี 2569");
  });
  it("ตัวเลือกไตรมาสไม่ซ้ำ ใหม่สุดก่อน", () => {
    expect(periodOptions("quarter", "2025-11-03", "2026-05-31").map((p) => p.value)).toEqual(["2026-Q2", "2026-Q1", "2025-Q4"]);
  });
  it("รายปีเลือกได้ทุกปีในช่วงข้อมูล และเริ่มที่ปีล่าสุด", () => {
    expect(periodOptions("year", "2024-11-03", "2026-05-31").map((p) => p.value)).toEqual(["2026", "2025", "2024"]);
    expect(latestPeriod("year", "2026-05-31")).toEqual({ kind: "year", value: "2026" });
  });
});

const TH = { lf: { p25: 40, p75: 70 }, margin: { p75: 10 } };

describe("เกณฑ์ Load Factor = เกณฑ์ PI (> P75 / P25–P75 / < P25)", () => {
  it("ขอบเขต (ขอบพอดี = เหลือง) · ไม่มีเกณฑ์ = null", () => {
    expect([70.1, 70, 40, 39.9].map((v) => lfBand(v, TH))).toEqual(["g", "y", "y", "r"]);
    expect(lfBand(90, { lf: null, margin: null })).toBeNull();
  });
});

const trip = (d: string, km: number | null, lf: number | null = 80): MgrTrip => ({
  id: d, br: "เชียงใหม่", d, eta: runEnd(d, km), o: "ก", de: "ข", vk: "รถ 6 ล้อ", lf, lfb: lf == null ? null : lfBand(lf, TH),
  margin: null, mb: null, band: lf == null ? null : lfBand(lf, TH), advice: [], issues: [], rev: 0, cost: 0, profit: 0, empty: false, src: "file", costEst: false,
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
      .toEqual({ n: 3, g: 1, y: 1, r: 0, na: 1, noLf: 1 });
  });
});

const bill = (issue: string, due: string, close: string | null, amount: number): DebtorRow => ({
  doc: issue + due, cust: "x", br: "เชียงใหม่", term: 30, issue, mo: issue.slice(0, 7), y: 2026, due, close, amount,
  days: null, over: null,
});

describe("ลูกหนี้ — ยอดคงค้าง ณ วันสิ้นช่วง ไม่ว่าวางบิลเมื่อไหร่", () => {
  const may = periodRange({ kind: "month", value: "2026-05" });
  const rows = [
    bill("2026-02-01", "2026-03-01", null, 50),         // วางก่อนช่วงนาน ค้าง 91 วัน → 61+
    bill("2026-04-20", "2026-05-20", null, 999),        // วางก่อนช่วง ค้าง 11 วัน → 1–30 (เดิมไม่นับ)
    bill("2026-05-01", "2026-05-10", null, 100),        // ค้าง 21 วัน → 1–30
    bill("2026-05-01", "2026-04-20", null, 200),        // ค้าง 41 วัน → 31–60
    bill("2026-05-05", "2026-06-05", null, 300),        // ยังไม่ถึงกำหนด
    bill("2026-05-02", "2026-05-10", "2026-05-15", 400), // ชำระในช่วง — ไม่ค้าง แต่นับเป็นเก็บเงินได้
    bill("2026-03-01", "2026-03-31", "2026-04-10", 700), // ชำระก่อนช่วง — ไม่นับทั้งสองทาง
    bill("2026-06-02", "2026-07-02", null, 900),        // วางหลังช่วง — ยังไม่มี
  ];
  it("สถานะและวันค้าง", () => {
    const bs = outstandingAt(rows, may.end);
    expect(bs.map((b) => [b.amount, b.status, b.overdue])).toEqual([
      [50, "late61", 91], [999, "late30", 11], [100, "late30", 21], [200, "late60", 41], [300, "notdue", 0],
    ]);
  });
  it("อายุหนี้ · วางบิล/เก็บเงินในช่วง · DSO = คงค้าง ÷ วางบิลในช่วง × วัน", () => {
    const s = debtSummary(outstandingAt(rows, may.end), rows, may);
    expect(s).toMatchObject({ outstanding: 1649, notdue: 300, late30: 1099, late60: 200, late61: 50,
      billed: 1000, billedN: 4, collected: 400, collectedN: 1, days: 31,
      n: { all: 5, notdue: 1, late30: 2, late60: 1, late61: 1 } });
    expect(s.dso).toBeCloseTo(1649 / 1000 * 31);
  });
  it("ไม่มีบิลวางในช่วง = DSO หารไม่ได้", () => {
    const jun = periodRange({ kind: "day", value: "2026-05-31" });
    expect(debtSummary(outstandingAt(rows, jun.end), rows, jun).dso).toBeNull();
  });
  it("ครบกำหนดใน 7 วัน = ยังไม่ถึงกำหนดและครบภายใน 7 วันหลังวันสิ้นช่วง", () => {
    const bs = outstandingAt([...rows, bill("2026-05-20", "2026-06-07", null, 70), bill("2026-05-20", "2026-06-08", null, 80)], may.end);
    expect(bs.filter(dueSoon).map((b) => [b.amount, b.dueIn])).toEqual([[300, 5], [70, 7]]);
    expect(bs.find((b) => b.amount === 80)!.dueIn).toBe(8);
    expect(bs.find((b) => b.amount === 100)!.dueIn).toBeNull();   // เลยกำหนดแล้ว
  });
  it("กล่องต้องจัดการ: ค้างเกิน 30 วัน = 31–60 + 61+ · นับลูกค้าไม่ซ้ำ", () => {
    const t = managerTodo([], outstandingAt(rows, may.end));
    expect(t.over30).toEqual({ cust: 1, amount: 250, bills: 2 });
    expect(t.soon).toEqual({ cust: 1, amount: 300, bills: 1 });
  });
  it("รวมรายลูกค้า", () => {
    const b = outstandingAt(rows.map((r, i) => ({ ...r, cust: i < 2 ? "A" : "B" })), may.end);
    expect(byCustomer(b)).toEqual([
      { cust: "A", br: "เชียงใหม่", n: 2, amount: 1049, overdueAmt: 1049, maxOver: 91 },
      { cust: "B", br: "เชียงใหม่", n: 3, amount: 600, overdueAmt: 300, maxOver: 41 },
    ]);
  });
});
