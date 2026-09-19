import { describe, expect, it } from "vitest";
import { compareSides } from "./compare";
import type { Trip } from "../data/useCostRev";

let seq = 0;
/** เที่ยวจำลอง — ค่าเริ่มต้นรถบริษัท 10 ล้อ เส้น ก-ข รายได้ 15,000 ต้นทุน 10,000 */
function trip(p: Partial<Trip> = {}): Trip {
  seq++;
  const rev = p.rev ?? 15000, cost = p.cost ?? 10000;
  return {
    id: String(1e12 + seq), d: "2025-01-05", mo: "2025-01", y: 2025, br: "สาขา", t: "ของเหมา",
    ft: "รถบริษัท", vk: "รถ 10 ล้อ", pl: `พล-${seq}`, o: "ก", de: "ข", rt: "ก-ข", dir: "",
    km: 400, rev, cost, profit: rev - cost, empty: false, clear: false, clrAmt: 0, clrN: 0, m: true,
    waste: 0, fuel: 0, allow: 0, fee: 0, repair: 0, dep: 0, rent: 0,
    f_cash: 0, f_down: 0, f_up: 0, f_pickup: 0, f_call: 0, a_drv: 0, a_spare: 0, a_off: 0, sg: "",
    fe_tarp: 0, fe_police: 0, fe_insure: 0, fe_cont: 0, fe_port: 0, fe_doc: 0, fe_toll: 0,
    ...p,
  };
}
const many = (n: number, p: Partial<Trip> = {}) => Array.from({ length: n }, () => trip(p));
const part = (p: Partial<Trip> = {}) => ({ ft: "รถร่วม", ...p });

describe("compareSides", () => {
  it("เทียบเฉพาะเส้นทาง × ชนิดรถ ที่มีทั้งสองฝั่งครบเกณฑ์", () => {
    const res = compareSides([
      ...many(3), ...many(3, part({ cost: 12000 })),                 // เทียบได้
      ...many(3, { vk: "รถ 6 ล้อ" }),                                // ฝั่งเดียว
      ...many(3, { rt: "ค-ง" }), ...many(2, part({ rt: "ค-ง" })),    // รถร่วมไม่ถึงเกณฑ์
    ], 3);
    expect(res.rows).toHaveLength(1);
    expect(res.summary.oneSided).toBe(1);
    expect(res.summary.tooFew).toBe(1);
    expect(res.summary.coveredTrips).toBe(6);
    expect(res.summary.totalTrips).toBe(14);
    expect(res.summary.kinds).toBe(2);
    expect(res.summary.sharedKinds).toBe(1);
  });

  it("บอกฝั่งที่ต้นทุนต่อเที่ยวถูกกว่า พร้อมส่วนต่างรวมจากเที่ยวของฝั่งที่แพงกว่า", () => {
    const r = compareSides([...many(4), ...many(3, part({ cost: 12000 }))], 3).rows[0]!;
    expect(r.comp.costPerTrip).toBe(10000);
    expect(r.part.costPerTrip).toBe(12000);
    expect(r.diff).toBe(-2000);
    expect(r.cheaper).toBe("comp");
    expect(r.gap).toBe(2000 * 3);
    expect(r.compShare).toBeCloseTo(4 / 7);
    expect(r.tripShare).toBe(1);
  });

  it("ตัดสินจากต้นทุน ไม่ใช่กำไร — ฝั่งที่ได้งานมูลค่าสูงกว่าไม่ได้เปรียบ", () => {
    // รถบริษัทได้งานแพงกว่ามาก กำไร/เที่ยวสูงกว่า แต่ต้นทุนก็แพงกว่า → รถร่วมถูกกว่า
    const r = compareSides([...many(3, { rev: 30000, cost: 12000 }), ...many(3, part({ rev: 15000, cost: 9000 }))], 3).rows[0]!;
    expect(r.comp.perTrip).toBeGreaterThan(r.part.perTrip);
    expect(r.cheaper).toBe("part");
    expect(r.gap).toBe(3000 * 3);
  });

  it("ต่างกันไม่ถึง 5% ของต้นทุนต่อเที่ยว = พอ ๆ กัน", () => {
    // ต้นทุนเฉลี่ย 10,200 × 5% = 510 · ต่าง 400
    const r = compareSides([...many(3), ...many(3, part({ cost: 10400 }))], 3).rows[0]!;
    expect(r.cheaper).toBe("tie");
    expect(r.gap).toBe(0);
  });

  it("ไม่ใช้เที่ยววิ่งเปล่า · รถร่วมนอกพิเศษนับเป็นฝั่งรถร่วม", () => {
    const res = compareSides([
      ...many(3), ...many(2, part()), trip(part({ ft: "รถร่วมนอกพิเศษ" })),
      trip({ empty: true, rev: 0 }),
    ], 3);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.part.n).toBe(3);
    expect(res.rows[0]!.comp.n).toBe(3);
  });
});
