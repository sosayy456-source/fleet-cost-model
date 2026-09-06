/**
 * ระบบหน้าที่ — ยกจาก index.html บน branch main (ROLES v5:2100-2130)
 *
 * มี 5 ตำแหน่ง แต่มีแค่ 3 ตำแหน่งแรกที่ "กรอกใบ" (ROLE_ORDER)
 * ผู้จัดการกับผู้ดูแลระบบเป็นตำแหน่งดูอย่างเดียว/ดูแลระบบ จึงไม่นับในความครบถ้วนของใบ
 *
 * แต่ละตำแหน่งเห็นเมนูไม่เท่ากัน (ROLE_VIEWS) — ฝ่ายบริการลูกค้ากับฝ่ายจัดรถ
 * เห็นแค่หน้ากรอกข้อมูล ส่วนผู้ดูแลระบบเห็นครบทุกหน้า
 */
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
  admin: {
    label: "ผู้ดูแลระบบ", en: "Admin", icon: "🛠️",
    desc: "เข้าถึงได้ทุกหน้า และกรอกแทนได้ทุกฝ่าย",
    fields: [],
  },
};

/** ตำแหน่งที่กรอกใบ — ใช้ตัดสินว่าใบครบหรือยัง */
export const ROLE_ORDER: RoleKey[] = ["cs", "dispatch", "account"];

/** ลำดับการ์ดในหน้าเลือกหน้าที่ */
export const ROLE_PICK: RoleKey[] = ["cs", "dispatch", "account", "manager", "admin"];

/** หน้าที่แต่ละตำแหน่งเข้าได้ — ตัวแรกคือหน้าที่เปิดให้ตอนเข้าระบบ */
export const ROLE_VIEWS: Record<RoleKey, string[]> = {
  cs: ["entry"],
  dispatch: ["entry"],
  account: ["entry", "records", "drafts", "debtors", "settings"],
  manager: ["dash-fleet", "records", "dash-revenue", "route-profit"],
  admin: ["dash-fleet", "entry", "records", "drafts", "debtors",
          "dash-revenue", "route-profit", "custcode", "settings"],
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
  out[`_${k}At`] = new Date().toISOString().slice(0, 16).replace("T", " ");
  return rec;
}
