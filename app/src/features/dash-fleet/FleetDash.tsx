/**
 * แดชบอร์ดต้นทุนการเดินรถ — ยกจาก 6 แท็บของ view-dash ใน v5
 * ใช้ข้อมูลใบรายการ (เครื่อง + Google Sheet) ไม่ใช่ไฟล์ Excel
 */
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartCard, Stat } from "../../lib/chart/primitives";
import { fmtBaht, fmtPct, fmtShort, rankedShades, useChartTheme } from "../../lib/chart/theme";
import { recCost, recProfit } from "../../lib/cost/recCost";
import { monthLabel } from "../../lib/data/useDataset";
import { thDateSafe } from "../../lib/record/date";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const TABS = ["ภาพรวมต้นทุน", "กำไรรายเที่ยว", "การใช้ประโยชน์กองรถ"] as const;
type Tab = (typeof TABS)[number];

const COST_PARTS: [keyof ReturnType<typeof recCost>, string][] = [
  ["fuel", "น้ำมัน+แก๊ส"], ["driver", "ค่าแรง"], ["repair", "ค่าซ่อม"],
  ["other", "ค่าธรรมเนียม"], ["waste", "สูญเปล่า"],
];

export default function FleetDash({ state }: { state: RecordsState }) {
  const [tab, setTab] = useState<Tab>("ภาพรวมต้นทุน");
  const { records, oldRecords, loading } = state;

  const all = useMemo(
    () => [...records, ...(oldRecords as unknown as TripRecord[])],
    [records, oldRecords],
  );

  if (loading) return <div className="card"><p className="muted">กำลังโหลด...</p></div>;

  if (all.length === 0) {
    return (
      <div className="card">
        <h2>แดชบอร์ดต้นทุน</h2>
        <p className="muted">
          ยังไม่มีใบรายการให้สรุป — กรอกใบแรกที่หน้า "กรอกข้อมูล"
          หรือเชื่อม Google Sheet เพื่อดึงใบที่มีอยู่แล้วเข้ามา
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <nav className="nav" style={{ marginBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t} type="button"
              className={"nav-item" + (tab === t ? " nav-active" : "")}
              onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>
      </div>
      {tab === "ภาพรวมต้นทุน" && <CostOverview rows={all} />}
      {tab === "กำไรรายเที่ยว" && <TripProfit rows={all} />}
      {tab === "การใช้ประโยชน์กองรถ" && <Utilisation rows={all} />}
    </>
  );
}

function CostOverview({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  const totals = rows.reduce(
    (a, r) => {
      const c = recCost(r);
      a.revenue += Number(r.revenue) || 0;
      a.cost += c.total;
      a.profit += recProfit(r);
      for (const [k] of COST_PARTS) a.parts[k] = (a.parts[k] ?? 0) + c[k];
      return a;
    },
    { revenue: 0, cost: 0, profit: 0, parts: {} as Record<string, number> },
  );

  const partRows = COST_PARTS
    .map(([k, label]) => ({ name: label, value: totals.parts[k] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const shades = rankedShades(t, partRows.length);

  // รายเดือน — รายได้กับต้นทุน 2 ชุด ใช้สีชุดข้อมูล 2 สีแรก
  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; revenue: number; cost: number }>();
    for (const r of rows) {
      const key = String(r.date ?? "").slice(0, 7);
      if (!key) continue;
      const cur = m.get(key) ?? { month: key, revenue: 0, cost: 0 };
      cur.revenue += Number(r.revenue) || 0;
      cur.cost += recCost(r).total;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const margin = totals.revenue ? totals.profit / totals.revenue * 100 : 0;

  return (
    <>
      <div className="card">
        <h2>ภาพรวม <span className="muted">· {rows.length} เที่ยว</span></h2>
        <div className="grid">
          <Stat label="รายได้" value={fmtBaht(totals.revenue)} sub="บาท" />
          <Stat label="ต้นทุนรวม" value={fmtBaht(totals.cost)} sub="บาท" />
          <Stat label="กำไร/ขาดทุน" value={fmtBaht(totals.profit)}
            tone={totals.profit >= 0 ? t.status.good : t.status.critical}
            sub={(totals.profit >= 0 ? "กำไร " : "ขาดทุน ") + fmtPct(Math.abs(margin))} />
          <Stat label="ต้นทุนสูญเปล่า" value={fmtBaht(totals.parts.waste ?? 0)}
            tone={t.status.critical} sub="บาท" />
        </div>
      </div>

      <ChartCard
        title="ต้นทุนแยกตามหมวด"
        note="ไล่เฉดสีเดียวเรียงตามขนาด — เข้มคือหมวดที่กินเงินมากสุด"
        table={
          <table>
            <thead><tr><th>หมวด</th><th className="n">บาท</th><th className="n">สัดส่วน</th></tr></thead>
            <tbody>
              {partRows.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="n">{fmtBaht(p.value)}</td>
                  <td className="n">{fmtPct(totals.cost ? p.value / totals.cost * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={partRows} layout="vertical" margin={{ top: 8, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtShort} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }}
              contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                              borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              formatter={(v: number) => [fmtBaht(v) + " บาท", "ต้นทุน"]} />
            <Bar isAnimationActive={false} dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {partRows.map((_, i) => <Cell key={i} fill={shades[i]!} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {byMonth.length > 1 && (
        <ChartCard title="รายได้เทียบต้นทุนรายเดือน" note="สองชุดข้อมูล หน่วยเดียวกัน จึงอยู่แกนเดียวได้">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} stroke={t.axis}
                tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
              <YAxis tickFormatter={fmtShort} stroke={t.axis} width={64}
                tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
              <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }}
                contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                                borderRadius: 8, color: t.ink, fontSize: 12.5 }}
                labelFormatter={monthLabel}
                formatter={(v: number) => fmtBaht(v) + " บาท"} />
              <Legend wrapperStyle={{ fontSize: 12, color: t.inkMuted }} />
              <Bar isAnimationActive={false} dataKey="revenue" name="รายได้" fill={t.categorical[0]}
                radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar isAnimationActive={false} dataKey="cost" name="ต้นทุน" fill={t.categorical[1]}
                radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}

function TripProfit({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();
  const trips = rows
    .map((r) => ({
      id: r.id, docNo: r.docNo, date: r.date,
      route: r.origin && r.dest ? `${r.origin} → ${r.dest}` : "–",
      plate: r.plate, revenue: Number(r.revenue) || 0,
      cost: recCost(r).total, profit: recProfit(r),
    }))
    .sort((a, b) => a.profit - b.profit);

  const losing = trips.filter((x) => x.profit < 0);

  return (
    <>
      <div className="card">
        <h2>กำไรรายเที่ยว</h2>
        <div className="grid">
          <Stat label="เที่ยวทั้งหมด" value={String(trips.length)} />
          <Stat label="เที่ยวที่ขาดทุน" value={String(losing.length)}
            tone={losing.length ? t.status.critical : t.status.good}
            sub={fmtPct(trips.length ? losing.length / trips.length * 100 : 0) + " ของทั้งหมด"} />
          <Stat label="ยอดขาดทุนรวม"
            value={fmtBaht(losing.reduce((s, x) => s + x.profit, 0))}
            tone={t.status.critical} sub="บาท" />
        </div>
      </div>

      <div className="card">
        <h2>เที่ยวที่ขาดทุนมากสุด</h2>
        {losing.length === 0 ? (
          <p className="muted">ไม่มีเที่ยวที่ขาดทุน</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th>เลขที่ใบ</th><th>วันที่</th><th>เส้นทาง</th><th>ทะเบียน</th>
                  <th className="n">รายได้</th><th className="n">ต้นทุน</th><th className="n">ขาดทุน</th></tr>
              </thead>
              <tbody>
                {losing.slice(0, 30).map((x) => (
                  <tr key={x.id}>
                    <td>{x.docNo || "–"}</td>
                    <td>{thDateSafe(x.date)}</td>
                    <td>{x.route}</td>
                    <td>{x.plate || "–"}</td>
                    <td className="n">{fmtBaht(x.revenue)}</td>
                    <td className="n">{fmtBaht(x.cost)}</td>
                    <td className="n" style={{ color: t.status.critical }}>{fmtBaht(x.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Utilisation({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  const byPlate = useMemo(() => {
    const m = new Map<string, { plate: string; trips: number; revenue: number; cost: number; lost: number }>();
    for (const r of rows) {
      const plate = r.plate || "(ไม่ระบุทะเบียน)";
      const cur = m.get(plate) ?? { plate, trips: 0, revenue: 0, cost: 0, lost: 0 };
      const cost = recCost(r).total;
      cur.trips += 1;
      cur.revenue += Number(r.revenue) || 0;
      cur.cost += cost;
      // เที่ยวเปล่านับต้นทุนทั้งเที่ยวเป็นมูลค่าที่เสียไป ส่วนเที่ยวที่บรรทุกไม่เต็ม
      // คิดตามสัดส่วนที่ว่าง (เทียบเท่าการคิด load factor ใน v5)
      const cap = Number(r.capacity) || 0;
      const load = Number(r.loadActual) || 0;
      const factor = r.emptyLeg ? 0 : cap > 0 ? Math.min(1, load / cap) : 1;
      cur.lost += cost * (1 - factor);
      m.set(plate, cur);
    }
    return [...m.values()].sort((a, b) => b.lost - a.lost);
  }, [rows]);

  const totalLost = byPlate.reduce((s, p) => s + p.lost, 0);
  const shades = rankedShades(t, Math.min(12, byPlate.length));

  return (
    <>
      <div className="card">
        <h2>การใช้ประโยชน์กองรถ</h2>
        <div className="grid">
          <Stat label="จำนวนคันที่มีเที่ยววิ่ง" value={String(byPlate.length)} />
          <Stat label="มูลค่าที่เสียจากพื้นที่ว่าง" value={fmtBaht(totalLost)}
            tone={t.status.serious} sub="บาท" />
        </div>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
          คิดจากสัดส่วนน้ำหนักบรรทุกจริงเทียบความจุ · เที่ยวเปล่านับต้นทุนทั้งเที่ยว
          — ถ้าไม่ได้กรอกความจุจะถือว่าใช้เต็ม จึงไม่นับเป็นมูลค่าที่เสีย
        </p>
      </div>

      <ChartCard title="มูลค่าที่เสียไปรายคัน (สูงสุด 12 คัน)"
        table={
          <table>
            <thead><tr><th>ทะเบียน</th><th className="n">เที่ยว</th>
              <th className="n">ต้นทุน</th><th className="n">เสียจากพื้นที่ว่าง</th></tr></thead>
            <tbody>
              {byPlate.map((p) => (
                <tr key={p.plate}>
                  <td>{p.plate}</td>
                  <td className="n">{p.trips}</td>
                  <td className="n">{fmtBaht(p.cost)}</td>
                  <td className="n">{fmtBaht(p.lost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height={Math.max(200, Math.min(12, byPlate.length) * 32 + 40)}>
          <BarChart data={byPlate.slice(0, 12)} layout="vertical"
            margin={{ top: 8, right: 60, left: 8, bottom: 4 }}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtShort} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <YAxis type="category" dataKey="plate" width={120} stroke={t.axis}
              tick={{ fill: t.inkMuted, fontSize: 11 }} tickLine={false} />
            <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.35 }}
              contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.grid}`,
                              borderRadius: 8, color: t.ink, fontSize: 12.5 }}
              formatter={(v: number) => [fmtBaht(v) + " บาท", "มูลค่าที่เสีย"]} />
            <Bar isAnimationActive={false} dataKey="lost" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {byPlate.slice(0, 12).map((_, i) => <Cell key={i} fill={shades[i] ?? shades.at(-1)!} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}
