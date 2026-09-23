/**
 * ทะเบียนรถในกองรถ (Fleet Roster) — ยกจาก v5:1455-1466 แล้วเปลี่ยนฐานข้อมูล
 *
 * ฐานกลาง = refdata/fleet.json (274 คัน สร้างจาก ทะเบียนในกองรถ.xlsx ด้วย etl/build_fleet.py)
 * ทับด้วยสิ่งที่ผู้ใช้แก้ในเครื่อง (localStorage คีย์ "fleetRoster" ตัวเดิมของ v5):
 *   เพิ่มคันใหม่  → เก็บเป็นระเบียนใหม่
 *   แก้คันในฐาน  → เก็บระเบียนทับ (จับคู่ด้วยทะเบียน)
 *   ลบคันในฐาน  → เก็บทะเบียนไว้ในรายการลบ ไม่งั้นรีโหลดแล้วโผล่กลับมา
 *
 * เก็บใน localStorage ไม่ใช่ IndexedDB เพราะเป็นรายการสั้น (หลักร้อยคัน)
 * และต้องอ่านแบบ synchronous ตอน render ตารางการใช้ประโยชน์
 *
 * ★ ตัวอย่าง 4 คันของ v5 (FLEET_SAMPLE) ที่ค้างใน localStorage ของคนที่เคยใช้ ถูกตัดทิ้งตอนอ่าน
 *   ไม่งั้นทะเบียนสมมติจะปนอยู่กับทะเบียนจริงจากไฟล์
 */
import { useEffect, useState } from "react";
import fleet from "../refdata/fleet.json";
import { canonicalVehicleName, costFleetType } from "../refdata";

export interface FleetKind {
  fleetType: string;
  vehicle: string;
  /** จำนวนเที่ยวที่วิ่งเป็นคู่นี้ในไฟล์ต้นทาง */
  trips: number;
}

export interface FleetVehicle {
  plate: string;
  /** ประเภท/ชนิดหลัก — คู่ที่วิ่งบ่อยที่สุด ใช้แสดงในตารางและแดชบอร์ด */
  fleetType: string;
  vehicle: string;
  /** วันที่เริ่มใช้งาน (ISO) — ใช้เป็นตัวหารของ %การใช้งาน */
  start: string;
  status: string;
  /**
   * ทุกคู่ (ประเภทรถ, ชนิดรถ) ที่คันนี้เคยวิ่ง — ตัวกรองทะเบียนในฟอร์มใช้ตัวนี้
   * หางพ่วงบางคันเปลี่ยนตู้ไปมา (ตู้เย็น ↔ คอก) จึงต้องโผล่ได้ทั้งสองชนิด
   * ไม่มี = คันที่ผู้ใช้เพิ่มเอง ให้ถือว่ามีคู่เดียวคือ fleetType/vehicle
   */
  kinds?: FleetKind[];
  /** สาขาที่เคยปล่อยรถคันนี้ — ข้อมูลประกอบ ไม่ได้ใช้กรอง */
  branches?: string[];
  trips?: number;
  firstTrip?: string;
  lastTrip?: string;
}

const LS_FLEET = "fleetRoster";
/** ทะเบียนจากฐานกลางที่ผู้ใช้ลบทิ้ง */
const LS_REMOVED = "fleetRoster.removed";

export const FLEET_STATUS = ["ใช้งาน", "ซ่อมบำรุง", "จอด", "ปลดระวาง"];

/** ปรับชื่อเก่าจากฐาน/localStorage เป็นชื่อมาตรฐาน โดยไม่แตะทะเบียนหรือข้อมูลอื่น */
const canonicalFleetVehicle = (f: FleetVehicle): FleetVehicle => ({
  ...f,
  vehicle: canonicalVehicleName(f.vehicle),
  ...(f.kinds ? {
    kinds: f.kinds.map((kind) => ({ ...kind, vehicle: canonicalVehicleName(kind.vehicle) })),
  } : {}),
});

/** ฐานกลางจากไฟล์ — อ่านอย่างเดียว */
export const FLEET_BASE: readonly FleetVehicle[] =
  (fleet as { vehicles: FleetVehicle[] }).vehicles.map(canonicalFleetVehicle);
const BASE_PLATES = new Set(FLEET_BASE.map((f) => f.plate));

/** ตัวอย่าง 4 คันของ v5 — เอาไว้แค่จำได้ว่าอันไหนต้องตัดทิ้ง */
const LEGACY_SAMPLE = new Set(["ชม.81-2214", "ชม.55-9931", "ชม.62-4471"]);
// ชม.70-0820 ก็อยู่ในตัวอย่างเดิม แต่เป็นทะเบียนจริงที่มีในไฟล์ จึงไม่ต้องตัด — ฐานกลางทับให้เอง

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/** ทุกคู่ประเภท/ชนิดของคันนี้ — คันที่ผู้ใช้เพิ่มเองไม่มี kinds ให้ใช้คู่หลัก */
export const kindsOf = (f: FleetVehicle): FleetKind[] =>
  f.kinds?.length ? f.kinds : [{ fleetType: f.fleetType, vehicle: f.vehicle, trips: f.trips ?? 0 }];

