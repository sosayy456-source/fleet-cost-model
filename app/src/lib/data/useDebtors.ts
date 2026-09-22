/**
 * โหลดชุดข้อมูลลูกหนี้ (ใบวางบิล) ที่ etl/build_debtors.py สร้างไว้
 * (app/public/data/<dataset>/debtors/) — ใช้กับแท็บ "Dashboard ลูกหนี้"
 *
 * ★ ชุดนี้ไม่เชื่อมกับข้อมูลเก่าเลย — เลขที่ใบวางบิลเป็นคนละเลขกับเลขที่ใบรายการใน costrev/
 *   และรหัสลูกหนี้เป็น hex 40 ตัว (ไฟล์บิลใช้ 64 ตัว) จึง join กันไม่ได้และไม่ควร join
 *
 * เลือกชุดข้อมูลแยกของตัวเองเหมือน useCostRev: มี data/real/debtors/manifest.json ที่เป็น
 * json จริง = real ไม่งั้น sample
 * (★ Vite dev ตอบ 200 + text/html ให้ทุก path ที่ไม่มีไฟล์ ต้องดู content-type ไม่ใช่แค่ status)
 */
import { useCallback, useEffect, useState } from "react";

export type DebtorDataset = "sample" | "real";

/** 1 แถว = 1 ใบวางบิล — คีย์สั้นเพื่อให้ไฟล์เล็ก */
export interface DebtorRow {
  /** เลขที่ใบวางบิล 13 หลัก (สตริง) */
  doc: string;
  /** รหัสลูกหนี้ที่ hash มาจากต้นทาง */
  cust: string;
  /** สาขา */
  br: string;
  /** ระยะเวลาเครดิตของใบนี้ (วัน) — รายบิล ไม่ใช่ค่าเดียวทั้งบริษัท */
  term: number;
  /** วันที่วางบิล ISO · เดือน YYYY-MM · ปี ค.ศ. */
  issue: string; mo: string; y: number;
  /** วันครบกำหนด = วางบิล + เครดิต */
  due: string;
  /** วันที่ปิดบัญชี — null = ยังค้างชำระ */
  close: string | null;
  amount: number;
  /** ปิดแล้วใช้เวลากี่วัน (close − issue) — null เมื่อยังค้าง */
  days: number | null;
  /** ยังค้างมาแล้วเกินกำหนดกี่วัน (ติดลบ = ยังไม่ครบกำหนด) — null เมื่อปิดแล้ว */
  over: number | null;
}

export interface DebtorManifest {
  dataset: DebtorDataset;
  isSample: boolean;
  generatedAt: string;
  sourceFiles: string[];
  /** วันที่ ETL คิดอายุหนี้ — การ์ด "ข้อมูล ณ วันที่" อ่านค่านี้ ไม่ใช่วันที่เปิดหน้า */
  asOf: string;
  /**
   * วันที่อ้างอิงจากชีต "สรุปวิเคราะห์" ของไฟล์รุ่นใหม่ — ค่าเริ่มต้นของช่อง "ข้อมูล ณ วันที่"
   * ในส่วนลูกหนี้ค้างชำระของแท็บกำไรลูกค้า (Demo) · ไฟล์รุ่นเก่า/ETL รุ่นก่อน 22 ก.ย. 2569 ไม่มี → ใช้ asOf แทน
   */
  refDate?: string | null;
  rows: number;
  skipped: number;
  customers: number;
  branches: string[];
  terms: number[];
  dateRange: { min: string | null; max: string | null };
  outstanding: { bills: number; amount: number };
  closedBills: number;
  closedAmount: number;
  avgClearDays: number | null;
  latePct: number | null;
}

export interface DebtorData {
  manifest: DebtorManifest;
  rows: DebtorRow[];
}

const BASE = import.meta.env.BASE_URL;
const FORCED = import.meta.env.VITE_DATASET as DebtorDataset | undefined;

export const debtorUrl = (ds: DebtorDataset, f: string) => `${BASE}data/${ds}/debtors/${f}`;
const url = debtorUrl;

let resolved: DebtorDataset | null = FORCED ?? null;

/** ชุดข้อมูลลูกหนี้ที่ใช้อยู่ — เปิดให้ lib/custmap/debtorCodes.ts เรียกใช้ซ้ำ */
export async function detectDebtorDataset(): Promise<DebtorDataset> {
  if (resolved) return resolved;
  try {
    const res = await fetch(url("real", "manifest.json"), { cache: "no-store" });
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    resolved = res.ok && isJson ? "real" : "sample";
  } catch {
    resolved = "sample";
  }
  return resolved;
}

const detect = detectDebtorDataset;

export const resetDebtorDataset = (): void => { if (!FORCED) resolved = null; };

async function fetchJson<T>(ds: DebtorDataset, f: string): Promise<T> {
  const res = await fetch(url(ds, f), { cache: "no-store" });
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (!res.ok || !isJson) throw new Error(`โหลด debtors/${f} ไม่ได้ (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

let cache: Promise<DebtorData> | null = null;

export async function loadDebtors(): Promise<DebtorData> {
  cache ??= (async () => {
    const ds = await detect();
    const [manifest, rows] = await Promise.all([
      fetchJson<DebtorManifest>(ds, "manifest.json"),
      fetchJson<DebtorRow[]>(ds, "debtors.json"),
    ]);
    return { manifest, rows };
  })().catch((e) => { cache = null; throw e; });
  return cache;
}

export interface DebtorState {
  data: DebtorData | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useDebtors(): DebtorState {
  const [data, setData] = useState<DebtorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => { cache = null; resetDebtorDataset(); setTick((t) => t + 1); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loadDebtors()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  return { data, error, loading, reload };
}
