/**
 * ชิ้นส่วนกราฟที่ใช้ร่วมกันทุกหน้า
 * รวมค่ามาตรฐานของแกน กริด และ tooltip ไว้ที่เดียว จะได้ไม่ต้องตั้งซ้ำทุกกราฟ
 * และกราฟทุกตัวหน้าตาเป็นชุดเดียวกัน
 */
import type { ReactNode } from "react";
import { CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { fmtBaht, useChartTheme } from "./theme";
import type { ChartTheme } from "./theme";

/** กรอบกราฟพร้อมหัวเรื่องและตารางสำรอง — กราฟทุกตัวต้องมีทางอ่านที่ไม่ใช่สี */
export function ChartCard({ title, note, children, table }: {
  title: string;
  note?: string;
  children: ReactNode;
  /** ตารางตัวเลข เปิดดูได้ ใช้แทนกรณีอ่านสีไม่ได้หรือต้องการค่าที่แน่นอน */
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

/** แกนและกริดแบบถอย ไม่แย่งสายตาไปจากข้อมูล */
export const axisProps = (t: ChartTheme) => ({
  stroke: t.axis,
  tick: { fill: t.inkMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: t.grid },
});

export function Grid({ t }: { t: ChartTheme }) {
  return <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />;
}

export function XA({ t, ...rest }: { t: ChartTheme } & Record<string, unknown>) {
  return <XAxis {...axisProps(t)} {...rest} />;
}

export function YA({ t, ...rest }: { t: ChartTheme } & Record<string, unknown>) {
  return <YAxis {...axisProps(t)} width={64} {...rest} />;
}

/** tooltip ที่ใช้ token ข้อความ ไม่ใช่สีของชุดข้อมูล ตามหลักการอ่านง่าย */
export function ChartTooltip({ suffix = " บาท" }: { suffix?: string }) {
  const t = useChartTheme();
  return (
    <Tooltip
      cursor={{ fill: t.grid, fillOpacity: 0.35 }}
      contentStyle={{
        background: t.tooltipBg,
        border: `1px solid ${t.grid}`,
        borderRadius: 8,
        color: t.ink,
        fontSize: 12.5,
      }}
      labelStyle={{ color: t.inkMuted, marginBottom: 4 }}
      formatter={(v: number, name: string) => [fmtBaht(v) + suffix, name]}
    />
  );
}

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
  const t = useChartTheme();
  const map: Record<string, { color: string; icon: string; label: string }> = {
    alert: { color: t.status.critical, icon: "▲", label: "ต้องรีบดู" },
    warn: { color: t.status.serious, icon: "!", label: "ควรระวัง" },
    ok: { color: t.status.good, icon: "✓", label: "ปกติ" },
    info: { color: t.categorical[0], icon: "i", label: "ข้อสังเกต" },
  };
  const s = map[level] ?? map.info!;
  return (
    <div className="insight" style={{ borderLeftColor: s.color }}>
      <span className="insight-icon" style={{ color: s.color }} aria-hidden>{s.icon}</span>
      <span className="sr-label" style={{ color: s.color }}>{s.label}</span>
      {/* ข้อความมาจาก insights.py ซึ่งมีแท็ก <b> อยู่ในตัว */}
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
