/**
 * ตัวกรอง "แหล่งข้อมูล" ของ Executive Dashboard + Overall Dashboard (เจ้าของงานสั่ง 1 ต.ค. 2569)
 *   ข้อมูลเก่า (ตั้งต้น) = ไฟล์ Excel ที่ ETL แปลง · ข้อมูลใหม่ = ใบที่บันทึกในโมเดล · ติ๊กทั้งสอง = ทั้งหมด
 *   ค่าเดียวร่วมกันทั้งสองหน้า จำใน sessionStorage จนปิดแท็บ (เจ้าของงานเลือก)
 *   ★ 1 ต.ค. 2569 (เจ้าของงานสั่ง): ค่าตั้งต้นเปลี่ยนจาก "ทั้งหมด" เป็น "ข้อมูลเก่า" · ช่องเลือกเป็นดรอปดาวน์ที่ข้างในติ๊ก 2 ช่อง (เหลืออย่างน้อยหนึ่งช่อง)
 *
 * ทำงานผ่าน Provider: สองหน้านี้ครอบเนื้อหาด้วย <DataSourceProvider records> แล้ว hook ข้อมูลทั้ง 4 ชุด
 * (useCostRev · useLoadFactor · useAlloc · useDebtors) ผสมใบใหม่ให้เอง — ทุกส่วน/กล่อง PI ตามโดยไม่ต้องแก้ทีละหน้า
 * ★ หน้าอื่น (Manager · Executive Summary · จัดรถ · ตั้งค่า) ไม่มี Provider = ได้ไฟล์ล้วนเหมือนเดิม
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TripRecord } from "../../types/record";
import type { PendingBill } from "../../types/bill";
import { getAllBills } from "../store/bills";
import { buildForecast, type ForecastTable } from "../forecast/forecast";
import { loadCostRev } from "./useCostRev";
import { freshRecords, recordTrip, type DataSource } from "./recordSources";
import { DataSourceContext, type DataSourceCtx } from "./dataSourceCtx";

export type { DataSource } from "./recordSources";
export { useDataSourceCtx } from "./dataSourceCtx";

const KEY = "dashDataSource";
const EVT = "dash-data-source";

export const DATA_SOURCES: { id: DataSource; label: string; hint: string }[] = [
  { id: "all", label: "ทั้งหมด", hint: "ไฟล์ Excel ของบริษัท + ใบที่บันทึกในโมเดล" },
  { id: "old", label: "ข้อมูลเก่า", hint: "เฉพาะไฟล์ Excel ของบริษัทที่แปลงแล้ว" },
  { id: "new", label: "ข้อมูลใหม่", hint: "เฉพาะใบรายการที่บันทึกผ่านเว็บ (ยังไม่กรอกต้นทุน = ต้นทุนพยากรณ์)" },
];

function readSource(): DataSource {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "all" || v === "new" ? v : "old";
  } catch { return "old"; }
}

export function setDataSource(v: DataSource): void {
  try { sessionStorage.setItem(KEY, v); } catch { /* โหมดส่วนตัว — ใช้ได้แค่หน้านี้ */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

/** ค่าที่เลือกอยู่ — ทุกที่ที่เรียกได้ค่าเดียวกันทันทีเมื่อมีที่ไหนเปลี่ยน */
export function useDataSourcePref(): [DataSource, (v: DataSource) => void] {
  const [v, setV] = useState<DataSource>(readSource);
  useEffect(() => {
    const on = (e: Event) => setV((e as CustomEvent<DataSource>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [v, setDataSource];
}

export function DataSourceProvider({ records, children }: { records: TripRecord[]; children: ReactNode }) {
  const [src] = useDataSourcePref();
  const [file, setFile] = useState<{ ids: Set<string>; fc: ForecastTable | null } | null>(null);
  const [pending, setPending] = useState<PendingBill[]>([]);
  useEffect(() => {
    let alive = true;
    loadCostRev()
      .then((d) => { if (alive) setFile({ ids: new Set(d.trips.map((t) => t.id)), fc: buildForecast(d.trips) }); })
      // ไม่มีไฟล์ต้นทุน = ใบใหม่ทุกใบนับ · ไม่มีค่าเฉลี่ยให้พยากรณ์ (ใบที่บัญชียังไม่กรอกต้นทุน = 0)
      .catch(() => { if (alive) setFile({ ids: new Set(), fc: null }); });
    // อ่านบิลจากที่เก็บในเครื่องอย่างเดียว ไม่ยิงชีต (หน้าบันทึกบิล/จัดรถเป็นคนซิงก์)
    getAllBills().then((b) => { if (alive) setPending(b); }).catch(() => { /* ไม่มีบิล = ปันตามรายได้ */ });
    return () => { alive = false; };
  }, []);
  const fresh = useMemo(() => (file ? freshRecords(records, file.ids) : []), [records, file]);
  const trips = useMemo(() => (file ? fresh.map((r) => recordTrip(r, file.fc ?? null)) : null), [fresh, file]);
  const value = useMemo<DataSourceCtx>(() => ({ src, records: fresh, trips, pending, fc: file?.fc ?? null }),
    [src, fresh, trips, pending, file]);
  return <DataSourceContext.Provider value={value}>{children}</DataSourceContext.Provider>;
}

/**
 * ช่องเลือกแหล่งข้อมูล — วางในแผงตัวกรองของ Executive / Overall Dashboard
 * ดรอปดาวน์หน้าตาเดียวกับตัวกรองกลุ่มบริการ (.ff-multi ของ MultiFF) ข้างในติ๊ก ข้อมูลเก่า · ข้อมูลใหม่
 * (ติ๊กทั้งสอง = ทั้งหมด · ช่องที่ติ๊กอยู่ช่องเดียวเอาออกไม่ได้) · ข้อมูลใหม่บอกจำนวนใบ
 * ไม่ใช้ MultiFF ตรง ๆ เพราะ MultiFF ถือว่าไม่ติ๊กเลย = ทั้งหมด
 */
export function DataSourceFilter({ newCount }: { newCount?: number }) {
  const [v, set] = useDataSourcePref();
  const dd = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (dd.current && !dd.current.contains(e.target as Node)) dd.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const old = v !== "new", fresh = v !== "old";
  const pick = (o: boolean, n: boolean) => set(o && n ? "all" : n ? "new" : "old");
  const box = (id: "old" | "new", on: boolean, toggle: () => void) => {
    const d = DATA_SOURCES.find((s) => s.id === id)!;
    return (
      <label title={d.hint}>
        <input type="checkbox" checked={on} disabled={on && (id === "old" ? !fresh : !old)} onChange={toggle} />
        {d.label}{id === "new" && newCount != null ? ` (${newCount.toLocaleString("th-TH")} ใบ)` : ""}
      </label>
    );
  };
  const text = old && fresh ? "ข้อมูลเก่า + ข้อมูลใหม่" : fresh ? "ข้อมูลใหม่" : "ข้อมูลเก่า";
  return (
    <div className="ff ff-multi ff-src">
      <label>แหล่งข้อมูล</label>
      <details ref={dd}
        onKeyDown={(e) => { if (e.key === "Escape" && dd.current) { dd.current.open = false; dd.current.querySelector("summary")?.focus(); } }}>
        <summary title={DATA_SOURCES.find((x) => x.id === v)?.hint}>{text}</summary>
        <div className="ff-multi-list" role="group" aria-label="แหล่งข้อมูล">
          {box("old", old, () => pick(!old, fresh))}
          {box("new", fresh, () => pick(old, !fresh))}
        </div>
      </details>
    </div>
  );
}
