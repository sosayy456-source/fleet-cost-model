/**
 * โหลดชุดข้อมูล "ต้นทุน+รายได้รายเที่ยว" ที่ etl/build_costrev.py สร้างไว้
 * (app/public/data/<dataset>/costrev/) — ใช้กับเมนู Executive Dashboard และ Dashboard รวม
 *
 * เลือกชุดข้อมูลแยกจากแดชบอร์ดรายได้: มี data/real/costrev/manifest.json ที่เป็น json จริง = real
 * ไม่งั้น sample — เพราะไฟล์ต้นทุนจริงกับไฟล์รายได้จริงอาจถูกวางคนละเวลากัน
 * (★ Vite dev ตอบ 200 + text/html ให้ทุก path ที่ไม่มีไฟล์ ต้องดู content-type)
 *
 * trips.json เก็บ 1 แถว = 1 เที่ยว คีย์สั้น ๆ เพื่อให้ไฟล์เล็ก — ความหมายอยู่ใน interface Trip
 */
import { useCallback, useEffect, useState } from "react";

export type CostRevDataset = "sample" | "real";

export interface Trip {
  /** เลขที่ใบรายการ 13 หลัก (สตริง ห้ามแปลงเป็นตัวเลข) */
  id: string;
  /** วันที่ปล่อยรถ ISO · เดือน YYYY-MM · ปี ค.ศ. */
  d: string; mo: string; y: number;
  br: string;
  /** ประเภทใบรายการ (ของย่อย / ของเหมา / ของเหมาตีเปล่า …) */
  t: string;
  /** ประเภทรถ (รถบริษัท / รถร่วม / รถร่วมนอกพิเศษ) · ชนิดรถ · ทะเบียน */
  ft: string; vk: string; pl: string;
  /** จุดขึ้น · จุดลง · "จุดขึ้น-จุดลง" · ขาขึ้น/ขาล่อง */
  o: string; de: string; rt: string; dir: string;
  /** ระยะทางจาก routes.json — null ถ้าจับคู่เส้นทางไม่ได้ */
  km: number | null;
  rev: number; cost: number; profit: number;
  /**
   * เที่ยววิ่งเปล่า = ราคารวมจากรายได้ = 0 และ ค่าบรรทุกทั้งใบรายการ = 0 (ไม่จำกัดประเภทใบรายการ)
   * ETL อ่านสองคอลัมน์แยกกัน — ห้ามใช้ rev === 0 แทน (ดู docs/spec-เที่ยววิ่งเปล่า.md)
   */
  empty: boolean;
  /** ธง "เป็นบิลเคลียร์" จากไฟล์ต้นทุน — ไม่ใช่มูลค่า และไม่ตรงกับ clrN เสมอไป (ดู clrAmt) */
  clear: boolean;
  /**
   * มูลค่าบิลเคลียร์ของใบนี้ = Σ ราคารวมของบิลที่ประเภทสินค้า = "บิลเคลียร์" ในไฟล์รายได้
   * (นิยามเดียวกับ CLEARED_GOODS/adminWriteOff ใน lib/cost/recCost.ts) · clrN = จำนวนรายการ
   * มีค่าเฉพาะใบที่ m = true เท่านั้น เพราะมูลค่ามาจากฝั่งรายได้
   */
  clrAmt: number; clrN: number;
  /** เลขที่ใบรายการตรงกับข้อมูลรายได้จริง — Executive Dashboard ใช้เฉพาะแถวที่ m = true */
  m: boolean;
  /**
   * จำนวนบิลทั้งหมดของใบนั้นในไฟล์รายได้ (รวมบิลที่ชำระแล้วและบิลเคลียร์)
   * กับรหัสผู้จ่ายเงินไม่ซ้ำของใบนั้น = "ลูกค้า" (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ
   * กติกาเดียวกับหน้ากำไรลูกค้า · บิลเคลียร์ไม่นับเป็นลูกค้า) — มีค่าเฉพาะเที่ยวที่ m = true
   * หน้า Demo ใช้เป็นตัวหารของ กำไร/บิล และ กำไร/ลูกค้า · ไฟล์รุ่นก่อน 21 ก.ย. 2569 ไม่มีสองคีย์นี้
   */
  bn: number; cus: string[];
  /** กลุ่มต้นทุน (ยอดที่คำนวณต่อได้ดู helpers ด้านล่าง) */
  waste: number; fuel: number; allow: number; fee: number; repair: number; dep: number; rent: number;
  f_cash: number; f_down: number; f_up: number; f_pickup: number; f_call: number;
  /** เบี้ยเลี้ยง พขร. · สำรอง · นอกเส้นทาง (ตัวหลังเคยนับเป็นสูญเปล่า — เอกสารฉบับแก้ 16 ก.ย. 2569 ย้ายมาที่นี่) */
  a_drv: number; a_spare: number; a_off: number;
  /** กลุ่มบริการ = ประเภทสินค้าที่พบมากสุดในบิลรายได้ของใบนั้น · "" ถ้าจับคู่ไม่ได้ */
  sg: string;
  /** รายได้แยกกลุ่มบริการจากบิลรายได้ ไม่รวมบิลเคลียร์; ไม่มีฟิลด์นี้เมื่อเป็นข้อมูลรุ่นเก่า */
  serviceRevenue?: Record<string, number>;
  /**
   * รถทุกคันของใบนี้พร้อมต้นทุนของแต่ละคัน (ไฟล์ต้นทุนรุ่น 22 ก.ย. 2569 — ใบหนึ่งมีได้ถึง 3 ทะเบียน:
   * คันที่ 1 · คันที่ 2 (ค่าเช่า) · พ่วง) Σ c = cost เสมอ · pl/vk/ft ระดับใบยังเป็นของคันที่ 1 เหมือนเดิม
   * ไฟล์รุ่นเก่าไม่มีฟิลด์นี้ — แท็บกองรถถอยไปนับทะเบียนเดียวต่อใบ (lib/fleetcompare/utilization.ts)
   */
  vs?: TripVehicle[];
  fe_tarp: number; fe_police: number; fe_insure: number; fe_cont: number; fe_port: number; fe_doc: number; fe_toll: number;
}

