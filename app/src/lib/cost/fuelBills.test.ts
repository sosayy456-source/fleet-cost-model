import { describe, expect, it } from "vitest";
import {
  FUEL_BUCKETS, FUEL_BUCKET_OF, applyFuelBills, emptyFuelBill, fuelBillAmount,
  fuelBillsByCat, fuelBillsToTotals, legacyFuelToBills,
} from "./fuelBills";
import { FUEL_CATS, FUEL_PAYS } from "../../types/record";
import type { FuelBill, FuelCat, FuelPay, TripRecord } from "../../types/record";
import { emptyRecord } from "../../features/entry/emptyRecord";

const bill = (p: Partial<FuelBill>): FuelBill => ({ ...emptyFuelBill("2569-01-01"), ...p });

describe("ตารางแมป (ประเภท × วิธีจ่าย)", () => {
  it("ครบทุกคู่ และชี้ไปที่ 1 ใน 9 ช่องเดิมเสมอ", () => {
    for (const cat of FUEL_CATS) {
      for (const pay of FUEL_PAYS) {
        const k = FUEL_BUCKET_OF[cat][pay];
        expect(FUEL_BUCKETS, `${cat}×${pay}`).toContain(k);
      }
    }
  });

  it("Fleet Card ลงช่องของ Fleet Card เสมอ แยกปกติ/สูญเปล่า", () => {
    expect(FUEL_BUCKET_OF.down.fleet).toBe("fuelFleet");
    expect(FUEL_BUCKET_OF.pickup.fleet).toBe("fuelFleet");
    expect(FUEL_BUCKET_OF.offroute.fleet).toBe("fuelOffFleet");
    expect(FUEL_BUCKET_OF.detour.fleet).toBe("fuelOffFleet");
  });

  it("ยอดประมาณลงช่องเดียวกับเงินสด", () => {
    for (const cat of FUEL_CATS) {
      expect(FUEL_BUCKET_OF[cat].est, cat).toBe(FUEL_BUCKET_OF[cat].cash);
    }
  });
});

describe("fuelBillsToTotals", () => {
  it("ไม่มีบิล = ทุกช่องเป็น 0 (รับ undefined ได้)", () => {
    const t = fuelBillsToTotals(undefined);
    for (const k of FUEL_BUCKETS) expect(t[k]).toBe(0);
    expect(t.fuelEst).toBe(0);
  });

  it("ยอดรวมทุกช่องเท่ากับผลรวมของทุกแถว ไม่รั่วไม่ซ้ำ", () => {
    const bills = [
      bill({ cat: "down", pay: "bill", amount: 5040 }),
      bill({ cat: "up", pay: "cash", amount: 4620 }),
      bill({ cat: "pickup", pay: "fleet", amount: 300 }),
      bill({ cat: "detour", pay: "bill", amount: 630 }),
      bill({ cat: "offroute", pay: "fleet", amount: 210 }),
    ];
    const t = fuelBillsToTotals(bills);
    const sum = FUEL_BUCKETS.reduce((s, k) => s + t[k], 0);
    expect(sum).toBeCloseTo(5040 + 4620 + 300 + 630 + 210, 2);
    expect(t.fuelDownBill).toBe(5040);
    expect(t.fuelCash).toBe(4620);
    expect(t.fuelFleet).toBe(300);
    expect(t.fuelDetour).toBe(630);
    expect(t.fuelOffFleet).toBe(210);
  });

  it("เงินสดขาล่องกับขาขึ้นยุบลงช่องเดียวกัน (ข้อจำกัดของช่องเดิมที่ยอมรับแล้ว)", () => {
    const t = fuelBillsToTotals([
      bill({ cat: "down", pay: "cash", amount: 100 }),
      bill({ cat: "up", pay: "cash", amount: 250 }),
    ]);
    expect(t.fuelCash).toBe(350);
    expect(t.fuelDownBill).toBe(0);
    expect(t.fuelUpBill).toBe(0);
  });

  it("ยอดประมาณคิดจาก กม. × อัตรา × ราคา และนับเข้า fuelEst ด้วย", () => {
    const b = bill({ cat: "call", pay: "est", km: 40, ratePerKm: 0.25, pricePerL: 42.03, amount: 99999 });
    expect(fuelBillAmount(b)).toBeCloseTo(420.3, 2);
    const t = fuelBillsToTotals([b]);
    expect(t.fuelCallTruck).toBeCloseTo(420.3, 2);
    expect(t.fuelEst).toBeCloseTo(420.3, 2);
  });

  it("แถวที่ไม่ใช่ est ไม่นับเข้า fuelEst", () => {
    expect(fuelBillsToTotals([bill({ amount: 1000 })]).fuelEst).toBe(0);
  });

  it("ไม่มีคีย์ gas — แก๊สอยู่นอกตารางบิล", () => {
    expect(Object.keys(fuelBillsToTotals([]))).not.toContain("gas");
  });
});

