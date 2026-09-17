/**
 * เทสต์ปุ่มสุ่มข้อมูลรายฝ่าย — ต้องไม่แตะช่องของฝ่ายอื่น และไม่ทำให้เลขที่ใบ/วันที่เพี้ยน
 * (ของเดิมสุ่มทั้งใบใหม่ทุกครั้ง ฝ่ายจัดรถกดสุ่มแล้วหลุดจากใบของฝ่าย cs)
 */
import { describe, expect, it } from "vitest";
import { randomFor } from "./randomRecord";
import { emptyBill, emptyRecord } from "./emptyRecord";
import { fieldsOwnedBy } from "../../lib/store/save";
import { FLEET_BASE } from "../../lib/store/roster";
import type { TripRecord } from "../../types/record";

/** ใบที่ฝ่าย cs บันทึกไว้แล้ว — เปิดมาให้ฝ่ายถัดไปกรอกต่อ */
const csDone = (): TripRecord => ({
  ...emptyRecord(),
  id: "R-cs", docNo: "6250000000001", date: "2026-03-10",
  origin: "บางนา", dest: "ตรัง", dist: 572, revenue: 12000,
  _csDone: true, _csAt: "2026-03-10 09:00", synced: true,
} as TripRecord);

const pickFields = (r: TripRecord, fields: string[]) =>
  Object.fromEntries(fields.map((f) => [f, (r as unknown as Record<string, unknown>)[f]]));

describe("randomFor", () => {
  it("ฝ่ายจัดรถสุ่มแล้ว ช่องของ cs/บัญชี id และธงสถานะคงเดิม", () => {
    const base = csDone();
    const out = randomFor(base, ["dispatch"]);
    const others = [...fieldsOwnedBy("cs"), ...fieldsOwnedBy("account")];
    expect(pickFields(out, others)).toEqual(pickFields(base, others));
    expect(out.id).toBe("R-cs");
    expect(out.docNo).toBe("6250000000001");
    expect(out.date).toBe("2026-03-10");
    expect(out._csDone).toBe(true);
    expect(out.synced).toBe(true);
    expect(out.vehicle).not.toBe("");
    expect(out.plate).not.toBe("");
  });

  it("วันปล่อยรถตรงกับวันที่ในใบเป๊ะ — สถานะกองรถขึ้น \"กำลังเดินทาง\" ได้ทันทีไม่ต้องรอข้ามวัน", () => {
    for (let i = 0; i < 50; i++) {
      const out = randomFor(csDone(), ["dispatch"]);
      expect(out.releaseDate).toBe(out.date);
    }
  });

  it("ฝ่ายบัญชีสุ่มเฉพาะช่องต้นทุน", () => {
    const base = { ...csDone(), vehicle: "รถ 10 ล้อ", plate: "ทด.1-1111" } as TripRecord;
    const out = randomFor(base, ["account"]);
    const others = [...fieldsOwnedBy("cs"), ...fieldsOwnedBy("dispatch")];
    expect(pickFields(out, others)).toEqual(pickFields(base, others));
  });

  it("ผู้ดูแลระบบ (ครบทุกโซน) ได้ช่องครบทั้งสามฝ่าย และวันปล่อยรถตรงกับวันที่ใหม่ที่สุ่มได้", () => {
    const out = randomFor(emptyRecord(), ["cs", "dispatch", "account"]);
    expect(out.docNo).not.toBe("");
    expect(out.origin).not.toBe("");
    expect(out.vehicle).not.toBe("");
    expect(out.releaseDate).toBe(out.date);
  });

  it("ฝ่าย cs สุ่มบิลเท่าจำนวนแถวที่เพิ่มไว้ (อย่างน้อย 1)", () => {
    const three = { ...emptyRecord(), bills: [emptyBill(), emptyBill(), emptyBill()] };
    const out = randomFor(three, ["cs"]);
    expect(out.bills).toHaveLength(3);
    for (const b of out.bills) {
      expect(b.no).not.toBe("");
      expect(b.origin).toBe(out.origin);
      expect(b.dest).toBe(out.dest);
    }
    expect(randomFor({ ...emptyRecord(), bills: [] }, ["cs"]).bills).toHaveLength(1);
  });

  it("ฝ่ายอื่นกดสุ่ม บิลไม่ถูกแตะ", () => {
    const base = { ...csDone(), bills: [emptyBill(), emptyBill()] };
    expect(randomFor(base, ["dispatch", "account"]).bills).toBe(base.bills);
  });

  it("ทะเบียนที่สุ่มได้ต้องมาจากกองรถจริง (fleet.json) เท่านั้น ไม่ใช่ทะเบียนสมมติ", () => {
    const basePlates = new Set(FLEET_BASE.map((f) => f.plate));
    for (let i = 0; i < 50; i++) {
      const out = randomFor(emptyRecord(), ["dispatch"]);
      expect(basePlates.has(out.plate)).toBe(true);
    }
  });

  it("ไม่แก้ใบต้นฉบับ (React state ต้องได้ object ใหม่)", () => {
    const base = csDone();
    const snap = structuredClone(base);
    const out = randomFor(base, ["dispatch", "account"]);
    expect(base).toEqual(snap);
    expect(out).not.toBe(base);
  });
});
