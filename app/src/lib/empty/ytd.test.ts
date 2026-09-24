import { describe, expect, it } from "vitest";
import { emptyYtd, prevYY, ytdLabel, ytdMonths } from "./ytd";
import type { YtdTrip } from "./ytd";

const t = (mo: string, cost: number, empty: boolean): YtdTrip => ({ y: Number(mo.slice(0, 4)), mo, cost, empty });

// ปี 2026 (พ.ศ. 69) มีข้อมูลถึง พ.ค. · ปี 2025 มีครบปี
const rows: YtdTrip[] = [
  t("2026-01", 100, true), t("2026-03", 400, false), t("2026-05", 200, true),
  t("2025-02", 150, true), t("2025-05", 50, true), t("2025-06", 999, true), t("2025-12", 10, false),
];

describe("มูลค่าเที่ยววิ่งเปล่า YTD เทียบปีก่อนช่วงเดียวกัน", () => {
  it("ทั้งปี = ม.ค. ถึงเดือนสุดท้ายที่ปีนั้นมีข้อมูล · เลือกช่วง = ช่วงนั้น", () => {
    expect(ytdMonths(rows, 2026)).toEqual([1, 2, 3, 4, 5]);
    expect(ytdMonths(rows, 2025)).toHaveLength(12);
    expect(ytdMonths(rows, 2026, "03", "03")).toEqual([3]);
    // ช่วงที่เลือกเลยเดือนสุดท้ายที่มีข้อมูล — ตัดท้ายที่เดือนนั้น (ไม่หารด้วยเดือนที่ยังไม่มีข้อมูล)
    expect(ytdMonths(rows, 2026, "03", "12")).toEqual([3, 4, 5]);
    expect(ytdMonths(rows, 2025, "02", "04")).toEqual([2, 3, 4]);
  });

  it("เฉลี่ย/เดือน หารด้วยจำนวนเดือนในช่วง · % ของต้นทุนรวม · YoY เทียบช่วงเดียวกันของปีก่อนเท่านั้น", () => {
    const r = emptyYtd(rows, 2026, [1, 2, 3, 4, 5]);
    expect(r.emptyCost).toBe(300);
    expect(r.avgPerMonth).toBe(60);
    expect(r.share).toBeCloseTo(300 / 700 * 100);
    // ปีก่อนนับแค่ ม.ค.–พ.ค. (150 + 50) — มิ.ย. 999 ต้องไม่ติดมา
    expect(r.prevEmpty).toBe(200);
    expect(r.yoy).toBeCloseTo(50);
  });

  it("ปีก่อนไม่มีเที่ยวในช่วงนี้ = null ไม่ใช่ 0 · ปีก่อนเที่ยวเปล่า 0 บาท = หาร YoY ไม่ได้", () => {
    expect(emptyYtd(rows, 2025, [2]).prevEmpty).toBeNull();
    const zero = emptyYtd([t("2026-01", 100, true), t("2025-01", 80, false)], 2026, [1]);
    expect(zero.prevEmpty).toBe(0);
    expect(zero.yoy).toBeNull();
  });

  it("ป้ายช่วงเป็นปี พ.ศ. สองหลัก", () => {
    expect(ytdLabel(2026, [1, 2, 3, 4, 5], false)).toBe("YTD ม.ค.–พ.ค. 69");
    expect(ytdLabel(2025, Array.from({ length: 12 }, (_, i) => i + 1), false)).toBe("ทั้งปี 68");
    expect(ytdLabel(2026, [3], true)).toBe("มี.ค. 69");
    expect(ytdLabel(2026, [3, 4, 5], true)).toBe("มี.ค.–พ.ค. 69");
    expect(ytdLabel(2026, [1], false)).toBe("YTD ม.ค. 69");
    expect(prevYY(2026)).toBe("68");
  });
});
