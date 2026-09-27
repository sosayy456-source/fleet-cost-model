/**
 * สีและฟอนต์ของกราฟ — ถอดจาก dOpts()/dLine()/dBar()/dPie() ใน index.html บน main
 *
 * ที่นั่นใช้ Chart.js ส่วนที่นี่ใช้ Recharts จึงต้องตั้งค่าให้ผลลัพธ์ออกมาเหมือนกัน
 * ค่าที่เห็นข้างล่างนี้เป็นตัวเลขเดียวกับที่ main เขียนไว้ ห้ามปัดหรือ "ปรับให้สวยขึ้น"
 * เพราะเป้าหมายคือหน้าตาตรงกับต้นฉบับ ไม่ใช่ดีไซน์ใหม่
 */

/**
 * ฟอนต์ในกราฟ — main ตั้งเป็น DFONT ทุกจุด (แกน/legend/tooltip)
 * main ใช้ Anuphan · ตอนนี้ทั้งโมเดลเปลี่ยนเป็น LINE Seed Sans TH ตามที่เจ้าของงานขอ (ดู src/fonts.css)
 */
export const DFONT = "'LINE Seed Sans TH', 'Noto Sans Thai', system-ui, sans-serif";

/** ระยะและจังหวะแอนิเมชัน — main: animation:{duration:950,easing:"easeOutQuart"} */
export const DUR = 950;

import { CHERRY, IS_CHERRY } from "../ui/dashTheme";

/** สีตามชื่อที่ main เรียกใช้ตรง ๆ ในแต่ละกราฟ (ธีม classic) */
const D_CLASSIC = {
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
  mint: ["#BBF7D0", "#6EE7B7", "#34D399"] as [string, string, string],
};

/**
 * ธีม cherry (เจ้าของงานส่ง 27 ก.ย. 2569 · lib/ui/dashTheme.ts) — ชื่อคีย์เดิม ค่าสีใหม่ ทุกกราฟเปลี่ยนตามโดยไม่ต้องแก้ทีละไฟล์
 * indigo = รายได้ → **แชมเปญทอง** · emerald = กำไร → **เขียว** (ตาม PDF) · rose = ต้นทุน/ขาดทุน → ส้มอิฐ · violet → เบอร์กันดี · teal → ม่วงหม่น
 */
const D_CHERRY: typeof D_CLASSIC = {
  indigo: CHERRY.gold,
  indigoDeep: CHERRY.goldDeep,
  violet: CHERRY.burgundy,
  rose: CHERRY.brick,
  emerald: CHERRY.greenDeep,
  emeraldLight: CHERRY.green,
  amber: "#D9A04A",
  pink: CHERRY.plum,
  teal: CHERRY.mauve,
  cyan: CHERRY.rose,
  orange: "#A8472F",
  slate: "#B7A6AC",
  slateDeep: "#6B4A52",
  mint: ["#CDEBDD", "#8FD0B3", "#34A07F"],
};

export const D = IS_CHERRY ? D_CHERRY : D_CLASSIC;

export interface ChartTheme {
  dark: boolean;
  categorical: [string, string, string];
  sequential: string[];
  status: { good: string; warning: string; serious: string; critical: string };
  grid: string;
  axis: string;
  ink: string;
  ink2: string;
  inkMuted: string;
  surface: string;
  tooltipBg: string;
  indigo: string; violet: string; rose: string; emerald: string;
  amber: string; teal: string; orange: string; navy: string;
}

const DASH_CLASSIC: ChartTheme = {
  dark: false,
  categorical: [D.indigo, D.rose, D.emerald],
  sequential: ["#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#3730A3"],
  status: { good: D.emerald, warning: D.amber, serious: D.orange, critical: D.rose },
  grid: "#F2EFEA",        // scales.*.grid.color
  axis: "#EAE6DF",        // scales.*.border.color
  ink: "#17161A",         // tooltip.backgroundColor
  ink2: "#4A463F",        // สีแกน/ป้ายกำกับที่ต้องเข้มกว่า inkMuted ให้อ่านง่ายขึ้น — ตรงกับ --d-ink2 ของ CSS
  inkMuted: "#8A857C",    // ticks.color
  surface: "#FFFFFF",
  tooltipBg: "#17161A",
  indigo: D.indigo, violet: D.violet, rose: D.rose, emerald: D.emeraldLight,
  amber: D.amber, teal: D.teal, orange: D.orange, navy: D.indigo,
};

const DASH: ChartTheme = IS_CHERRY ? {
  ...DASH_CLASSIC,
  categorical: [D.indigo, D.rose, D.emerald],
  sequential: ["#F6ECEF", "#EBD5DB", "#DDB3BE", "#C98E9E", "#A8667A", "#80344D", "#590212"],
  status: { good: D.emeraldLight, warning: D.amber, serious: D.orange, critical: D.rose },
  grid: "#F1E6EA", axis: "#E4CDD3",
  ink: "#2A0A10", ink2: "#5A3A40", inkMuted: "#7A5A60", tooltipBg: "#3A0712",
  indigo: D.indigo, violet: D.violet, rose: D.rose, emerald: D.emeraldLight,
  amber: D.amber, teal: D.teal, orange: D.orange, navy: D.violet,
} : DASH_CLASSIC;

/** แดชบอร์ดของ main มีธีมเดียว ไม่มีโหมดมืด จึงคืนค่าคงที่ (ธีมสีเลือกตอนโหลดหน้า — lib/ui/dashTheme.ts) */
export function useChartTheme(): ChartTheme {
  return DASH;
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
