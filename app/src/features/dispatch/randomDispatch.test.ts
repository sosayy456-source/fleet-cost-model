/** ปุ่มสุ่มส่วนจัดรถต้องเลือกบิลที่เข้ากันและรถที่บรรทุกได้จริง */
import { describe, expect, it } from "vitest";
import { randomDispatch } from "./randomDispatch";
import type { PendingBill } from "../../types/bill";
import type { FleetVehicle } from "../../lib/store/roster";

const bill = (id: string, patch: Partial<PendingBill> = {}): PendingBill => ({
  id, no: id, date: "2026-09-27", branch: "เชียงใหม่", sender: "ผู้ส่ง", receiver: "ผู้รับ",
  origin: "บางนา", dest: "เชียงใหม่", serviceGroup: "สินค้าทั่วไป",
  qty: 10, weight: 1000, width: 50, length: 50, height: 50, volume: 1.25,
  payType: "เชื่อต้นทาง", pricingType: "คิดตามหน่วย", unitPrice: 100, total: 1000,
  status: "รอจัดรถ", docNo: "", createdAt: "2026-09-27 09:00", updatedAt: "2026-09-27 09:00",
  ...patch,
});

const vehicle = (plate: string, name: string): FleetVehicle => ({
  plate, vehicle: name, fleetType: "รถบริษัท", status: "ใช้งาน", start: "2024-01-01",
});

describe("randomDispatch", () => {
  it("เลือกหลายบิลในเที่ยวเดียวกันและไม่เกินความจุรถ", () => {
    const result = randomDispatch([
      bill("A"), bill("B"), bill("C", { dest: "ลำปาง" }),
    ], [vehicle("กก-1000", "รถ 10 ล้อตู้แห้ง")], {});
    expect(result?.bills.map((b) => b.id).sort()).toEqual(["A", "B"]);
    expect(result?.vehicle.plate).toBe("กก-1000");
    expect(result?.loadFactor).toBeLessThanOrEqual(85);
  });

  it("สินค้าแช่เย็นต้องใช้รถตู้เย็น", () => {
    const result = randomDispatch([bill("A", { serviceGroup: "สินค้าแช่เย็น" })], [
      vehicle("กก-1000", "รถ 10 ล้อตู้แห้ง"), vehicle("กก-2000", "รถ 10 ล้อตู้เย็น"),
    ], {});
    expect(result?.vehicle.plate).toBe("กก-2000");
  });

  it("ไม่มีรถที่รับบิลได้จะแจ้งว่าไม่มีชุดสุ่ม", () => {
    expect(randomDispatch([bill("A", { weight: 50_000 })], [vehicle("กก-1000", "รถ 10 ล้อตู้แห้ง")], {})).toBeNull();
  });
});
