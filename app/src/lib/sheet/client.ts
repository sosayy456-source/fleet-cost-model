/**
 * ตัวเชื่อม Google Apps Script Web App — ยกจาก postToSheet() ใน v5:1687
 *
 * รายละเอียดที่ห้ามเปลี่ยน ไม่งั้นพังทันที
 * - Content-Type ต้องเป็น "text/plain;charset=utf-8"
 *   เพื่อให้เบราว์เซอร์มองว่าเป็น CORS simple request ไม่ยิง preflight
 *   ฝั่ง Apps Script ไม่มี doOptions ถ้าเปลี่ยนเป็น application/json จะโดนบล็อกทันที
 * - redirect: "follow" เพราะ /exec ตอบ 302 ไป googleusercontent.com ก่อนเสมอ
 * - ต้องเช็ค version ให้ตรง ไม่งั้นสคริปต์เวอร์ชันเก่าจะเขียนข้อมูลผิดคอลัมน์เงียบ ๆ
 */
import type { TripRecord } from "../../types/record";
import type { PendingBill } from "../../types/bill";
import { recordBillRows, recordToRow } from "./serialize";
import type { Cell } from "./serialize";

/** ต้องตรงกับ var VERSION ใน apps-script/Code.gs */
export const GS_VERSION = 17;

const LS_URL = "gsWebAppUrl";
const URL_PATTERN = /^https:\/\/script\.google\.com\/.*\/exec$/;

export const getUrl = (): string => {
  try {
    return (localStorage.getItem(LS_URL) || "").trim();
  } catch {
    return "";
  }
};

export const isValidUrl = (u: string): boolean => URL_PATTERN.test(u.trim());

export function setUrl(u: string): void {
  const url = u.trim();
  if (!isValidUrl(url)) throw new Error("ลิงก์ต้องเป็น .../exec ของ Apps Script");
  localStorage.setItem(LS_URL, url);
}

export interface SheetResponse {
  ok: boolean;
  version?: number;
  error?: string;
  [k: string]: unknown;
}

export class SheetError extends Error {}

/**
 * เกินเวลานี้แล้วยังไม่ตอบ ถือว่าค้าง — ตัดทิ้งแทนที่จะรอเงียบ ๆ ไม่รู้จบ
 * ★ ตั้งไว้สูง (90s) เพราะ Apps Script cold start + สแกนหลายแท็บ (loadOld)
 *   บางครั้งใช้เวลาเกิน 30 วินาทีได้จริงโดยที่ยังไม่ได้ค้างจริง ๆ — ค่าที่ต่ำเกินไปเคยตัด
 *   การบันทึกที่กำลังจะสำเร็จทิ้งไปก่อน (อ่านใบล่าสุดจากชีตไม่สำเร็จ → SaveAbortedError)
 */
const TIMEOUT_MS = 90000;

