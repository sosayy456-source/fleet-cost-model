/**
 * แดชบอร์ดรายได้ — ยุบ 8 หน้าของแอป Streamlit เดิมมาไว้ที่นี่
 *
 * สิ่งที่เพิ่มจากของเดิม: ตัวกรองเดือน ซึ่ง Streamlit ทำไม่ได้เลยสักหน้า
 * เพราะมันทิ้ง DataFrame แล้วเก็บแต่ผลรวมสำเร็จรูป ที่นี่กรองบน cube.json
 * ที่ ETL ยุบไว้ให้ (144,993 แถว → 2,916) แล้วรวมยอดใหม่ในเบราว์เซอร์
 */
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartCard, InsightCard, Stat } from "../../lib/chart/primitives";
import { fmtBaht, fmtPct, fmtShort, rankedShades, useChartTheme } from "../../lib/chart/theme";
import { monthLabel, useDataset } from "../../lib/data/useDataset";
import type { CubeRow, Dataset } from "../../lib/data/useDataset";

const TABS = [
  "ภาพรวม", "แนวโน้มรายได้", "การชำระเงิน", "วิเคราะห์บิล",
  "ลูกหนี้คงค้าง", "ลูกค้า", "คุณภาพข้อมูล", "ข้อสังเกต",
] as const;
type Tab = (typeof TABS)[number];

const DOW_TH: Record<string, string> = {
  Monday: "จันทร์", Tuesday: "อังคาร", Wednesday: "พุธ", Thursday: "พฤหัส",
  Friday: "ศุกร์", Saturday: "เสาร์", Sunday: "อาทิตย์",
};

