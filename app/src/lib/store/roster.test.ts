import { describe, expect, it } from "vitest";
import { ACTIVE_VEHICLES } from "../refdata";
import { FLEET_BASE, vehiclesForKind } from "./roster";

const expectedByPair: Readonly<Record<string, number>> = {
  "รถบริษัท|รถ 10 ล้อตู้เย็น": 15,
  "รถบริษัท|รถ 10 ล้อตู้แห้ง": 7,
  "รถบริษัท|รถ 12 ล้อคอก": 8,
  "รถบริษัท|รถ 12 ล้อตู้เย็น": 23,
  "รถบริษัท|รถ 6 ล้อ(ตู้แห้ง)": 1,
  "รถบริษัท|รถ 6 ล้อใหญ่": 1,
  "รถบริษัท|รถเทรเลอร์": 22,
  "รถบริษัท|รถปิ๊กอัพตู้เย็น": 4,
  "รถบริษัท|หางพ่วงคอก": 41,
  "รถบริษัท|หางพ่วงตู้เย็น": 9,
  "รถบริษัท|หางพ่วงตู้แห้ง": 34,
  "รถร่วม|รถ 10 ล้อ": 47,
  "รถร่วม|รถ 10 ล้อตู้แห้ง": 29,
  "รถร่วม|รถ 10 ล้อยาว": 45,
  "รถร่วม|รถ 6 ล้อ FC4": 4,
  "รถร่วม|รถ 6 ล้อ(ตู้แห้ง)": 1,
  "รถร่วม|รถ 6 ล้อเล็ก": 1,
  "รถร่วม|รถ 6 ล้อใหญ่": 8,
  "รถร่วม|รถเทรเลอร์": 1,
  "รถร่วม|รถปิกอัพ 3 ตัน": 4,
};

describe("ตัวกรองทะเบียนในหน้ากรอกข้อมูล", () => {
  it("เริ่มต้นแสดงทะเบียนในกองรถครบ 274 คันและไม่มีทะเบียนซ้ำ", () => {
    const all = vehiclesForKind(FLEET_BASE, "", "");
    expect(all).toHaveLength(274);
    expect(new Set(all.map((f) => f.plate)).size).toBe(274);
  });

  it("เลือกประเภทรถแล้วได้จำนวนคันตามประวัติในกองรถ", () => {
    expect(vehiclesForKind(FLEET_BASE, "รถบริษัท", "")).toHaveLength(135);
    expect(vehiclesForKind(FLEET_BASE, "รถร่วม", "")).toHaveLength(140);
  });

  it("ไล่ทุกประเภทและทุกชนิดแล้วได้จำนวนทะเบียนตามกองรถ", () => {
    for (const fleetType of ["รถบริษัท", "รถร่วม"]) {
      for (const vehicle of ACTIVE_VEHICLES) {
        const key = `${fleetType}|${vehicle.name}`;
        const plates = vehiclesForKind(FLEET_BASE, fleetType, vehicle.name).map((f) => f.plate);
        expect(plates, key).toHaveLength(expectedByPair[key] ?? 0);
        expect(new Set(plates).size, `${key} มีทะเบียนซ้ำ`).toBe(plates.length);
      }
    }
  });

  it("ชนิดรถใหม่ยังไม่มีทะเบียนในประวัติกองรถ", () => {
    for (const vehicle of ["รถ 6 ล้อคอก", "หางเทรเลอร์"]) {
      expect(vehiclesForKind(FLEET_BASE, "", vehicle), vehicle).toHaveLength(0);
    }
  });
});
