/**
 * ค่าน้ำมันแบบ "รายการบิล" — บิลคือแหล่งความจริง 9 ช่องยอดรวมเดิมเป็นของที่คิดจากตรงนี้
 *
 * ทำไมต้องคง 9 ช่องไว้: `computeCost` เทียบกับโค้ด v5 ตัวจริง 400 เคส (golden test)
 * ซึ่งรู้จักแต่ "ช่องเดียวต่อประเภท" · คอลัมน์ชีต 9-28 ก็เรียงตามตำแหน่งคงที่
 * ตรรกะบิลจึงต้องอยู่ "นอก" computeCost เสมอ แล้วป้อนยอดรวมเข้าไปให้เหมือนเดิม
 *
 * ★ ไฟล์นี้ pure ทั้งไฟล์ — ไม่อ่าน REF / localStorage
 *   แถว est เก็บ ratePerKm/pricePerL เป็นสแนปช็อตไว้ในตัวบิลเอง ใบที่บันทึกแล้วจึงไม่ขยับ
 *   เมื่อผู้ใช้ไปแก้ตารางราคาน้ำมันย้อนหลัง · ฝั่งที่อ่าน REF+ovr คือ "ฟอร์ม" ตอนสร้างแถว
 */
import { FUEL_CATS, FUEL_PAYS, FUEL_WASTE_CATS } from "../../types/record";
import type { FuelBill, FuelCat, FuelPay, TripRecord } from "../../types/record";

/** 9 ช่องยอดรวมเดิมที่บิลถูกยุบลงไป (ไม่รวม gas ซึ่งเป็นเชื้อเพลิงคนละชนิด อยู่นอกตาราง) */
export type FuelBucket =
  | "fuelCash" | "fuelDownBill" | "fuelUpBill" | "fuelFleet"
  | "fuelPickup" | "fuelCallTruck" | "fuelOff" | "fuelDetour" | "fuelOffFleet";

export const FUEL_BUCKETS: readonly FuelBucket[] = [
  "fuelCash", "fuelDownBill", "fuelUpBill", "fuelFleet",
  "fuelPickup", "fuelCallTruck", "fuelOff", "fuelDetour", "fuelOffFleet",
];

/** ชื่อคอลัมน์ไทยในชีต — ใช้เขียนลงแท็บ "บิลน้ำมัน" ให้ SUMIF กระทบยอดกับคอลัมน์ 9-28 ได้ */
export const FUEL_BUCKET_LABEL: Record<FuelBucket, string> = {
  fuelCash: "ค่าน้ำมันเดินทาง(เงินสด)",
  fuelDownBill: "ขาล่อง(บิลน้ำมัน)",
  fuelUpBill: "ขาขึ้น(บิลน้ำมัน)",
  fuelFleet: "ค่าน้ำมัน(Fleet Card)",
  fuelPickup: "ค่าน้ำมันไปเก็บสินค้า",
  fuelCallTruck: "ค่าเรียกรถไปขึ้นของ(บิลน้ำมัน)",
  fuelOff: "น้ำมันนอกเส้นทาง",
  fuelDetour: "ค่าน้ำมันรถวิ่งอ้อม",
  fuelOffFleet: "ค่าน้ำมันนอกเส้นทาง(Fleet Card)",
};

/**
 * ตารางแมป (ประเภท × วิธีจ่าย) → 1 ใน 9 ช่องเดิม
 *
 * ประกาศเป็น Record เต็มทุกคู่ ห้ามใช้ fallback `??` — เพิ่มประเภท/วิธีจ่ายใหม่แล้วลืมเติม
 * ต้องให้ tsc แดง ไม่ใช่เงียบแล้วยอดตกหาย
 *
 * จุดที่ยอมเสีย (เจ้าของข้อมูลรับแล้ว):
 *   · `fuelCash` เดิมชื่อ "ค่าน้ำมันเดินทาง(เงินสด)" ไม่แยกขาล่อง/ขาขึ้น → เงินสดทั้งสองขาลงช่องเดียวกัน
 *     แต่ตัวบิลยังรู้ว่าเป็นขาไหน ส่วนสรุป C จึงต้องคิดจากบิล ไม่ใช่จาก 9 ช่อง
 *   · Fleet Card เดิมเป็น "ช่องประเภท" ทั้งที่ความจริงเป็นวิธีจ่าย → fleet ชนะทุกประเภท
 *   · ยอดประมาณ (est) ลงช่องเดียวกับเงินสด เพราะทั้งคู่คือ "ไม่มีบิลน้ำมันของปั๊ม"
 */
