import { describe, expect, it } from "vitest";
import { loadStats } from "./load";

describe("loadStats — ความจุหัว + หาง ใช้ฝั่งที่เต็มกว่า", () => {
  it("ไม่มีหาง", () => {
    const s = loadStats({ weight: 6000, volume: 9 }, { kg: 12000, m3: 45 }, null);
    expect(s.capKg).toBe(12000);
    expect(s.loadFactor).toBe(50);
    expect(s.binding).toBe("น้ำหนัก");
    expect(s.tail).toBeNull();
  });

  it("มีหาง = ความจุรวม · ปริมาตรเต็มกว่าก็ใช้ปริมาตร", () => {
    const s = loadStats({ weight: 3000, volume: 62 }, { kg: 12000, m3: 45 }, { kg: 12000, m3: 34 });
    expect(s.capKg).toBe(24000);
    expect(s.capM3).toBe(79);
    expect(s.binding).toBe("ปริมาตร");
    expect(s.head).toBe(100);
    expect(s.tail).toBe(50);
  });

  it("เกินความจุฝั่งใดฝั่งหนึ่ง", () => {
    const s = loadStats({ weight: 13000, volume: 1 }, { kg: 12000, m3: 45 }, null);
    expect(s.overWeight).toBe(true);
    expect(s.overVolume).toBe(false);
  });
});
