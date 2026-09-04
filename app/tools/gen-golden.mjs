/**
 * สร้าง golden fixture สำหรับทดสอบว่าโมเดลต้นทุนตัวใหม่ (TypeScript) ให้ตัวเลข
 * ตรงกับของเดิมใน โมเดลเดินรถ-gsheet-v5.html เป๊ะ ๆ
 *
 * วิธีการ: ตัดเฉพาะบล็อกโค้ดคำนวณออกมาจาก HTML แล้วรันจริงใน sandbox
 * ที่ stub DOM/localStorage ให้ → ได้ oracle ที่เป็นโค้ดเดิมจริง ๆ ไม่ใช่การพิมพ์ตาม
 * ผลลัพธ์ commit ไว้เป็นไฟล์ เพื่อให้เทสต์รันได้โดยไม่ต้องมี HTML ต้นฉบับ
 *
 *   node tools/gen-golden.mjs <path ไปยัง v5.html> [จำนวนเคส]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HTML = process.argv[2];
const N = Number(process.argv[3] ?? 400);
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/lib/cost/__fixtures__/golden.json");

const lines = readFileSync(HTML, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

// ---- ประกอบ oracle จากชิ้นส่วนของไฟล์เดิม (เลขบรรทัดอ้างอิง v5) ----
const parts = [
  slice(1160, 1245), // BASE_PRICES, RATES, VEHICLE_CAPACITY, ROUTES, REPAIR_BASE, REPAIR_ALIAS
  slice(1248, 1280), // repairTables, repSum, repairFixedFor, repairVarFor
  slice(1332, 1343), // buildPrices, PRICES, priceIndexFor, priceForDate
  "const num=id=>parseFloat($(id).value)||0;", // :1285
  slice(1563, 1578), // repairInfo
  slice(1596, 1603), // autoFuelInfo
  // doCalc เอาเฉพาะส่วนคำนวณ (1630-1651) ตัดส่วนที่เขียนลง DOM (1652-1663) ทิ้ง
  "function doCalc(){\n" + slice(1630, 1651) + "\n  return lastCalc;\n}",
];

const sandbox = `
"use strict";
let FIELDS = {};
let VEH = "", FLEET = "", NOAUTO = false, DATESTR = "";
const $ = (id) => ({ value: FIELDS[id] ?? "" });
const veh = { get value() { return VEH; } };
const fleetTypeSel = { get value() { return FLEET; } };
const fuelNoAutoCb = { get checked() { return NOAUTO; } };
const getDateStr = () => DATESTR;
const localStorage = { getItem: () => null, setItem: () => {} };
let lastCalc = null;
${parts.join("\n\n")}
return function run(c) {
  FIELDS = c.fields; VEH = c.vehIndex; FLEET = c.fleetType;
  NOAUTO = c.noAuto; DATESTR = c.date;
  const calc = doCalc();
  const rep = repairInfo();
  const auto = autoFuelInfo();
  const revenue = parseFloat(c.fields.revenue) || 0;
  return {
    fuelSum: calc.fuelSum, fuelAuto: calc.fuelAuto, litres: calc.liters, price: calc.price,
    labor: calc.labor, fees: calc.fees, waste: calc.waste,
    normal: calc.normal, sheetTotal: calc.sheetTotal,
    profit: revenue - calc.normal - calc.waste,
    repFixed: rep.fixed, repRate: rep.rate, repVar: rep.varCost, repTotal: rep.total,
    repHasFix: rep.hasFix, repHasVar: rep.hasVar,
    autoRate: auto.rate, autoPrice: auto.price, autoEffDate: auto.effDate,
    autoLitres: auto.liters, autoCost: auto.cost,
  };
};
`;

const run = new Function(sandbox)();

// ---- สุ่มเคสทดสอบแบบกำหนด seed ให้ผลซ้ำได้ ----
let seed = 20260904;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const money = () => (rnd() < 0.25 ? 0 : Math.round(rnd() * 20000 * 100) / 100);

const RATES = new Function(slice(1175, 1180) + "\nreturn RATES;")();
const FLEETS = ["รถบริษัท", "รถร่วม", ""];
const MONEY_FIELDS = [
  "gas", "fuelCash", "fuelDownBill", "fuelFleet", "fuelPickup", "fuelUpBill", "fuelCallTruck",
  "fuelOff", "fuelDetour", "fuelOffFleet", "drv", "spare", "snd", "laborOff",
  "feeTarp", "feePolice", "feeCont", "feePort", "feeDoc", "feeToll", "revenue",
];
// วันที่ครอบทั้งก่อนเรทแรก คร่อมทุกช่วงราคา และหลังเรทสุดท้าย รวมทั้งกรณีวันที่ว่าง
const DATES = [
  "", "2023-06-01", "2024-01-01", "2024-05-31", "2025-03-28", "2025-10-04",
  "2026-01-09", "2026-03-26", "2026-04-05", "2026-06-04", "2027-12-31",
];

const cases = [];
for (let i = 0; i < N; i++) {
  const fields = {};
  for (const f of MONEY_FIELDS) fields[f] = String(money());
  // ระยะทาง: มีทั้ง 0, ค่าปกติ, และค่าที่พิมพ์มั่ว เพื่อทดสอบ parseFloat||0
  fields.distance = pick(["0", String(Math.round(rnd() * 1200)), "", "abc", "12.5"]);
  const c = {
    fields,
    vehIndex: pick([...RATES.map((_, i) => String(i)), "", "99"]),
    fleetType: pick(FLEETS),
    noAuto: rnd() < 0.35,
    date: pick(DATES),
  };
  cases.push({ input: c, expected: run(c) });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  generatedFrom: "โมเดลเดินรถ-gsheet-v5.html",
  note: "สร้างโดยรันโค้ดคำนวณของเดิมจริง ๆ อย่าแก้ด้วยมือ — รัน tools/gen-golden.mjs ใหม่แทน",
  vehicles: RATES.map(([name]) => name),
  cases,
}, null, 2) + "\n", "utf8");

console.log(`เขียน ${cases.length} เคส → ${OUT}`);
