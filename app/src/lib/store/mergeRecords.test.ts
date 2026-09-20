import { describe, expect, it } from "vitest";
import { mergeRecords } from "./useRecords";
import type { TripRecord } from "../../types/record";

const rec = (id: string, p: Partial<TripRecord> = {}): TripRecord =>
  ({ id, docNo: id, date: "2026-09-19", synced: true, ...p }) as TripRecord;

const ids = (list: TripRecord[]) => list.map((r) => r.id).sort();

describe("mergeRecords", () => {
  it("รวมใบจากชีตกับใบในเครื่องที่ยังไม่เคยขึ้นชีต", () => {
    const out = mergeRecords([rec("a"), rec("b", { synced: false })], [rec("a")], true);
    expect(ids(out)).toEqual(["a", "b"]);
  });

  it("ใบที่ยังไม่ sync ชนะของบนชีตเสมอ (งานที่เพิ่งกรอกต้องไม่ถูกทับ)", () => {
    const out = mergeRecords([rec("a", { synced: false, docNo: "ในเครื่อง" })], [rec("a", { docNo: "บนชีต" })], true);
    expect(out[0]!.docNo).toBe("ในเครื่อง");
  });

  it("ใบที่ sync แล้วใช้ของบนชีต (ฝ่ายอื่นอาจแก้มา)", () => {
    const out = mergeRecords([rec("a", { docNo: "ในเครื่อง" })], [rec("a", { docNo: "บนชีต" })], true);
    expect(out[0]!.docNo).toBe("บนชีต");
  });

  describe("ลบแถวที่ชีตแล้วต้องหายจากแอปด้วย", () => {
    it("★ ใบที่ sync แล้วแต่ไม่มีบนชีต = ถูกลบทิ้ง — ต้องไม่โผล่กลับมา", () => {
      const out = mergeRecords([rec("a"), rec("b")], [rec("a")], true);
      expect(ids(out)).toEqual(["a"]);
    });

    it("★ ใบที่ยังไม่ sync ห้ามตัดทิ้ง — ไม่เคยอยู่บนชีตตั้งแต่แรก ไม่ใช่ถูกลบ", () => {
      const out = mergeRecords([rec("a", { synced: false })], [], true);
      expect(ids(out)).toEqual(["a"]);
    });

    it("★ ชีตอ่านไม่สำเร็จ (sheetComplete=false) ห้ามตัดอะไรทิ้ง", () => {
      const out = mergeRecords([rec("a"), rec("b")], [rec("a")], false);
      expect(ids(out)).toEqual(["a", "b"]);
      // ไม่ส่งพารามิเตอร์ = ค่าเริ่มต้นต้องปลอดภัยไว้ก่อน
      expect(ids(mergeRecords([rec("a"), rec("b")], [rec("a")]))).toEqual(["a", "b"]);
    });

    it("ลบทั้งชีต = แอปเหลือเฉพาะใบที่ยังไม่ sync", () => {
      const out = mergeRecords([rec("a"), rec("b"), rec("c", { synced: false })], [], true);
      expect(ids(out)).toEqual(["c"]);
    });
  });

  it("เรียงใบใหม่สุดขึ้นก่อน", () => {
    const out = mergeRecords([], [rec("เก่า", { date: "2026-01-01" }), rec("ใหม่", { date: "2026-09-19" })], true);
    expect(out[0]!.id).toBe("ใหม่");
  });
});
