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

/**
 * วันเก็บเงินเฉลี่ยรายลูกค้า ณ วันที่เลือก — คะแนน DSO ของ Performance Index ("แก้ Performance Index.pdf" 28 ก.ย. 2569)
 * ต่อบิล: ชำระแล้ว = วันที่จบ − วันวางบิล · ยังไม่ชำระ = วันที่เลือก − วันวางบิล (ยังเก็บไม่ได้ก็นับวันที่รอไปเรื่อย ๆ)
 * ต่อลูกค้า = ค่าเฉลี่ยของทุกบิลที่วางแล้ว ณ วันนั้น (เฉลี่ยตรง ๆ ไม่ถ่วงยอดเงิน) · ลูกค้า = รหัสลูกหนี้ (cust)
 */
export function collectionDays(rows: DebtorRow[], asOf: string): number[] {
  return [...collectionDaysBy(rows, asOf).values()];
}

/** เหมือน collectionDays แต่คืนรายลูกค้า (cust → วัน) — ตารางลูกค้าที่ค้างชำระของ Manager Dashboard ให้สีรายแถว */
export function collectionDaysBy(rows: DebtorRow[], asOf: string): Map<string, number> {
  const d0 = dayNum(asOf);
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (r.issue > asOf) continue;
    const end = r.close && r.close <= asOf ? dayNum(r.close) : d0;
    const a = acc.get(r.cust) ?? { sum: 0, n: 0 };
    a.sum += end - dayNum(r.issue); a.n++;
    acc.set(r.cust, a);
  }
  return new Map([...acc].map(([c, a]) => [c, a.sum / a.n]));
}

/** วันสุดท้ายของไฟล์ลูกหนี้ = วันวางบิล/วันที่จบที่ล่าสุด — ชุดอ้างอิง DSO ของ PI นับบิลที่ยังค้างถึงวันนี้ */
export function debtorFileEnd(rows: DebtorRow[]): string {
  return rows.reduce((m, r) => { const d = r.close && r.close > r.issue ? r.close : r.issue; return d > m ? d : m; }, "");
}
