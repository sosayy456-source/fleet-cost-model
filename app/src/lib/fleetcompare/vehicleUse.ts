/**
 * %การใช้งานรายคัน เทียบกับทะเบียนรถในกองรถ — ย้ายจากเมนูแดชบอร์ด (dash-fleet) มาแท็บ
 * "การใช้ประโยชน์ของกองรถ" ของ Executive Dashboard (เจ้าของงานสั่ง 24 ก.ย. 2569)
 *
 *   %การใช้งาน = วันที่มีเที่ยววิ่งจริง (นับวันไม่ซ้ำ) ÷ วันที่พร้อมใช้งาน × 100
 *
 * ★ ต่างจากตัวเดิมใน dash-fleet สองข้อ ตั้งใจ:
 *   1. **วันที่พร้อมใช้งานนับเฉพาะช่วงที่ไฟล์ต้นทุนมีข้อมูล** (เที่ยวแรก–เที่ยวสุดท้ายของไฟล์) ไม่ใช่ถึงวันนี้
 *      ไฟล์ต้นทุนตัดยอดไว้ที่เดือนหนึ่ง (ชุดตัวอย่างถึง 2 มิ.ย. 2569) ถ้านับถึงวันนี้ ทุกคันจะโดนหารด้วย
 *      วันที่ไม่มีข้อมูลให้วิ่ง % ต่ำเกินจริงทั้งกอง
 *   2. **ตัวกรองปี/เดือนตัดทั้งตัวเศษและตัวหาร** — ตัวเดิมนับวันพร้อมใช้งานตั้งแต่วันเริ่มใช้งานเสมอ
 *      แม้เลือกปีเดียว ตัวเศษเป็นวันในปีนั้นแต่ตัวหารเป็นหลายปี
 * ★ ข้อมูลรายคันมาจาก FleetSlice (ใบหนึ่งมีได้ถึง 3 ทะเบียน นับเที่ยวให้ทุกคันในใบ) ส่วนวันที่/ระยะทาง
 *   อ่านจากเที่ยวเดิมผ่าน id — รถทุกคันในใบวิ่งระยะทางเท่ากันทั้งใบ
 */
import type { Trip } from "../data/useCostRev";
import type { FleetSlice } from "./utilization";

export interface UseVehicle {
  plate: string; fleetType: string; vehicle: string; start: string; status: string;
}

export interface VehicleUseRow {
  v: UseVehicle;
  /** เที่ยว (ใบไม่ซ้ำ) · กม.รวม · วันที่มีเที่ยว (ไม่ซ้ำ) */
  n: number; km: number; activeDays: number;
  /** null = ไม่รู้วันเริ่มใช้งาน คิดไม่ได้ */
  availDays: number | null;
  pct: number | null;
}

/** ช่วงข้อมูลของไฟล์ + เดือนที่ตัวกรองยอมให้นับ (YYYY-MM) */
export interface UseWindow { from: string; to: string; monthOk: (mo: string) => boolean }

const DAY = 86_400_000;
const utc = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** วันที่พร้อมใช้งานในช่วงข้อมูล — ตั้งแต่ max(วันเริ่มใช้งาน, วันแรกของไฟล์) ถึงวันสุดท้ายของไฟล์ เฉพาะเดือนที่ผ่านตัวกรอง */
export function availableDays(start: string, w: UseWindow): number | null {
  if (!start || !w.from || !w.to) return null;
  const a = Math.max(utc(start), utc(w.from));
  const b = utc(w.to);
  let days = 0;
  for (let d = a; d <= b; d += DAY) if (w.monthOk(iso(d).slice(0, 7))) days++;
  return days;
}

/** แถวรายคันของทุกคันในทะเบียน (รถที่ไม่มีเที่ยวเลยได้ 0%) · เรียง %การใช้งานมากไปน้อย */
export function vehicleUse(roster: UseVehicle[], rows: FleetSlice[], trips: Trip[], w: UseWindow): VehicleUseRow[] {
  const byId = new Map(trips.map((t) => [t.id, t] as const));
  const idsOf = new Map<string, Set<string>>();
  for (const r of rows) {
    const s = idsOf.get(r.pl) ?? new Set<string>();
    s.add(r.id);
    idsOf.set(r.pl, s);
  }
  return roster.map((v) => {
    const own = [...(idsOf.get(v.plate) ?? [])].map((id) => byId.get(id)).filter((t): t is Trip => !!t);
    const km = own.reduce((s, t) => s + (t.km ?? 0), 0);
    const activeDays = new Set(own.map((t) => t.d).filter(Boolean)).size;
    const availDays = availableDays(v.start, w);
    // วันพร้อมใช้งาน 0 วัน (เริ่มใช้งานหลังช่วงข้อมูล / ตัวกรองไม่เหลือวันให้นับ) = หารไม่ได้ ไม่ใช่ 0%
    const pct = availDays ? Math.min(100, Math.round(activeDays / availDays * 100)) : null;
    return { v, n: own.length, km, activeDays, availDays, pct };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

/** ประเภทรถที่นับเข้าค่าเฉลี่ย — รถร่วมนอกพิเศษเป็นรถจรเรียกครั้งคราว ไม่ใช่กองรถประจำ (เจ้าของงานเคาะ 24 ก.ย. 2569) */
export const AVG_FLEET_TYPES: ReadonlySet<string> = new Set(["รถบริษัท", "รถร่วม"]);

/**
 * ค่าเฉลี่ยของ %การใช้งาน — เฉพาะรถบริษัท + รถร่วม ที่คิดได้ (รู้วันเริ่มใช้งาน)
 * ตารางรายคันยังแสดงทุกคันในทะเบียน รวมรถร่วมนอกพิเศษ
 */
export function avgUse(rows: VehicleUseRow[]): number {
  const ok = rows.filter((r) => r.pct != null && AVG_FLEET_TYPES.has(r.v.fleetType));
  return ok.length ? Math.round(ok.reduce((s, r) => s + (r.pct ?? 0), 0) / ok.length) : 0;
}

/** ระยะทางรวมของทุกเที่ยว (ใบไม่ซ้ำ) + จำนวนเที่ยวที่ไม่มีระยะทาง — เที่ยวที่ไม่รู้ระยะทางไม่นับเป็น 0 */
export function totalKm(rows: FleetSlice[], trips: Trip[]): { km: number; noKm: number } {
  const ids = new Set(rows.map((r) => r.id));
  let km = 0, noKm = 0;
  for (const t of trips) {
    if (!ids.has(t.id)) continue;
    if ((t.km ?? 0) > 0) km += t.km!; else noKm++;
  }
  return { km, noKm };
}
