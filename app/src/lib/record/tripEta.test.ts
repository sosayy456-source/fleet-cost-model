/**
 * เทสต์การประมาณวันเดินทางเสร็จ — ตัวที่ตัดสินว่ารถคันไหน "ยังวิ่งอยู่" บนแดชบอร์ด
 * เน้นเคสที่พลาดแล้วรถจะค้างสถานะผิดทั้งกอง: ไม่รู้ระยะทาง, ใบลงวันล่วงหน้า, กดจบงานแล้ว
 */
import { describe, expect, it } from "vitest";
import { KM_PER_DAY, tripDist, tripEta, tripProgress, tripStart } from "./tripEta";
import { addDaysISO } from "./date";
import type { TripRecord } from "../../types/record";

const t = (over: Partial<TripRecord>): Partial<TripRecord> => ({
  date: "2026-09-10", releaseDate: "", origin: "เชียงใหม่", dest: "ตลาดไท", dist: 0, ...over,
});

describe("tripStart", () => {
  it("ใช้วันปล่อยรถก่อน", () => {
    expect(tripStart(t({ date: "2026-09-10", releaseDate: "2026-09-12" }))).toBe("2026-09-12");
  });
  it("วันปล่อยรถว่าง ถอยไปใช้วันที่ในใบ", () => {
    expect(tripStart(t({ releaseDate: "" }))).toBe("2026-09-10");
  });
  it("ไม่มีทั้งคู่ได้ค่าว่าง", () => {
    expect(tripStart({ date: "", releaseDate: "" })).toBe("");
  });
});

describe("tripDist", () => {
  it("ใช้ระยะทางที่กรอกไว้ก่อน แม้เส้นทางจะมีในตาราง", () => {
    expect(tripDist(t({ dist: 123 }))).toBe(123);
  });
  it("ระยะทางเป็น 0 ถอยไปเปิดตารางเส้นทาง", () => {
    // เชียงใหม่ → ตลาดไท มีในตาราง routes.json
    expect(tripDist(t({ dist: 0 }))).toBe(720);
  });
  it("เส้นทางไม่มีในตารางและไม่ได้กรอก ได้ null", () => {
    expect(tripDist(t({ dist: 0, origin: "ดาวอังคาร", dest: "ดาวพฤหัส" }))).toBeNull();
  });
});

describe("tripEta", () => {
  it("720 กม. ที่ 500 กม./วัน = 2 วัน (ปัดขึ้น)", () => {
    expect(tripEta(t({ releaseDate: "2026-09-10", dist: 720 }))).toBe("2026-09-12");
  });
  it("พอดี 500 กม. = 1 วัน ไม่ปัดขึ้นเกิน", () => {
    expect(tripEta(t({ releaseDate: "2026-09-10", dist: KM_PER_DAY }))).toBe("2026-09-11");
  });
  it("1000 กม. = 2 วัน", () => {
    expect(tripEta(t({ releaseDate: "2026-09-10", dist: 1000 }))).toBe("2026-09-12");
  });
  it("1001 กม. = 3 วัน", () => {
    expect(tripEta(t({ releaseDate: "2026-09-10", dist: 1001 }))).toBe("2026-09-13");
  });
  it("เที่ยวสั้นมากก็ยังกินอย่างน้อย 1 วัน", () => {
    expect(tripEta(t({ releaseDate: "2026-09-10", dist: 5 }))).toBe("2026-09-11");
  });
  it("ไม่รู้ระยะทาง ประมาณไม่ได้", () => {
    expect(tripEta(t({ dist: 0, origin: "ดาวอังคาร", dest: "ดาวพฤหัส" }))).toBeNull();
  });
  it("ไม่มีวันเริ่ม ประมาณไม่ได้", () => {
    expect(tripEta({ date: "", releaseDate: "", dist: 720 })).toBeNull();
  });
});

