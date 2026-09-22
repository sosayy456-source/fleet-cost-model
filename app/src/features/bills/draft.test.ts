/**
 * เทสต์ปุ่มสุ่มข้อมูลของหน้าบันทึกบิล — บิลที่สุ่มต้องผ่านการตรวจของหน้าจอทุกครั้ง
 * (กดสุ่มแล้วไปหน้าสรุปได้ทันที) และต้นทาง–ปลายทางต้องเป็นคู่ที่มีในตารางเส้นทางจริง
 */
import { describe, expect, it } from "vitest";
import { destsFor } from "../../lib/refdata";
import { SERVICE_GROUPS_V2 } from "../../types/bill";
import { emptyDraft, problem, randomDraft } from "./draft";

describe("randomDraft", () => {
  it("สุ่ม 500 รอบ ผ่าน problem() ทุกรอบ และเส้นทางมีจริง", () => {
    for (let i = 0; i < 500; i++) {
      const d = randomDraft();
      expect(problem(d)).toBe("");
      expect(destsFor(d.origin)).toContain(d.dest);
      expect(SERVICE_GROUPS_V2 as readonly string[]).toContain(d.serviceGroup);
    }
  });

  it("คง key เดิมของแถว", () => {
    expect(randomDraft("แถว-1").key).toBe("แถว-1");
  });

  it("แถวเปล่ายังไม่ผ่าน (กันเทสต์ข้างบนผ่านเพราะ problem() ไม่ตรวจอะไรเลย)", () => {
    expect(problem(emptyDraft())).not.toBe("");
  });
});
