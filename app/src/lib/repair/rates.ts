/**
 * คำนวณอัตราค่าซ่อมแซม (POR) จากข้อมูลดิบ 3 ตาราง — ตามเอกสาร "ค่าซ่อม.pdf"
 *
 *   ตารางที่ 1  ค่าซ่อมดิบ        ชื่อบัญชี · รายละเอียดการซ่อม · ชนิดรถ · จำนวนเงิน · วันที่ซ่อม
 *   ตารางที่ 2  ข้อมูลการปฏิบัติงาน  ปี · ชนิดรถ · ประเภทรถ · ระยะทางรวม · จำนวนวันรวม
 *   ตารางที่ 3  น้ำหนักถ่วงรายปี    ปี · น้ำหนัก
 *
 * ลำดับการทำงาน
 *   1. จัดประเภทค่าใช้จ่ายทีละบรรทัด เป็น "ระยะเวลา" หรือ "ระยะทาง" (classifyRow)
 *   2. ยุบรวมเป็นก้อนต้นทุนตาม ปี × ชนิดรถ × ประเภทค่าใช้จ่าย
 *   3. หารด้วยตัวหารจากตารางที่ 2 → อัตราจริงรายปี
 *   4. ถ่วงน้ำหนักด้วยตารางที่ 3 → POR (ตารางในแอปถ่วงน้ำหนักให้เองอยู่แล้ว
 *      จึงเก็บ "อัตรารายปี" ลงตาราง ไม่ใช่ POR ที่ถ่วงเสร็จแล้ว)
 *
 * ★ เอกสารให้ Group By แค่ [ปี, ชนิดรถ] แต่ตารางในแอปแยกอัตราตามเวลาเป็นรถบริษัท
 *   กับรถร่วม ส่วนก้อนต้นทุนไม่มีคอลัมน์ประเภทรถให้แยก จึงกระจายก้อนเดียวกันตาม
 *   สัดส่วนตัวหารของแต่ละประเภท ซึ่งได้อัตราเท่ากันทั้งสองประเภทโดยธรรมชาติ
 *   (ก้อน ÷ ผลรวมตัวหาร) — ตรงกับผลลัพธ์ Step 5 ที่คีย์ด้วยชนิดรถอย่างเดียว
 */
import { findCol, parseDelimited, toBEYear, toNumber, toWeight } from "./parse";

export type CostDriver = "ระยะเวลา" | "ระยะทาง";

/** ชื่อบัญชีที่ถือเป็นการตัดจำหน่ายสินทรัพย์ — ตัดเป็น 8 งวด */
export const AMORTIZE_ACCOUNT = "สินทรัพย์รอตัดบัญชี";
export const AMORTIZE_DIVISOR = 8;

/** รายละเอียดการซ่อมที่ถือเป็นค่าใช้จ่ายคงที่ตามเวลา ไม่ใช่ตามระยะทาง */
export const TIME_KEYWORDS = [
  "ค่าเบี้ยประกันภัย พ.ร.บ",
  "ค่าเบี้ยประกันภัยภาคสมัครใจ",
  "ค่าตรวจสภาพรถนอกสถานที่",
  "ค่าต่อภาษี",
  "ค่าบริการ GPS",
  "ค่าบริการบำรุงรักษา",
  "ค่าบริการตรวจเช็ค 68 จุด",
  "ค่าบำรุงรักษายาง",
] as const;

/** ตัดจุดและช่องว่างทิ้งก่อนเทียบ เพราะ "พ.ร.บ" กับ "พรบ" ต้องถือว่าตรงกัน */
const loose = (s: string): string => s.toLowerCase().replace(/[\s.·]/g, "");

export interface MaintRow {
  year: number;
  vehicle: string;
  account: string;
  detail: string;
  amount: number;
}

export interface OpRow {
  year: number;
  vehicle: string;
  fleet: string;
  km: number;
  days: number;
}

export interface WeightRow {
  year: number;
  weight: number;
}

/**
 * จัดประเภทค่าใช้จ่ายหนึ่งบรรทัด — เงื่อนไขเรียงตามลำดับความสำคัญ ห้ามสลับ
 *
 * เอกสารเรียกกลุ่มแรกว่า "ตัดจำหน่าย" ในตาราง keyword แต่รหัสเทียมกำหนดให้
 * Cost_Driver = "ระยะเวลา" — ยึดตามรหัสเทียมเพราะเป็นตัวที่บอกผลลัพธ์จริง
 * ที่ต่างจากกลุ่มอื่นคือยอดเงินถูกหาร 8 ก่อน
 */
