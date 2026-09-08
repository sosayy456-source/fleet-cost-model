/**
 * รหัสลูกค้าที่ระบบออกใหม่เอง — ยกจาก CUST_NEW / custRegister ใน index.html บน main (:1598-1647)
 *
 * ไฟล์ แปลงรหัสลูกหนี้รวม.xlsx มีลูกค้า 584,941 ราย แต่ใบรายการที่กรอกใหม่มีลูกค้า
 * ที่ไม่อยู่ในไฟล์ได้ (ลูกค้าใหม่ หรือกรอกเป็นชื่อบริษัทตรง ๆ ไม่ใช่รหัส hash)
 * ระบบจึงรันเลขต่อจากตัวสุดท้ายของไฟล์ให้ — CUS0584942, CUS0584943, …
 *
 * ใช้คีย์ localStorage ตัวเดิม "custNewCodes" เพื่อให้คนที่เคยใช้ v5 เปิดแอปนี้แล้วรหัสไม่เลื่อน
 *
 * ★ กุญแจของแมปคือ "ค่าต้นฉบับที่กรอก" แบบเป๊ะทั้งสตริง (trim แล้ว) ไม่ใช่ตัวขึ้นต้น
 *   จะเป็น hash 64 ตัวหรือชื่อบริษัทก็ได้ — คนละรายที่พิมพ์ต่างกันจึงได้คนละรหัสเสมอ
 *
 * ★ ห้ามออกรหัสตอน render — ต้องออกตอน "กดบันทึก" เท่านั้น (registerBills)
 *   ไม่งั้นแค่เปิดหน้าดูใบก็กินเลขไปเรื่อย ๆ ทั้งที่ยังไม่ได้บันทึกอะไร
 */
import { useCallback, useEffect, useState } from "react";
import { custCode, peekCustMap } from "./custmap";

const LS_KEY = "custNewCodes";
/** เหตุการณ์ของหน้าต่างเดียวกัน — storage event ไม่ยิงให้แท็บที่เขียนเอง */
const EV = "custNewCodes:changed";

/** ค่าต้นฉบับ -> เลขในรหัส CUS */
export type NewCodeMap = Record<string, number>;

export function loadNewCodes(): NewCodeMap {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: NewCodeMap = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function save(map: NewCodeMap): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* โควตาเต็ม/โหมดส่วนตัว */ }
  dispatchEvent(new Event(EV));
}

/**
 * จำนวนรหัสในไฟล์แปลงรหัส — ใช้เป็นฐานของเลขถัดไป
 * ถ้ายังไม่ได้โหลดตาราง (ผู้ใช้ยังไม่เข้าหน้าค้นรหัส) จะเป็น 0 ซึ่งทำให้ออกเลขทับของเดิมได้
 * จึงต้อง await ensureCustMap() ก่อนเรียก registerBills เสมอ — main ก็ทำแบบเดียวกัน (custEnsure)
 */
const fileCount = (): number => peekCustMap()?.count ?? 0;

/** เลขถัดไปที่จะออก — ต่อจากทั้งไฟล์และรหัสที่เคยออกไปแล้ว */
export function nextNumber(map: NewCodeMap = loadNewCodes()): number {
  let mx = fileCount();
  for (const n of Object.values(map)) if (n > mx) mx = n;
  return mx + 1;
}

/** ค่าต้นฉบับนี้มีรหัสอยู่แล้วไหม — อ่านอย่างเดียว ไม่ออกรหัสใหม่ */
export function lookupCustomer(orig: string | null | undefined, map?: NewCodeMap): string | null {
  const s = String(orig ?? "").trim();
  if (!s) return null;
  const m = map ?? loadNewCodes();
  const own = m[s];
  if (own) return custCode(own);
  return peekCustMap()?.codeFor(s) ?? null;
}

/** ค่าต้นฉบับนี้เป็นรหัสที่ระบบออกเองไหม (ไม่ได้มาจากไฟล์) */
export function isOwnCode(orig: string | null | undefined, map?: NewCodeMap): boolean {
  const s = String(orig ?? "").trim();
  return !!s && !!(map ?? loadNewCodes())[s];
}

/**
 * ลงทะเบียนลูกค้าทุกรายในบิล แล้วคืนจำนวนรหัสที่ออกใหม่รอบนี้
 * เขียนลง localStorage ครั้งเดียวตอนจบ ไม่ใช่ทีละราย
 */
export function registerBills(bills: { sender?: string; receiver?: string }[]): number {
  // ไม่มีตาราง = ไม่รู้ว่าไฟล์มีถึงเลขไหน ออกรหัสไปจะทับของเดิม — ยอมไม่ออกดีกว่า
  if (!peekCustMap()) return 0;
  const map = loadNewCodes();
  let next = nextNumber(map);
  let issued = 0;
  for (const b of bills ?? []) {
    for (const raw of [b.sender, b.receiver]) {
      const s = String(raw ?? "").trim();
      if (!s || map[s] || peekCustMap()?.codeFor(s)) continue;
      map[s] = next++;
      issued++;
    }
  }
  if (issued) save(map);
  return issued;
}

/** ล้างรหัสที่ออกใหม่ทั้งหมด — ไม่กระทบรหัสจากไฟล์ */
export function clearNewCodes(): void {
  save({});
}

/** รายการสำหรับตารางในหน้าค้นรหัส เรียงตามเลขรหัส */
export interface NewCodeRow { orig: string; n: number; code: string }

export function newCodeRows(map: NewCodeMap = loadNewCodes()): NewCodeRow[] {
  return Object.entries(map)
    .map(([orig, n]) => ({ orig, n, code: custCode(n) }))
    .sort((a, b) => a.n - b.n);
}

/** รหัสย่อ -> ค่าต้นฉบับที่ระบบออกให้ (เฉพาะเลขที่เกินช่วงของไฟล์) */
export function origOfCode(code: string, map: NewCodeMap = loadNewCodes()): string | null {
  const m = /^CUS(\d{7})$/i.exec(code.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Object.entries(map).find(([, v]) => v === n)?.[0] ?? null;
}

export function useNewCodes(): NewCodeMap {
  const [map, setMap] = useState<NewCodeMap>(loadNewCodes);
  const sync = useCallback(() => setMap(loadNewCodes()), []);
  useEffect(() => {
    addEventListener(EV, sync);
    addEventListener("storage", sync);
    return () => { removeEventListener(EV, sync); removeEventListener("storage", sync); };
  }, [sync]);
  return map;
}