/** รวมยอดจาก cube ตามมิติที่เลือก — ใช้แทนการยิง API */
function aggregate(cube: CubeRow[], dim: string, months: string[] | null) {
  const acc = new Map<string, { revenue: number; lines: number; bills: number }>();
  for (const row of cube) {
    if (months && !months.includes(row.month)) continue;
    const key = String(row[dim] ?? "(ไม่ระบุ)");
    const cur = acc.get(key) ?? { revenue: 0, lines: 0, bills: 0 };
    cur.revenue += row.revenue;
    cur.lines += row.lines;
    cur.bills += row.bills;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export default function RevenueDash() {
  const { data, error } = useDataset();
  const [tab, setTab] = useState<Tab>("ภาพรวม");
  const [month, setMonth] = useState<string>("all");

  if (error) {
    return (
      <div className="card">
        <h2>แดชบอร์ดรายได้</h2>
        <div className="banner">{error}</div>
        <p className="muted">
          สร้างไฟล์ข้อมูลด้วย <code>python etl/build_json.py --dataset sample</code> ก่อน
        </p>
      </div>
    );
  }
  if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูล...</p></div>;

  const months = data.monthly.map((m) => m.month);
  const selected = month === "all" ? null : [month];

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">ทุกเดือน</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>
            {data.manifest.rowCount.toLocaleString("th-TH")} รายการ ·{" "}
            {data.manifest.sourceFiles.length} ไฟล์ ·{" "}
            ยุบเป็น cube {data.manifest.cube.cube_rows.toLocaleString("th-TH")} แถว
          </span>
        </div>
        <nav className="nav" style={{ marginTop: 12, marginBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t} type="button"
              className={"nav-item" + (tab === t ? " nav-active" : "")}
              onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
      </div>

      {tab === "ภาพรวม" && <Overview data={data} months={selected} />}
      {tab === "แนวโน้มรายได้" && <Trend data={data} />}
      {tab === "การชำระเงิน" && <Ranked data={data} months={selected}
        dim="ประเภทการชำระเงิน" title="รายได้ตามประเภทการชำระเงิน" />}
      {tab === "วิเคราะห์บิล" && <Bills data={data} months={selected} />}
      {tab === "ลูกหนี้คงค้าง" && <Unpaid data={data} months={selected} />}
      {tab === "ลูกค้า" && <Customers data={data} />}
      {tab === "คุณภาพข้อมูล" && <Quality data={data} />}
      {tab === "ข้อสังเกต" && <Insights data={data} />}
    </>
  );
}

function Overview({ data, months }: { data: Dataset; months: string[] | null }) {
  const t = useChartTheme();
  const o = data.overview;
  const rows = months
    ? data.monthly.filter((m) => months.includes(m.month))
    : data.monthly;
  const revenue = months ? rows.reduce((s, m) => s + m.revenue, 0) : o.total_revenue;
  const bills = months ? rows.reduce((s, m) => s + m.bills, 0) : o.distinct_bills;

  return (
    <>
      <div className="card">
        <h2>ภาพรวม</h2>
        <div className="grid">
          <Stat label="รายได้รวม" value={fmtBaht(revenue)} sub="บาท" />
          <Stat label="จำนวนบิล" value={bills.toLocaleString("th-TH")} />
          <Stat label="รายการทั้งหมด" value={o.total_line_items.toLocaleString("th-TH")} />
          <Stat label="ค่าเฉลี่ยต่อบิล" value={fmtBaht(o.avg_bill_value)} sub="บาท" />
        </div>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
          ข้อมูล {o.date_min} ถึง {o.date_max}
        </p>
      </div>

      <ChartCard
        title="รายได้รายเดือน"
        note="แท่งเดียว ไม่ต้องมีคำอธิบายสี — ชื่อกราฟบอกแล้วว่าคืออะไร"
        table={<MonthTable rows={data.monthly} />}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis tickFormatter={fmtShort} stroke={t.axis} width={64}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip
              cursor={{ fill: t.grid, fillOpacity: 0.35 }}
              contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                              borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              labelFormatter={monthLabel}
              formatter={(v: number) => [fmtBaht(v) + " บาท", "รายได้"]}
            />
            <Bar isAnimationActive={false} dataKey="revenue" fill={t.categorical[0]} radius={[4, 4, 0, 0]} maxBarSize={54} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="card">
        <h2>ข้อสังเกตเด่น</h2>
        {(data.insights.revenue ?? []).slice(0, 3).map((i, k) => (
          <InsightCard key={k} level={i.level} html={i.text} />
        ))}
      </div>
    </>
  );
}

function Trend({ data }: { data: Dataset }) {
  const t = useChartTheme();
  const dow = data.dow.map((d) => ({ ...d, name: DOW_TH[String(d.dow)] ?? String(d.dow) }));

  return (
    <>
      <ChartCard
        title="จำนวนบิลรายเดือน"
        note="แยกกราฟกับรายได้ ไม่รวมเป็นสองแกนในรูปเดียว เพราะคนละหน่วยกัน"
        table={<MonthTable rows={data.monthly} />}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.monthly} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis stroke={t.axis} width={64} tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                                     borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              labelFormatter={monthLabel}
              formatter={(v: number) => [v.toLocaleString("th-TH") + " บิล", "จำนวนบิล"]} />
            <Line isAnimationActive={false} type="monotone" dataKey="bills" stroke={t.categorical[0]}
              strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="รายได้ตามวันในสัปดาห์"
        table={<SimpleTable rows={dow.map((d) => ({ name: d.name, revenue: d.revenue }))} />}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dow} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke={t.axis} tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis tickFormatter={fmtShort} stroke={t.axis} width={64}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }}
              contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                              borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              formatter={(v: number) => [fmtBaht(v) + " บาท", "รายได้"]} />
            <Bar isAnimationActive={false} dataKey="revenue" fill={t.categorical[0]} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

