/** แท็บ Manager Dashboard ใช้ร่วมกันระหว่างเมนูซ้ายกับแถบแท็บในหน้า */
import { useSyncExternalStore } from "react";

export const MANAGER_TABS = [
  { id: "ops", label: "หน้างาน" },
  { id: "fin", label: "การเงิน" },
] as const;

export type ManagerTabId = (typeof MANAGER_TABS)[number]["id"];

let active: ManagerTabId | null = null;
let goFn: ((id: ManagerTabId) => void) | null = null;
let pending: ManagerTabId | null = null;
const listeners = new Set<() => void>();

function emit(): void { for (const listener of listeners) listener(); }

export function registerManagerNav(go: (id: ManagerTabId) => void): void { goFn = go; }

export function clearManagerNav(): void {
  goFn = null;
  active = null;
  emit();
}

export function setManagerActive(id: ManagerTabId): void {
  if (active === id) return;
  active = id;
  emit();
}

/** เมื่อหน้าแดชบอร์ดยังไม่เปิด ให้จำแท็บที่กดไว้จนกว่าจะวาดหน้า */
export function managerGo(id: ManagerTabId): void {
  if (goFn) goFn(id);
  else pending = id;
}

export function peekManagerPending(): ManagerTabId | null { return pending; }
export function clearManagerPending(): void { pending = null; }

export function useManagerActive(): ManagerTabId | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => active,
  );
}
