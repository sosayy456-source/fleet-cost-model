import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeTripColumns, decodeTripColumnsAsync, decodeTripColumnsSlow, isTripColumns } from "./tripCols";
import type { TripColumns } from "./tripCols";

describe("trips.json แบบคอลัมน์", () => {
  it("แปลงกลับได้ครบทุกชนิดคอลัมน์", () => {
    const enc: TripColumns = {
      format: "cols-1", n: 2, str: ["ลำปาง", "a", "b", "10 ล้อ", "ทั่วไป"],
      cols: {
        id: { t: "r", v: ["1", "2"] },
        br: { t: "s", v: [0, 0] },
        km: { t: "n", v: [null, 12.5] },
        m: { t: "b", v: [1, 0] },
        cus: { t: "ls", v: [[1, 2], []] },
        vs: { t: "lo", k: ["pl", "vk", "c"], kt: ["s", "s", "n"], v: [[[1, 3, 100]], []] },
        serviceRevenue: { t: "do", v: [[4, 50.5], []] },
      },
    };
    expect(isTripColumns(enc)).toBe(true);
    expect(isTripColumns([])).toBe(false);
    expect(decodeTripColumnsSlow(enc)).toEqual(decodeTripColumns(enc));
    expect(decodeTripColumns(enc)).toEqual([
      { id: "1", br: "ลำปาง", km: null, m: true, cus: ["a", "b"],
        vs: [{ pl: "a", vk: "10 ล้อ", c: 100 }], serviceRevenue: { "ทั่วไป": 50.5 } },
      { id: "2", br: "ลำปาง", km: 12.5, m: false, cus: [], vs: [], serviceRevenue: {} },
    ]);
  });

  it("ไฟล์ชุดตัวอย่างที่ commit ไว้แปลงได้ครบตาม manifest", async () => {
    const dir = resolve(__dirname, "../../../public/data/sample/costrev");
    const raw = JSON.parse(readFileSync(resolve(dir, "trips.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
    const trips = isTripColumns(raw) ? decodeTripColumns(raw) : raw;
    // สามทาง (เร็ว · แบ่งช่วง · ทีละคอลัมน์) ต้องได้ผลเดียวกันทุกฟิลด์
    if (isTripColumns(raw)) {
      expect(await decodeTripColumnsAsync(raw, 1000)).toEqual(trips);
      expect(decodeTripColumnsSlow(raw)).toEqual(trips);
    }
    expect(trips).toHaveLength(manifest.rows);
    expect(typeof trips[0].m).toBe("boolean");
    expect(Array.isArray(trips[0].cus)).toBe(true);
  });
});
