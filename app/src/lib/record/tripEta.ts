/**
 * ความคืบหน้าของเที่ยววิ่ง — ใช้เดาว่ารถคันหนึ่ง "ยังวิ่งอยู่" หรือ "ว่างแล้ว"
 *
 * ระบบไม่มี GPS/telematics รู้แค่สิ่งที่กรอกในใบรายการ จึงประมาณเอาจากระยะทาง:
 * ออกวันไหน + วิ่งได้วันละ KM_PER_DAY = น่าจะถึงวันไหน
 *
 * ★ ทางถอยเมื่อไม่รู้ระยะทางจำเป็นจริง ไม่ใช่ของเผื่อ — ช่อง "ระยะทาง" ผู้ใช้แก้เองได้และ
 *   ปล่อยเป็น 0 ได้ ส่วน distanceFor() ก็คืน null เมื่อเส้นทางไม่มีในตาราง ถ้าไม่มีทางถอย
 *   ใบพวกนี้จะค้างสถานะ "กำลังเดินทาง" ตลอดกาล
 */
import { addDaysISO, todayISO } from "./date";
import { distanceFor } from "../refdata";
import type { TripRecord } from "../../types/record";

/** สมมติฐานเดียวของทั้งระบบ — ตรึงไว้ ไม่มีหน้าตั้งค่า */
export const KM_PER_DAY = 500;

/** วันที่เริ่มนับว่าออกวิ่ง — วันปล่อยรถของฝ่ายจัดรถก่อน ไม่มีค่อยใช้วันที่ในใบ */
export const tripStart = (r: Partial<TripRecord>): string => r.releaseDate || r.date || "";

/** ระยะทางของเที่ยวนี้ — ค่าที่กรอกไว้ก่อน ไม่มีค่อยเปิดตารางเส้นทาง */
export function tripDist(r: Partial<TripRecord>): number | null {
  const own = Number(r.dist);
  if (Number.isFinite(own) && own > 0) return own;
  return distanceFor(r.origin ?? "", r.dest ?? "");
}

/** วันที่คาดว่าจะถึงปลายทาง — null = ไม่รู้ระยะทาง เลยประมาณไม่ได้ */
export function tripEta(r: Partial<TripRecord>): string | null {
  const start = tripStart(r);
  const dist = tripDist(r);
  if (!start || dist == null || dist <= 0) return null;
  // เที่ยวสั้นกว่าหนึ่งวันก็ยังกินเวลาอย่างน้อย 1 วัน
  return addDaysISO(start, Math.max(1, Math.ceil(dist / KM_PER_DAY)));
}

export const tripDone = (r: Partial<TripRecord>): boolean => !!r._tripDone;

export interface TripProgress {
  /** วันที่เริ่มนับว่าออกวิ่ง ('' = ไม่รู้) */
  start: string;
  dist: number | null;
  /** วันที่คาดว่าจะเสร็จ (null = ไม่รู้ระยะทาง) */
  eta: string | null;
  /** คนขับ/ผู้จัดการกดจบงานแล้ว */
  done: boolean;
  /** ตอนนี้ถือว่ายังวิ่งอยู่ */
  moving: boolean;
}

export function tripProgress(r: Partial<TripRecord>, today = todayISO()): TripProgress {
  const start = tripStart(r);
  const dist = tripDist(r);
  const eta = tripEta(r);
  const done = tripDone(r);
  // ยังไม่ถึงวันปล่อยรถก็ยังไม่นับว่าออกวิ่ง (ใบที่ลงวันไว้ล่วงหน้า)
  // ไม่รู้ ETA → ถอยไปใช้กฎเดิม "ออกวันนี้ = กำลังวิ่ง"
  const moving = !done && !!start && today >= start
    && (eta ? today <= eta : today === start);
  return { start, dist, eta, done, moving };
}
