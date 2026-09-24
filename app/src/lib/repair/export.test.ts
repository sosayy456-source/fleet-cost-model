import { describe, expect, it } from "vitest";
import { REF } from "../refdata";
import repairJson from "../refdata/repair.json";
import { buildRepairExport, repairExportName } from "./export";

const META = { exportedAt: "2026-09-24", costDataIsSample: false };

describe("ส่งออกตารางค่าซ่อมที่ใช้อยู่ (รูปเดียวกับ repair.json)", () => {
  it("ไม่มีค่าที่แก้ = ได้ repair.json เดิมทุกช่อง (ตัด _meta แล้ว)", () => {
    const { _meta, ...table } = buildRepairExport(REF, undefined, META);
    expect(table).toEqual(repairJson);
    expect(_meta.overriddenCells).toBe(0);
  });

  it("ช่องที่นำเข้าทับค่าฐาน · ช่อง null คงค่าฐาน · ชนิดรถใหม่ถูกเพิ่ม", () => {
    const kind = Object.keys(REF.repair.dist)[0]!;
    const base = REF.repair.dist[kind]!;
    const out = buildRepairExport(REF, {
      repair: { dist: { [kind]: [null, 9.5, null], "ชนิดใหม่": [1, 2, 3] } },
    }, META);
    expect(out.dist[kind]).toEqual([base[0], 9.5, base[2]]);
    expect(out.dist["ชนิดใหม่"]).toEqual([1, 2, 3]);
    expect(out._meta.overriddenCells).toBe(4);
    // ต้องไม่แก้ตารางฐานในหน่วยความจำ
    expect(REF.repair.dist[kind]).toEqual(base);
  });

  it("ชื่อไฟล์ใช้ปี พ.ศ.", () => {
    expect(repairExportName("2026-09-24")).toBe("อัตราค่าซ่อม_2569-09-24.json");
  });
});