/**
 * คันนี้เคยวิ่งเป็นคู่ (ประเภท, ชนิด) นี้ไหม — ค่าว่าง = ไม่กรองมิตินั้น
 * ★ ฟอร์มเลือกได้แค่ รถบริษัท/รถร่วม (ฝั่งของตารางต้นทุน) ส่วนทะเบียนมีรถร่วมนอกพิเศษด้วย
 *   ซึ่งคิดต้นทุนแบบรถร่วม จึงเทียบผ่าน costFleetType ให้เลือก "รถร่วม" แล้วเห็นรถร่วมนอกพิเศษด้วย
 */
export const matchesKind = (f: FleetVehicle, fleetType: string, vehicle: string): boolean =>
  kindsOf(f).some((k) => (!fleetType || k.fleetType === fleetType || costFleetType(k.fleetType) === fleetType)
    && (!vehicle || k.vehicle === vehicle));

/** ตัดจุด/ขีด/ช่องว่างออกก่อนเทียบทะเบียน — พิมพ์แค่เลขท้าย ("1815") หรือไม่มีขีด ("7070820") ก็ต้องเจอ */
export const normPlate = (s: string): string => s.replace(/[\s.\-–—]/g, "").toLowerCase();

/**
 * ตัวกรองเลือกรถของหน้าจัดรถ (เจ้าของงานขอ 24 ก.ย. 2569 — ทะเบียนมี 899 คันแล้ว dropdown ยาวเกินหา)
 * ★ ประเภทรถเทียบ **ตรงตัว** ต่างจาก matchesKind ของฟอร์ม — ในตัวกรองมีสามตัวเลือก เลือก "รถร่วม"
 *   ต้องได้รถร่วมเท่านั้น ไม่รวมรถร่วมนอกพิเศษ (การคิดต้นทุนแบบรถร่วมเป็นอีกเรื่อง อยู่ที่ costFleetType)
 * ★ ดูทุกคู่ประเภท/ชนิดที่คันนั้นเคยวิ่ง (kinds) เหมือนฟอร์ม — หางที่เปลี่ยนตู้ไปมาต้องโผล่ได้ทุกชนิด
 */
export function filterRoster(
  roster: readonly FleetVehicle[],
  f: { fleetType?: string; vehicle?: string; q?: string },
): FleetVehicle[] {
  const key = normPlate(f.q ?? "");
  return roster.filter((v) =>
    kindsOf(v).some((k) => (!f.fleetType || k.fleetType === f.fleetType) && (!f.vehicle || k.vehicle === f.vehicle))
    && (!key || normPlate(v.plate).includes(key)));
}

/** รายการคันที่ตรงกับตัวกรองในฟอร์ม — 1 ระเบียนต่อทะเบียน จึงใช้ length เป็นจำนวนคันได้ตรง ๆ */
export const vehiclesForKind = (
  roster: readonly FleetVehicle[],
  fleetType: string,
  vehicle: string,
): FleetVehicle[] => roster.filter((f) => matchesKind(f, fleetType, vehicle));

export function loadRoster(): FleetVehicle[] {
  const stored = readJson<FleetVehicle[]>(LS_FLEET, []);
  const removed = new Set(readJson<string[]>(LS_REMOVED, []));
  const list = Array.isArray(stored) ? stored : [];

  const byPlate = new Map<string, FleetVehicle>();
  for (const f of FLEET_BASE) if (!removed.has(f.plate)) byPlate.set(f.plate, f);
  for (const raw of list) {
    const f = canonicalFleetVehicle(raw);
    if (!f?.plate || LEGACY_SAMPLE.has(f.plate)) continue;
    // ค่าที่ผู้ใช้แก้ทับของฐาน — คง kinds/branches ของฐานไว้ ถ้าผู้ใช้ไม่ได้ส่งมา
    const base = byPlate.get(f.plate);
    byPlate.set(f.plate, base ? { ...base, ...f, kinds: f.kinds ?? base.kinds } : f);
  }
  return [...byPlate.values()];
}

/**
 * บันทึกรายการทั้งชุด — เก็บเฉพาะส่วนต่างจากฐานกลาง
 * (คันที่เพิ่มเอง + คันในฐานที่ถูกแก้ + รายการทะเบียนที่ลบ)
 */
export function saveRoster(list: FleetVehicle[]): void {
  const baseBy = new Map(FLEET_BASE.map((f) => [f.plate, f] as const));
  const keep = new Set(list.map((f) => f.plate));

  const diff = list.filter((f) => {
    const b = baseBy.get(f.plate);
    if (!b) return true;
    return b.fleetType !== f.fleetType || b.vehicle !== f.vehicle || b.start !== f.start || b.status !== f.status;
  });
  const removed = FLEET_BASE.filter((f) => !keep.has(f.plate)).map((f) => f.plate);

  try {
    localStorage.setItem(LS_FLEET, JSON.stringify(diff));
    localStorage.setItem(LS_REMOVED, JSON.stringify(removed));
  } catch { /* โควตาเต็ม/โหมดส่วนตัว */ }
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
  const put = (l: FleetVehicle[]) => { saveRoster(l); setList(loadRoster()); dispatchEvent(new Event(EV)); };
  return [list, put];
}

/** คันนี้อยู่ในฐานกลางจากไฟล์ไหม (ไม่ใช่ที่ผู้ใช้เพิ่มเอง) */
export const isBasePlate = (plate: string): boolean => BASE_PLATES.has(plate);
