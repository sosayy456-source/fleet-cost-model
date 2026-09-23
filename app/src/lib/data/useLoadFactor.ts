/**
 * โหลดชุดข้อมูล Load Factor รายเที่ยวที่ etl/build_loadfactor.py สร้างไว้
 * (app/public/data/<dataset>/loadfactor/) — ใช้กับแท็บ "ต้นทุนที่จมกับที่ว่าง" ของ Executive Dashboard
 *
 * ชุดนี้อิสระจาก costrev/ (คนละไฟล์ต้นทาง คนละคีย์) เลือกชุดข้อมูลเองเหมือน useDebtors:
 * มี data/real/loadfactor/manifest.json ที่เป็น json จริง = real ไม่งั้น sample
 * (★ Vite dev ตอบ 200 + text/html ให้ทุก path ที่ไม่มีไฟล์ ต้องดู content-type ไม่ใช่แค่ status)
 *
 * trips.json เก็บเป็นคอลัมน์ (array ต่อฟิลด์) แปลงเป็นระเบียนที่นี่ครั้งเดียว และคิดค่าที่ทุกส่วนใช้ซ้ำ
 * (idle · recoverable · profit) ตอนโหลด — สูตรตามเอกสาร lf_executive_dashboard.html ข้อแก้ 6 จุด
 */
import { useCallback, useEffect, useState } from "react";

export type LfDataset = "sample" | "real";

/** 1 ระเบียน = 1 เที่ยว (คีย์สั้นตรงกับ COLS ใน etl/build_loadfactor.py) */
export interface LfTrip {
  /** เลขที่ใบรายการ (สตริง) */
  id: string;
  y: number;
  /** "YYYY-MM" */
  mo: string;
  /** ประเภทรถ — รถบริษัท / รถร่วม */
  ft: string;
  /** ทะเบียนรถ */
  pl: string;
  /** ชนิดรถ · เส้นทางมาตรฐาน */
  vk: string; rt: string;
  /** สถานะข้อมูล — ปกติ / เฝ้าระวัง (ETL ตัดสถานะอื่นทิ้งแล้ว) */
  st: string;
  /** Max LF (สัดส่วน 0–1.3) · เป้าของกลุ่ม (สัดส่วน) */
  lf: number; tg: number;
  /** ข้อจำกัดหลัก — ปริมาตร / น้ำหนัก */
  bind: string;
  /** ต้นทุนรวมของเที่ยว · รายได้ (บาท) */
  cost: number; rev: number;
  /**
   * ระยะทาง (กม.) · น้ำหนักจริง (**ตัน**) · ต้นทุนผันแปร VC (บาท) — ใช้คิดกำไรส่วนเกิน/ตัน-กม. (lib/tonkm/calc.ts)
   * null = ไฟล์ที่ ETL อ่านไม่มีคอลัมน์นั้น (trips.json สร้างก่อน 23 ก.ย. 2569) ไม่ใช่ศูนย์
   */
  km: number | null; wt: number | null; vc: number | null;
  /* ---- คิดตอนโหลด ---- */
  /** Idle Cost = ต้นทุนรวม × MAX(0, 1 − LF) — ไม่ติดลบ */
  idle: number;
  /** Recoverable Cost = ต้นทุนรวม × MAX(0, เป้า − LF) */
  recov: number;
  /** กำไร = รายได้ − ต้นทุนรวม */
  profit: number;
}

interface TripColumns {
  id: string[]; y: number[]; mo: string[]; ft: string[]; pl: string[]; vk: string[]; rt: string[];
  st: string[]; lf: number[]; tg: number[]; bind: string[]; cost: number[]; rev: number[];
  /** ไฟล์รุ่นก่อน 23 ก.ย. 2569 ไม่มีสามคอลัมน์นี้เลย · มีคอลัมน์แต่ไฟล์ต้นทางไม่มี = ค่า null ทุกแถว */
  km?: (number | null)[]; wt?: (number | null)[]; vc?: (number | null)[];
}