/** รถหนึ่งคันในใบรายการ — ต้นทุนของคันนั้นตามที่ไฟล์ปันมาให้ */
export interface TripVehicle {
  pl: string; vk: string; ft: string;
  /** ต้นทุนของคันนี้ (บาท) */
  c: number;
}

export interface CostRevManifest {
  dataset: CostRevDataset;
  isSample: boolean;
  generatedAt: string;
  costFiles: string[];
  revenueFiles: number;
  rows: number;
  matched: number;
  /** จำนวนแถวในไฟล์รายได้ที่อ่านทั้งหมด · ใบรายการที่ตรงกับไฟล์ต้นทุน */
  revenueRows: number;
  matchedDocs: number;
  dateRange: { min: string; max: string };
  years: number[];
  routeDistance: { routes: number; matched: number; tripsWithKm: number; pct: number };
  skipped: { noDoc: number; noDate: number };
  /** คำอธิบายนิยามเที่ยววิ่งเปล่า (ไฟล์รุ่นก่อน 17 ก.ย. 2569 มี emptyTypes แทน) */
  emptyRule?: string;
  debtorBills: number;
  /** บิลที่ชำระแล้ว ไม่ได้เขียนลงไฟล์ เก็บแค่ยอดรวม */
  debtorPaid?: { bills: number; total: number };
  /** สรุปบิลเคลียร์เฉพาะเที่ยวที่จับคู่ได้ — ไฟล์รุ่นก่อนแท็บ Damage Rate ไม่มีคีย์นี้ */
  clear?: { trips: number; bills: number; amount: number };
}

export interface CostRevData {
  manifest: CostRevManifest;
  trips: Trip[];
}

