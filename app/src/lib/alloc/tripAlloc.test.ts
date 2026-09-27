import { describe, expect, it } from "vitest";
import { allocateTrip, conversionFactor, equivalentKg, roundAllocs } from "./tripAlloc";
import type { AllocItem } from "./tripAlloc";
import { pendingAllocItems, recordAllocItems, recordCapacity } from "./recordAlloc";
import type { PendingBill } from "../../types/bill";
import type { TripRecord } from "../../types/record";

/** ปริมาตรเป็นก้อนละ 1 ลบ.ม. (จำนวน = ปริมาตร) — ไม่ให้ติดเกณฑ์ "ชิ้นเดียวเกิน 10 ลบ.ม." เหมือน etl/test_alloc_cf.py */
const it_ = (key: string, weightKg: number, volumeM3: number, distKm: number | null, revenue = 1000): AllocItem =>
  ({ key, weightKg, volumeM3, qty: Math.max(1, volumeM3), distKm, revenue });

describe("Conversion Factor จากความจุรถ", () => {
  it("20,000 กก. / 60 ลบ.ม. = 333.33 · รถคนละแบบได้คนละค่า", () => {
    expect(conversionFactor(20_000, 60)).toBeCloseTo(333.333, 3);
    expect(conversionFactor(12_000, 45)).toBeCloseTo(266.667, 3);
  });
  it("ความจุไม่ครบ = null (ไม่หารศูนย์)", () => {
    expect([conversionFactor(20_000, 0), conversionFactor(0, 60), conversionFactor(null, 60)]).toEqual([null, null, null]);
  });
});

describe("น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF)", () => {
  const cf = 20_000 / 60;
  it("weight-heavy ใช้น้ำหนักจริง", () => expect(equivalentKg(5_000, 10, 1, cf)).toEqual({ eqKg: 5_000, cond: 1 }));
  it("volume-heavy ใช้ปริมาตร × CF", () => expect(equivalentKg(1_000, 10, 1, cf).eqKg).toBeCloseTo(3_333.33, 2));
});

describe("ตัวอย่าง A/B/C ในสเปก (รถ 20,000 กก. / 60 ลบ.ม. · ต้นทุนเที่ยว 10,000)", () => {
  const cf = conversionFactor(20_000, 60);
  const res = allocateTrip([it_("A", 5_000, 10, 100), it_("B", 1_000, 10, 300), it_("C", 2_000, 20, 500)], 10_000, cf);

  it("Eq. Weight → Metric → สัดส่วน → ต้นทุน", () => {
    expect(res.error).toBeNull();
    expect(res.rows.map((r) => Math.round(r.eqKg * 10) / 10)).toEqual([5_000, 3_333.3, 6_666.7]);
    expect(res.rows.map((r) => Math.round(r.metric))).toEqual([500_000, 1_000_000, 3_333_333]);
    expect(res.rows.map((r) => r.cost)).toEqual([1_034.48, 2_068.97, 6_896.55]);
  });
  it("ต้นทุนของทุกบิลรวมกัน = ต้นทุนเที่ยวพอดี", () => {
    expect(Math.round(res.rows.reduce((s, r) => s + r.cost, 0) * 100) / 100).toBe(10_000);
    expect(res.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 9);
  });
  it("เหมือน ETL ทุกสตางค์ (etl/test_alloc_cf.py ได้ 1,034.48 / 2,068.97 / 6,896.55)", () => {
    expect(res.rows[0]!.cf).toBeCloseTo(333.333, 3);
  });
});

describe("ปัดเศษ", () => {
  it("หารไม่ลงตัว ส่วนต่างไปบิลที่มากสุด", () => {
    expect(roundAllocs([100 / 3, 100 / 3, 100 / 3], 100)).toEqual([33.34, 33.33, 33.33]);
  });
  it("หลายลูกค้า รวมตรงทุกสตางค์", () => {
    const items = Array.from({ length: 13 }, (_, i) => it_(`b${i}`, 100 + i * 7, 1 + (i % 3), 100 + i * 11));
    const res = allocateTrip(items, 9_999.99, conversionFactor(12_000, 45));
    expect(Math.round(res.rows.reduce((s, r) => s + r.cost, 0) * 100) / 100).toBe(9_999.99);
  });
});

