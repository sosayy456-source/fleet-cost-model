import { genId, todayISO } from "../../lib/record/date";
import type { TripRecord } from "../../types/record";

/** ใบเปล่าสำหรับเริ่มกรอกใหม่ — ทุกช่องตัวเลขเริ่มที่ 0 ไม่ใช่ undefined */
export function emptyRecord(): TripRecord {
  return {
    id: genId(), docNo: "", source: "ใหม่", synced: false,
    date: todayISO(), routeType: "", branch: "", docType: "",
    origin: "", dest: "", dist: 0, serviceGroup: "", revenue: 0, bills: [],
    plate: "", fleetType: "", vehicle: "", releaseDate: "",
    capacity: 0, loadActual: 0, emptyLeg: false,
    gas: 0, fuelCash: 0, fuelDownBill: 0, fuelFleet: 0, fuelPickup: 0,
    fuelUpBill: 0, fuelCallTruck: 0, fuelSum: 0, fuelAutoOn: true,
    fuelAuto: 0, liters: 0, price: 0,
    fuelOff: 0, fuelDetour: 0, fuelOffFleet: 0,
    drv: 0, spare: 0, snd: 0, laborOff: 0,
    feeTarp: 0, feePolice: 0, feeCont: 0, feePort: 0, feeDoc: 0, feeToll: 0,
    repVeh: "", repFix: 0, repRate: 0, repVar: 0, repTotal: 0,
    fees: 0, labor: 0, normal: 0, waste: 0, sheetTotal: 0, profit: 0,
  };
}

export function emptyBill() {
  return {
    no: "", goodsType: "", sender: "", receiver: "", origin: "", dest: "",
    qty: 0, total: 0, payType: "" as const, paid: false, payDate: null,
    unitPrice: null, pricingType: "",
  };
}