describe("fuelBillsByCat", () => {
  it("แยกปกติ/สูญเปล่าถูก และเงินสดสองขาไม่ปนกัน (ต่างจาก 9 ช่อง)", () => {
    const r = fuelBillsByCat([
      bill({ cat: "down", pay: "cash", amount: 100 }),
      bill({ cat: "up", pay: "cash", amount: 250 }),
      bill({ cat: "detour", pay: "bill", amount: 60 }),
    ]);
    expect(r.cat.down).toBe(100);
    expect(r.cat.up).toBe(250);
    expect(r.normal).toBe(350);
    expect(r.waste).toBe(60);
    expect(r.total).toBe(410);
  });

  it("แถว est ที่เป็นสูญเปล่า นับทั้งใน waste และใน est", () => {
    const r = fuelBillsByCat([
      bill({ cat: "offroute", pay: "est", km: 10, ratePerKm: 0.25, pricePerL: 40 }),
    ]);
    expect(r.waste).toBe(100);
    expect(r.est).toBe(100);
    expect(r.normal).toBe(0);
  });
});

describe("แปลงใบรุ่นก่อน _v5", () => {
  /** LCG เดียวกับ tools/gen-golden.mjs — สุ่มซ้ำได้ */
  const rnd = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  it("★ round-trip: 9 ยอดเดิม → บิลสังเคราะห์ → 9 ยอดใหม่ ต้องเท่ากันเป๊ะ", () => {
    const next = rnd(20260919);
    for (let i = 0; i < 200; i++) {
      const rec = emptyRecord() as unknown as Record<string, unknown>;
      const want: Record<string, number> = {};
      for (const k of FUEL_BUCKETS) {
        // 25% เป็น 0 เหมือนชุด golden
        const v = next() < 0.25 ? 0 : Math.round(next() * 20000 * 100) / 100;
        rec[k] = v; want[k] = v;
      }
      const bills = legacyFuelToBills(rec as unknown as TripRecord);
      const back = fuelBillsToTotals(bills);
      for (const k of FUEL_BUCKETS) expect(back[k], `รอบ ${i} ช่อง ${k}`).toBeCloseTo(want[k] ?? 0, 2);
    }
  });

  it("ข้ามช่องที่เป็น 0 และติดธง legacy ให้ทุกแถว", () => {
    const rec = { ...emptyRecord(), fuelCash: 500, fuelDetour: 120 } as TripRecord;
    const bills = legacyFuelToBills(rec);
    expect(bills).toHaveLength(2);
    expect(bills.every((b) => b.src === "legacy")).toBe(true);
    expect(bills.every((b) => b.date === rec.date)).toBe(true);
  });
});

describe("applyFuelBills", () => {
  it("เขียน 9 ยอดทับของเดิม ไม่ใช่บวกทบ — กดบันทึกซ้ำยอดต้องไม่ขยับ", () => {
    let rec = { ...emptyRecord(), fuelCash: 9999, fuelBills: [bill({ amount: 100 })] } as TripRecord;
    rec = applyFuelBills(rec);
    expect(rec.fuelDownBill).toBe(100);
    expect(rec.fuelCash).toBe(0);
    const again = applyFuelBills(rec);
    expect(again.fuelDownBill).toBe(100);
  });

  it("ปิดค่าน้ำมันอัตโนมัติเสมอ ไม่งั้น computeCost จะบวกซ้ำทับยอดบิล", () => {
    const rec = applyFuelBills({ ...emptyRecord(), fuelAutoOn: true, fuelBills: [] } as TripRecord);
    expect(rec.fuelAutoOn).toBe(false);
    expect(rec._v5).toBe(true);
  });
});

describe("ค่าคงที่ที่ห้ามหลุด", () => {
  it("ประเภทและวิธีจ่ายครบตามดีไซน์", () => {
    expect([...FUEL_CATS]).toEqual(["down", "up", "pickup", "call", "offroute", "detour"]);
    expect([...FUEL_PAYS]).toEqual(["bill", "cash", "fleet", "est"]);
  });

  it("แถวเปล่าเริ่มที่ประเภทขาล่าง/วิธีจ่ายบิล และไม่มียอด", () => {
    const b = emptyFuelBill("2569-09-19");
    expect(b.cat as FuelCat).toBe("down");
    expect(b.pay as FuelPay).toBe("bill");
    expect(fuelBillAmount(b)).toBe(0);
  });
});
