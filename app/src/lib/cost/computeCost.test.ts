/**
 * Golden test — โมเดลต้นทุนตัวใหม่ต้องให้ตัวเลขตรงกับโค้ดเดิมใน v5 ทุกหลัก
 *
 * fixture ไม่ได้เขียนด้วยมือ แต่ได้จากการ "รันโค้ดเดิมจริง ๆ" ผ่าน tools/gen-golden.mjs
 * ถ้าเทสต์นี้แดง แปลว่าการพอร์ตทำให้ตัวเลขเพี้ยน ห้าม merge
 */
import { describe, expect, it } from "vitest";
import { computeCost, num, priceForDate } from "./computeCost";
import { REF } from "../refdata";
import type { CostInput, FleetType } from "./types";
import golden from "./__fixtures__/golden.json";
import { totalsFromOldRow } from "./adapters/oldRow";

const toInput = (c: (typeof golden.cases)[number]["input"]): CostInput => {
  const f = c.fields as Record<string, string>;
  const n = (k: string) => num(f[k]);
  const idx = parseInt(c.vehIndex, 10);
  return {
    date: c.date,
    // vehIndex ที่ไม่ถูกต้อง ("" หรือ "99") ต้องได้ชื่อว่าง เหมือน RATES[vi] เป็น undefined
    vehicle: Number.isNaN(idx) ? "" : (golden.vehicles[idx] ?? ""),
    fleetType: c.fleetType as FleetType | "",
    distance: n("distance"),
    revenue: n("revenue"),
    gas: n("gas"),
    fuelCash: n("fuelCash"),
    fuelDownBill: n("fuelDownBill"),
    fuelFleet: n("fuelFleet"),
    fuelPickup: n("fuelPickup"),
    fuelUpBill: n("fuelUpBill"),
    fuelCallTruck: n("fuelCallTruck"),
    fuelAutoOn: !c.noAuto,
    fuelOff: n("fuelOff"),
    fuelDetour: n("fuelDetour"),
    fuelOffFleet: n("fuelOffFleet"),
    drv: n("drv"),
    spare: n("spare"),
    snd: n("snd"),
    laborOff: n("laborOff"),
    feeTarp: n("feeTarp"),
    feePolice: n("feePolice"),
    feeCont: n("feeCont"),
    feePort: n("feePort"),
    feeDoc: n("feeDoc"),
    feeToll: n("feeToll"),
  };
};

describe("computeCost เทียบกับโมเดลเดิม v5", () => {
  it(`มี fixture ให้ทดสอบ`, () => {
    expect(golden.cases.length).toBeGreaterThan(100);
  });

  it("ให้ผลตรงกับของเดิมทุกเคส", () => {
    const bad: string[] = [];

    golden.cases.forEach((c, i) => {
      const got = computeCost(toInput(c.input), REF);
      const e = c.expected;
      const cmp: Array<[string, unknown, unknown]> = [
        ["fuelSum", got.fuelSum, e.fuelSum],
        ["fuelAuto", got.fuelAuto, e.fuelAuto],
        ["litres", got.litres, e.litres],
        ["price", got.price, e.price],
        ["labor", got.labor, e.labor],
        ["fees", got.fees, e.fees],
        ["waste", got.waste, e.waste],
        ["normal", got.normal, e.normal],
        ["sheetTotal", got.sheetTotal, e.sheetTotal],
        ["profit", got.profit, e.profit],
        ["repair.fixed", got.repair.fixed, e.repFixed],
        ["repair.rate", got.repair.rate, e.repRate],
        ["repair.varCost", got.repair.varCost, e.repVar],
        ["repair.total", got.repair.total, e.repTotal],
        ["repair.hasFix", got.repair.hasFix, e.repHasFix],
        ["repair.hasVar", got.repair.hasVar, e.repHasVar],
        ["auto.rate", got.auto.rate, e.autoRate],
        ["auto.price", got.auto.price, e.autoPrice],
        ["auto.effDate", got.auto.effDate, e.autoEffDate],
        ["auto.litres", got.auto.litres, e.autoLitres],
        ["auto.cost", got.auto.cost, e.autoCost],
      ];
      for (const [field, a, b] of cmp) {
        if (!Object.is(a, b)) bad.push(`เคส ${i} ${field}: ได้ ${a} ควรเป็น ${b}`);
      }
    });

    expect(bad.slice(0, 15).join("\n")).toBe("");
  });
});

describe("priceForDate — พฤติกรรมขอบที่ต้องคงไว้", () => {
  const prices = REF.prices.map((p) => [p.date, p.price] as const);

  it("ไม่ระบุวันที่ → ใช้ราคาล่าสุด ไม่ใช่ราคาแรกสุด", () => {
    expect(priceForDate(prices, "")).toEqual({
      effDate: REF.prices.at(-1)!.date,
      price: REF.prices.at(-1)!.price,
    });
  });

  it("วันที่เก่ากว่าเรทแรก → ใช้เรทแรก", () => {
    expect(priceForDate(prices, "1999-01-01").price).toBe(REF.prices[0]!.price);
  });

  it("ตรงวันที่เปลี่ยนราคาพอดี → ใช้เรทใหม่ของวันนั้น", () => {
    const p = REF.prices[5]!;
    expect(priceForDate(prices, p.date)).toEqual({ effDate: p.date, price: p.price });
  });
});

describe("num — เทียบเท่า parseFloat(x)||0 ของเดิม", () => {
  it("ค่าที่อ่านไม่ออกกลายเป็น 0", () => {
    for (const v of ["", "abc", null, undefined, NaN]) expect(num(v)).toBe(0);
  });
  it("อ่านเลขนำหน้าได้เหมือน parseFloat", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("100บาท")).toBe(100);
  });
});

describe("แถวเก่า vs แถวใหม่ ใช้สูตรเดียวกัน", () => {
  it("อนุมานยอดจากคอลัมน์รวมของชีตเก่า แล้วได้ normal/profit เท่ากับ computeCost", () => {
    for (const c of golden.cases) {
      const input = toInput(c.input);
      const got = computeCost(input, REF);
      const old = totalsFromOldRow({
        revenue: input.revenue,
        sheetTotal: got.sheetTotal,
        repair: got.repair.total,
        waste: got.waste,
      });
      expect(old.normal).toBeCloseTo(got.normal, 9);
      expect(old.profit).toBeCloseTo(got.profit, 9);
    }
  });
});