describe("Validation", () => {
  const cf = 300;
  it("ไม่มีบิล · ต้นทุนติดลบ · ความจุรถไม่ครบ · ค่าติดลบ", () => {
    expect(allocateTrip([], 100, cf).error).toBeTruthy();
    expect(allocateTrip([it_("A", 1, 1, 10)], -1, cf).error).toBeTruthy();
    expect(allocateTrip([it_("A", 1, 1, 10)], 100, null).error).toContain("ความจุรถ");
    expect(allocateTrip([it_("A", -5, 1, 10)], 100, cf).error).toContain("ติดลบ");
  });
  it("ระยะทางหาไม่เจอ = ค่ากลางของบิลอื่นในเที่ยว", () => {
    const res = allocateTrip([it_("A", 100, 0, 100), it_("B", 100, 0, 300), it_("C", 100, 0, null)], 100, cf);
    expect(res.rows[2]).toMatchObject({ dist: 200, distSource: "ค่ากลางของเที่ยว" });
  });
  it("บิลที่ไม่มีน้ำหนัก/ขนาด ปันตามรายได้แยกก้อน", () => {
    const res = allocateTrip([it_("A", 1_000, 1, 100, 800), it_("B", 0, 0, 100, 200)], 1_000, cf);
    expect(res.rows[1]).toMatchObject({ byRevenue: true, flag: "ไม่มีน้ำหนัก/ขนาด", cost: 200 });
    expect(res.rows[0]!.cost).toBe(800);
  });
});

describe("ใบที่บันทึกใหม่ → ข้อมูลเข้าสูตร", () => {
  it("ความจุหัว + หาง จากตารางรถ", () => {
    const c = recordCapacity({ vehicle: "รถ 10 ล้อ", trailerVehicle: "หางพ่วงคอก" });
    expect(c.cf).toBeCloseTo(24_000 / 79, 6);
    expect(recordCapacity({ vehicle: "รถไม่มีในตาราง" }).cf).toBeNull();
  });
  it("น้ำหนัก/ปริมาตรจากบิลที่ CS กรอก จับคู่ด้วยเลขที่บิล", () => {
    const rec = { docNo: "6269999900001", bills: [{ no: "B1", origin: "เชียงใหม่", dest: "ตลาดไท", total: 500, qty: 2 }, { no: "B9", origin: "", dest: "", total: 100, qty: 1 }] } as unknown as TripRecord;
    const pending = [{ no: "B1", docNo: "6269999900001", weight: 400, volume: 1.5, qty: 2 }] as unknown as PendingBill[];
    const { items, unmatched } = recordAllocItems(rec, pending);
    expect(items[0]).toMatchObject({ key: "B1", weightKg: 400, volumeM3: 1.5, revenue: 500 });
    expect(items[0]!.distKm).toBeGreaterThan(0);
    expect(items[1]).toMatchObject({ weightKg: 0, volumeM3: 0 });
    expect(unmatched).toBe(1);
  });
  it("บิลที่ติ๊กในหน้าจัดรถ → ปันต้นทุนพยากรณ์ รวมเท่าต้นทุนพยากรณ์", () => {
    const pb = (no: string, weight: number, volume: number, total: number) =>
      ({ no, weight, volume, qty: Math.max(1, volume), total, origin: "เชียงใหม่", dest: "ตลาดไท" }) as unknown as PendingBill;
    const items = pendingAllocItems([pb("A", 5_000, 10, 9_000), pb("B", 1_000, 10, 4_000)]);
    expect(items[0]).toMatchObject({ key: "A", weightKg: 5_000, volumeM3: 10, revenue: 9_000 });
    const res = allocateTrip(items, 7_777.77, recordCapacity({ vehicle: "รถ 10 ล้อ", trailerVehicle: "หางพ่วงคอก" }).cf);
    expect(Math.round(res.rows.reduce((s, r) => s + r.cost, 0) * 100) / 100).toBe(7_777.77);
    expect(res.rows[1]!.eqKg).toBeCloseTo(10 * 24_000 / 79, 6);
  });
});
