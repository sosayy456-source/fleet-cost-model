/** สุ่มบิลที่รอจัดรถกับทะเบียนจริงสำหรับหน้า Admin โดยยังไม่บันทึก */
import { REF, isTrailerKind } from "../../lib/refdata";
import { vehicleSpec } from "../../lib/refdata/vehicleSpecs";
import { loadStats } from "../../lib/dispatch/load";
import { kindsOf } from "../../lib/store/roster";
import type { FleetVehicle } from "../../lib/store/roster";
import type { RefOverrides } from "../../lib/cost/types";
import type { PendingBill } from "../../types/bill";
import type { VehiclePick } from "./VehiclePick";

export interface RandomDispatch {
  bills: PendingBill[];
  vehicle: VehiclePick;
  loadFactor: number;
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** เลือก 2–5 บิลถ้าเป็นไปได้; ถ้ามีบิลเดียวก็เลือกบิลนั้น โดยไม่เกิน 85% ของรถ */
export function randomDispatch(
  waiting: readonly PendingBill[], roster: readonly FleetVehicle[], overrides: RefOverrides,
): RandomDispatch | null {
  const groups = new Map<string, PendingBill[]>();
  for (const bill of waiting) {
    if (bill.weight <= 0 || bill.volume <= 0) continue;
    const key = [bill.date, bill.branch, bill.origin, bill.dest, bill.serviceGroup].join("|");
    groups.set(key, [...(groups.get(key) ?? []), bill]);
  }

  const vehicles = roster.filter((v) => v.status === "ใช้งาน")
    .flatMap((rosterVehicle) => kindsOf(rosterVehicle).filter((k) => !isTrailerKind(k.vehicle))
      .map((kind) => {
        const spec = vehicleSpec(REF.vehicles.find((v) => v.name === kind.vehicle), overrides.vehicleSpecs);
        return { rosterVehicle, kind, kg: spec?.capacityKg ?? 0, m3: spec?.volumeM3 ?? 0 };
      }))
    .filter((v) => v.kg > 0 && v.m3 > 0);

  const multi: RandomDispatch[] = [];
  const singles: RandomDispatch[] = [];
  const orderedGroups = shuffled([...groups.values()]).sort((a, b) => b.length - a.length);
  for (const group of orderedGroups) {
    if (group.length === 1 && singles.length >= 30) break;
    const cold = group[0]!.serviceGroup === "สินค้าแช่เย็น" || group[0]!.serviceGroup === "สินค้าแช่แข็ง";
    for (const v of shuffled(vehicles)) {
      if (cold && !v.kind.vehicle.includes("ตู้เย็น")) continue;
      const selected: PendingBill[] = [];
      let weight = 0, volume = 0;
      for (const bill of shuffled(group)) {
        if (selected.length === 5) break;
        const next = loadStats({ weight: weight + bill.weight, volume: volume + bill.volume },
          { kg: v.kg, m3: v.m3 }, null);
        if (next.loadFactor > 85) continue;
        selected.push(bill);
        weight += bill.weight;
        volume += bill.volume;
      }
      if (selected.length === 0) continue;
      const loadFactor = loadStats({ weight, volume }, { kg: v.kg, m3: v.m3 }, null).loadFactor;
      const choice = { bills: selected,
        vehicle: { fleetType: v.kind.fleetType, vehicle: v.kind.vehicle, plate: v.rosterVehicle.plate },
        loadFactor };
      if (selected.length >= 2) {
        multi.push(choice);
        if (multi.length >= 30) break;
      } else if (singles.length < 30) singles.push(choice);
    }
    if (multi.length >= 30) break;
  }
  const pool = multi.length ? multi : singles;
  if (!pool.length) return null;
  // รถที่มี Load Factor พอเหมาะมีโอกาสถูกเลือกมากกว่า แต่ยังสลับผลการสุ่มได้
  pool.sort((a, b) => Math.abs(a.loadFactor - 55) - Math.abs(b.loadFactor - 55));
  return pool[Math.floor(Math.random() * Math.min(10, pool.length))]!;
}
