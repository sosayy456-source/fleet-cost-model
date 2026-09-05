/**
 * ทะเบียนรถในกองรถ (Fleet Roster) — ยกจาก v5:1455-1466
 *
 * ใช้คีย์ localStorage ตัวเดิม "fleetRoster" เพื่อให้คนที่เคยกรอกไว้ใน v5
 * เปิดแอปใหม่แล้วเจอรถของตัวเองครบ ไม่ต้องกรอกซ้ำ
 *
 * เก็บใน localStorage ไม่ใช่ IndexedDB เพราะเป็นรายการสั้น (หลักสิบคัน)
 * และต้องอ่านแบบ synchronous ตอน render ตารางการใช้ประโยชน์
 */
import { useEffect, useState } from "react";

export interface FleetVehicle {
  plate: string;
  fleetType: string;
  vehicle: string;
  /** วันที่เริ่มใช้งาน (ISO) — ใช้เป็นตัวหารของ %การใช้งาน */
  start: string;
  status: string;
}

const LS_FLEET = "fleetRoster";

export const FLEET_STATUS = ["ใช้งาน", "ซ่อมบำรุง", "จอด", "ปลดระวาง"];

/** ข้อมูลตัวอย่างชุดเดียวกับ v5 — ลบ/แก้ได้จากตารางในฟอร์ม */
const FLEET_SAMPLE: FleetVehicle[] = [
  { plate: "ชม.70-0820", fleetType: "รถบริษัท", vehicle: "รถเทรเลอร์", start: "2023-01-15", status: "ใช้งาน" },
  { plate: "ชม.81-2214", fleetType: "รถบริษัท", vehicle: "รถ 10 ล้อตู้แห้ง", start: "2022-06-01", status: "ใช้งาน" },
  { plate: "ชม.55-9931", fleetType: "รถร่วม", vehicle: "รถ 6 ล้อใหญ่", start: "2024-03-10", status: "ใช้งาน" },
  { plate: "ชม.62-4471", fleetType: "รถบริษัท", vehicle: "รถ 12 ล้อคอก", start: "2021-11-20", status: "ซ่อมบำรุง" },
];

export function loadRoster(): FleetVehicle[] {
  try {
    const s = JSON.parse(localStorage.getItem(LS_FLEET) ?? "null");
    return Array.isArray(s) && s.length ? (s as FleetVehicle[]) : FLEET_SAMPLE.slice();
  } catch {
    return FLEET_SAMPLE.slice();
  }
}

export function saveRoster(list: FleetVehicle[]): void {
  try { localStorage.setItem(LS_FLEET, JSON.stringify(list)); } catch { /* โควตาเต็ม/โหมดส่วนตัว */ }
}

/** เหตุการณ์ของหน้าต่างเดียวกัน — storage event ไม่ยิงให้แท็บที่เขียนเอง */
const EV = "fleetRoster:changed";

export function useRoster(): [FleetVehicle[], (l: FleetVehicle[]) => void] {
  const [list, setList] = useState<FleetVehicle[]>(loadRoster);
  useEffect(() => {
    const on = () => setList(loadRoster());
    addEventListener(EV, on);
    addEventListener("storage", on);
    return () => { removeEventListener(EV, on); removeEventListener("storage", on); };
  }, []);
  const put = (l: FleetVehicle[]) => { saveRoster(l); setList(l); dispatchEvent(new Event(EV)); };
  return [list, put];
}
