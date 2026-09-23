import { describe, expect, it } from "vitest";
import { fleetGroups, fleetKpis, fleetSlices, fleetTypeShare, routeServiceKindTable, routeUsage, serviceFleetMix, UNKNOWN_SERVICE, type FleetSlice } from "./utilization";
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
  it("สัดส่วนประเภทรถนับใบไม่ซ้ำต่อประเภท ใบที่มีสองฝั่งนับทั้งสองและร้อยละรวมได้ 100", () => {
    const rows = [row(), row({ service: "ทั่วไป" }), row({ pl: "หาง", ft: "รถร่วม" }),
      row({ id: "002", ft: "รถร่วมนอกพิเศษ" })];
    const s = fleetTypeShare(rows);
    expect(s.map((r) => [r.key, r.n])).toEqual([["รถบริษัท", 1], ["รถร่วม", 1], ["รถร่วมนอกพิเศษ", 1]]);
    expect(s.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(100);
  });
  it("สัดส่วนประเภทรถแยกกลุ่มบริการ บอกประเภทที่ใช้เป็นหลัก และเรียงกลุ่มเล็กไว้ก่อน", () => {
    const rows = [row(), row({ id: "002" }), row({ id: "003", ft: "รถร่วม" }), row({ id: "004", service: "แช่แข็ง", ft: "รถร่วม" })];
    const mix = serviceFleetMix(rows);
    expect(mix.map((g) => g.service)).toEqual(["แช่แข็ง", "แช่เย็น"]);
    expect(mix[1]).toMatchObject({ n: 3, main: "รถบริษัท" });
    expect(mix[1]!.types[0]!.share).toBeCloseTo(200 / 3);
  });
  it("เส้นทางเรียงตามเที่ยวไม่ซ้ำ พร้อมสัดส่วนชนิดรถ", () => {
    const rows = [row(), row({ service: "ทั่วไป" }), row({ id: "002", vk: "รถ 6 ล้อ" }), row({ id: "003", rt: "ค-ง" })];
    const r = routeUsage(rows);
    expect(r.map((x) => [x.rt, x.n])).toEqual([["ก-ข", 2], ["ค-ง", 1]]);
    expect(r[0]!.kinds.map((k) => k.n)).toEqual([1, 1]);
  });
  it("ตารางสรุปแนะนำฝั่งที่ Margin สูงกว่า และรวมรถร่วมนอกพิเศษเป็นฝั่งรถร่วม", () => {
    const rows = [row({ rev: 1000, profit: 500 }), row({ id: "002", ft: "รถร่วม", rev: 1000, profit: 100 }),
      row({ id: "003", ft: "รถร่วมนอกพิเศษ", rev: 1000, profit: 100 })];
    const [t] = routeServiceKindTable(rows);
    expect(t).toMatchObject({ n: 3, compN: 1, partN: 2, compMargin: 50, partMargin: 10, advice: "comp" });
    expect(t!.compShare).toBeCloseTo(100 / 3);
  });
  it("ตารางสรุปฝั่งเดียวไม่เดาค่าอีกฝั่ง", () => {
    const [t] = routeServiceKindTable([row({ ft: "รถร่วม" })]);
    expect(t).toMatchObject({ compN: 0, compMargin: null, advice: "only-part", partShare: 100 });
  });
  it("ข้อมูลว่างหรือไม่มีทะเบียนไม่ทำให้เกิด NaN หรือคันสมมติ", () => {
    expect(fleetKpis([])).toMatchObject({ n: 0, vehicles: 0, turnover: 0, lossPct: 0 });
    expect(fleetKpis([row({ pl: "" })])).toMatchObject({ vehicles: 0, profitPerVehicle: 0 });
  });
});
