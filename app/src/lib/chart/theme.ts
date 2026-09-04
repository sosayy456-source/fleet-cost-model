/**
 * ธีมกราฟ — สีชุดข้อมูลผ่านการตรวจด้วย validator แล้ว ไม่ได้เลือกด้วยสายตา
 *
 * ทำไมไม่ใช้สีแบรนด์เดิม (AMBER #E8A93C / BLUE #5A8FBE / RED #C1483F / GREEN #6FA98A)
 * มาเป็นสีชุดข้อมูลตรง ๆ: ตรวจแล้วไม่ผ่าน —
 *   AMBER สว่างเกินช่วง (L 0.776) และคอนทราสต์กับพื้นแค่ 2.01
 *   BLUE กับ GREEN สีจางเกิน (chroma 0.091 / 0.076) เวลาเป็นแท่งเล็ก ๆ จะดูเป็นสีเทา
 * สีแบรนด์จึงยังใช้กับ UI (เมนู ปุ่ม ขอบการ์ด) เหมือนเดิม ส่วนกราฟใช้ชุดด้านล่าง
 *
 * ผลตรวจ (validate_palette.js --pairs all เทียบกับพื้นการ์ดจริง):
 *   light บนพื้น #ffffff — ผ่านทุกข้อ, คอนทราสต์ aqua 2.82 จึงต้องมี label กำกับเสมอ
 *   dark  บนพื้น #232019 — ผ่านทุกข้อสะอาด
 *
 * ทำไมมีแค่ 3 สี: ที่ 4 สีขึ้นไปคู่สีเริ่มแยกไม่ออกสำหรับคนตาบอดสี (แม้แต่ชุด
 * อ้างอิงของ skill เองก็ไม่ผ่าน --pairs all) หมวดที่มีมากกว่า 3 จึงใช้
 * "ไล่เฉดสีเดียว เรียงตามขนาด" แทนการไล่สี ซึ่งเป็นรูปแบบที่ถูกต้องกว่าอยู่แล้ว
 */
import { useEffect, useState } from "react";

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
}

const LIGHT: ChartTheme = {
  dark: false,
  categorical: ["#2a78d6", "#eb6834", "#1baf7a"],
  sequential: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
  grid: "#e4e1db",
  axis: "#918a80",
  ink: "#23201c",
  inkMuted: "#5c564e",
  surface: "#ffffff",
  tooltipBg: "#ffffff",
};

const DARK: ChartTheme = {
  dark: true,
  categorical: ["#3987e5", "#d95926", "#199e70"],
  sequential: ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"],
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
  grid: "#3a352d",
  axis: "#8a8378",
  ink: "#f0ece5",
  inkMuted: "#b8b1a6",
  surface: "#232019",
  tooltipBg: "#232019",
};

export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(
    () => matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark ? DARK : LIGHT;
}

/**
 * เลือกเฉดจากไล่สีเดียวตามอันดับ — ใช้กับหมวดที่เรียงตามขนาดได้
 * อันดับ 1 เข้มสุด ไล่จางลงตามลำดับ เพื่อให้อ่านลำดับได้จากสีโดยตรง
 */
export function rankedShades(theme: ChartTheme, n: number): string[] {
  if (n <= 0) return [];
  const ramp = theme.dark ? [...theme.sequential].reverse() : theme.sequential;
  // เริ่มจากเข้มสุดแล้วไล่ออก ข้ามเฉดอ่อนสุดที่แปลว่า "เกือบศูนย์"
  const usable = ramp.slice(0, Math.max(2, ramp.length - 1)).reverse();
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
