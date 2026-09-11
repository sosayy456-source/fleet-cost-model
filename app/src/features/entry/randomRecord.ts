/**
 * สุ่มข้อมูลใบรายการทั้งใบ — ใช้ตอนเทสต์เท่านั้น (ปุ่ม "🎲 สุ่มข้อมูล" คู่กับ "เริ่มใบใหม่")
 * สุ่มทุกโซน (cs/dispatch/account) พร้อมกัน ไม่ต้องสลับตำแหน่งเพื่อกรอกทีละฝ่ายตอนทดสอบ
 * ค่าที่สุ่มอิงข้อมูลอ้างอิงจริง (เส้นทาง/ชนิดรถ) ให้พอเดาได้ ไม่ใช่ตัวเลขมั่ว ๆ ล้วน
 */
import { BRANCHES, DOC_TYPES, ORIGINS, REF, SERVICE_GROUPS, destsFor, distanceFor } from "../../lib/refdata";
import { genId, todayISO } from "../../lib/record/date";
import { PAY_TYPES, PRICE_BASIS } from "../../types/record";
import type { TripRecord } from "../../types/record";
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
  const vehicle = pick(REF.vehicles);
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
