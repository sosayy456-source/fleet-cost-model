/**
 * คำนวณอัตราค่าซ่อมแซม (POR) จากข้อมูลดิบ 3 ตาราง — ตามเอกสาร "ค่าซ่อม.pdf"
 *
 *   ตารางที่ 1  ค่าซ่อมดิบ         รายงานค่าซ่อมตามงวด — ใช้ วันที่ตามงวด · ประเภทรถ ·
 *                                 ชนิดรถ · รายละเอียดการซ่อม · ชื่อบัญชี · จำนวนเงิน
 *   ตารางที่ 2  ข้อมูลการปฏิบัติงาน  ปี · ชนิดรถ · ประเภทรถ · ระยะทางรวม · จำนวนวันรวม
 *   ตารางที่ 3  น้ำหนักถ่วงรายปี     ปี · น้ำหนัก
 *
 * ลำดับการทำงาน
 *   1. จัดประเภทค่าใช้จ่ายทีละบรรทัด เป็น "ระยะเวลา" หรือ "ระยะทาง" (classifyRow)
 *   2. ยุบรวมเป็นก้อนต้นทุน แล้วหารด้วยตัวหารจากตารางที่ 2 → อัตราจริงรายปี
 *   3. ถ่วงน้ำหนักด้วยตารางที่ 3 → POR (ตารางในแอปถ่วงน้ำหนักให้เองอยู่แล้ว
 *      จึงเก็บ "อัตรารายปี" ลงตาราง ไม่ใช่ POR ที่ถ่วงเสร็จแล้ว)
 *
 * ★ ระดับการยุบก้อนต้นทุนไม่เท่ากันสองฐาน เพราะตารางในแอปเก็บไม่เหมือนกัน
 *
 *     ตามเวลา     ปี × ชนิดรถ × ประเภทรถ ÷ จำนวนวันของประเภทนั้น
 *                 (ตารางในแอปแยกแท็บรถบริษัทกับรถร่วม จึงต้องได้คนละอัตรา)
 *     ตามระยะทาง  ปี × ชนิดรถ (รวมทุกประเภท) ÷ ระยะทางรวมทุกประเภท
 *                 (ตารางในแอปมีแถวเดียวใช้ร่วมกันทั้งสองประเภท)
 *
 *   ถ้าไฟล์ค่าซ่อมไม่มีคอลัมน์ประเภทรถ จะยุบตามเอกสาร (ปี × ชนิดรถ) แล้วลงอัตรา
 *   เดียวกันให้ทุกประเภทที่พบในตารางการปฏิบัติงาน
 */
import { findCol, normHeader, parseDelimited, toBEYear, toNumber, toWeight } from "./parse";

export type CostDriver = "ระยะเวลา" | "ระยะทาง";

/** ชื่อบัญชีที่ถือเป็นการตัดจำหน่ายสินทรัพย์ — ตัดเป็น 8 งวด */
export const AMORTIZE_ACCOUNT = "สินทรัพย์รอตัดบัญชี";
export const AMORTIZE_DIVISOR = 8;

/** ประเภทรถที่ไฟล์ไม่ได้บอกมา — ลงอัตราให้ทุกแท็บ */
export const ANY_FLEET = "*";

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
  /** รถบริษัท / รถร่วม — ว่างได้ถ้าไฟล์ไม่มีคอลัมน์นี้ */
  fleet: string;
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

/**
 * เทียบชื่อชนิดรถแบบไม่สนช่องว่าง — ไฟล์จริงพิมพ์ "รถเทรเล่อร์(แม่)" บ้าง
 * "รถเทรเล่อร์ (แม่)" บ้าง ถ้าไม่ปรับให้ตรงกับคีย์ในตาราง อัตราที่คำนวณได้
 * จะถูกเก็บไว้ใต้ชื่อที่ไม่มีรถคันไหนเรียกใช้ = เสียเปล่าทั้งก้อน
 */
const squash = (s: string): string => s.replace(/\s/g, "");

