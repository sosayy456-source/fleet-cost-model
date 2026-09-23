import { describe, expect, it } from "vitest";
import type { Trip } from "../data/useCostRev";
import { monthsOfMaint, opsFromTrips } from "./fromTrips";

/** เที่ยวจำลอง — ใส่เฉพาะฟิลด์ที่ใช้ */
const trip = (p: Partial<Trip>): Trip => ({
  id: "1", d: "2025-03-01", mo: "2025-03", y: 2025, ft: "รถบริษัท", vk: "รถ 10 ล้อ", pl: "ชม.1", km: 700,
  ...p,
} as Trip);

describe("ตัวหารค่าซ่อมจากไฟล์ต้นทุน", () => {
  it("ระยะทางรวม · วันออกวิ่ง = (ทะเบียน, วันที่) ไม่ซ้ำ · ปีเป็น พ.ศ.", () => {
    const r = opsFromTrips([
      trip({ id: "1" }),
      trip({ id: "2", km: 300 }),                            // ทะเบียนเดิม วันเดิม → ไม่นับวันเพิ่ม
      trip({ id: "3", d: "2025-03-02", km: null }),         // ไม่มีระยะทาง วันยังนับ
    ]);
    expect(r.rows).toEqual([{ year: 2568, vehicle: "รถ 10 ล้อ", fleet: "รถบริษัท", km: 1000, days: 2 }]);
    expect(r.noKm).toBe(1);
    expect(r.years).toEqual([2568]);
    expect(r.months).toEqual({ 2568: 1 });
  });

  it("ตัวหารใช้เฉพาะเดือนที่มีในรายงานค่าซ่อม — รายงานเดือนมกราคม หารด้วยเที่ยวเดือนมกราคมเท่านั้น", () => {
    const trips = [trip({ d: "2025-01-05", mo: "2025-01" }), trip({ d: "2025-02-05", mo: "2025-02", km: 999 })];
    const months = monthsOfMaint([{ year: 2568, month: 1 }]);
    const r = opsFromTrips(trips, { months });
    expect(r.rows).toEqual([{ year: 2568, vehicle: "รถ 10 ล้อ", fleet: "รถบริษัท", km: 700, days: 1 }]);
    // ปีที่มีบางบรรทัดไม่บอกเดือน ใช้ทั้งปี
    expect(monthsOfMaint([{ year: 2568, month: 1 }, { year: 2568, month: null }]).has(2568)).toBe(false);
  });

  it("รถร่วมนอกพิเศษรวมเข้าฝั่งรถร่วม", () => {
    const r = opsFromTrips([trip({ ft: "รถร่วม" }), trip({ ft: "รถร่วมนอกพิเศษ", pl: "ชม.2" })]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ fleet: "รถร่วม", km: 1400, days: 2 });
  });

  it("ใบที่มีหลายคันนับทุกคัน — หางเทรลเลอร์ข้ามเมื่อยุบเข้าหัวลาก ไม่งั้นระยะทางหัวลากเบิ้ล", () => {
    const t = trip({
      vk: "รถเทรเล่อร์ (แม่)",
      vs: [{ pl: "หัว", vk: "รถเทรเล่อร์ (แม่)", ft: "รถบริษัท", c: 1 }, { pl: "หาง", vk: "หางเทรลเลอร์", ft: "รถบริษัท", c: 1 }],
    });
    expect(opsFromTrips([t], { mergeTrailer: true }).rows.map((r) => r.vehicle)).toEqual(["รถเทรเล่อร์ (แม่)"]);
    expect(opsFromTrips([t], { mergeTrailer: false }).rows.map((r) => r.vehicle).sort())
      .toEqual(["รถเทรเล่อร์ (แม่)", "หางเทรลเลอร์"].sort());
  });
});
