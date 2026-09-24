import { describe, expect, it } from "vitest";
import { splitLoad } from "./loadSplit";

const HEAD = { kg: 12000, m3: 45 };
const TAIL = { kg: 12000, m3: 34 };

describe("splitLoad — เติมตู้หัวก่อน ล้นไปตู้หาง", () => {
  it("ไม่มีหาง = ทุกอย่างอยู่ตู้หัว ใช้ฝั่งที่เต็มกว่า", () => {
    expect(splitLoad({ weight: 6000, volume: 9 }, HEAD, null)).toEqual({ head: 50, tail: null });
  });

  it("ยังไม่เต็มหัว = หางว่าง", () => {
    expect(splitLoad({ weight: 6000, volume: 9 }, HEAD, TAIL)).toEqual({ head: 50, tail: 0 });
  });

  it("ล้นหัว = หัว 100% ส่วนเกินไปหาง", () => {
    const r = splitLoad({ weight: 18000, volume: 20 }, HEAD, TAIL);
    expect(r.head).toBe(100);
    expect(r.tail).toBe(50);
  });

  it("แต่ละมิติล้นแยกกัน — หางใช้ฝั่งที่เต็มกว่า", () => {
    // น้ำหนักไม่ล้น แต่ปริมาตรล้น 17 ลบ.ม. = 50% ของหาง
    const r = splitLoad({ weight: 3000, volume: 62 }, HEAD, TAIL);
    expect(r.head).toBe(100);
    expect(r.tail).toBe(50);
  });

  it("หัวไม่มีสเปก = ของทั้งหมดไปหาง", () => {
    expect(splitLoad({ weight: 6000, volume: 0 }, { kg: 0, m3: 0 }, TAIL)).toEqual({ head: 0, tail: 50 });
  });
});
