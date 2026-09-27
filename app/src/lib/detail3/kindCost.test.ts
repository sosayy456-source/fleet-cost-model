import { describe, expect, it } from "vitest";
import type { Trip } from "../data/useCostRev";
import { costFlagDetails, costFlags, kindCostTable, routeKindMatrix, vehicleRows } from "./calc";

const trip = (c: Partial<Trip> = {}): Trip => ({
  id: "1", d: "2025-01-05", mo: "2025-01", y: 2025, rt: "ก-ข", pl: "หัว", vk: "รถ 10 ล้อ", ft: "รถบริษัท",
  cost: 1000, rev: 3000, profit: 2000, dep: 100, km: 100, wt: 2, ...c,
} as Trip);

describe("Flag 3 เกณฑ์ของตารางต้นทุนแต่ละชนิดรถ — เกิน 2 เท่าของค่าเฉลี่ยรายคันของชนิดรถ", () => {
  // ชนิดเดียวกัน 5 คัน: ต้นทุน 1000 ×4 + 9000 → เฉลี่ย 2600 → 9000 > 5200 ติด Flag ต้นทุน/เที่ยว
  const rows = vehicleRows([
    ...[1, 2, 3, 4].map((i) => trip({ id: String(i) })),
    trip({ id: "5", cost: 9000 }),
  ]);
  it("ต้นทุน/เที่ยว · ต้นทุน/กม. · ต้นทุน/ตัน-กม. แยกเกณฑ์", () => {
    const f = costFlags(rows);
    expect(rows.map((r) => f.get(r)!.trip)).toEqual([false, false, false, false, true]);
    expect(f.get(rows[4]!)).toEqual({ trip: true, km: true, tkm: true });
  });
  it("ต้นทุน/กม. ตัดคันที่ระยะทาง 0 ออกทั้งค่ารายคันและค่าเฉลี่ย", () => {
    const rs = vehicleRows([trip({ id: "a" }), trip({ id: "b" }), trip({ id: "c", km: 0 })]);
    const f = costFlags(rs);
    expect(f.get(rs[2]!)!.km).toBe(false);
  });
  it("ค้นหาต้นทาง/ปลายทางไม่เปลี่ยน Flag · ติ๊ก Flag เหลือเฉพาะคันที่ติด", () => {
    const all = [...rows, ...vehicleRows([trip({ id: "6", o: "ค", de: "ง" })])];
    const t = kindCostTable(all, 2025, { flaggedOnly: true });
    expect(t.list).toEqual([expect.objectContaining({ vk: "รถ 10 ล้อ", n: 1, fTrip: 1 })]);
    expect(kindCostTable(all, 2025, { origin: "ค", dest: "ง" }).list[0]).toMatchObject({ n: 1, fTrip: 0 });
    expect(kindCostTable(all, 2025, { dest: "ง" }).origins).toEqual(["ค"]);
  });
  it("% เปลี่ยนแปลง: ปีก่อนตามช่องค้นหา ไม่ตามติ๊ก Flag", () => {
    const prev = vehicleRows([trip({ id: "p", y: 2024, cost: 500 })]);
    const t = kindCostTable([...rows, ...prev], 2025, { flaggedOnly: true });
    // ปีนี้เฉพาะคันที่ติด (9000 ÷ 200 = 45) เทียบปีก่อนทุกคัน (500 ÷ 200 = 2.5)
    expect(t.list[0]!.change).toBeCloseTo((45 - 2.5) / 2.5 * 100);
  });
  it("ตาราง Flag ของ Overall Dashboard (costFlagDetails) ได้ชุดเดียวกับตัวเลขข้างช่องติ๊กของ Executive Dashboard", () => {
    const d = costFlagDetails(rows);
    expect(d.filter((x) => x.any).length).toBe(kindCostTable(rows, 2025, {}).flagged);
    const hit = d.find((x) => x.row.cost === 9000)!;
    expect(hit.trip.times).toBeCloseTo(9000 / 2600);
    expect(hit.maxTimes).toBeCloseTo(Math.max(hit.trip.times!, hit.km.times!, hit.tkm.times!));
    const f = costFlags(rows);
    expect(d.every((x) => f.get(x.row)!.trip === x.trip.flag && f.get(x.row)!.tkm === x.tkm.flag)).toBe(true);
  });
  it("ตารางเส้นทางกับการใช้งานรถสลับมิติ: ต่อเที่ยว/ต่อกม. ใช้ค่าเฉลี่ยรายคันของมิตินั้น · ต่อกม. ตัดระยะทาง 0", () => {
    const rs = vehicleRows([trip({ id: "a" }), trip({ id: "b", cost: 3000 }), trip({ id: "c", km: 0 })]);
    const t = routeKindMatrix(rs, "trip"), k = routeKindMatrix(rs, "km");
    expect(t.routes[0]!.cells["รถ 10 ล้อ"]!.avg).toBeCloseTo((1000 + 3000 + 1000) / 3);
    expect(k.excluded).toBe(1);
    expect(k.routes[0]!.cells["รถ 10 ล้อ"]!.avg).toBeCloseTo((10 + 30) / 2);
  });
});
