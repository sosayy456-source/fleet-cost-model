/**
 * ธีมสีของแดชบอร์ดทั้งหมด — "cherry" (ชุดสีที่เจ้าของงานส่ง 27 ก.ย. 2569) เป็นค่าตั้งต้น · "classic" = สีชุดเดิมก่อนหน้านั้น
 *
 * ชุดสี cherry: #BF939F (ม่วงหม่น) · #E4CDD3 · #EBE0E6 (ชมพูอ่อน) · #C86253 (ส้มอิฐ) · #DDA39F · #590212 (เบอร์กันดี)
 * + การ์ด/กราฟตาม "การแสดงผล.pdf": **กำไร = เขียว · รายได้ = แชมเปญทอง · ต้นทุน = มุกม่วงอ่อน** · ตัวอักษรใหญ่ขึ้นให้อ่านง่าย
 *   (รอบแรกทำกำไรทอง/รายได้เขียวตามข้อความ เจ้าของงานให้ปรับตาม PDF 27 ก.ย. 2569)
 *
 * ★ ตัดสินครั้งเดียวตอนโหลดหน้า (ชุดสีกราฟ D ใน lib/chart/theme.ts เป็นค่าคงที่ระดับโมดูล) —
 *   สลับกลับสีเดิม: localStorage.setItem("dashTheme", "classic") แล้วรีโหลด · ล้างคีย์ = กลับเป็น cherry
 * ★ CSS ของธีมอยู่ท้าย index.css ครอบด้วย html.theme-cherry ทั้งหมด (main.tsx ใส่คลาสให้)
 */
export type DashTheme = "cherry" | "classic";

export function readDashTheme(): DashTheme {
  try {
    return localStorage.getItem("dashTheme") === "classic" ? "classic" : "cherry";
  } catch {
    return "cherry";
  }
}

export const DASH_THEME: DashTheme = readDashTheme();
export const IS_CHERRY = DASH_THEME === "cherry";

/** สีหลักของธีม cherry — ใช้ใน TS ที่ต้องรู้ค่าสีตรง ๆ (กราฟ · เส้นกลุ่มบริการ) */
export const CHERRY = {
  mauve: "#BF939F", blush: "#E4CDD3", mist: "#EBE0E6", brick: "#C86253", rose: "#DDA39F", burgundy: "#590212",
  gold: "#C29A5B", goldDeep: "#9A7A3E", goldLight: "#D9B98A",
  green: "#1B7A60", greenDeep: "#0C5A45", greenLight: "#34A07F",
  plum: "#8E5A68",
} as const;
