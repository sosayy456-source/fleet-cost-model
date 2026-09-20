/**
 * ข้อมูลอ้างอิงกลาง — ดึงออกมาจาก โมเดลเดินรถ-gsheet-v5.html ด้วย
 * tools/extract-refdata.mjs (ไม่ได้พิมพ์ตามมือ) แล้วเก็บเป็น JSON
 *
 * ของเดิม hard-code อยู่ใน bundle และผู้ใช้แก้ทับได้เฉพาะใน localStorage ของตัวเอง
 * ทำให้ 3 ฝ่ายคำนวณต้นทุนไม่ตรงกันได้แบบเงียบ ๆ — ที่นี่แยกเป็น "ฐานกลาง" (ไฟล์นี้)
 * กับ "ค่าที่แก้เอง" (RefOverrides) ที่ต้องส่งเข้ามาอย่างชัดเจน
 */
import type { FuelPrice, RefData, RepairTable, Vehicle } from "../cost/types";
import fuelPrices from "./fuelPrices.json";
import vehicles from "./vehicles.json";
import repair from "./repair.json";
import enums from "./enums.json";
import routes from "./routes.json";

export const REF: RefData = {
  prices: fuelPrices as FuelPrice[],
  vehicles: vehicles as Vehicle[],
  repair: repair as RepairTable,
};

export const DOC_TYPES: string[] = enums.docTypes;
export const BRANCHES: string[] = enums.branches;
export const SERVICE_GROUPS: string[] = enums.serviceGroups;
export const FLEET_TYPES: string[] = enums.fleetTypes;

/** ตารางระยะทาง ต้นทาง → ปลายทาง → กม. */
export const ROUTES: Record<string, Record<string, number>> = routes;

export const ORIGINS = Object.keys(ROUTES);

/** ปลายทางที่ไปได้จากต้นทางนี้ (เทียบเท่า fillDests() :1514) */
export const destsFor = (origin: string): string[] => Object.keys(ROUTES[origin] ?? {});

/** ระยะทางของคู่ต้นทาง-ปลายทาง (เทียบเท่า applyRouteDistance() :1519) */
export const distanceFor = (origin: string, dest: string): number | null =>
  ROUTES[origin]?.[dest] ?? null;

export const vehicleByName = (name: string): Vehicle | undefined =>
  REF.vehicles.find((v) => v.name === name);

/** ชื่อทางเลือกที่เคยทดลองใช้ → ชื่อเดิมจากข้อมูลกองรถซึ่งเป็นชื่อมาตรฐาน */
export const VEHICLE_ALIASES: Readonly<Record<string, string>> = {
  "รถเทรเล่อร์ (แม่)": "รถเทรเลอร์",
  "รถ 10 ล้อช่วงยาว": "รถ 10 ล้อยาว",
};

export const canonicalVehicleName = (name: string): string => VEHICLE_ALIASES[name] ?? name;

/** ลำดับชนิดรถที่ใช้ร่วมกันทั้งดรอปดาวน์และหน้าตั้งค่า */
export const ACTIVE_VEHICLE_NAMES: readonly string[] = [
  "รถ 10 ล้อ",
  "รถ 10 ล้อตู้เย็น",
  "รถ 10 ล้อตู้แห้ง",
  "รถ 10 ล้อยาว",
  "รถ 12 ล้อคอก",
  "รถ 12 ล้อตู้เย็น",
  "รถ 6 ล้อ FC4",
  "รถ 6 ล้อ(ตู้แห้ง)",
  "รถ 6 ล้อเล็ก",
  "รถ 6 ล้อคอก",
  "รถ 6 ล้อใหญ่",
  "รถเทรเลอร์",
  "หางเทรเลอร์",
  "รถปิกอัพ 3 ตัน",
  "รถปิ๊กอัพตู้เย็น",
  "หางพ่วงคอก",
  "หางพ่วงตู้เย็น",
  "หางพ่วงตู้แห้ง",
];

/** ชนิดรถที่ให้เลือกใน UI — คงข้อมูลชนิดที่เลิกใช้ไว้ใน REF.vehicles สำหรับคำนวณใบเก่า */
export const ACTIVE_VEHICLES: Vehicle[] = ACTIVE_VEHICLE_NAMES.map((name) => {
  const vehicle = vehicleByName(name);
  if (!vehicle || vehicle.retired) throw new Error(`ไม่พบชนิดรถที่ใช้งาน: ${name}`);
  return vehicle;
});

/**
 * ตัวเลือกชนิดรถสำหรับดรอปดาวน์ — ถ้าค่าปัจจุบันเป็นชนิดที่เลิกใช้ (ใบเก่า) ต้องยังโผล่ในรายการ
 * ไม่งั้นดรอปดาวน์จะแสดงว่าง แล้วพอกดบันทึกค่าจะหายไป
 */
export const vehicleOptions = (current?: string): string[] => {
  const names = ACTIVE_VEHICLES.map((v) => v.name);
  return current && !names.includes(current) && vehicleByName(current) ? [...names, current] : names;
};
