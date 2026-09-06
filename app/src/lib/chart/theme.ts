/**
 * ธีมกราฟ — ใช้สีชุดเดียวกับ #view-dash ใน index.html บน branch main
 *
 * หน้าแดชบอร์ดของ main มีโทเคนของตัวเองแยกจากธีมหลัก (เลือดหมู/ครีม)
 * เป็นชุด indigo / violet / rose / emerald / amber บนพื้นขาว
 * ตัวเลขใช้ Space Grotesk ตามที่ --d-num กำหนด
 *
 * ไม่มีโหมดมืด เพราะไฟล์ต้นทางไม่มี
 * กราฟทุกใบยังมีตารางตัวเลขกำกับ (ChartCard.table) ให้อ่านได้โดยไม่ต้องพึ่งสี
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
  /** สีเน้นของแดชบอร์ด เผื่อกราฟไหนอยากอ้างตรง ๆ */
  indigo: string;
  violet: string;
  rose: string;
  emerald: string;
  amber: string;
  teal: string;
  orange: string;
  /** ชื่อเดิมที่โค้ดเก่ายังอ้างถึง */
  navy: string;
}

const DASH: ChartTheme = {
  dark: false,
  categorical: ["#4F46E5", "#E11D48", "#059669"],
  sequential: ["#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#3730A3"],
  status: { good: "#059669", warning: "#F59E0B", serious: "#EA580C", critical: "#E11D48" },
  grid: "#F2EFEA",
  axis: "#A29C92",
  ink: "#17161A",
  inkMuted: "#6E6960",
  surface: "#FFFFFF",
  tooltipBg: "#FFFFFF",
  indigo: "#4F46E5",
  violet: "#7C3AED",
  rose: "#E11D48",
  emerald: "#059669",
  amber: "#F59E0B",
  teal: "#0D9488",
  orange: "#EA580C",
  navy: "#4F46E5",
};

/** แดชบอร์ดของ main มีธีมเดียว จึงคืนค่าคงที่ */
export function useChartTheme(): ChartTheme {
  return DASH;
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
