/**
 * แปลงอัตราที่คำนวณได้ ให้เป็น "ค่าที่แก้เอง" (RefOverrides) ของตารางค่าซ่อม
 *
 * ตารางในแอปเก็บ "อัตรารายปี" แล้วถ่วงน้ำหนักตอนคำนวณ (repSum) ไม่ได้เก็บ POR
 * ที่ถ่วงเสร็จแล้ว การนำเข้าจึงเขียนอัตรารายปีลงไปตรง ๆ แล้วปล่อยให้คอลัมน์
 * "รวม (บาท/เที่ยว)" ในตารางเป็นตัวแสดง POR ให้เอง — ได้ตัวเลขเดียวกับ Step 5
 * ของเอกสาร แต่ผู้ใช้ยังเห็นที่มารายปีและแก้ทีละช่องต่อได้
 *
 * ★ ปีในไฟล์ฐานเป็นเลขสองหลักของ ค.ศ. ("24" = พ.ศ. 2567) แปลงด้วย
 *   2000 + Number(y) + 543 เท่านั้น ตามกฎใน CLAUDE.md
 *
 * ★ เขียนทับเฉพาะช่องที่คำนวณได้จริง ช่องที่ข้อมูลไม่ถึงต้องคงค่าเดิมไว้
 *   ไม่ใช่ทับเป็น 0 ไม่งั้นนำเข้าข้อมูลปีเดียวแล้วอีกสองปีจะหายไปทั้งแถว
 */
import { REF } from "../refdata";
import { ANY_FLEET, TRACTOR_KEY } from "./rates";
import type { RatesResult } from "./rates";
import type { RefOverrides } from "../cost/types";

/**
 * ชื่อชนิดรถทั้งหมดที่ตารางค่าซ่อมใช้ — ส่งให้ computeRates ปรับชื่อจากไฟล์ให้ตรง
 * รวมคีย์จากทั้งสองแท็บของอัตราตามเวลาและอัตราตามระยะทาง
 */
export const KNOWN_VEHICLES: string[] = [...new Set([
  ...Object.values(REF.repair.time).flatMap((byVeh) => Object.keys(byVeh)),
  ...Object.keys(REF.repair.dist),
  ...REF.vehicles.map((v) => v.repairKey ?? v.name),
])];

/** ปี พ.ศ. ของแต่ละช่องในตารางฐาน เรียงตามดัชนีเดียวกับ REF.repair.years */
export const BASE_YEARS: number[] = REF.repair.years.map((y) => 2000 + Number(y) + 543);

/** แท็บอัตราตามเวลาที่มีในตาราง — ใช้ตอนไฟล์ไม่ได้บอกประเภทรถมา */
const ALL_FLEETS = ["รถบริษัท", "รถร่วม"];

export interface ApplyPlan {
  /** ค่าที่จะเขียน — ส่งเข้า setOvr ได้เลย */
  repair: NonNullable<RefOverrides["repair"]>;
  /** จำนวนช่องที่จะถูกเขียน */
  cells: number;
  /** ชนิดรถที่จะถูกแตะ */
  vehicles: string[];
  /** ปีในข้อมูลที่ตารางไม่มีช่องรองรับ */
  skippedYears: number[];
  /** ชนิดรถที่ไม่มีรถคันไหนในระบบชี้มาใช้ — อัตราจะถูกเก็บไว้แต่ไม่มีผลกับการคำนวณ */
  unusedVehicles: string[];
  warnings: string[];
}

/** ชนิดรถที่ระบบใช้จริง = คีย์ที่ vehicles.json ชี้มา */
const usableKeys = (): Set<string> =>
  new Set(REF.vehicles.map((v) => v.repairKey ?? v.name));

export interface ApplyOptions {
  /** นำน้ำหนักถ่วงรายปีจากตารางที่ 3 มาใช้ด้วยไหม */
  useWeights?: boolean;
}

