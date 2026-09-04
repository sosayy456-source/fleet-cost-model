/**
 * แถวจากชีต "ข้อมูลเก่า*" — มีแต่ยอดรวมรายช่อง ไม่มีรายการย่อยพอจะคำนวณใหม่ได้
 * จึงอนุมานยอดสรุปจากคอลัมน์ที่ชีตคำนวณไว้แล้ว (เทียบเท่า rowToRecord_ ใน
 * AppsScript-โค้ด.gs:290-315)
 *
 * ★ สำคัญ: สูตรชุดนี้ "ไม่ใช่" โมเดลคนละตัวกับ computeCost แต่เป็นสูตรเดียวกัน
 *   ที่จัดรูปใหม่ให้เขียนด้วยยอดรวมได้ — พิสูจน์ได้ตรง ๆ:
 *
 *     computeCost: normal     = gas + fuelSum + labor + fees + repair
 *                  sheetTotal = gas + fuelSum + labor + waste + fees
 *       ⇒ normal = sheetTotal − waste + repair            ← สูตรของแถวเก่า
 *
 *                  profit = revenue − normal − waste
 *       ⇒ profit = revenue − sheetTotal − repair          ← สูตรของแถวเก่า
 *
 *   แปลว่าตัวเลขจากข้อมูลเก่ากับข้อมูลใหม่ "เทียบกันได้ตรง ๆ" ไม่ต้องปรับฐาน
 *   (มีเทสต์คุมความเท่ากันนี้อยู่ใน computeCost.test.ts)
 */

export interface OldRowTotals {
  revenue: number;
  /** คอลัมน์ "รวมค่าใช้จ่าย" ของชีต = คอลัมน์ 9–28 (รวมสูญเปล่า ไม่รวมค่าซ่อม) */
  sheetTotal: number;
  /** คอลัมน์ "ค่าซ่อมแซม" */
  repair: number;
  waste: number;
}

export interface OldRowResult {
  revenue: number;
  sheetTotal: number;
  waste: number;
  repTotal: number;
  normal: number;
  profit: number;
}

export function totalsFromOldRow(r: OldRowTotals): OldRowResult {
  const { revenue, sheetTotal, repair, waste } = r;
  return {
    revenue,
    sheetTotal,
    waste,
    repTotal: repair,
    normal: sheetTotal - waste + repair,
    profit: revenue - sheetTotal - repair,
  };
}

/** ยอดสูญเปล่าของแถวเก่า = 4 ช่องนี้รวมกัน (AppsScript-โค้ด.gs:290-291) */
export const OLD_WASTE_COLUMNS = [
  "ค่าน้ำมันรถวิ่งอ้อม",
  "ค่าน้ำมันนอกเส้นทาง(Fleet Card)",
  "เบี้ยเลี้ยงนอกเส้นทาง",
  "น้ำมันนอกเส้นทาง",
] as const;
