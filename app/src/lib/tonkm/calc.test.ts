import { describe, expect, it } from "vitest";
import type { LfTrip } from "../data/useLoadFactor";
import { aggregate, baselineOf, detailOf, judge, latestPeriod, overview, prevPeriod, yearRows } from "./calc";

/** เที่ยวจำลอง — ใส่เฉพาะฟิลด์ที่สูตรใช้ */
const trip = (y: number, m: number, vk: string, rev: number, vc: number, wt: number, km: number): LfTrip => ({
  id: `${y}${m}${vk}${rev}`, y, mo: `${y}-${String(m).padStart(2, "0")}`, ft: "", pl: "", vk, rt: "", st: "ปกติ",
  lf: 0.5, tg: 0.7, bind: "", cost: vc, rev, idle: 0, recov: 0, profit: rev - vc, km, wt, vc,
});

describe("กำไรส่วนเกิน/ตัน-กม.", () => {
  it("แถวแรกของตัวอย่างในสไลด์ = 0.919", () => {
    const a = aggregate([trip(2024, 1, "รถ 10 ล้อ", 11831, 7138.399, 7.092, 720)]);
    expect(a.tk).toBeCloseTo(5106.24, 2);
    expect(a.contrib).toBeCloseTo(4692.6, 2);
    expect(a.rate).toBeCloseTo(0.918993, 5);
  });

  it("รวมก่อนแล้วค่อยหาร — ไม่ใช่เฉลี่ยอัตรารายเที่ยว", () => {
    // เที่ยวใหญ่อัตรา 1 · เที่ยวเล็กอัตรา 10 → ถูก = 1,010/1,001 ≈ 1.009 · ผิด = 5.5
    const a = aggregate([trip(2024, 1, "A", 2000, 1000, 10, 100), trip(2024, 1, "A", 20, 10, 1, 1)]);
    expect(a.rate).toBeCloseTo(1010 / 1001, 6);
  });

  it("เที่ยวที่ตัน-กม. = 0 ไม่นับ (หารไม่ได้)", () => {
    const a = aggregate([trip(2024, 1, "A", 500, 900, 0, 300)]);
    expect(a).toEqual({ n: 0, contrib: 0, tk: 0, rate: null });
  });

  it("Baseline = 0.4 × ปี Y−2 + 0.6 × ปี Y−1 · มีปีเดียวใช้ปีนั้น (1ปี) · ไม่มีเลย = ไม่มีฐาน", () => {
    expect(baselineOf(2, 3).base).toBeCloseTo(2.6, 9);
    expect(baselineOf(2, 3).baseN).toBe(2);
    expect(baselineOf(null, 3)).toEqual({ base: 3, baseN: 1 });
    expect(baselineOf(2, null)).toEqual({ base: 2, baseN: 1 });
    expect(baselineOf(null, null)).toEqual({ base: null, baseN: 0 });
  });

  it("สถานะตามสัดส่วนของเป้า", () => {
    expect(judge(2.7, 2.5, 5).status).toBe("ok");        // เป้า 2.625
    expect(judge(2.2, 2.5, 5).status).toBe("near");      // 83.8%
    expect(judge(1.5, 2.5, 5).status).toBe("far");       // 57%
    expect(judge(-8.2, 5, 5).status).toBe("far");        // ฐานบวก ปีนี้ติดลบ = ต่ำกว่าเป้ามาก
  });

  it("Baseline ≤ 0 ไม่คิดเป้า — ไม่งั้นยิ่งขาดทุนหนัก % ยิ่งสูง", () => {
    const j = judge(-1.5, -1.14, 5);
    expect(j.status).toBe("vcloss");
    expect(j.target).toBeNull();
    expect(j.pctOfTarget).toBeNull();
  });

  it("ช่วงก่อนหน้า: เดือนก่อน (ข้ามปีได้) · ทั้งปี = ปีก่อน", () => {
    expect(prevPeriod({ year: 2026, month: "01" })).toEqual({ year: 2025, month: "12" });
    expect(prevPeriod({ year: 2026, month: "05" })).toEqual({ year: 2026, month: "04" });
    expect(prevPeriod({ year: 2026, month: "" })).toEqual({ year: 2025, month: "" });
  });

  it("การ์ด: ฐานจากปี Y−2/Y−1 ทั้งปี ไม่ใช้ปีที่วัด", () => {
    const trips = [
      trip(2024, 3, "A", 300, 100, 1, 100),   // 2.0
      trip(2025, 7, "A", 400, 100, 1, 100),   // 3.0
      trip(2026, 2, "A", 400, 100, 1, 100),   // 3.0 เดือนก่อน
      trip(2026, 3, "A", 900, 100, 2, 100),   // 4.0 ← ช่วงที่วัด
      trip(2026, 3, "B", 150, 100, 1, 100),   // 0.5 · ไม่มีฐาน
    ];
    const p = latestPeriod(trips)!;
    expect(p).toEqual({ year: 2026, month: "03" });
    const ov = overview(trips, p, 5);
    const a = ov.rows.find((r) => r.vk === "A")!;
    expect(a.base).toBeCloseTo(2.6, 9);          // ไม่ปนปี 2026
    expect(a.target).toBeCloseTo(2.73, 9);
    expect(a.status).toBe("ok");
    expect(ov.rows.find((r) => r.vk === "B")!.status).toBe("nobase");      // ไม่มีข้อมูลปี 2024/2025 เลย
    expect(ov.best!.vk).toBe("A");
    expect(ov.worst!.vk).toBe("B");
    expect(ov.below).toBe(0);
    expect(ov.all.rate).toBeCloseTo(850 / 300, 9);
    expect(ov.change).toBeCloseTo((850 / 300 - 3) / 3 * 100, 9);
  });

  it("ชนิดรถมาจากข้อมูล — ชนิดใหม่ขึ้นเอง · ชนิดที่ไม่มีเที่ยวในช่วงนี้ไม่แสดง", () => {
    const trips = [trip(2025, 7, "เก่า", 400, 100, 1, 100), trip(2026, 3, "ใหม่", 400, 100, 1, 100)];
    expect(overview(trips, { year: 2026, month: "03" }, 5).rows.map((r) => r.vk)).toEqual(["ใหม่"]);
  });

  it("ตารางรายปี: ปีแรกไม่มีฐาน · ปีที่สองฐาน 1ปี · ปีที่สาม 2ปี", () => {
    const rows = yearRows([
      trip(2024, 1, "A", 300, 100, 1, 100), trip(2025, 1, "A", 400, 100, 1, 100), trip(2026, 1, "A", 400, 100, 1, 100),
    ], 5);
    const at = (y: number) => rows.find((r) => r.year === y)!;
    expect(at(2024).status).toBe("nobase");
    expect(at(2025).baseN).toBe(1);
    expect(at(2025).base).toBeCloseTo(2, 9);          // ปี 2024 ปีเดียว
    expect(at(2025).status).toBe("ok");               // 3.0 เทียบเป้า 2.1
    expect(at(2026).baseN).toBe(2);
    expect(at(2026).base).toBeCloseTo(2.6, 9);
  });
});

describe("ป็อบอัพรายละเอียดปี × ชนิดรถ", () => {
  it("ยุบรายเดือน/รายเส้นทางด้วยสูตรเดียวกัน และนับเที่ยวที่ไม่มีน้ำหนักแยกไว้", () => {
    const t1 = { ...trip(2026, 1, "A", 400, 100, 1, 100), rt: "X" };
    const t2 = { ...trip(2026, 2, "A", 900, 100, 2, 100), rt: "X" };
    const t3 = { ...trip(2026, 2, "A", 500, 600, 0, 100), rt: "Y" };   // ตัน-กม. 0
    const d = detailOf([t1, t2, t3, trip(2025, 1, "A", 1, 1, 1, 1), trip(2026, 1, "B", 1, 1, 1, 1)], 2026, "A");
    expect(d.trips).toHaveLength(2);
    expect(d.skipped).toBe(1);
    expect(d.months.map((m) => m.mo)).toEqual(["2026-01", "2026-02"]);
    expect(d.routes).toHaveLength(1);
    expect(d.routes[0]!.agg.rate).toBeCloseTo(1100 / 300, 9);
  });
});
