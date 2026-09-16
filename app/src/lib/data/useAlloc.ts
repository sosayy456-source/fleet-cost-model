/**
 * โหลดชุดข้อมูล "กำไรลูกค้าจากการปันส่วนต้นทุน" ที่ etl/build_alloc.py สร้างไว้
 * (app/public/data/<dataset>/alloc/) — ใช้กับเมนู "กำไรลูกค้า (ปันส่วนต้นทุน)" เท่านั้น
 *
 * แยกขาดจาก useCostRev/useDataset ทั้งการตรวจชุดข้อมูลและ cache — ไฟล์รายงานค่าเดินทาง
 * กับไฟล์บิลอาจถูกวางคนละเวลากัน หน้าอื่นจึงต้องไม่ถูกลากไปด้วย
 *
 * customers.json เก็บเป็น "คอลัมน์" (array ต่อฟิลด์) ไม่ใช่ array ของ object
 * เพราะลูกค้าเดือนเดียวมี 38,978 ราย — เก็บเป็น object จะมีชื่อคีย์ซ้ำทุกระเบียน
 * (★ Vite dev ตอบ 200 + text/html ให้ทุก path ที่ไม่มีไฟล์ ต้องดู content-type ไม่ใช่แค่ status)
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export type AllocDataset = "sample" | "real";

/** ฝ่ายที่เป็นผู้จ่ายเงิน — ตามประเภทการชำระเงินของบิล */
export type PayerSide = "ผู้ส่ง" | "ผู้รับ";

export interface AllocManifest {
  dataset: AllocDataset;
  isSample: boolean;
  generatedAt: string;
  /** ที่มาของตัวเลข — ไฟล์ที่ปันเสร็จแล้วจากเครื่องปันส่วนต้นทุน หรือคำนวณในระบบ */
  source: string;
  costFiles: string[];
  billFiles: number;
  items: number;
  customers: number;
  trips: { inCostReport: number; inBills: number; matched: number };
  /** inCostReport = ต้นทุนทุกเที่ยวในรายงาน · allocatable = เฉพาะเที่ยวที่จับคู่กับบิลได้
   *  toCustomers + notToCustomers = allocatable */
  cost: { inCostReport: number; allocatable: number; toCustomers: number; notToCustomers: number };
  revenue: { toCustomers: number; notLinked: number };
  itemStatus: Record<string, number>;
  months: string[];
}

/** 1 ระเบียน = 1 ลูกค้า (ผู้จ่ายเงิน) */
export interface AllocCustomer {
  side: PayerSide;
  code: string;
  bills: number;
  revenue: number;
  cost: number;
  profit: number;
  lossBills: number;
  /** อัตรากำไร (%) — null เมื่อรายได้เป็น 0 หารไม่ได้ */
  margin: number | null;
}

interface CustomerColumns {
  side: PayerSide[];
  code: string[];
  bills: number[];
  revenue: number[];
  cost: number[];
  profit: number[];
  lossBills: number[];
}

export interface AllocMonths {
  month: string[];
  revenue: number[];
  cost: number[];
  profit: number[];
  items: number[];
}

export interface AllocUnlinked {
  /** เที่ยว/บิล/รายการที่หาต้นทุนไม่ได้ — มีรายได้แต่ไม่มีต้นทุน จึงไม่นับรวมในกำไรลูกค้า */
  notLinked: { trips: number; bills: number; items: number; revenue: number };
  /** ต้นทุนที่ไม่ปันเข้าลูกค้า แยกตามเหตุผล (บิลเคลียร์ · ของเหมาตีเปล่า · รถว่างไปสาขา) */
  excludedCost: Record<string, number>;
  excludedItems: Record<string, number>;
  noPayer: { items: number; revenue: number };
  distanceSource: Record<string, number>;
  basisCondition: Record<string, number>;
}

export interface AllocData {
  manifest: AllocManifest;
  customers: AllocCustomer[];
  months: AllocMonths;
  unlinked: AllocUnlinked;
}

const BASE = import.meta.env.BASE_URL;
const FORCED = import.meta.env.VITE_DATASET as AllocDataset | undefined;

const url = (ds: AllocDataset, f: string) => `${BASE}data/${ds}/alloc/${f}`;

let resolved: AllocDataset | null = FORCED ?? null;

async function detect(): Promise<AllocDataset> {
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

export const resetAllocDataset = (): void => { if (!FORCED) resolved = null; };

async function fetchJson<T>(ds: AllocDataset, f: string): Promise<T> {
  const res = await fetch(url(ds, f), { cache: "no-store" });
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (!res.ok || !isJson) throw new Error(`โหลด alloc/${f} ไม่ได้ (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

/** คอลัมน์ → ระเบียน พร้อมคิดอัตรากำไรให้ครั้งเดียวตอนโหลด */
function toRows(c: CustomerColumns): AllocCustomer[] {
  const out: AllocCustomer[] = [];
  for (let i = 0; i < c.code.length; i++) {
    const revenue = c.revenue[i] ?? 0;
    const profit = c.profit[i] ?? 0;
    out.push({
      side: c.side[i] ?? "ผู้ส่ง",
      code: c.code[i] ?? "",
      bills: c.bills[i] ?? 0,
      revenue,
      cost: c.cost[i] ?? 0,
      profit,
      lossBills: c.lossBills[i] ?? 0,
      margin: revenue ? (profit / revenue) * 100 : null,
    });
  }
  return out;
}

let cache: Promise<AllocData> | null = null;

export async function loadAlloc(): Promise<AllocData> {
  cache ??= (async () => {
    const ds = await detect();
    const [manifest, columns, months, unlinked] = await Promise.all([
      fetchJson<AllocManifest>(ds, "manifest.json"),
      fetchJson<CustomerColumns>(ds, "customers.json"),
      fetchJson<AllocMonths>(ds, "months.json"),
      fetchJson<AllocUnlinked>(ds, "unlinked.json"),
    ]);
    return { manifest, customers: toRows(columns), months, unlinked };
  })().catch((e) => { cache = null; throw e; });
  return cache;
}

export interface AllocState {
  data: AllocData | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useAlloc(): AllocState {
  const [data, setData] = useState<AllocData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => { cache = null; resetAllocDataset(); setTick((t) => t + 1); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loadAlloc()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  return { data, error, loading, reload };
}

/** ยอดรวมของชุดลูกค้าที่กรองมาแล้ว — การ์ดหัวหน้าจอใช้ */
export function useAllocTotals(rows: AllocCustomer[]) {
  return useMemo(() => {
    let revenue = 0, cost = 0, bills = 0, lossBills = 0, lossCust = 0;
    for (const r of rows) {
      revenue += r.revenue; cost += r.cost; bills += r.bills; lossBills += r.lossBills;
      if (r.profit < 0) lossCust++;
    }
    const profit = revenue - cost;
    return {
      customers: rows.length, revenue, cost, profit, bills, lossBills, lossCust,
      margin: revenue ? (profit / revenue) * 100 : null,
      lossShare: bills ? (lossBills / bills) * 100 : null,
    };
  }, [rows]);
}
