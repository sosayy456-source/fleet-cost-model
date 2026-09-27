/**
 * สูตรแท็บ Damage Rate — P75 ต้องตรงกับ PERCENTILE.INC ของ Excel และการจัดระดับต้องตรงเกณฑ์ 5 กรณี (dashboard คชจ (1).pdf หน้า 1)
 */
import { describe, expect, it } from "vitest";
import { LEVELS, RECS, aggregateDamage, damageLevel, damageRec, damageThresholds, inPeriod, levelOf, percentileInc, recOf, totalDamage } from "./damage";
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

describe("ระดับความเสียหาย 4 ระดับ + คำแนะนำ (dashboard คชจ.md 27 ก.ย. 2569)", () => {
  const th: DamageThresholds = { p75Rate: 1, p75Incidence: 5, months: 12, usable: true };
  const a = (rate: number | null, incidence: number, clrAmt = 100, dmgTrips = 1) => ({ rate, incidence, clrAmt, dmgTrips });
  const lv = (rate: number | null, incidence: number) => damageLevel(a(rate, incidence), th);
  const rc = (rate: number | null, incidence: number) => damageRec(a(rate, incidence), th);

  it("DR = 0 และ DIR = 0 → ไม่มีความเสียหาย · ติดตามผล", () => {
    expect(damageLevel(a(0, 0, 0, 0), th)).toBe("none");
    expect(damageRec(a(0, 0, 0, 0), th)).toBe("follow");
  });
  it("ไม่เกินทั้งคู่ → ระดับต่ำ · ตรวจสอบ · เท่ากับ P75 ไม่ถือว่าเกิน", () => {
    expect([lv(0.1, 2), lv(1, 5)]).toEqual(["low", "low"]);
    expect([rc(0.1, 2), rc(1, 5)]).toEqual(["check", "check"]);
  });
  it("เกินตัวใดตัวหนึ่ง → ระดับปานกลาง · คำแนะนำต่างตามตัวที่เกิน", () => {
    expect([lv(0.5, 8), lv(9, 2)]).toEqual(["medium", "medium"]);
    expect(rc(0.5, 8)).toBe("improve");   // DIR เกิน DR ไม่เกิน
    expect(rc(9, 2)).toBe("check");       // DR เกิน DIR ไม่เกิน — ตาม logic ในไฟล์ (ระดับปานกลาง แต่คำแนะนำตรวจสอบ)
  });
  it("เกินทั้งคู่ → ระดับสูง · เร่งตรวจสอบและแก้ไข", () => {
    expect(lv(1.2, 8)).toBe("high");
    expect(levelOf("high").label).toBe("ระดับสูง");
    expect(recOf(rc(1.2, 8)!).label).toBe("เร่งตรวจสอบและแก้ไข");
  });
  it("มีความเสียหายแต่ไม่มีรายได้ = เกินเกณฑ์มูลค่าแน่นอน", () => {
    expect(lv(null, 8)).toBe("high");
    expect(lv(null, 2)).toBe("medium");
  });
  it("ตารางตามไฟล์: 4 ระดับ · 4 คำแนะนำ", () => {
    expect(LEVELS.map((l) => l.key)).toEqual(["high", "medium", "low", "none"]);
    expect(RECS.map((r) => r.label)).toEqual(["ติดตามผล", "ตรวจสอบ", "ปรับปรุงกระบวนการ", "เร่งตรวจสอบและแก้ไข"]);
  });
  it("เดือนเดียว/ไม่มีเกณฑ์ = ไม่จัดระดับ/คำแนะนำ (ยกเว้นไม่มีความเสียหาย)", () => {
    const one: DamageThresholds = { p75Rate: 1, p75Incidence: 5, months: 1, usable: false };
    expect(damageLevel(a(1, 5), one)).toBeNull();
    expect(damageRec(a(1, 5), one)).toBeNull();
    expect(damageLevel(a(0, 0, 0, 0), one)).toBe("none");
    expect(damageRec(a(0, 0, 0, 0), one)).toBe("follow");
    expect(damageThresholds([{ mo: "2026-01", rev: 1000, clrAmt: 10, clrN: 1 }]).usable).toBe(false);
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
