import { describe, expect, it } from "vitest";
import { emptyRecord } from "./emptyRecord";
import { changeVehicle } from "./EntryForm";

describe("changeVehicle", () => {
  it("เคลียร์ทะเบียนและเติมน้ำหนักสูงสุดใหม่เมื่อเปลี่ยนชนิดรถ", () => {
    const rec = {
      ...emptyRecord(),
      vehicle: "รถ 10 ล้อ",
      plate: "ชม.70-1234",
      capacity: 12000,
    };

    const next = changeVehicle(rec, "รถ 6 ล้อใหญ่", 7000);

    expect(next.vehicle).toBe("รถ 6 ล้อใหญ่");
    expect(next.plate).toBe("");
    expect(next.capacity).toBe(7000);
    expect(rec.plate).toBe("ชม.70-1234");
  });

  it("คงน้ำหนักเดิมไว้หากชนิดรถนั้นไม่มีสเปก", () => {
    const rec = { ...emptyRecord(), plate: "ชม.70-1234", capacity: 9000 };
    const next = changeVehicle(rec, "ชนิดในใบเก่า", undefined);

    expect(next.plate).toBe("");
    expect(next.capacity).toBe(9000);
  });
});