export function planApply(
  res: RatesResult,
  current: RefOverrides["repair"] | undefined,
  opts: ApplyOptions = {},
): ApplyPlan {
  const { useWeights = true } = opts;
  const rep = current ?? {};
  const out: NonNullable<RefOverrides["repair"]> = {
    ...rep,
    time: { ...rep.time },
    dist: { ...rep.dist },
  };

  const usable = usableKeys();
  const vehicles: string[] = [];
  const unusedVehicles: string[] = [];
  const warnings: string[] = [];
  let cells = 0;

  const slot = (year: number): number => BASE_YEARS.indexOf(year);

  /** แถวเดิม (ถ้ามี) เพื่อไม่ให้ปีที่ไม่ได้นำเข้าหายไป */
  const rowOf = (cur: (number | null)[] | undefined): (number | null)[] =>
    BASE_YEARS.map((_, i) => cur?.[i] ?? null);

  for (const v of res.vehicles) {
    let touched = false;

    // ── อัตราตามเวลา ─────────────────────────────────────────────────
    // "*" = ไฟล์ไม่ได้บอกประเภทรถ ให้ลงอัตราเดียวกันทุกแท็บที่ใบงานมี
    for (const [src, byYear] of Object.entries(v.time)) {
      const targets = src === ANY_FLEET
        ? (v.fleets.length ? v.fleets : ALL_FLEETS)
        : [src];

      for (const fleet of targets) {
        const row = rowOf(out.time?.[fleet]?.[v.vehicle]);
        let changed = false;
        for (const [yStr, rate] of Object.entries(byYear)) {
          const i = slot(Number(yStr));
          if (i < 0) continue;
          row[i] = rate;
          changed = true;
          cells++;
        }
        if (changed) {
          out.time = { ...out.time, [fleet]: { ...out.time?.[fleet], [v.vehicle]: row } };
          touched = true;
        }
      }
    }

    // ── อัตราตามระยะทาง — ใช้ร่วมกันทุกประเภทรถ ──────────────────────
    const drow = rowOf(out.dist?.[v.vehicle]);
    let dchanged = false;
    for (const [yStr, rate] of Object.entries(v.dist)) {
      const i = slot(Number(yStr));
      if (i < 0) continue;
      drow[i] = rate;
      dchanged = true;
      cells++;
    }
    if (dchanged) {
      out.dist = { ...out.dist, [v.vehicle]: drow };
      touched = true;
    }

    if (touched) {
      vehicles.push(v.vehicle);
      if (!usable.has(v.vehicle)) unusedVehicles.push(v.vehicle);
    }
  }

  // ── น้ำหนักถ่วงรายปี ───────────────────────────────────────────────
  if (useWeights && Object.keys(res.weights).length) {
    const w = BASE_YEARS.map((y, i) => res.weights[y] ?? rep.weights?.[i] ?? REF.repair.weights[i] ?? 0);
    out.weights = w;
    cells += BASE_YEARS.filter((y) => res.weights[y] != null).length;
  }

  const skippedYears = res.years.filter((y) => slot(y) < 0);
  if (skippedYears.length) {
    warnings.push(
      `ตารางรองรับ ${BASE_YEARS.join(" / ")} เท่านั้น — ข้อมูลปี ${skippedYears.join(" / ")} ถูกข้าม`,
    );
  }
  if (unusedVehicles.length) {
    warnings.push(
      `ชนิดรถนี้ไม่มีรถคันไหนในระบบชี้มาใช้ จึงเก็บอัตราไว้แต่ยังไม่มีผลกับการคำนวณ: ${unusedVehicles.join(", ")}`
        + (unusedVehicles.includes("หางเทรเลอร์") ? ` (ปกติค่าซ่อมหางควรถูกยุบเข้า “${TRACTOR_KEY}”)` : ""),
    );
  }

  return { repair: out, cells, vehicles, skippedYears, unusedVehicles, warnings };
}
