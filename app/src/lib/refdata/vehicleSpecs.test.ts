import { describe, expect, it } from "vitest";
import type { Vehicle } from "../cost/types";
import { ACTIVE_VEHICLES, canonicalVehicleName } from ".";
import { vehicleSpec } from "./vehicleSpecs";

const vehicle: Vehicle = {
  name: "รถทดสอบ",
  litrePerKm: 0.25,
  volumeM3: 30,
  capacityKg: 12000,
  repairKey: "รถทดสอบ",
};

describe("vehicleSpec", () => {
  it("ใช้ปริมาตรและน้ำหนักจากค่าพื้นฐาน", () => {
    expect(vehicleSpec(vehicle)).toEqual({ volumeM3: 30, capacityKg: 12000 });
  });

  it("ใช้ค่าที่แก้เองทับค่าพื้นฐาน", () => {
    const result = vehicleSpec(vehicle, {
      รถทดสอบ: { volumeM3: 36, capacityKg: 13000 },
    });
    expect(result).toEqual({ volumeM3: 36, capacityKg: 13000 });
  });

  it("ไม่ใช้ค่าศูนย์หรือติดลบจากค่าที่แก้เอง", () => {
    const result = vehicleSpec(vehicle, {
      รถทดสอบ: { volumeM3: -1, capacityKg: 0 },
    });
    expect(result?.volumeM3).toBe(30);
    expect(result?.capacityKg).toBe(12000);
  });
});

describe("ค่าเริ่มต้นชนิดรถ", () => {
  const expected = [
    ["รถ 10 ล้อ", 45, 12000],
    ["รถ 10 ล้อตู้เย็น", 45, 12000],
    ["รถ 10 ล้อตู้แห้ง", 45, 12000],
    ["รถ 10 ล้อยาว", 45, 12000],
    ["รถ 10 ล้อพ่วง(แม่)", 45, 12000],   // ชนิดใหม่จากไฟล์ทะเบียน 24 ก.ย. 2569 (ค่าเริ่มต้นยืมจากรถ 10 ล้อ)
    ["รถ 12 ล้อคอก", 34, 15000],
    ["รถ 12 ล้อตู้เย็น", 34, 15000],
    ["รถ 6 ล้อ FC4", 26, 7000],
    ["รถ 6 ล้อ(ตู้แห้ง)", 26, 7000],
    ["รถ 6 ล้อเล็ก", 20, 5000],
    ["รถ 6 ล้อคอก", 24, 7000],
    ["รถ 6 ล้อใหญ่", 26, 7000],
    ["รถเทรเลอร์", 57, 15000],
    ["หางเทรเลอร์", 34, 25000],
    ["รถปิกอัพ 3 ตัน", 5, 3000],
    ["รถปิ๊กอัพตู้เย็น", 5, 3000],
    ["หางพ่วงคอก", 34, 12000],
    ["หางพ่วงตู้เย็น", 34, 12000],
    ["หางพ่วงตู้แห้ง", 34, 12000],
  ] as const;

  it("แสดง 19 ชนิดตามลำดับ พร้อมปริมาตรและน้ำหนักหน่วยกิโลกรัม", () => {
    expect(ACTIVE_VEHICLES.map((v) => [v.name, v.volumeM3, v.capacityKg])).toEqual(expected);
  });

  it("ไม่มีฟิลด์กว้าง ยาว สูงในข้อมูลรถ", () => {
    for (const vehicle of ACTIVE_VEHICLES) {
      expect(vehicle).not.toHaveProperty("cargoWidthM");
      expect(vehicle).not.toHaveProperty("cargoLengthM");
      expect(vehicle).not.toHaveProperty("cargoHeightM");
    }
  });

  it("แปลงชื่อที่เคยทดลองเปลี่ยนกลับเป็นชื่อเดิมจากกองรถ", () => {
    expect(canonicalVehicleName("รถเทรเล่อร์ (แม่)")).toBe("รถเทรเลอร์");
    expect(canonicalVehicleName("รถ 10 ล้อช่วงยาว")).toBe("รถ 10 ล้อยาว");
  });
});
