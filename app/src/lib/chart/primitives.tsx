/**
 * ชิ้นส่วนกราฟที่ใช้ร่วมกันทุกหน้า — ตั้งค่าให้ Recharts ออกมาหน้าตาเหมือน
 * Chart.js ที่ dOpts()/dLine()/dBar()/dPie() ของ index.html บน main ตั้งไว้
 *
 * ★ ที่นี่ให้เป็น "ชุด props" ไม่ใช่คอมโพเนนต์ห่อ
 *   Recharts หาลูกของกราฟจาก displayName ของ element เท่านั้น
 *   ถ้าห่อ <XAxis> ไว้ในคอมโพเนนต์ของเราเอง มันจะมองไม่เห็น แล้วแกน/กริดจะหายไปทั้งใบ
 *   (เจอจริงตอนพอร์ตแดชบอร์ด — กราฟวาดเส้นออกมาแต่ไม่มีแกนเลย)
 *   จึงต้องเขียน <XAxis {...axisProps(t)} /> ตรง ๆ ในทุกกราฟ
 */
import type { ReactNode } from "react";
import { DFONT, DUR, fmtN, useChartTheme } from "./theme";
import type { ChartTheme } from "./theme";

/** กรอบกราฟพร้อมหัวเรื่องและตารางสำรอง — ใช้ในหน้าแดชบอร์ดรายได้ */
export function ChartCard({ title, note, children, table }: {
  title: string;
  note?: string;
  children: ReactNode;
  table?: ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {note && <p className="muted" style={{ marginTop: -6 }}>{note}</p>}
      {children}
      {table && (
        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
            ดูเป็นตารางตัวเลข
          </summary>
          <div className="scroll-x" style={{ marginTop: 8 }}>{table}</div>
        </details>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   ค่ามาตรฐานของกราฟ — เทียบบรรทัดต่อบรรทัดกับ dOpts() ของ main
   scales.x/y = { ticks:{font:{family:DFONT,size:11},color:"#8A857C"},
                  grid:{color:"#F2EFEA"}, border:{color:"#EAE6DF"} }
   --------------------------------------------------------------- */
export const axisProps = (t: ChartTheme) => ({
  tick: { fill: t.inkMuted, fontSize: 11, fontFamily: DFONT },
  tickLine: false,
  axisLine: { stroke: t.axis },
});

/**
 * Chart.js วาดเส้นกริดทั้งสองแกนเป็นเส้นทึบ ไม่ใช่เส้นประ
 * จึงต้องปิด strokeDasharray และเปิด vertical ให้ตรงกัน
 */
export const gridProps = (t: ChartTheme) => ({
  stroke: t.grid,
  strokeDasharray: "0",
  vertical: true as const,
  horizontal: true as const,
});

/** tooltip.backgroundColor "#17161A" · cornerRadius 10 · padding 11 */
export const tooltipProps = (t: ChartTheme, suffix = " บาท", digits = 0) => ({
  cursor: { fill: t.grid, fillOpacity: 0.6 },
  contentStyle: {
    background: t.tooltipBg,
    border: "none",
    borderRadius: 10,
    padding: 11,
    fontFamily: DFONT,
    fontSize: 12.5,
    boxShadow: "0 8px 24px -8px rgba(0,0,0,.35)",
  },
  labelStyle: { color: "#FFFFFF", marginBottom: 4, fontWeight: 600 },
  itemStyle: { color: "#FFFFFF", padding: 0 },
  formatter: (v: number, name: string) =>
    [(v == null ? "–" : fmtN(v, digits)) + suffix, name] as [string, string],
});

/**
 * legend ของ main อยู่ล่างกราฟ จุดกลม ตัวอักษร 12px สี #4A463F ระยะห่าง 16
 * และจะโผล่เฉพาะกราฟที่มีมากกว่าหนึ่งชุดข้อมูล (showLeg)
 */
export const legendProps = {
  layout: "horizontal" as const,
  verticalAlign: "bottom" as const,
  align: "center" as const,
  iconType: "circle" as const,
  iconSize: 10,
  height: 34,
  wrapperStyle: { fontFamily: DFONT, fontSize: 12, color: "#4A463F", lineHeight: "22px" },
};

/** พื้นใต้เส้นกราฟ — dFade() ของ main: สีเดิมที่ความทึบ .09 */
export function dFade(hex: string): string {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "rgba(79,70,229,.09)";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},.09)`;
}

/** animation:{duration:950,easing:"easeOutQuart"} */
export const anim = { isAnimationActive: true, animationDuration: DUR, animationEasing: "ease-out" as const };

/** borderRadius:7 / borderSkipped:false — มุมมนทุกด้านของแท่ง */
export const BAR_RADIUS = 7;

/** เส้นกราฟ: borderWidth 2.2 · tension .35 · pointRadius 0 · fill true */
export const lineProps = (color: string) => ({
  type: "monotone" as const,
  stroke: color,
  strokeWidth: 2.2,
  dot: false as const,
  activeDot: { r: 4 },
  fill: dFade(color),
  fillOpacity: 1,
  connectNulls: false,
  ...anim,
});

/** ตัวเลขเด่นหนึ่งค่า — ใช้เมื่อข้อมูลมีค่าเดียว กราฟไม่ช่วยอะไร */
export function Stat({ label, value, tone, sub }: {
  label: string; value: string; tone?: string; sub?: string;
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  );
}

/** แถบข้อความเตือน/ข้อสังเกต — มีไอคอนกำกับเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว */
export function InsightCard({ level, html }: { level: string; html: string }) {
  const theme = useChartTheme();
  const map: Record<string, { color: string; icon: string; label: string }> = {
    alert: { color: theme.status.critical, icon: "▲", label: "ต้องรีบดู" },
    warn: { color: theme.status.serious, icon: "!", label: "ควรระวัง" },
    ok: { color: theme.status.good, icon: "✓", label: "ปกติ" },
    info: { color: theme.categorical[0], icon: "i", label: "ข้อสังเกต" },
  };
  const s = map[level] ?? map.info!;
  return (
    <div className="insight" style={{ borderLeftColor: s.color }}>
      <span className="insight-icon" style={{ color: s.color }} aria-hidden>{s.icon}</span>
      <span className="sr-label" style={{ color: s.color }}>{s.label}</span>
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
