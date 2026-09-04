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
