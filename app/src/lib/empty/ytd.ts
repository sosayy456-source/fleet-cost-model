/**
 * มูลค่าเที่ยววิ่งเปล่าแบบ YTD เทียบปีก่อนช่วงเดือนเดียวกัน — การ์ดใบแรกของแท็บ "เที่ยววิ่งเปล่า" (Executive Dashboard)
 * เจ้าของงานสั่ง 24 ก.ย. 2569 ให้ส่วนเปรียบเทียบใต้การ์ดมี 3 บรรทัด:
 *   1. ค่าเฉลี่ยต่อเดือน = ต้นทุนเที่ยวเปล่าในช่วง ÷ จำนวนเดือนในช่วง
 *   2. % ของต้นทุนวิ่งรวม = ต้นทุนเที่ยวเปล่า ÷ ต้นทุนทุกเที่ยว (รวมเที่ยวเปล่า) ในช่วงเดียวกัน
 *   3. YoY = (ต้นทุนเที่ยวเปล่าช่วงนี้ปี Y − ช่วงเดียวกันปี Y−1) ÷ ช่วงเดียวกันปี Y−1 × 100
 *      จำนวนเดือนเท่ากันสองฝั่ง จึงเท่ากับเทียบค่าเฉลี่ยต่อเดือน ("ม.ค.–พ.ค. 69 สูงกว่า ม.ค.–พ.ค. 68 อยู่ 14.2%")
 *
 * ช่วงเดือน (ytdMonths): เลือกเดือน = เดือนนั้นเดือนเดียว · ไม่เลือก = ม.ค. ถึงเดือนสุดท้ายที่ปีนั้นมีข้อมูล
 *   ("เต็มปีไหม" ดูจากข้อมูลทั้งชุด ไม่ใช่ตัวกรอง — กติกาเดียวกับป้าย "ปีนี้ยังไม่เต็มปี" เดิม)
 */
import { TH_MONTHS } from "../record/date";

/** ฟิลด์ที่ใช้ของ Trip — รับแค่นี้ เทสต์จะได้ไม่ต้องสร้าง Trip เต็มตัว */
export interface YtdTrip { y: number; mo: string; cost: number; empty: boolean }

export interface EmptyYtd {
  year: number;
  /** เดือนในช่วง 1–12 เรียงแล้ว */
  months: number[];
  emptyCost: number;
  totalCost: number;
  avgPerMonth: number;
  /** % ของต้นทุนวิ่งรวม · null = ช่วงนี้ไม่มีต้นทุนเลย */
  share: number | null;
  /** ต้นทุนเที่ยวเปล่าปีก่อนช่วงเดียวกัน · null = ปีก่อนไม่มีเที่ยวในช่วงนี้เลย (ไม่ใช่ 0) */
  prevEmpty: number | null;
  /** % เปลี่ยนจากปีก่อน · null = ไม่มีปีก่อน หรือปีก่อนเที่ยวเปล่า 0 บาท (หารไม่ได้) */
  yoy: number | null;
}

/** ช่วงเดือนของการ์ด — allTrips = ทุกเที่ยวในชุด (ไม่ผ่านตัวกรอง) ใช้หาเดือนสุดท้ายที่ปีนั้นมีข้อมูล */
export function ytdMonths(allTrips: YtdTrip[], year: number, month: string): number[] {
  if (month) return [Number(month)];
  let last = 0;
  for (const t of allTrips) if (t.y === year) last = Math.max(last, Number(t.mo.slice(5, 7)));
  return Array.from({ length: last }, (_, i) => i + 1);
}

/** rows = เที่ยวที่ผ่านตัวกรองทุกตัว **ยกเว้นปี** (ต้องมีปีก่อนติดมาด้วย) */
export function emptyYtd(rows: YtdTrip[], year: number, months: number[]): EmptyYtd {
  const inRange = new Set(months);
  let emptyCost = 0, totalCost = 0, prevEmpty = 0, prevN = 0;
  for (const t of rows) {
    if (!inRange.has(Number(t.mo.slice(5, 7)))) continue;
    if (t.y === year) {
      totalCost += t.cost;
      if (t.empty) emptyCost += t.cost;
    } else if (t.y === year - 1) {
      prevN++;
      if (t.empty) prevEmpty += t.cost;
    }
  }
  return {
    year, months, emptyCost, totalCost,
    avgPerMonth: months.length ? emptyCost / months.length : 0,
    share: totalCost ? emptyCost / totalCost * 100 : null,
    prevEmpty: prevN ? prevEmpty : null,
    yoy: prevN && prevEmpty ? (emptyCost - prevEmpty) / prevEmpty * 100 : null,
  };
}

/**
 * % ต้นทุนเที่ยวเปล่ารายปี (ตัวเลขใหญ่ + เส้นแนวโน้มของการ์ดแรก) — ปัด 2 ตำแหน่ง
 * rows = ผ่านตัวกรองทุกตัว **ยกเว้นปี** การ์ดจะเทียบปีก่อนและวาดเส้นได้แม้กรองปีอยู่
 */
export function yearShares(rows: YtdTrip[]): { y: number; share: number }[] {
  const m = new Map<number, { cost: number; empty: number }>();
  for (const t of rows) {
    const a = m.get(t.y) ?? { cost: 0, empty: 0 };
    a.cost += t.cost;
    if (t.empty) a.empty += t.cost;
    m.set(t.y, a);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
    .map(([y, a]) => ({ y, share: a.cost ? Math.round(a.empty / a.cost * 10000) / 100 : 0 }));
}

const yy = (y: number): string => String((y + 543) % 100).padStart(2, "0");

/** ป้ายช่วง — "YTD ม.ค.–พ.ค. 69" · ครบ 12 เดือน "ทั้งปี 68" · เลือกเดือน "มี.ค. 69" */
export function ytdLabel(year: number, months: number[], pickedMonth: boolean): string {
  if (!months.length) return `ปี ${yy(year)}`;
  const a = TH_MONTHS[months[0]! - 1], b = TH_MONTHS[months[months.length - 1]! - 1];
  if (pickedMonth) return `${a} ${yy(year)}`;
  if (months.length === 12) return `ทั้งปี ${yy(year)}`;
  return `YTD ${a === b ? a : `${a}–${b}`} ${yy(year)}`;
}

/** ปี พ.ศ. สองหลักของปีก่อน — ใช้ในบรรทัด "เทียบ YoY (68)" */
export const prevYY = (year: number): string => yy(year - 1);
