/**
 * ทำซ้ำใบรายการ — สำหรับงานเดินรถเส้นทางเดิมที่วิ่งซ้ำแทบทุกวัน
 *
 * หลักคิด: เก็บ "เนื้องาน" ไว้ทั้งหมด (เส้นทาง รถ ลูกค้า ต้นทุน) แต่ล้างทุกอย่าง
 * ที่ผูกกับใบเดิมใบเดียวจนไม่มีทางใช้ซ้ำได้ ถ้าคัดลอกมาทั้งดุ้นจะเกิดสองปัญหา:
 *
 *   เลขที่ใบซ้ำ  save.ts จับคู่ใบด้วย docNo เมื่อ id ไม่ตรง ใบใหม่จะไปทับใบเดิมบนชีต
 *   หนี้ผี      บิลที่ชำระแล้วจะถูกคัดลอกมาพร้อมสถานะ "ชำระแล้ว" ทั้งที่ยังไม่ได้เก็บเงิน
 *
 * ★ ธงว่าฝ่ายไหนกรอกแล้วต้องล้างด้วย — ใบใหม่ยังไม่ผ่านมือใครเลย ต้องเริ่มนับใหม่
 *   (ผู้ดูแลระบบกดบันทึกทีเดียวจะถูกประทับครบสามฝ่ายให้เองใน save.ts อยู่แล้ว)
 *
 * ต้นทุนคัดลอกมาด้วยตั้งใจ — เส้นทางเดิมค่าใช้จ่ายใกล้เคียงกัน ฝ่ายบัญชีแก้ตัวเลข
 * ที่ต่างทีหลังเร็วกว่ากรอกใหม่ทั้งใบ ยอดรวมถูกคำนวณใหม่ตอนบันทึกอยู่แล้ว
 */
import { genId, todayISO } from "./date";
import { recBills } from "./payment";
import { ROLE_ORDER } from "./roles";
import type { TripRecord } from "../../types/record";

export function duplicateRecord(src: TripRecord): TripRecord {
  const copy = {
    ...src,
    id: genId(),
    /** ต้องกรอกใหม่ — ปล่อยว่างไว้ให้เห็นชัดว่ายังไม่ได้ใส่ */
    docNo: "",
    date: todayISO(),
    /** วันปล่อยรถของเที่ยวเดิม ใช้กับเที่ยวใหม่ไม่ได้ */
    releaseDate: "",
    source: "ใหม่" as const,
    synced: false,
    bills: recBills(src).map((b) => ({ ...b, no: "", paid: false, payDate: null })),
  } as unknown as Record<string, unknown>;

  for (const k of ROLE_ORDER) {
    delete copy[`_${k}Done`];
    delete copy[`_${k}At`];
  }

  return copy as unknown as TripRecord;
}
