/**
 * วันที่แบบไทย — ยกจาก v5:1286-1293 ตรง ๆ
 * ชีตเก็บเป็น dd/mm/yyyy พ.ศ. ส่วนในแอปใช้ ISO yyyy-mm-dd เสมอ
 */

export const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                          "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** '2025-07-17' -> '17 ก.ค. 2568' */
export function thDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${+d!} ${TH_MONTHS[+m! - 1]} ${+y! + 543}`;
}

export const thDateSafe = (iso: string | null | undefined): string => (iso ? thDate(iso) : "–");

/** '2025-07-17' -> '17/07/2568' (รูปแบบที่ชีตใช้) */
export function thSlash(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${pad(+d!)}/${pad(+m!)}/${+y! + 543}`;
}

export const thSlashSafe = (iso: string | null | undefined): string => (iso ? thSlash(iso) : "");

/** ปัดทศนิยม 2 ตำแหน่งสำหรับเซลล์ชีต — ค่าที่ไม่ใช่ตัวเลขส่งเป็นช่องว่าง ไม่ใช่ 0 */
export const r2 = (n: unknown): number | "" => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : "";
};

/**
 * วันนี้ตามเวลาเครื่อง ไม่ใช่ UTC — todayISO() ของ main:2699
 * ถ้าใช้ toISOString() ผู้ใช้ในไทย (UTC+7) ที่เปิดแอปก่อนเจ็ดโมงเช้า
 * จะได้วันที่ของ "เมื่อวาน" ทั้งวันที่ตั้งต้นในฟอร์มและจำนวนวันค้างชำระ
 */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/** id ของใบรายการ — รูปแบบเดียวกับ genId() เดิม (v5:1294) */
export const genId = (): string =>
  "R" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