export async function postToSheet<T extends SheetResponse>(payload: unknown): Promise<T> {
  const url = getUrl();
  if (!url) throw new SheetError("ยังไม่ได้ตั้งค่า URL ของ Web App");

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new SheetError("ไม่มีสัญญาณอินเทอร์เน็ต — ยังใช้ข้อมูลในเครื่องได้");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new SheetError(
        `เซิร์ฟเวอร์ไม่ตอบภายใน ${TIMEOUT_MS / 1000} วินาที — Apps Script อาจกำลังโหลดหนักหรือ URL ไม่ถูกต้อง ลองใหม่อีกครั้ง`,
      );
    }
    throw new SheetError(
      "ติดต่อเซิร์ฟเวอร์ไม่ได้ (network/CORS) — ตรวจว่า URL ลงท้าย /exec และตอน Deploy " +
      "ตั้ง 'Who has access = Anyone' · " + (err as Error).message,
    );
  } finally {
    clearTimeout(timer);
  }

  const txt = await res.text();
  let data: T;
  try {
    data = JSON.parse(txt) as T;
  } catch {
    // Google ส่งหน้า HTML ล็อกอินกลับมาเมื่อสิทธิ์ Deploy ไม่ใช่ Anyone
    if (/accounts\.google\.com|Sign in|ต้องขออนุญาต/i.test(txt)) {
      throw new SheetError(`Google ขอให้ล็อกอิน = สิทธิ์ Deploy ยังไม่ใช่ Anyone (HTTP ${res.status})`);
    }
    // ★ 404 = ไม่มี Web App ที่ลิงก์นี้ Google ตอบหน้า "ไม่พบ" ที่เป็น HTML ล้วน (ขึ้นต้นด้วย
    //   window['ppConfig'] = ...) — ของเดิมโชว์ HTML ดิบให้ผู้ใช้ อ่านแล้วไม่รู้ว่าต้องแก้อะไร
    //   ที่เจอบ่อยคือกด "New deployment" ตอนอัปเดตโค้ด ลิงก์ /exec จึงเปลี่ยน แล้วตัวเก่าถูก Archive
    if (res.status === 404) {
      throw new SheetError(
        "ไม่พบ Web App ที่ลิงก์ /exec นี้ (HTTP 404) — ลิงก์อาจถูกเปลี่ยนหรือ deployment ถูกลบ/Archive · " +
        "เปิด Apps Script → Deploy → Manage deployments คัดลอกลิงก์ของตัวที่ Active มาตั้งค่าใหม่ " +
        "(ครั้งหน้าที่อัปเดตโค้ดให้กด ✏ แก้ไข → Version: New version ลิงก์จะไม่เปลี่ยน)",
      );
    }
    throw new SheetError(
      `ตอบกลับไม่ใช่ JSON (HTTP ${res.status}) · ${txt.replace(/<[^>]*>/g, " ").trim().slice(0, 110)}`,
    );
  }

  if (!data.ok) throw new SheetError(data.error || "ไม่สำเร็จ");
  if (data.version !== GS_VERSION) {
    throw new SheetError(
      `โค้ด Apps Script เป็นเวอร์ชันเก่า (v${data.version ?? "?"} · ต้องการ v${GS_VERSION}) — ` +
      "วางโค้ดจาก apps-script/Code.gs ใหม่ แล้ว Deploy → Manage deployments → " +
      "✏ แก้ไข → Version: New version → Deploy",
    );
  }
  return data;
}

// ───────────────────────── action ที่ backend รองรับ ─────────────────────────

export interface PingResult extends SheetResponse {
  pong: boolean;
  sheet?: string;
  url?: string;
}

export const ping = (): Promise<PingResult> => postToSheet<PingResult>({ ping: true });

interface TripsResult extends SheetResponse { records?: TripRecord[] }

/** ใบรายการ "ใหม่" ทั้งหมดที่อยู่ในชีต */
export async function loadTrips(): Promise<TripRecord[]> {
  if (!getUrl()) return [];
  const res = await postToSheet<TripsResult>({ loadTrips: true });
  return res.records ?? [];
}

interface TripResult extends SheetResponse { record?: TripRecord | null }

/**
 * ใบเดียวจากชีต — ตามไอดีก่อน ไม่เจอค่อยตามเลขที่ใบ · null = ยังไม่มีบนชีต
 * ใช้ตอนบันทึกแทน loadTrips() ที่ส่ง JSON ทุกใบกลับมา (ยิ่งใบเยอะยิ่งบันทึกช้า)
 */
export async function loadTrip(id: string, docNo: string): Promise<TripRecord | null> {
  if (!getUrl()) return null;
  const res = await postToSheet<TripResult>({ loadTrip: { id, docNo } });
  return res.record ?? null;
}

interface OldResult extends SheetResponse {
  records?: Record<string, unknown>[];
  debtors?: Record<string, unknown>[];
}

/**
 * ข้อมูลเก่าจากทุกแท็บที่ชื่อขึ้นต้นด้วย "ข้อมูลเก่า" — อ่านอย่างเดียว
 * รวมถึงแถวในแท็บ "ข้อมูลใหม่" ที่พิมพ์ตรงในชีตเอง (ไม่ผ่านฟอร์มแอป) — Apps Script
 * ติดป้าย source ให้ต่อแถวแล้ว ("เก่า"/"ใหม่") จึงไม่ทับค่านี้จากฝั่งหน้าเว็บอีก
 */
