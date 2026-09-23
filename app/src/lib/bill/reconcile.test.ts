/**
 * บิลที่อยู่ในใบรายการแล้วต้องไม่ขึ้นให้จัดซ้ำ — ไม่งั้นการจัดรถที่ค้างครึ่งทางจะกลายเป็นใบรายการซ้ำ
 */
import { describe, expect, it } from "vitest";
import { splitStuckBills } from "./reconcile";
import type { PendingBill } from "../../types/bill";
import type { Bill } from "../../types/record";

const pb = (no: string, sender = "CUS0000001"): PendingBill => ({ id: `id-${no}-${sender}`, no, sender } as PendingBill);
const rec = (docNo: string, bills: { no: string; sender: string }[]) => ({ docNo, bills: bills as Bill[] });

describe("splitStuckBills", () => {
  it("บิลที่อยู่ในใบรายการแล้ว แยกออกพร้อมเลขที่ใบ ที่เหลือจัดได้ตามปกติ", () => {
    const { free, stuck } = splitStuckBills(
      [pb("5690900000011"), pb("5690900000022"), pb("5690900000033")],
      [rec("6690900001763", [{ no: "5690900000011", sender: "CUS0000001" }, { no: "5690900000022", sender: "CUS0000001" }])],
    );
    expect(stuck.map((s) => [s.bill.no, s.docNo])).toEqual([
      ["5690900000011", "6690900001763"], ["5690900000022", "6690900001763"],
    ]);
    expect(free.map((b) => b.no)).toEqual(["5690900000033"]);
  });

  it("เลขที่บิลตรงแต่ผู้ส่งไม่ตรง = คนละบิล (เลขชนกับบิลที่พิมพ์เองในใบรูปแบบเก่า)", () => {
    const { free, stuck } = splitStuckBills([pb("B1", "CUS0000001")], [rec("D1", [{ no: "B1", sender: "ลูกค้าอื่น" }])]);
    expect(stuck).toHaveLength(0);
    expect(free).toHaveLength(1);
  });

  it("ใบที่ยังไม่มีเลขที่ใบรายการไม่นับ (ใบร่าง)", () => {
    const { stuck } = splitStuckBills([pb("B1")], [rec("", [{ no: "B1", sender: "CUS0000001" }])]);
    expect(stuck).toHaveLength(0);
  });

  it("ใบรูปแบบเก่าที่ไม่มีรายการบิลก็ไม่พัง", () => {
    const { free } = splitStuckBills([pb("B1")], [{ docNo: "D1", bills: undefined as unknown as Bill[] }]);
    expect(free).toHaveLength(1);
  });
});