export function classifyRow(row: Pick<MaintRow, "account" | "detail" | "amount">): {
  driver: CostDriver;
  amount: number;
  amortized: boolean;
} {
  if (loose(row.account).includes(loose(AMORTIZE_ACCOUNT))) {
    return { driver: "ระยะเวลา", amount: row.amount / AMORTIZE_DIVISOR, amortized: true };
  }
  const detail = loose(row.detail);
  if (TIME_KEYWORDS.some((k) => detail.includes(loose(k)))) {
    return { driver: "ระยะเวลา", amount: row.amount, amortized: false };
  }
  return { driver: "ระยะทาง", amount: row.amount, amortized: false };
}

/** ชนิดรถที่เป็นหางเทรลเลอร์ — ค่าซ่อมต้องยุบไปรวมกับหัวลาก */
const TRAILER_RE = /หางเทร[ลเ]?[ลอ]?เ?[รอ]?/;
/** ชื่อหัวลากในตารางของแอป (ที่ vehicles.json ชี้มา) */
export const TRACTOR_KEY = "รถเทรเล่อร์ (แม่)";

export const isTrailerTail = (vehicle: string): boolean => TRAILER_RE.test(vehicle.replace(/\s/g, ""));

export interface RatesOptions {
  /**
   * ยุบค่าซ่อมของหางเทรลเลอร์เข้ากับหัวลาก (Step 2 ของเอกสาร)
   * ควรเปิดไว้ เพราะ vehicles.json ชี้ "รถเทรเลอร์" มาที่หัวลากอย่างเดียว
   * แถวของหางจึงไม่เคยถูกใช้คำนวณเลย ถ้าไม่ยุบ ค่าซ่อมส่วนนั้นจะหายไปทั้งก้อน
   */
  mergeTrailer?: boolean;
}

export interface VehicleRates {
  vehicle: string;
  /** อัตราตามเวลา (บาท/วัน) รายปี พ.ศ. */
  time: Record<number, number>;
  /** อัตราตามระยะทาง (บาท/กม.) รายปี พ.ศ. */
  dist: Record<number, number>;
  /** ประเภทรถที่พบในตารางการปฏิบัติงาน — ใช้ตัดสินว่าจะเขียนลงแท็บไหน */
  fleets: string[];
}

export interface RatesResult {
  years: number[];
  vehicles: VehicleRates[];
  weights: Record<number, number>;
  /** ยอดที่ถูกยุบจากหางเข้าหัวลาก แยกตามปี — ไว้โชว์ให้ผู้ใช้ตรวจ */
  mergedTrailer: Record<number, number>;
  warnings: string[];
}

/**
 * กุญแจของก้อนต้นทุน = ปี + ชนิดรถ
 * ★ ห้ามคั่นด้วยช่องว่าง — ชื่อชนิดรถมีช่องว่างอยู่ข้างใน ("รถ 6 ล้อใหญ่")
 *   ปีเป็นตัวเลขล้วน ตัวคั่นตัวแรกจึงเป็นจุดแบ่งที่ถูกต้องเสมอ
 */
const poolKey = (year: number, vehicle: string): string => `${year}|${vehicle}`;
const vehicleOf = (key: string): string => key.slice(key.indexOf("|") + 1);