export function canonVehicle(name: string, known: readonly string[]): string {
  const target = squash(name);
  return known.find((k) => squash(k) === target) ?? name;
}

/** ประเภทรถในไฟล์อาจมีช่องว่างแทรก — เทียบแบบไม่สนช่องว่างเช่นกัน */
export function canonFleet(name: string, known: readonly string[] = ["รถบริษัท", "รถร่วม"]): string {
  const target = squash(name);
  return known.find((k) => squash(k) === target) ?? name;
}

export interface RatesOptions {
  /**
   * ยุบค่าซ่อมของหางเทรลเลอร์เข้ากับหัวลาก (Step 2 ของเอกสาร)
   * ควรเปิดไว้ เพราะ vehicles.json ชี้ "รถเทรเลอร์" มาที่หัวลากอย่างเดียว
   * แถวของหางจึงไม่เคยถูกใช้คำนวณเลย ถ้าไม่ยุบ ค่าซ่อมส่วนนั้นจะหายไปทั้งก้อน
   */
  mergeTrailer?: boolean;
  /** ชื่อชนิดรถที่ตารางในแอปใช้ — เอาไว้ปรับชื่อจากไฟล์ให้ตรงกัน */
  knownVehicles?: readonly string[];
}

export interface VehicleRates {
  vehicle: string;
  /** อัตราตามเวลา (บาท/วัน) — ประเภทรถ → ปี พ.ศ. → อัตรา ("*" = ทุกประเภท) */
  time: Record<string, Record<number, number>>;
  /** อัตราตามระยะทาง (บาท/กม.) รายปี พ.ศ. — ใช้ร่วมกันทุกประเภทรถ */
  dist: Record<number, number>;
  /** ประเภทรถที่พบในตารางการปฏิบัติงาน */
  fleets: string[];
}

export interface RatesResult {
  years: number[];
  vehicles: VehicleRates[];
  weights: Record<number, number>;
  /** ยอดที่ถูกยุบจากหางเข้าหัวลาก แยกตามปี — ไว้โชว์ให้ผู้ใช้ตรวจ */
  mergedTrailer: Record<number, number>;
  /** ไฟล์ค่าซ่อมบอกประเภทรถมาไหม — ถ้าไม่ อัตราตามเวลาจะเหมือนกันทุกประเภท */
  fleetSplit: boolean;
  warnings: string[];
}

/**
 * กุญแจของก้อนต้นทุน — ต่อกันด้วย "|"
 * ★ ห้ามคั่นด้วยช่องว่าง ชื่อชนิดรถมีช่องว่างอยู่ข้างใน ("รถ 6 ล้อใหญ่")
 */
const key2 = (year: number, vehicle: string): string => `${year}|${vehicle}`;
const key3 = (year: number, vehicle: string, fleet: string): string => `${year}|${fleet}|${vehicle}`;
/** ชนิดรถคือส่วนหลังตัวคั่นตัวสุดท้าย — ชื่อรถไม่มี "|" อยู่ข้างใน */
const vehicleOf = (key: string): string => key.slice(key.lastIndexOf("|") + 1);

