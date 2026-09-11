/**
 * เทสต์การนำอัตราที่คำนวณได้ไปใส่ตารางค่าซ่อม
 *
 * จุดตายคือการแปลงปี — ไฟล์ฐานเก็บเป็นเลขสองหลักของ ค.ศ. ("24") ส่วนข้อมูลที่
 * ผู้ใช้วางเป็น พ.ศ. (2567) ถ้าจับคู่ช่องผิดปี อัตราจะไปลงคอลัมน์ผิดโดยไม่มีอะไรฟ้อง
 */
import { describe, expect, it } from "vitest";

import { BASE_YEARS, planApply } from "./apply";
import { computeRates } from "./rates";
import { REF } from "../refdata";

const result = (over: Partial<Parameters<typeof planApply>[0]> = {}) => ({
  years: [2567],
  vehicles: [{ vehicle: "รถ 6 ล้อใหญ่", time: { 2567: 12.5 }, dist: { 2567: 0.25 }, fleets: ["รถบริษัท"] }],
  weights: {},
  mergedTrailer: {},
  warnings: [],
  ...over,
});

describe("BASE_YEARS", () => {
  it("แปลงปีในไฟล์ฐานเป็น พ.ศ. ตามกฎ 2000 + y + 543", () => {
    expect(REF.repair.years).toEqual(["24", "25", "26"]);
    expect(BASE_YEARS).toEqual([2567, 2568, 2569]);
  });
});

describe("planApply", () => {
  it("ลงอัตราในช่องของปีที่ถูกต้อง และไม่แตะช่องปีอื่น", () => {
    const p = planApply(result(), undefined);

    expect(p.repair.time?.["รถบริษัท"]?.["รถ 6 ล้อใหญ่"]).toEqual([12.5, null, null]);
    expect(p.repair.dist?.["รถ 6 ล้อใหญ่"]).toEqual([0.25, null, null]);
    expect(p.cells).toBe(2);
  });

  it("ลงอัตราตามเวลาเฉพาะแท็บที่ไฟล์บอกมา", () => {
    const p = planApply(result(), undefined);

    expect(p.repair.time?.["รถบริษัท"]?.["รถ 6 ล้อใหญ่"]).toBeDefined();
    expect(p.repair.time?.["รถร่วม"]?.["รถ 6 ล้อใหญ่"]).toBeUndefined();
  });

  it("ไม่มีคอลัมน์ประเภทรถ = ลงให้ทั้งสองแท็บ", () => {
    const r = result({
      vehicles: [{ vehicle: "รถ 6 ล้อใหญ่", time: { 2567: 12.5 }, dist: {}, fleets: [] }],
    });
    const p = planApply(r, undefined);

    expect(p.repair.time?.["รถบริษัท"]?.["รถ 6 ล้อใหญ่"]).toEqual([12.5, null, null]);
    expect(p.repair.time?.["รถร่วม"]?.["รถ 6 ล้อใหญ่"]).toEqual([12.5, null, null]);
  });

  it("คงค่าที่ผู้ใช้แก้เองไว้ในปีที่ไม่ได้นำเข้า", () => {
    const cur = { dist: { "รถ 6 ล้อใหญ่": [9, 8, 7] as (number | null)[] } };
    const p = planApply(result(), cur);

    // ปี 2567 ถูกทับด้วยค่าใหม่ อีกสองปีต้องคงของเดิม
    expect(p.repair.dist?.["รถ 6 ล้อใหญ่"]).toEqual([0.25, 8, 7]);
  });

  it("ข้ามปีที่ตารางไม่มีช่องรองรับ พร้อมเตือน", () => {
    const r = result({
      years: [2566, 2567],
      vehicles: [{ vehicle: "รถ 6 ล้อใหญ่", time: { 2566: 99, 2567: 12.5 }, dist: {}, fleets: ["รถบริษัท"] }],
    });
    const p = planApply(r, undefined);

    expect(p.repair.time?.["รถบริษัท"]?.["รถ 6 ล้อใหญ่"]).toEqual([12.5, null, null]);
    expect(p.skippedYears).toEqual([2566]);
    expect(p.warnings.join(" ")).toMatch(/2566/);
  });

  it("นำน้ำหนักถ่วงจากตารางที่ 3 มาใช้ตามลำดับปีของตาราง", () => {
    const p = planApply(result({ weights: { 2567: 0.1, 2568: 0.3, 2569: 0.6 } }), undefined);
    expect(p.repair.weights).toEqual([0.1, 0.3, 0.6]);
  });

  it("ปิดการใช้น้ำหนักแล้วต้องไม่แตะน้ำหนักเดิม", () => {
    const p = planApply(result({ weights: { 2567: 0.1 } }), undefined, { useWeights: false });
    expect(p.repair.weights).toBeUndefined();
  });

  it("เตือนเมื่อชนิดรถไม่มีรถคันไหนในระบบชี้มาใช้", () => {
    const r = result({
      vehicles: [{ vehicle: "รถแปลกประหลาด", time: { 2567: 1 }, dist: {}, fleets: ["รถบริษัท"] }],
    });
    const p = planApply(r, undefined);

    expect(p.unusedVehicles).toEqual(["รถแปลกประหลาด"]);
    expect(p.warnings.join(" ")).toMatch(/ไม่มีรถคันไหนในระบบชี้มาใช้/);
  });

  it("ชนิดรถที่ระบบใช้จริงต้องไม่ถูกเตือน", () => {
    const p = planApply(result(), undefined);
    expect(p.unusedVehicles).toEqual([]);
  });

  it("ไหลครบตั้งแต่ข้อมูลดิบจนถึงค่าที่จะเขียน", () => {
    const rates = computeRates(
      [
        { year: 2567, vehicle: "รถ 12 ล้อคอก", account: "", detail: "ค่าต่อภาษี", amount: 5000 },
        { year: 2567, vehicle: "รถ 12 ล้อคอก", account: "", detail: "เปลี่ยนยาง", amount: 60_000 },
      ],
      [{ year: 2567, vehicle: "รถ 12 ล้อคอก", fleet: "รถบริษัท", km: 200_000, days: 250 }],
      [{ year: 2567, weight: 0.2 }, { year: 2568, weight: 0.3 }, { year: 2569, weight: 0.5 }],
    );
    const p = planApply(rates, undefined);

    expect(p.repair.time?.["รถบริษัท"]?.["รถ 12 ล้อคอก"]?.[0]).toBeCloseTo(5000 / 250);
    expect(p.repair.dist?.["รถ 12 ล้อคอก"]?.[0]).toBeCloseTo(60_000 / 200_000);
    expect(p.repair.weights).toEqual([0.2, 0.3, 0.5]);
  });
});