export function computeRates(
  maint: MaintRow[],
  ops: OpRow[],
  weights: WeightRow[] = [],
  opts: RatesOptions = {},
): RatesResult {
  const { mergeTrailer = true } = opts;
  const warnings: string[] = [];

  // ── Step 2-3: จัดประเภทแล้วยุบเป็นก้อน ────────────────────────────────
  const timePool = new Map<string, number>();
  const distPool = new Map<string, number>();
  const mergedTrailer: Record<number, number> = {};
  const years = new Set<number>();
  const seenVehicles = new Set<string>();

  for (const row of maint) {
    if (!row.vehicle || !row.year) continue;
    const vehicle = mergeTrailer && isTrailerTail(row.vehicle) ? TRACTOR_KEY : row.vehicle;
    if (vehicle !== row.vehicle) {
      mergedTrailer[row.year] = (mergedTrailer[row.year] ?? 0) + row.amount;
    }

    const { driver, amount } = classifyRow(row);
    const key = poolKey(row.year, vehicle);
    const pool = driver === "ระยะเวลา" ? timePool : distPool;
    pool.set(key, (pool.get(key) ?? 0) + amount);

    years.add(row.year);
    seenVehicles.add(vehicle);
  }

  // ── ตัวหารจากตารางที่ 2 — รวมทุกประเภทรถของชนิดเดียวกันเข้าด้วยกัน ─────
  const divisor = new Map<string, { km: number; days: number; fleets: Set<string> }>();
  for (const o of ops) {
    if (!o.vehicle || !o.year) continue;
    const vehicle = mergeTrailer && isTrailerTail(o.vehicle) ? TRACTOR_KEY : o.vehicle;
    const key = poolKey(o.year, vehicle);
    const cur = divisor.get(key) ?? { km: 0, days: 0, fleets: new Set<string>() };
    cur.km += o.km;
    cur.days += o.days;
    if (o.fleet) cur.fleets.add(o.fleet);
    divisor.set(key, cur);
    years.add(o.year);
  }

  // ── Step 4: อัตราจริงรายปี ────────────────────────────────────────────
  const yearList = [...years].sort((a, b) => a - b);
  const byVehicle = new Map<string, VehicleRates>();

  const ensure = (vehicle: string): VehicleRates => {
    let v = byVehicle.get(vehicle);
    if (!v) { v = { vehicle, time: {}, dist: {}, fleets: [] }; byVehicle.set(vehicle, v); }
    return v;
  };

  for (const vehicle of seenVehicles) {
    const v = ensure(vehicle);
    for (const year of yearList) {
      const key = poolKey(year, vehicle);
      const timeSum = timePool.get(key) ?? 0;
      const distSum = distPool.get(key) ?? 0;
      const div = divisor.get(key);

      if (!div) {
        if (timeSum || distSum) {
          warnings.push(`${vehicle} · พ.ศ. ${year}: มีค่าซ่อมแต่ไม่มีข้อมูลการปฏิบัติงาน — ข้ามปีนี้`);
        }
        continue;
      }

      for (const f of div.fleets) if (!v.fleets.includes(f)) v.fleets.push(f);

      if (timeSum) {
        if (div.days > 0) v.time[year] = timeSum / div.days;
        else warnings.push(`${vehicle} · พ.ศ. ${year}: จำนวนวันรวมเป็น 0 — คิดอัตราตามเวลาไม่ได้`);
      }
      if (distSum) {
        if (div.km > 0) v.dist[year] = distSum / div.km;
        else warnings.push(`${vehicle} · พ.ศ. ${year}: ระยะทางรวมเป็น 0 — คิดอัตราตามระยะทางไม่ได้`);
      }
    }
  }

  // ชนิดรถที่มีในตารางปฏิบัติงานแต่ไม่มีค่าซ่อมเลย ไม่ใช่ความผิดพลาด แค่บอกให้รู้
  for (const [key, div] of divisor) {
    const vehicle = vehicleOf(key);
    if (!seenVehicles.has(vehicle) && (div.km || div.days)) {
      warnings.push(`${vehicle}: มีข้อมูลการปฏิบัติงานแต่ไม่มีรายการค่าซ่อม — อัตราเป็น 0`);
    }
  }

  const weightMap: Record<number, number> = {};
  for (const w of weights) if (w.year) weightMap[w.year] = w.weight;

  return {
    years: yearList,
    vehicles: [...byVehicle.values()].sort((a, b) => a.vehicle.localeCompare(b.vehicle, "th")),
    weights: weightMap,
    mergedTrailer,
    warnings,
  };
}

// ───────────────────────── ตัวอ่านตารางแต่ละชุด ─────────────────────────

export interface ParsedTable<T> {
  rows: T[];
  /** หัวคอลัมน์ที่หาไม่เจอ — ถ้ามีแปลว่ายังใช้ไม่ได้ */
  missing: string[];
  warnings: string[];
}

const HEAD_MAINT = {
  vehicle: ["ชนิดรถ", "ประเภทรถ"],
  amount: ["จำนวนเงิน", "ยอดเงิน", "จำนวนเงินบาท"],
  account: ["ชื่อบัญชี", "บัญชี"],
  detail: ["รายละเอียดการซ่อม", "รายละเอียด"],
  year: ["ปี"],
  date: ["วันที่ซ่อม", "วันที่"],
};

