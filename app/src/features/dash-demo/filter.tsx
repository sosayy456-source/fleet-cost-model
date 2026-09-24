/**
 * ตัวกรองชุดเดียวของเมนู Demo หน้ายาว (เจ้าของงานสั่ง 24 ก.ย. 2569 — รวม 4 แท็บเป็นหน้าเดียว ตัวกรองชุดเดียวคุมทั้งหน้า)
 *
 * แต่ละส่วนกรองเท่าที่ข้อมูลของตัวเองมี แล้วบอกไว้ด้วย <FilterScope> เมื่อมีตัวกรองที่ส่วนนั้นใช้ไม่ได้
 *   ส่วนที่อ่าน trips (กำไรรายเส้นทาง · ข้อ 2 กล่อง 3–4 · ข้อ 3)  → ครบทุกตัว
 *   ไฟล์ Load Factor (ข้อ 2 กล่อง 1–2 · การ์ดตัน-กม.)            → ปี · ช่วงเดือน · ประเภทรถ · ชนิดรถ
 *   กำไรลูกค้า ส่วนที่ 1 (ชุด alloc/)                              → ปี · ช่วงเดือน (ตามวันที่บิล)
 * เวลา = ปี + ช่วงเดือน ตั้งแต่–ถึง แบบแท็บ Damage Rate (24 ก.ย. 2569 · lib/filter/period.ts) — ช่อง `month` ของ BaseFilter ไม่ใช้ในหน้านี้
 *   ลูกหนี้ DSO                                                     → ไม่ใช้เลย มี "ข้อมูล ณ วันที่" ของตัวเอง
 */
import { passBase, BASE_F0 } from "../dash-costrev/common";
import type { BaseFilter } from "../dash-costrev/common";
import type { Trip } from "../../lib/data/useCostRev";
import { inPeriod, isPartialYear } from "../../lib/filter/period";
import type { LfTrip } from "../../lib/data/useLoadFactor";

export interface DemoFilter extends BaseFilter { sg: string }
/** คีย์ที่ FilterScope พูดถึง — "month" = ช่วงเดือน (from–to) */
export type DemoKey = "year" | "month" | "o" | "de" | "ft" | "vk" | "sg";
export const DEMO_F0: DemoFilter = { ...BASE_F0, sg: "" };

const LABEL: Record<DemoKey, string> = {
  year: "ปี", month: "ช่วงเดือน", o: "ต้นทาง", de: "ปลายทาง", ft: "ประเภทรถ", vk: "ชนิดรถ", sg: "กลุ่มบริการ",
};
const ORDER: DemoKey[] = ["year", "month", "o", "de", "ft", "vk", "sg"];
const isSet = (f: DemoFilter, k: DemoKey): boolean => (k === "month" ? isPartialYear(f) : !!f[k]);

/** เที่ยวผ่านตัวกรองของหน้า — กลุ่มบริการว่าง = "ไม่ระบุ" (กติกาเดิมของแท็บกำไรรายเส้นทาง) */
export const passDemo = (t: Trip, f: DemoFilter, opts?: Parameters<typeof passBase>[2]): boolean =>
  passBase(t, f, opts) && (!f.sg || (t.sg || "ไม่ระบุ") === f.sg);

/** เที่ยวของไฟล์ Load Factor ผ่านตัวกรองของหน้า — ไฟล์ LF มีแค่ ปี · เดือน · ประเภทรถ · ชนิดรถ
 *  (ใช้ทั้งกล่อง LF ของข้อ 2 และคะแนน Load Factor ของ Performance Index ให้นับชุดเดียวกัน) */
export const passLfDemo = (t: LfTrip, f: DemoFilter): boolean =>
  inPeriod(t, f) && (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk);

/**
 * บรรทัดเล็กบอกว่าส่วนนี้กรองตามอะไรได้บ้าง — ขึ้นเฉพาะตอนเลือกตัวกรองที่ส่วนนี้ใช้ไม่ได้ (ไม่มีอะไรข้ามก็ไม่รก)
 * why = เหตุผลสั้น ๆ ว่าทำไมกรองไม่ได้ เช่น "ไฟล์ Load Factor ไม่มีต้นทาง/ปลายทางแยก"
 */
export function FilterScope({ f, uses, why, who = "ส่วนนี้" }: {
  f: DemoFilter; uses: DemoKey[]; why: string;
  /** ประธานของประโยค — ส่วนย่อยที่กรองได้ไม่ครบ เช่น "กล่องที่ 1–2" */
  who?: string;
}) {
  const skipped = ORDER.filter((k) => isSet(f, k) && !uses.includes(k));
  if (!skipped.length) return null;
  return (
    <p className="dm-scope">
      {who}กรองตาม {uses.length ? ORDER.filter((k) => uses.includes(k)).map((k) => LABEL[k]).join(" · ") : "–"} เท่านั้น ·
      ไม่ได้กรองตาม {skipped.map((k) => LABEL[k]).join(" · ")} ({why})
    </p>
  );
}
