/** ชนิดข้อมูลของใบรายการเดินรถ — ถอดจาก buildRecord() ใน v5:2116 */
import type { FleetType } from "../lib/cost/types";

/** manager/admin/driver ไม่ได้กรอกใบ จึงไม่นับในความครบถ้วนของใบ */
export type RoleKey = "cs" | "dispatch" | "account" | "manager" | "admin" | "driver";
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

/**
 * ค่าน้ำมัน 1 บิล — ตั้งแต่ _v5 บิลคือ "แหล่งความจริง" ส่วน 9 ช่องยอดรวมด้านล่าง
 * (fuelCash/fuelDownBill/…/fuelOffFleet) กลายเป็นยอดสรุปที่ระบบเขียนให้เอง
 * เพื่อให้ computeCost / คอลัมน์ชีต 9-28 / แดชบอร์ด ใช้ต่อได้โดยไม่ต้องแก้อะไรเลย
 */
export const FUEL_PAYS = ["bill", "cash", "fleet", "est"] as const;
export type FuelPay = (typeof FUEL_PAYS)[number];

/** 4 ตัวแรกเป็นต้นทุนปกติ 2 ตัวหลังเป็นต้นทุนสูญเปล่า */
export const FUEL_CATS = ["down", "up", "pickup", "call", "offroute", "detour"] as const;
export type FuelCat = (typeof FUEL_CATS)[number];
export const FUEL_WASTE_CATS: readonly FuelCat[] = ["offroute", "detour"];

export const FUEL_PAY_LABEL: Record<FuelPay, string> = {
  bill: "บิลน้ำมัน", cash: "เงินสด (บก.111)", fleet: "Fleet Card", est: "ไม่มีบิล — ยอดประมาณ",
};
export const FUEL_CAT_LABEL: Record<FuelCat, string> = {
  down: "เดินทางขาล่อง", up: "เดินทางขาขึ้น", pickup: "ไปเก็บสินค้า",
  call: "เรียกรถไปขึ้นของ", offroute: "วิ่งนอกเส้นทาง", detour: "วิ่งอ้อม",
};

/** เหตุผลที่ไม่มีบิล — บังคับเลือกเมื่อ pay = "est" */
export const FUEL_REASONS = ["บิลหาย", "ปั๊มไม่ออกบิล", "บิลเลือน/อ่านไม่ออก", "เติมนอกเครือข่าย", "อื่น ๆ"] as const;

/** จำนวนวันมาตรฐานที่ต้องนำบิลจริงมาแทนยอดประมาณ */
export const EST_REPLACE_DAYS = 7;

export interface FuelBill {
  /** คีย์ของแถว — key ของ React และผูกกับ FuelBillID ในชีต */
  id: string;
  no: string;
  date: string;
  pump: string;
  pay: FuelPay;
  cat: FuelCat;
  liters: number;
  /** แถว est ระบบคำนวณให้จาก km × ratePerKm × pricePerL — แก้เองไม่ได้ */
  amount: number;
  km: number;
  /**
   * สแนปช็อตอัตรา/ราคาตอนสร้างแถว est — ไม่อ่านสดทุกครั้ง
   * ไม่งั้นใบที่บันทึกไปแล้วจะขยับเองเมื่อผู้ใช้ไปแก้ตารางราคาน้ำมันย้อนหลัง
   */
  ratePerKm: number;
  pricePerL: number;
  reason: string;
  approved: boolean;
  /** ตำแหน่งที่กดอนุมัติ — แอปไม่มีระบบล็อกอิน จึงเป็นบันทึกเชิงกระบวนการ ไม่ใช่หลักฐานทางบัญชี */
  approvedBy: string;
  approvedAt: string;
  /** ISO — ต้องนำบิลจริงมาแทนภายในวันนี้ */
  dueDate: string;
  proof: boolean;
  /** ลิงก์หลักฐานที่ผู้ใช้วางเอง — ระบบไม่มีการอัปโหลดไฟล์ */
  proofUrl: string;
  /** Transaction ID จาก statement ของ Fleet Card */
  txnId: string;
  /** legacy = แถวสังเคราะห์จาก 9 ช่องของใบรุ่นก่อน _v5 — ข้ามการตรวจทุกข้อ */
  src: "manual" | "fleet" | "legacy";
}

