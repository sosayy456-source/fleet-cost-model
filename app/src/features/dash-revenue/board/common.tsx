/**
 * ชิ้นส่วนร่วมของแท็บ "Dashboard รายได้" (ชุดตามไฟล์ PDF ที่เจ้าของข้อมูลส่งมา)
 *
 * ★ แยกโฟลเดอร์ไว้ไม่ให้ปนกับ 8 แท็บเดิมของแดชบอร์ดรายได้ และไม่แตะ dash-fleet /
 *   dash-costrev เลย — ใช้ร่วมแค่คอมโพเนนต์กลางใน lib/chart/ กับ dash-fleet/parts.tsx
 *   ซึ่งเป็นของใช้ร่วมอยู่แล้ว
 *
 * กราฟสองแบบข้างล่างนี้ lib/chart/dcharts.tsx ยังไม่มี จึงเขียนไว้ที่นี่แทนการไปแก้ของกลาง
 *   DualAxis  แท่ง (แกนซ้าย) + เส้น (แกนขวา) — คนละหน่วยกันจึงใช้แกนเดียวไม่ได้
 *   StackBar  แท่งซ้อนตามหมวด
 * ทั้งสองห่อ "ทั้งกราฟ" ไม่ได้ห่อแกน — Recharts หาลูกจาก displayName จึงห่อลูกไม่ได้
 */
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, BAR_RADIUS, gridProps, legendProps, tooltipProps } from "../../../lib/chart/primitives";
import { D, fmtShort, useChartTheme } from "../../../lib/chart/theme";
import type { DSeries } from "../../../lib/chart/dcharts";

/** จานสีของกราฟหลายหมวด — เรียงให้สองสีข้างกันต่างค่าความสว่างพอจะแยกออกเมื่อพิมพ์ขาวดำ */
export const PALETTE = [
  D.indigo, D.amber, D.teal, D.rose, D.violet,
  D.emeraldLight, D.orange, D.cyan, D.pink, D.slateDeep,
];

export const fmt = (n: number): string =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("th-TH") : "–";

export const pct = (n: number | null, digits = 1): string =>
  n == null || !Number.isFinite(n) ? "–" : `${n.toFixed(digits)}%`;

/** ตารางตัวเลขในการ์ดแดชบอร์ด — คลาสเดียวกับตารางของแท็บอื่น */
export function Tbl({ head, children }: { head: (string | [string, "n"])[]; children: React.ReactNode }) {
  return (
    <div className="scroll">
      <table className="dz-tbl">
        <thead>
          <tr>
            {head.map((h) => {
              const [label, kind] = Array.isArray(h) ? h : [h, undefined];
              return <th key={label} className={kind === "n" ? "n" : undefined}>{label}</th>;
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>{text}</td>
    </tr>
  );
}

type Row = Record<string, string | number | null>;

/**
 * แท่งบนแกนซ้าย + เส้นบนแกนขวา
 * รายได้เป็นหลักล้าน ส่วนมูลค่าเฉลี่ย/บิลเป็นหลักร้อย — ถ้าใช้แกนเดียวกัน
 * เส้นจะแบนราบติดศูนย์จนดูไม่ออกว่าขึ้นหรือลง
 */
export function DualAxis({ data, xKey, bar, line, barSuffix = " บาท", lineSuffix = " บาท/บิล" }: {
  data: Row[]; xKey: string; bar: DSeries; line: DSeries;
  barSuffix?: string; lineSuffix?: string;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey={xKey} />
        <YAxis {...axisProps(t)} yAxisId="l" tickFormatter={fmtShort} width={68} />
        <YAxis {...axisProps(t)} yAxisId="r" orientation="right" tickFormatter={fmtShort}
          width={54} domain={["auto", "auto"]} />
        <Tooltip {...tooltipProps(t)}
          formatter={(v: number, name: string) =>
            [fmt(v) + (name === line.label ? lineSuffix : barSuffix), name] as [string, string]} />
        <Legend {...legendProps} />
        <Bar yAxisId="l" dataKey={bar.key} name={bar.label} fill={bar.color} radius={BAR_RADIUS} {...anim} />
        <Line yAxisId="r" type="monotone" dataKey={line.key} name={line.label} stroke={line.color}
          strokeWidth={2} dot={{ r: 2, fill: line.color, strokeWidth: 0 }} activeDot={{ r: 4 }} {...anim} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** แท่งซ้อน — ทุกชุดใช้ stackId เดียวกัน มุมมนเฉพาะชุดบนสุดถึงจะดูเป็นแท่งเดียว */
export function StackBar({ data, xKey, series, suffix = " บาท" }: {
  data: Row[]; xKey: string; series: DSeries[]; suffix?: string;
}) {
  const t = useChartTheme();
  const last = series.length - 1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey={xKey} />
        <YAxis {...axisProps(t)} tickFormatter={fmtShort} width={68} />
        <Tooltip {...tooltipProps(t, suffix)} />
        <Legend {...legendProps} />
        {series.map((s, i) => (
          <Bar key={s.key} stackId="a" dataKey={s.key} name={s.label} fill={s.color}
            radius={i === last ? [BAR_RADIUS, BAR_RADIUS, 0, 0] : 0} {...anim} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
