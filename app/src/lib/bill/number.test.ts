import { describe, expect, it } from "vitest";
import { newBillNos, newDocNo, yymm } from "./number";

describe("ออกเลขที่บิล/ใบรายการ", () => {
  it("yymm ใช้ปี พ.ศ. สองหลัก", () => {
    expect(yymm("2026-09-22")).toBe("6909");
    expect(yymm("2024-01-05")).toBe("6701");
  });

  it("เลขยาว 13 หลัก ขึ้นต้น 5 (บิล) และ 6 (ใบรายการ)", () => {
    const [no] = newBillNos(1, "2026-09-22", []);
    expect(no).toHaveLength(13);
    expect(no!.startsWith("56909")).toBe(true);
    const doc = newDocNo("2026-09-22", []);
    expect(doc).toHaveLength(13);
    expect(doc.startsWith("66909")).toBe(true);
  });

  it("นับต่อจากเลขสูงสุดของเดือนเดียวกัน", () => {
    const [no] = newBillNos(1, "2026-09-22", ["5690900007123", "5690900003999"]);
    expect(no!.slice(5, 10)).toBe("00008");
  });

  it("เดือนอื่นไม่ทำให้ลำดับกระโดด", () => {
    const [no] = newBillNos(1, "2026-09-22", ["5690800009999"]);
    expect(no!.slice(5, 10)).toBe("00001");
  });

  it("ออกหลายใบพร้อมกันได้เลขไม่ซ้ำและเรียงขึ้น", () => {
    const nos = newBillNos(5, "2026-09-22", []);
    expect(new Set(nos).size).toBe(5);
    expect(nos.map((n) => n.slice(5, 10))).toEqual(["00001", "00002", "00003", "00004", "00005"]);
  });

  it("ไม่ชนกับเลขที่มีอยู่แล้วแม้ตัวสุ่มตรงกัน", () => {
    const first = newBillNos(1, "2026-09-22", [])[0]!;
    const second = newBillNos(1, "2026-09-22", [first])[0]!;
    expect(second).not.toBe(first);
  });

  it("ข้ามเลขที่รูปแบบไม่ตรงโดยไม่พัง", () => {
    const [no] = newBillNos(1, "2026-09-22", ["INV-2569-001", "", "5690"]);
    expect(no!.slice(5, 10)).toBe("00001");
  });
});
