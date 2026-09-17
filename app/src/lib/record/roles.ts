/**
 * ระบบหน้าที่ — ยกจาก index.html บน branch main (ROLES v5:2100-2130)
 *
 * มี 5 ตำแหน่ง แต่มีแค่ 3 ตำแหน่งแรกที่ "กรอกใบ" (ROLE_ORDER)
 * ผู้จัดการกับผู้ดูแลระบบเป็นตำแหน่งดูอย่างเดียว/ดูแลระบบ จึงไม่นับในความครบถ้วนของใบ
 *
 * แต่ละตำแหน่งเห็นเมนูไม่เท่ากัน (ROLE_VIEWS) — ฝ่ายบริการลูกค้ากับฝ่ายจัดรถ
 * เห็นแค่หน้ากรอกข้อมูล ส่วนผู้ดูแลระบบเห็นครบทุกหน้า
 */
import { nowStamp } from "./date";
import type { RoleKey, TripRecord } from "../../types/record";

export interface RoleDef {
  label: string;
  /** ชื่ออังกฤษ ใช้ในหน้าเลือกหน้าที่ */
  en: string;
  icon: string;
  desc: string;
  fields: string[];
}

export const ROLES: Record<RoleKey, RoleDef> = {
  cs: {
    label: "ฝ่ายบริการลูกค้า", en: "Customer Service", icon: "👤",
    desc: "รับงาน ติดต่อลูกค้า และบันทึกการจอง",
    fields: ["date", "docNo", "routeType", "branch", "docType", "origin", "dest",
             "dist", "serviceGroup", "revenue", "bills"],
  },
  dispatch: {
    label: "ฝ่ายเจ้าหน้าที่จัดรถ", en: "Fleet Coordinator", icon: "🚚",
    desc: "จัดรถ จัดคนขับ และติดตามเส้นทาง",
    fields: ["plate", "fleetType", "vehicle", "releaseDate", "capacity", "loadActual", "emptyLeg"],
  },
  account: {
    label: "ฝ่ายบัญชีการเงิน", en: "Accounting Department", icon: "🧾",
    desc: "ต้นทุน บิลน้ำมัน และใบแจ้งหนี้",
    fields: ["cost"],
  },
  manager: {
    label: "ผู้จัดการ", en: "Manager", icon: "📊",
    desc: "ภาพรวมทั้งหมด รายงาน และการอนุมัติ",
    fields: [],
  },
  driver: {
    label: "คนขับ", en: "Driver", icon: "🧑‍✈️",
    desc: "ดูงานที่กำลังวิ่ง และกดจบงานเมื่อส่งของเสร็จ",
    // ไม่ได้กรอกช่องไหนในใบ — กดจบงานเขียนตรงผ่าน finishTrip() ไม่ผ่าน saveRecord()
    fields: [],
  },
  admin: {
    label: "ผู้ดูแลระบบ", en: "Admin", icon: "🛠️",
    desc: "เข้าถึงได้ทุกหน้า และกรอกแทนได้ทุกฝ่าย",
    fields: [],
  },
};

/** ตำแหน่งที่กรอกใบ — ใช้ตัดสินว่าใบครบหรือยัง */
export const ROLE_ORDER: RoleKey[] = ["cs", "dispatch", "account"];

/** ลำดับการ์ดในหน้าเลือกหน้าที่ — admin อยู่ท้ายสุดเสมอ เพราะการ์ดใบนั้นกว้างเต็มแถว */
export const ROLE_PICK: RoleKey[] = ["cs", "dispatch", "account", "driver", "manager", "admin"];

/** หน้าที่แต่ละตำแหน่งเข้าได้ — ตัวแรกคือหน้าที่เปิดให้ตอนเข้าระบบ */
export const ROLE_VIEWS: Record<RoleKey, string[]> = {
  cs: ["entry"],
  dispatch: ["entry"],
  account: ["entry", "records", "drafts", "debtors", "settings"],
  // คนขับเห็นหน้าเดียว — เปิดแอปมาก็เจองานของตัวเองเลย
  driver: ["driver"],
  // main ให้ผู้จัดการเห็นแค่ dash กับ records — สองหน้าท้ายเป็นของที่เวอร์ชันนี้เพิ่มเข้ามา
  manager: ["dash-fleet", "records", "dash-revenue", "route-profit", "exec-dash", "all-dash", "driver"],
  admin: ["dash-fleet", "entry", "records", "drafts", "debtors", "custcode", "settings",
          "dash-revenue", "route-profit", "exec-dash", "all-dash", "driver"],
};

export const isEntryRole = (r: RoleKey): boolean => ROLE_ORDER.includes(r);

/** ฝ่ายบัญชีกับผู้ดูแลระบบเปิดแก้โซนของฝ่ายอื่นได้ */
export const canEditOthers = (r: RoleKey): boolean => r === "account" || r === "admin";

export const roleDone = (r: Partial<TripRecord> | null | undefined, k: RoleKey): boolean =>
  !!r?.[`_${k}Done` as keyof TripRecord];

export const roleAllDone = (r: Partial<TripRecord> | null | undefined): boolean =>
  ROLE_ORDER.every((k) => roleDone(r, k));

/** ประทับว่าฝ่ายนี้กรอกแล้ว พร้อมเวลา (รูปแบบ 'YYYY-MM-DD HH:mm' เหมือนเดิม) */
export function stampRole<T extends Partial<TripRecord>>(rec: T, k: RoleKey): T {
  const out = rec as Record<string, unknown>;
  out[`_${k}Done`] = true;
  // ★ ต้องเป็นเวลาเครื่อง ไม่ใช่ UTC — ของเดิมใช้ toISOString() ทำให้เวลาในชีตช้าไป 7 ชั่วโมง
  out[`_${k}At`] = nowStamp();
  return rec;
}

/**
 * เวลาที่ใบนี้ถูกบันทึกล่าสุด — เทียบ _csAt/_dispatchAt/_accountAt ทั้งสามฝ่าย ไม่ใช่ยึด
 * ฝ่ายบัญชีตัวเดียว เพราะใบที่ยังกรอกไม่ครบ (เช่นฝ่ายจัดรถกรอกแล้วแต่บัญชียังไม่กรอก) ก็ยังไม่มี
 * _accountAt แต่ควรโชว์เวลาของฝ่ายที่กรอกล่าสุดแทน · รูปแบบ 'YYYY-MM-DD HH:mm' เทียบสตริงตรงได้
 */
export function lastEditedAt(r: Partial<TripRecord> | null | undefined): string | null {
  if (!r) return null;
  const stamps = ROLE_ORDER
    .map((k) => r[`_${k}At` as keyof TripRecord] as string | undefined)
    .filter((s): s is string => !!s);
  return stamps.length ? stamps.reduce((a, b) => (b > a ? b : a)) : null;
}