export const FUEL_BUCKET_OF: Record<FuelCat, Record<FuelPay, FuelBucket>> = {
  down: { bill: "fuelDownBill", cash: "fuelCash", est: "fuelCash", fleet: "fuelFleet" },
  up: { bill: "fuelUpBill", cash: "fuelCash", est: "fuelCash", fleet: "fuelFleet" },
  pickup: { bill: "fuelPickup", cash: "fuelPickup", est: "fuelPickup", fleet: "fuelFleet" },
  call: { bill: "fuelCallTruck", cash: "fuelCallTruck", est: "fuelCallTruck", fleet: "fuelFleet" },
  offroute: { bill: "fuelOff", cash: "fuelOff", est: "fuelOff", fleet: "fuelOffFleet" },
  detour: { bill: "fuelDetour", cash: "fuelDetour", est: "fuelDetour", fleet: "fuelOffFleet" },
};

export type FuelTotals = Record<FuelBucket, number> & { fuelEst: number };

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
/** ปัดสองตำแหน่งให้ตรงกับที่ส่งเข้าชีต ไม่งั้นผลรวมเพี้ยนจาก float */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** จำนวนเงินของแถวเดียว — est คิดจากสแนปช็อตในแถว ที่เหลือใช้ยอดที่กรอก */
export function fuelBillAmount(b: FuelBill): number {
  if (b.pay === "est") return r2(n(b.km) * n(b.ratePerKm) * n(b.pricePerL));
  return n(b.amount);
}

export const isWasteCat = (c: FuelCat): boolean => FUEL_WASTE_CATS.includes(c);

/** ★ หัวใจ: รายการบิล → 9 ยอดรวม · เริ่มจาก 0 เสมอ ผลลัพธ์ "แทนที่" ไม่ใช่บวกทบของเดิม */
export function fuelBillsToTotals(bills: readonly FuelBill[] | undefined): FuelTotals {
  const out = { fuelEst: 0 } as FuelTotals;
  for (const k of FUEL_BUCKETS) out[k] = 0;
  for (const b of bills ?? []) {
    const amt = fuelBillAmount(b);
    out[FUEL_BUCKET_OF[b.cat][b.pay]] += amt;
    if (b.pay === "est") out.fuelEst += amt;
  }
  for (const k of FUEL_BUCKETS) out[k] = r2(out[k]);
  out.fuelEst = r2(out.fuelEst);
  return out;
}

/** ยอดแยกตามประเภทสำหรับส่วนสรุป — คิดจากบิลตรง ๆ ไม่ผ่าน 9 ช่อง (เงินสดขาล่อง/ขาขึ้นจึงไม่ปนกัน) */
export function fuelBillsByCat(bills: readonly FuelBill[] | undefined): {
  cat: Record<FuelCat, number>; normal: number; waste: number; est: number; total: number;
} {
  const cat = {} as Record<FuelCat, number>;
  for (const c of FUEL_CATS) cat[c] = 0;
  let est = 0;
  for (const b of bills ?? []) {
    const amt = fuelBillAmount(b);
    cat[b.cat] += amt;
    if (b.pay === "est") est += amt;
  }
  let normal = 0, waste = 0;
  for (const c of FUEL_CATS) {
    cat[c] = r2(cat[c]);
    if (isWasteCat(c)) waste += cat[c]; else normal += cat[c];
  }
  return { cat, normal: r2(normal), waste: r2(waste), est: r2(est), total: r2(normal + waste) };
}

/**
 * เขียน 9 ยอด + fuelEst ลงใบ และ **ปิดค่าน้ำมันอัตโนมัติ**
 *
 * ★ ที่ต้องปิด เพราะ computeCost บวก fuelAuto เข้า fuelSum เมื่อ fuelAutoOn เป็นจริง
 *   (และ recomputeTotals ตีความ undefined ว่า "เปิด") ถ้าไม่ปิด ค่าน้ำมันทั้งเที่ยวที่คิดจาก
 *   ระยะทางจะถูกบวกทับยอดบิลอีกชั้น กลายเป็นนับซ้ำ
 */
