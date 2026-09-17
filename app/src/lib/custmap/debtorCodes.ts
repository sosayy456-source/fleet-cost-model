/**
 * รหัส CUS ของลูกหนี้จากไฟล์ใบวางบิล — ออกโดย etl/build_debtors.py เขียนไว้ที่
 * data/<ds>/debtors/codes.json  (รหัสลูกหนี้ 40 ตัว -> เลขในรหัส CUS)
 *
 * ★ ทำไมต้องเป็นชุดที่สาม
 *   custmap.bin เก็บรหัสต้นฉบับยาว **64 ตัว** (SHA-256) จากไฟล์บิล
 *   แต่รหัสลูกหนี้ในไฟล์ใบวางบิลยาว **40 ตัว** (SHA-1) — คนละการ hash กัน
 *   หากันไม่เจอตลอดกาล แม้เป็นบริษัทเดียวกัน จึงต้องออกเลขใหม่ให้ต่อจากท้ายไฟล์
 *
 * ★ ใช้พื้นที่เลขเดียวกับ localStorage "custNewCodes"
 *   nextNumber() ใน newCodes.ts จึงต้องนับ `next` ของไฟล์นี้ด้วย ไม่งั้นรหัสที่ระบบ
 *   ออกให้ลูกค้ารายใหม่จะไปทับเลขของลูกหนี้ที่ ETL ออกไว้แล้ว
 *
 * ★ ไม่มีไฟล์ = คืน null ไม่โยน error — แอปต้องเปิดได้แม้ยังไม่เคยรัน build_debtors.py
 */
import { useEffect, useState } from "react";
import { detectDebtorDataset, debtorUrl } from "../data/useDebtors";

export interface DebtorCodes {
  /** จำนวนระเบียนใน custmap.bin ตอนที่ ETL ออกเลข — เลขแรกของลูกหนี้คือ base + 1 */
  base: number;
  /** เลขถัดไปที่ยังว่าง (มากกว่าเลขสุดท้ายที่ออกไปแล้ว 1) */
  next: number;
  /** รหัสลูกหนี้ -> เลขในรหัส CUS */
  codes: Record<string, number>;
}

let cache: Promise<DebtorCodes | null> | null = null;
let peeked: DebtorCodes | null = null;
/** เคยลองโหลดแล้วหรือยัง — ผู้ที่จะออกรหัสใหม่ต้องรอให้ลองก่อน ไม่งั้นเสี่ยงออกเลขทับ */
let attempted = false;

/** โหลดครั้งเดียวแล้วใช้ซ้ำ — ไม่มีไฟล์ก็คืน null เงียบ ๆ */
export function ensureDebtorCodes(): Promise<DebtorCodes | null> {
  cache ??= (async () => {
    try {
      const ds = await detectDebtorDataset();
      const res = await fetch(debtorUrl(ds, "codes.json"), { cache: "no-store" });
      const isJson = (res.headers.get("content-type") ?? "").includes("json");
      if (!res.ok || !isJson) return null;
      const raw = (await res.json()) as Partial<DebtorCodes>;
      const codes: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw.codes ?? {})) {
        const n = Number(v);
        if (k && Number.isFinite(n) && n > 0) codes[k.toLowerCase()] = n;
      }
      peeked = { base: Number(raw.base) || 0, next: Number(raw.next) || 0, codes };
      return peeked;
    } catch {
      return null;
    } finally {
      attempted = true;
    }
  })();
  return cache;
}

/** ชุดที่โหลดไว้แล้ว — null ถ้ายังไม่ได้โหลดหรือไม่มีไฟล์ */
export const peekDebtorCodes = (): DebtorCodes | null => peeked;

/** เคยลองโหลดแล้วหรือยัง (สำเร็จหรือไม่ก็ตาม) */
export const debtorCodesAttempted = (): boolean => attempted;

/** รหัสลูกหนี้ -> รหัสย่อ CUS · null ถ้าไม่มีในชุดนี้ */
export function numberForDebtor(hash: string | null | undefined): number | null {
  const s = String(hash ?? "").trim().toLowerCase();
  if (!s) return null;
  return peeked?.codes[s] ?? null;
}

/** เลข CUS -> รหัสลูกหนี้ต้นฉบับ · null ถ้าเลขนี้ไม่ใช่ของลูกหนี้ */
export function debtorOfNumber(n: number): string | null {
  const c = peeked;
  if (!c) return null;
  for (const [hash, v] of Object.entries(c.codes)) if (v === n) return hash;
  return null;
}

/** ล้าง cache — ใช้ตอนกดรีเฟรชหลังรัน ETL ใหม่ */
export function resetDebtorCodes(): void {
  cache = null;
  peeked = null;
  attempted = false;
}

/**
 * โหลดชุดรหัสลูกหนี้แล้ว re-render เมื่อพร้อม — หน้าไหนที่จะแสดงรหัสหรือออกรหัสต้องเรียก
 * (ไม่ใช่ hook ที่ "ออกรหัส" แค่โหลดตารางมาอ่าน จึงเรียกตอน render ได้)
 */
export function useDebtorCodes(): DebtorCodes | null {
  const [codes, setCodes] = useState<DebtorCodes | null>(peeked);
  useEffect(() => {
    let alive = true;
    ensureDebtorCodes().then((c) => { if (alive) setCodes(c); });
    return () => { alive = false; };
  }, []);
  return codes;
}
