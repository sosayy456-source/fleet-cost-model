/**
 * ตัวหารของอัตราค่าซ่อม (ตารางที่ 2 "ข้อมูลการปฏิบัติงาน") จากข้อมูลในโมเดลเอง — ไม่ต้องให้ผู้ใช้หาไฟล์มาแนบ
 * (เจ้าของงานสั่ง 23 ก.ย. 2569: หน้าอัปเดตอัตราค่าซ่อมรับแค่รายงานค่าซ่อมไฟล์เดียว)
 *
 * ที่มา: costrev/trips.json (ไฟล์ต้นทุน ชุดเดียวกับ Executive Dashboard) **ทุกเที่ยว** ไม่กรอง m
 *   ระยะทางรวม   = Σ km ของเที่ยว (จากตารางเส้นทางของโมเดล) — เที่ยวที่ km = null ไม่มีระยะทางให้บวก นับไว้แจ้งผู้ใช้
 *   จำนวนวันรวม  = จำนวน (ทะเบียน, วันที่ปล่อยรถ) ไม่ซ้ำ — "วันที่รถออกวิ่ง" (เจ้าของงานเลือก)
 *                 เข้ากับ computeCost ที่บวกค่าซ่อมตามเวลา 1 วันต่อใบรายการ ยอดที่คิดกลับจึงครบพอดีกับค่าใช้จ่ายจริง
 *   ยุบตาม ปี พ.ศ. × ชนิดรถ × ประเภทรถ (รูปเดียวกับ OpRow ที่ parseOperations อ่านจากไฟล์)
 *
 * ★ ใบหนึ่งมีได้ถึง 3 คัน (vs[]: หัว · คันที่ 2 · หางพ่วง) — ทุกคันวิ่งระยะทางเดียวกันและออกวันเดียวกัน
 *   **หางเทรลเลอร์ข้ามเมื่อ mergeTrailer** เพราะ computeRates ยุบชื่อหางเข้าหัวลากทั้งฝั่งค่าซ่อมและฝั่งตัวหาร
 *   ถ้านับหางด้วย ระยะทาง/วันของหัวลากจะเบิ้ลสองเท่า อัตราต่ำไปครึ่งหนึ่ง
 * ★ **ตัวหารต้องเป็นช่วงเดียวกับค่าซ่อม** (opts.months) — รายงานค่าซ่อมเดือนมกราคมของแต่ละปี ถ้าหารด้วยวัน/ระยะทาง
 *   ทั้งปี อัตราจะต่ำไป ~12 เท่า (เจอจริง 24 ก.ย. 2569: 10 ล้อตู้แห้ง 39.9 แทน ~1,700) · ปีที่รายงานไม่บอกเดือนใช้ทั้งปี
 * ★ รถร่วมนอกพิเศษ = ฝั่งรถร่วม (กติกาเดียวกับทั้งระบบ) — ตารางค่าซ่อมมีแค่แท็บรถบริษัท/รถร่วม
 */
import type { Trip } from "../data/useCostRev";
import type { OpRow } from "./rates";
import { isTrailerTail } from "./rates";

const fleetOf = (ft: string): string => (ft.startsWith("รถร่วม") ? "รถร่วม" : ft);

export interface OpsFromTrips {
  rows: OpRow[];
  trips: number;
  /** เที่ยวที่ไม่มีระยะทาง (เส้นทางไม่อยู่ในตาราง) — วันยังนับ แต่ระยะทางไม่ได้บวก */
  noKm: number;
  /** ปี พ.ศ. ที่มีเที่ยว */
  years: number[];
  /** ปี พ.ศ. → จำนวนเดือนที่มีเที่ยว — ปีที่ไม่ครบ 12 เดือนเทียบกับรายงานค่าซ่อมทั้งปีแล้วอัตราจะสูงเกินจริง */
  months: Record<number, number>;
}

/** ปี พ.ศ. → เดือน (1–12) ที่มีค่าซ่อมในรายงาน · ปีที่ไม่อยู่ใน map หรือเป็นเซ็ตว่าง = ใช้ทั้งปี */
export type MonthsByYear = Map<number, Set<number>>;

export function monthsOfMaint(rows: { year: number; month?: number | null }[]): MonthsByYear {
  const out: MonthsByYear = new Map();
  const wholeYear = new Set<number>();
  for (const r of rows) {
    if (!r.month) { wholeYear.add(r.year); continue; }
    (out.get(r.year) ?? out.set(r.year, new Set()).get(r.year)!).add(r.month);
  }
  // ปีที่มีบางบรรทัดบอกแค่ปี — ไม่รู้ว่าเป็นเดือนไหน ต้องใช้ทั้งปี
  for (const y of wholeYear) out.delete(y);
  return out;
}

export function opsFromTrips(trips: Trip[], opts: { mergeTrailer?: boolean; months?: MonthsByYear } = {}): OpsFromTrips {
  const acc = new Map<string, { row: OpRow; days: Set<string> }>();
  let noKm = 0;
  const years = new Set<number>();
  const monthsOf = new Map<number, Set<string>>();
  for (const t of trips) {
    if (!t.y || !t.vk) continue;
    const year = t.y + 543;
    const want = opts.months?.get(year);
    if (want?.size && !want.has(Number(t.mo.slice(5)))) continue;
    years.add(year);
    (monthsOf.get(year) ?? monthsOf.set(year, new Set()).get(year)!).add(t.mo);
    if (t.km == null) noKm++;
    const cars = t.vs?.length ? t.vs : [{ pl: t.pl, vk: t.vk, ft: t.ft }];
    for (const c of cars) {
      if (!c.vk || (opts.mergeTrailer && isTrailerTail(c.vk))) continue;
      const fleet = fleetOf(c.ft);
      const k = `${year}|${fleet}|${c.vk}`;
      let a = acc.get(k);
      if (!a) {
        a = { row: { year, vehicle: c.vk, fleet, km: 0, days: 0 }, days: new Set() };
        acc.set(k, a);
      }
      a.row.km += t.km ?? 0;
      // ทะเบียนว่างนับเป็นวันของใบนั้นแทน — ไม่งั้นเที่ยวไร้ทะเบียนทั้งหมดจะรวมเหลือวันเดียวต่อวันที่
      a.days.add(`${c.pl || t.id}|${t.d}`);
    }
  }
  const rows = [...acc.values()].map(({ row, days }) => ({ ...row, days: days.size }));
  const months: Record<number, number> = {};
  for (const [y, s] of monthsOf) months[y] = s.size;
  return { rows, trips: trips.length, noKm, years: [...years].sort((a, b) => a - b), months };
}
