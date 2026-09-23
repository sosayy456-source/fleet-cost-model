/**
 * %การใช้งานรายคัน — ตัวหารต้องนับเฉพาะช่วงที่ไฟล์มีข้อมูล และตัดตามตัวกรองเดียวกับตัวเศษ
 */
import { describe, expect, it } from "vitest";
import { availableDays, avgUse, totalKm, vehicleUse } from "./vehicleUse";
import type { UseWindow } from "./vehicleUse";
import type { FleetSlice } from "./utilization";
import type { Trip } from "../data/useCostRev";

const all = (from: string, to: string): UseWindow => ({ from, to, monthOk: () => true });

describe("availableDays", () => {
  it("นับรวมวันแรกและวันสุดท้าย", () => {
    expect(availableDays("2025-01-01", all("2025-01-01", "2025-01-31"))).toBe(31);
  });
  it("เริ่มใช้งานก่อนไฟล์ = นับจากวันแรกของไฟล์ (ไม่ใช่วันเริ่มใช้งาน)", () => {
    expect(availableDays("2020-05-01", all("2025-03-01", "2025-03-10"))).toBe(10);
  });
  it("เริ่มใช้งานกลางช่วง = นับจากวันเริ่มใช้งาน", () => {
    expect(availableDays("2025-03-06", all("2025-03-01", "2025-03-10"))).toBe(5);
  });
  it("ตัวกรองเดือนตัดตัวหารด้วย", () => {
    const w: UseWindow = { from: "2025-01-01", to: "2025-12-31", monthOk: (mo) => mo === "2025-02" };
    expect(availableDays("2024-01-01", w)).toBe(28);
  });
  it("ไม่มีวันเริ่มใช้งาน = คิดไม่ได้", () => {
    expect(availableDays("", all("2025-01-01", "2025-01-31"))).toBeNull();
  });
});

describe("vehicleUse", () => {
  const trips = [
    { id: "T1", d: "2025-01-05", km: 300 },
    { id: "T2", d: "2025-01-05", km: 200 },   // วันเดียวกัน นับวันเดียว
    { id: "T3", d: "2025-01-20", km: null },  // ไม่รู้ระยะทาง
  ] as unknown as Trip[];
  const rows = [
    { id: "T1", pl: "A" }, { id: "T1", pl: "A" },  // ใบเดียวหลายกลุ่มบริการ ต้องนับเที่ยวเดียว
    { id: "T2", pl: "A" }, { id: "T3", pl: "A" },
    { id: "T1", pl: "B" },                          // หางในใบเดียวกัน ได้เที่ยวด้วย
  ] as unknown as FleetSlice[];
  const roster = [
    { plate: "A", fleetType: "รถบริษัท", vehicle: "รถ 10 ล้อ", start: "2025-01-01", status: "ใช้งาน" },
    { plate: "B", fleetType: "รถบริษัท", vehicle: "หางพ่วง", start: "2025-01-01", status: "ใช้งาน" },
    { plate: "C", fleetType: "รถร่วม", vehicle: "รถ 6 ล้อ", start: "2025-01-01", status: "ใช้งาน" },
    { plate: "D", fleetType: "รถร่วม", vehicle: "รถ 6 ล้อ", start: "", status: "ใช้งาน" },
  ];
  const out = vehicleUse(roster, rows, trips, all("2025-01-01", "2025-01-10"));
  const by = (p: string) => out.find((r) => r.v.plate === p)!;

  it("นับเที่ยวไม่ซ้ำ · วันไม่ซ้ำ · กม. เฉพาะที่รู้", () => {
    expect(by("A")).toMatchObject({ n: 3, km: 500, activeDays: 2, availDays: 10, pct: 20 });
  });
  it("ทุกคันในใบได้เที่ยวนั้น", () => expect(by("B")).toMatchObject({ n: 1, km: 300, activeDays: 1 }));
  it("รถในทะเบียนที่ไม่มีเที่ยว = 0%", () => expect(by("C").pct).toBe(0));
  it("ไม่รู้วันเริ่มใช้งาน = – และไม่นับในค่าเฉลี่ย", () => {
    expect(by("D").pct).toBeNull();
    expect(avgUse(out)).toBe(Math.round((20 + 10 + 0) / 3));
  });
  it("ระยะทางรวมนับใบไม่ซ้ำ และบอกจำนวนที่ไม่มีระยะทาง", () => {
    expect(totalKm(rows, trips)).toEqual({ km: 500, noKm: 1 });
  });
});
