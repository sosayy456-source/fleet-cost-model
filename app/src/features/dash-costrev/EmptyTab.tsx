/**
 * แท็บ "เที่ยววิ่งเปล่า" — ทำตาม docs/spec-เที่ยววิ่งเปล่า.md (ตกลงกับเจ้าของข้อมูล 17 ก.ย. 2569)
 * เจ้าของกำหนดว่าห้ามแสดงอะไรเกินจากในเอกสาร — จะเพิ่มกราฟ/ตัวเลขต้องถามก่อน
 *
 *   เที่ยววิ่งเปล่า = t.empty (ETL ดูสองคอลัมน์รายได้ = 0 พร้อมกัน) · ห้ามใช้ t.rev === 0 แทน
 *   ทุก % = ต้นทุนเที่ยวเปล่า ÷ ต้นทุนของ "ทุกเที่ยว" (รวมเที่ยวเปล่า) ในขอบเขตเดียวกัน
 *
 *   KPI  ต้นทุนเที่ยวเปล่ารวม · จำนวนเที่ยวเปล่า · % ปีล่าสุด (กำกับถ้าปีนั้นยังไม่เต็มปี)
 *   [1]  % รายปี (เส้น) + 100% stacked bar เที่ยวเปล่า vs เที่ยวมีรายได้ (บาท)
 *   [2]  Top 10 เส้นทาง จำนวนเที่ยวเปล่า   [3] Top 10 เส้นทาง ต้นทุนเที่ยวเปล่า — วางคู่กัน
 *   [4]  scatter รายเส้นทาง (เฉพาะเส้นทางที่เที่ยวรวม ≥ MIN_TRIPS) + ตารางตั้งต้น
 *   [5]  % รายเดือนไล่ตามเวลาจริง เลือกเส้นทางได้หลายเส้น (ค่าเริ่มต้น = ต้นทุนเที่ยวเปล่าสูงสุด)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { DBar } from "../../lib/chart/dcharts";
import { anim, axisProps, gridProps, legendProps, tooltipProps } from "../../lib/chart/primitives";
import { D, DFONT, fmtShort, useChartTheme } from "../../lib/chart/theme";
import { CC, Hero, Note, Pane } from "../dash-fleet/parts";
import { BASE_F0, isFiltered, ListFF, MonthFF, SortTable, YearFF, duniq, fmt, monthLabel, passBase, pct,
         useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import type { BaseFilter, Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

/** เกณฑ์ขั้นต่ำของ [4] — เจ้าของให้เริ่มที่ 20 เที่ยว (ข้อ 7) */
const MIN_TRIPS = 20;
const TOP_N = 10;
const ROUTE_COLORS = [D.rose, D.indigo, D.teal, D.amber, D.violet, D.cyan, D.pink, D.emeraldLight, D.orange, D.slateDeep];

const pctOf = (a: number, b: number): number => (b ? a / b * 100 : 0);
const pctTick = (v: number): string => `${Math.round(v)}%`;
const beYear = (y: number | string): number => Number(y) + 543;

interface RouteAgg { route: string; n: number; emptyN: number; emptyCost: number; cost: number; share: number }

function byRoute(rows: Trip[]): RouteAgg[] {
  const m = new Map<string, RouteAgg>();
  for (const t of rows) {
    if (!t.rt) continue;
    const a = m.get(t.rt) ?? { route: t.rt, n: 0, emptyN: 0, emptyCost: 0, cost: 0, share: 0 };
    a.n++; a.cost += t.cost;
    if (t.empty) { a.emptyN++; a.emptyCost += t.cost; }
    m.set(t.rt, a);
  }
  return [...m.values()].map((a) => ({ ...a, share: pctOf(a.emptyCost, a.cost) }));
}