export interface LfManifest {
  dataset: LfDataset;
  isSample: boolean;
  generatedAt: string;
  sourceFiles: string[];
  rows: number;
  duplicates: number;
  dropped: Record<string, number>;
  years: number[];
  months: string[];
  dateRange: { min: string; max: string };
  vehicleKinds: number;
  routes: number;
  /** ยอดรวมทั้งชุดที่ ETL คิดด้วยสูตรเดียวกัน — หน้าเว็บตอนไม่กรองต้องได้เท่านี้ */
  check: {
    cost: number; idle: number; idleShare: number | null; recoverable: number; belowTarget: number;
    avgLf: number; avgTarget: number; breakEven: number | null;
    /** กำไรส่วนเกิน/ตัน-กม. ทั้งชุด — null/ไม่มี = ไฟล์ไม่มีคอลัมน์ระยะทาง/น้ำหนักจริง/VC */
    tonKm?: { trips: number; noWeight: number; contribution: number; tonKm: number; rate: number | null } | null;
  };
}

export interface LfData { manifest: LfManifest; trips: LfTrip[] }

/** สูตรกลางของแท็บ — ETL ใช้ชุดเดียวกันทำค่าตรวจสอบใน manifest.check */
export const idleOf = (cost: number, lf: number): number => cost * Math.max(0, 1 - lf);
export const recovOf = (cost: number, lf: number, tg: number): number => cost * Math.max(0, tg - lf);

const BASE = import.meta.env.BASE_URL;
const FORCED = import.meta.env.VITE_DATASET as LfDataset | undefined;
const url = (ds: LfDataset, f: string) => `${BASE}data/${ds}/loadfactor/${f}`;

let resolved: LfDataset | null = FORCED ?? null;

async function detect(): Promise<LfDataset> {
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

export const resetLfDataset = (): void => { if (!FORCED) resolved = null; };

async function fetchJson<T>(ds: LfDataset, f: string): Promise<T> {
  const res = await fetch(url(ds, f), { cache: "no-store" });
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (!res.ok || !isJson) throw new Error(`โหลด loadfactor/${f} ไม่ได้ (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

function toRows(c: TripColumns): LfTrip[] {
  const out: LfTrip[] = [];
  for (let i = 0; i < c.id.length; i++) {
    const lf = c.lf[i] ?? 0, tg = c.tg[i] ?? 0, cost = c.cost[i] ?? 0, rev = c.rev[i] ?? 0;
    out.push({
      id: c.id[i] ?? "", y: c.y[i] ?? 0, mo: c.mo[i] ?? "", ft: c.ft[i] ?? "", pl: c.pl[i] ?? "",
      vk: c.vk[i] ?? "", rt: c.rt[i] ?? "", st: c.st[i] ?? "", lf, tg, bind: c.bind[i] ?? "", cost, rev,
      km: c.km?.[i] ?? null, wt: c.wt?.[i] ?? null, vc: c.vc?.[i] ?? null,
      idle: idleOf(cost, lf), recov: recovOf(cost, lf, tg), profit: rev - cost,
    });
  }
  return out;
}

let cache: Promise<LfData> | null = null;

export async function loadLoadFactor(): Promise<LfData> {
  cache ??= (async () => {
    const ds = await detect();
    const [manifest, columns] = await Promise.all([
      fetchJson<LfManifest>(ds, "manifest.json"),
      fetchJson<TripColumns>(ds, "trips.json"),
    ]);
    return { manifest, trips: toRows(columns) };
  })().catch((e) => { cache = null; throw e; });
  return cache;
}

export interface LfState {
  data: LfData | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useLoadFactor(): LfState {
  const [data, setData] = useState<LfData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => { cache = null; resetLfDataset(); setTick((t) => t + 1); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loadLoadFactor()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  return { data, error, loading, reload };
}