export async function loadOld(): Promise<{
  records: Record<string, unknown>[];
  debtors: Record<string, unknown>[];
}> {
  if (!getUrl()) return { records: [], debtors: [] };
  const res = await postToSheet<OldResult>({ loadOld: true });
  return {
    records: (res.records ?? []).map((r) => ({ source: "เก่า", ...r, bills: [] })),
    debtors: (res.debtors ?? []).map((d) => ({ source: "เก่า", ...d })),
  };
}

export interface PushResult extends SheetResponse {
  added?: number;
  updated?: number;
  bills?: number;
  merged?: number;
}

/**
 * เขียนใบรายการ + บิลลงชีต เป็น upsert โดยใช้คอลัมน์ ID เป็นคีย์
 * ★ ต้องส่ง records (JSON เต็มของแต่ละใบ) คู่กับ rows เสมอ — Apps Script เอาไปเก็บในคอลัมน์ _DATA
 *   (เรียงตรงกับ rows ตามดัชนี ดู body.records ใน doPost ของ apps-script/Code.gs)
 *   ถ้าลืมส่ง _DATA จะว่างตลอด ทำให้ loadTrips()/readTripRecords_() หาใบนี้ไม่เจอ
 *   และ readManualNewRecords_() จะเข้าใจผิดว่าเป็นแถวที่พิมพ์ตรงในชีตเอง เกิดโชว์ซ้ำกับของในเครื่อง
 */
export function pushRecords(list: TripRecord[]): Promise<PushResult> {
  const bills: Cell[][] = [];
  for (const r of list) for (const row of recordBillRows(r)) bills.push(row);
  return postToSheet<PushResult>({
    rows: list.map(recordToRow),
    records: list,
    bills,
    billOwners: list.map((r) => r.id),
  });
}

/* ───────────────────────── บิลรอจัดรถ (แท็บใหม่ v17) ───────────────────────── */

/**
 * บิลที่ฝ่ายบริการลูกค้ากรอก — เก็บในชีตเพราะ CS กับฝ่ายจัดรถอยู่คนละเครื่อง
 * ส่งเป็น JSON ทั้งก้อน (ไม่ใช่แถวคอลัมน์เหมือนใบรายการ) เพราะชีตแท็บนี้เป็นของโมเดลล้วน ๆ
 * ไม่ต้องตรงกับรูปแบบรายงานเดิมของบริษัท — Apps Script กางเป็นคอลัมน์ให้อ่านด้วยตาได้อยู่แล้ว
 */
export async function loadBills(): Promise<PendingBill[]> {
  const res = await postToSheet<SheetResponse & { bills?: PendingBill[] }>({ loadBills: true });
  return (res.bills ?? []).map((b) => ({ ...b, synced: true }));
}

/** upsert บิลด้วยคีย์ id — ส่งเฉพาะบิลที่เปลี่ยน ไม่ต้องส่งทั้งชุด */
export function pushBills(list: PendingBill[]): Promise<SheetResponse & { added?: number; updated?: number }> {
  return postToSheet<SheetResponse & { added?: number; updated?: number }>({ pendingBills: list });
}

/**
 * เขียน log การจบงานลงแท็บ "จบงาน" — เขียนต่อท้ายอย่างเดียว ไม่ upsert
 * แยกจาก pushRecords() เพราะเป็นคนละแท็บและคนละความหมาย:
 * ใบรายการถือ "สถานะปัจจุบัน" ส่วนแท็บนี้คือ "ประวัติว่าใครกดจบเมื่อไหร่"
 * ผู้เรียกต้องห่อ try/catch แยก — log ที่เขียนไม่ได้ต้องไม่ทำให้การบันทึกใบล้มไปด้วย
 */
export function pushFinishLog(rows: Cell[][]): Promise<SheetResponse & { logged?: number }> {
  return postToSheet<SheetResponse & { logged?: number }>({ finishLog: rows });
}
