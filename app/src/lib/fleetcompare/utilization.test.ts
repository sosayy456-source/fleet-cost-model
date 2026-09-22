import { describe, expect, it } from "vitest";
import { fleetDistribution, fleetGroups, fleetKinds, fleetKpis, fleetRanking, fleetSlices, UNKNOWN_SERVICE, type FleetSlice } from "./utilization";
import type { Trip } from "../data/useCostRev";

const row = (changes: Partial<FleetSlice> = {}): FleetSlice => ({
  id: "001", mo: "2025-01", ft: "รถบริษัท", vk: "รถ 10 ล้อ", pl: "รถหนึ่ง", rt: "ก-ข",
  service: "แช่เย็น", rev: 600, cost: 400, profit: 200, ...changes,
});

describe("การใช้ประโยชน์กองรถ", () => {
  it("ยึดรายได้ไฟล์ต้นทุนแม้บิลรวมไม่เท่ากันและคงกำไรรวม", () => {
    const trip = { ...row(), rev: 10000, cost: 6000, profit: 4000,
      serviceRevenue: { แช่เย็น: 6000, ทั่วไป: 2000 } } as unknown as Trip;
    const result = fleetSlices([trip]);
    expect(result.find((r) => r.service === "แช่เย็น")).toMatchObject({ rev: 7500, cost: 4500, profit: 3000 });
    expect(result.find((r) => r.service === "ทั่วไป")).toMatchObject({ rev: 2500, cost: 1500, profit: 1000 });
    expect(fleetGroups(result, () => "ทั้งหมด")[0]).toMatchObject({ rev: 10000, cost: 6000, profit: 4000, n: 1 });
  });
  it("คงยอดสตางค์และไม่โยนเศษให้กลุ่มรายได้ศูนย์", () => {
    const trip = { ...row(), rev: 0.02, cost: 0.01, serviceRevenue: { ก: 1, ข: 1, ค: 1, ง: 0 } } as unknown as Trip;
    const result = fleetSlices([trip]);
    expect(result.reduce((s, r) => s + Math.round(r.rev * 100), 0)).toBe(2);
    expect(result.reduce((s, r) => s + Math.round(r.cost * 100), 0)).toBe(1);
    expect(result.find((r) => r.service === "ง")).toMatchObject({ rev: 0, cost: 0 });
  });
  it("ข้อมูลเก่าและยอดที่แบ่งไม่ได้คงไว้ในกลุ่มไม่ระบุ ไม่เดาจาก sg เดิม", () => {
    for (const serviceRevenue of [undefined, {}, { ก: 0 }, { ก: -1, ข: 2 }]) {
      const result = fleetSlices([{ ...row(), sg: "ชื่อเดิม", serviceRevenue } as unknown as Trip]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ service: UNKNOWN_SERVICE, rev: 600, cost: 400 });
    }
  });
  it("หลายกลุ่มยอดเล็กไม่ทำให้ส่วนท้ายติดลบจากการปัดเศษ", () => {
    const trip = { ...row(), rev: 0.03, cost: 0.02, serviceRevenue: { ก: 1, ข: 1, ค: 1, ง: 1, จ: 1 } } as unknown as Trip;
    const rows = fleetSlices([trip]);
    expect(rows.every((r) => r.rev >= 0 && r.cost >= 0)).toBe(true);
    expect(fleetGroups(rows, () => "รวม")[0]).toMatchObject({ rev: 0.03, cost: 0.02, profit: 0.01 });
  });
  it("ใบที่มีหลายทะเบียนแบ่งยอดตามสัดส่วนต้นทุนของแต่ละคัน และคงยอดรวมของใบ", () => {
    const trip = { ...row(), rev: 10000, cost: 5000, profit: 5000, serviceRevenue: { แช่เย็น: 1 },
      vs: [{ pl: "หัว", vk: "รถเทรเล่อร์ (แม่)", ft: "รถบริษัท", c: 4000 },
           { pl: "หาง", vk: "หางเทรเลอร์", ft: "รถร่วม", c: 1000 }] } as unknown as Trip;
    const rows = fleetSlices([trip]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.pl === "หัว")).toMatchObject({ vk: "รถเทรเล่อร์ (แม่)", ft: "รถบริษัท", rev: 8000, cost: 4000 });
    expect(rows.find((r) => r.pl === "หาง")).toMatchObject({ vk: "หางเทรเลอร์", ft: "รถร่วม", rev: 2000, cost: 1000 });
    // ยอดรวมและจำนวนใบไม่เปลี่ยน แต่นับเป็นสองคัน
    expect(fleetGroups(rows, () => "ทั้งหมด")[0]).toMatchObject({ n: 1, vehicles: 2, rev: 10000, cost: 5000, profit: 5000 });
  });
  it("แบ่งรถแล้วยังแบ่งกลุ่มบริการต่อ และคงยอดสตางค์", () => {
    const trip = { ...row(), rev: 0.03, cost: 0.02, serviceRevenue: { ก: 1, ข: 2 },
      vs: [{ pl: "หัว", vk: "ก", ft: "รถบริษัท", c: 0.01 }, { pl: "หาง", vk: "ข", ft: "รถบริษัท", c: 0.01 }] } as unknown as Trip;
    const rows = fleetSlices([trip]);
    expect(rows.every((r) => r.rev >= 0 && r.cost >= 0)).toBe(true);
    expect(fleetGroups(rows, () => "รวม")[0]).toMatchObject({ rev: 0.03, cost: 0.02, profit: 0.01 });
  });
  it("ไฟล์รุ่นเก่าที่ไม่มี vs ยังนับเป็นทะเบียนเดียวเหมือนเดิม", () => {
    const trip = { ...row(), rev: 10000, cost: 6000, serviceRevenue: { แช่เย็น: 1 } } as unknown as Trip;
    const rows = fleetSlices([trip]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pl: "รถหนึ่ง", vk: "รถ 10 ล้อ", rev: 10000, cost: 6000 });
  });
  it("ต้นทุนรายคันเป็นศูนย์ทั้งใบ ไม่แบ่ง ยกทั้งใบให้คันแรก", () => {
    const trip = { ...row(), rev: 500, cost: 0, serviceRevenue: { แช่เย็น: 1 },
      vs: [{ pl: "หัว", vk: "ก", ft: "รถบริษัท", c: 0 }, { pl: "หาง", vk: "ข", ft: "รถบริษัท", c: 0 }] } as unknown as Trip;
    const rows = fleetSlices([trip]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pl: "หัว", rev: 500, cost: 0 });
  });
  it("นับใบและรถไม่ซ้ำเมื่อเที่ยวเดียวมีสองกลุ่มบริการ", () => {
    const rows = [row(), row({ service: "ทั่วไป", rev: 300, cost: 200, profit: 100 })];
    const total = fleetGroups(rows, () => "ทั้งหมด")[0];
    expect(total).toMatchObject({ n: 1, vehicles: 1, rev: 900, cost: 600, profit: 300 });
    expect(fleetKpis(rows)).toMatchObject({ n: 1, vehicles: 1, turnover: 1, profitPerVehicle: 300 });
  });
  it("นับเที่ยวที่ขาดทุนจากกำไรรวมของใบ ไม่ใช่จำนวนส่วนที่ปัน", () => {
    const rows = [row({ rev: 0, cost: 100 }), row({ rev: 500, cost: 100, service: "ทั่วไป" })];
    expect(fleetKpis(rows).lossPct).toBe(0);
  });
  it("รถขาดทุนหลายเดือนนับคันเดียวและไม่หักล้างกับเดือนที่กำไร", () => {
    const rows = [row({ rev: 0 }), row({ id: "002", mo: "2025-02", rev: 1000 }),
      row({ id: "003", mo: "2025-03", rev: 0 })];
    expect(fleetKpis(rows).lossVehicles).toBe(1);
  });
  it("จัดอันดับชนิดรถรวมทะเบียนและเก็บมากกว่า 10 อันดับไว้ดูต่อได้", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ id: String(i), pl: String(i), vk: `ชนิด${i}` }));
    rows.push(row({ id: "ใหม่", pl: "อีกคัน", vk: "ชนิด0" }));
    expect(fleetKinds(rows)).toHaveLength(12);
    expect(fleetKinds(rows)[0]).toMatchObject({ key: "ชนิด0", n: 2, vehicles: 2 });
  });
  it("อันดับกำไรรวมกลุ่มขาดทุนและไม่ตัดทิ้งหลังอันดับห้า", () => {
    const rows = Array.from({ length: 7 }, (_, i) => row({ id: String(i), rt: String(i), rev: i * 100 }));
    const ranked = fleetRanking(rows, "trip");
    expect(ranked).toHaveLength(7);
    expect(ranked[0]!.value).toBe(200);
    expect(ranked[6]!.value).toBe(-400);
  });
  it("กำไรต่อคันใช้ทะเบียนไม่ซ้ำภายในกลุ่ม", () => {
    const rows = [row(), row({ id: "002" }), row({ id: "003", pl: "รถสอง" })];
    expect(fleetRanking(rows, "vehicle")[0]).toMatchObject({ n: 3, vehicles: 2, value: 300 });
  });
  it("สัดส่วนแต่ละบริการนับเที่ยวของชนิดรถไม่ซ้ำ", () => {
    const rows = [row(), row({ rev: 100 }), row({ id: "002", vk: "รถ 6 ล้อ" }),
      row({ service: "ทั่วไป" })];
    const groups = fleetDistribution(rows);
    const cold = groups.find((g) => g.service === "แช่เย็น")!;
    expect(cold.n).toBe(2);
    expect(cold.kinds.map((g) => g.n)).toEqual([1, 1]);
    expect(groups.find((g) => g.service === "ทั่วไป")?.n).toBe(1);
  });
  it("ข้อมูลว่างหรือไม่มีทะเบียนไม่ทำให้เกิด NaN หรือคันสมมติ", () => {
    expect(fleetKpis([])).toMatchObject({ n: 0, vehicles: 0, turnover: 0, lossPct: 0 });
    expect(fleetKpis([row({ pl: "" })])).toMatchObject({ vehicles: 0, profitPerVehicle: 0 });
  });
});
