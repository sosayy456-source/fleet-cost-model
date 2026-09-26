import { describe, expect, it } from "vitest";
import { EtlBatch } from "./etlBatch";
import type { EtlJob, JobStatus } from "./etlBatch";

const idle = (): Record<EtlJob, JobStatus> => ({
  rev: { state: "idle", message: "", at: 0 }, cr: { state: "idle", message: "", at: 0 },
  al: { state: "idle", message: "", at: 0 }, db: { state: "idle", message: "", at: 0 },
  lf: { state: "idle", message: "", at: 0 },
});

describe("สถานะรวม ETL", () => {
  it("วางไฟล์ต้นทุน+รายได้: สองงานต่อกัน % เดินต่อเนื่อง ไม่จบจนงานปันส่วนเสร็จ", () => {
    const b = new EtlBatch();
    const s = idle();
    // โพลเจอไฟล์ → ทั้งสองงานเข้า running (รอคัดลอก) ก่อน python เริ่ม
    s.cr = { state: "running", message: "พบไฟล์ใหม่", at: 1 };
    b.update("cr", s, null, true, 100);
    s.al = { state: "running", message: "พบไฟล์บิลใหม่", at: 1 };
    let r = b.update("al", s, null, true, 100)!;
    expect(r.state).toBe("running");
    expect(r.pct).toBe(0);
    expect(r.at).toBe(100);

    s.cr = { ...s.cr, message: "กำลังแปลง", pct: 50, step: "อ่านไฟล์รายได้ 15/29" };
    r = b.update("cr", s, "cr", true)!;
    expect(r.pct).toBe(20);                         // 1 × 50% ÷ (1 + 1.5)
    expect(r.message).toContain("งานที่ 1/2");
    expect(r.step).toContain("อ่านไฟล์รายได้ 15/29");

    // งานแรกจบตอน busy ยังเป็น cr — ยังไม่จบรอบ
    s.cr = { state: "done", message: "เสร็จ", at: 2 };
    r = b.update("cr", s, "cr", true)!;
    expect(r.state).toBe("running");
    expect(r.pct).toBe(40);

    s.al = { ...s.al, pct: 50, step: "รอบ 2/3 ปันต้นทุน" };
    r = b.update("al", s, "al", false)!;
    expect(r.message).toContain("งานที่ 2/2 · กำไรลูกค้า");
    expect(r.step).toContain("✓ ต้นทุน+รายได้รายเที่ยว");
    expect(r.pct).toBe(70);
    expect(r.at).toBe(100);                         // เวลาเริ่มรอบไม่ขยับ

    s.al = { state: "done", message: "เสร็จ", at: 3 };
    expect(b.update("al", s, "al", false)!.state).toBe("running");
    r = b.update(null, s, null, false)!;           // pump เห็นคิวว่าง
    expect(r.state).toBe("done");
    expect(r.message).toContain("ครบ 2 งาน");
    expect(b.update(null, s, null, false)).toBeNull();   // รอบถัดไปยังไม่เริ่ม
  });

  it("งานใดพัง = รอบจบแบบ error บอกชื่องาน · ลบไฟล์หมด = cleared", () => {
    const b = new EtlBatch();
    const s = idle();
    s.db = { state: "running", message: "", at: 1 };
    b.update("db", s, "db", false);
    s.db = { state: "error", message: "พัง", at: 2 };
    b.update("db", s, "db", false);
    const r = b.update(null, s, null, false)!;
    expect(r.state).toBe("error");
    expect(r.message).toContain("ลูกหนี้");

    const c = new EtlBatch();
    s.lf = { state: "running", message: "", at: 1 };
    c.update("lf", s, null, true);
    s.lf = { state: "cleared", message: "", at: 2 };
    c.update("lf", s, "lf", false);
    expect(c.update(null, s, null, false)!.state).toBe("cleared");
  });
});