/**
 * ค่าใช้จ่ายอื่นๆ — ช่องปลายเปิดสำหรับต้นทุนที่ไม่มีหมวดของตัวเอง (เช่น ค่าปรับ ค่าเช่าอุปกรณ์ชั่วคราว)
 * ผู้กรอกพิมพ์ชื่อรายการเองแล้วเลือกว่าเป็น "ต้นทุนทางตรง" หรือ "ต้นทุนทางอ้อม"
 *
 * แถวเหล่านี้ไม่มีคอลัมน์ของตัวเองในชีต (ยังไม่แยกเป็นแท็บแบบบิลน้ำมัน) — เดินทางไป-กลับ
 * ผ่าน _DATA (JSON ทั้งใบ) เท่านั้น ส่วน `otherNormal`/`otherWaste` เป็นยอดสรุปที่คำนวณให้
 * แล้วป้อนเข้า computeCost เหมือนค่าธรรมเนียม
 * ทั้งสองแบบเป็นต้นทุนปกติ (นับใน normal) ไม่ใช่สูญเปล่า — ต่างกันแค่ป้ายที่ใช้แยกดูตอนสรุป
 */
export type OtherCostKind = "direct" | "indirect";
export const OTHER_COST_LABEL: Record<OtherCostKind, string> = {
  direct: "ต้นทุนทางตรง", indirect: "ต้นทุนทางอ้อม",
};

export interface OtherCost {
  id: string;
  /** ผู้กรอกพิมพ์เองว่าเป็นค่าใช้จ่ายอะไร */
  label: string;
  amount: number;
  kind: OtherCostKind;
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
  /**
   * ★ แหล่งความจริงของค่าน้ำมันตั้งแต่ _v5 — 9 ช่องข้างบนเป็นยอดสรุปที่คิดจากตรงนี้
   * ไม่มีคอลัมน์ในแท็บ "ข้อมูลใหม่" เดินทางไป-กลับผ่าน _DATA (JSON) และถูกกางเป็น
   * 1 แถว/บิล ในแท็บ "บิลน้ำมัน" สำหรับดูในชีตเท่านั้น
   * optional เพราะใบจากชีตเก่า/ใบที่ฝ่ายอื่นยังไม่กรอก จะไม่มีคีย์นี้ — ทุกฟังก์ชันต้องรับได้
   */
  fuelBills?: FuelBill[];
  /** ยอดประมาณการรวม (แถว pay="est") — นับเป็นต้นทุนจริงแล้ว แยกไว้ดูสัดส่วนเฉย ๆ */
  fuelEst?: number;
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
  /**
   * ★ แหล่งความจริงของ "6) ค่าใช้จ่ายอื่นๆ" — otherNormal เป็นยอดสรุป (ทางตรง + ทางอ้อม) ที่
   * applyOtherCosts() คำนวณให้ แล้วป้อนเข้า computeCost เหมือนค่าธรรมเนียม
   * optional เพราะใบรุ่นก่อนหน้านี้ไม่มีคีย์นี้เลย
   */
  otherCosts?: OtherCost[];
  otherNormal?: number;
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
  /** ใบนี้ผ่านการแปลงค่าน้ำมันเป็นรายการบิลแล้ว — ประทับตอนบันทึกเท่านั้น ไม่ใช่ตอนเปิดดู */
  _v5?: boolean;

  // ---- สถานะ workflow 3 ฝ่าย ----
  _csDone?: boolean;
  _csAt?: string;
  _dispatchDone?: boolean;
  _dispatchAt?: string;
  _accountDone?: boolean;
  _accountAt?: string;

  /**
   * ---- คนขับกดจบงาน ----
   * แยกจากธง workflow ข้างบนโดยตั้งใจ — ไม่นับในความครบถ้วนของใบ (ROLE_ORDER)
   * เป็นแค่ตัวบอกว่ารถคันนี้วิ่งจบแล้ว กลับมาว่างก่อนวันที่ประมาณการไว้
   * ไม่มีคอลัมน์ในชีต เดินทางไป-กลับในคอลัมน์ _DATA (JSON) ที่ Apps Script อ่านกลับอยู่แล้ว
   */
  _tripDone?: boolean;
  /** เวลาที่กด 'YYYY-MM-DD HH:mm' */
  _tripDoneAt?: string;
  /** วันที่จบงาน (ISO) — ใช้นับว่ารถว่างมากี่วัน */
  _tripDoneDate?: string;
  _tripDoneBy?: RoleKey;
}

/** ใบที่ยังกรอกไม่ครบ ยังไม่นับเป็นข้อมูลสมบูรณ์ */
export type PartialTripRecord = Partial<TripRecord> & Pick<TripRecord, "id" | "docNo">;