describe("addDaysISO — ต้องเป็นเวลาเครื่อง ไม่ใช่ UTC", () => {
  it("ข้ามสิ้นเดือน", () => expect(addDaysISO("2026-09-30", 1)).toBe("2026-10-01"));
  it("ข้ามสิ้นปี", () => expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01"));
  it("ข้ามเดือน ก.พ. ปีอธิกสุรทิน", () => expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29"));
  it("ลบวันได้", () => expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31"));
});

describe("tripProgress.moving", () => {
  const run = (over: Partial<TripRecord>, today: string) => tripProgress(t(over), today).moving;

  it("วันที่ปล่อยรถ = กำลังวิ่ง", () => {
    expect(run({ releaseDate: "2026-09-10", dist: 720 }, "2026-09-10")).toBe(true);
  });
  it("ระหว่างทางก่อนถึง ETA = ยังวิ่งอยู่", () => {
    expect(run({ releaseDate: "2026-09-10", dist: 720 }, "2026-09-11")).toBe(true);
  });
  it("วันที่ถึง ETA พอดี = ยังนับว่าวิ่งอยู่", () => {
    expect(run({ releaseDate: "2026-09-10", dist: 720 }, "2026-09-12")).toBe(true);
  });
  it("เลย ETA แล้ว = ว่าง", () => {
    expect(run({ releaseDate: "2026-09-10", dist: 720 }, "2026-09-13")).toBe(false);
  });
  it("ใบที่ลงวันปล่อยรถไว้ล่วงหน้า ยังไม่นับว่าออกวิ่ง", () => {
    expect(run({ releaseDate: "2026-09-15", dist: 720 }, "2026-09-10")).toBe(false);
  });
  it("กดจบงานแล้ว ชนะ ETA เสมอ", () => {
    expect(run({ releaseDate: "2026-09-10", dist: 720, _tripDone: true }, "2026-09-11")).toBe(false);
  });

  describe("ไม่รู้ระยะทาง → ถอยไปใช้กฎเดิม 'ออกวันนี้ = กำลังวิ่ง'", () => {
    const unknown = { dist: 0, origin: "ดาวอังคาร", dest: "ดาวพฤหัส", releaseDate: "2026-09-10" };
    it("วันที่ออก = วิ่งอยู่", () => expect(run(unknown, "2026-09-10")).toBe(true));
    it("วันรุ่งขึ้น = ว่าง (ไม่ค้างตลอดกาล)", () => expect(run(unknown, "2026-09-11")).toBe(false));
  });

  it("ไม่มีวันเริ่มเลย = ไม่วิ่ง", () => {
    expect(tripProgress({ date: "", releaseDate: "", dist: 720 }, "2026-09-10").moving).toBe(false);
  });
});

describe("tripProgress.upcoming — จัดรถแล้วแต่ยังไม่ถึงวันปล่อยรถ (หน้าคนขับ)", () => {
  const run = (over: Partial<TripRecord>, today: string) => tripProgress(t(over), today);

  it("วันปล่อยรถอยู่ในอนาคต = รอออกเดินทาง และยังไม่นับว่าวิ่ง", () => {
    const p = run({ releaseDate: "2026-09-25", dist: 720 }, "2026-09-23");
    expect(p.upcoming).toBe(true);
    expect(p.moving).toBe(false);
  });
  it("ถึงวันปล่อยรถแล้ว = ย้ายไปกำลังวิ่ง ไม่ซ้อนสองกลุ่ม", () => {
    const p = run({ releaseDate: "2026-09-25", dist: 720 }, "2026-09-25");
    expect(p.upcoming).toBe(false);
    expect(p.moving).toBe(true);
  });
  it("ไม่มีวันปล่อยรถ ถอยไปใช้วันที่ในใบเหมือนกฎเดิม", () => {
    expect(run({ releaseDate: "", date: "2026-09-30" }, "2026-09-23").upcoming).toBe(true);
  });
  it("กดจบงานไปแล้ว (ยกเลิกเที่ยวล่วงหน้า) ไม่ขึ้นเป็นงานรอ", () => {
    expect(run({ releaseDate: "2026-09-25", _tripDone: true } as Partial<TripRecord>, "2026-09-23").upcoming).toBe(false);
  });
  it("วันปล่อยรถผ่านไปแล้วไม่ใช่งานรอ", () => {
    expect(run({ releaseDate: "2026-09-20", dist: 720 }, "2026-09-23").upcoming).toBe(false);
  });
});
