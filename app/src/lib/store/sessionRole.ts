/**
 * จำตำแหน่งที่เลือกไว้ "เฉพาะแท็บนี้" — ให้รีโหลดแล้วไม่ต้องเลือกใหม่
 *
 * ★ ทำไมเป็น sessionStorage ไม่ใช่ localStorage: `App.tsx` ตั้งใจให้เปิดเว็บใหม่ต้องเลือกตำแหน่งเสมอ
 *   (ตรงตาม main:2129) sessionStorage ตายเมื่อปิดแท็บ ดีไซน์เดิมจึงยังอยู่ ได้แค่ไม่ต้องเลือกซ้ำตอนรีโหลด
 *   ซึ่งเป็นสิ่งที่ต้องการ เพราะ `lazyPage` รีโหลดหน้าเองได้เมื่อ deploy ทับ (ดู `lib/ui/lazyPage.ts`)
 *
 * ★ ห้ามเชื่อค่าที่อ่านมาตรง ๆ — ต้องผ่าน `parseRole()` ก่อน ไม่งั้นค่าที่เพี้ยน
 *   (แก้มือ / ตำแหน่งที่ถูกลบออกจากระบบในอนาคต) จะทำให้ `ROLES[role]` เป็น undefined แล้วแอปพังทั้งหน้า
 */
import { ROLES } from "../record/roles";
import type { RoleKey } from "../../types/record";

const KEY = "sessionRole";

/** คืนค่าเฉพาะที่เป็นตำแหน่งจริงในระบบ นอกนั้นเป็น null */
export function parseRole(raw: string | null | undefined): RoleKey | null {
  if (!raw) return null;
  return Object.prototype.hasOwnProperty.call(ROLES, raw) ? (raw as RoleKey) : null;
}

export function loadSessionRole(): RoleKey | null {
  try {
    return parseRole(sessionStorage.getItem(KEY));
  } catch {
    return null; // โหมดส่วนตัวอ่านไม่ได้ — ถือว่ายังไม่เคยเลือก
  }
}

/** ส่ง null = กด "เปลี่ยนหน้าที่" ให้ลืมของเดิมทิ้ง */
export function saveSessionRole(role: RoleKey | null): void {
  try {
    if (role) sessionStorage.setItem(KEY, role);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* เขียนไม่ได้ก็แค่ไม่จำ ไม่ต้องทำให้แอปพัง */
  }
}