export function applyFuelBills<T extends TripRecord>(rec: T): T {
  const t = fuelBillsToTotals(rec.fuelBills);
  return { ...rec, ...t, fuelAutoOn: false, _v5: true };
}

/** ผกผันของตารางแมป — ใช้แปลงใบรุ่นก่อน _v5 เป็นบิลสังเคราะห์ */
const LEGACY_OF: Record<FuelBucket, { cat: FuelCat; pay: FuelPay }> = {
  fuelDownBill: { cat: "down", pay: "bill" },
  fuelUpBill: { cat: "up", pay: "bill" },
  fuelCash: { cat: "down", pay: "cash" },
  fuelFleet: { cat: "down", pay: "fleet" },
  fuelPickup: { cat: "pickup", pay: "bill" },
  fuelCallTruck: { cat: "call", pay: "bill" },
  fuelOff: { cat: "offroute", pay: "bill" },
  fuelDetour: { cat: "detour", pay: "bill" },
  fuelOffFleet: { cat: "offroute", pay: "fleet" },
};

let seq = 0;
export const newFuelBillId = (): string =>
  `fb${Date.now().toString(36)}${(seq++).toString(36)}`;

export function emptyFuelBill(date: string): FuelBill {
  return {
    id: newFuelBillId(), no: "", date, pump: "", pay: "bill", cat: "down",
    liters: 0, amount: 0, km: 0, ratePerKm: 0, pricePerL: 0, reason: "",
    approved: false, approvedBy: "", approvedAt: "", dueDate: "",
    proof: false, proofUrl: "", txnId: "", src: "manual",
  };
}

/**
 * ใบรุ่นก่อน _v5 → บิลสังเคราะห์ 1 แถวต่อช่องที่ไม่เป็น 0
 *
 * ทุกแถวติด src:"legacy" เพื่อให้ตัวตรวจข้ามไป ไม่งั้นใบเก่าหลายร้อยใบจะขึ้นป้ายแดง
 * "รอหลักฐาน" ทั้งกระดาน ทั้งที่ปิดงานไปแล้ว
 *
 * ★ ไม่แตะ fuelAuto/fuelAutoOn ตรงนี้ — ใบเก่าที่เปิดออโต้ไว้ต้องได้ยอดเท่าเดิมเป๊ะ
 *   ตอนเปิดดู (ผู้ใช้กดแปลงเป็นแถวยอดประมาณเองทีหลังได้)
 */
export function legacyFuelToBills(rec: TripRecord): FuelBill[] {
  const out: FuelBill[] = [];
  for (const k of FUEL_BUCKETS) {
    const amt = n((rec as unknown as Record<string, unknown>)[k]);
    if (!amt) continue;
    const { cat, pay } = LEGACY_OF[k];
    out.push({ ...emptyFuelBill(rec.date), cat, pay, amount: r2(amt), src: "legacy" });
  }
  return out;
}

/**
 * ใบที่ยังไม่มีตารางบิล → เติมให้ตอนเปิดในฟอร์ม
 *
 * ★ ทำตรงนี้ ไม่ใช่ใน migrateSchema() เพราะตัวนั้นถูกเรียกจาก migrateFromLocalStorage()
 *   ที่เดียว และรันครั้งเดียวตลอดกาล (ติดธง MIGRATION_FLAG) ใบที่มาจากชีตหรือที่อยู่ใน
 *   IndexedDB อยู่แล้วจึงไม่เคยวิ่งผ่านมันเลย · ฟอร์มคือจุดเข้าเดียวของทั้งสองแหล่ง
 */
export function ensureFuelBills<T extends TripRecord>(rec: T): T {
  if (rec.fuelBills) return rec;   // แปลงแล้ว (แม้เป็น [] ก็นับว่าแปลงแล้ว)
  return { ...rec, fuelBills: legacyFuelToBills(rec) };
}

export { FUEL_CATS, FUEL_PAYS };
