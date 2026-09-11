/** ชนิดข้อมูลของใบรายการเดินรถ — ถอดจาก buildRecord() ใน v5:2116 */
import type { FleetType } from "../lib/cost/types";

/** manager/admin เป็นตำแหน่งดูอย่างเดียว/ดูแลระบบ ไม่นับในความครบถ้วนของใบ */
export type RoleKey = "cs" | "dispatch" | "account" | "manager" | "admin";
/** เฉพาะตำแหน่งที่กรอกใบจริง — ใช้กับ stampRole และการแบ่งโซนในฟอร์ม */
export type EntryRoleKey = "cs" | "dispatch" | "account";

export const PAY_TYPES = ["เชื่อต้นทาง", "เชื่อปลายทาง", "สดต้นทาง", "สดปลายทาง"] as const;
export type PayType = (typeof PAY_TYPES)[number];

/** เกณฑ์คิดราคาต่อบิล — PRICE_BASIS ของ main:1487 */
export const PRICE_BASIS = ["คิดตามน้ำหนัก", "คิดตามหน่วย"] as const;

/** สดต้นทาง = เก็บเงินหน้างาน ถือว่าชำระแล้วทันทีที่เปิดบิล */
export const CASH_ORIGIN: PayType = "สดต้นทาง";

export const ST_PAID = "ชำระแล้ว";
export const ST_PARTIAL = "ยังชำระไม่ครบ";
export const ST_UNPAID = "ยังไม่ได้ชำระ";
export type PayStatus = typeof ST_PAID | typeof ST_PARTIAL | typeof ST_UNPAID;

/** บิลลูกหนี้ 1 ใบ — 1 ใบรายการมีได้หลายบิล */
export interface Bill {
  no: string;
  goodsType: string;
  sender: string;
  receiver: string;
  origin: string;
  dest: string;
  qty: number;
  total: number;
  payType: PayType | "";
  paid: boolean;
  payDate: string | null;
  /** วันที่นัดส่ง / วันที่ส่งจริง — ใช้คิด On-time ในแดชบอร์ด */
  plannedDate?: string | null;
  actualDate?: string | null;
  damageStatus?: string;
  damageQty?: number;
  /**
   * สองช่องนี้ชีตฝั่ง Apps Script รองรับแล้ว (DEBT_HEADERS คอลัมน์ 19-20)
   * แต่ v5 ไม่เคยส่งมา ทำให้ว่างเสมอ — ตรงกับคอลัมน์ ราคาต่อหน่วย /
   * ประเภทการคิดราคา ในไฟล์บิล จึงเป็นกุญแจ join ต้นทุนกับรายได้
   */
  unitPrice?: number | null;
  pricingType?: string;
}

export interface TripRecord {
  id: string;
  docNo: string;
  source: "ใหม่" | "เก่า";
  synced: boolean;

  // ---- ฝ่ายบริการลูกค้า ----
  date: string;
  routeType: string;
  branch: string;
  docType: string;
  origin: string;
  dest: string;
  dist: number;
  serviceGroup: string;
  revenue: number;
  bills: Bill[];

  // ---- ฝ่ายจัดรถ ----
  plate: string;
  fleetType: FleetType | "";
  vehicle: string;
  releaseDate: string;
  capacity: number;
  loadActual: number;
  emptyLeg: boolean;

  // ---- ฝ่ายบัญชี (ผลจาก computeCost) ----
  gas: number;
  fuelCash: number;
  fuelDownBill: number;
  fuelFleet: number;
  fuelPickup: number;
  fuelUpBill: number;
  fuelCallTruck: number;
  fuelSum: number;
  fuelAutoOn: boolean;
  fuelAuto: number;
  liters: number;
  price: number;
  fuelOff: number;
  fuelDetour: number;
  fuelOffFleet: number;
  drv: number;
  spare: number;
  snd: number;
  laborOff: number;
  feeTarp: number;
  feePolice: number;
  feeCont: number;
  feePort: number;
  feeDoc: number;
  feeToll: number;
  repVeh: string;
  repFix: number;
  repRate: number;
  repVar: number;
  repTotal: number;
  fees: number;
  labor: number;
  normal: number;
  waste: number;
  sheetTotal: number;
  profit: number;

  /**
   * ธงบอกรุ่นของ schema — buildRecord() ของ main ประทับครบทั้งสามทุกครั้งที่บันทึก
   * _v4 สำคัญเป็นพิเศษ: แดชบอร์ด Load Factor นับเฉพาะใบที่มีธงนี้
   * เพราะใบก่อนหน้านั้นไม่มีช่องความจุ/น้ำหนักบรรทุกให้คำนวณ
   */
  _v2?: boolean;
  _v3?: boolean;
  _v4?: boolean;

  // ---- สถานะ workflow 3 ฝ่าย ----
  _csDone?: boolean;
  _csAt?: string;
  _dispatchDone?: boolean;
  _dispatchAt?: string;
  _accountDone?: boolean;
  _accountAt?: string;
}

/** ใบที่ยังกรอกไม่ครบ ยังไม่นับเป็นข้อมูลสมบูรณ์ */
export type PartialTripRecord = Partial<TripRecord> & Pick<TripRecord, "id" | "docNo">;
