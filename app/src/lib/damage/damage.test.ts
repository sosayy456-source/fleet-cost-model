/**
 * สูตรแท็บ Damage Rate — P75 ต้องตรงกับ PERCENTILE.INC ของ Excel และการจัดระดับต้องตรง logic หน้า 7 ของสเปก
 */
import { describe, expect, it } from "vitest";
import { aggregateDamage, damageLevel, damageThresholds, inPeriod, percentileInc, totalDamage } from "./damage";
import type { DamageThresholds } from "./damage";

describe("percentileInc = PERCENTILE.INC ของ Excel", () => {
  it("ค่าที่ตรวจกับ Excel แล้ว", () => {
    expect(percentileInc([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25);           // =PERCENTILE.INC({1,2,3,4},0.75)
    expect(percentileInc([50, 15, 40, 20, 35], 0.75)).toBeCloseTo(40);     // ไม่เรียงมาก่อนก็ต้องได้เท่าเดิม
    expect(percentileInc([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.75)).toBeCloseTo(7.75);
  });

  it("ค่าเดียว = ค่านั้นเอง (กรณีเลือกเดือนเดียว) · ไม่มีค่า = null", () => {
    expect(percentileInc([2.5], 0.75)).toBe(2.5);
    expect(percentileInc([], 0.75)).toBeNull();
  });
});

describe("รวมยอด", () => {
  const trips = [
    { mo: "2025-01", rev: 1000, clrAmt: 10, clrN: 2 },
    { mo: "2025-01", rev: 1000, clrAmt: 0, clrN: 0 },
    { mo: "2025-02", rev: 2000, clrAmt: 0, clrN: 0 },
    { mo: "2025-02", rev: 2000, clrAmt: 20, clrN: 1 },
  ];

  it("Incidence นับเที่ยว ไม่นับรายการบิล", () => {
    const t = totalDamage(trips);
    expect(t.n).toBe(4);
    expect(t.dmgTrips).toBe(2);          // เที่ยวแรกมีบิลเคลียร์ 2 รายการ แต่นับเป็นเที่ยวเดียว
    expect(t.incidence).toBe(50);
    expect(t.rate).toBeCloseTo(30 / 6000 * 100);
  });

  it("อัตรารวมคิดจากยอดรวม ไม่ใช่เฉลี่ยจากรายกลุ่ม", () => {
    const [jan, feb] = aggregateDamage(trips, (t) => t.mo);
    expect(jan!.rate).toBeCloseTo(0.5);
    expect(feb!.rate).toBeCloseTo(0.5);
    expect(totalDamage(trips).rate).toBeCloseTo(0.5);
  });

  it("P75 มาจาก KPI รายเดือน", () => {
    const th = damageThresholds(trips);
    expect(th.months).toBe(2);
    expect(th.p75Incidence).toBeCloseTo(50);   // สองเดือน 50% เท่ากัน
    expect(th.p75Rate).toBeCloseTo(0.5);
  });
});

describe("damageLevel — logic หน้า 7", () => {
  const th: DamageThresholds = { p75Rate: 1, p75Incidence: 5, months: 12 };
  const lv = (rate: number | null, incidence: number, clrAmt = 100) => damageLevel({ rate, incidence, clrAmt }, th);

  it("ไม่มีความเสียหาย = ไม่มีมูลค่าบิลเคลียร์", () => {
    expect(lv(0, 0, 0)).toBe("none");
  });
  it("เกิดไม่บ่อย = ระดับต่ำ ไม่ว่ามูลค่าจะสูงแค่ไหน", () => {
    expect(lv(0.1, 2)).toBe("low");
    expect(lv(9, 2)).toBe("low");
    expect(lv(9, 5)).toBe("low");            // เท่ากับ P75 ยังไม่ถือว่าเกิน
  });
  it("เกิดบ่อยแต่มูลค่าไม่เกิน = ปานกลาง", () => {
    expect(lv(0.5, 8)).toBe("medium");
    expect(lv(1, 8)).toBe("medium");         // เท่ากับ P75 ยังไม่ถือว่าเกิน
  });
  it("เกินทั้งคู่ = ระดับสูง", () => {
    expect(lv(1.2, 8)).toBe("high");
  });
  it("มีความเสียหายแต่ไม่มีรายได้ = เกินเกณฑ์มูลค่าแน่นอน", () => {
    expect(lv(null, 8)).toBe("high");
  });
  it("ยังไม่มีเกณฑ์ = แยกระดับไม่ได้ (ยกเว้นไม่มีความเสียหาย)", () => {
    const none: DamageThresholds = { p75Rate: null, p75Incidence: null, months: 0 };
    expect(damageLevel({ rate: 1, incidence: 5, clrAmt: 10 }, none)).toBeNull();
    expect(damageLevel({ rate: 0, incidence: 0, clrAmt: 0 }, none)).toBe("none");
  });
});

describe("inPeriod", () => {
  const t = (mo: string) => ({ y: Number(mo.slice(0, 4)), mo });
  it("ทุกปี = ผ่านทั้งหมด", () => {
    expect(inPeriod(t("2024-07"), { year: "", from: "01", to: "12" })).toBe(true);
  });
  it("ช่วงเดือนรวมเดือนหัวท้าย", () => {
    const p = { year: "2024", from: "01", to: "04" };
    expect(inPeriod(t("2024-01"), p)).toBe(true);
    expect(inPeriod(t("2024-04"), p)).toBe(true);
    expect(inPeriod(t("2024-05"), p)).toBe(false);
    expect(inPeriod(t("2025-02"), p)).toBe(false);
  });
});
