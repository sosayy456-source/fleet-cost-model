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
import type { Period } from "../filter/period";

export type AllocDataset = "sample" | "real";

/** ฝ่ายที่เป็นผู้จ่ายเงิน — ตามประเภทการชำระเงินของบิล */
/** ฝ่ายที่ลูกค้าเคยจ่าย — ETL ตั้งแต่ 28 ก.ย. 2569 รวมรายเดียวกันเป็นแถวเดียว ("ผู้ส่ง+ผู้รับ" = เคยจ่ายทั้งสองฐานะ) */
export type PayerSide = "ผู้ส่ง" | "ผู้รับ" | "ผู้ส่ง+ผู้รับ";

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
  /** จำนวนชุดย่อยของบิล · ไม่มีในไฟล์รุ่นเก่าที่เก็บ bills.json ก้อนเดียว */
  billShards?: number;
  /** บิลทุกใบของทุกเที่ยว (trip_bills_XX.ndjson · 28 ก.ย. 2569) · ไม่มี = ไฟล์รุ่นก่อน ต้องรัน build_alloc.py ใหม่ */
  tripBills?: { shards: number; bills: number; docs: number };
  /** เดือนที่มีไฟล์ลูกค้า × วัน (cust_days_<YYYY-MM>.json · 29 ก.ย. 2569) · ไม่มี = ไฟล์รุ่นก่อน กรองได้แค่ระดับเดือน */
  custDays?: string[];
}

/**
 * บิล 1 ใบของเที่ยว (trip_bills) — ป็อบอัพรายการบิลของ Manager Dashboard
 * ci = ดัชนีลูกค้าใน customers · −1 = ไม่เข้าลูกค้า (tag บอกเหตุ: บิลเคลียร์ · เที่ยวตีเปล่า · ไม่มีผู้จ่าย)
 * cost = ต้นทุนเที่ยวที่ปันเข้าบิล (สูตรเดียวกับ Customer Performance) · byRevenue = ส่วนที่ปันตามรายได้ (น้ำหนัก/ขนาดเชื่อไม่ได้)
 */
export interface TripBill {
  doc: string; bill: string; date: string; ci: number; tag: string; route: string; goods: string;
  weight: number; cbm: number; revenue: number; cost: number; byRevenue: number;
}

