/**
 * โหลดไฟล์ JSON ที่ ETL สร้างไว้
 * เป็น static file ทั้งหมด ไม่มี API ระหว่างทาง — โหลดครั้งเดียวแล้วใช้ซ้ำ
 *
 * ★ โหลดเฉพาะไฟล์ที่มีหน้าจออ่านจริง (11 จาก 19 ไฟล์ที่ build_json.py สร้าง)
 *   ที่ยังไม่ดึง: pricing / distline / bill_status / dow / dq / insights / cube / dimensions
 *   ก้อนใหญ่สุดคือ cube.json (1.47 MB ในชุดตัวอย่าง) ซึ่งมีไว้ให้กรองรายเดือนทุกมิติ
 *   ยังไม่มีหน้าไหนใช้ จึงไม่ดึงมาให้เสียเน็ตเปล่า
 *
 *   ETL ยังสร้างครบเหมือนเดิม ไฟล์ยังอยู่ใน public/data/ ครบ — จะเอาไฟล์ไหนกลับมาใช้
 *   ก็เติมชื่อกลับเข้า FILES กับ interface Dataset อย่างละบรรทัด ไม่ต้องรัน ETL ใหม่
 *   (ที่ตัดไปคือ "ไม่ดึง" ไม่ใช่ "ไม่มี")
 */
import { useCallback, useEffect, useState } from "react";
import { dataUrl, resetDataset, resolveDataset } from "../dataset";
import type { DatasetName } from "../dataset";

export interface Manifest {
  dataset: string;
  isSample: boolean;
  generatedAt: string;
  sourceFiles: { name: string; sizeBytes: number }[];
  rowCount: number;
  dateRange: { min: string | null; max: string | null };
  missingColumns: string[];
  cube: { source_rows: number; cube_rows: number; compression: number | null; dimensions: string[] };
}

/** ตัวเลขหัวหน้า Overview — ตรงกับแถว KPI ในสเปกที่เจ้าของงานส่งมา */
export interface Overview {
  total_revenue: number;
  distinct_bills: number;
  total_line_items: number;
  avg_bill_value: number;
  date_min: string | null;
  date_max: string | null;
  /** เที่ยว = เลขที่ใบรายการไม่ซ้ำ (ไม่ใช่จำนวนบิล — บิลหลายใบขึ้นรถเที่ยวเดียวกันได้) */
  trips: number;
  customers: number;
  avg_trip_value: number;
  avg_customer_value: number;
  /** ★ ไฟล์บิลไม่มีวันครบกำหนด จึงแยก "เกินกำหนด" ไม่ได้ มีแค่ชำระ/ยังไม่ชำระ */
  paid_amount: number;
  paid_bills: number;
  unpaid_amount: number;
  unpaid_bills: number;
  collection_rate: number | null;
  bill_clear_amount: number;
  bill_clear_bills: number;
  bill_clear_pct: number | null;
}

export interface MonthRow {
  month: string; revenue: number; bills: number; lines: number;
  avg_bill_value: number | null; growth_pct: number | null;
}

export interface NamedRow { revenue: number; bills?: number; lines?: number; [k: string]: unknown }

export interface Pareto {
  total_customers: number; n_for_80pct: number; pct_customers_for_80pct: number;
  curve: { cust_pct: number; cum_pct: number }[];
  concentration: Record<string, number>;
  /** รายได้แยกตามช่วงอันดับลูกค้า — "REVENUE BY CUSTOMER SEGMENT" ในสเปก */
  segments: { label: string; customers: number; revenue: number }[];
}

/** รายได้ตามวิธีชำระเงิน แยกรายเดือน — ใช้กับกราฟแท่งซ้อนของแท็บ "Dashboard รายได้" */
export interface PayMonthRow {
  month: string;
  "ประเภทการชำระเงิน": string;
  "ราคารวม": number;
}

