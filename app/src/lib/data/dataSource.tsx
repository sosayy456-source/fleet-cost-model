/**
 * ตัวกรอง "แหล่งข้อมูล" ของ Executive Dashboard + Overall Dashboard (เจ้าของงานสั่ง 1 ต.ค. 2569)
 *   ทั้งหมด (ตั้งต้น) · ข้อมูลเก่า = ไฟล์ Excel ที่ ETL แปลง · ข้อมูลใหม่ = ใบที่บันทึกในโมเดล
 *   ค่าเดียวร่วมกันทั้งสองหน้า จำใน sessionStorage จนปิดแท็บ (เจ้าของงานเลือก)
 *
 * ทำงานผ่าน Provider: สองหน้านี้ครอบเนื้อหาด้วย <DataSourceProvider records> แล้ว hook ข้อมูลทั้ง 4 ชุด
 * (useCostRev · useLoadFactor · useAlloc · useDebtors) ผสมใบใหม่ให้เอง — ทุกส่วน/กล่อง PI ตามโดยไม่ต้องแก้ทีละหน้า
 * ★ หน้าอื่น (Manager · Executive Summary · จัดรถ · ตั้งค่า) ไม่มี Provider = ได้ไฟล์ล้วนเหมือนเดิม
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
    return v === "old" || v === "new" ? v : "all";
  } catch { return "all"; }
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
 * หน้าตาเดียวกับช่องเลือกอื่นในแผง (.ff + select · ชื่อชุดเดียวกับ SrcFF ของหน้าเดิม) · ข้อมูลใหม่บอกจำนวนใบ
 */
export function DataSourceFilter({ newCount }: { newCount?: number }) {
  const [v, set] = useDataSourcePref();
  return (
    <div className="ff">
      <label>แหล่งข้อมูล</label>
      <select value={v} onChange={(e) => set(e.target.value as DataSource)}
        title={DATA_SOURCES.find((s) => s.id === v)?.hint}>
        {DATA_SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}{s.id === "new" && newCount != null ? ` (${newCount.toLocaleString("th-TH")} ใบ)` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
