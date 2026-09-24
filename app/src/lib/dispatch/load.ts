/**
 * Load Factor ของรถที่เลือก — ใช้ร่วมหน้า "จัดรถ" กับส่วน Fleet Coordinator ของ "บันทึกข้อมูลรวม"
 *
 * ความจุ = หัว + หาง รวมกัน (มีหางพ่วง) · **ใช้ฝั่งที่เต็มกว่า** ระหว่างน้ำหนักกับปริมาตร
 * เกินฝั่งใดฝั่งหนึ่ง = เกินความจุ (หน้าจัดรถบล็อกการยืนยัน) · % รายตู้สำหรับรูปรถมาจาก splitLoad()
 */
import { splitLoad } from "./loadSplit";
import type { Cap } from "./loadSplit";

export interface Load { weight: number; volume: number }

export interface LoadStats {
  capKg: number;
  capM3: number;
  /** สัดส่วน 0–1 ของแต่ละฝั่ง */
  useWeight: number;
  useVolume: number;
  binding: "น้ำหนัก" | "ปริมาตร";
  /** % ของฝั่งที่เต็มกว่า */
  loadFactor: number;
  overWeight: boolean;
  overVolume: boolean;
  /** % ตู้หัว / ตู้หาง (null = ไม่มีหาง) สำหรับรูปรถ */
  head: number;
  tail: number | null;
}

export function loadStats(load: Load, head: Cap, tail: Cap | null): LoadStats {
  const capKg = head.kg + (tail?.kg ?? 0);
  const capM3 = head.m3 + (tail?.m3 ?? 0);
  const useWeight = capKg > 0 ? load.weight / capKg : 0;
  const useVolume = capM3 > 0 ? load.volume / capM3 : 0;
  const split = splitLoad(load, head, tail);
  return {
    capKg, capM3, useWeight, useVolume,
    binding: useWeight >= useVolume ? "น้ำหนัก" : "ปริมาตร",
    loadFactor: Math.max(useWeight, useVolume) * 100,
    overWeight: capKg > 0 && load.weight > capKg,
    overVolume: capM3 > 0 && load.volume > capM3,
    head: split.head, tail: split.tail,
  };
}
