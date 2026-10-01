import { describe, expect, it } from "vitest";
import { buildRecs, debtSection, emptySection, goodChecks, perYear, profitSection, secStatus } from "./exec";
import type { Trip } from "../data/useCostRev";
import type { DebtorRow } from "../data/useDebtors";

const trip = (o: Partial<Trip>): Trip => ({
  id: "x", d: "2026-01-05", mo: "2026-01", y: 2026, o: "A", de: "B", rt: "A-B", dir: "", rev: 0, cost: 0, profit: 0,
  empty: false, bn: 0, cus: [], waste: 0, fuel: 0, allow: 0, fee: 0, repair: 0, dep: 0, rent: 0, sg: "สินค้าทั่วไป",
  ...o,
} as Trip);

const bill = (o: Partial<DebtorRow>): DebtorRow => ({
  doc: "1", cust: "c", br: "b", term: 30, issue: "2026-01-01", mo: "2026-01", y: 2026, due: "2026-01-31",
  close: null, amount: 100, days: null, over: null, ...o,
});

describe("Recommendation ของ Executive Dashboard (lib/recommend/exec.ts)", () => {
  it("ยอดต่อปี = ยอดของช่วง ÷ จำนวนเดือน × 12", () => {
    expect(perYear(300, 3)).toBe(1200);
    expect(perYear(300, 0)).toBe(0);
  });

  it("กำไร: ภาพรวม · เส้นทางกำไรสูงสุด · ลูกค้า Top 10 ขาดทุน · ช่วง −20…−10%", () => {
    const trips = [
      trip({ rt: "R1", rev: 1000, cost: 600, profit: 400, fuel: 300, waste: 60, bn: 2 }),
      trip({ rt: "R1", rev: 1000, cost: 800, profit: 200, fuel: 400, bn: 1 }),
      trip({ rt: "R2", rev: 500, cost: 700, profit: -200, bn: 1 }),
      trip({ rt: "R3", rev: 0, cost: 100, profit: -100, empty: true, sg: "" }),
    ];
    const cust = [{ profit: 500, revenue: 2000, m: 25 }, { profit: -100, revenue: 600, m: -16.7 }, { profit: -50, revenue: 100, m: -50 }];
    const s = profitSection(trips, cust, null);
    expect(s).toMatchObject({ n: 4, bills: 4, revenue: 2500, cost: 2200, profit: 300, lossTripPct: 50 });
    expect(s.best).toMatchObject({ rt: "R1", n: 2, profit: 600, perTrip: 300, margin: 30 });
    expect(s.best!.varShare).toBeCloseTo(700 / 1400);
    expect(s.cust).toMatchObject({ lossN: 2, gain: 500, loss: 150, lossOfGain: 0.3, top10Share: 1, band: { n: 1, loss: 100 } });
  });

  it("เที่ยวเปล่า: สัดส่วนต้นทุน · เส้นทางสูงสุด · ประหยัดต่อปีตามสมมติฐาน 10–20%", () => {
    const trips = [
      trip({ mo: "2026-01", rev: 1000, cost: 900 }),
      trip({ mo: "2026-02", rt: "X", empty: true, cost: 100, fuel: 80 }),
    ];
    const e = emptySection(trips)!;
    expect(e).toMatchObject({ n: 1, cost: 100, totalCost: 1000, share: 0.1, months: 2 });
    expect(e.top).toMatchObject({ rt: "X", shareOfEmpty: 1, perTrip: 100, varShare: 0.8 });
    expect(e.save).toEqual([60, 120]);   // 100 ÷ 2 เดือน × 12 = 600/ปี
    expect(emptySection([trip({ cost: 10 })])).toBeNull();
  });

  it("ลูกหนี้: DSO = เครดิตเทอม + ช้าเฉลี่ย · บิลค้างเกินกำหนด · เงินทุนหมุนเวียน", () => {
    const rows = [
      bill({ doc: "a", close: "2026-01-31", amount: 100 }),                 // 30 วัน ตรงกำหนด
      bill({ doc: "b", close: "2026-03-02", amount: 100 }),                 // 60 วัน ช้า 30
      bill({ doc: "c", issue: "2026-02-01", due: "2026-03-03", amount: 200 }), // ค้าง เกินกำหนด ณ 31 มี.ค.
      bill({ doc: "d", issue: "2025-12-01" }),                              // วางก่อนช่วง ไม่นับ
    ];
    const d = debtSection(rows, "2026-01-01", "2026-03-31")!;
    expect(d).toMatchObject({ bills: 3, amount: 400, dso: 45, term: 30, late: 15 });
    expect(d.latePaid).toMatchObject({ n: 1, amount: 100 });
    expect(d.overdue).toEqual({ n: 1, amount: 200 });
    expect(d.collect).toBe(100);
    // ยอดขายเฉลี่ยต่อวัน 400 ÷ 90 วัน · ลดส่วนที่ช้าลงครึ่งหนึ่ง (7.5 วัน) / ลดจนเท่าเครดิตเทอม (15 วัน)
    expect(d.wc!.half.cash).toBeCloseTo(400 / 90 * 7.5);
    expect(d.wc!.term).toMatchObject({ dso: 30 });
    expect(debtSection(rows, "2027-01-01", "2027-02-01")).toBeNull();
  });

  it("buildRecs: ขึ้นเฉพาะข้อที่เข้าเงื่อนไข · ผลกระทบ ≥ 1% ของต้นทุน = เร่งด่วน · เรียงระดับแล้วมูลค่า", () => {
    // เที่ยวเปล่า 10% ของต้นทุน (≥ 3%) → ข้อเสนอแนะงานขากลับ · ลูกหนี้ค้าง 200 → ติดตามหนี้
    // เที่ยวปกติ 10 เที่ยว + เที่ยวเปล่า 1 = เที่ยวขาดทุน 9.1% (ต่ำกว่าเกณฑ์ 10% — เที่ยวเปล่านับเป็นเที่ยวขาดทุนตามนิยามของ Profit Per Route)
    const trips = [...Array.from({ length: 10 }, () => trip({ mo: "2026-01", rev: 300, cost: 180, profit: 120 })),
      trip({ mo: "2026-02", rt: "X", empty: true, cost: 100, profit: -100 })];
    const ps = profitSection(trips, null, null), es = emptySection(trips)!;
    const ds = debtSection([bill({ issue: "2026-02-01", due: "2026-03-03", amount: 200 })], "2026-01-01", "2026-03-31");
    const recs = buildRecs(ps, null, es, ds);
    expect(recs.map((r) => r.sec)).toEqual([2, 3]);
    expect(recs.every((r) => r.level === "urgent")).toBe(true);   // ประหยัดต่อปีเทียบต้นทุนต่อปี · ค้างเกินกำหนด 100% ของยอดวางบิล ≥ 5%
    expect(recs[0]!.value).toBeGreaterThan(recs[1]!.value);
    const c1 = goodChecks(1, ps, null, es, ds);
    expect(c1.every((c) => c.ok)).toBe(true);                     // อัตรากำไร ≥ 10% · เที่ยวขาดทุน < 10%
    expect(secStatus(recs.filter((r) => r.sec === 1), c1)).toBe("good");
    expect(secStatus(recs.filter((r) => r.sec === 3), goodChecks(3, ps, null, es, ds))).toBe("bad");
    // ไม่มีอะไรเข้าเงื่อนไข = ไม่มีข้อเสนอแนะ
    expect(buildRecs(profitSection([trip({ rev: 1000, cost: 500, profit: 500 })], null, null), null, null, null)).toEqual([]);
  });
});
