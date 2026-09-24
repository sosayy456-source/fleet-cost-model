/**
 * ป็อบอัพรายการส่วนของปุ่ม Demo ในแถบเมนูซ้าย (เจ้าของงานสั่ง 24 ก.ย. 2569 — ย้ายปุ่มแท็บจากหัวหน้า Demo มาไว้ที่ปุ่ม Demo)
 *
 * หน้า Demo เป็นหน้ายาวหน้าเดียว กดรายการ = เลื่อนไปหาส่วนนั้น · ไฮไลต์ตามส่วนที่เลื่อนถึง
 * แถบเมนูอยู่ใน App ส่วนตำแหน่งเลื่อนอยู่ใน DemoDash (โหลดแยกก้อน) — สองฝั่งคุยกันผ่าน store เล็ก ๆ ตัวนี้
 *   DemoDash  ลงทะเบียนรายการส่วน + ฟังก์ชันเลื่อน และบอกส่วนที่กำลังอ่าน
 *   App       อ่านไปวาดป็อบอัพที่ปุ่ม "Demo" (เฉพาะตอนอยู่หน้า Demo) กดแล้วเรียก demoGo()
 */
import { useSyncExternalStore } from "react";

export interface DemoNavState {
  parts: readonly { id: string; label: string }[];
  active: string;
}

const EMPTY: DemoNavState = { parts: [], active: "" };
let state: DemoNavState = EMPTY;
let goFn: ((id: string) => void) | null = null;
const listeners = new Set<() => void>();

const emit = (): void => { for (const l of listeners) l(); };

/** DemoDash เรียกตอนเปิดหน้า — ปิดหน้าให้เรียก clearDemoNav() */
export function registerDemoNav(parts: DemoNavState["parts"], go: (id: string) => void): void {
  goFn = go;
  state = { parts, active: state.active || parts[0]?.id || "" };
  emit();
}

export function setDemoActive(id: string): void {
  if (state.active === id) return;
  state = { ...state, active: id };
  emit();
}

export function clearDemoNav(): void {
  goFn = null;
  state = EMPTY;
  emit();
}

/** แถบเมนูเรียกตอนกดแท็บย่อย */
export function demoGo(id: string): void { goFn?.(id); }

export function useDemoNav(): DemoNavState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
  );
}
