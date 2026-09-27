import { describe, expect, it } from "vitest";
import { costSteps, customerLoss, emptyCostPerYear, execTotals } from "./execSummary";

const trip = (mo: string, rev: number, cost: number, o: { fuel?: number; allow?: number; dep?: number; repair?: number; empty?: boolean } = {}) => ({
  mo, rev, cost, profit: rev - cost, fuel: o.fuel ?? 0, allow: o.allow ?? 0, dep: o.dep ?? 0, repair: o.repair ?? 0, empty: o.empty ?? false,
});

describe("Executive Summary", () => {
  const trips = [
    trip("2026-01", 1000, 600, { fuel: 300, allow: 100, dep: 50, repair: 30 }),
    trip("2026-02", 500, 200, { fuel: 100, allow: 50, dep: 20 }),
    trip("2026-02", 0, 120, { fuel: 80, empty: true }),
  ];

  it("การ์ด = Σ ÷ Σ", () => {
    const t = execTotals(trips);
    expect(t).toMatchObject({ rev: 1500, cost: 920, profit: 580, n: 3 });
    expect(t.margin).toBeCloseTo(580 / 1500 * 100);
    expect(execTotals([]).margin).toBeNull();
  });

  it("ก้อนต้นทุนรวมกันเท่าต้นทุนรวม", () => {
    const s = costSteps(trips);
    expect(s).toEqual({ fuel: 480, driver: 150, depRepair: 100, other: 190 });
    expect(s.fuel + s.driver + s.depRepair + s.other).toBe(920);
  });

  it("เที่ยวเปล่าปรับเป็นรายปีตามจำนวนเดือนที่มีข้อมูล", () => {
    expect(emptyCostPerYear(trips)).toEqual({ perYear: 120 * 12 / 2, months: 2 });
    expect(emptyCostPerYear([])).toBeNull();
  });

  it("ลูกค้าขาดทุน — กำไร 0 ไม่นับ", () => {
    expect(customerLoss([{ profit: -30 }, { profit: 0 }, { profit: 50 }, { profit: -10 }]))
      .toEqual({ share: 50, loss: 40, n: 2, total: 4 });
    expect(customerLoss([])).toBeNull();
  });
});
