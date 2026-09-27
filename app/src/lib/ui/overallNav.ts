/** แท็บของ Overall Dashboard ใช้ร่วมกันระหว่างเมนูซ้ายกับแถบแท็บในหน้า */
import { useSyncExternalStore } from "react";

export const OVERALL_TABS = [
  { id: "fleet", label: "Vehicle Utilization" },
  { id: "damage", label: "Damage Rate" },
  { id: "empty", label: "Empty Trips" },
  { id: "lf", label: "Inefficient Transportation Cost" },
  { id: "tonkm", label: "Contribution Margin" },
  { id: "detail3", label: "Vehicle Utilization Cost" },
] as const;

export type OverallTabId = (typeof OVERALL_TABS)[number]["id"];

let active: OverallTabId | null = null;
let goFn: ((id: OverallTabId) => void) | null = null;
let pending: OverallTabId | null = null;
const listeners = new Set<() => void>();

function emit(): void { for (const listener of listeners) listener(); }

export function registerOverallNav(go: (id: OverallTabId) => void): void {
  goFn = go;
}

export function clearOverallNav(): void {
  goFn = null;
  active = null;
  emit();
}

export function setOverallActive(id: OverallTabId): void {
  if (active === id) return;
  active = id;
  emit();
}

/** ถ้าหน้ายังไม่เปิด ให้จำแท็บไว้จนกว่าคอมโพเนนต์จะเริ่มทำงาน */
export function overallGo(id: OverallTabId): void {
  if (goFn) goFn(id);
  else pending = id;
}

export function peekOverallPending(): OverallTabId | null { return pending; }
export function clearOverallPending(): void { pending = null; }

export function useOverallActive(): OverallTabId | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => active,
  );
}
