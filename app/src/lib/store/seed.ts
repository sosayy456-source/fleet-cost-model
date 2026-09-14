/**
 * ใบรายการตัวอย่างสำหรับดูแดชบอร์ด — ใช้บน GitHub Pages หรือเครื่องที่ยังไม่ได้เชื่อมชีต
 *
 * บน Pages ไม่มีชีต ไม่มีใบในเครื่อง แดชบอร์ดจึงขึ้น "ยังไม่มีข้อมูล" ตลอด
 * ปุ่มนี้ใส่ใบสมมติลง IndexedDB ให้ทุกแท็บมีของดูทันที
 *
 * ต่างจากปุ่ม 🎲 ในฟอร์ม (สุ่มทีละใบ วันนี้) ตรงที่:
 *   วันที่กระจายย้อนหลัง 12 เดือน       → แท็บหลัก/กำไรรายเที่ยวมีกราฟรายเดือน
 *   ทะเบียนเป็นคันจริงจาก fleet.json     → แท็บการใช้ประโยชน์กองรถคำนวณ %ใช้งานได้
 *   ยอดครบ (recomputeTotals) + ประทับสามฝ่ายแล้ว → ไม่ไปโผล่ในใบที่ยังไม่ครบ
 *   บิลบางส่วนชำระแล้ว                  → แท็บลูกหนี้มีทั้งค้างและชำระ
 *
 * ★ ทุกใบมี docNo ขึ้นต้น "ตัวอย่าง-" และ synced=false — ล้างออกได้ด้วย clearSeed()
 *   และถ้าตั้งค่าชีตอยู่ ใบพวกนี้จะไม่ถูกส่งขึ้นเพราะไม่ได้ผ่าน saveRecord
 */
import { randomRecord } from "../../features/entry/randomRecord";
import { recomputeTotals } from "./save";
import { getAll, putMany, remove } from "./records";
import { ROLE_ORDER, stampRole } from "../record/roles";
import { FLEET_BASE, kindsOf } from "./roster";
import { todayISO } from "../record/date";
import type { TripRecord } from "../../types/record";

export const SEED_PREFIX = "ตัวอย่าง-";

const pad = (n: number) => String(n).padStart(2, "0");
const int = (lo: number, hi: number) => Math.floor(lo + Math.random() * (hi - lo + 1));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

/** วันสุ่มย้อนหลังไม่เกิน `months` เดือนจากวันนี้ (ISO) */
function randomPastDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - int(0, months - 1));
  d.setDate(int(1, 28));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function seedSampleRecords(count = 60): Promise<number> {
  const existing = await getAll();
  const already = existing.filter((r) => r.docNo?.startsWith(SEED_PREFIX)).length;
  const fleet = FLEET_BASE.filter((f) => f.status === "ใช้งาน");

  const recs: TripRecord[] = [];
  for (let i = 0; i < count; i++) {
    const base = randomRecord();
    const date = randomPastDate(12);
    const truck = fleet.length ? pick(fleet) : null;
    const kind = truck ? pick(kindsOf(truck)) : null;

    let rec: TripRecord = {
      ...base,
      docNo: `${SEED_PREFIX}${pad(already + i + 1)}`,
      date,
      releaseDate: date,
      ...(truck && kind ? { plate: truck.plate, fleetType: kind.fleetType as TripRecord["fleetType"], vehicle: kind.vehicle } : {}),
      // บิลราวครึ่งหนึ่งชำระแล้ว ให้แท็บลูกหนี้มีทั้งสองฝั่ง
      bills: base.bills.map((b) => (Math.random() < 0.5
        ? { ...b, paid: true, payDate: date > todayISO() ? todayISO() : date }
        : b)),
    };
    rec = recomputeTotals(rec);
    for (const k of ROLE_ORDER) rec = stampRole(rec, k);
    recs.push(rec);
  }
  await putMany(recs);
  return recs.length;
}

/** ลบเฉพาะใบที่ปุ่มนี้สร้าง — ใบที่กรอกเองไม่โดน */
export async function clearSeed(): Promise<number> {
  const all = await getAll();
  const mine = all.filter((r) => r.docNo?.startsWith(SEED_PREFIX));
  await Promise.all(mine.map((r) => remove(r.id)));
  return mine.length;
}
