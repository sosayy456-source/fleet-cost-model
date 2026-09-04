/**
 * โมเดลต้นทุนการเดินรถ — implementation เดียวของทั้งระบบ
 *
 * ของเดิมเขียนสูตรนี้ซ้ำ 3 ที่ใน โมเดลเดินรถ-gsheet-v5.html และต้องให้ผลตรงกันตลอด
 * โดยไม่มีอะไรบังคับ:
 *   - doCalc()          :1629  ตอนกดปุ่มคำนวณในฟอร์ม
 *   - recomputeTotals() :2152  ตอน merge/save
 *   - recCost()         :2864  ตอนรวมยอดในแดชบอร์ด
 * ไฟล์นี้ยุบทั้งสามให้เหลือฟังก์ชัน pure ตัวเดียว มี golden test คุมว่าตัวเลขไม่เพี้ยน
 *
 * แถวจากชีตเก่ามีแต่ยอดรวม ไม่มีรายการย่อยพอจะคำนวณใหม่ ใช้ adapters/oldRow.ts แทน
 * — ซึ่งเป็น "สูตรเดียวกันนี้" ที่จัดรูปใหม่ให้เขียนด้วยยอดรวมได้ (มีเทสต์คุมไว้)
 */
import type {
  AutoFuel, CostInput, CostResult, FleetType, RefData, RefOverrides, RepairResult,
} from "./types";

/** เทียบเท่า num() เดิม (:1285) — parseFloat(x) || 0 : ค่าที่อ่านไม่ออกกลายเป็น 0 */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n || 0 : 0;
}

/** รวมราคาฐานกับราคาที่ผู้ใช้แก้เอง แล้วเรียงตามวันที่ (เทียบเท่า buildPrices() :1336) */
export function buildPrices(ref: RefData, ovr?: RefOverrides) {
  const map = new Map(ref.prices.map((p) => [p.date, p.price]));
  for (const [d, p] of Object.entries(ovr?.prices ?? {})) map.set(d, +p);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * ราคาน้ำมันที่มีผล ณ วันที่กำหนด (เทียบเท่า priceForDate() :1343)
 * พฤติกรรมขอบที่ต้องคงไว้:
 *   - ไม่ระบุวันที่  → ใช้ราคา "ล่าสุด" (ไม่ใช่ราคาแรกสุด)
 *   - วันที่เก่ากว่าเรทแรก → ใช้เรทแรก
 */
export function priceForDate(
  prices: ReadonlyArray<readonly [string, number]>,
  dateStr: string,
): { effDate: string; price: number } {
  if (prices.length === 0) return { effDate: "", price: 0 };
  let idx = -1;
  if (dateStr) {
    for (let i = 0; i < prices.length; i++) {
      if (prices[i]![0] <= dateStr) idx = i;
      else break;
    }
  } else {
    idx = prices.length - 1;
  }
  const hit = prices[idx < 0 ? 0 : idx]!;
  return { effDate: hit[0], price: hit[1] };
}

/** ค่าน้ำมันที่คำนวณจากระยะทาง × อัตราสิ้นเปลือง × ราคา (เทียบเท่า autoFuelInfo() :1596) */
export function autoFuelInfo(input: CostInput, ref: RefData, ovr?: RefOverrides): AutoFuel {
  const vehicle = ref.vehicles.find((v) => v.name === input.vehicle);
  const rate = vehicle?.litrePerKm ?? 0;
  const distance = num(input.distance);
  const { effDate, price } = priceForDate(buildPrices(ref, ovr), input.date);
  const litres = distance * rate;
  return { rate, distance, price, effDate, litres, cost: litres * price };
}

/** รวมตารางค่าซ่อมฐานกับที่ผู้ใช้แก้เอง (เทียบเท่า repairTables() :1254) */
function repairTables(ref: RefData, ovr?: RefOverrides) {
  const t = structuredClone(ref.repair);
  const o = ovr?.repair;
  if (!o) return t;

  o.weights?.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) t.weights[i] = +v;
  });
  for (const [fleet, byVeh] of Object.entries(o.time ?? {})) {
    t.time[fleet] ??= {};
    for (const [veh, rates] of Object.entries(byVeh)) {
      const row = (t.time[fleet]![veh] ??= [0, 0, 0]);
      rates.forEach((x, i) => {
        if (x != null && Number.isFinite(x)) row[i] = +x;
      });
    }
  }
  for (const [veh, rates] of Object.entries(o.dist ?? {})) {
    const row = (t.dist[veh] ??= [0, 0, 0]);
    rates.forEach((x, i) => {
      if (x != null && Number.isFinite(x)) row[i] = +x;
    });
  }
  return t;
}

