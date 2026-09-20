import { describe, expect, it } from "vitest";
import { adviceOf, summarize } from "./compare";
import type { Trip } from "../data/useCostRev";

let seq = 0;
/** เที่ยวจำลอง — รถบริษัท 10 ล้อ เส้น ก-ข กลุ่มบริการ "ทั่วไป" รายได้ 15,000 ต้นทุน 10,000 */
function trip(p: Partial<Trip> = {}): Trip {
  seq++;
  const rev = p.rev ?? 15000, cost = p.cost ?? 10000;
  return {
    id: String(1e12 + seq), d: "2025-01-05", mo: "2025-01", y: 2025, br: "สาขา", t: "ของเหมา",
    ft: "รถบริษัท", vk: "รถ 10 ล้อ", pl: `พล-${seq}`, o: "ก", de: "ข", rt: "ก-ข", dir: "",
    km: 400, rev, cost, profit: rev - cost, empty: false, clear: false, clrAmt: 0, clrN: 0, m: true,
    bn: 1, cus: ["ลูกค้า"],
    waste: 0, fuel: 0, allow: 0, fee: 0, repair: 0, dep: 0, rent: 0,
    f_cash: 0, f_down: 0, f_up: 0, f_pickup: 0, f_call: 0, a_drv: 0, a_spare: 0, a_off: 0, sg: "ทั่วไป",
    fe_tarp: 0, fe_police: 0, fe_insure: 0, fe_cont: 0, fe_port: 0, fe_doc: 0, fe_toll: 0,
    ...p,
  };
}
const many = (n: number, p: Partial<Trip> = {}) => Array.from({ length: n }, () => trip(p));
const part = (p: Partial<Trip> = {}) => ({ ft: "รถร่วม", ...p });

describe("adviceOf", () => {
  it("รถร่วมถูกกว่า → เปลี่ยน/พิจารณา ตามอัตรากำไร", () => {
    expect(adviceOf(-7, "part")).toBe("switch-part");
    expect(adviceOf(3, "part")).toBe("switch-part");
    expect(adviceOf(7, "part")).toBe("consider-part");
    expect(adviceOf(35, "part")).toBe("consider-part");
  });
  it("รถบริษัทถูกกว่าหรือพอ ๆ กัน → คงไว้ ยกเว้นอัตรากำไรต่ำ", () => {
    expect(adviceOf(35, "comp")).toBe("keep-comp");
    expect(adviceOf(35, "tie")).toBe("keep-comp");
    expect(adviceOf(7, "comp")).toBe("review-low");
    expect(adviceOf(-7, "comp")).toBe("review-loss");
  });
  it("ไม่มีตัวเทียบ ใช้อัตรากำไรอย่างเดียว", () => {
    expect(adviceOf(35, null)).toBe("keep-comp");
    expect(adviceOf(2, null)).toBe("review-low");
  });
});

describe("summarize", () => {
  it("ยุบตาม เส้นทาง × ชนิดรถ (กลุ่มบริการไม่เกี่ยว) พร้อมสัดส่วนเที่ยวของสองฝั่ง", () => {
    const res = summarize([...many(3), ...many(1, part()), ...many(2, { vk: "รถ 6 ล้อ" })]);
    expect(res.rows).toHaveLength(2);
    const a = res.rows.find((r) => r.vk === "รถ 10 ล้อ")!;
    expect(a.n).toBe(4);
    expect(a.compShare).toBeCloseTo(0.75);
    expect(a.partShare).toBeCloseTo(0.25);
    expect(a.rev).toBe(60000);
    expect(a.cost).toBe(40000);
    expect(a.profit).toBe(20000);
    expect(a.margin).toBeCloseTo(33.33, 1);
    expect(res.summary.groups).toBe(2);
    expect(res.summary.bothSides).toBe(1);
    expect(res.summary.bothSidesTripShare).toBeCloseTo(4 / 6);
    expect(res.summary.kinds).toBe(2);
  });

  it("ตัดสินฝั่งที่ถูกกว่าจากต้นทุนเฉลี่ยต่อเที่ยว ไม่ใช่กำไร", () => {
    // รถบริษัทได้งานแพงกว่า กำไร/เที่ยวสูงกว่า แต่ต้นทุนก็แพงกว่า
    const r = summarize([...many(3, { rev: 30000, cost: 12000 }), ...many(3, part({ rev: 15000, cost: 9000 }))]).rows[0]!;
    expect(r.compCost).toBe(12000);
    expect(r.partCost).toBe(9000);
    expect(r.cheaper).toBe("part");
    expect(r.advice).toBe("consider-part");
  });

  it("ต่างไม่ถึง 5% = พอ ๆ กัน", () => {
    const r = summarize([...many(3), ...many(3, part({ cost: 10400 }))]).rows[0]!;
    expect(r.cheaper).toBe("tie");
  });

  it("กลุ่มที่มีรถฝั่งเดียว ใช้ค่าเฉลี่ยของชนิดรถทั้งชุดแทน แล้วติดธงว่าเป็นค่าประมาณ", () => {
    const res = summarize([
      ...many(3, { rt: "ค-ง" }),                          // เส้นนี้มีแต่รถบริษัท
      ...many(2, part({ rt: "ก-ข", cost: 6000 })),        // รถร่วมของชนิดรถเดียวกัน อยู่คนละเส้น
    ]);
    const only = res.rows.find((r) => r.rt === "ค-ง")!;
    expect(only.partN).toBe(0);
    expect(only.partEst).toBe(true);
    expect(only.compEst).toBe(false);
    expect(only.partCost).toBe(6000);          // ค่าเฉลี่ยรถร่วมของ "รถ 10 ล้อ" ทั้งชุด
    expect(only.cheaper).toBe("part");
    expect(res.summary.bothSides).toBe(0);
  });

  it("ชนิดรถที่ไม่มีอีกฝั่งเลยทั้งชุด = ไม่มีตัวเทียบ ใช้อัตรากำไรอย่างเดียว", () => {
    const r = summarize(many(3, { vk: "รถ 6 ล้อ" })).rows[0]!;
    expect(r.partCost).toBeNull();
    expect(r.cheaper).toBeNull();
    expect(r.advice).toBe("keep-comp");
    expect(r.margin).toBeCloseTo(33.33, 1);
  });

  it("ไม่ใช้เที่ยววิ่งเปล่า · รถร่วมนอกพิเศษนับเป็นฝั่งรถร่วม", () => {
    const res = summarize([
      ...many(2), trip(part({ ft: "รถร่วมนอกพิเศษ" })),
      trip({ empty: true, rev: 0 }),
    ]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.n).toBe(3);
    expect(res.rows[0]!.partN).toBe(1);
  });
});
