/**
 * รวมปริมาตรและน้ำหนักสูงสุดฐานกลางกับค่าที่ผู้ใช้แก้เอง
 */
import type { RefOverrides, Vehicle } from "../cost/types";

export interface EffectiveVehicleSpec {
  volumeM3: number | null;
  capacityKg: number | null;
}

const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function vehicleSpec(
  vehicle: Vehicle | undefined,
  overrides?: RefOverrides["vehicleSpecs"],
): EffectiveVehicleSpec | null {
  if (!vehicle) return null;
  const own = overrides?.[vehicle.name];
  const volumeM3 = positive(own?.volumeM3) ?? positive(vehicle.volumeM3);
  const capacityKg = positive(own?.capacityKg) ?? positive(vehicle.capacityKg);
  return { volumeM3, capacityKg };
}
