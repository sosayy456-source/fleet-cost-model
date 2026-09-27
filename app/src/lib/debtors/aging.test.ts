import { describe, expect, it } from "vitest";
import { collectionDays } from "./aging";
import type { DebtorRow } from "../data/useDebtors";

const bill = (cust: string, issue: string, close: string | null): DebtorRow => ({
  doc: issue + cust, cust, br: "", term: 30, issue, mo: issue.slice(0, 7), y: 2026, due: issue, close,
  amount: 100, days: null, over: null,
});

describe("วันเก็บเงินเฉลี่ยรายลูกค้า (DSO ของ Performance Index)", () => {
  it("ชำระแล้วนับถึงวันที่จบ · ยังค้างนับถึงวันที่เลือก · บิลที่ยังไม่วางไม่นับ", () => {
    const rows = [
      bill("A", "2026-05-01", "2026-05-11"),   // 10 วัน
      bill("A", "2026-05-01", null),           // ค้าง → ถึง 31/05 = 30 วัน
      bill("B", "2026-05-21", "2026-06-10"),   // จบหลังวันที่เลือก = ยังค้าง → 10 วัน
      bill("C", "2026-06-05", null),           // วางหลังวันที่เลือก ไม่นับ
    ];
    expect(collectionDays(rows, "2026-05-31")).toEqual([20, 10]);
  });
});
