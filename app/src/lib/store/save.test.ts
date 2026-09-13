/**
 * เทสต์การบันทึกใบรายการ — โค้ดที่ตัดสินว่างานของฝ่ายอื่นจะหายหรือไม่หาย
 *
 * สามฝ่ายกรอกใบเดียวกันคนละเวลา ถ้า merge ผิดครั้งเดียวข้อมูลหายเงียบ ๆ
 * โดยไม่มี error ให้เห็น จึงต้องมีเทสต์ล็อกพฤติกรรมไว้
 *
 * ชีตกับ IndexedDB ถูกแทนด้วยของปลอม — ที่ทดสอบคือตรรกะการรวมข้อมูล ไม่ใช่ I/O
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadTrips = vi.fn();
const pushRecords = vi.fn();
const put = vi.fn();

vi.mock("../sheet/client", () => ({
  loadTrips: () => loadTrips(),
  pushRecords: (list: unknown) => pushRecords(list),
}));

vi.mock("./records", () => ({
  put: (rec: unknown) => put(rec),
}));

import { SaveAbortedError, fieldsOwnedBy, saveRecord } from "./save";
import { emptyRecord } from "../../features/entry/emptyRecord";
import type { TripRecord } from "../../types/record";

const rec = (over: Partial<TripRecord> = {}): TripRecord => ({ ...emptyRecord(), ...over });

beforeEach(() => {
  loadTrips.mockReset();
  pushRecords.mockReset().mockResolvedValue({ ok: true });
  put.mockReset().mockResolvedValue(undefined);
});

describe("fieldsOwnedBy", () => {
  it("ฝ่ายบัญชีเป็นเจ้าของช่องต้นทุนทุกช่อง ไม่ใช่คำว่า cost ตรง ๆ", () => {
    const f = fieldsOwnedBy("account");
    expect(f).toContain("gas");
    expect(f).toContain("feeToll");
    expect(f).not.toContain("cost");
  });

  it("ฝ่ายบริการลูกค้าเป็นเจ้าของรายได้และบิล แต่ไม่ใช่ทะเบียนรถ", () => {
    const f = fieldsOwnedBy("cs");
    expect(f).toContain("revenue");
    expect(f).toContain("bills");
    expect(f).not.toContain("plate");
  });
});

describe("saveRecord — กันงานฝ่ายอื่นหาย", () => {
  it("อ่านชีตไม่ได้ ต้องยกเลิกการบันทึก ไม่ใช่เขียนทับ", async () => {
    loadTrips.mockRejectedValue(new Error("เน็ตหลุด"));

    await expect(saveRecord(rec({ docNo: "A1" }), { role: "cs" }))
      .rejects.toBeInstanceOf(SaveAbortedError);

    // ห้ามแตะทั้งเครื่องและชีต — ไม่รู้ว่าฝ่ายอื่นกรอกอะไรไว้
    expect(put).not.toHaveBeenCalled();
    expect(pushRecords).not.toHaveBeenCalled();
  });

  it("ฝ่ายบัญชีบันทึก ต้องไม่ทับช่องของฝ่ายบริการลูกค้าที่อยู่บนชีต", async () => {
    const onSheet = rec({
      id: "R1", docNo: "A1", revenue: 9000, origin: "กรุงเทพ", dest: "เชียงใหม่",
      _csDone: true, _csAt: "2026-09-10 09:00",
    });
    loadTrips.mockResolvedValue([onSheet]);

    // ฝ่ายบัญชีเปิดใบมากรอกต้นทุน โดยฟอร์มฝั่งเขามีรายได้เป็น 0 (ช่องถูกซ่อน)
    const draft = rec({ id: "R1", docNo: "A1", revenue: 0, origin: "", dest: "", gas: 1200 });

    const res = await saveRecord(draft, { role: "account" });

    expect(res.mergedFromSheet).toBe(true);
    expect(res.record.revenue).toBe(9000);       // ของฝ่ายอื่น ต้องอยู่ครบ
    expect(res.record.origin).toBe("กรุงเทพ");
    expect(res.record.gas).toBe(1200);           // ของฝ่ายตัวเอง ต้องถูกเขียน
    expect(res.record._csDone).toBe(true);       // ธงของฝ่ายอื่นต้องไม่หาย
    expect(res.record._csAt).toBe("2026-09-10 09:00");
    expect(res.record._accountDone).toBe(true);  // ประทับของตัวเอง
  });

  it("ไม่มีใบนี้บนชีต = ใบใหม่ ไม่ต้อง merge", async () => {
    loadTrips.mockResolvedValue([]);

    const res = await saveRecord(rec({ id: "R9", docNo: "B2", revenue: 500 }), { role: "cs" });

    expect(res.mergedFromSheet).toBe(false);
    expect(res.record.revenue).toBe(500);
    expect(res.record._csDone).toBe(true);
    expect(res.pushed).toBe(true);
  });

  it("จับคู่ด้วยเลขที่ใบได้ ถ้า id ไม่ตรง (ใบเดียวกันที่กรอกคนละเครื่อง)", async () => {
    loadTrips.mockResolvedValue([rec({ id: "R-สร้างจากเครื่องอื่น", docNo: "C3", revenue: 777 })]);

    const res = await saveRecord(rec({ id: "R-เครื่องนี้", docNo: "C3", gas: 50 }), { role: "account" });

    expect(res.mergedFromSheet).toBe(true);
    expect(res.record.id).toBe("R-สร้างจากเครื่องอื่น"); // ต้องยึด id ของชีต ไม่งั้นได้ใบซ้ำสองใบ
    expect(res.record.revenue).toBe(777);
  });

  it("alsoRoles = โซนที่เปิดแก้ไว้ ต้องถูกประทับว่ากรอกแล้วด้วย", async () => {
    loadTrips.mockResolvedValue([]);

    const res = await saveRecord(rec({ docNo: "D4", plate: "70-1234" }), {
      role: "account", alsoRoles: ["dispatch"],
    });

    expect(res.record._accountDone).toBe(true);
    expect(res.record._dispatchDone).toBe(true);
    expect(res.record.plate).toBe("70-1234"); // ช่องของโซนที่เปิดต้องถูกบันทึกจริง
    expect(res.record._csDone).toBeFalsy();   // โซนที่ไม่ได้เปิด ต้องไม่ถูกประทับ
  });

  it("โหมดออฟไลน์ ไม่ยุ่งกับชีตเลย แต่ยังเก็บลงเครื่อง", async () => {
    const res = await saveRecord(rec({ docNo: "E5" }), { role: "cs", offline: true });

    expect(loadTrips).not.toHaveBeenCalled();
    expect(pushRecords).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledTimes(1);
    expect(res.pushed).toBe(false);
    expect(res.record.synced).toBe(false);
  });

  it("บันทึกสำเร็จแล้วต้องประทับ synced ลงเครื่องอีกรอบ ไม่งั้นจะขึ้นค้างว่ายังไม่ซิงก์", async () => {
    loadTrips.mockResolvedValue([]);

    const res = await saveRecord(rec({ docNo: "F6" }), { role: "cs" });

    expect(put).toHaveBeenCalledTimes(2);
    expect(res.record.synced).toBe(true);
  });

  it("ยอดรวมถูกคำนวณใหม่จากข้อมูลที่ merge แล้ว ไม่ใช่จากที่ฟอร์มส่งมา", async () => {
    loadTrips.mockResolvedValue([rec({ id: "R2", docNo: "G7", revenue: 10_000 })]);

    // ฟอร์มฝ่ายบัญชีส่งกำไรผิดมา (0) — ต้องถูกคิดใหม่จากรายได้บนชีต
    const res = await saveRecord(rec({ id: "R2", docNo: "G7", gas: 1000, profit: 0 }), { role: "account" });

    expect(res.record.profit).toBe(10_000 - res.record.normal);
  });
});
