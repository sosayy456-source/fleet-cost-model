/**
 * เทสต์ชุดอัตราค่าซ่อมที่บันทึกไว้
 *
 * สิ่งที่ต้องไม่พลาดคือ "ชุดที่เก็บไว้ต้องไม่เปลี่ยนตามค่าที่ผู้ใช้แก้ต่อ" —
 * ถ้าเก็บเป็นการอ้างอิงเดียวกัน ชุดสำรองจะกลายเป็นของใหม่ไปด้วย แล้วย้อนกลับไม่ได้จริง
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_SNAPSHOTS, addSnapshot, countCells, loadSnapshots, removeSnapshot, renameSnapshot,
} from "./repairSnapshots";
import type { RepairOverride } from "./repairSnapshots";

/** localStorage ปลอมแบบง่าย — vitest รันในโหมด node จึงไม่มีของจริงให้ใช้ */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const sample = (): RepairOverride => ({
  time: { "รถบริษัท": { "รถ 6 ล้อใหญ่": [1, 2, null] } },
  dist: { "รถ 6 ล้อใหญ่": [0.5, null, null] },
});

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  vi.stubGlobal("dispatchEvent", () => true);
});

describe("countCells", () => {
  it("นับเฉพาะช่องที่มีค่า ไม่นับช่องว่าง", () => {
    expect(countCells(sample())).toBe(3);
    expect(countCells({})).toBe(0);
  });
});

describe("addSnapshot", () => {
  it("บันทึกแล้วอ่านกลับได้ ชุดใหม่อยู่บนสุด", () => {
    addSnapshot("ชุดแรก", sample());
    addSnapshot("ชุดที่สอง", sample());

    const list = loadSnapshots();
    expect(list.map((s) => s.name)).toEqual(["ชุดที่สอง", "ชุดแรก"]);
  });

  it("★ คัดลอกลึก — แก้ค่าปัจจุบันต่อแล้วชุดที่เก็บไว้ต้องไม่เปลี่ยนตาม", () => {
    const live = sample();
    addSnapshot("สำรอง", live);

    live.dist!["รถ 6 ล้อใหญ่"]![0] = 999;

    expect(loadSnapshots()[0]!.repair.dist!["รถ 6 ล้อใหญ่"]![0]).toBe(0.5);
  });

  it("ชื่อว่างได้ชื่ออัตโนมัติ ไม่ปล่อยให้เป็นช่องว่าง", () => {
    addSnapshot("   ", sample());
    expect(loadSnapshots()[0]!.name).toMatch(/ชุดค่าซ่อม/);
  });

  it("เก็บไม่เกินเพดาน กันไม่ให้กินโควตาจนค่าที่แก้เองเซฟไม่ลง", () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) addSnapshot(`ชุด ${i}`, sample());
    expect(loadSnapshots()).toHaveLength(MAX_SNAPSHOTS);
  });

  it("เวลาที่ประทับเป็นเวลาเครื่อง ไม่ใช่ UTC", () => {
    addSnapshot("x", sample());
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    expect(loadSnapshots()[0]!.savedAt.slice(0, 10))
      .toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  });
});

describe("removeSnapshot / renameSnapshot", () => {
  it("ลบเฉพาะชุดที่ระบุ", () => {
    addSnapshot("ก", sample());
    addSnapshot("ข", sample());
    const id = loadSnapshots()[0]!.id;

    removeSnapshot(id);
    expect(loadSnapshots().map((s) => s.name)).toEqual(["ก"]);
  });

  it("เปลี่ยนชื่อได้ และชื่อว่างต้องคงชื่อเดิม", () => {
    addSnapshot("เดิม", sample());
    const id = loadSnapshots()[0]!.id;

    renameSnapshot(id, "ใหม่");
    expect(loadSnapshots()[0]!.name).toBe("ใหม่");

    renameSnapshot(id, "  ");
    expect(loadSnapshots()[0]!.name).toBe("ใหม่");
  });
});

describe("loadSnapshots", () => {
  it("ข้อมูลเสียใน localStorage ต้องไม่ทำให้หน้าพัง", () => {
    localStorage.setItem("repairSnapshots", "{ไม่ใช่ JSON");
    expect(loadSnapshots()).toEqual([]);

    localStorage.setItem("repairSnapshots", '[{"ไม่มี":"id"}]');
    expect(loadSnapshots()).toEqual([]);
  });
});
