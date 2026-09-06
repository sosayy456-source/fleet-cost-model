/**
 * แปลงลูกหนี้ (ใบใหม่ + แท็บข้อมูลเก่า) ให้เป็นแถวรูปแบบเดียวกัน
 * ยกจาก unifyDebtRows() ใน index.html บน main:2925
 *
 * ทั้งหน้า “รายการลูกหนี้” และแท็บลูกหนี้ในแดชบอร์ดอ่านจากฟังก์ชันนี้ตัวเดียว
 * เพราะ main ก็ใช้ร่วมกัน ถ้าแยกกันเขียนตัวเลขสองหน้าจะเริ่มไม่ตรงกันเงียบ ๆ
 */
import { billIsPaid, billPayDate, recBills } from "./payment";
import { daysBetween, todayISO } from "./date";
import type { OldDebtor } from "../store/useRecords";
import type { TripRecord } from "../../types/record";

/** สินค้าประเภทนี้คือการตัดหนี้สูญ ไม่นับเป็นลูกหนี้ค้างชำระ */
export const CLEARED = "บิลเคลียร์";

export interface DebtRow {
  key: string;
  old: boolean;
  src: "ใหม่" | "เก่า";
  date: string;
  docNo: string;
  no: string;
  goodsType: string;
  origin: string;
  dest: string;
  sender: string;
  receiver: string;
  payType: string;
  paid: boolean;
  payDate: string | null;
  qty: number;
  total: number;
  /** ค้างมากี่วัน — null เมื่อชำระแล้ว */
  aging: number | null;
  /** ใช้เวลากี่วันกว่าจะจ่าย — null เมื่อยังไม่จ่าย */
  daysToPay: number | null;
  sheetName?: string;
  /** มีเฉพาะบิลของใบใหม่ ใช้กดบันทึกการชำระ */
  recId?: string;
  billIndex?: number;
}

export type DebtFilter = "all" | "new" | "old";

/** สถานะของแถว — cleared มาก่อน paid เสมอ (v5:3798) */
export const debtStatus = (x: DebtRow): "cleared" | "paid" | "unpaid" =>
  x.goodsType === CLEARED ? "cleared" : (x.paid ? "paid" : "unpaid");

export function unifyDebtRows(
  records: TripRecord[],
  oldDebtors: OldDebtor[],
  filter: DebtFilter = "all",
): DebtRow[] {
  const today = todayISO();
  const out: DebtRow[] = [];

  if (filter !== "old") {
    for (const r of records) {
      recBills(r).forEach((b, i) => {
        const paid = billIsPaid(b);
        const pd = billPayDate(b, r);
        out.push({
          key: `${r.id}#${i}`, old: false, src: "ใหม่",
          date: r.date, docNo: r.docNo, no: b.no, goodsType: b.goodsType,
          origin: b.origin || r.origin, dest: b.dest || r.dest,
          sender: b.sender, receiver: b.receiver, payType: b.payType || "",
          paid, payDate: pd, qty: Number(b.qty) || 0, total: Number(b.total) || 0,
          aging: paid ? null : daysBetween(r.date, today),
          daysToPay: pd ? daysBetween(r.date, pd) : null,
          recId: r.id, billIndex: i,
        });
      });
    }
  }

  if (filter !== "new") {
    oldDebtors.forEach((d, i) => {
      const paid = d.paid === true || d.status === "ชำระแล้ว";
      const date = String(d.date ?? "");
      const payDate = (d.payDate as string | undefined) ?? null;
      out.push({
        key: `old-${i}`, old: true, src: "เก่า",
        date, docNo: String(d.docNo ?? ""), no: String(d.no ?? ""),
        goodsType: String(d.goodsType ?? ""),
        origin: String(d.origin ?? ""), dest: String(d.dest ?? ""),
        sender: String(d.sender ?? ""), receiver: String(d.receiver ?? ""),
        payType: String(d.payType ?? ""), paid, payDate,
        qty: Number(d.qty) || 0, total: Number(d.total) || 0,
        aging: paid ? null : (Number(d.agingDays) || daysBetween(date, today)),
        daysToPay: (d.daysToPay as number | undefined) ?? (payDate ? daysBetween(date, payDate) : null),
        sheetName: d.sheetName,
      });
    });
  }

  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
