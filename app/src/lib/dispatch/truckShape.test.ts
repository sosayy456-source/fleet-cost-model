import { describe, expect, it } from "vitest";
import { headShape, tailShape } from "./truckShape";

describe("ชนิดรถ → ทรงรถในรูปสถานะการบรรทุก", () => {
  it("กลุ่มตามจำนวนล้อ/ทรง", () => {
    expect(["", "รถปิกอัพ 3 ตัน", "รถปิ๊กอัพตู้เย็น", "รถ 6 ล้อเล็ก", "รถ 6 ล้อ FC4", "รถ 10 ล้อ", "รถ 10 ล้อยาว",
      "รถ 10 ล้อพ่วง(แม่)", "รถ 12 ล้อคอก", "รถเทรเลอร์"].map((k) => headShape(k).cls))
      .toEqual(["none", "pickup", "pickup", "6", "6", "10", "10long", "10", "12", "tractor"]);
  });
  it("รูปตู้ตามชื่อ", () => {
    expect(["รถ 6 ล้อ(ตู้แห้ง)", "รถ 10 ล้อตู้เย็น", "รถ 6 ล้อคอก", "รถปิกอัพ 3 ตัน", "รถปิ๊กอัพตู้เย็น"].map((k) => headShape(k).body))
      .toEqual(["dry", "cold", "stake", "bed", "cold"]);
  });
  it("หางเทรเลอร์ = กึ่งพ่วง · หางพ่วง = พ่วงเต็ม", () => {
    expect(tailShape("หางเทรเลอร์")).toEqual({ cls: "semi", body: "dry" });
    expect(tailShape("หางพ่วงตู้เย็น")).toEqual({ cls: "full", body: "cold" });
    expect(tailShape("หางพ่วงคอก")).toEqual({ cls: "full", body: "stake" });
  });
});
