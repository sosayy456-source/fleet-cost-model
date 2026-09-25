/**
 * Route & Service Profitability Index — ค่ารายการของสองตัวชี้วัด (ตาราง "Performance Index.pdf" 25 ก.ย. 2569)
 *
 *   Route          = %Margin ของแต่ละเส้นทาง (rt) · Service group = %Margin ของแต่ละกลุ่มบริการบนการ์ดท้าย Profit Per Route
 *   %Margin        = Σกำไร ÷ Σรายได้ × 100 — เท่ากับ "กำไรเฉลี่ยรายเที่ยว ÷ รายได้เฉลี่ยรายเที่ยว" ตามคำในตาราง
 *                    (ไม่เฉลี่ย %Margin รายเที่ยว: เที่ยวเปล่ารายได้ 0 หารไม่ได้ และเที่ยวเล็กดึงค่าแรงเกินน้ำหนัก)
 * ★ รายได้ 0 แล้วขาดทุน = −100% กติกาเดียวกับตารางจัดอันดับเส้นทาง · รายได้ 0 ไม่ขาดทุน = ไม่นับ (NaN → tally ข้าม)
 * ★ ตารางเขียนว่า "% ของสาขา" แต่ตัวชี้วัดชื่อ Route อยู่ใต้ Profit Per Route จึงนับรายเส้นทาง — ถ้าเจ้าของงานหมายถึงสาขา
 *   เปลี่ยนคีย์ที่ routeMarginValues() ที่เดียว
 */

/** ฟิลด์ที่ใช้ของ Trip — เทสต์จะได้ไม่ต้องสร้าง Trip เต็มตัว */
export interface MarginTrip { rt: string; sg: string; rev: number; profit: number }

/** กลุ่มบริการที่ทำเป็นการ์ดท้าย Profit Per Route — ชื่อต้องตรงกับ sg ที่ ETL เติมจากประเภทสินค้าในบิล */
export const SERVICE_GROUPS = ["สินค้าทั่วไป", "สินค้าแช่เย็น", "สินค้าแช่แข็ง"] as const;

/** %Margin ของกลุ่มเที่ยว · รายได้ 0 แล้วขาดทุน = −100 · รายได้ 0 ไม่ขาดทุน = null (เจ้าของงานเลือก 21 ก.ย. 2569) */
export const routeMargin = (rev: number, profit: number): number | null =>
  rev ? profit / rev * 100 : profit < 0 ? -100 : null;

function sums<T extends MarginTrip>(trips: T[], key: (t: T) => string): Map<string, { rev: number; profit: number }> {
  const m = new Map<string, { rev: number; profit: number }>();
  for (const t of trips) {
    const k = key(t);
    const a = m.get(k) ?? { rev: 0, profit: 0 };
    a.rev += t.rev;
    a.profit += t.profit;
    m.set(k, a);
  }
  return m;
}

/** %Margin ของทุกเส้นทาง — นับไม่ได้ = NaN */
export function routeMarginValues(trips: MarginTrip[]): number[] {
  return [...sums(trips, (t) => t.rt).values()].map((a) => routeMargin(a.rev, a.profit) ?? NaN);
}

/** %Margin ของ 3 กลุ่มบริการ — กลุ่มที่ไม่มีเที่ยว/รายได้ 0 = NaN (ไม่นับ) ตรงกับการ์ดที่ขึ้น "–" */
export function serviceMarginValues(trips: MarginTrip[]): number[] {
  const m = sums(trips.filter((t) => (SERVICE_GROUPS as readonly string[]).includes(t.sg)), (t) => t.sg);
  return SERVICE_GROUPS.map((g) => { const a = m.get(g); return a?.rev ? a.profit / a.rev * 100 : NaN; });
}