/* ---------- ยอดที่คำนวณต่อจากกลุ่มต้นทุน (นิยามตามเอกสารจัดประเภทต้นทุน) ---------- */
/** ต้นทุนปกติ = ต้นทุนทั้งหมด − สูญเปล่า */
export const normalOf = (t: Trip): number => t.cost - t.waste;
/** ต้นทุนผันแปร = น้ำมัน + เบี้ยเลี้ยง + ค่าธรรมเนียม (ค่าซ่อมแยกไปกึ่งผันแปร — ฉบับแก้ 16 ก.ย. 2569) */
export const variableOf = (t: Trip): number => t.fuel + t.allow + t.fee;
/** ต้นทุนคงที่กึ่งผันแปร = ค่าซ่อมรถ (มีทั้งส่วนคงที่ตามเวลาและผันแปรตามระยะทาง — การแยก FC/VC เป็นของทีมค่าซ่อม) */
export const semiOf = (t: Trip): number => t.repair;
/** ต้นทุนคงที่ = ค่าเสื่อม */
export const fixedOf = (t: Trip): number => t.dep;
/** ที่เหลือที่ไม่เข้ากลุ่มไหน (แก๊ส, Fleet Card เดินทาง, เพิ่มย้อนหลัง, SND) และค่าเช่า */
export const otherOf = (t: Trip): number => normalOf(t) - variableOf(t) - semiOf(t) - fixedOf(t) - t.rent;

const BASE = import.meta.env.BASE_URL;
const FORCED = import.meta.env.VITE_DATASET as CostRevDataset | undefined;

const url = (ds: CostRevDataset, f: string) => `${BASE}data/${ds}/costrev/${f}`;

let resolved: CostRevDataset | null = FORCED ?? null;

async function detect(): Promise<CostRevDataset> {
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

export const resetCostRevDataset = (): void => { if (!FORCED) resolved = null; };

async function fetchJson<T>(ds: CostRevDataset, f: string): Promise<T> {
  const res = await fetch(url(ds, f), { cache: "no-store" });
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (!res.ok || !isJson) throw new Error(`โหลด costrev/${f} ไม่ได้ (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

let cache: Promise<CostRevData> | null = null;

export async function loadCostRev(): Promise<CostRevData> {
  cache ??= (async () => {
    const ds = await detect();
    const [manifest, trips] = await Promise.all([
      fetchJson<CostRevManifest>(ds, "manifest.json"),
      fetchJson<Trip[]>(ds, "trips.json"),
    ]);
    return { manifest, trips };
  })().catch((e) => { cache = null; throw e; });
  return cache;
}

/**
 * แถว "ข้อมูลเก่า" สำหรับหน้ารายการทั้งหมดและหน้าลูกหนี้ — เที่ยวที่จับคู่กับข้อมูลรายได้จริงได้
 * แยกจาก loadCostRev เพราะหน้าพวกนั้นไม่ต้องใช้ trips.json ทั้งก้อน
 * คืนค่าว่างถ้าไม่มีไฟล์ (เช่นยังไม่รัน ETL) ไม่โยน error — หน้าเดิมต้องเปิดได้เสมอ
 */
export async function loadCostRevOld(): Promise<{ records: unknown[]; debtors: unknown[] }> {
  try {
    const ds = await detect();
    const [records, debtors] = await Promise.all([
      fetchJson<unknown[]>(ds, "old_records.json"),
      fetchJson<unknown[]>(ds, "old_debtors.json"),
    ]);
    return { records, debtors };
  } catch {
    return { records: [], debtors: [] };
  }
}

export interface CostRevState {
  data: CostRevData | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useCostRev(): CostRevState {
  const [data, setData] = useState<CostRevData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => { cache = null; resetCostRevDataset(); setTick((t) => t + 1); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loadCostRev()
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => { if (alive) { setError((e as Error).message); setLoading(false); } });
    return () => { alive = false; };
  }, [tick]);

  return { data, error, loading, reload };
}
