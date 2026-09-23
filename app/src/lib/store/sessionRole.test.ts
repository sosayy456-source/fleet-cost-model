/**
 * ค่าที่อ่านจาก sessionStorage ต้องกรองก่อนใช้เสมอ
 * ถ้าปล่อยค่าเพี้ยนผ่าน `ROLES[role]` จะเป็น undefined แล้วแอปพังทั้งหน้าตั้งแต่ render แรก
 */
import { describe, expect, it } from "vitest";
import { parseRole } from "./sessionRole";
import { ROLES } from "../record/roles";

describe("parseRole", () => {
  it("รับทุกตำแหน่งที่มีจริงในระบบ", () => {
    for (const k of Object.keys(ROLES)) expect(parseRole(k)).toBe(k);
  });

  it("ทิ้งค่าที่ไม่ใช่ตำแหน่ง", () => {
    for (const bad of ["", "ceo", "CS", "cs ", "ตำแหน่ง", null, undefined]) {
      expect(parseRole(bad)).toBeNull();
    }
  });

  it("ไม่หลงคุณสมบัติที่ติดมากับ Object.prototype", () => {
    // `"constructor" in ROLES` เป็น true — ถ้าเช็คด้วย `in` จะปล่อยค่านี้ผ่านแล้วพัง
    for (const bad of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(parseRole(bad)).toBeNull();
    }
  });
});