/** หมวดที่เรียงตามขนาดได้ ใช้ไล่เฉดสีเดียว ไม่ใช่ไล่สี — อ่านลำดับได้จากสีเลย */
function Ranked({ data, months, dim, title }: {
  data: Dataset; months: string[] | null; dim: string; title: string;
}) {
  const t = useChartTheme();
  const rows = useMemo(() => aggregate(data.cube, dim, months).slice(0, 12),
    [data.cube, dim, months]);
  const shades = rankedShades(t, rows.length);
  const total = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <ChartCard
      title={title}
      note="ไล่เฉดสีเดียวเรียงตามขนาด — เข้มคืออันดับต้น"
      table={<SimpleTable rows={rows} total={total} />}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34 + 40)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 60, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={fmtShort} stroke={t.axis}
            tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} stroke={t.axis}
            tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
          <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }}
            contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                            borderRadius: 8, color: t.ink, fontSize: 12.5 }}
            formatter={(v: number) => [
              `${fmtBaht(v)} บาท (${fmtPct(total ? v / total * 100 : 0)})`, "รายได้"]} />
          <Bar isAnimationActive={false} dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((_, i) => <Cell key={i} fill={shades[i]!} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function Bills({ data, months }: { data: Dataset; months: string[] | null }) {
  return (
    <>
      <Ranked data={data} months={months} dim="ประเภทสินค้า" title="รายได้ตามประเภทสินค้า" />
      <Ranked data={data} months={months} dim="ประเภทการคิดราคา" title="รายได้ตามเกณฑ์คิดราคา" />
      <Ranked data={data} months={months} dim="สายกระจาย" title="รายได้ตามสายกระจาย" />
      <Ranked data={data} months={months} dim="สถานะบิล" title="รายได้ตามสถานะบิล" />
    </>
  );
}

function Unpaid({ data, months }: { data: Dataset; months: string[] | null }) {
  const t = useChartTheme();
  const byStatus = useMemo(() => aggregate(data.cube, "สถานะการชำระเงิน", months),
    [data.cube, months]);
  const unpaid = byStatus.find((r) => r.name.includes("ยังไม่ได้ชำระ"));
  const total = byStatus.reduce((s, r) => s + r.revenue, 0);

  return (
    <>
      <div className="card">
        <h2>ลูกหนี้คงค้าง</h2>
        <div className="grid">
          <Stat label="ยอดค้างชำระ" value={fmtBaht(unpaid?.revenue ?? 0)}
            tone={t.status.critical} sub="บาท" />
          <Stat label="บิลค้างชำระ" value={(unpaid?.bills ?? 0).toLocaleString("th-TH")} />
          <Stat label="สัดส่วนของรายได้"
            value={fmtPct(total ? (unpaid?.revenue ?? 0) / total * 100 : 0)} />
        </div>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
          ข้อมูลชุดนี้ไม่มีคอลัมน์วันครบกำหนดหรือวันที่ชำระจริง จึงทำ aging เป็นช่วงอายุหนี้ไม่ได้
          — ดูอายุหนี้รายบิลได้ที่หน้า "ลูกหนี้" ซึ่งใช้ข้อมูลจาก Google Sheet
        </p>
      </div>
      <Ranked data={data} months={months} dim="สถานะการชำระเงิน" title="รายได้ตามสถานะการชำระเงิน" />
    </>
  );
}

function Customers({ data }: { data: Dataset }) {
  const t = useChartTheme();
  const p = data.pareto;
  return (
    <>
      <div className="card">
        <h2>การกระจุกตัวของลูกค้า</h2>
        <div className="grid">
          <Stat label="ลูกค้าทั้งหมด" value={p.total_customers.toLocaleString("th-TH")} />
          <Stat label="ลูกค้าที่ทำรายได้ 80%" value={p.n_for_80pct.toLocaleString("th-TH")}
            sub={fmtPct(p.pct_customers_for_80pct) + " ของทั้งหมด"} />
          <Stat label="Top 1% ทำรายได้"
            value={fmtPct(p.concentration.top_1pct ?? 0)} />
          <Stat label="Top 10% ทำรายได้"
            value={fmtPct(p.concentration.top_10pct ?? 0)} />
        </div>
      </div>

      <ChartCard title="เส้นโค้ง Pareto"
        note="แกนนอน = สัดส่วนลูกค้าเรียงจากรายได้มากไปน้อย · แกนตั้ง = รายได้สะสม">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={p.curve} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
            <XAxis dataKey="cust_pct" type="number" domain={[0, 100]}
              tickFormatter={(v: number) => `${Math.round(v)}%`} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} stroke={t.axis}
              width={50} tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                                     borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              labelFormatter={(v: number) => `ลูกค้า ${Number(v).toFixed(1)}% แรก`}
              formatter={(v: number) => [fmtPct(v), "รายได้สะสม"]} />
            <ReferenceLine y={80} stroke={t.status.serious} strokeDasharray="4 4"
              label={{ value: "80% ของรายได้", fill: t.inkMuted, fontSize: 11, position: "insideTopRight" }} />
            <Line isAnimationActive={false} type="monotone" dataKey="cum_pct" stroke={t.categorical[0]}
              strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="card">
        {(data.insights.customer ?? []).map((i, k) => (
          <InsightCard key={k} level={i.level} html={i.text} />
        ))}
      </div>
    </>
  );
}