export default function EmptyTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const rows = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);

  const kpi = useMemo(() => {
    const empty = rows.filter((t) => t.empty);
    const years = [...new Set(rows.map((t) => t.y))].sort();
    const last = years[years.length - 1];
    const inLast = rows.filter((t) => t.y === last);
    // "เต็มปีไหม" เป็นเรื่องของข้อมูล ไม่ใช่ตัวกรอง — ดูเดือนสุดท้ายของปีนั้นจากทั้งชุด
    const lastMo = trips.filter((t) => t.y === last).reduce((m, t) => (t.mo > m ? t.mo : m), "");
    return {
      emptyCost: empty.reduce((s, t) => s + t.cost, 0),
      emptyN: empty.length,
      years,
      last,
      lastShare: pctOf(inLast.filter((t) => t.empty).reduce((s, t) => s + t.cost, 0),
                       inLast.reduce((s, t) => s + t.cost, 0)),
      partial: !!lastMo && Number(lastMo.slice(5)) < 12 ? lastMo : null,
    };
  }, [rows, trips]);

  /** [1] รายปี */
  const yearly = useMemo(() => kpi.years.map((y) => {
    const ys = rows.filter((t) => t.y === y);
    const cost = ys.reduce((s, t) => s + t.cost, 0);
    const emptyCost = ys.filter((t) => t.empty).reduce((s, t) => s + t.cost, 0);
    return {
      year: `พ.ศ. ${beYear(y)}`,
      share: Math.round(pctOf(emptyCost, cost) * 10) / 10,
      เที่ยวเปล่า: Math.round(emptyCost),
      เที่ยวมีรายได้: Math.round(cost - emptyCost),
    };
  }), [rows, kpi.years]);

  const routes = useMemo(() => byRoute(rows), [rows]);
  const emptyRoutes = useMemo(() => routes.filter((r) => r.emptyN > 0), [routes]);

  /** [2] [3] */
  const topCount = useMemo(() => [...emptyRoutes].sort((a, b) => b.emptyN - a.emptyN || b.emptyCost - a.emptyCost)
    .slice(0, TOP_N).map((r) => ({ name: r.route, v: r.emptyN })), [emptyRoutes]);
  const topCost = useMemo(() => [...emptyRoutes].sort((a, b) => b.emptyCost - a.emptyCost)
    .slice(0, TOP_N).map((r) => ({ name: r.route, v: Math.round(r.emptyCost) })), [emptyRoutes]);

  /** [4] — กรองเที่ยวรวม ≥ MIN_TRIPS ก่อนเสมอ ไม่งั้นเส้นทางที่วิ่งน้อยขึ้น % สูงผิดปกติ */
  const scatterRows = useMemo(() => emptyRoutes.filter((r) => r.n >= MIN_TRIPS), [emptyRoutes]);
  const cols = useMemo<Col<RouteAgg>[]>(() => [
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "n", label: "เที่ยวรวม", get: (r) => r.n, num: true },
    { key: "emptyCost", label: "ต้นทุนเที่ยวเปล่า", get: (r) => r.emptyCost, num: true },
    { key: "cost", label: "ต้นทุนรวมของเส้นทาง", get: (r) => r.cost, num: true },
    { key: "share", label: "% เที่ยวเปล่า", get: (r) => r.share, num: true,
      render: (r) => <b style={{ color: "var(--d-rose-d)" }}>{pct(r.share)}</b> },
  ], []);
  const { sorted, sort, toggle } = useSort(scatterRows, cols, { key: "share", dir: -1 });

  /** [5] — null = ยังไม่ได้เลือกเอง ใช้เส้นทางที่ต้นทุนเที่ยวเปล่าสูงสุด */
  const [picked, setPicked] = useState<string[] | null>(null);
  const routeOpts = useMemo(() => [...emptyRoutes].sort((a, b) => b.emptyCost - a.emptyCost).map((r) => r.route),
    [emptyRoutes]);
  const chosen = useMemo(() => {
    const avail = new Set(routeOpts);
    const keep = (picked ?? []).filter((r) => avail.has(r));
    return keep.length ? keep : routeOpts.slice(0, 1);
  }, [picked, routeOpts]);
  const monthly = useMemo(() => {
    const months = [...new Set(rows.map((t) => t.mo))].sort();
    const want = new Set(chosen);
    const acc = new Map<string, { cost: number; empty: number }>();
    for (const t of rows) {
      if (!want.has(t.rt)) continue;
      const k = `${t.rt}\u0000${t.mo}`;
      const a = acc.get(k) ?? { cost: 0, empty: 0 };
      a.cost += t.cost;
      if (t.empty) a.empty += t.cost;
      acc.set(k, a);
    }
    return months.map((mo) => {
      const row: Record<string, string | number | null> = { mo: monthLabel(mo) };
      chosen.forEach((r, i) => {
        const a = acc.get(`${r}\u0000${mo}`);
        // เดือนที่เส้นทางนั้นไม่มีเที่ยวเลย = ไม่มีค่า (ไม่ใช่ 0%)
        row[`r${i}`] = a && a.cost ? Math.round(pctOf(a.empty, a.cost) * 10) / 10 : null;
      });
      return row;
    });
  }, [rows, chosen]);

  const scope = f.year ? `ปี พ.ศ. ${beYear(f.year)}` : `รวม ${kpi.years.length} ปี`;

  return (
    <>
      <FilterBar>
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ClearFiltersBtn active={isFiltered(f, BASE_F0)} onClick={() => setF(BASE_F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        {/* [KPI Card] */}
        <div className="dz-heroes">
          <Hero kind="cost" l={`มูลค่าต้นทุนเที่ยวเปล่า · ${scope}`} v={fmt(kpi.emptyCost)} unit="บาท" />
          <Hero kind="fleet" l={`จำนวนเที่ยวเปล่า · ${scope}`} v={fmt(kpi.emptyN)} unit="เที่ยว"
            s={`จาก ${fmt(rows.length)} เที่ยว`} />
          <Hero kind="loss" l={kpi.last ? `% ต้นทุนเที่ยวเปล่า · ปี พ.ศ. ${beYear(kpi.last)}` : "% ต้นทุนเที่ยวเปล่า · ปีล่าสุด"}
            v={pct(kpi.lastShare)}
            s={kpi.partial
              ? `ปีนี้ยังไม่เต็มปี — ข้อมูลถึง ${monthLabel(kpi.partial)}`
              : "ต้นทุนเที่ยวเปล่า ÷ ต้นทุนวิ่งรถทั้งหมด"} />
        </div>

        {/* [1] */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="% ต้นทุนเที่ยวเปล่า ÷ ต้นทุนวิ่งรถทั้งหมด · รายปี">
            <YearLine data={yearly} />
          </CC>
          <CC title="สัดส่วนต้นทุน เที่ยวเปล่า vs เที่ยวมีรายได้ · รายปี (100%)">
            <StackedShare data={yearly} />
          </CC>
        </div>
        {kpi.partial && <Note>ปี พ.ศ. {beYear(kpi.last!)} มีข้อมูลถึง {monthLabel(kpi.partial)} เท่านั้น — เทียบกับปีเต็มด้วยความระวัง</Note>}

        {/* [2] [3] วางคู่กัน */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`Top ${TOP_N} เส้นทางที่วิ่งเที่ยวเปล่าบ่อยสุด · จำนวนเที่ยว`} tall>
            {topCount.length
              ? <DBar data={topCount} xKey="name" horiz suffix=" เที่ยว"
                  series={[{ key: "v", label: "เที่ยวเปล่า", color: D.amber }]} />
              : <NoData />}
          </CC>
          <CC title={`Top ${TOP_N} เส้นทางที่ต้นทุนเที่ยวเปล่าสูงสุด · บาท`} tall>
            {topCost.length
              ? <DBar data={topCost} xKey="name" horiz
                  series={[{ key: "v", label: "ต้นทุนเที่ยวเปล่า", color: D.rose }]} />
              : <NoData />}
          </CC>
        </div>

        {/* [4] */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>% ต้นทุนเที่ยวเปล่าของแต่ละเส้นทาง · เทียบกับมูลค่า</h4>
          <div className="dz-box tall">
            {scatterRows.length ? <RouteScatter data={scatterRows} /> : <NoData />}
          </div>
          <Note>
            แกนนอน = ต้นทุนเที่ยวเปล่าของเส้นทาง · แกนตั้ง = ต้นทุนเที่ยวเปล่า ÷ ต้นทุนรวมของเส้นทางนั้น ·
            ขนาดจุด = จำนวนเที่ยวรวมของเส้นทาง — <b>เส้นทางมุมขวาบนคือเป้าหมายที่ต้องแก้ก่อน</b> ·
            แสดงเฉพาะเส้นทางที่วิ่งรวม (เปล่า + มีรายได้) ตั้งแต่ {MIN_TRIPS} เที่ยวขึ้นไป
            ({fmt(scatterRows.length)} จาก {fmt(emptyRoutes.length)} เส้นทางที่มีเที่ยวเปล่า)
          </Note>
          <div style={{ marginTop: 14 }}>
            <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
              rowKey={(r) => r.route} empty={`ไม่มีเส้นทางที่วิ่งรวมถึง ${MIN_TRIPS} เที่ยวตามตัวกรองที่เลือก`} />
          </div>
        </div>

        {/* [5] */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>% ต้นทุนเที่ยวเปล่า ÷ ต้นทุนวิ่งรถทั้งหมด · รายเดือน ตามเส้นทาง</h4>
            <RoutePicker opts={routeOpts} value={chosen} onChange={setPicked} />
          </div>
          <div className="dz-box tall">
            {chosen.length
              ? <DBar data={monthly} xKey="mo" suffix="%" digits={1} valueTick={pctTick}
                  series={chosen.map((r, i) => ({ key: `r${i}`, label: r, color: ROUTE_COLORS[i % ROUTE_COLORS.length]! }))} />
              : <NoData />}
          </div>
          <Note>
            ค่าเริ่มต้นคือเส้นทางที่ต้นทุนเที่ยวเปล่ารวมสูงสุด · เลือกได้หลายเส้นทางเพื่อเทียบกัน ·
            เดือนที่เส้นทางนั้นไม่มีเที่ยววิ่งจะไม่มีแท่ง
          </Note>
        </div>

        <Note>
          เที่ยววิ่งเปล่า = เที่ยวที่ ราคารวมจากรายได้ และ ค่าบรรทุกทั้งใบรายการ เป็น 0 ทั้งคู่ (ไม่จำกัดประเภทใบรายการ) ·
          ต้นทุนวิ่งรถทั้งหมด = ต้นทุนของทุกเที่ยว รวมเที่ยวเปล่าด้วย · เส้นทาง = จุดขึ้น-จุดลง
        </Note>
      </Pane>
    </>
  );
}

const NoData = () => (
  <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>ไม่มีข้อมูลตามตัวกรองที่เลือก</div>
);

/**
 * เส้น 3 จุดรายปี — เส้นตรงระหว่างจุดพร้อมตัวเลขบนจุด
 * (DLine ใช้เส้นโค้ง monotone ซึ่งกับ 3 จุดจะโค้งต่ำกว่าค่าจริงระหว่างปี ชวนอ่านผิด)
 */
function YearLine({ data }: { data: Record<string, string | number>[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 26, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="year" padding={{ left: 30, right: 30 }} />
        <YAxis {...axisProps(t)} width={52} domain={[0, "auto"]} tickFormatter={pctTick} />
        <Tooltip {...tooltipProps(t, "%", 1)} />
        <Line type="linear" dataKey="share" name="% ต้นทุนเที่ยวเปล่า" stroke={D.rose} strokeWidth={2.5}
          dot={{ r: 5, fill: D.rose, strokeWidth: 0 }} activeDot={{ r: 6 }} {...anim}>
          <LabelList dataKey="share" position="top" offset={10}
            formatter={(v: number) => `${v.toFixed(1)}%`}
            style={{ fill: t.ink2, fontFamily: DFONT, fontSize: 14, fontWeight: 700 }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 100% stacked bar — แกนเป็น % แต่ tooltip เป็นบาทจริง (stackOffset="expand") */
function StackedShare({ data }: { data: Record<string, string | number>[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} stackOffset="expand" margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="year" />
        <YAxis {...axisProps(t)} width={52} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
        <Tooltip {...tooltipProps(t)} />
        <Legend {...legendProps} />
        <Bar dataKey="เที่ยวเปล่า" stackId="s" fill={D.rose} {...anim} />
        <Bar dataKey="เที่ยวมีรายได้" stackId="s" fill={D.teal} {...anim} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function RouteScatter({ data }: { data: RouteAgg[] }) {
  const t = useChartTheme();
  const pts = data.map((r) => ({ route: r.route, x: Math.round(r.emptyCost), y: Math.round(r.share * 10) / 10,
                                 z: r.n, emptyN: r.emptyN }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 6 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} type="number" dataKey="x" name="ต้นทุนเที่ยวเปล่า" tickFormatter={fmtShort} />
        <YAxis {...axisProps(t)} type="number" dataKey="y" name="%" width={52} tickFormatter={(v: number) => `${v}%`} />
        <ZAxis type="number" dataKey="z" range={[40, 700]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTip />} />
        <Scatter data={pts} fill={D.rose} fillOpacity={0.55} stroke={D.rose} {...anim} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: { route: string; x: number; y: number; z: number; emptyN: number } }[] }) {
  const p = active && payload?.[0]?.payload;
  if (!p) return null;
  return (
    <div style={{ background: "#17161A", color: "#fff", borderRadius: 10, padding: 11, fontFamily: DFONT, fontSize: 14,
                  boxShadow: "0 8px 24px -8px rgba(0,0,0,.35)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.route}</div>
      <div>ต้นทุนเที่ยวเปล่า {fmt(p.x)} บาท</div>
      <div>% เที่ยวเปล่า {pct(p.y)}</div>
      <div>เที่ยวรวม {fmt(p.z)} · เที่ยวเปล่า {fmt(p.emptyN)}</div>
    </div>
  );
}

/** dropdown เลือกเส้นทางได้หลายเส้น — เรียงตามต้นทุนเที่ยวเปล่ามาก → น้อย */
function RoutePicker({ opts, value, onChange }: { opts: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const sel = new Set(value);
  const toggle = (r: string) => {
    const next = sel.has(r) ? value.filter((x) => x !== r) : [...value, r];
    onChange(next.length ? next : value);   // ต้องเหลืออย่างน้อย 1 เส้นทาง
  };
  const shown = opts.filter((o) => !q || o.toLowerCase().includes(q.trim().toLowerCase()));
  const label = value.length === 1 ? value[0] : `${value.length} เส้นทาง`;
  return (
    <div className="em-pick" ref={ref}>
      <button type="button" className="em-pick-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>เส้นทาง</span><b>{label}</b>
      </button>
      {open && (
        <div className="em-pick-pop">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเส้นทาง..." />
          <div className="em-pick-list">
            {shown.map((o) => (
              <label key={o}>
                <input type="checkbox" checked={sel.has(o)} onChange={() => toggle(o)} />
                {sel.has(o) && <i style={{ background: ROUTE_COLORS[value.indexOf(o) % ROUTE_COLORS.length] }} />}
                <span>{o}</span>
              </label>
            ))}
            {shown.length === 0 && <div className="em-pick-none">ไม่พบเส้นทาง</div>}
          </div>
          {opts.length > 0 && (
            <button type="button" className="em-pick-reset" onClick={() => { onChange([opts[0]!]); setOpen(false); }}>
              กลับไปค่าเริ่มต้น (ต้นทุนเที่ยวเปล่าสูงสุด)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
