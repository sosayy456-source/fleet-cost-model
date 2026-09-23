/**
 * กราฟสำเร็จรูปของแดชบอร์ด — dBar / dLine / dMixed / dPie เทียบหนึ่งต่อหนึ่งกับของใน index.html บน main
 * ส่วน DDonut เพิ่มทีหลังสำหรับแท็บการใช้ประโยชน์ของกองรถ
 *
 * ห่อทั้งใบไว้ในคอมโพเนนต์ได้ (ต่างจากแกน/กริดที่ห่อไม่ได้) เพราะ Recharts มองหา
 * displayName เฉพาะ "ลูกโดยตรง" ของตัวกราฟ ไม่ได้มองข้ามคอมโพเนนต์ที่ครอบทั้งกราฟ
 */
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, BAR_RADIUS, dFade, gridProps, legendProps, tooltipProps } from "./primitives";
import { DFONT, fmtShort, useChartTheme } from "./theme";
import type { ReactNode } from "react";

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
export function DBar({
  data, xKey, series, horiz, colors, suffix = " บาท", digits = 0, domain, valueTick = fmtShort,
  onBarClick, activeIndex, showValues, tooltipExtra,
}: {
  data: Row[]; xKey: string; series: DSeries[]; horiz?: boolean;
  /** ระบายทีละแท่ง — ใช้กับกราฟชุดเดียวที่ main กำหนดสีเป็นอาร์เรย์ */
  colors?: string[];
  suffix?: string; digits?: number; domain?: [number | string, number | string];
  /** ป้ายบนแกนค่า — ค่าเริ่มต้นเลขเต็มมีคอมมา (กราฟ % ส่งตัวที่เติม % เอง) */
  valueTick?: (n: number) => string;
  /** กดแท่ง (ดัชนีแถวใน data) — แท็บกำไรลูกค้าใช้กรองตารางใต้กราฟ · ไม่ส่ง = กราฟอ่านอย่างเดียว */
  onBarClick?: (index: number) => void;
  /** แท่งที่เลือกอยู่ — แท่งอื่นจางลงให้เห็นว่าเลือกอันไหน · null/undefined = ไม่จางใคร */
  activeIndex?: number | null;
  /** เขียนค่าไว้บนแท่ง (รูปแบบเดียวกับป้ายแกน) */
  showValues?: boolean;
  /**
   * บรรทัดเสริมใน tooltip ต่อแท่ง (เช่น "25% ของที่ยังไม่ชำระ") — ไม่ใช่ series จึงไม่ขึ้นในป้ายสี
   * คืน null = ไม่มีบรรทัดเสริมของแท่งนั้น
   */
  tooltipExtra?: (index: number) => string | null;
}) {
  const t = useChartTheme();
  const showLeg = series.length > 1;
  const cellFill = (i: number, base: string): string => colors?.[i % colors.length] ?? base;
  const dim = (i: number): number => (activeIndex == null || activeIndex === i ? 1 : 0.35);
  const bars = series.map((s) => (
    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={BAR_RADIUS} {...anim}
      cursor={onBarClick ? "pointer" : undefined}
      onClick={onBarClick ? (_d: unknown, i: number) => onBarClick(i) : undefined}>
      {(colors || activeIndex != null) && data.map((_, i) => (
        <Cell key={i} fill={cellFill(i, s.color)} fillOpacity={dim(i)} />
      ))}
      {showValues && (
        <LabelList dataKey={s.key} position={horiz ? "right" : "top"}
          formatter={(v: unknown) => (typeof v === "number" ? valueTick(v) : String(v ?? ""))}
          style={{ fontFamily: DFONT, fontSize: 12, fontWeight: 700, fill: t.ink }} />
      )}
    </Bar>
  ));
  const tip = tooltipProps(t, suffix, digits);
  const tooltip = tooltipExtra ? (
    <Tooltip {...tip} formatter={(v: number, name: string, item: { payload?: Row }) => {
      const [shown] = tip.formatter(v, name);
      // ดัชนีจาก payload ของแถว ไม่ใช่ลำดับ item ใน tooltip (ซึ่งเป็นลำดับของ series)
      const i = item.payload ? data.indexOf(item.payload) : -1;
      const extra = i >= 0 ? tooltipExtra(i) : null;
      return [extra ? `${shown} · ${extra}` : shown, name] as [string, string];
    }} />
  ) : <Tooltip {...tip} />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      {horiz ? (
        <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(t)} />
          <XAxis {...axisProps(t)} type="number" tickFormatter={valueTick} domain={domain} />
          <YAxis {...axisProps(t)} type="category" dataKey={xKey} width={catWidth(data, xKey)} />
          {tooltip}
          {showLeg && <Legend {...legendProps} />}
          {bars}
        </ComposedChart>
      ) : (
        <ComposedChart data={data} margin={{ top: showValues ? 18 : 6, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(t)} />
          <XAxis {...axisProps(t)} dataKey={xKey} />
          <YAxis {...axisProps(t)} tickFormatter={valueTick} width={62} domain={domain} />
          {tooltip}
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
        <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, fontFamily: DFONT, fontSize: 12.5 }} />
        <Pie data={data} dataKey="v" nameKey="name" innerRadius="52%" outerRadius="82%"
          isAnimationActive animationDuration={300} paddingAngle={0} stroke="#FFFFFF" strokeWidth={2}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]!} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ---------------- dDonut: โดนัทมีตัวเลขกลางวง ไม่มีคำอธิบายสีในตัว (หน้าจอวาดรายการสีเอง) ---------------- */
export function DDonut({ data, colors, suffix = " บาท", center }: {
  data: { name: string; v: number }[]; colors: string[]; suffix?: string;
  /** เนื้อหากลางวง — วางทับด้วย CSS เพราะ Recharts ไม่มีช่องให้ใส่ HTML กลางโดนัท */
  center?: ReactNode;
}) {
  const t = useChartTheme();
  return (
    <div className="dz-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipProps(t, suffix)} />
          <Pie data={data} dataKey="v" nameKey="name" innerRadius="64%" outerRadius="94%" startAngle={90} endAngle={-270}
            isAnimationActive animationDuration={300} paddingAngle={0} stroke="#FFFFFF" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]!} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="dz-donut-c">{center}</div>}
    </div>
  );
}