function Quality({ data }: { data: Dataset }) {
  const t = useChartTheme();
  const dq = data.dq as Record<string, number | Record<string, unknown>>;
  const n = (k: string) => Number(dq[k] ?? 0);
  const ids = dq.customerIdFormats as { mixed?: boolean; by_file?: Record<string, unknown> } | undefined;

  return (
    <>
      <div className="card">
        <h2>คุณภาพข้อมูล</h2>
        <div className="grid">
          <Stat label="แถวซ้ำ" value={n("duplicate_rows").toLocaleString("th-TH")}
            tone={n("duplicate_rows") ? t.status.critical : undefined}
            sub={`เสี่ยงนับซ้ำ ${fmtBaht(n("duplicate_revenue_at_risk"))} บาท`} />
          <Stat label="ยังไม่ได้ชำระ" value={n("unpaid_count").toLocaleString("th-TH")}
            sub={`${fmtBaht(n("unpaid_amount"))} บาท`} />
          <Stat label='สถานะ "ตัดจบ"' value={n("cut_short_count").toLocaleString("th-TH")}
            sub={`${fmtBaht(n("cut_short_amount"))} บาท`} />
          <Stat label="ขนาดสินค้าผิดปกติ" value={n("bad_dimension_rows").toLocaleString("th-TH")}
            sub="เกิน 100 เมตร" />
          <Stat label="วันที่อ่านไม่ออก" value={n("bad_date_rows").toLocaleString("th-TH")} />
        </div>
      </div>

      {ids?.mixed && (
        <div className="card">
          <h2>รหัสลูกค้าปนกันหลายรูปแบบ</h2>
          <InsightCard level="alert" html={
            "ไฟล์ต้นทางใช้รหัสลูกค้าคนละรูปแบบกัน ทำให้ <b>ลูกค้าคนเดียวถูกนับเป็นหลายคน</b> " +
            "จำนวนลูกค้าและ Pareto จึงเพี้ยน ควรแปลงให้เป็นรูปแบบเดียวกันทั้งชุด"} />
          <div className="scroll-x">
            <table>
              <thead><tr><th>ไฟล์</th><th>รูปแบบที่พบ</th></tr></thead>
              <tbody>
                {Object.entries(ids.by_file ?? {}).map(([f, cols]) => (
                  <tr key={f}>
                    <td>{f}</td>
                    <td className="muted">
                      {Object.entries(cols as Record<string, Record<string, number>>)
                        .map(([c, counts]) =>
                          `${c}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        {(data.insights.quality ?? []).map((i, k) => (
          <InsightCard key={k} level={i.level} html={i.text} />
        ))}
      </div>
    </>
  );
}

function Insights({ data }: { data: Dataset }) {
  const groups: [string, string][] = [
    ["revenue", "รายได้"], ["payment", "การชำระเงิน"],
    ["customer", "ลูกค้า"], ["quality", "คุณภาพข้อมูล"],
  ];
  return (
    <>
      {groups.map(([k, label]) => (
        <div className="card" key={k}>
          <h2>{label}</h2>
          {(data.insights[k] ?? []).map((i, j) => (
            <InsightCard key={j} level={i.level} html={i.text} />
          ))}
        </div>
      ))}
    </>
  );
}

function MonthTable({ rows }: { rows: Dataset["monthly"] }) {
  return (
    <table>
      <thead>
        <tr><th>เดือน</th><th className="n">รายได้</th><th className="n">บิล</th>
          <th className="n">เฉลี่ย/บิล</th><th className="n">โต</th></tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.month}>
            <td>{monthLabel(m.month)}</td>
            <td className="n">{fmtBaht(m.revenue)}</td>
            <td className="n">{m.bills.toLocaleString("th-TH")}</td>
            <td className="n">{m.avg_bill_value != null ? fmtBaht(m.avg_bill_value) : "–"}</td>
            <td className="n">{m.growth_pct != null ? fmtPct(m.growth_pct) : "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SimpleTable({ rows, total }: {
  rows: { name: string; revenue: number; bills?: number; lines?: number }[];
  total?: number;
}) {
  return (
    <table>
      <thead>
        <tr><th>รายการ</th><th className="n">รายได้</th>
          {total != null && <th className="n">สัดส่วน</th>}</tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td className="n">{fmtBaht(r.revenue)}</td>
            {total != null && (
              <td className="n">{fmtPct(total ? r.revenue / total * 100 : 0)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
