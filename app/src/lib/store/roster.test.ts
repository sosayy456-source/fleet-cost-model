import { describe, expect, it } from "vitest";
import { ACTIVE_VEHICLES, costFleetType } from "../refdata";
import { FLEET_BASE, filterRoster, vehiclesForKind } from "./roster";

/**
 * จำนวนทะเบียนตามไฟล์ทะเบียนในกองรถรุ่น 24 ก.ย. 2569 (899 คัน รวมรถร่วมนอกพิเศษ)
 * ★ ตัวเลขฝั่ง "รถร่วม" รวมรถร่วมนอกพิเศษด้วย เพราะฟอร์มเลือกได้แค่สองฝั่งของตารางต้นทุน
 *   และรถร่วมนอกพิเศษคิดต้นทุนแบบรถร่วม (costFleetType · เจ้าของงานเคาะ 24 ก.ย. 2569)
 * ถ้าวางไฟล์ทะเบียนใหม่แล้วรัน build_fleet.py ตัวเลขชุดนี้ต้องอัปเดตตามข้อมูล
 */
const expectedByPair: Readonly<Record<string, number>> = {
  "รถบริษัท|รถ 10 ล้อตู้เย็น": 15,
  "รถบริษัท|รถ 10 ล้อตู้แห้ง": 8,
  "รถบริษัท|รถ 12 ล้อคอก": 8,
  "รถบริษัท|รถ 12 ล้อตู้เย็น": 23,
  "รถบริษัท|รถ 6 ล้อ(ตู้แห้ง)": 1,
  "รถบริษัท|รถ 6 ล้อใหญ่": 1,
  "รถบริษัท|รถเทรเลอร์": 24,
  "รถบริษัท|รถปิ๊กอัพตู้เย็น": 4,
  "รถบริษัท|หางพ่วงคอก": 41,
  "รถบริษัท|หางพ่วงตู้เย็น": 9,
  "รถบริษัท|หางพ่วงตู้แห้ง": 34,
  "รถร่วม|รถ 10 ล้อ": 73,
  "รถร่วม|รถ 10 ล้อตู้แห้ง": 34,
  "รถร่วม|รถ 10 ล้อยาว": 45,
  "รถร่วม|รถ 10 ล้อพ่วง(แม่)": 235,
  "รถร่วม|รถ 12 ล้อคอก": 1,
  "รถร่วม|รถ 6 ล้อ FC4": 4,
  "รถร่วม|รถ 6 ล้อ(ตู้แห้ง)": 7,
  "รถร่วม|รถ 6 ล้อเล็ก": 1,
  "รถร่วม|รถ 6 ล้อใหญ่": 27,
  "รถร่วม|รถเทรเลอร์": 72,
  "รถร่วม|รถปิกอัพ 3 ตัน": 22,
  "รถร่วม|หางพ่วงคอก": 235,
  "รถร่วม|หางพ่วงตู้แห้ง": 8,
};

