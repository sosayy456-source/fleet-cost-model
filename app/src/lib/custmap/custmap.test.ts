/**
 * เทสต์การนับระเบียนแบบไม่โหลดไฟล์ทั้งก้อน
 *
 * หน้าบันทึกข้อมูลต้องรู้แค่ "ไฟล์มีถึงเลขไหน" ถ้าเผลอกลับไปโหลดทั้ง 18 MB
 * ผู้ใช้จะรอนานก่อนเริ่มกรอกโดยไม่มีใครสังเกตเห็นใน code review
 * เทสต์นี้จับด้วยการดูว่ามีการเรียก fetch แบบ GET หรือเปล่า
 *
 * ต้อง resetModules ทุกเคส เพราะ custmap.ts จำจำนวนที่รู้แล้วไว้ในตัวแปรระดับโมดูล
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const FULL_BYTES = 32;

/** โหลดโมดูลใหม่หมดพร้อม fetch ปลอม — คืนทั้งโมดูลและตัวนับการเรียก */
async function freshWith(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.resetModules();
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return fetchImpl(String(url), init);
  });
  const mod = await import("./custmap");
  return { mod, calls };
}

const headOnly = (length: number) => async (_url: string, init?: RequestInit) => {
  if (init?.method !== "HEAD") throw new Error("เทสต์นี้ไม่ควรมีการโหลดทั้งไฟล์");
  return new Response(null, { status: 200, headers: { "content-length": String(length) } });
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("ensureCustCount", () => {
  it("นับระเบียนจาก Content-Length โดยไม่โหลดไฟล์", async () => {
    const { mod, calls } = await freshWith(headOnly(584_941 * FULL_BYTES));

    expect(await mod.ensureCustCount("/custmap.bin")).toBe(584_941);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("HEAD");
  });

  it("ยิง HEAD ครั้งเดียวแม้เรียกซ้ำหลายรอบ", async () => {
    const { mod, calls } = await freshWith(headOnly(10 * FULL_BYTES));

    await mod.ensureCustCount("/custmap.bin");
    await mod.ensureCustCount("/custmap.bin");
    await mod.ensureCustCount("/custmap.bin");

    expect(calls).toHaveLength(1);
    expect(mod.peekCustCount()).toBe(10);
  });

  it("อ่านไฟล์รุ่นเก่า (6 ไบต์/ระเบียน) ได้ด้วย", async () => {
    const { mod } = await freshWith(headOnly(7 * 6));
    // 42 ไบต์ หาร 32 ไม่ลงตัว จึงต้องตกมาที่รุ่น 6 ไบต์
    expect(await mod.ensureCustCount("/custmap.bin")).toBe(7);
  });

  it("ถอยไปโหลดทั้งไฟล์ถ้า host ไม่ส่ง Content-Length", async () => {
    const bytes = new Uint8Array(3 * FULL_BYTES);
    bytes[0] = 1; // ไม่ให้ระเบียนแรกเป็นศูนย์ทั้งก้อน
    const { mod, calls } = await freshWith(async (_url, init) =>
      init?.method === "HEAD"
        ? new Response(null, { status: 200 })
        : new Response(bytes, { status: 200 }));

    expect(await mod.ensureCustCount("/custmap.bin")).toBe(3);
    expect(calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
  });

  it("โยน error ถ้าขนาดไฟล์ไม่ลงตัวกับทั้งสองรุ่น", async () => {
    const { mod } = await freshWith(headOnly(35));
    await expect(mod.ensureCustCount("/custmap.bin")).rejects.toThrow(/เสียหาย/);
  });

  it("peekCustCount ต้องได้ค่าหลังโหลดตารางเต็มด้วย ไม่ใช่เฉพาะทาง HEAD", async () => {
    const bytes = new Uint8Array(5 * FULL_BYTES);
    bytes[0] = 9;
    const { mod } = await freshWith(async () => new Response(bytes, { status: 200 }));

    expect(mod.peekCustCount()).toBe(0);
    await mod.loadCustMap("/custmap.bin");
    expect(mod.peekCustCount()).toBe(5);
  });
});
