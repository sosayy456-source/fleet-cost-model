/**
 * แท็บย่อยของเมนู Demo ในแถบเมนูซ้าย (เจ้าของงานสั่ง 24 ก.ย. 2569)
 * **ชี้เมาส์ที่ Demo = รายการ 4 ส่วนกางลงมาใต้ปุ่มเลย ไม่ต้องคลิก** · พื้นสีชมพูเดียวกับแถบเมนู ไม่มีกล่องขาว ·
 * ข้อความเยื้องขวาให้ตรงกับคำว่า "Demo" (.navsub ในส่วนที่ 2 ของ index.css) — เดิมเป็นป็อบอัพกล่องขาวที่ต้องกดก่อน
 *
 * หน้า Demo เป็นหน้ายาวหน้าเดียว กดรายการ = เลื่อนไปหาส่วนนั้น · ไฮไลต์ตามส่วนที่เลื่อนถึง
 * แถบเมนูอยู่ใน App ส่วนตำแหน่งเลื่อนอยู่ใน DemoDash (โหลดแยกก้อน) — สองฝั่งคุยกันผ่าน store เล็ก ๆ ตัวนี้
 *   DemoDash  ลงทะเบียนฟังก์ชันเลื่อน และบอกส่วนที่กำลังอ่าน
 *   App       วาดรายการ DEMO_PARTS ใต้ปุ่ม "Demo" (ทุกหน้า) กดแล้วเรียก demoGo()
 * ★ กดจากหน้าอื่น: หน้า Demo ยังไม่เปิด (goFn = null) → เก็บไว้ใน pending ให้ DemoDash เลื่อนเองหลังโหลดข้อมูลเสร็จ
 *   (takeDemoPending) — เลื่อนก่อนข้อมูลมาไม่ได้เพราะส่วนต่าง ๆ ยังไม่ถูกวาด
 */
import { useSyncExternalStore } from "react";

/** ส่วนของหน้า Demo เรียงตามหน้า — แถบเมนูใช้วาดรายการได้แม้หน้า Demo ยังไม่เปิด */
export const DEMO_PARTS = [
  { id: "route", label: "กำไรรายเส้นทาง" },
  // ชื่อส่วนเปลี่ยน 25 ก.ย. 2569 (เจ้าของงานสั่ง · เดิม "ข้อ 2" / "ข้อ 3") — id เดิม
  { id: "item2", label: "Inefficient Transportation Cost" },
  { id: "item3", label: "Vehicle Utilization Cost" },
  { id: "cust", label: "กำไรลูกค้า" },
] as const;

export interface DemoNavState {
  parts: readonly { id: string; label: string }[];
  active: string;
}

const EMPTY: DemoNavState = { parts: [], active: "" };
let state: DemoNavState = EMPTY;
let goFn: ((id: string) => void) | null = null;
let pending: string | null = null;
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

/** แถบเมนูเรียกตอนกดแท็บย่อย — หน้า Demo ยังไม่เปิดก็จำไว้ก่อน */
export function demoGo(id: string): void {
  if (goFn) goFn(id);
  else pending = id;
}

/** DemoDash เรียกหลังข้อมูลโหลดเสร็จ — คืนส่วนที่กดค้างไว้จากหน้าอื่น (ครั้งเดียว) */
export function takeDemoPending(): string | null {
  const id = pending;
  pending = null;
  return id;
}

export function useDemoNav(): DemoNavState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
  );
}
