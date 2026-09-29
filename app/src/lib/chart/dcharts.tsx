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
    <Tooltip {...tip} itemStyle={{ ...tip.itemStyle, whiteSpace: "pre-line" }}
      formatter={(v: number, name: string, item: { payload?: Row }) => {
      const [shown] = tip.formatter(v, name);
      // ดัชนีจาก payload ของแถว ไม่ใช่ลำดับ item ใน tooltip (ซึ่งเป็นลำดับของ series)
      const i = item.payload ? data.indexOf(item.payload) : -1;
      const extra = i >= 0 ? tooltipExtra(i) : null;
      return [extra ? `${shown}\n${extra}` : shown, name] as [string, string];
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

/* ---------------- dPieSplit: วงกลมเต็ม (ไม่เจาะกลาง) ป้าย % ในชิ้น — สัดส่วน Top 10 ของ Customer Performance ---------------- */
export function DPieSplit({ data, colors, stroke, suffix = " บาท" }: {
  data: { name: string; v: number }[]; colors: string[];
  /** สีเส้นกรอบรอบวงและระหว่างชิ้น — ไม่ส่ง = สีตัวอักษรเข้มของธีม */
  stroke?: string; suffix?: string;
}) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + Math.max(0, d.v), 0);
  // ป้าย % ทุกชิ้นเสมอ (เจ้าของงานสั่ง — ฝั่งขาดทุน Top 10 ต้องเห็น %) · ชิ้นใหญ่ ≥ 15% วางในชิ้นตัวขาว ·
  // ชิ้นเล็กวางนอกวงตัวสีเข้ม + เส้นโยง (ในชิ้นแคบตัวเลขล้นขอบ อ่านไม่ออก)
  const label = ({ cx, cy, midAngle, outerRadius, value }: { cx: number; cy: number; midAngle: number; outerRadius: number; value: number }) => {
    if (!total || value <= 0) return null;
    const a = -midAngle * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const txt = (value / total * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    if (value / total >= 0.15) {
      const r = outerRadius * 0.58;
      return <text x={cx + r * cos} y={cy + r * sin} textAnchor="middle" dominantBaseline="central"
        fill="#FFFFFF" fontFamily={DFONT} fontSize={16} fontWeight={700}>{txt}</text>;
    }
    const x1 = cx + outerRadius * cos, y1 = cy + outerRadius * sin;
    const x2 = cx + (outerRadius + 14) * cos, y2 = cy + (outerRadius + 14) * sin;
    const right = cos >= 0, x3 = x2 + (right ? 12 : -12);
    return <g>
      <path d={`M${x1},${y1}L${x2},${y2}L${x3},${y2}`} stroke={t.ink2} strokeWidth={1.2} fill="none" />
      <text x={x3 + (right ? 4 : -4)} y={y2} textAnchor={right ? "start" : "end"} dominantBaseline="central"
        fill={t.ink} fontFamily={DFONT} fontSize={16} fontWeight={700}>{txt}</text>
    </g>;
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip {...tooltipProps(t, suffix)} />
        {/* กรอบเส้นสีเข้มรอบวงและระหว่างชิ้น (เจ้าของงานสั่ง 28 ก.ย. 2569) · รัศมี 72% เผื่อที่ป้ายนอกวง */}
        <Pie data={data} dataKey="v" nameKey="name" innerRadius={0} outerRadius="72%" startAngle={90} endAngle={-270}
          isAnimationActive animationDuration={300} paddingAngle={0} stroke={stroke ?? t.ink} strokeWidth={1.5}
          labelLine={false} label={label}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]!} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ---------------- dWaterfall: รายได้ → ต้นทุนแต่ละก้อน → กำไร ---------------- */

/** หนึ่งแท่ง — total = ยอดรวม (รายได้ · กำไร) ป้ายเป็นค่าตามจริง · ไม่งั้นเป็นก้อนต้นทุน ป้ายติดเครื่องหมายลบ */
export interface WaterStep { label: string; value: number; total?: boolean; color: string }

/**
 * กราฟ รายได้ → ต้นทุนแต่ละก้อน → กำไร (Executive Summary) — ทุกแท่งตั้งจากฐาน สูงตามขนาดของค่า เต็มกว้างกล่อง
 * (เจ้าของงานสั่ง 28 ก.ย. 2569 ตามภาพต้นแบบ — รุ่นแรกเป็นแท่งลอยแบบน้ำตก) · กำไรติดลบ = แท่งสูงเท่าขนาดขาดทุน ป้าย "−"
 * value = บาท · fmtValue = ป้ายบนแท่ง/tooltip (ผู้เรียกกำหนดหน่วย เช่น ล้านบาท)
 */
export function DWaterfall({ steps, fmtValue }: { steps: WaterStep[]; fmtValue: (n: number) => string }) {
  const t = useChartTheme();
  const data = steps.map((s) => ({
    label: s.label, h: Math.abs(s.value), lbl: s.total ? fmtValue(s.value) : fmtValue(-s.value), color: s.color,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 22, right: 0, left: 0, bottom: 0 }} barCategoryGap="4%">
        <XAxis {...axisProps(t)} dataKey="label" interval={0} />
        <YAxis hide domain={[0, "dataMax"]} />
        <Tooltip {...tooltipProps(t)} formatter={(_v: unknown, _n: string, item: { payload?: { lbl: string } }) =>
          [item.payload?.lbl ?? "", ""] as [string, string]} />
        <Bar dataKey="h" radius={[6, 6, 0, 0]} {...anim}>
          {data.map((d) => <Cell key={d.label} fill={d.color} />)}
          <LabelList dataKey="lbl" position="top"
            style={{ fontFamily: DFONT, fontSize: 12, fontWeight: 700, fill: t.ink2 }} />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
