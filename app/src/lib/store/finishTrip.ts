/**
 * กดจบงาน — คนขับ (หรือผู้จัดการกดแทน) ยืนยันว่าเที่ยวนี้ส่งของเสร็จแล้ว
 * รถกลับมาว่างทันทีโดยไม่ต้องรอถึงวันที่ประมาณการไว้
 *
 * ★ ห้ามเรียกผ่าน saveRecord() — ตัวนั้นโหลดใบจากชีตแล้วทับเฉพาะช่องที่ "ฝ่ายของผู้กด"
 *   เป็นเจ้าของตาม fieldsOwnedBy() ฟิลด์ _tripDone* ไม่มีฝ่ายไหนเป็นเจ้าของ จะถูกทิ้งเงียบ ๆ
 *   จึงเขียนตรงแบบเดียวกับปุ่ม "บันทึกจ่าย" ใน RecordsList (put → push → put synced)
 *
 * การ spread ใบเดิมทั้งใบทำให้ไม่มีทางไปทับงานของฝ่ายอื่น — เติมแค่ 4 ฟิลด์ของตัวเอง
 */
import { put } from "./records";
import { pushFinishLog, pushRecords } from "../sheet/client";
import { nowStamp, thSlashSafe, todayISO } from "../record/date";
import { tripEta, tripStart } from "../record/tripEta";
import type { Cell } from "../sheet/serialize";
import type { RoleKey, TripRecord } from "../../types/record";

/** ประทับสถานะจบงานลงใบ (ยังไม่เขียนลงที่เก็บ) — แยกไว้ให้เทสต์เรียกตรงได้ */
export function markFinished(r: TripRecord, by: RoleKey): TripRecord {
  return {
    ...r,
    _tripDone: true,
    _tripDoneDate: todayISO(),
    _tripDoneAt: nowStamp(),
    _tripDoneBy: by,
    synced: false,
  };
}

/** แถวที่จะต่อท้ายแท็บ "จบงาน" — ลำดับต้องตรงกับ DONE_HEADERS ใน apps-script/Code.gs */
export function finishLogRow(r: TripRecord, by: RoleKey): Cell[] {
  return [
    r._tripDoneAt ?? nowStamp(),
    r.id,
    r.docNo || "",
    r.plate || "",
    r.origin || "",
    r.dest || "",
    thSlashSafe(tripStart(r)),
    Number(r.dist) || "",
    thSlashSafe(tripEta(r)),
    thSlashSafe(r._tripDoneDate ?? todayISO()),
    by,
  ];
}

export interface FinishResult {
  record: TripRecord;
  /** ขึ้นชีตแล้วหรือยัง — false = ออฟไลน์ เก็บในเครื่องไว้ก่อน รอซิงก์รอบหน้า */
  pushed: boolean;
  /** log ขึ้นแท็บ "จบงาน" แล้วหรือยัง */
  logged: boolean;
}

/**
 * บันทึกว่าเที่ยวนี้จบแล้ว — เขียนลงเครื่องก่อนเสมอ แล้วค่อยพยายามส่งขึ้นชีต
 * ออฟไลน์ก็ไม่ throw เพราะใบถูกเก็บลง IndexedDB ด้วย synced:false รอซิงก์รอบหน้าแล้ว
 */
export async function finishTrip(r: TripRecord, by: RoleKey): Promise<FinishResult> {
  const next = markFinished(r, by);
  await put(next);

  let pushed = false;
  try {
    await pushRecords([next]);
    await put({ ...next, synced: true });
    pushed = true;
  } catch { /* ออฟไลน์ — ใบอยู่ในเครื่องแล้ว รอซิงก์รอบหน้า */ }

  // แยก try ต่างหาก: log ที่เขียนไม่ได้ต้องไม่ทำให้สถานะใบที่บันทึกสำเร็จแล้วดูเหมือนล้มเหลว
  let logged = false;
  try {
    await pushFinishLog([finishLogRow(next, by)]);
    logged = true;
  } catch { /* log ไม่ขึ้นก็ไม่เป็นไร สถานะบนใบคือตัวจริง */ }

  return { record: pushed ? { ...next, synced: true } : next, pushed, logged };
}
