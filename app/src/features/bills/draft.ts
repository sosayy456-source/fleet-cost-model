/**
 * แถวบิลที่กำลังกรอกในหน้า "บันทึกบิล" (ฝ่ายบริการลูกค้า) + ตัวสุ่มสำหรับทดสอบ
 *
 * แยกออกจาก BillEntry.tsx เพื่อให้เทสต์ได้โดยไม่ต้องวาดหน้าจอ
 */
import { BRANCHES, ORIGINS, destsFor, distanceFor } from "../../lib/refdata";
import { randomCargo } from "../../lib/sim/cargo";
import { todayISO } from "../../lib/record/date";
import { PAY_TYPES, PRICE_BASIS } from "../../types/record";
import { SERVICE_GROUPS_V2 } from "../../types/bill";

/** แถวที่กำลังกรอก — เลขที่บิลยังไม่มี (ออกตอนบันทึก) และตัวเลขเก็บเป็นสตริงเพื่อให้ช่องว่างได้ */
export interface Draft {
  key: string;
  date: string; branch: string;
  sender: string; receiver: string; origin: string; dest: string; serviceGroup: string;
  qty: string; weight: string; width: string; length: string; height: string;
  payType: string; pricingType: string; unitPrice: string;
}

export const emptyDraft = (): Draft => ({
  key: crypto.randomUUID(),
  date: todayISO(), branch: BRANCHES[0] ?? "",
  sender: "", receiver: "", origin: "", dest: "", serviceGroup: SERVICE_GROUPS_V2[0],
  qty: "", weight: "", width: "", length: "", height: "",
  payType: PAY_TYPES[0], pricingType: PRICE_BASIS[0], unitPrice: "",
});

/** ช่องตัวเลขที่เก็บเป็นสตริง → ตัวเลข (ว่าง/พิมพ์ผิด = 0) */
export const n = (s: string): number => Number(s) || 0;

/** ข้อความบอกว่าแถวไหนยังกรอกไม่ครบ — "" = ผ่าน */
export function problem(d: Draft): string {
  if (!d.date) return "ยังไม่ได้เลือกวันที่รับสินค้า";
  if (!d.sender.trim() || !d.receiver.trim()) return "ยังไม่ได้กรอกผู้ส่ง/ผู้รับ";
  if (!d.origin || !d.dest) return "ยังไม่ได้เลือกต้นทาง/ปลายทาง";
  if (!d.serviceGroup) return "ยังไม่ได้เลือกกลุ่มบริการ";
  if (!d.payType) return "ยังไม่ได้เลือกประเภทการชำระเงิน";
  // สเปกบังคับ: ทุกค่าต้องมากกว่า 0 — กันบิลที่มีน้ำหนัก/ขนาดเป็น 0 หรือค่าติดลบ
  for (const [label, v] of [["จำนวน", d.qty], ["น้ำหนักรวม", d.weight],
                            ["กว้าง", d.width], ["ยาว", d.length], ["สูง", d.height],
                            ["ราคาต่อหน่วย", d.unitPrice]] as const) {
    if (!(n(v) > 0)) return `${label} ต้องมากกว่า 0`;
  }
  return "";
}

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

/**
 * สุ่มบิลหนึ่งแถว — ใช้ตอนทดสอบเท่านั้น (ปุ่ม "🎲 สุ่มข้อมูล")
 *
 * ทุกช่องต้องผ่าน `problem()` ของหน้าจอเสมอ (ทุกตัวเลข > 0 · ต้นทาง–ปลายทางเป็นคู่ที่มีจริง)
 * เพื่อกดสุ่มแล้วไปหน้าสรุปได้เลย · วันที่เป็นวันนี้ (ใช้ออกเลขที่บิลตามเดือน) · `key` คงเดิม
 * ให้ React ไม่วาดการ์ดใหม่ทั้งใบ · กลุ่มบริการส่วนใหญ่เป็นสามกลุ่มหลัก นาน ๆ ทีได้บิลเคลียร์/ของเหมาตีเปล่า
 * ★ จำนวน/น้ำหนัก/ขนาด/ราคามาจาก lib/sim/cargo.ts (แบบสินค้าจริง + ค่าขนส่งต่อ กก. ตามระยะทาง) — เดิมสุ่มแยกกัน
 *   ได้ของเบาหวิวแต่ใหญ่หลาย ลบ.ม. ฝ่ายจัดรถรวมใบไม่ได้ (เจ้าของงานสั่งแก้ 24 ก.ย. 2569)
 */
export function randomDraft(key: string = crypto.randomUUID()): Draft {
  const origins = ORIGINS.filter((o) => destsFor(o).length > 0);
  const origin = pick(origins);
  const dest = pick(destsFor(origin));
  const pricingType = pick(PRICE_BASIS);
  const serviceGroup = Math.random() < 0.85 ? pick(SERVICE_GROUPS_V2.slice(0, 3)) : pick(SERVICE_GROUPS_V2.slice(3));
  const c = randomCargo({ cold: serviceGroup === "สินค้าแช่เย็น" || serviceGroup === "สินค้าแช่แข็ง", distKm: distanceFor(origin, dest) ?? 500 });
  return {
    key,
    date: todayISO(),
    branch: pick(BRANCHES.length ? BRANCHES : [""]),
    sender: `ลูกค้าทดสอบ ${int(1, 99)}`,
    receiver: `ผู้รับทดสอบ ${int(1, 99)}`,
    origin, dest, serviceGroup,
    qty: String(c.qty),
    weight: String(c.weight),
    width: String(c.width), length: String(c.length), height: String(c.height),
    payType: pick(PAY_TYPES),
    pricingType,
    // คิดตามน้ำหนักเป็นบาท/กก. คิดตามหน่วยเป็นบาท/ชิ้น — มาจากค่าขนส่งต่อ กก. ตัวเดียวกัน ราคารวมจึงพอ ๆ กัน
    unitPrice: String(pricingType === "คิดตามน้ำหนัก" ? c.perKg : c.perUnit),
  };
}
