/**
 * ใบที่บันทึกใหม่ → ข้อมูลเข้า allocateTrip() (tripAlloc.ts) — ใช้ในป็อบอัพรายละเอียดเที่ยว (27 ก.ย. 2569)
 *
 *   น้ำหนัก/ปริมาตรของบิล = ที่ฝ่ายบริการลูกค้ากรอกในหน้าบันทึกบิล (PendingBill · จับคู่ด้วยเลขที่บิล + เลขที่ใบรายการ)
 *     ★ บิลในใบ (TripRecord.bills) ไม่ได้เก็บน้ำหนัก/ปริมาตร — บิลที่หาต้นฉบับไม่เจอ (ใบเก่า/ใบที่กรอกเอง)
 *       ได้ 0 ทั้งคู่ จึงเข้ากลุ่มข้อมูลเชื่อไม่ได้แล้วปันตามรายได้
 *   ระยะทาง = ต้นทาง → ปลายทางของบิลนั้นในตารางมาตรฐาน (distanceFor)
 *   Conversion Factor = ความจุรถที่จัดจริง หัว + หาง (รวมค่าที่แก้ในหน้าตั้งค่า — vehicleSpec)
 */
import { REF, canonicalVehicleName, distanceFor } from "../refdata";
import { vehicleSpec } from "../refdata/vehicleSpecs";
import type { RefOverrides } from "../cost/types";
import type { PendingBill } from "../../types/bill";
import type { TripRecord } from "../../types/record";
import { conversionFactor } from "./tripAlloc";
import type { AllocItem } from "./tripAlloc";

/** ความจุรวมของรถในใบ (หัว + หาง) และ CF · kinds = ชื่อชนิดที่ใช้ · missing = ชนิดที่หาความจุไม่เจอ */
export function recordCapacity(rec: Pick<TripRecord, "vehicle" | "trailerVehicle">, overrides?: RefOverrides["vehicleSpecs"]) {
  const kinds = [rec.vehicle, rec.trailerVehicle ?? ""].map((k) => canonicalVehicleName(String(k || "").trim())).filter(Boolean);
  let kg = 0, m3 = 0;
  const missing: string[] = [];
  for (const k of kinds) {
    const spec = vehicleSpec(REF.vehicles.find((v) => v.name === k), overrides);
    if (!spec?.capacityKg || !spec?.volumeM3) { missing.push(k); continue; }
    kg += spec.capacityKg;
    m3 += spec.volumeM3;
  }
  return { kinds, capKg: kg, capM3: m3, cf: missing.length ? null : conversionFactor(kg, m3), missing };
}

/** บิลที่ติ๊กในหน้าจัดรถ (ยังไม่เป็นใบ) → รายการสำหรับปันต้นทุนพยากรณ์ — มีน้ำหนัก/ปริมาตรที่ CS กรอกในตัวอยู่แล้ว */
export function pendingAllocItems(bills: PendingBill[]): AllocItem[] {
  return bills.map((b, i) => ({
    key: b.no || `บิลที่ ${i + 1}`,
    weightKg: Number(b.weight) || 0,
    volumeM3: Number(b.volume) || 0,
    qty: Number(b.qty) || 0,
    distKm: distanceFor(b.origin || "", b.dest || ""),
    revenue: Number(b.total) || 0,
  }));
}

/** บิลของใบ → รายการสำหรับปัน · pending = บิลทั้งหมดในเครื่อง/ชีต (หาน้ำหนัก/ปริมาตร) */
export function recordAllocItems(rec: Pick<TripRecord, "bills" | "docNo">, pending: PendingBill[]): { items: AllocItem[]; unmatched: number } {
  const byNo = new Map<string, PendingBill>();
  for (const b of pending) if (b.no && (!rec.docNo || !b.docNo || b.docNo === rec.docNo)) byNo.set(b.no, b);
  let unmatched = 0;
  const items = (rec.bills ?? []).map((b, i) => {
    const src = b.no ? byNo.get(b.no) : undefined;
    if (!src) unmatched++;
    return {
      key: b.no || `บิลที่ ${i + 1}`,
      weightKg: Number(src?.weight) || 0,
      volumeM3: Number(src?.volume) || 0,
      qty: Number(src?.qty ?? b.qty) || 0,
      distKm: distanceFor(b.origin || "", b.dest || ""),
      revenue: Number(b.total) || 0,
    };
  });
  return { items, unmatched };
}
