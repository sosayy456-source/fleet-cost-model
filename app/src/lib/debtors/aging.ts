/**
 * สถานะและวันที่เกินกำหนดของใบวางบิล ณ วันที่เลือก — ย้ายมาจาก features/dash-demo/OverdueSection.tsx (25 ก.ย. 2569)
 * ให้ส่วน DSO กับคะแนน DSO ของ Performance Index (lib/pi/score.ts) นับด้วยกติกาเดียวกัน
 *
 *   อยู่ในขอบเขต   = วางบิลไม่เกินวันที่เลือก           ชำระแล้ว = วันที่จบ ≤ วันที่เลือก
 *   ค้างชำระ       = ยังไม่จบ และครบกำหนดก่อนวันที่เลือก  ยังไม่ถึงกำหนด = ยังไม่จบ และครบกำหนดตั้งแต่วันที่เลือกขึ้นไป
 *   over = วันที่เกินกำหนด — ยังไม่ชำระ: นับถึงวันที่เลือก (ติดลบ = อีกกี่วันถึงกำหนด) · ชำระแล้ว: วันที่จบ − วันครบกำหนด
 * เทียบวันที่เป็นสตริง ISO ได้ตรง ๆ เพราะ ETL เขียนเป็น YYYY-MM-DD ทุกช่อง
 */
import type { DebtorRow } from "../data/useDebtors";

/** จำนวนวันระหว่างสองวันที่ ISO (a − b) — คิดเป็น UTC เพื่อไม่ให้เวลาออมแสง/โซนเวลามาปนตอนหาร 86,400,000 */
export const dayNum = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

export type AgedStatus = "paid" | "over" | "notdue";
export interface Aged { r: DebtorRow; status: AgedStatus; over: number }

/** ทุกใบที่วางบิลแล้ว ณ วันที่เลือก พร้อมสถานะและวันที่เกินกำหนด */
export function ageBills(rows: DebtorRow[], asOf: string): Aged[] {
  const d0 = dayNum(asOf);
  const out: Aged[] = [];
  for (const r of rows) {
    if (r.issue > asOf) continue;                       // ยังไม่วางบิล ณ วันนั้น
    if (r.close && r.close <= asOf) { out.push({ r, status: "paid", over: dayNum(r.close) - dayNum(r.due) }); continue; }
    const over = d0 - dayNum(r.due);
    out.push({ r, status: over > 0 ? "over" : "notdue", over });
  }
  return out;
}
