/**
 * เทสต์ปุ่มจบงาน — ประเด็นใหญ่สุดคือ "กดแล้วต้องไม่ทำข้อมูลฝ่ายอื่นหาย"
 * เพราะตัวนี้เขียนใบตรง ๆ ไม่ได้ผ่าน saveRecord() ที่มีตัวกรองช่องตามฝ่ายให้
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn(async (_r: unknown) => undefined);
const pushRecords = vi.fn(async (_l: unknown) => ({ ok: true }));
const pushFinishLog = vi.fn(async (_r: unknown) => ({ ok: true }));

vi.mock("./records", () => ({ put: (r: unknown) => put(r) }));
vi.mock("../sheet/client", () => ({
  pushRecords: (l: unknown) => pushRecords(l),
  pushFinishLog: (r: unknown) => pushFinishLog(r),
}));

const { finishTrip, finishLogRow, markFinished } = await import("./finishTrip");
type Rec = Parameters<typeof finishTrip>[0];

const rec = (over: Record<string, unknown> = {}): Rec => ({
  id: "R1", docNo: "DOC-1", source: "ใหม่", synced: true,
  date: "2026-09-10", releaseDate: "2026-09-10", origin: "เชียงใหม่", dest: "ตลาดไท",
  dist: 720, plate: "ชม.70-0820", revenue: 42000,
  // ช่องของอีกสองฝ่ายที่ห้ามหาย
  gas: 3000, drv: 800, capacity: 25000, loadActual: 20000,
  bills: [{ no: "B1", total: 500 }],
  _csDone: true, _csAt: "2026-09-10 08:00",
  _dispatchDone: true, _dispatchAt: "2026-09-10 09:00",
  _accountDone: true, _accountAt: "2026-09-10 10:00",
  ...over,
} as unknown as Rec);

beforeEach(() => { put.mockClear(); pushRecords.mockClear(); pushFinishLog.mockClear(); });

describe("markFinished", () => {
  it("ประทับครบ 4 ช่อง และสั่งให้ซิงก์ใหม่", () => {
    const out = markFinished(rec(), "driver");
    expect(out._tripDone).toBe(true);
    expect(out._tripDoneBy).toBe("driver");
    expect(out._tripDoneDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out._tripDoneAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(out.synced).toBe(false);
  });

  it("★ ไม่แตะช่องของฝ่ายอื่นเลยสักช่อง", () => {
    const before = rec();
    const after = markFinished(before, "manager");
    for (const k of ["gas", "drv", "capacity", "loadActual", "revenue", "bills",
                     "_csDone", "_csAt", "_dispatchDone", "_dispatchAt",
                     "_accountDone", "_accountAt", "docNo", "plate", "dist"] as const) {
      expect(after[k as keyof typeof after]).toEqual(before[k as keyof typeof before]);
    }
  });
});

describe("finishLogRow", () => {
  it("เรียงคอลัมน์ตรงกับ DONE_HEADERS และมี 11 ช่อง", () => {
    const row = finishLogRow(markFinished(rec(), "driver"), "driver");
    expect(row).toHaveLength(11);
    expect(row[1]).toBe("R1");            // ID ใบรายการ
    expect(row[2]).toBe("DOC-1");         // เลขที่ใบรายการ
    expect(row[3]).toBe("ชม.70-0820");    // ทะเบียนรถ
    expect(row[7]).toBe(720);             // ระยะทาง
    expect(row[8]).toBe("12/09/2569");    // ประมาณการเสร็จ = ปล่อย 10 ก.ย. + 2 วัน (พ.ศ.)
    expect(row[10]).toBe("driver");       // ผู้กด
  });
});

describe("finishTrip", () => {
  it("เขียนลงเครื่องก่อน แล้วค่อยขึ้นชีต และเขียน log", async () => {
    const res = await finishTrip(rec(), "driver");
    expect(put).toHaveBeenCalledTimes(2);          // รอบแรก synced:false รอบสอง synced:true
    expect(pushRecords).toHaveBeenCalledTimes(1);
    expect(pushFinishLog).toHaveBeenCalledTimes(1);
    expect(res.pushed).toBe(true);
    expect(res.logged).toBe(true);
    expect(res.record.synced).toBe(true);
  });

  it("ออฟไลน์ — ไม่ throw และยังเก็บลงเครื่องแล้ว", async () => {
    pushRecords.mockRejectedValueOnce(new Error("offline"));
    const res = await finishTrip(rec(), "driver");
    expect(res.pushed).toBe(false);
    expect(res.record._tripDone).toBe(true);
    expect(res.record.synced).toBe(false);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("★ log เขียนไม่ได้ ต้องไม่ทำให้การบันทึกใบล้มไปด้วย", async () => {
    pushFinishLog.mockRejectedValueOnce(new Error("ชีตยังไม่ได้ deploy"));
    const res = await finishTrip(rec(), "manager");
    expect(res.pushed).toBe(true);     // ใบขึ้นชีตสำเร็จ
    expect(res.logged).toBe(false);    // แค่ log ที่พลาด
  });
});
