/**
 * โหลดไฟล์ JSON ที่ ETL สร้างไว้
 * เป็น static file ทั้งหมด ไม่มี API ระหว่างทาง — โหลดครั้งเดียวแล้วใช้ซ้ำ
 */
import { useEffect, useState } from "react";
import { dataUrl } from "../dataset";

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

export interface Overview {
  total_revenue: number; distinct_bills: number; total_line_items: number;
  avg_bill_value: number; date_min: string | null; date_max: string | null;
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
}

export interface CubeRow {
  month: string; revenue: number; lines: number; bills: number; [dim: string]: unknown;
}

export interface Insight { level: string; text: string }

export interface Dataset {
  manifest: Manifest;
  overview: Overview;
  monthly: MonthRow[];
  payment: NamedRow[];
  product: NamedRow[];
  pricing: NamedRow[];
  routes: NamedRow[];
  distline: NamedRow[];
  billStatus: NamedRow[];
  dow: NamedRow[];
  pareto: Pareto;
  dq: Record<string, unknown>;
  insights: Record<string, Insight[]>;
  cube: CubeRow[];
  dimensions: Record<string, string[]>;
}

const FILES: Record<keyof Dataset, string> = {
  manifest: "manifest.json", overview: "overview.json", monthly: "monthly.json",
  payment: "payment.json", product: "product.json", pricing: "pricing.json",
  routes: "routes.json", distline: "distline.json", billStatus: "bill_status.json",
  dow: "dow.json", pareto: "pareto.json", dq: "dq.json", insights: "insights.json",
  cube: "cube.json", dimensions: "dimensions.json",
};

let cache: Promise<Dataset> | null = null;

async function fetchAll(): Promise<Dataset> {
  const keys = Object.keys(FILES) as (keyof Dataset)[];
  const parts = await Promise.all(keys.map(async (k) => {
    const res = await fetch(dataUrl(FILES[k]));
    if (!res.ok) throw new Error(`โหลด ${FILES[k]} ไม่ได้ (HTTP ${res.status})`);
    return [k, await res.json()] as const;
  }));
  return Object.fromEntries(parts) as unknown as Dataset;
}

export function useDataset(): { data: Dataset | null; error: string | null } {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    cache ??= fetchAll().catch((e) => { cache = null; throw e; });
    cache.then((d) => { if (alive) setData(d); })
         .catch((e) => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);

  return { data, error };
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
