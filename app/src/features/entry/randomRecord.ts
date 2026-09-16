/**
 * สุ่มข้อมูลใบรายการ — ใช้ตอนเทสต์เท่านั้น (ปุ่ม "🎲 สุ่มข้อมูล" คู่กับ "เริ่มใบใหม่")
 *
 * สุ่มเฉพาะโซนของฝ่ายที่กำลังกรอก ทับบนใบที่เปิดอยู่ (randomFor) — ไม่สร้างใบใหม่
 *   ★ ของเดิมสุ่มทุกโซนเป็นใบใหม่ทุกครั้ง: ฝ่าย cs กดแล้วช่องของฝ่ายจัดรถ/บัญชีถูกเขียนขึ้นชีต
 *     ทั้งที่ไม่ได้ประทับว่าฝ่ายนั้นกรอกแล้ว · ฝ่ายจัดรถกดแล้วได้ใบใหม่ เลขที่ใบ/วันที่ไม่ตรงกับใบของ cs
 *   ตอนนี้ฝ่ายจัดรถ/บัญชีเปิดใบที่ cs บันทึกไว้แล้วกดสุ่ม จะได้ค่าเฉพาะช่องของตัวเอง
 *   เลขที่ใบกับวันที่ (ช่องของ cs) ไม่ถูกแตะ · ผู้ดูแลระบบสุ่มครบทุกโซน (และ saveRecord ประทับครบทั้งสามฝ่าย)
 * ค่าที่สุ่มอิงข้อมูลอ้างอิงจริง (เส้นทาง/ชนิดรถ) ให้พอเดาได้ ไม่ใช่ตัวเลขมั่ว ๆ ล้วน
 */
import { ACTIVE_VEHICLES, BRANCHES, DOC_TYPES, ORIGINS, SERVICE_GROUPS, destsFor, distanceFor } from "../../lib/refdata";
import { addDaysISO, genId, todayISO } from "../../lib/record/date";
import { fieldsOwnedBy } from "../../lib/store/save";
import { PAY_TYPES, PRICE_BASIS } from "../../types/record";
import type { RoleKey, TripRecord } from "../../types/record";
import type { FleetType } from "../../lib/cost/types";
import { emptyBill } from "./emptyRecord";

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
const round100 = (n: number) => Math.round(n / 100) * 100;

function randomBill(origin: string, dest: string) {
  const n = int(1000, 9999);
  return {
    ...emptyBill(),
    no: `ทดสอบ${n}`,
    goodsType: pick(["สินค้าทั่วไป", "อาหารแห้ง", "เครื่องใช้ไฟฟ้า", "วัสดุก่อสร้าง"]),
    sender: `ลูกค้าทดสอบ ${int(1, 99)}`,
    receiver: `ผู้รับทดสอบ ${int(1, 99)}`,
    origin, dest,
    payType: pick(PAY_TYPES),
    qty: int(1, 20),
    unitPrice: int(50, 2000),
    pricingType: pick(PRICE_BASIS),
  };
}

/** สุ่มใบรายการหนึ่งใบ เริ่มจากค่าเปล่าแล้วเติมทุกช่องที่ฟอร์มให้กรอกได้ */
export function randomRecord(): TripRecord {
  const origin = pick(ORIGINS);
  const dest = pick(destsFor(origin));
  const dist = distanceFor(origin, dest) ?? int(50, 500);
  const vehicle = pick(ACTIVE_VEHICLES);
  const capacity = vehicle.capacityKg ?? int(1000, 15000);

  return {
    id: genId(), docNo: `ทดสอบ${Date.now().toString().slice(-6)}`, source: "ใหม่", synced: false,
    date: todayISO(), routeType: pick(["ขาขึ้น", "ขาล่อง"]), branch: pick(BRANCHES), docType: pick(DOC_TYPES),
    origin, dest, dist, serviceGroup: pick(SERVICE_GROUPS), revenue: round100(int(3000, 40000)),
    bills: [randomBill(origin, dest)],
    plate: `ทด.${int(10, 99)}-${int(1000, 9999)}`,
    fleetType: pick(["รถบริษัท", "รถร่วม"]) as FleetType,
    vehicle: vehicle.name, releaseDate: todayISO(),
    capacity, loadActual: int(0, capacity), emptyLeg: Math.random() < 0.1,
    gas: int(0, 500), fuelCash: int(0, 3000), fuelDownBill: int(0, 1500), fuelFleet: int(0, 1500),
    fuelPickup: int(0, 800), fuelUpBill: int(0, 1500), fuelSum: 0, fuelAutoOn: true,
    fuelAuto: 0, liters: 0, price: 0,
    fuelCallTruck: int(0, 500),
    fuelOff: int(0, 1000), fuelDetour: int(0, 1000), fuelOffFleet: int(0, 1000),
    drv: int(0, 1500), spare: int(0, 800), snd: int(0, 500), laborOff: int(0, 500),
    feeTarp: int(0, 300), feePolice: int(0, 300), feeCont: int(0, 500), feePort: int(0, 500),
    feeDoc: int(0, 300), feeToll: int(0, 500),
    repVeh: "", repFix: 0, repRate: 0, repVar: 0, repTotal: 0,
    fees: 0, labor: 0, normal: 0, waste: 0, sheetTotal: 0, profit: 0,
    _v2: true, _v3: true, _v4: true,
  };
}

/**
 * สุ่มเฉพาะช่องของฝ่ายใน zones แล้วทับลงบน base — ช่องของฝ่ายอื่น รวมถึง id ธง workflow
 * และสถานะซิงก์ คงค่าจาก base ทั้งหมด
 *
 * วันปล่อยรถ (ช่องของฝ่ายจัดรถ) = วันที่ในใบ + 0–2 วัน ไม่ใช่ "วันนี้" — ใบที่ cs เปิดไว้เมื่อวาน
 * จะได้ไม่มีวันปล่อยรถก่อนวันที่ในใบ และสถานะกองรถ (tripEta) เดาได้สมเหตุสมผล
 */
export function randomFor(base: TripRecord, zones: RoleKey[]): TripRecord {
  const full = randomRecord();
  const out = { ...base } as unknown as Record<string, unknown>;
  for (const f of zones.flatMap(fieldsOwnedBy)) {
    out[f] = (full as unknown as Record<string, unknown>)[f];
  }
  // บิล (ช่องของ cs) สุ่มเท่าจำนวนแถวที่มีในฟอร์ม — มีลูกหนี้ 3 ราย กด "เพิ่มรายการลูกหนี้" ให้ครบ 3 แถว
  // ก่อนแล้วค่อยกดสุ่ม ได้ 3 บิล · ใบเปล่ามีแถวว่างอยู่แล้ว 1 แถว (emptyRecord) จึงได้อย่างน้อย 1 บิลเสมอ
  if (zones.includes("cs")) {
    const n = Math.max(1, base.bills?.length ?? 0);
    out.bills = Array.from({ length: n }, () => randomBill(out.origin as string, out.dest as string));
  }
  if (zones.includes("dispatch")) {
    const date = (out.date as string) || todayISO();
    out.releaseDate = addDaysISO(date, int(0, 2));
  }
  return out as unknown as TripRecord;
}
