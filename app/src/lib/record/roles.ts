/**
 * ระบบ 3 ฝ่ายช่วยกันกรอก — ยกจาก v5:1856-1874
 * แต่ละฝ่ายเห็นและแก้ได้เฉพาะโซนของตัวเอง ใบจะสมบูรณ์เมื่อครบทั้ง 3 ฝ่าย
 */
import type { RoleKey, TripRecord } from "../../types/record";

export interface RoleDef {
  label: string;
  icon: string;
  desc: string;
  fields: string[];
}

export const ROLES: Record<RoleKey, RoleDef> = {
  cs: {
    label: "ฝ่ายบริการลูกค้า", icon: "👤",
    desc: "เปิดใบ · เส้นทาง · รายได้ · ลูกหนี้",
    fields: ["date", "docNo", "routeType", "branch", "docType", "origin", "dest",
             "dist", "serviceGroup", "revenue", "bills"],
  },
  dispatch: {
    label: "ฝ่ายเจ้าหน้าที่จัดรถ", icon: "🚚",
    desc: "ทะเบียนรถ · ประเภท/ชนิดรถ · วันที่ปล่อยรถ",
    fields: ["plate", "fleetType", "vehicle", "releaseDate", "capacity", "loadActual", "emptyLeg"],
  },
  account: {
    label: "ฝ่ายบัญชีการเงิน", icon: "🧾",
    desc: "ค่าใช้จ่ายทั้งหมด · ดูแลรายการลูกหนี้",
    fields: ["cost"],
  },
};

export const ROLE_ORDER: RoleKey[] = ["cs", "dispatch", "account"];

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
