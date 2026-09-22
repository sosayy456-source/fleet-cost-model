/**
 * บิลที่ฝ่ายบริการลูกค้ากรอก — **มีตัวตนก่อนใบรายการ** (สเปก "ปรับปรุงโมเดล" 22 ก.ย. 2569)
 *
 * ของเดิม: 1 ระเบียน = 1 ใบรายการ ฝ่าย CS กรอกหัวใบ + บิลอยู่ข้างใน (TripRecord.bills)
 * ของใหม่: CS กรอก "รายบิล" อย่างเดียว ไม่มีเลขที่ใบรายการ → บิลได้สถานะ "รอจัดรถ"
 *          ฝ่ายจัดรถเลือกหลายบิลที่ไปด้วยกัน แล้วกด "ยืนยันการจัดรถ" → ระบบออกเลขที่ใบรายการ
 *          13 หลัก สร้าง TripRecord ให้ แล้วประทับ docNo กลับลงบิลทุกใบที่เลือก
 *
 * ★ เก็บใน Google Sheet แท็บ "บิลรอจัดรถ" (Apps Script v17) เพราะ CS กับฝ่ายจัดรถอยู่คนละเครื่อง
 *   ต้องเห็นบิลของกันและกัน — IndexedDB เก็บสำเนาไว้ใช้ตอนออฟไลน์เหมือน TripRecord
 * ★ บิลที่จัดรถแล้วยังอยู่ในชีตเดิม (สถานะเปลี่ยนเป็น "จัดรถแล้ว" + มีเลขที่ใบรายการ)
 *   ไม่ย้ายออก เพื่อให้ย้อนดูได้ว่าใบไหนมาจากบิลไหน
 */

/** สถานะของบิล — ฝ่ายจัดรถเห็นเฉพาะ "รอจัดรถ" */
export const BILL_STATUS = ["รอจัดรถ", "จัดรถแล้ว", "ยกเลิก"] as const;
export type BillStatus = (typeof BILL_STATUS)[number];

/**
 * กลุ่มบริการชุดใหม่ — แทนชุดเก่าทั้งหมด (เจ้าของงานเคาะ 22 ก.ย. 2569)
 * ★ ใบเก่าที่เคยกรอกด้วยชื่อกลุ่มเดิมยังแสดงค่าเดิมได้ แต่เลือกใหม่ไม่ได้
 */
export const SERVICE_GROUPS_V2 = [
  "สินค้าทั่วไป", "สินค้าแช่เย็น", "สินค้าแช่แข็ง", "บิลเคลียร์", "ของเหมาตีเปล่า",
] as const;
export type ServiceGroupV2 = (typeof SERVICE_GROUPS_V2)[number];

export interface PendingBill {
  /** คีย์ถาวรของบิล (uuid) — ใช้ upsert ทั้งใน IndexedDB และชีต */
  id: string;
  /** เลขที่บิล — ระบบออกให้ตอนกดบันทึก ห้ามพิมพ์เอง (lib/bill/number.ts) */
  no: string;
  /** วันที่รับสินค้า (ISO) */
  date: string;
  branch: string;
  /** ผู้ส่ง / ผู้รับ — รหัสลูกค้าหรือชื่อที่พิมพ์เอง (เหมือน Bill เดิม) */
  sender: string;
  receiver: string;
  origin: string;
  dest: string;
  /** กลุ่มบริการชุดใหม่ 5 ตัว */
  serviceGroup: string;
  /** จำนวน (หน่วย) · น้ำหนักรวม (กก.) · ขนาดต่อหน่วย (ซม.) */
  qty: number;
  weight: number;
  width: number;
  length: number;
  height: number;
  /** ปริมาตรรวม (ลบ.ม.) = กว้าง×ยาว×สูง ÷ 1,000,000 × จำนวน — คิดตอนกรอก เก็บไว้ให้ฝ่ายจัดรถใช้ตรง ๆ */
  volume: number;
  payType: string;
  /** เกณฑ์คิดราคา + ราคาต่อหน่วย → ราคารวม (คิดให้ ไม่ให้กรอกเอง) */
  pricingType: string;
  unitPrice: number;
  total: number;
  status: BillStatus;
  /** เลขที่ใบรายการที่บิลนี้ถูกจัดเข้า — "" เมื่อยังรอจัดรถ */
  docNo: string;
  /** เวลาที่บันทึก/แก้ล่าสุด 'YYYY-MM-DD HH:mm' */
  createdAt: string;
  updatedAt: string;
  /** ยังไม่ได้ขึ้นชีต — เหมือน TripRecord.synced */
  synced?: boolean;
}

/** ปริมาตรรวมของบิล (ลบ.ม.) — ขนาดกรอกเป็นเซนติเมตรต่อหน่วย คูณจำนวนหน่วย */
export const billVolume = (b: Pick<PendingBill, "width" | "length" | "height" | "qty">): number =>
  Math.round((b.width * b.length * b.height) / 1_000_000 * b.qty * 10_000) / 10_000;

/**
 * ราคารวมของบิล — เจ้าของงานเคาะ 22 ก.ย. 2569
 *   คิดตามน้ำหนัก = น้ำหนักรวม × ราคา/หน่วย · คิดตามหน่วย = จำนวน × ราคา/หน่วย
 */
export const billTotalOf = (b: Pick<PendingBill, "pricingType" | "weight" | "qty" | "unitPrice">): number =>
  Math.round((b.pricingType === "คิดตามน้ำหนัก" ? b.weight : b.qty) * b.unitPrice * 100) / 100;

/** ฝั่งที่ต้องบรรทุกจริง — ใช้ค่าที่ "เต็มกว่า" ระหว่างน้ำหนักกับปริมาตรเทียบความจุรถ (สเปกฝ่ายจัดรถ) */
export interface LoadNeed { weight: number; volume: number }

export const sumLoad = (bills: PendingBill[]): LoadNeed => ({
  weight: Math.round(bills.reduce((s, b) => s + b.weight, 0) * 100) / 100,
  volume: Math.round(bills.reduce((s, b) => s + b.volume, 0) * 10_000) / 10_000,
});
