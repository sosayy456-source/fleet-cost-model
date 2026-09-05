/**
 * ค่าที่ผู้ใช้แก้ทับฐานกลาง — ราคาน้ำมันที่เพิ่มเอง และอัตราค่าซ่อมที่แก้เอง
 *
 * ใช้คีย์ localStorage ชุดเดียวกับ v5 (fuelPriceUpdates / repairOverrides)
 * เพื่อให้คนที่เคยแก้ไว้ในไฟล์เดิมเปิดแอปใหม่แล้วค่ายังอยู่
 */
import { useEffect, useState } from "react";
import { LEGACY_KEYS } from "./records";
import type { RefOverrides } from "../cost/types";

const EV = "refOverrides:changed";

const read = (k: string): unknown => {
  try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; }
};

export function loadOverrides(): RefOverrides {
  const prices = read(LEGACY_KEYS.fuelPrices);
  const repair = read(LEGACY_KEYS.repair);
  return {
    ...(prices && typeof prices === "object" ? { prices: prices as Record<string, number> } : {}),
    ...(repair && typeof repair === "object" ? { repair: repair as RefOverrides["repair"] } : {}),
  };
}

export function saveOverrides(o: RefOverrides): void {
  try {
    localStorage.setItem(LEGACY_KEYS.fuelPrices, JSON.stringify(o.prices ?? {}));
    localStorage.setItem(LEGACY_KEYS.repair, JSON.stringify(o.repair ?? {}));
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
