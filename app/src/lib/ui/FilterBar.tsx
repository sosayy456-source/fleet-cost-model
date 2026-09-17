/**
 * แถวตัวกรองของแท็บแดชบอร์ด — ใช้แทน <div className="dz-filters">
 *
 * อยู่ใต้ DashShell → portal ขึ้นไปวางในหัว (แถวเดียวกับแท็บ ตามดีไซน์ 1A)
 * ไม่มี DashShell ครอบ → เรนเดอร์ตรงที่เดิมเป็น .dz-filters แบบเก่า
 * state ของตัวกรองยังอยู่ที่แท็บเหมือนเดิม — portal ย้ายแค่ตำแหน่งที่แสดง
 */
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useFilterSlot } from "./dashContext";

export default function FilterBar({ children }: { children: ReactNode }) {
  const slot = useFilterSlot();
  if (slot) return createPortal(children, slot);
  return <div className="dz-filters">{children}</div>;
}

/**
 * "↺ ล้างตัวกรอง" แบบตัวอักษร — ไม่แสดงเมื่อยังไม่ได้เลือกตัวกรองใด (ไม่มีอะไรให้ล้าง)
 * แยกจาก ResetBtn ใน dash-fleet/parts.tsx ที่หน้าอื่นยังใช้หน้าตาเดิม
 */
export function ClearFiltersBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  if (!active) return null;
  return <button type="button" className="dh-clear" onClick={onClick}>↺ ล้างตัวกรอง</button>;
}
