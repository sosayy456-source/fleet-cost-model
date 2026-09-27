/**
 * ตัวเลขของแท็บ "Executive Summary" (หน้า Executive Summary · ภาพที่เจ้าของงานส่ง 28 ก.ย. 2569)
 *
 *   การ์ด 4 ใบ     = Σรายได้ · Σต้นทุน · Σกำไร · %Margin = Σกำไร ÷ Σรายได้ ของชุด inProfitScope() (ผู้เรียกคัดมาแล้ว)
 *   กราฟน้ำตก     = รายได้ → น้ำมัน → คนขับ (เบี้ยเลี้ยง/ค่าแรง) → ค่าเสื่อม + ค่าซ่อม (fixedOf + semiOf) → อื่น ๆ (= ต้นทุนที่เหลือทั้งหมด:
 *                   ค่าธรรมเนียม · ค่าเช่า · สูญเปล่า · อื่น ๆ) → กำไร — แบ่งก้อนตาม tooltip ของต้นแบบ "Nim Transport Executive Dashboard.html"
 *                   ก้อนต้นทุนรวมกันเท่า Σต้นทุนพอดี แท่งกำไรจึงลงที่ Σรายได้ − Σต้นทุน
 *   เที่ยววิ่งเปล่า/ปี = Σต้นทุนของเที่ยวเปล่า × 12 ÷ จำนวนเดือนที่ชุดมีเที่ยว (ปรับเป็นรายปี — ไฟล์ไม่ครบปีก็เทียบได้)
 *   ลูกค้าขาดทุน  = สัดส่วนรายที่กำไรสุทธิ < 0 (กำไร 0 นับเป็นทำกำไร ตามการ์ดของ Customer Performance) · ขาดทุนสะสม = Σ|กำไร| ของรายที่ขาดทุน
 */
import type { Trip } from "../data/useCostRev";

type CostTrip = Pick<Trip, "rev" | "cost" | "profit" | "fuel" | "allow" | "dep" | "repair" | "empty" | "mo">;

export interface ExecTotals { rev: number; cost: number; profit: number; margin: number | null; n: number }

export function execTotals(trips: CostTrip[]): ExecTotals {
  let rev = 0, cost = 0, profit = 0;
  for (const t of trips) { rev += t.rev; cost += t.cost; profit += t.profit; }
  return { rev, cost, profit, margin: rev ? profit / rev * 100 : null, n: trips.length };
}

export interface CostSteps { fuel: number; driver: number; depRepair: number; other: number }

/** ก้อนต้นทุนของกราฟน้ำตก — "อื่น ๆ" = ต้นทุนรวม − สามก้อนแรก (ติดลบได้ถ้าไฟล์ปันต้นทุนไม่ครบ) */
export function costSteps(trips: CostTrip[]): CostSteps {
  let fuel = 0, driver = 0, depRepair = 0, cost = 0;
  for (const t of trips) { fuel += t.fuel; driver += t.allow; depRepair += t.dep + t.repair; cost += t.cost; }
  return { fuel, driver, depRepair, other: cost - fuel - driver - depRepair };
}

/** ต้นทุนเที่ยววิ่งเปล่าปรับเป็นรายปี · null = ไม่มีเที่ยวเลย */
export function emptyCostPerYear(trips: CostTrip[]): { perYear: number; months: number } | null {
  const months = new Set<string>();
  let cost = 0;
  for (const t of trips) {
    months.add(t.mo);
    if (t.empty) cost += t.cost;
  }
  return months.size ? { perYear: cost * 12 / months.size, months: months.size } : null;
}

/** ลูกค้าที่ขาดทุน — rows = รายลูกค้าหลังยุบตามช่วงเวลา (rollupCustomers) · null = ไม่มีลูกค้า */
export function customerLoss(rows: { profit: number }[]): { share: number; loss: number; n: number; total: number } | null {
  if (!rows.length) return null;
  const losing = rows.filter((r) => r.profit < 0);
  return {
    share: losing.length / rows.length * 100,
    loss: losing.reduce((s, r) => s - r.profit, 0),
    n: losing.length, total: rows.length,
  };
}
