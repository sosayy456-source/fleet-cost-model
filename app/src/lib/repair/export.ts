/**
 * ส่งออกตารางค่าซ่อมที่ใช้อยู่ (ค่าฐาน + ค่าที่นำเข้า/แก้เอง) เป็นไฟล์ .json — เจ้าของงานสั่ง 24 ก.ย. 2569
 *
 * ที่มา: อัตราที่นำเข้าจากรายงานค่าซ่อมเก็บใน localStorage ของเบราว์เซอร์เครื่องนั้นเท่านั้น
 * จะให้เป็นค่าตั้งต้นของทุกเครื่อง (lib/refdata/repair.json) ต้องเอาออกมาเป็นไฟล์ให้ผู้พัฒนารวมลงแล้ว commit
 *
 * รูปไฟล์ = รูปเดียวกับ repair.json ทุกคีย์ (years · weights · time · dist) + `_meta` บอกที่มา
 * → รวมลง repair.json ได้โดยตัด `_meta` ทิ้งอย่างเดียว · ตารางที่ส่งออกคือ **ตารางที่ใช้คำนวณจริง**
 * (ผ่าน repairTables ตัวเดียวกับ computeCost) ไม่ใช่เฉพาะช่องที่แก้ ผู้รวมจะได้ไม่ต้องรู้ว่าช่องไหนมาจากไหน
 */
import { repairTables } from "../cost/computeCost";
import type { RefData, RefOverrides } from "../cost/types";
import { countCells } from "../store/repairSnapshots";

export interface RepairExport {
  _meta: {
    /** วันที่ส่งออก (ISO) */
    exportedAt: string;
    /** จำนวนช่องที่ต่างจากค่าฐาน (นำเข้า/แก้เอง) ณ ตอนส่งออก */
    overriddenCells: number;
    /** ไฟล์ต้นทุนที่ใช้เป็นตัวหารตอนนำเข้าเป็นข้อมูลตัวอย่างไหม — true = อัตราเชื่อไม่ได้ อย่านำไปใส่ค่าตั้งต้น */
    costDataIsSample: boolean | null;
    note: string;
  };
  years: string[];
  weights: number[];
  time: Record<string, Record<string, number[]>>;
  dist: Record<string, number[]>;
}

export function buildRepairExport(
  ref: RefData, ovr: RefOverrides | undefined,
  meta: { exportedAt: string; costDataIsSample: boolean | null },
): RepairExport {
  const t = repairTables(ref, ovr);
  return {
    _meta: {
      exportedAt: meta.exportedAt,
      overriddenCells: ovr?.repair ? countCells(ovr.repair) : 0,
      costDataIsSample: meta.costDataIsSample,
      note: "ตารางค่าซ่อมที่ใช้อยู่ (ค่าฐาน + ค่าที่นำเข้า) · รูปเดียวกับ app/src/lib/refdata/repair.json · "
        + "ปี \"24\"/\"25\"/\"26\" = พ.ศ. 2567/2568/2569 · time = บาท/วัน แยกประเภทรถ × ชนิดรถ · dist = บาท/กม. แยกชนิดรถ",
    },
    years: [...t.years],
    weights: [...t.weights],
    time: t.time,
    dist: t.dist,
  };
}

/** ชื่อไฟล์ — "อัตราค่าซ่อม_2569-09-24.json" (ปี พ.ศ. ให้ตรงกับที่ผู้ใช้อ่านวันที่) */
export function repairExportName(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `อัตราค่าซ่อม_${Number(y) + 543}-${m}-${d}.json`;
}
