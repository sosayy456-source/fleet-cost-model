/** ชนิดข้อมูลของโมเดลต้นทุน — ถอดมาจาก doCalc() ใน โมเดลเดินรถ-gsheet-v5.html:1629 */

export type FleetType = "รถบริษัท" | "รถร่วม";

/** ราคาน้ำมันมีผลตั้งแต่วันที่ระบุ (ISO yyyy-mm-dd) เรียงจากเก่าไปใหม่ */
export interface FuelPrice {
  date: string;
  price: number;
}

export interface Vehicle {
  /** ชื่อที่แสดงและเก็บใน record */
  name: string;
  /** อัตราสิ้นเปลือง ลิตร/กม. */
  litrePerKm: number;
  capacityKg: number | null;
  /** ชื่อเดียวกันแต่สะกดต่างในตารางค่าซ่อม (เดิมอยู่ใน REPAIR_ALIAS) */
  repairKey: string;
}

export interface RepairTable {
  years: string[];
  /** น้ำหนักถ่วงราย พ.ศ. — ฐานคือ [0.2, 0.3, 0.5] */
  weights: number[];
  /** บาท/เที่ยว แยกตาม ประเภทรถ → ชนิดรถ */
  time: Record<string, Record<string, number[]>>;
  /** บาท/กม. รถบริษัทกับรถร่วมใช้อัตราเดียวกัน */
  dist: Record<string, number[]>;
}

export interface RefData {
  prices: FuelPrice[];
  vehicles: Vehicle[];
  repair: RepairTable;
}

/**
 * ค่าที่ผู้ใช้แก้ทับฐานกลาง
 * ของเดิมเก็บใน localStorage แยกเครื่องใครเครื่องมัน ทำให้ 3 ฝ่ายคำนวณไม่ตรงกันได้
 * จึงรับเข้ามาเป็นพารามิเตอร์ตรง ๆ แทนการอ่าน global
 */
export interface RefOverrides {
  /** วันที่ (ISO) → ราคาต่อลิตร */
  prices?: Record<string, number>;
  repair?: {
    weights?: (number | null)[];
    time?: Record<string, Record<string, (number | null)[]>>;
    dist?: Record<string, (number | null)[]>;
  };
}

export interface CostInput {
  /** ISO yyyy-mm-dd — ว่างได้ (จะใช้ราคาน้ำมันล่าสุด ตามพฤติกรรมเดิม) */
  date: string;
  /** ชื่อชนิดรถ ต้องตรงกับ Vehicle.name */
  vehicle: string;
  fleetType: FleetType | "";
  distance: number;
  revenue: number;

  gas: number;
  fuelCash: number;
  fuelDownBill: number;
  fuelFleet: number;
  fuelPickup: number;
  fuelUpBill: number;
  fuelCallTruck: number;
  /** true = บวกค่าน้ำมันที่คำนวณอัตโนมัติเพิ่มจากที่กรอกเอง */
  fuelAutoOn: boolean;

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
}

export interface AutoFuel {
  /** ลิตร/กม. ของชนิดรถนี้ (0 ถ้าไม่รู้จักชนิดรถ) */
  rate: number;
  distance: number;
  price: number;
  /** วันที่ของเรทราคาที่หยิบมาใช้จริง */
  effDate: string;
  litres: number;
  cost: number;
}

export interface RepairResult {
  /** ค่าซ่อมตามเวลา บาท/เที่ยว */
  fixed: number;
  /** อัตราค่าซ่อมตามระยะทาง บาท/กม. */
  rate: number;
  varCost: number;
  total: number;
  vehicle: string;
  fleetType: FleetType | "";
  /** false = ไม่มีชนิดรถนี้ในตาราง จึงคิดเป็น 0 (UI เดิมแสดงว่า "ไม่มีในตาราง") */
  hasFix: boolean;
  hasVar: boolean;
}

export interface CostResult {
  auto: AutoFuel;
  repair: RepairResult;

  /** ค่าน้ำมันเหมา = ที่กรอกเอง + อัตโนมัติ (ถ้าเปิด) */
  fuelSum: number;
  fuelAuto: number;
  litres: number;
  price: number;

  labor: number;
  fees: number;
  /** ต้นทุนสูญเปล่า */
  waste: number;
  /** ต้นทุนปกติ = แก๊ส + น้ำมัน + แรงงาน + ค่าธรรมเนียม + ค่าซ่อม (ไม่รวมสูญเปล่า) */
  normal: number;
  /**
   * "รวมค่าใช้จ่าย" ของชีตเดิม = คอลัมน์ 9–28 → รวมสูญเปล่า แต่ "ไม่รวมค่าซ่อม"
   * ความไม่สมมาตรกับ normal เป็นของจริงตามชีต ไม่ใช่บั๊ก — อย่า "แก้" ให้เหมือนกัน
   */
  sheetTotal: number;
  profit: number;
}
