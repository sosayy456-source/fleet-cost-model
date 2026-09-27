/**
 * ชุดเที่ยวที่ใช้คิดกำไร = จับคู่เลขที่ใบรายการกับไฟล์รายได้ได้เท่านั้น
 * หลายหน้าจะมาใช้ชุดนี้ร่วมกัน ถ้านิยามเพี้ยน ตัวเลขกำไรของทุกหน้าจะเพี้ยนพร้อมกัน
 */
import { describe, expect, it } from "vitest";
import { inProfitScope } from "./useCostRev";
import type { Trip } from "./useCostRev";

const t = (m: boolean, empty: boolean) => ({ m, empty } as Trip);

describe("inProfitScope", () => {
  it("เที่ยวที่จับคู่รายได้ได้ = นับ", () => expect(inProfitScope(t(true, false))).toBe(true));
  it("เที่ยววิ่งเปล่าที่จับคู่ไม่ได้ = แสดงเฉพาะแท็บเที่ยวเปล่า", () => expect(inProfitScope(t(false, true))).toBe(false));
  it("มีรายได้แต่จับคู่ไม่ได้ = ไม่นับ (ไม่มีบิลให้คิดจำนวนบิล/ลูกค้า)", () => expect(inProfitScope(t(false, false))).toBe(false));
});