/** ผลรวมถ่วงน้ำหนัก 3 ปี (เทียบเท่า repSum() :1271) */
const repSum = (rates: number[], w: number[]) =>
  rates.reduce((s, r, i) => s + (+r || 0) * (+w[i]! || 0), 0);

/**
 * ค่าซ่อมแซม (เทียบเท่า repairInfo() :1563)
 *
 * ชนิดรถที่ไม่มีในตารางจะคิดเป็น 0 แต่ตั้งธง hasFix/hasVar ไว้ให้ UI บอกผู้ใช้ว่า
 * "ไม่มีในตาราง" — เป็นพฤติกรรมที่ตั้งใจ ไม่ใช่ error
 * ตอนนี้มี 9 จาก 12 ชนิดรถที่ตารางไม่ครบ และ 4 ชนิดไม่มีข้อมูลเลย
 */
export function repairInfo(input: CostInput, ref: RefData, ovr?: RefOverrides): RepairResult {
  const t = repairTables(ref, ovr);
  const vehicle = ref.vehicles.find((v) => v.name === input.vehicle);
  const key = vehicle?.repairKey ?? input.vehicle;
  const fleetType = input.fleetType as FleetType | "";

  const fixRow = fleetType ? t.time[fleetType]?.[key] : undefined;
  const hasFix = fixRow != null;
  const fixed = hasFix ? repSum(fixRow, t.weights) : 0;

  const varRow = t.dist[key];
  const hasVar = varRow != null;
  const rate = hasVar ? repSum(varRow, t.weights) : 0;

  const distance = num(input.distance);
  const varCost = rate * distance;

  return {
    fixed, rate, varCost, total: fixed + varCost,
    vehicle: vehicle?.name ?? "", fleetType, hasFix, hasVar,
  };
}

/** คำนวณต้นทุนทั้งใบ — pure ไม่แตะ DOM ไม่แตะ localStorage */
export function computeCost(input: CostInput, ref: RefData, ovr?: RefOverrides): CostResult {
  const auto = autoFuelInfo(input, ref, ovr);
  const repair = repairInfo(input, ref, ovr);

  const gas = num(input.gas);
  const fuelAuto = input.fuelAutoOn ? auto.cost : 0;
  const fuelSum =
    num(input.fuelCash) + num(input.fuelDownBill) + num(input.fuelFleet) +
    num(input.fuelPickup) + num(input.fuelUpBill) + num(input.fuelCallTruck) + fuelAuto;

  const labor = num(input.drv) + num(input.spare) + num(input.snd);
  const fees =
    num(input.feeTarp) + num(input.feePolice) + num(input.feeCont) +
    num(input.feePort) + num(input.feeDoc) + num(input.feeToll);
  const waste =
    num(input.fuelDetour) + num(input.fuelOffFleet) + num(input.laborOff) + num(input.fuelOff);

  const normal = gas + fuelSum + labor + fees + repair.total;
  const sheetTotal = gas + fuelSum + labor + waste + fees;
  const profit = num(input.revenue) - normal - waste;

  return {
    auto, repair,
    fuelSum,
    // เก็บ cost ดิบไว้เสมอแม้ปิดออโต้ (ตาม lastCalc :1651) เพื่อให้ round-trip ตรงของเดิม
    fuelAuto: auto.cost,
    litres: input.fuelAutoOn ? auto.litres : 0,
    price: auto.price,
    labor, fees, waste, normal, sheetTotal, profit,
  };
}
