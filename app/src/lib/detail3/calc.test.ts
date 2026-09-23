import { describe, expect, it } from "vitest";
import type { Trip } from "../data/useCostRev";
import { companyVsPartner, depByRoute, depreciation, kindSides, kindYearCost, overview, routeKindMatrix, vehicleRows } from "./calc";

const trip = (c: Partial<Trip> = {}): Trip => ({
  id: "1", d: "2025-01-05", mo: "2025-01", y: 2025, rt: "ก-ข", pl: "หัว", vk: "รถ 10 ล้อ", ft: "รถบริษัท",
  cost: 1000, rev: 3000, profit: 2000, dep: 100, km: 100, wt: 2, ...c,
} as Trip);

describe("รายละเอียด ข้อ 3", () => {
  it("แตกใบเป็นรายคัน ต้นทุน/ค่าเสื่อมตามคัน รายได้ตามสัดส่วนต้นทุน น้ำหนักกับระยะทางเต็มทุกคัน", () => {
    const rows = vehicleRows([trip({ vs: [
      { pl: "หัว", vk: "รถ 10 ล้อ", ft: "รถบริษัท", c: 800, d: 80 },
      { pl: "หาง", vk: "หางพ่วง", ft: "รถบริษัท", c: 200, d: 20 }] })]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ cost: 200, dep: 20, rev: 600, tkm: 200, perTkm: 1 });
    expect(rows[0]!.perTkm! + rows[1]!.perTkm!).toBe(1000 / 200);
  });
  it("ไฟล์รุ่นเก่าไม่มี vs/d ทั้งใบเป็นของคันแรก", () => {
    expect(vehicleRows([trip()])[0]).toMatchObject({ cost: 1000, dep: 100, rev: 3000 });
  });
  it("KPI ภาพรวมใช้ SUM÷SUM และไม่นับเที่ยวที่ไม่มีระยะทาง/น้ำหนักในตัวต่อกม./ตัน-กม.", () => {
    const o = overview([trip(), trip({ id: "2", cost: 500, km: null as unknown as number, wt: 0 })]);
    expect(o).toMatchObject({ cost: 1500, n: 2, perTrip: 750, perKm: 10, perTkm: 5, noKm: 1, noTkm: 1 });
  });
  it("ต้นทุนแต่ละชนิดรถแยกฝั่ง SUM÷SUM", () => {
    const rows = vehicleRows([trip(), trip({ id: "2", cost: 3000, km: 100 }), trip({ id: "3", ft: "รถร่วม", cost: 800 })]);
    const k = kindSides(rows)[0]!;
    expect(k.comp).toMatchObject({ n: 2, perTrip: 2000, perKm: 20 });
    expect(k.part).toMatchObject({ n: 1, perKm: 8 });
  });
  it("ตารางเส้นทาง × ชนิดรถ ใช้ค่าเฉลี่ยรายเที่ยว และ Flag เที่ยวที่เกิน 2 เท่าของค่าเฉลี่ยชนิดรถ", () => {
    const rows = vehicleRows([trip({ id: "1", cost: 200 }), trip({ id: "2", cost: 200 }), trip({ id: "3", cost: 200 }),
      trip({ id: "4", rt: "ค-ง", cost: 2000 })]);
    const m = routeKindMatrix(rows);
    expect(m.kindAvg.get("รถ 10 ล้อ")).toBeCloseTo((1 + 1 + 1 + 10) / 4);
    expect(m.routes.find((r) => r.rt === "ค-ง")!.cells["รถ 10 ล้อ"]).toMatchObject({ avg: 10, flag: true });
    expect(m.flagged.map((f) => f.row.id)).toEqual(["4"]);
    expect(m.cheapest).toHaveLength(1);   // ค-ง มีเที่ยวเดียว ไม่ติดอันดับ
    expect(m.cheapest[0]).toMatchObject({ rt: "ก-ข", avg: 1, n: 3 });
  });
  it("บริษัท vs ร่วม: ส่วนต่างเทียบกับรถร่วม และคำแนะนำตามเกณฑ์ 10%", () => {
    const rows = vehicleRows([trip({ cost: 1500 }), trip({ id: "2", ft: "รถร่วมนอกพิเศษ", cost: 1000 }),
      trip({ id: "3", vk: "รถ 6 ล้อ" })]);
    const out = companyVsPartner(rows);
    const ten = out.find((k) => k.vk === "รถ 10 ล้อ"), six = out.find((k) => k.vk === "รถ 6 ล้อ");
    expect(ten).toMatchObject({ vk: "รถ 10 ล้อ", compKm: 15, partKm: 10, diff: 50, advice: "part" });
    expect(six).toMatchObject({ vk: "รถ 6 ล้อ", advice: "only-comp", diff: null });
  });
  it("คุ้มค่าเสื่อม: Contribution = รายได้ − (ต้นทุน − ค่าเสื่อม) · coverage เฉลี่ยรวม = ΣContribution ÷ Σค่าเสื่อม", () => {
    const rows = vehicleRows([trip({ rev: 1100, cost: 1000, dep: 100 }), trip({ id: "2", rev: 1300, cost: 1000, dep: 100 }),
      trip({ id: "3", ft: "รถร่วม" }), trip({ id: "4", dep: 0 })]);
    const d = depreciation(rows);
    expect(d.list).toHaveLength(2);
    expect(d.noDep).toBe(1);
    expect(d.avgCoverage).toBe((200 + 400) / 200);
    expect(d.list[0]).toMatchObject({ vc: 900, contribution: 200, coverage: 2, status: "low" });
    expect(d.list[1]!.status).toBe("ok");
    expect(depByRoute(d.list, d.avgCoverage)[0]).toMatchObject({ n: 2, coverage: 3, below: false });
  });
  it("ต้นทุนชนิดรถปีล่าสุด เทียบบาท/ตัน-กม. ปีก่อน · ชนิดที่ปีก่อนไม่มี = null", () => {
    const rows = vehicleRows([trip({ y: 2024, cost: 1000 }), trip({ id: "2", y: 2025, cost: 1200 }),
      trip({ id: "3", y: 2025, vk: "รถ 6 ล้อ", cost: 500 }), trip({ id: "4", y: 2023, cost: 9 })]);
    const k = kindYearCost(rows);
    expect(k).toMatchObject({ year: 2025, prev: 2024 });
    expect(k.list.find((r) => r.vk === "รถ 10 ล้อ")).toMatchObject({ n: 1, perTrip: 1200, perKm: 12, perTkm: 6, prevPerTkm: 5 });
    expect(k.list.find((r) => r.vk === "รถ 10 ล้อ")!.change).toBeCloseTo(20);
    expect(k.list.find((r) => r.vk === "รถ 6 ล้อ")!.change).toBeNull();
  });
});
