import { describe, expect, it } from "vitest";
import { buildForecast, forecastFor, recentTrips } from "./forecast";
import type { Trip } from "../data/useCostRev";

const trip = (p: Partial<Trip>): Trip => ({
  id: "1", d: "2026-05-01", mo: "2026-05", y: 2026, br: "", t: "", ft: "รถบริษัท",
  vk: "รถ 10 ล้อ", pl: "", o: "เชียงใหม่", de: "ตลาดไท", rt: "", dir: "", km: 700,
  rev: 20000, cost: 10000, profit: 10000, empty: false, clear: false, clrAmt: 0, clrN: 0,
  m: true, bn: 0, cus: [], sg: "",
  waste: 0, fuel: 6000, allow: 1500, fee: 500, repair: 1000, dep: 800, rent: 0,
  f_cash: 0, f_down: 0, f_up: 0, f_pickup: 0, f_call: 0, a_drv: 0, a_spare: 0, a_off: 0,
  ...p,
} as Trip);

describe("ต้นทุนพยากรณ์", () => {
  it("ใช้เฉพาะ N เดือนล่าสุดของไฟล์ ไม่ใช่เดือนปัจจุบัน", () => {
    const rows = [trip({ mo: "2025-01" }), trip({ mo: "2026-04" }), trip({ mo: "2026-05" })];
    const r = recentTrips(rows, 2);
    expect(r.rows).toHaveLength(2);
    expect([r.from, r.to]).toEqual(["2026-04", "2026-05"]);
  });

  it("ไม่นับเที่ยววิ่งเปล่าเข้าค่าเฉลี่ย", () => {
    const tb = buildForecast([trip({ cost: 10000 }), trip({ cost: 2000, empty: true })], 12);
    expect(tb.n).toBe(1);
    expect(forecastFor(tb, "เชียงใหม่", "ตลาดไท", "รถ 10 ล้อ").cost).toBe(10000);
  });

  it("ชั้นแรกคือ เส้นทาง × ชนิดรถ", () => {
    const tb = buildForecast([
      trip({ cost: 10000 }),
      trip({ cost: 30000, vk: "รถเทรเล่อร์ (แม่)" }),
    ], 12);
    const f = forecastFor(tb, "เชียงใหม่", "ตลาดไท", "รถ 10 ล้อ");
    expect(f.basis).toBe("route-kind");
    expect(f.cost).toBe(10000);
  });

  it("เส้นทางใหม่ถอยไปใช้ค่าเฉลี่ยของชนิดรถ", () => {
    const tb = buildForecast([trip({ cost: 10000 }), trip({ cost: 20000 })], 12);
    const f = forecastFor(tb, "ลำปาง", "ราชบุรี", "รถ 10 ล้อ");
    expect(f.basis).toBe("kind");
    expect(f.cost).toBe(15000);
    expect(f.n).toBe(2);
  });

  it("ชนิดรถใหม่ถอยไปใช้ค่าเฉลี่ยของเส้นทาง", () => {
    const tb = buildForecast([trip({ cost: 10000 })], 12);
    const f = forecastFor(tb, "เชียงใหม่", "ตลาดไท", "รถใหม่เอี่ยม");
    expect(f.basis).toBe("route");
    expect(f.cost).toBe(10000);
  });

  it("แยกกลุ่มต้นทุนเฉลี่ยและบวกกลับได้เท่าต้นทุนรวม", () => {
    const tb = buildForecast([trip({}), trip({ cost: 20000, fuel: 12000, allow: 3000, fee: 1000, repair: 2000, dep: 1600 })], 12);
    const f = forecastFor(tb, "เชียงใหม่", "ตลาดไท", "รถ 10 ล้อ");
    const sum = Object.values(f.parts).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(f.cost, 1);
  });

  it("ไม่มีข้อมูลเลยคืนศูนย์โดยไม่พัง", () => {
    const tb = buildForecast([], 12);
    const f = forecastFor(tb, "ก", "ข", "ค");
    expect(f.cost).toBe(0);
    expect(f.n).toBe(0);
  });
});
