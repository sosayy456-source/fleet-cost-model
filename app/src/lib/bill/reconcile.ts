/**
 * บิลที่ "ค้างครึ่งทาง" — อยู่ในใบรายการแล้ว แต่สถานะบิลยังเป็น "รอจัดรถ"
 *
 * การจัดรถมีสองขั้น: สร้างใบรายการ → ประทับเลขที่ใบรายการลงบิล ถ้าขั้นแรกสำเร็จแต่ขั้นสองส่งขึ้นชีต
 * ไม่ผ่าน (เน็ตหลุดกลางทาง · ส่งถึงชีตแล้วแต่คำตอบหาย) บิลบนชีตจะยังเป็น "รอจัดรถ" ทั้งที่ถูกจัดไปแล้ว
 * ถ้าไม่แยกออก ฝ่ายจัดรถ (เครื่องนี้หรือเครื่องอื่น) จะเห็นบิลนั้นว่างให้จัดอีกรอบ แล้วได้ใบรายการซ้ำ
 * คนขับก็จะเห็นงานเกินมา
 *
 * ★ จับคู่ด้วย เลขที่บิล + ผู้ส่ง เพราะ TripRecord.bills ไม่ได้เก็บ id ของบิล
 *   (เลขที่บิลเดี่ยว ๆ อาจชนกับบิลที่พิมพ์เองในใบรูปแบบเก่า)
 */
import type { PendingBill } from "../../types/bill";
import type { TripRecord } from "../../types/record";

export const billTripKey = (b: { no: string; sender: string }): string => `${b.no}\u0000${b.sender}`;

export interface StuckBill { bill: PendingBill; docNo: string }

/** แยกบิล "รอจัดรถ" เป็น ที่จัดได้จริง กับ ที่อยู่ในใบรายการแล้ว (พร้อมเลขที่ใบนั้น) */
export function splitStuckBills(
  pending: PendingBill[],
  records: Pick<TripRecord, "docNo" | "bills">[],
): { free: PendingBill[]; stuck: StuckBill[] } {
  const docOf = new Map<string, string>();
  for (const r of records) {
    if (!r.docNo) continue;
    for (const b of r.bills ?? []) if (b.no) docOf.set(billTripKey(b), r.docNo);
  }
  const free: PendingBill[] = [];
  const stuck: StuckBill[] = [];
  for (const b of pending) {
    const docNo = docOf.get(billTripKey(b));
    if (docNo) stuck.push({ bill: b, docNo }); else free.push(b);
  }
  return { free, stuck };
}
