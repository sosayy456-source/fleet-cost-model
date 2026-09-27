import { afterEach, expect, it, vi } from "vitest";
import { loadAllocBills, type AllocData } from "./useAlloc";

afterEach(() => vi.unstubAllGlobals());

it("โหลดเฉพาะชุดย่อยของลูกค้าที่เปิดรายละเอียดและใช้แคชเมื่ออยู่ชุดเดียวกัน", async () => {
  const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({
    ci: [5, 69, 6], bill: ["A", "B", "C"], date: ["2026-01-01", "2026-01-02", "2026-01-03"],
    doc: ["D", "D", "D"], route: ["R", "R", "R"], revenue: [100, 200, 300], cost: [50, 60, 70],
  }), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  const data = { manifest: { dataset: "sample", generatedAt: "test-bill-shard", billShards: 64 }, bills: null } as AllocData;

  expect((await loadAllocBills(data, 5)).map((b) => b.bill)).toEqual(["A"]);
  expect((await loadAllocBills(data, 69)).map((b) => b.bill)).toEqual(["B"]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0]?.[0])).toContain("/data/sample/alloc/bills_05.json");
});