export function parseMaintenance(text: string): ParsedTable<MaintRow> {
  const table = parseDelimited(text);
  if (table.length < 2) return { rows: [], missing: ["ไม่มีข้อมูล"], warnings: [] };

  const head = table[0]!;
  const iVeh = findCol(head, HEAD_MAINT.vehicle);
  const iAmt = findCol(head, HEAD_MAINT.amount);
  const iAcc = findCol(head, HEAD_MAINT.account);
  const iDet = findCol(head, HEAD_MAINT.detail);
  const iYear = findCol(head, HEAD_MAINT.year);
  const iDate = findCol(head, HEAD_MAINT.date);

  const missing: string[] = [];
  if (iVeh < 0) missing.push("ชนิดรถ");
  if (iAmt < 0) missing.push("จำนวนเงิน");
  if (iYear < 0 && iDate < 0) missing.push("ปี หรือ วันที่ซ่อม");
  if (missing.length) return { rows: [], missing, warnings: [] };

  const warnings: string[] = [];
  if (iAcc < 0) warnings.push("ไม่มีคอลัมน์ “ชื่อบัญชี” — จะไม่มีรายการไหนถูกนับเป็นการตัดจำหน่าย");
  if (iDet < 0) warnings.push("ไม่มีคอลัมน์ “รายละเอียดการซ่อม” — ทุกรายการจะถูกคิดเป็นค่าซ่อมตามระยะทาง");

  const rows: MaintRow[] = [];
  let noYear = 0;
  for (const r of table.slice(1)) {
    const year = toBEYear(iYear >= 0 ? r[iYear] : r[iDate]) ?? toBEYear(iDate >= 0 ? r[iDate] : undefined);
    const vehicle = r[iVeh] ?? "";
    if (!vehicle) continue;
    if (!year) { noYear++; continue; }
    rows.push({
      year,
      vehicle,
      account: iAcc >= 0 ? (r[iAcc] ?? "") : "",
      detail: iDet >= 0 ? (r[iDet] ?? "") : "",
      amount: toNumber(r[iAmt]),
    });
  }
  if (noYear) warnings.push(`อ่านปีไม่ได้ ${noYear} บรรทัด — ข้ามไป`);

  return { rows, missing: [], warnings };
}

const HEAD_OP = {
  year: ["ปี"],
  vehicle: ["ชนิดรถ"],
  fleet: ["ประเภทรถ", "ประเภท"],
  km: ["ระยะทางรวม", "ระยะทางวิ่งรวม", "ระยะทาง"],
  days: ["จำนวนวันรวม", "จำนวนวันทำงานรวม", "จำนวนวัน", "วัน"],
};

export function parseOperations(text: string): ParsedTable<OpRow> {
  const table = parseDelimited(text);
  if (table.length < 2) return { rows: [], missing: ["ไม่มีข้อมูล"], warnings: [] };

  const head = table[0]!;
  const iYear = findCol(head, HEAD_OP.year);
  const iVeh = findCol(head, HEAD_OP.vehicle);
  const iFleet = findCol(head, HEAD_OP.fleet);
  const iKm = findCol(head, HEAD_OP.km);
  const iDays = findCol(head, HEAD_OP.days);

  const missing: string[] = [];
  if (iYear < 0) missing.push("ปี");
  if (iVeh < 0) missing.push("ชนิดรถ");
  if (iKm < 0) missing.push("ระยะทางรวม");
  if (iDays < 0) missing.push("จำนวนวันรวม");
  if (missing.length) return { rows: [], missing, warnings: [] };

  const warnings: string[] = [];
  if (iFleet < 0) warnings.push("ไม่มีคอลัมน์ “ประเภทรถ” — จะลงอัตราให้ทั้งรถบริษัทและรถร่วม");

  const rows: OpRow[] = [];
  for (const r of table.slice(1)) {
    const year = toBEYear(r[iYear]);
    const vehicle = r[iVeh] ?? "";
    if (!year || !vehicle) continue;
    rows.push({
      year,
      vehicle,
      fleet: iFleet >= 0 ? (r[iFleet] ?? "") : "",
      km: toNumber(r[iKm]),
      days: toNumber(r[iDays]),
    });
  }
  return { rows, missing: [], warnings };
}

export function parseWeights(text: string): ParsedTable<WeightRow> {
  const table = parseDelimited(text);
  if (table.length < 2) return { rows: [], missing: ["ไม่มีข้อมูล"], warnings: [] };

  const head = table[0]!;
  const iYear = findCol(head, ["ปี", "ปีพ.ศ.", "year"]);
  const iW = findCol(head, ["น้ำหนัก", "weight", "por"]);

  const missing: string[] = [];
  if (iYear < 0) missing.push("ปี");
  if (iW < 0) missing.push("น้ำหนัก");
  if (missing.length) return { rows: [], missing, warnings: [] };

  const rows: WeightRow[] = [];
  for (const r of table.slice(1)) {
    const year = toBEYear(r[iYear]);
    if (!year) continue;
    rows.push({ year, weight: toWeight(r[iW]) });
  }

  const sum = rows.reduce((s, r) => s + r.weight, 0);
  const warnings = rows.length && Math.abs(sum - 1) > 1e-6
    ? [`น้ำหนักรวมได้ ${sum.toFixed(2)} ไม่ใช่ 1.00 — ตรวจอีกครั้งก่อนนำไปใช้`]
    : [];

  return { rows, missing: [], warnings };
}
