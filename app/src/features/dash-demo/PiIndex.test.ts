import { describe, expect, it } from "vitest";
import type { Trip } from "../../lib/data/useCostRev";
import { DEMO_F0 } from "./filter";
import { emptyPiResult } from "./PiIndex";

const trip = (br: string, rt: string, d: string, empty: boolean): Trip =>
  ({ br, rt, d, mo: d.slice(0, 7), y: Number(d.slice(0, 4)), empty }) as Trip;
const filter = { ...DEMO_F0, br: "สาขา ก", year: "2026", from: "05", to: "05" };

describe("PI เที่ยวเปล่า: เกณฑ์บริษัทและช่วงประเมินของสาขา", () => {
  it("สาขามีเส้นทางไม่ถึงขั้นต่ำ ใช้ประวัติทั้งบริษัท แต่ให้คะแนนเฉพาะสาขาที่เลือก", () => {
    const all = [
      trip("สาขา ก", "ก", "2025-05-01", true),
      ...["ข", "ค", "ง"].map((rt) => trip("สาขา ข", rt, "2025-05-01", false)),
      trip("สาขา ก", "ก", "2026-05-01", true),
      trip("สาขา ข", "ข", "2026-05-01", false),
    ];
    const result = emptyPiResult(all, filter);
    expect(result.scope).toContain("ระดับบริษัท");
    expect(result.scope).toContain("ไม่ถึงขั้นต่ำ 30");
    expect(result.tally).toEqual({ g: 0, y: 0, r: 1, n: 1 });
    expect(result.score).toBe(0);
  });

  it("สาขามีเส้นทางถึงขั้นต่ำ ใช้เกณฑ์ของสาขา", () => {
    const all = [
      ...Array.from({ length: 30 }, (_, i) => trip("สาขา ก", `เส้นทาง ${i}`, "2025-05-01", true)),
      ...Array.from({ length: 100 }, (_, i) => trip("สาขา ข", `อื่น ${i}`, "2025-05-01", false)),
      trip("สาขา ก", "เส้นทาง 0", "2026-05-01", true),
    ];
    const result = emptyPiResult(all, filter);
    expect(result.scope).toBe("ระดับสาขา สาขา ก");
    expect(result.tally).toEqual({ g: 1, y: 0, r: 0, n: 1 });
    expect(result.score).toBe(10);
  });
});
