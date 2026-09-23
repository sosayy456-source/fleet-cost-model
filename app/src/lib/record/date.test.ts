import { describe, expect, it } from "vitest";
import { thDate, thSlash, toISODate } from "./date";

describe("วันที่จากชีต → ISO", () => {
  it("ข้อความ Date ที่ Apps Script ส่งกลับมา (ชีตแปลงเซลล์เป็นวันที่เอง) — เดิมหน้าจัดรถขึ้น NaN undefined NaN", () => {
    expect(toISODate("Thu Sep 24 2026 00:00:00 GMT+0700 (Indochina Time)")).toBe("2026-09-24");
    expect(thDate("Thu Sep 24 2026 00:00:00 GMT+0700 (Indochina Time)")).toBe("24 ก.ย. 2569");
  });
  it("ISO มีเวลา UTC → วันตามเวลาไทย", () => {
    expect(toISODate("2026-09-23T17:00:00.000Z")).toBe("2026-09-24");
  });
  it("ISO ล้วนคงเดิม · dd/mm/yyyy ทั้ง ค.ศ. และ พ.ศ.", () => {
    expect(toISODate("2026-09-24")).toBe("2026-09-24");
    expect(toISODate("24/09/2569")).toBe("2026-09-24");
    expect(toISODate("24/9/2026")).toBe("2026-09-24");
    expect(thSlash("2026-09-24")).toBe("24/09/2569");
  });
  it("อ่านไม่ออก = ว่าง และ thDate ไม่ขึ้น NaN", () => {
    expect(toISODate("")).toBe("");
    expect(toISODate("ไม่ใช่วันที่")).toBe("");
    expect(thDate("ไม่ใช่วันที่")).toBe("ไม่ใช่วันที่");
    expect(thDate("")).toBe("–");
  });
});
