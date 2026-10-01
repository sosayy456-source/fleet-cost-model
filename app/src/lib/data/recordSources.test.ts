import { describe, expect, it } from "vitest";
import { freshRecords, payerOf, recordAlloc, recordDebtors, recordLfTrips, recordTrip } from "./recordSources";
import { mixCostRev } from "./mixSources";
import type { TripRecord } from "../../types/record";
import type { DebtorRow } from "./useDebtors";
import type { LfTrip } from "./useLoadFactor";
import type { CostRevData } from "./useCostRev";
import type { DataSourceCtx } from "./dataSourceCtx";

const bill = (o: Partial<TripRecord["bills"][number]> = {}): TripRecord["bills"][number] => ({
  no: "B1", goodsType: "สินค้าทั่วไป", sender: "CUS0000001", receiver: "CUS0000002", origin: "เชียงใหม่", dest: "ตลาดไท",
  qty: 1, total: 1000, payType: "เชื่อต้นทาง", paid: false, payDate: null, ...o,
});

// ใบที่ฝ่ายบัญชีกรอกแล้ว (_accountDone) — ต้นทุนจริง normal + waste
const rec = (o: Partial<TripRecord> = {}): TripRecord => ({
  id: "r1", docNo: "6690100001123", date: "2026-09-10", releaseDate: "2026-09-11", branch: "เชียงใหม่",
  origin: "เชียงใหม่", dest: "ตลาดไท", dist: 700, revenue: 3000, plate: "70-1234", fleetType: "รถบริษัท",
  vehicle: "รถ 10 ล้อ(ตู้แห้ง)", capacity: 10000, loadActual: 4000, emptyLeg: false,
  bills: [bill(), bill({ no: "B2", total: 2000, payType: "เชื่อปลายทาง", term: 15 }), bill({ no: "B3", goodsType: "บิลเคลียร์", total: 50 })],
  fuelSum: 800, labor: 300, fees: 100, repTotal: 200, normal: 1500, waste: 100,
  _accountDone: true,
  ...o,
} as unknown as TripRecord);

describe("ใบที่บันทึกใหม่ → ข้อมูลรูปเดียวกับไฟล์", () => {
  it("ผู้จ่ายเงิน = ผู้ส่ง ยกเว้นปลายทาง", () => {
    expect(payerOf(bill()).code).toBe("CUS0000001");
    expect(payerOf(bill({ payType: "สดปลายทาง" })).code).toBe("CUS0000002");
  });

  it("เลขที่ใบซ้ำกับไฟล์ = ใช้ไฟล์ ไม่นับใบใหม่ซ้ำ", () => {
    expect(freshRecords([rec()], new Set(["6690100001123"]))).toHaveLength(0);
    expect(freshRecords([rec()], new Set())).toHaveLength(1);
  });

  it("Trip: ต้นทุนจริง · บิลเคลียร์แยกเป็น clrAmt ไม่เป็นลูกค้า · วันที่ = วันปล่อยรถ", () => {
    const t = recordTrip(rec(), null);
    expect(t.d).toBe("2026-09-11");
    expect(t.cost).toBe(1600);
    expect(t.profit).toBe(1400);
    expect(t.clrAmt).toBe(50);
    expect(t.cus.sort()).toEqual(["CUS0000001", "CUS0000002"]);
    expect(t.m).toBe(true);
    expect(t.wt).toBe(4);
  });

  it("Load Factor = น้ำหนักบรรทุก ÷ ความจุ · เป้าจากชนิดรถเดียวกันในไฟล์", () => {
    const r = rec();
    const t = recordTrip(r, null);
    const file = [{ vk: r.vehicle, tg: 0.9 }, { vk: "อื่น", tg: 0.5 }] as LfTrip[];
    const [lf] = recordLfTrips([t], [r], file);
    expect(lf!.lf).toBeCloseTo(0.4);
    expect(lf!.tg).toBe(0.9);
    expect(lf!.vc).toBe(1200);
  });

  it("ปันต้นทุนเข้าลูกค้า: รวมเท่าต้นทุนเที่ยว ไม่นับบิลเคลียร์ · ลูกค้าใหม่ต่อท้ายตาราง", () => {
    const r = rec();
    const t = recordTrip(r, null);
    const ra = recordAlloc([r], [t], [], [{ side: "ผู้ส่ง", code: "CUS0000001", n: 1, bills: 0, revenue: 0, cost: 0, profit: 0, lossBills: 0, margin: null }]);
    expect(ra.added.map((c) => c.code)).toEqual(["CUS0000002"]);
    expect(ra.months.map((m) => m.ci).sort()).toEqual([0, 1]);
    // บิลเคลียร์ถูกปันต้นทุนด้วย (ส่วนของมันไม่เข้าลูกค้า) — ยอดที่เข้าลูกค้าจึงไม่เกินต้นทุนเที่ยว
    const cost = ra.months.reduce((s, m) => s + m.cost, 0);
    expect(cost).toBeLessThanOrEqual(t.cost + 0.01);
    expect(ra.months.every((m) => m.d === t.d)).toBe(true);
  });

  it("ลูกหนี้: เครดิตจากบิล → ของลูกค้าในไฟล์ · ชำระแล้วปิดตามวันที่ชำระ · เงินสดปิดวันวางบิล", () => {
    const r = rec({ bills: [
      bill(), bill({ no: "B2", term: 15 }), bill({ no: "B4", paid: true, payDate: "2026-09-20" }),
      bill({ no: "B5", payType: "สดต้นทาง" }), bill({ no: "B6", goodsType: "บิลเคลียร์" }),
    ] });
    const file = [{ cust: "CUS0000001", term: 45 }, { cust: "CUS0000001", term: 45 }, { cust: "X", term: 30 }] as DebtorRow[];
    const rows = recordDebtors([r], file, "2026-10-01");
    expect(rows.map((x) => x.doc)).toEqual(["B1", "B2", "B4", "B5"]);
    expect(rows[0]!.term).toBe(45);
    expect(rows[0]!.due).toBe("2026-10-25");
    expect(rows[1]!.term).toBe(15);
    expect(rows[2]!.close).toBe("2026-09-20");
    expect(rows[3]!.close).toBe(r.date);
    expect(rows[3]!.term).toBe(0);
  });

  it("ผสมตามตัวกรอง: เก่า = ไฟล์ตัวเดิม · ใหม่ = ใบใหม่ล้วน · ทั้งหมด = รวม", () => {
    const fileTrip = { ...recordTrip(rec({ docNo: "F1" }), null) };
    const data = { manifest: {}, trips: [fileTrip], svc: null } as unknown as CostRevData;
    const fresh = recordTrip(rec(), null);
    const ctx = (src: DataSourceCtx["src"]): DataSourceCtx => ({ src, records: [rec()], trips: [fresh], pending: [], fc: null });
    expect(mixCostRev(data, null)).toBe(data);
    expect(mixCostRev(data, ctx("old"))).toBe(data);
    expect(mixCostRev(data, ctx("new"))!.trips).toEqual([fresh]);
    expect(mixCostRev(data, ctx("all"))!.trips).toHaveLength(2);
  });
});
