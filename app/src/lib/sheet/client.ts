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
import { recordBillRows, recordToRow } from "./serialize";
import type { Cell } from "./serialize";

/** ต้องตรงกับ var VERSION ใน apps-script/Code.gs */
export const GS_VERSION = 10;

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

export async function postToSheet<T extends SheetResponse>(payload: unknown): Promise<T> {
  const url = getUrl();
  if (!url) throw new SheetError("ยังไม่ได้ตั้งค่า URL ของ Web App");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch (err) {
    throw new SheetError(
      "ติดต่อเซิร์ฟเวอร์ไม่ได้ (network/CORS) — ตรวจว่า URL ลงท้าย /exec และตอน Deploy " +
      "ตั้ง 'Who has access = Anyone' · " + (err as Error).message,
    );
  }

  const txt = await res.text();
  let data: T;
  try {
    data = JSON.parse(txt) as T;
  } catch {
    // Google ส่งหน้า HTML ล็อกอินกลับมาเมื่อสิทธิ์ Deploy ไม่ใช่ Anyone
    const hint = /accounts\.google\.com|Sign in|ต้องขออนุญาต/i.test(txt)
      ? "Google ขอให้ล็อกอิน = สิทธิ์ Deploy ยังไม่ใช่ Anyone"
      : "ตอบกลับไม่ใช่ JSON";
    throw new SheetError(
      `${hint} (HTTP ${res.status}) · ${txt.replace(/<[^>]*>/g, " ").trim().slice(0, 110)}`,
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

// ───────────────────────── 4 action ที่ backend รองรับ ─────────────────────────

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

interface OldResult extends SheetResponse {
  records?: Record<string, unknown>[];
  debtors?: Record<string, unknown>[];
}

/** ข้อมูลเก่าจากทุกแท็บที่ชื่อขึ้นต้นด้วย "ข้อมูลเก่า" — อ่านอย่างเดียว */
export async function loadOld(): Promise<{
  records: Record<string, unknown>[];
  debtors: Record<string, unknown>[];
}> {
  if (!getUrl()) return { records: [], debtors: [] };
  const res = await postToSheet<OldResult>({ loadOld: true });
  return {
    records: (res.records ?? []).map((r) => ({ ...r, source: "เก่า", bills: [] })),
    debtors: (res.debtors ?? []).map((d) => ({ ...d, source: "เก่า" })),
  };
}

export interface PushResult extends SheetResponse {
  added?: number;
  updated?: number;
  bills?: number;
  merged?: number;
}

/** เขียนใบรายการ + บิลลงชีต เป็น upsert โดยใช้คอลัมน์ ID เป็นคีย์ */
export function pushRecords(list: TripRecord[]): Promise<PushResult> {
  const bills: Cell[][] = [];
  for (const r of list) for (const row of recordBillRows(r)) bills.push(row);
  return postToSheet<PushResult>({
    rows: list.map(recordToRow),
    bills,
    billOwners: list.map((r) => r.id),
  });
}
