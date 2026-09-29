import { describe, expect, it } from "vitest";
import { tripShard } from "./useAlloc";

describe("ไฟล์ย่อยของบิลรายเที่ยว (trip_bills_XX.ndjson)", () => {
  it("ตรงกับ trip_shard() ใน etl/build_alloc.py ทุกค่า — ถ้าไม่ตรง ป็อบอัพจะหาไฟล์ผิดแล้วขึ้นว่าไม่มีบิลเงียบ ๆ", () => {
    // ค่าจาก python: trip_shard(doc, 16) / trip_shard(doc, 256)
    expect([tripShard("5240211541403", 16), tripShard("5240211541403", 256)]).toEqual([0, 144]);
    expect([tripShard("6269999900007", 16), tripShard("6269999900007", 256)]).toEqual([2, 178]);
    expect([tripShard("abc", 16), tripShard("abc", 256)]).toEqual([6, 38]);
  });
});
