/**
 * ธีมกราฟ — ใช้สีชุดเดียวกับกราฟใน โมเดลเดินรถ-gsheet-v5.html
 *
 * v5 กำหนดสีกราฟไว้ตรง ๆ ในโค้ด (ดู v5:2983-3436) ได้แก่
 *   ส้ม #F5821F · น้ำเงิน #3672C4 · เขียว #1FA971 · กรมท่า #1E2A46
 *   แดง #E24B4B · ทอง #F6C042 · ส้มเข้ม #DC6E11
 * เดิมไฟล์นี้ใช้ชุดสีที่ผ่าน validator แต่ทำให้หน้าตาไม่ตรงกับของเดิม
 * เมื่อโจทย์คือ "ให้เหมือน v5 ทุกอย่าง" จึงกลับมาใช้สีชุดนี้
 *
 * v5 ไม่มีโหมดมืด ที่นี่จึงมีธีมเดียว ไม่ต้องเช็ค prefers-color-scheme
 * กราฟทุกตัวยังมีตารางตัวเลขกำกับ (ChartCard.table) ให้อ่านได้โดยไม่ต้องพึ่งสี
 */

export interface ChartTheme {
  dark: boolean;
  /** สีชุดข้อมูล ใช้เรียงตามลำดับเสมอ ห้ามวนซ้ำ */
  categorical: [string, string, string];
  /** ไล่เฉดสีเดียว อ่อน→เข้ม สำหรับหมวดที่เรียงตามขนาดได้ */
  sequential: string[];
  status: { good: string; warning: string; serious: string; critical: string };
  grid: string;
  axis: string;
  ink: string;
  inkMuted: string;
  surface: string;
  tooltipBg: string;
  /** สีเน้นของ v5 เผื่อกราฟไหนอยากอ้างตรง ๆ */
  navy: string;
  orange: string;
}

const V5: ChartTheme = {
  dark: false,
  categorical: ["#F5821F", "#3672C4", "#1FA971"],
  sequential: ["#D3DCEC", "#A9BAD8", "#7E97C4", "#5476B0", "#3672C4", "#28497F", "#1E2A46"],
  status: { good: "#1FA971", warning: "#F6C042", serious: "#DC6E11", critical: "#E24B4B" },
  grid: "#E7E9ED",
  axis: "#9AA1AC",
  ink: "#232833",
  inkMuted: "#6B7280",
  surface: "#FFFFFF",
  tooltipBg: "#FFFFFF",
  navy: "#1E2A46",
  orange: "#F5821F",
};

/** v5 เป็นธีมสว่างอย่างเดียว จึงคืนค่าคงที่ */
export function useChartTheme(): ChartTheme {
  return V5;
}

/**
 * เลือกเฉดจากไล่สีเดียวตามอันดับ — ใช้กับหมวดที่เรียงตามขนาดได้
 * อันดับ 1 เข้มสุด ไล่จางลงตามลำดับ เพื่อให้อ่านลำดับได้จากสีโดยตรง
 */
export function rankedShades(theme: ChartTheme, n: number): string[] {
  if (n <= 0) return [];
  // เริ่มจากเข้มสุดแล้วไล่ออก ข้ามเฉดอ่อนสุดที่แปลว่า "เกือบศูนย์"
  const usable = theme.sequential.slice(1).reverse();
  if (n === 1) return [usable[0]!];
  return Array.from({ length: n }, (_, i) =>
    usable[Math.min(usable.length - 1, Math.round((i / (n - 1)) * (usable.length - 1)))]!);
}

export const fmtBaht = (n: number): string =>
  n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

/** ย่อยอดเงินให้สั้นพอใส่แกน — 1,250,000 → 1.25 ล้าน */
export const fmtShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + " ล้าน";
  if (a >= 1e3) return Math.round(n / 1e3) + "K";
  return String(Math.round(n));
};

export const fmtPct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`;