/** 1 ระเบียน = 1 ลูกค้า (ผู้จ่ายเงิน) */
export interface AllocCustomer {
  side: PayerSide;
  code: string;
  /** เลขในรหัส CUS ที่ ETL แปลงจาก custmap.bin มาให้ (0 = ไม่มีในไฟล์แปลงรหัส) */
  n: number;
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
  /** ไฟล์รุ่นก่อน 17 ก.ย. 2569 ยังไม่มีคอลัมน์นี้ — ต้องรับ undefined ได้ */
  n?: number[];
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

/**
 * ลูกค้า × เดือน (cust_months.json) — แท็บ "กำไรลูกค้า" ของ Demo ยุบกลับเป็นรายลูกค้าตามตัวกรองปี/เดือน
 * ci = ดัชนีใน customers · mo = "YYYY-MM"
 */
export interface AllocCustMonth {
  ci: number; mo: string; bills: number; revenue: number; cost: number; profit: number; lossBills: number;
  /** รายได้ของรายการที่ปันตามรายได้ (น้ำหนัก/ขนาดเชื่อไม่ได้) + จำนวนรายการแยกเหตุผล (lib/alloc/review.ts) — ไฟล์เก่าไม่มี = 0 */
  flagRev: number; fNoSize: number; fBig: number; fTiny: number;
}

/** บิลรายใบ — สูงสุด 100 บิลล่าสุดต่อรายต่อเดือนของลูกค้าที่เปิดรายละเอียดได้ */
export interface AllocBill {
  ci: number; bill: string; date: string; doc: string; route: string; revenue: number; cost: number;
  /**
   * ที่มาของต้นทุนบิล (ETL 27 ก.ย. 2569 · null = ไฟล์รุ่นก่อน): น้ำหนัก กก. · ปริมาตร ลบ.ม. · ระยะทาง กม. ·
   * Conversion Factor กก./ลบ.ม. · น้ำหนักเทียบเท่า กก. · Metric กก.-กม. · % ของต้นทุนเที่ยว · ต้นทุนส่วนที่ปันตามรายได้
   */
  weight: number | null; cbm: number | null; km: number | null; cf: number | null;
  eqKg: number | null; metric: number | null; share: number | null; byRevenue: number | null;
}

/** "ปี|เดือน" → Top 100 สองฝั่ง และ Top 10 ของช่วง %Margin ทั้งแปดช่วง · ไฟล์รุ่นเก่าไม่มี margin */
export type AllocTop = Record<string, { gain: number[]; loss: number[]; margin?: number[][] }>;

/**
 * คีย์ของ top.json ตามช่วงเวลา — ต้องตรงกับ top_by_period() ใน etl/build_alloc.py
 *   ทุกปี "|" · ทั้งปี "2026|" · เดือนเดียว "2026|03" · ช่วงเดือน "2026|03-05" (เพิ่ม 24 ก.ย. 2569)
 */
export function allocTopKey(p: Period): string {
  if (!p.year) return "|";
  if (p.from === "01" && p.to === "12") return `${p.year}|`;
  return p.from === p.to ? `${p.year}|${p.from}` : `${p.year}|${p.from}-${p.to}`;
}

export interface AllocData {
  manifest: AllocManifest;
  customers: AllocCustomer[];
  months: AllocMonths;
  unlinked: AllocUnlinked;
  /**
   * สามชุดนี้มีเฉพาะไฟล์ที่สร้างตั้งแต่ 22 ก.ย. 2569 — ไฟล์รุ่นก่อนไม่มี จึงเป็น null ได้
   * หน้า "กำไรลูกค้า (ปันส่วนต้นทุน)" เดิมไม่ใช้ ห้ามให้การโหลดสามไฟล์นี้ล้มพาหน้านั้นล้มไปด้วย
   */
  custMonths: AllocCustMonth[] | null;
  /** cust_months.json มีคอลัมน์ปันตามรายได้ (สร้างตั้งแต่ 23 ก.ย. 2569) — ไม่มี = ไม่มีป้าย */
  hasReview: boolean;
  bills: AllocBill[] | null;
  top: AllocTop | null;
}

interface CustMonthColumns {
  month: string[]; ci: number[]; mi: number[]; bills: number[]; revenue: number[]; cost: number[];
  profit: number[]; lossBills: number[];
  flagRev?: number[]; fNoSize?: number[]; fBig?: number[]; fTiny?: number[];
}
interface BillColumns {
  ci: number[]; bill: string[]; date: string[]; doc: string[]; route: string[]; revenue: number[]; cost: number[];
  weight?: number[]; cbm?: number[]; km?: number[]; cf?: number[]; eqKg?: number[]; metric?: number[];
  share?: number[]; byRevenue?: number[];
}

const BASE = import.meta.env.BASE_URL;
const FORCED = import.meta.env.DEV ? undefined : import.meta.env.VITE_DATASET as AllocDataset | undefined;

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
  // manifest ถามเซิร์ฟเวอร์ใหม่ทุกครั้ง · ไฟล์ก้อนใหญ่ใช้แคชของเบราว์เซอร์แต่ต้องถามเซิร์ฟเวอร์ก่อนว่าไฟล์เปลี่ยนไหม
  // (no-cache = ส่ง ETag ไปเทียบ ไม่เปลี่ยนได้ 304 ไม่ต้องดาวน์โหลดใหม่ · ETL รันใหม่ = ได้ไฟล์ใหม่ ไม่มีทางได้ของเก่าค้าง)
  const res = await fetch(url(ds, f), { cache: f === "manifest.json" ? "no-store" : "no-cache" });
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
      n: c.n?.[i] ?? 0,
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

/** ไฟล์เสริมที่ไฟล์รุ่นเก่าไม่มี — โหลดไม่ได้ให้เป็น null ไม่โยน */
const fetchOptional = <T,>(ds: AllocDataset, f: string): Promise<T | null> =>
  fetchJson<T>(ds, f).catch(() => null);

function toCustMonths(c: CustMonthColumns | null): AllocCustMonth[] | null {
  if (!c) return null;
  const out: AllocCustMonth[] = [];
  for (let i = 0; i < c.ci.length; i++) {
    out.push({
      ci: c.ci[i] ?? 0, mo: c.month[c.mi[i] ?? -1] ?? "", bills: c.bills[i] ?? 0, revenue: c.revenue[i] ?? 0,
      cost: c.cost[i] ?? 0, profit: c.profit[i] ?? 0, lossBills: c.lossBills[i] ?? 0,
      flagRev: c.flagRev?.[i] ?? 0, fNoSize: c.fNoSize?.[i] ?? 0, fBig: c.fBig?.[i] ?? 0, fTiny: c.fTiny?.[i] ?? 0,
    });
  }
  return out;
}

function toBills(c: BillColumns | null): AllocBill[] | null {
  if (!c) return null;
  const out: AllocBill[] = [];
  for (let i = 0; i < c.ci.length; i++) {
    out.push({
      ci: c.ci[i] ?? 0, bill: c.bill[i] ?? "", date: c.date[i] ?? "", doc: c.doc[i] ?? "",
      route: c.route[i] ?? "", revenue: c.revenue[i] ?? 0, cost: c.cost[i] ?? 0,
      weight: c.weight?.[i] ?? null, cbm: c.cbm?.[i] ?? null, km: c.km?.[i] ?? null, cf: c.cf?.[i] ?? null,
      eqKg: c.eqKg?.[i] ?? null, metric: c.metric?.[i] ?? null, share: c.share?.[i] ?? null,
      byRevenue: c.byRevenue?.[i] ?? null,
    });
  }
  return out;
}

/** ไฟล์ย่อยของเลขที่ใบรายการ — ผลรวมรหัสอักขระ ต้องตรงกับ trip_shard() ใน etl/build_alloc.py */
export const tripShard = (doc: string, shards: number): number => {
  let s = 0;
  for (let i = 0; i < doc.length; i++) s += doc.charCodeAt(i);
  return s % shards;
};

const tripShardCache = new Map<string, Promise<string>>();
/**
 * บิลทุกใบของเที่ยวหนึ่งใบ — โหลดเฉพาะไฟล์ย่อยของเลขนั้น (ข้อมูลจริง ~1 MB/ไฟล์) · ไฟล์เป็น NDJSON จึงเช็คว่าไม่ใช่ HTML
 * (Vite dev ตอบ 200 + text/html ให้ไฟล์ที่ไม่มี) · ไฟล์รุ่นก่อนไม่มี tripBills = null
 */
export async function loadTripBills(data: AllocData, doc: string): Promise<TripBill[] | null> {
  const tb = data.manifest.tripBills;
  if (!tb?.shards) return null;
  const file = `trip_bills_${tripShard(doc, tb.shards).toString(16).padStart(2, "0")}.ndjson`;
  const key = `${data.manifest.dataset}/${data.manifest.generatedAt}/${file}`;
  let promise = tripShardCache.get(key);
  if (!promise) {
    promise = fetch(url(data.manifest.dataset, file), { cache: "no-cache" }).then(async (res) => {
      const text = await res.text();
      if (!res.ok || (res.headers.get("content-type") ?? "").includes("html") || text.trimStart().startsWith("<")) {
        throw new Error(`โหลด alloc/${file} ไม่ได้ (HTTP ${res.status})`);
      }
      return text;
    }).catch((error) => { tripShardCache.delete(key); throw error; });
    tripShardCache.set(key, promise);
  }
  const text = await promise;
  const out: TripBill[] = [];
  // กรองด้วยข้อความก่อน parse — ไฟล์หนึ่งมีหลายพันเที่ยว
  const needle = `["${doc}",`;
  for (const line of text.split("\n")) {
    if (!line.startsWith(needle)) continue;
    const r = JSON.parse(line) as [string, string, string, number, string, string, string, number, number, number, number, number];
    out.push({ doc: r[0], bill: r[1], date: r[2], ci: r[3], tag: r[4], route: r[5], goods: r[6],
      weight: r[7], cbm: r[8], revenue: r[9], cost: r[10], byRevenue: r[11] });
  }
  return out;
}

let cache: Promise<AllocData> | null = null;
const billShardCache = new Map<string, Promise<AllocBill[]>>();

/**
 * ลูกค้า × วันของหนึ่งเดือน (cust_days_<YYYY-MM>.json · ETL 29 ก.ย. 2569) — โหลดเฉพาะเดือนที่ช่วงที่เลือกคร่อมไม่เต็มเดือน
 * (ตัวกรองรายวันของ Executive Dashboard + Baseline ของ PI) · ยอดไม่รวมส่วนต่างปัดเศษรายเที่ยว (ต่างจากรายเดือนไม่เกินหลักสตางค์)
 */
export interface AllocCustDay { ci: number; d: string; bills: number; revenue: number; cost: number; profit: number; lossBills: number }
interface CustDayColumns { ci: number[]; day: string[]; bills: number[]; revenue: number[]; cost: number[]; profit: number[]; lossBills: number[] }
const custDayCache = new Map<string, Promise<AllocCustDay[]>>();
/** ค่าคงที่ตอนไม่ต้องใช้รายวัน — identity เดิมทุก render ไม่ให้ useMemo ของผู้เรียกคิดใหม่ */
const NO_DAYS: Map<string, AllocCustDay[]> = new Map();
export function loadCustDays(data: AllocData, mo: string): Promise<AllocCustDay[]> {
  const key = `${data.manifest.dataset}/${data.manifest.generatedAt}/${mo}`;
  let promise = custDayCache.get(key);
  if (!promise) {
    promise = fetchJson<CustDayColumns>(data.manifest.dataset, `cust_days_${mo}.json`)
      .then((c) => c.ci.map((ci, i) => ({ ci, d: `${mo}-${c.day[i]}`, bills: c.bills[i] ?? 0, revenue: c.revenue[i] ?? 0,
        cost: c.cost[i] ?? 0, profit: c.profit[i] ?? 0, lossBills: c.lossBills[i] ?? 0 })))
      .catch((error) => { custDayCache.delete(key); throw error; });
    custDayCache.set(key, promise);
  }
  return promise;
}

/** โหลดลูกค้า × วันของหลายเดือน — null = ยังโหลดไม่เสร็จ/ไม่มีไฟล์ (ผู้เรียกใช้รายเดือนไปก่อน) · months ว่าง = Map ว่าง */
export function useCustDays(data: AllocData | null, months: string[]): Map<string, AllocCustDay[]> | null {
  const avail = data?.manifest.custDays;
  const want = useMemo(() => (avail ? months.filter((m) => avail.includes(m)) : []), [avail, months.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<{ key: string; map: Map<string, AllocCustDay[]> } | null>(null);
  const key = `${data?.manifest.generatedAt ?? ""}|${want.join(",")}`;
  useEffect(() => {
    if (!data || !want.length) return;
    let alive = true;
    Promise.all(want.map((m) => loadCustDays(data, m).then((rows) => [m, rows] as const)))
      .then((list) => { if (alive) setState({ key, map: new Map(list) }); })
      .catch(() => { /* ไม่มีไฟล์/โหลดไม่ได้ = ใช้รายเดือนต่อ */ });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!want.length) return NO_DAYS;
  return state?.key === key ? state.map : null;
}

/** โหลดเฉพาะชุดย่อยของลูกค้าที่กดดู · ไฟล์รุ่นเก่ายังอ่าน bills.json ตามเดิม */
export async function loadAllocBills(data: AllocData, ci: number): Promise<AllocBill[]> {
  const shards = data.manifest.billShards;
  if (!shards) return data.bills?.filter((b) => b.ci === ci) ?? [];
  const file = `bills_${(ci % shards).toString(16).padStart(2, "0")}.json`;
  const key = `${data.manifest.dataset}/${data.manifest.generatedAt}/${file}`;
  let promise = billShardCache.get(key);
  if (!promise) {
    promise = fetchJson<BillColumns>(data.manifest.dataset, file)
      .then((columns) => toBills(columns) ?? [])
      .catch((error) => { billShardCache.delete(key); throw error; });
    billShardCache.set(key, promise);
  }
  return (await promise).filter((b) => b.ci === ci);
}

export async function loadAlloc(): Promise<AllocData> {
  cache ??= (async () => {
    const ds = await detect();
    const manifest = await fetchJson<AllocManifest>(ds, "manifest.json");
    const [columns, months, unlinked, custMonths, bills, top] = await Promise.all([
      fetchJson<CustomerColumns>(ds, "customers.json"),
      fetchJson<AllocMonths>(ds, "months.json"),
      fetchJson<AllocUnlinked>(ds, "unlinked.json"),
      fetchOptional<CustMonthColumns>(ds, "cust_months.json"),
      manifest.billShards ? Promise.resolve(null) : fetchOptional<BillColumns>(ds, "bills.json"),
      fetchOptional<AllocTop>(ds, "top.json"),
    ]);
    return {
      manifest, customers: toRows(columns), months, unlinked,
      custMonths: toCustMonths(custMonths), hasReview: !!custMonths?.flagRev, bills: toBills(bills), top,
    };
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

  const reload = useCallback(() => { cache = null; billShardCache.clear(); tripShardCache.clear(); custDayCache.clear(); resetAllocDataset(); setTick((t) => t + 1); }, []);

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
