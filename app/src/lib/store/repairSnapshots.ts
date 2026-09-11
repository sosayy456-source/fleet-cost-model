/**
 * ชุดอัตราค่าซ่อมที่บันทึกไว้ — ให้ย้อนกลับไปใช้ชุดไหนก็ได้ ไม่ใช่แค่ค่าฐาน
 *
 * ของเดิมมีทางเดียวคือ "ล้างค่าที่แก้เองทิ้งแล้วกลับไปใช้ฐานกลาง" ซึ่งแปลว่า
 * ทุกครั้งที่นำเข้าข้อมูลใหม่ อัตราชุดเก่าที่ปรับมาอย่างดีจะหายไปเลย
 * ที่นี่เก็บเป็นชุด ๆ ไว้ก่อนทับ ผู้ใช้จึงสลับกลับไปชุดไหนก็ได้
 *
 * เก็บใน localStorage ของเครื่องเหมือนค่าที่แก้เอง (คีย์ repairOverrides) —
 * เป็นข้อจำกัดเดียวกันคือแยกรายเครื่อง ไม่ได้แชร์กันในทีม
 */
import { useCallback, useEffect, useState } from "react";
import type { RefOverrides } from "../cost/types";

export type RepairOverride = NonNullable<RefOverrides["repair"]>;

export interface RepairSnapshot {
  id: string;
  name: string;
  /** 'YYYY-MM-DD HH:mm' ตามเวลาเครื่อง */
  savedAt: string;
  repair: RepairOverride;
}

const LS_KEY = "repairSnapshots";
const EV = "repairSnapshots:changed";
/** กันไม่ให้กินโควตา localStorage จนค่าที่แก้เองเซฟไม่ลง */
export const MAX_SNAPSHOTS = 20;

export function loadSnapshots(): RepairSnapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
    if (!Array.isArray(raw)) return [];
    return raw.filter((s: unknown): s is RepairSnapshot =>
      !!s && typeof s === "object"
      && typeof (s as RepairSnapshot).id === "string"
      && typeof (s as RepairSnapshot).name === "string"
      && !!(s as RepairSnapshot).repair);
  } catch {
    return [];
  }
}

function write(list: RepairSnapshot[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)));
    dispatchEvent(new Event(EV));
  } catch { /* โควตาเต็ม/โหมดส่วนตัว — ยังใช้ค่าปัจจุบันได้ */ }
}

/** เวลาเครื่อง ไม่ใช่ UTC — เหตุผลเดียวกับ nowStamp() ใน lib/record/date */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** บันทึกชุดใหม่ไว้บนสุด แล้วคืนรายการทั้งหมด */
export function addSnapshot(name: string, repair: RepairOverride): RepairSnapshot[] {
  const snap: RepairSnapshot = {
    id: "S" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: name.trim() || `ชุดค่าซ่อม ${stamp()}`,
    savedAt: stamp(),
    // คัดลอกลึกกันไม่ให้ชุดที่เก็บไว้เปลี่ยนตามค่าที่ผู้ใช้แก้ต่อ
    repair: structuredClone(repair),
  };
  const next = [snap, ...loadSnapshots()];
  write(next);
  return next;
}

export function removeSnapshot(id: string): RepairSnapshot[] {
  const next = loadSnapshots().filter((s) => s.id !== id);
  write(next);
  return next;
}

export function renameSnapshot(id: string, name: string): RepairSnapshot[] {
  const next = loadSnapshots().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s));
  write(next);
  return next;
}

/** จำนวนช่องที่ชุดนี้กำหนดไว้ — ใช้บอกผู้ใช้ว่าชุดไหนมีข้อมูลแค่ไหน */
export function countCells(repair: RepairOverride): number {
  let n = 0;
  for (const byVeh of Object.values(repair.time ?? {})) {
    for (const row of Object.values(byVeh)) n += row.filter((v) => v != null).length;
  }
  for (const row of Object.values(repair.dist ?? {})) n += row.filter((v) => v != null).length;
  return n;
}

export function useRepairSnapshots(): RepairSnapshot[] {
  const [list, setList] = useState<RepairSnapshot[]>(loadSnapshots);
  const sync = useCallback(() => setList(loadSnapshots()), []);
  useEffect(() => {
    addEventListener(EV, sync);
    addEventListener("storage", sync);
    return () => { removeEventListener(EV, sync); removeEventListener("storage", sync); };
  }, [sync]);
  return list;
}
