/**
 * Context ของตัวกรองแหล่งข้อมูล — แยกไฟล์ไม่ให้ hook ข้อมูล (useCostRev ฯลฯ) กับ Provider (dataSource.tsx) import วนกัน
 * รายละเอียดดูหัวไฟล์ dataSource.tsx
 */
import { createContext, useContext } from "react";
import type { TripRecord } from "../../types/record";
import type { PendingBill } from "../../types/bill";
import type { ForecastTable } from "../forecast/forecast";
import type { Trip } from "./useCostRev";
import type { DataSource } from "./recordSources";

export interface DataSourceCtx {
  src: DataSource;
  /** ใบใหม่ที่ไม่มีในไฟล์ต้นทุน (เลขซ้ำ = ใช้ไฟล์) */
  records: TripRecord[];
  /** ใบเดียวกันในรูป Trip — null = ยังรอไฟล์ต้นทุน (ใช้ตัดเลขซ้ำ + ทำต้นทุนพยากรณ์) */
  trips: Trip[] | null;
  /** บิลที่ CS กรอก (น้ำหนัก/ปริมาตร) — ปันต้นทุนเข้าบิลของใบใหม่ */
  pending: PendingBill[];
  fc: ForecastTable | null;
}

export const DataSourceContext = createContext<DataSourceCtx | null>(null);

/** null = หน้านี้ไม่มีตัวกรองแหล่งข้อมูล (ได้ไฟล์ล้วนเหมือนเดิม) */
export const useDataSourceCtx = (): DataSourceCtx | null => useContext(DataSourceContext);
