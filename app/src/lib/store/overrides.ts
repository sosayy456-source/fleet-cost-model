/**
 * ค่าที่ผู้ใช้แก้ทับฐานกลาง — ราคาน้ำมัน อัตราค่าซ่อม และสเปกรถ
 *
 * ราคาน้ำมัน/ค่าซ่อมใช้คีย์เดิมของ v5 เพื่อให้ค่าที่เคยแก้ยังอยู่
 * ส่วนสเปกรถใช้คีย์ใหม่ vehicleSpecOverrides
 */
import { useEffect, useState } from "react";
import { LEGACY_KEYS } from "./records";
import type { RefOverrides } from "../cost/types";
import { canonicalVehicleName } from "../refdata";

const EV = "refOverrides:changed";

const read = (k: string): unknown => {
  try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; }
};

/** รับเฉพาะ schema ปัจจุบัน — ตัดมิติ กว้าง/ยาว/สูงจากรุ่นทดลองเดิมทิ้ง */
const cleanVehicleSpecs = (value: unknown): NonNullable<RefOverrides["vehicleSpecs"]> => {
  if (!value || typeof value !== "object") return {};
  const clean: NonNullable<RefOverrides["vehicleSpecs"]> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const volumeM3 = Number(row.volumeM3);
    const capacityKg = Number(row.capacityKg);
    const spec: { volumeM3?: number; capacityKg?: number } = {};
    if (Number.isFinite(volumeM3) && volumeM3 > 0) spec.volumeM3 = volumeM3;
    if (Number.isFinite(capacityKg) && capacityKg > 0) spec.capacityKg = capacityKg;
    if (Object.keys(spec).length) {
      const canonical = canonicalVehicleName(name);
      clean[canonical] = { ...clean[canonical], ...spec };
    }
  }
  return clean;
};

export function loadOverrides(): RefOverrides {
  const prices = read(LEGACY_KEYS.fuelPrices);
  const repair = read(LEGACY_KEYS.repair);
  const vehicleSpecs = cleanVehicleSpecs(read(LEGACY_KEYS.vehicleSpecs));
  return {
    ...(prices && typeof prices === "object" ? { prices: prices as Record<string, number> } : {}),
    ...(repair && typeof repair === "object" ? { repair: repair as RefOverrides["repair"] } : {}),
    ...(Object.keys(vehicleSpecs).length ? { vehicleSpecs } : {}),
  };
}

export function saveOverrides(o: RefOverrides): void {
  try {
    localStorage.setItem(LEGACY_KEYS.fuelPrices, JSON.stringify(o.prices ?? {}));
    localStorage.setItem(LEGACY_KEYS.repair, JSON.stringify(o.repair ?? {}));
    localStorage.setItem(LEGACY_KEYS.vehicleSpecs, JSON.stringify(o.vehicleSpecs ?? {}));
    dispatchEvent(new Event(EV));
  } catch { /* โควตาเต็ม/โหมดส่วนตัว — ยังคำนวณด้วยค่าฐานได้ */ }
}

export function useOverrides(): [RefOverrides, (o: RefOverrides) => void] {
  const [ovr, setOvr] = useState<RefOverrides>(loadOverrides);
  useEffect(() => {
    const on = () => setOvr(loadOverrides());
    addEventListener(EV, on);
    addEventListener("storage", on);
    return () => { removeEventListener(EV, on); removeEventListener("storage", on); };
  }, []);
  return [ovr, (o) => { saveOverrides(o); setOvr(o); }];
}