export function computeRates(
  maint: MaintRow[],
  ops: OpRow[],
  weights: WeightRow[] = [],
  opts: RatesOptions = {},
): RatesResult {
  const { mergeTrailer = true, knownVehicles = [] } = opts;
  const warnings: string[] = [];

  const fix = (name: string): string => {
    const merged = mergeTrailer && isTrailerTail(name) ? TRACTOR_KEY : name;
    return canonVehicle(merged, knownVehicles);
  };

  // ── Step 2-3: จัดประเภทแล้วยุบเป็นก้อน ────────────────────────────────
  /** ก้อนตามเวลา แยกตามประเภทรถ */
  const timePool = new Map<string, number>();
  /** ก้อนตามระยะทาง รวมทุกประเภทรถ */
  const distPool = new Map<string, number>();
  const mergedTrailer: Record<number, number> = {};
  const years = new Set<number>();
  const seenVehicles = new Set<string>();
  let fleetSplit = false;

  for (const row of maint) {
    if (!row.vehicle || !row.year) continue;
    const vehicle = fix(row.vehicle);
    if (mergeTrailer && isTrailerTail(row.vehicle)) {
      mergedTrailer[row.year] = (mergedTrailer[row.year] ?? 0) + row.amount;
    }
    const fleet = row.fleet ? canonFleet(row.fleet) : ANY_FLEET;
    if (fleet !== ANY_FLEET) fleetSplit = true;

    const { driver, amount } = classifyRow(row);
    if (driver === "ระยะเวลา") {
      const k = key3(row.year, vehicle, fleet);
      timePool.set(k, (timePool.get(k) ?? 0) + amount);
    } else {
      const k = key2(row.year, vehicle);
      distPool.set(k, (distPool.get(k) ?? 0) + amount);
    }

    years.add(row.year);
    seenVehicles.add(vehicle);
  }

  // ── ตัวหารจากตารางที่ 2 ────────────────────────────────────────────────
  /** จำนวนวันแยกตามประเภทรถ */
  const daysBy = new Map<string, number>();
  /** ระยะทางและจำนวนวันรวมทุกประเภท */
  const totalBy = new Map<string, { km: number; days: number; fleets: Set<string> }>();

  for (const o of ops) {
    if (!o.vehicle || !o.year) continue;
    const vehicle = fix(o.vehicle);
    const fleet = o.fleet ? canonFleet(o.fleet) : ANY_FLEET;

    const dk = key3(o.year, vehicle, fleet);
    daysBy.set(dk, (daysBy.get(dk) ?? 0) + o.days);

    const tk = key2(o.year, vehicle);
    const cur = totalBy.get(tk) ?? { km: 0, days: 0, fleets: new Set<string>() };
    cur.km += o.km;
    cur.days += o.days;
    if (fleet !== ANY_FLEET) cur.fleets.add(fleet);
    totalBy.set(tk, cur);
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
      const total = totalBy.get(key2(year, vehicle));
      const hasCost = [...timePool.keys()].some((k) => k.startsWith(`${year}|`) && vehicleOf(k) === vehicle)
        || distPool.has(key2(year, vehicle));

      if (!total) {
        if (hasCost) {
          warnings.push(`${vehicle} · พ.ศ. ${year}: มีค่าซ่อมแต่ไม่มีข้อมูลการปฏิบัติงาน — ข้ามปีนี้`);
        }
        continue;
      }
      for (const f of total.fleets) if (!v.fleets.includes(f)) v.fleets.push(f);

      // ── อัตราตามเวลา ────────────────────────────────────────────────
      const fleetKeys = fleetSplit ? [...total.fleets, ANY_FLEET] : [ANY_FLEET];
      for (const fleet of fleetKeys) {
        const pool = timePool.get(key3(year, vehicle, fleet));
        if (!pool) continue;
        // ประเภทที่ไฟล์ไม่ได้ระบุ ใช้ตัวหารรวมทุกประเภท
        const days = fleet === ANY_FLEET ? total.days : (daysBy.get(key3(year, vehicle, fleet)) ?? 0);
        if (days > 0) {
          (v.time[fleet] ??= {})[year] = pool / days;
        } else {
          warnings.push(
            `${vehicle}${fleet === ANY_FLEET ? "" : ` · ${fleet}`} · พ.ศ. ${year}: `
            + "จำนวนวันรวมเป็น 0 — คิดอัตราตามเวลาไม่ได้",
          );
        }
      }

      // ── อัตราตามระยะทาง (ใช้ร่วมกันทุกประเภท) ────────────────────────
      const distSum = distPool.get(key2(year, vehicle));
      if (distSum) {
        if (total.km > 0) v.dist[year] = distSum / total.km;
        else warnings.push(`${vehicle} · พ.ศ. ${year}: ระยะทางรวมเป็น 0 — คิดอัตราตามระยะทางไม่ได้`);
      }
    }
  }

  // ชนิดรถที่มีในตารางปฏิบัติงานแต่ไม่มีค่าซ่อมเลย ไม่ใช่ความผิดพลาด แค่บอกให้รู้
  for (const [k, total] of totalBy) {
    const vehicle = vehicleOf(k);
    if (!seenVehicles.has(vehicle) && (total.km || total.days)) {
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
    fleetSplit,
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
  vehicle: ["ชนิดรถ"],
  fleet: ["ประเภทรถ"],
  amount: ["จำนวนเงิน", "ยอดเงิน"],
  account: ["ชื่อบัญชี", "บัญชี"],
  detail: ["รายละเอียดการซ่อม", "รายละเอียด"],
  year: ["ปี"],
  /** เรียงตามลำดับความน่าเชื่อถือ — วันที่ตามงวดคือรอบบัญชีที่ค่าใช้จ่ายนั้นสังกัด */
  date: ["วันที่ตามงวด", "วันที่ในใบซ่อม", "วันที่ซ่อม", "วันที่"],
};

/** แถวที่เป็นหัวตารางซ้ำ (รายงานหลายหน้าพิมพ์หัวซ้ำทุกหน้า) ต้องข้าม */
const isHeaderEcho = (cell: string, aliases: string[]): boolean =>
  aliases.some((a) => normHeader(a) === normHeader(cell));

export function parseMaintenance(text: string): ParsedTable<MaintRow> {
  const table = parseDelimited(text);
  if (table.length < 2) return { rows: [], missing: ["ไม่มีข้อมูล"], warnings: [] };

  const head = table[0]!;
  const iVeh = findCol(head, HEAD_MAINT.vehicle);
  const iFleet = findCol(head, HEAD_MAINT.fleet);
  const iAmt = findCol(head, HEAD_MAINT.amount);
  const iAcc = findCol(head, HEAD_MAINT.account);
  const iDet = findCol(head, HEAD_MAINT.detail);
  const iYear = findCol(head, HEAD_MAINT.year);

  /** คอลัมน์วันที่ที่มีจริงในไฟล์ เรียงตามลำดับความน่าเชื่อถือ */
  const dateCols = HEAD_MAINT.date
    .map((a) => findCol(head, [a]))
    .filter((i, n, arr) => i >= 0 && arr.indexOf(i) === n);

  const missing: string[] = [];
  if (iVeh < 0) missing.push("ชนิดรถ");
  if (iAmt < 0) missing.push("จำนวนเงิน");
  if (iYear < 0 && !dateCols.length) missing.push("ปี หรือ วันที่ตามงวด");
  if (missing.length) return { rows: [], missing, warnings: [] };

  const warnings: string[] = [];
  if (iAcc < 0) warnings.push("ไม่มีคอลัมน์ “ชื่อบัญชี” — จะไม่มีรายการไหนถูกนับเป็นการตัดจำหน่าย");
  if (iDet < 0) warnings.push("ไม่มีคอลัมน์ “รายละเอียดการซ่อม” — ทุกรายการจะถูกคิดเป็นค่าซ่อมตามระยะทาง");
  if (iFleet < 0) {
    warnings.push("ไม่มีคอลัมน์ “ประเภทรถ” ในตารางค่าซ่อม — อัตราตามเวลาจะเท่ากันทั้งรถบริษัทและรถร่วม");
  }

  const rows: MaintRow[] = [];
  let noYear = 0;
  for (const r of table.slice(1)) {
    const vehicle = r[iVeh] ?? "";
    if (!vehicle || isHeaderEcho(vehicle, HEAD_MAINT.vehicle)) continue;

    let year: number | null = iYear >= 0 ? toBEYear(r[iYear]) : null;
    for (const c of dateCols) { if (year) break; year = toBEYear(r[c]); }
    if (!year) { noYear++; continue; }

    rows.push({
      year,
      vehicle,
      fleet: iFleet >= 0 ? (r[iFleet] ?? "") : "",
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
    if (!year || !vehicle || isHeaderEcho(vehicle, HEAD_OP.vehicle)) continue;
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