describe("ตัวกรองทะเบียนในหน้ากรอกข้อมูล", () => {
  it("เริ่มต้นแสดงทะเบียนในกองรถครบ 899 คันและไม่มีทะเบียนซ้ำ", () => {
    const all = vehiclesForKind(FLEET_BASE, "", "");
    expect(all).toHaveLength(899);
    expect(new Set(all.map((f) => f.plate)).size).toBe(899);
  });

  it("เลือกประเภทรถแล้วได้จำนวนคันตามประวัติในกองรถ", () => {
    expect(vehiclesForKind(FLEET_BASE, "รถบริษัท", "")).toHaveLength(137);
    // รถร่วม 152 คัน + รถร่วมนอกพิเศษ 611 คัน (บางคันเคยวิ่งทั้งสองประเภท จึงไม่ใช่ผลบวกตรง ๆ)
    expect(vehiclesForKind(FLEET_BASE, "รถร่วม", "")).toHaveLength(763);
  });

  it("เลือกรถร่วมแล้วเห็นรถร่วมนอกพิเศษด้วย (คิดต้นทุนแบบรถร่วม)", () => {
    const outside = FLEET_BASE.filter((f) => f.fleetType === "รถร่วมนอกพิเศษ");
    expect(outside.length).toBeGreaterThan(0);
    const partner = new Set(vehiclesForKind(FLEET_BASE, "รถร่วม", "").map((f) => f.plate));
    for (const f of outside) expect(partner.has(f.plate), f.plate).toBe(true);
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

  it("ทุกคันในทะเบียนใช้ชื่อชนิดรถที่มีในหน้าตั้งค่า (ชื่อในไฟล์แมปครบแล้ว)", () => {
    const names = new Set(ACTIVE_VEHICLES.map((v) => v.name));
    for (const f of FLEET_BASE) for (const k of f.kinds ?? []) expect(names.has(k.vehicle), `${f.plate} ${k.vehicle}`).toBe(true);
  });
});

describe("costFleetType — ประเภทรถสำหรับคิดต้นทุน", () => {
  it("รถร่วมนอกพิเศษคิดต้นทุนแบบรถร่วม", () => expect(costFleetType("รถร่วมนอกพิเศษ")).toBe("รถร่วม"));
  it("สองฝั่งเดิมคงเดิม", () => {
    expect(costFleetType("รถบริษัท")).toBe("รถบริษัท");
    expect(costFleetType("รถร่วม")).toBe("รถร่วม");
  });
  it("ไม่รู้จัก = ว่าง (ไม่เดาฝั่ง)", () => {
    expect(costFleetType("")).toBe("");
    expect(costFleetType("-")).toBe("");
  });
});

describe("filterRoster — ตัวกรองเลือกรถของหน้าจัดรถ", () => {
  const roster = [
    { plate: "ชม.70-0820", fleetType: "รถร่วม", vehicle: "รถ 10 ล้อ", start: "", status: "ใช้งาน" },
    { plate: "ชม.71-1815", fleetType: "รถร่วมนอกพิเศษ", vehicle: "รถ 10 ล้อ", start: "", status: "ใช้งาน" },
    { plate: "กทม.3ฒญ437", fleetType: "รถบริษัท", vehicle: "รถปิ๊กอัพตู้เย็น", start: "", status: "ใช้งาน",
      kinds: [{ fleetType: "รถบริษัท", vehicle: "รถปิ๊กอัพตู้เย็น", trips: 5 }, { fleetType: "รถบริษัท", vehicle: "รถ 6 ล้อเล็ก", trips: 1 }] },
  ];
  const plates = (f: Parameters<typeof filterRoster>[1]) => filterRoster(roster, f).map((v) => v.plate);

  it("ไม่กรอง = ทุกคัน", () => expect(plates({})).toHaveLength(3));
  it("เลือกรถร่วมได้รถร่วมเท่านั้น ไม่รวมรถร่วมนอกพิเศษ (ต่างจากฟอร์ม)", () => {
    expect(plates({ fleetType: "รถร่วม" })).toEqual(["ชม.70-0820"]);
    expect(plates({ fleetType: "รถร่วมนอกพิเศษ" })).toEqual(["ชม.71-1815"]);
  });
  it("ชนิดรถดูทุกชนิดที่คันนั้นเคยวิ่ง", () => expect(plates({ vehicle: "รถ 6 ล้อเล็ก" })).toEqual(["กทม.3ฒญ437"]));
  it("ค้นหาด้วยเลขท้าย / ไม่ใส่ขีด / มีช่องว่างก็เจอ", () => {
    expect(plates({ q: "1815" })).toEqual(["ชม.71-1815"]);
    expect(plates({ q: "ชม 700820" })).toEqual(["ชม.70-0820"]);
  });
  it("ตัวกรองทุกตัวใช้ร่วมกัน", () => expect(plates({ fleetType: "รถร่วม", q: "1815" })).toEqual([]));
});
