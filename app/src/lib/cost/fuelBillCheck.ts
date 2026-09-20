/**
 * การตรวจบิลน้ำมันอัตโนมัติ — คืนป้ายสถานะเดียวต่อแถว ตามลำดับความรุนแรง
 *
 * ทั้งหมดเป็น "คำเตือน" ไม่ใช่ตัวบล็อกการบันทึก เพราะฝ่ายบัญชีมักต้องบันทึกค้างไว้ก่อน
 * แล้วค่อยตามเอกสารทีหลัง · ใบที่ยังมีแถวไม่ผ่านจะขึ้นข้อความรวมท้ายตารางแทน
 *
 * ราคาอ้างอิงรับเข้ามาเป็นพารามิเตอร์เสมอ ห้ามอ่าน localStorage เองในไฟล์นี้
 */
import { todayISO } from "../record/date";
import { fuelBillAmount } from "./fuelBills";
import type { FuelBill } from "../../types/record";

/** ราคา/ลิตร ต่างจากราคาอ้างอิงเกินเท่านี้ = ผิดปกติ */
export const PRICE_TOLERANCE = 0.05;

export type FuelLevel = "ok" | "info" | "warn" | "err";

export interface FuelIssue {
  level: FuelLevel;
  /** ข้อความบนป้ายสถานะ */
  text: string;
  /** คำอธิบายเต็มใน title ของป้าย */
  hint?: string;
}

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/** คู่ที่ใช้ตัดสินว่าเลขบิลซ้ำ — ปั๊มเดียวกัน เลขเดียวกัน */
export const fuelBillKey = (b: FuelBill): string => `${b.pump}|${b.no.trim()}`;

/**
 * ตรวจแถวเดียว
 *
 * @param all      บิลทั้งใบ ใช้หาเลขซ้ำ (ตรวจได้เท่าที่เห็นในใบนี้เท่านั้น ไม่ข้ามใบ)
 * @param span     ช่วงวันเดินทางของใบ — วันที่นอกช่วงนี้ถือว่าผิด (ว่าง = ไม่ตรวจ)
 * @param refPrice ราคาน้ำมันอ้างอิงของวันในบิล (มาจาก priceForDate ที่ฟอร์มคำนวณให้)
 */
export function checkFuelBill(
  b: FuelBill,
  all: readonly FuelBill[],
  span: { from: string; to: string },
  refPrice: number,
): FuelIssue {
  // ใบรุ่นก่อนระบบบิลไม่มีเลขที่/ปั๊ม/หลักฐานให้ตรวจอยู่แล้ว — ข้ามทุกข้อ ไม่งั้นแดงทั้งกระดาน
  if (b.src === "legacy") {
    return { level: "info", text: "ข้อมูลก่อนระบบบิล", hint: "แปลงมาจากช่องยอดรวมของใบรุ่นเดิม" };
  }

  const outOfSpan = !!b.date && !!span.from && !!span.to && (b.date < span.from || b.date > span.to);

  if (b.pay === "est") {
    if (!b.reason) return { level: "err", text: "ระบุเหตุผล", hint: "ยอดประมาณการต้องบอกเหตุผลที่ไม่มีบิล" };
    if (outOfSpan) return { level: "err", text: "นอกช่วงเดินทาง", hint: `ใบนี้เดินทาง ${span.from} ถึง ${span.to}` };
    if (!b.approved) return { level: "warn", text: "ประมาณการ · รออนุมัติ" };
    if (b.dueDate && b.dueDate < todayISO()) {
      return { level: "err", text: "เกินกำหนดนำบิลมาแทน", hint: `ครบกำหนด ${b.dueDate}` };
    }
    return { level: "info", text: "ประมาณการ · อนุมัติแล้ว", hint: b.dueDate ? `นำบิลมาแทนภายใน ${b.dueDate}` : undefined };
  }

  const no = b.no.trim();
  if (no && all.filter((x) => x.src !== "legacy" && x.no.trim() && fuelBillKey(x) === fuelBillKey(b)).length > 1) {
    return { level: "err", text: "เลขบิลซ้ำ", hint: "ปั๊มเดียวกันและเลขที่บิลเดียวกันถูกกรอกมากกว่าหนึ่งครั้ง" };
  }
  if (outOfSpan) return { level: "err", text: "นอกช่วงเดินทาง", hint: `ใบนี้เดินทาง ${span.from} ถึง ${span.to}` };
  if (!no || !b.proof) {
    return {
      level: "warn", text: "รอหลักฐาน",
      hint: !no ? "ยังไม่ได้กรอกเลขที่บิล" : "ยังไม่ได้ยืนยันว่ามีหลักฐานแนบ",
    };
  }

  const litres = n(b.liters);
  if (litres > 0 && refPrice > 0) {
    const ppl = fuelBillAmount(b) / litres;
    if (Math.abs(ppl - refPrice) / refPrice > PRICE_TOLERANCE) {
      return {
        level: "warn", text: "ราคา/ลิตรผิดปกติ",
        hint: `${ppl.toFixed(2)} บ./ล. ต่างจากราคาอ้างอิง ${refPrice.toFixed(2)} เกิน ${PRICE_TOLERANCE * 100}%`,
      };
    }
  }
  return { level: "ok", text: "ครบถ้วน" };
}

/** จำนวนแถวที่ยังไม่ผ่านการตรวจ — ใช้เขียนข้อความสรุปท้ายตาราง */
export const countPending = (issues: readonly FuelIssue[]): number =>
  issues.filter((i) => i.level === "err" || i.level === "warn").length;