/** ลูกค้า 200 อันดับแรก — ETL ส่งมาแล้วแต่เดิมยังไม่มีหน้าไหนใช้ */
export interface CustomerRow {
  "ผู้รับ_encoded": string;
  revenue: number;
  bills: number;
  /** เลขในรหัส CUS ที่ ETL แปลงมาให้ (0 = ไม่มีในไฟล์แปลงรหัส) */
  n: number;
}

/** รายได้รายเส้นทางรายเดือน — ใช้ join กับต้นทุนฝั่งโมเดลเดินรถ */
export interface RouteMonthRow {
  route: string; month: string; revenue: number; bills: number; lines: number;
}

export interface Dataset {
  manifest: Manifest;
  overview: Overview;
  monthly: MonthRow[];
  /** เส้นทางเรียงตามรายได้ 20 อันดับ — มี bills/trips กำกับ */
  routes: NamedRow[];
  payment: NamedRow[];
  paymentMonthly: PayMonthRow[];
  product: NamedRow[];
  pareto: Pareto;
  customerTop: CustomerRow[];
  /** ลูกค้ารายได้ต่ำสุด 10 ราย (ตัดรายที่ยอด 0 ออกแล้ว) */
  customerLow: CustomerRow[];
  /** ของเมนู "กำไรรายเส้นทาง" ไม่ใช่ของแท็บ Dashboard รายได้ */
  route_month: RouteMonthRow[];
}

const FILES: Record<keyof Dataset, string> = {
  manifest: "manifest.json", overview: "overview.json", monthly: "monthly.json",
  payment: "payment.json", paymentMonthly: "payment_monthly.json",
  product: "product.json", routes: "routes.json", pareto: "pareto.json",
  customerTop: "customer_top.json", customerLow: "customer_low.json",
  route_month: "route_month.json",
};

let cache: Promise<Dataset> | null = null;

async function fetchAll(): Promise<Dataset> {
  const ds: DatasetName = await resolveDataset();
  const keys = Object.keys(FILES) as (keyof Dataset)[];
  const parts = await Promise.all(keys.map(async (k) => {
    // ห้าม cache — หลังรัน ETL ซ้ำต้องได้ไฟล์ชุดใหม่ ไม่ใช่ที่เบราว์เซอร์จำไว้
    const res = await fetch(dataUrl(ds, FILES[k]), { cache: "no-store" });
    if (!res.ok) throw new Error(`โหลด ${FILES[k]} ไม่ได้ (HTTP ${res.status})`);
    return [k, await res.json()] as const;
  }));
  return Object.fromEntries(parts) as unknown as Dataset;
}

export interface DatasetState {
  data: Dataset | null;
  error: string | null;
  loading: boolean;
  /** ทิ้ง cache แล้วดึงไฟล์ใหม่ — ใช้หลังรัน ETL ซ้ำโดยไม่ต้องรีโหลดทั้งหน้า */
  reload: () => void;
}

export function useDataset(): DatasetState {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // ล้าง cache ของโมดูลด้วย ไม่งั้นกดรีเฟรชแล้วได้ชุดเดิมกลับมา
  // และให้ตรวจชุดข้อมูลใหม่ เผื่อเพิ่งรัน ETL ครั้งแรกหลังเปิดแอป (sample → real)
  const reload = useCallback(() => { cache = null; resetDataset(); setTick((t) => t + 1); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    cache ??= fetchAll().catch((e) => { cache = null; throw e; });
    cache.then((d) => { if (alive) { setData(d); setLoading(false); } })
         .catch((e) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  return { data, error, loading, reload };
}

/** 'ก.ค. 68' จาก '2025-07' — ตรรกะเดียวกับ cleaning.month_label ฝั่ง Python */
const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
            "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function monthLabel(month: string): string {
  const [y, m] = String(month).split("-");
  const mi = Number(m) - 1;
  if (!y || Number.isNaN(mi) || !TH[mi]) return String(month);
  return `${TH[mi]} ${Number(y) + 543 - 2500}`;
}
