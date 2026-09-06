/**
 * กราฟสำเร็จรูป 4 แบบของแดชบอร์ด — เทียบหนึ่งต่อหนึ่งกับ dBar / dLine / dMixed / dPie
 * ใน index.html บน main
 *
 * ห่อทั้งใบไว้ในคอมโพเนนต์ได้ (ต่างจากแกน/กริดที่ห่อไม่ได้) เพราะ Recharts มองหา
 * displayName เฉพาะ "ลูกโดยตรง" ของตัวกราฟ ไม่ได้มองข้ามคอมโพเนนต์ที่ครอบทั้งกราฟ
 */
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, BAR_RADIUS, dFade, gridProps, legendProps, tooltipProps } from "./primitives";
import { DFONT, fmtShort, useChartTheme } from "./theme";

/** ชุดข้อมูลหนึ่งเส้น/หนึ่งกลุ่มแท่ง */
export interface DSeries {
  key: string;
  label: string;
  color: string;
}

type Row = Record<string, string | number | null>;

/** ความกว้างแกนหมวดหมู่ของกราฟแท่งแนวนอน — Chart.js คำนวณให้เอง ที่นี่ต้องบอก */
const catWidth = (rows: Row[], key: string): number => {
  const longest = rows.reduce((m, r) => Math.max(m, String(r[key] ?? "").length), 0);
  return Math.min(230, Math.max(70, longest * 7.2 + 12));
};

/* ---------------- dLine: เส้นโค้งมีพื้นใต้เส้น ---------------- */
export function DLine({ data, xKey, series, suffix = " บาท", digits = 0 }: {
  data: Row[]; xKey: string; series: DSeries[]; suffix?: string; digits?: number;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey={xKey} />
        {/* Chart.js ไม่บังคับให้แกนเริ่มที่ 0 สำหรับกราฟเส้น — ปล่อยให้ซูมตามช่วงข้อมูล */}
        <YAxis {...axisProps(t)} tickFormatter={fmtShort} width={62} domain={["auto", "auto"]} />
        <Tooltip {...tooltipProps(t, suffix, digits)} />
        {series.length > 1 && <Legend {...legendProps} />}
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
            stroke={s.color} strokeWidth={2.2} fill={dFade(s.color)} fillOpacity={1}
            dot={false} activeDot={{ r: 4 }} connectNulls {...anim} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------- dBar: แท่งตั้งหรือแท่งนอน ---------------- */
export function DBar({ data, xKey, series, horiz, colors, suffix = " บาท", digits = 0, domain }: {
  data: Row[]; xKey: string; series: DSeries[]; horiz?: boolean;
  /** ระบายทีละแท่ง — ใช้กับกราฟชุดเดียวที่ main กำหนดสีเป็นอาร์เรย์ */
  colors?: string[];
  suffix?: string; digits?: number; domain?: [number | string, number | string];
}) {
  const t = useChartTheme();
  const showLeg = series.length > 1;
  const bars = series.map((s) => (
    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={BAR_RADIUS} {...anim}>
      {colors && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
    </Bar>
  ));
  return (
    <ResponsiveContainer width="100%" height="100%">
      {horiz ? (
        <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(t)} />
          <XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} domain={domain} />
          <YAxis {...axisProps(t)} type="category" dataKey={xKey} width={catWidth(data, xKey)} />
          <Tooltip {...tooltipProps(t, suffix, digits)} />
          {showLeg && <Legend {...legendProps} />}
          {bars}
        </ComposedChart>
      ) : (
        <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(t)} />
          <XAxis {...axisProps(t)} dataKey={xKey} />
          <YAxis {...axisProps(t)} tickFormatter={fmtShort} width={62} domain={domain} />
          <Tooltip {...tooltipProps(t, suffix, digits)} />
          {showLeg && <Legend {...legendProps} />}
          {bars}
        </ComposedChart>
      )}
    </ResponsiveContainer>
  );
}

/* ---------------- dMixed: แท่ง + เส้นทับ ---------------- */
export function DMixed({ data, xKey, bars, line, suffix = " บาท" }: {
  data: Row[]; xKey: string; bars: DSeries[]; line?: DSeries; suffix?: string;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey={xKey} />
        <YAxis {...axisProps(t)} tickFormatter={fmtShort} width={62} />
        <Tooltip {...tooltipProps(t, suffix)} />
        <Legend {...legendProps} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={BAR_RADIUS} {...anim} />
        ))}
        {line && (
          <Line type="monotone" dataKey={line.key} name={line.label} stroke={line.color}
            strokeWidth={2} dot={{ r: 2, fill: line.color, strokeWidth: 0 }} activeDot={{ r: 4 }} {...anim} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------- dPie: โดนัท ---------------- */
export function DPie({ data, colors, suffix = " บาท" }: {
  data: { name: string; v: number }[]; colors: string[]; suffix?: string;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip {...tooltipProps(t, suffix)} />
        <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, fontFamily: DFONT, fontSize: 11 }} />
        <Pie data={data} dataKey="v" nameKey="name" innerRadius="52%" outerRadius="82%"
          isAnimationActive animationDuration={300} paddingAngle={0} stroke="#FFFFFF" strokeWidth={2}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]!} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
