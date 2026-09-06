/**
 * สีและฟอนต์ของกราฟ — ถอดจาก dOpts()/dLine()/dBar()/dPie() ใน index.html บน main
 *
 * ที่นั่นใช้ Chart.js ส่วนที่นี่ใช้ Recharts จึงต้องตั้งค่าให้ผลลัพธ์ออกมาเหมือนกัน
 * ค่าที่เห็นข้างล่างนี้เป็นตัวเลขเดียวกับที่ main เขียนไว้ ห้ามปัดหรือ "ปรับให้สวยขึ้น"
 * เพราะเป้าหมายคือหน้าตาตรงกับต้นฉบับ ไม่ใช่ดีไซน์ใหม่
 */

/** ฟอนต์ในกราฟ — main ตั้งเป็น DFONT ทุกจุด (แกน/legend/tooltip) */
export const DFONT = "Anuphan, 'Noto Sans Thai', system-ui, sans-serif";

/** ระยะและจังหวะแอนิเมชัน — main: animation:{duration:950,easing:"easeOutQuart"} */
export const DUR = 950;

/** สีตามชื่อที่ main เรียกใช้ตรง ๆ ในแต่ละกราฟ */
export const D = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  violet: "#7C3AED",
  rose: "#E11D48",
  emerald: "#047857",     // เส้น "กำไร" ทุกกราฟใช้สีนี้
  emeraldLight: "#059669",
  amber: "#F59E0B",
  pink: "#DB2777",
  teal: "#0D9488",
  cyan: "#0891B2",
  orange: "#EA580C",
  slate: "#94A3B8",
  slateDeep: "#475569",
  mint: ["#BBF7D0", "#6EE7B7", "#34D399"],
} as const;

export interface ChartTheme {
  dark: boolean;
  categorical: [string, string, string];
  sequential: string[];
  status: { good: string; warning: string; serious: string; critical: string };
  grid: string;
  axis: string;
  ink: string;
  inkMuted: string;
  surface: string;
  tooltipBg: string;
  indigo: string; violet: string; rose: string; emerald: string;
  amber: string; teal: string; orange: string; navy: string;
}

const DASH: ChartTheme = {
  dark: false,
  categorical: [D.indigo, D.rose, D.emerald],
  sequential: ["#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#3730A3"],
  status: { good: D.emerald, warning: D.amber, serious: D.orange, critical: D.rose },
  grid: "#F2EFEA",        // scales.*.grid.color
  axis: "#EAE6DF",        // scales.*.border.color
  ink: "#17161A",         // tooltip.backgroundColor
  inkMuted: "#8A857C",    // ticks.color
  surface: "#FFFFFF",
  tooltipBg: "#17161A",
  indigo: D.indigo, violet: D.violet, rose: D.rose, emerald: D.emeraldLight,
  amber: D.amber, teal: D.teal, orange: D.orange, navy: D.indigo,
};

/** แดชบอร์ดของ main มีธีมเดียว ไม่มีโหมดมืด จึงคืนค่าคงที่ */
export function useChartTheme(): ChartTheme {
  return DASH;
}

/**
 * เลือกเฉดจากไล่สีเดียวตามอันดับ — ใช้กับหมวดที่เรียงตามขนาดได้
 * อันดับ 1 เข้มสุด ไล่จางลงตามลำดับ เพื่อให้อ่านลำดับได้จากสีโดยตรง
 */
export function rankedShades(theme: ChartTheme, n: number): string[] {
  if (n <= 0) return [];
  const usable = theme.sequential.slice(1).reverse();
  if (n === 1) return [usable[0]!];
  return Array.from({ length: n }, (_, i) =>
    usable[Math.min(usable.length - 1, Math.round((i / (n - 1)) * (usable.length - 1)))]!);
}

/** ตรงกับ fmt(n,0) ของ main — toLocaleString("th-TH") ไม่เอาทศนิยม */
export const fmtBaht = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 0 }) : "–";

/** fmt(n,d) ของ main — บังคับทศนิยม d ตำแหน่ง */
export const fmtN = (n: number, d = 0): string =>
  Number.isFinite(n)
    ? n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "–";

/**
 * ป้ายบนแกนของ main ไม่ได้ย่อหน่วย — Chart.js เขียนเลขเต็มพร้อมคอมมา
 * ที่นี่จึงทำแบบเดียวกัน ไม่แปลงเป็น "K" หรือ "ล้าน"
 */
export const fmtShort = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "";

export const fmtPct = (n: number, digits = 0): string => `${n.toFixed(digits)}%`;
