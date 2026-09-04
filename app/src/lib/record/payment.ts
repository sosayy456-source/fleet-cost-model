/**
 * สถานะการชำระเงินของใบรายการ — ยกจาก v5:1302-1317
 *
 * กติกาที่พลาดไม่ได้: บิลประเภท "สดต้นทาง" ถือว่าชำระแล้วตั้งแต่เปิดบิล
 * ไม่ต้องรอกดปุ่มชำระ และวันที่ชำระคือวันที่ของใบรายการเอง
 */
import { daysBetween } from "./date";
import type { Bill, PayStatus, TripRecord } from "../../types/record";
import { CASH_ORIGIN, ST_PAID, ST_PARTIAL, ST_UNPAID } from "../../types/record";

export const recBills = (r: Pick<TripRecord, "bills"> | null | undefined): Bill[] =>
  Array.isArray(r?.bills) ? r.bills : [];

export const billIsPaid = (b: Bill): boolean => b.payType === CASH_ORIGIN || !!b.paid;

export const billPayDate = (b: Bill, r?: Pick<TripRecord, "date"> | null): string | null =>
  b.payType === CASH_ORIGIN ? (r?.date || b.payDate || null) : (b.paid ? (b.payDate || null) : null);

export function recStatus(r: Pick<TripRecord, "bills">): PayStatus {
  const bs = recBills(r);
  if (!bs.length) return ST_UNPAID;
  const n = bs.filter(billIsPaid).length;
  return n === bs.length ? ST_PAID : n > 0 ? ST_PARTIAL : ST_UNPAID;
}

export interface PayInfo {
  status: PayStatus;
  payDate: string | null;
  daysToPay: number | null;
  count: number;
  paidCount: number;
  total: number;
}

export function recPayInfo(r: Pick<TripRecord, "bills" | "date">): PayInfo {
  const bs = recBills(r);
  const status = recStatus(r);
  let last: string | null = null;
  for (const b of bs) {
    const d = billPayDate(b, r);
    if (d && (!last || d > last)) last = d;
  }
  // วันที่ชำระครบ นับเฉพาะตอนจ่ายครบทุกบิลแล้วเท่านั้น
  const payDate = status === ST_PAID ? last : null;
  return {
    status,
    payDate,
    daysToPay: payDate ? daysBetween(r.date, payDate) : null,
    count: bs.length,
    paidCount: bs.filter(billIsPaid).length,
    total: bs.reduce((s, b) => s + (Number(b.total) || 0), 0),
  };
}
