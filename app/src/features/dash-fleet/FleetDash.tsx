/**
 * แดชบอร์ดต้นทุน — 6 แท็บ ตรงตาม โมเดลเดินรถ-gsheet-v5.html:394-673
 *   หลัก / กำไรรายเที่ยว / กำไรลูกค้า / การใช้ประโยชน์กองรถ / Service Performance / ลูกหนี้
 *
 * ตัวกรองด้านบนใช้ร่วมกันทุกแท็บ (v5 แยกชุดตัวกรองต่อแท็บ ที่นี่รวมเป็นชุดเดียว
 * เพราะทุกแท็บอ่านจากรายการใบเดียวกัน การมีหลายชุดทำให้ผู้ใช้สับสนว่ากรองอันไหนอยู่)
 *
 * สูตรทุกตัวยกมาตรงจาก v5 — กำไร = รายได้ − ต้นทุนรวม − ค่าบริหาร(บิลเคลียร์)
 */
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis,
  ResponsiveContainer,
} from "recharts";
import { axisProps, gridProps, tooltipProps } from "../../lib/chart/primitives";
import { fmtBaht, fmtPct, fmtShort, rankedShades, useChartTheme } from "../../lib/chart/theme";
import { recCost, adminWriteOff, recProfit, CLEARED_GOODS } from "../../lib/cost/recCost";
import { billIsPaid, recBills } from "../../lib/record/payment";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import { useRoster } from "../../lib/store/roster";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const TABS = ["หลัก", "กำไรรายเที่ยว", "กำไรลูกค้า", "การใช้ประโยชน์กองรถ",
              "Service Performance", "ลูกหนี้"] as const;
type Tab = (typeof TABS)[number];

const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const routeLabel = (r: TripRecord): string =>
  r.origin && r.dest ? `${r.origin} → ${r.dest}` : (r.origin || r.dest || "(ไม่ระบุ)");
const uniq = (a: (string | undefined)[]): string[] =>
  [...new Set(a.filter((x): x is string => !!x))].sort();
const monthKey = (r: TripRecord) => String(r.date ?? "").slice(0, 7);
const yearOf = (r: TripRecord) => String(r.date ?? "").slice(0, 4);

/** ป้ายเดือน '2025-07' → 'ก.ค. 68' */
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const mLabel = (k: string): string => {
  const [y, m] = k.split("-");
  return y && m ? `${TH_M[+m - 1]} ${String(+y + 543).slice(2)}` : k;
};

/* ---------- ชิ้นส่วนหน้าตาแบบ v5 ---------- */
function KC({ l, v, s }: { l: string; v: string; s?: React.ReactNode }) {
  return (
    <div className="dz-kc">
      <div className="l">{l}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

function CC({ title, tall, children }: { title: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className="dz-cc">
      <h4>{title}</h4>
      <div className={"dz-box" + (tall ? " tall" : "")}>
        <ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer>
      </div>
    </div>
  );
}

const ZT = ({ children }: { children: React.ReactNode }) => <div className="dz-t">{children}</div>;

function Empty({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>{text}</td></tr>;
}

/* ============================ ตัวหลัก ============================ */
export default function FleetDash({ state }: { state: RecordsState }) {
  const [tab, setTab] = useState<Tab>("หลัก");
  const { records, oldRecords, loading } = state;

  const all = useMemo(
    () => [
      ...records.map((r) => ({ ...r, source: "ใหม่" as const })),
      ...(oldRecords as unknown as TripRecord[]),
    ],
    [records, oldRecords],
  );

  const [f, setF] = useState({
    src: "", year: "", branch: "", fleet: "", veh: "", plate: "", rectype: "", origin: "", dest: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const rows = useMemo(() => all.filter((r) =>
    (!f.src || r.source === f.src)
    && (!f.year || yearOf(r) === f.year)
    && (!f.branch || (r.branch ?? "") === f.branch)
    && (!f.fleet || (r.fleetType ?? "") === f.fleet)
    && (!f.veh || (r.vehicle ?? "") === f.veh)
    && (!f.plate || (r.plate ?? "") === f.plate)
    && (!f.rectype || (r.docType ?? "") === f.rectype)
    && (!f.origin || (r.origin ?? "") === f.origin)
    && (!f.dest || (r.dest ?? "") === f.dest)), [all, f]);

  if (loading) return <div className="card"><p className="muted">กำลังโหลด...</p></div>;

  if (all.length === 0) {
    return (
      <div className="card">
        <h2>ยังไม่มีข้อมูล</h2>
        <p className="muted">
          ยังไม่มีใบรายการให้สรุป — กรอกใบแรกที่หน้า “บันทึกข้อมูล”
          หรือเชื่อม Google Sheet เพื่อดึงใบที่มีอยู่แล้วเข้ามา
        </p>
      </div>
    );
  }

  const years = uniq(all.map(yearOf));

  return (
    <>
      <nav className="dash-tabs">
        {TABS.map((t) => (
          <button key={t} type="button"
            className={"dtab" + (tab === t ? " active" : "")}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      <div className="dz-filters">
        <div className="ff"><label>แหล่งข้อมูล</label>
          <select value={f.src} onChange={set("src")}>
            <option value="">ทั้งหมด</option><option value="ใหม่">ข้อมูลใหม่</option><option value="เก่า">ข้อมูลเก่า</option>
          </select></div>
        <div className="ff"><label>ปี</label>
          <select value={f.year} onChange={set("year")}>
            <option value="">ทุกปี</option>
            {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
          </select></div>
        <Sel label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={uniq(all.map((r) => r.branch))} />
        <Sel label="ประเภทรถ" all="ทุกประเภท" value={f.fleet} onChange={set("fleet")} opts={uniq(all.map((r) => r.fleetType))} />
        <Sel label="ชนิดรถ" all="ทุกชนิด" value={f.veh} onChange={set("veh")} opts={uniq(all.map((r) => r.vehicle))} />
        <Sel label="ทะเบียนรถ" all="ทุกคัน" value={f.plate} onChange={set("plate")} opts={uniq(all.map((r) => r.plate))} />
        <Sel label="ประเภทใบรายการ" all="ทุกประเภท" value={f.rectype} onChange={set("rectype")} opts={uniq(all.map((r) => r.docType))} />
        <Sel label="จุดขึ้น (ต้นทาง)" all="ทุกต้นทาง" value={f.origin} onChange={set("origin")} opts={uniq(all.map((r) => r.origin))} />
        <Sel label="จุดลง (ปลายทาง)" all="ทุกปลายทาง" value={f.dest} onChange={set("dest")} opts={uniq(all.map((r) => r.dest))} />
        <button type="button" className="dz-fbtn"
          onClick={() => setF({ src: "", year: "", branch: "", fleet: "", veh: "", plate: "", rectype: "", origin: "", dest: "" })}>
          ↺ ล้างตัวกรอง
        </button>
      </div>

      {rows.length === 0
        ? <div className="card"><p className="muted">ไม่มีใบรายการที่ตรงกับตัวกรอง — กด “ล้างตัวกรอง” เพื่อดูทั้งหมด</p></div>
        : <>
            {tab === "หลัก" && <MainPane rows={rows} />}
            {tab === "กำไรรายเที่ยว" && <TripPane rows={rows} />}
            {tab === "กำไรลูกค้า" && <CustomerPane rows={rows} />}
            {tab === "การใช้ประโยชน์กองรถ" && <FleetPane rows={rows} year={f.year} />}
            {tab === "Service Performance" && <ServicePane rows={rows} />}
            {tab === "ลูกหนี้" && <DebtPane rows={rows} />}
          </>}
    </>
  );
}

function Sel({ label, all, value, onChange, opts }: {
  label: string; all: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; opts: string[];
}) {
  return (
    <div className="ff">
      <label>{label}</label>
      <select value={value} onChange={onChange}>
        <option value="">{all}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ============================ แท็บ: หลัก ============================ */
function MainPane({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  const k = useMemo(() => {
    let cost = 0, fuel = 0, driver = 0, other = 0, repair = 0, waste = 0, rev = 0, admin = 0, ar = 0;
    for (const r of rows) {
      const c = recCost(r);
      cost += c.total; fuel += c.fuel; driver += c.driver; other += c.other;
      repair += c.repair; waste += c.waste;
      rev += num(r.revenue);
      admin += adminWriteOff(r);
      for (const b of recBills(r)) {
        if (b.goodsType !== CLEARED_GOODS && !billIsPaid(b)) ar += num(b.total);
      }
    }
    const profit = rev - cost - admin;
    return { cost, fuel, driver, other, repair, waste, rev, admin, ar, profit,
             trips: rows.length, avg: rows.length ? profit / rows.length : 0,
             margin: rev ? profit / rev * 100 : 0 };
  }, [rows]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { cost: number; rev: number; profit: number }>();
    for (const r of rows) {
      const key = monthKey(r); if (!key) continue;
      const cur = m.get(key) ?? { cost: 0, rev: 0, profit: 0 };
      cur.cost += recCost(r).total;
      cur.rev += num(r.revenue);
      cur.profit += recProfit(r);
      m.set(key, cur);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month: mLabel(month), ...v }));
  }, [rows]);

  const byYear = useMemo(() => {
    const m = new Map<string, { cost: number; rev: number; profit: number }>();
    for (const r of rows) {
      const y = yearOf(r); if (!y) continue;
      const cur = m.get(y) ?? { cost: 0, rev: 0, profit: 0 };
      cur.cost += recCost(r).total; cur.rev += num(r.revenue); cur.profit += recProfit(r);
      m.set(y, cur);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([y, v]) => ({ year: `พ.ศ. ${+y + 543}`, ...v }));
  }, [rows]);

  const byVeh = useMemo(() => {
    const m = new Map<string, { cost: number; rev: number; profit: number }>();
    for (const r of rows) {
      const key = r.vehicle || "(ไม่ระบุ)";
      const cur = m.get(key) ?? { cost: 0, rev: 0, profit: 0 };
      cur.cost += recCost(r).total; cur.rev += num(r.revenue); cur.profit += recProfit(r);
      m.set(key, cur);
    }
    return [...m.entries()].map(([veh, v]) => ({ veh, ...v }));
  }, [rows]);

  const byBranch = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.branch || "(ไม่ระบุ)", (m.get(r.branch || "(ไม่ระบุ)") ?? 0) + recCost(r).total);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, cost]) => ({ name, cost }));
  }, [rows]);

  const breakdown = [
    { name: "ค่าน้ำมัน", v: k.fuel }, { name: "เบี้ยเลี้ยงคนขับ", v: k.driver },
    { name: "ค่าซ่อมแซม", v: k.repair }, { name: "ค่าธรรมเนียมอื่นๆ", v: k.other },
    { name: "สูญเปล่า", v: k.waste },
  ].filter((x) => x.v > 0);
  const pieShades = rankedShades(t, breakdown.length);

  const allCost = [...breakdown].sort((a, b) => b.v - a.v);

  return (
    <>
      <div className="dz-cards">
        <KC l="🧾 ค่าใช้จ่ายรวม" v={fmtBaht(k.cost)} s="บาท · ปกติ + สูญเปล่า" />
        <KC l="🚚 จำนวนเที่ยววิ่ง" v={fmtBaht(k.trips)} s="เที่ยว" />
        <KC l="⛽ ค่าน้ำมันรวม" v={fmtBaht(k.fuel)} s="บาท · ค่าน้ำมันเหมา + แก๊ส" />
        <KC l="🧍 ค่าเบี้ยเลี้ยงคนขับรวม" v={fmtBaht(k.driver)} s="บาท" />
        <KC l="📦 ค่าธรรมเนียมอื่นๆ" v={fmtBaht(k.other)} s="บาท" />
        <KC l="🔧 ค่าซ่อมแซม" v={fmtBaht(k.repair)} s="บาท" />
        <KC l="💨 ต้นทุนสูญเปล่า" v={fmtBaht(k.waste)} s="บาท · นอกเส้นทาง + วิ่งอ้อม" />
        <KC l="🗂️ ค่าบริหาร (บิลเคลียร์)" v={fmtBaht(k.admin)} s="บาท" />
        <KC l="💳 ลูกหนี้ค้างชำระ" v={fmtBaht(k.ar)} s="บาท" />
        <KC l="💰 รายได้รวม" v={fmtBaht(k.rev)} s="บาท" />
        <KC l="📈 กำไรสุทธิ" v={fmtBaht(k.profit)} s="บาท · รายได้ − ค่าใช้จ่ายรวม − ค่าบริหาร" />
        <KC l="📊 กำไรเฉลี่ย/เที่ยว" v={fmtBaht(k.avg)} s={<>บาท · อัตรากำไร {fmtPct(k.margin)}</>} />
      </div>

      <ZT>แนวโน้ม &amp; โครงสร้างต้นทุน</ZT>
      <div className="dz-row dz-2">
        <CC title="แนวโน้มต้นทุนรายเดือน">
          <LineChart data={byMonth}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="month" /><YAxis {...axisProps(t)} tickFormatter={fmtShort} />
            <Tooltip {...tooltipProps(t)} />
            <Line type="monotone" dataKey="cost" name="ต้นทุนรวม" stroke={t.orange} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </CC>
        <CC title="สัดส่วนค่าใช้จ่าย">
          <PieChart>
            <Tooltip {...tooltipProps(t)} />
            <Pie data={breakdown} dataKey="v" nameKey="name" innerRadius="45%" outerRadius="78%" isAnimationActive={false}>
              {breakdown.map((_, i) => <Cell key={i} fill={pieShades[i]} />)}
            </Pie>
          </PieChart>
        </CC>
      </div>

      <div className="dz-row dz-11">
        <CC title="ต้นทุน vs รายได้ รายปี (เส้น = กำไร)">
          <ComposedChart data={byYear}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="year" /><YAxis {...axisProps(t)} tickFormatter={fmtShort} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="cost" name="ต้นทุน" fill={t.categorical[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="rev" name="รายได้" fill={t.categorical[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line type="monotone" dataKey="profit" name="กำไร" stroke={t.categorical[2]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </CC>
        <CC title="แนวโน้มรายได้ · ต้นทุน · กำไร รายเดือน">
          <LineChart data={byMonth}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="month" /><YAxis {...axisProps(t)} tickFormatter={fmtShort} />
            <Tooltip {...tooltipProps(t)} />
            <Line type="monotone" dataKey="rev" name="รายได้" stroke={t.categorical[1]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="cost" name="ต้นทุน" stroke={t.categorical[0]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="profit" name="กำไร" stroke={t.categorical[2]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          </LineChart>
        </CC>
      </div>

      <CC title="ต้นทุน vs รายได้ และกำไร ตามชนิดรถ">
        <ComposedChart data={byVeh}>
          <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="veh" /><YAxis {...axisProps(t)} tickFormatter={fmtShort} />
          <Tooltip {...tooltipProps(t)} />
          <Bar dataKey="cost" name="ต้นทุน" fill={t.categorical[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="rev" name="รายได้" fill={t.categorical[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="profit" name="กำไร" stroke={t.categorical[2]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </CC>

      <div className="dz-row dz-11">
        <CC title="ต้นทุนแยกตามสาขา (Top 10)" tall>
          <BarChart data={byBranch} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={110} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="cost" name="ต้นทุน" fill={t.categorical[1]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
        <CC title="ต้นทุนทุกประเภท (มาก → น้อย)" tall>
          <BarChart data={allCost} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={110} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="v" name="ต้นทุน" fill={t.navy} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
      </div>
    </>
  );
}

/* ====================== แท็บ: กำไรรายเที่ยว ====================== */
function TripPane({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  const trips = useMemo(() => rows.map((r) => {
    const cost = recCost(r).total;
    const rev = num(r.revenue);
    const profit = recProfit(r);
    return { r, cost, rev, profit, margin: rev ? profit / rev * 100 : 0 };
  }).sort((a, b) => a.profit - b.profit), [rows]);

  const loss = trips.filter((x) => x.profit < 0);
  const lossSum = loss.reduce((s, x) => s + x.profit, 0);
  const withRev = trips.filter((x) => x.rev > 0);
  const avgMargin = withRev.length ? withRev.reduce((s, x) => s + x.margin, 0) / withRev.length : 0;
  const best = trips.length ? Math.max(...trips.map((x) => x.profit)) : 0;

  const buckets: [number, number, string][] = [
    [-Infinity, 0, "ขาดทุน"], [0, 10, "0–10%"], [10, 20, "10–20%"],
    [20, 30, "20–30%"], [30, 40, "30–40%"], [40, Infinity, "40%+"],
  ];
  const hist = buckets.map(([lo, hi, label]) => ({
    label, n: withRev.filter((x) => x.margin >= lo && x.margin < hi).length,
  }));
  const histColors = ["#E24B4B", "#F6C042", "#BEE7D2", "#8FDCB2", "#4FCB8E", "#1FA971"];

  const byRoute = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const x of trips) {
      const key = routeLabel(x.r);
      const cur = m.get(key) ?? { sum: 0, n: 0 };
      cur.sum += x.profit; cur.n += 1; m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg).slice(0, 10);
  }, [trips]);

  return (
    <>
      <div className="dz-cards four">
        <KC l="🚨 เที่ยวขาดทุน" v={fmtBaht(loss.length)} s={`เที่ยว จากทั้งหมด ${fmtBaht(trips.length)}`} />
        <KC l="📉 ขาดทุนรวม (เที่ยวที่ขาดทุน)" v={fmtBaht(lossSum)} s="บาท" />
        <KC l="📈 อัตรากำไรเฉลี่ย/เที่ยว" v={fmtPct(avgMargin)} s="ของรายได้ต่อเที่ยว" />
        <KC l="🏆 กำไรสูงสุดต่อเที่ยว" v={fmtBaht(best)} s="บาท" />
      </div>

      <div className="dz-row dz-11">
        <CC title="กระจายตัวอัตรากำไรต่อเที่ยว">
          <BarChart data={hist}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="label" /><YAxis {...axisProps(t)} width={64} />
            <Tooltip {...tooltipProps(t, " เที่ยว")} />
            <Bar dataKey="n" name="จำนวนเที่ยว" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {hist.map((_, i) => <Cell key={i} fill={histColors[i]} />)}
            </Bar>
          </BarChart>
        </CC>
        <CC title="กำไรเฉลี่ย/เที่ยว ตามเส้นทาง (Top 10)" tall>
          <BarChart data={byRoute} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={140} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="avg" name="กำไรเฉลี่ย/เที่ยว" fill={t.navy} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
      </div>

      <div className="dz-cc">
        <h4>เที่ยวที่ขาดทุนมากที่สุด (50 อันดับแรก)</h4>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>วันที่</th><th>เลขที่ใบ</th><th>เส้นทาง</th><th>ชนิดรถ</th>
              <th className="n">รายได้</th><th className="n">ต้นทุน</th><th className="n">กำไร</th><th className="n">อัตรากำไร</th>
            </tr></thead>
            <tbody>
              {trips.length === 0 ? <Empty cols={8} text="ไม่มีข้อมูล" /> : trips.slice(0, 50).map((x, i) => (
                <tr key={i}>
                  <td>{thDateSafe(x.r.date)}</td>
                  <td>{x.r.docNo || "–"}</td>
                  <td>{routeLabel(x.r)}</td>
                  <td>{x.r.vehicle || "–"}</td>
                  <td className="n">{fmtBaht(x.rev)}</td>
                  <td className="n">{fmtBaht(x.cost)}</td>
                  <td className={"n " + (x.profit < 0 ? "profit-neg" : "profit-pos")}>{fmtBaht(x.profit)}</td>
                  <td className="n">{x.rev ? fmtPct(x.margin) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ====================== แท็บ: กำไรลูกค้า ====================== */
function CustomerPane({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  /* v5 ปันส่วนต้นทุนของใบให้แต่ละบิลตามสัดส่วนยอดบิล — ใบหนึ่งมีได้หลายลูกค้า */
  const cust = useMemo(() => {
    const m = new Map<string, { rev: number; cost: number; bills: number }>();
    for (const r of rows) {
      const bills = recBills(r);
      const cost = recCost(r).total;
      const sum = bills.reduce((s, b) => s + num(b.total), 0);
      for (const b of bills) {
        const name = b.sender || b.receiver || "(ไม่ระบุ)";
        const share = sum > 0 ? num(b.total) / sum : (bills.length ? 1 / bills.length : 0);
        const cur = m.get(name) ?? { rev: 0, cost: 0, bills: 0 };
        cur.rev += num(b.total);
        cur.cost += cost * share;
        cur.bills += 1;
        m.set(name, cur);
      }
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v, profit: v.rev - v.cost }))
      .sort((a, b) => b.profit - a.profit);
  }, [rows]);

  const lossN = cust.filter((c) => c.profit < 0).length;
  const top = cust[0];
  const bot = cust[cust.length - 1];
  const top15 = [...cust].sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit)).slice(0, 15);

  return (
    <>
      <div className="dz-cards four">
        <KC l="👥 จำนวนลูกค้า" v={fmtBaht(cust.length)} s="ราย (มีบิลอย่างน้อย 1 รายการ)" />
        <KC l="💚 ลูกค้าที่สร้างกำไรสูงสุด" v={top?.name ?? "–"} s={top ? `${fmtBaht(top.profit)} บาท` : "–"} />
        <KC l="🔻 ลูกค้าที่กัดกำไรมากสุด" v={bot?.name ?? "–"} s={bot ? `${fmtBaht(bot.profit)} บาท` : "–"} />
        <KC l="⚠️ ลูกค้าที่ขาดทุน" v={fmtBaht(lossN)} s={`ราย จากทั้งหมด ${fmtBaht(cust.length)}`} />
      </div>

      <CC title="กำไร/ขาดทุนต่อลูกค้า (Top 15)" tall>
        <BarChart data={top15} layout="vertical">
          <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
          <YAxis {...axisProps(t)} type="category" dataKey="name" width={150} />
          <Tooltip {...tooltipProps(t)} />
          <Bar dataKey="profit" name="กำไร" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {top15.map((c, i) => <Cell key={i} fill={c.profit < 0 ? "#E24B4B" : "#1FA971"} />)}
          </Bar>
        </BarChart>
      </CC>

      <div className="dz-cc">
        <h4>กำไรรายลูกค้า</h4>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>ลูกค้า</th><th className="n">จำนวนบิล</th><th className="n">รายได้</th>
              <th className="n">ต้นทุนที่ปันส่วน</th><th className="n">กำไร</th><th className="n">อัตรากำไร</th>
            </tr></thead>
            <tbody>
              {cust.length === 0 ? <Empty cols={6} text="ยังไม่มีบิลลูกค้า" /> : cust.slice(0, 60).map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="n">{fmtBaht(c.bills)}</td>
                  <td className="n">{fmtBaht(c.rev)}</td>
                  <td className="n">{fmtBaht(c.cost)}</td>
                  <td className={"n " + (c.profit < 0 ? "profit-neg" : "profit-pos")}>{fmtBaht(c.profit)}</td>
                  <td className="n">{c.rev ? fmtPct(c.profit / c.rev * 100) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dz-note">
          ต้นทุนของใบรายการหนึ่งถูกปันส่วนให้แต่ละบิลตามสัดส่วนยอดบิล
          เพราะใบหนึ่งวิ่งให้ลูกค้าหลายรายพร้อมกันได้ — ตัวเลขจึงเป็นการประมาณ ไม่ใช่ต้นทุนที่แยกจ่ายจริง
        </div>
      </div>
    </>
  );
}

/* ================= แท็บ: การใช้ประโยชน์กองรถ ================= */
function FleetPane({ rows, year }: { rows: TripRecord[]; year: string }) {
  const t = useChartTheme();
  const [roster] = useRoster();

  const km = rows.reduce((s, r) => s + num(r.dist), 0);
  const platesUsed = uniq(rows.map((r) => r.plate));
  const inRoster = platesUsed.filter((p) => roster.some((f) => f.plate === p)).length;

  const today = todayISO();
  const endDate = year ? `${year}-12-31` : today;
  const endUse = endDate > today ? today : endDate;

  const util = useMemo(() => roster.map((f) => {
    const own = rows.filter((r) => r.plate === f.plate);
    const kmOwn = own.reduce((s, r) => s + num(r.dist), 0);
    const activeDays = uniq(own.map((r) => r.date)).length;
    const avail = f.start ? Math.max(1, (daysBetween(f.start, endUse) ?? 0) + 1) : null;
    const pct = avail && avail > 0 ? Math.min(100, Math.round(activeDays / avail * 100)) : null;
    return { f, n: own.length, km: kmOwn, activeDays, avail, pct };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)), [roster, rows, endUse]);

  const withPct = util.filter((x) => x.pct != null);
  const avgUtil = withPct.length
    ? Math.round(withPct.reduce((s, x) => s + (x.pct ?? 0), 0) / withPct.length) : 0;

  const topN = (key: (r: TripRecord) => string, n: number) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = key(r) || "(ไม่ระบุ)"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, v]) => ({ name, v }));
  };

  /* ---- Load Factor / มูลค่าที่สูญเสีย ---- */
  const loadRecs = rows.filter((r) => num(r.capacity) > 0 || r.emptyLeg);
  const emptyRecs = loadRecs.filter((r) => r.emptyLeg);
  const loadedRecs = loadRecs.filter((r) => !r.emptyLeg && num(r.capacity) > 0);
  const factors = loadedRecs.map((r) => Math.min(100, num(r.loadActual) / num(r.capacity) * 100));
  const avgLoad = factors.length ? Math.round(factors.reduce((s, x) => s + x, 0) / factors.length) : 0;
  const emptyCost = emptyRecs.reduce((s, r) => s + recCost(r).total, 0);

  const lostRows = useMemo(() => {
    const out: { r: TripRecord; load: number; cap: number; factor: number; lost: number; status: string }[] = [];
    for (const r of emptyRecs) {
      out.push({ r, load: 0, cap: num(r.capacity), factor: 0, lost: recCost(r).total, status: "เที่ยวเปล่า" });
    }
    for (const r of loadedRecs) {
      const cost = recCost(r).total;
      const factor = Math.min(1, num(r.loadActual) / num(r.capacity));
      out.push({ r, load: num(r.loadActual), cap: num(r.capacity), factor: factor * 100, lost: cost * (1 - factor), status: "บรรทุกไม่เต็ม" });
    }
    return out.sort((a, b) => b.lost - a.lost);
  }, [emptyRecs, loadedRecs]);

  const lostVal = lostRows.filter((x) => x.status === "บรรทุกไม่เต็ม").reduce((s, x) => s + x.lost, 0);

  const loadBuckets: [number, number, string][] = [
    [0, 20, "0–20%"], [20, 40, "20–40%"], [40, 60, "40–60%"], [60, 80, "60–80%"], [80, 100.01, "80–100%"],
  ];
  const loadHist = loadBuckets.map(([lo, hi, label]) => ({
    label, n: factors.filter((f) => f >= lo && f < hi).length,
  }));
  const loadColors = ["#E24B4B", "#F6C042", "#BEE7D2", "#4FCB8E", "#1FA971"];

  const lostByVeh = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of lostRows) {
      const k = x.r.vehicle || "(ไม่ระบุ)";
      m.set(k, (m.get(k) ?? 0) + x.lost);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, v }));
  }, [lostRows]);

  return (
    <>
      <ZT>การใช้ประโยชน์กองรถ (Fleet Utilization)</ZT>
      <div className="dz-cards four">
        <KC l="🚚 รถในกองรถทั้งหมด" v={fmtBaht(roster.length)}
          s={`${fmtBaht(roster.filter((f) => f.status === "ใช้งาน").length)} คัน สถานะ “ใช้งาน”`} />
        <KC l="✅ รถที่มีเที่ยววิ่งในช่วงนี้" v={fmtBaht(inRoster)} s={`จาก ${fmtBaht(roster.length)} คันในกองรถ`} />
        <KC l="📊 %การใช้งานเฉลี่ยต่อคัน" v={`${avgUtil}%`} s="วันที่มีเที่ยว ÷ วันที่พร้อมใช้งาน" />
        <KC l="🛣️ ระยะทางรวมทุกเที่ยว" v={fmtBaht(km)} s="กม." />
      </div>

      <div className="dz-row dz-11">
        <CC title="จำนวนเที่ยว ตามเส้นทาง (Top 10)" tall>
          <BarChart data={topN(routeLabel, 10)} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" /><YAxis {...axisProps(t)} type="category" dataKey="name" width={140} />
            <Tooltip {...tooltipProps(t, " เที่ยว")} />
            <Bar dataKey="v" name="จำนวนเที่ยว" fill={t.navy} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
        <CC title="จำนวนเที่ยว ตามกลุ่มบริการ">
          <BarChart data={topN((r) => r.serviceGroup, 12)}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="name" /><YAxis {...axisProps(t)} width={64} />
            <Tooltip {...tooltipProps(t, " เที่ยว")} />
            <Bar dataKey="v" name="จำนวนเที่ยว" fill={t.categorical[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
      </div>

      <CC title="จำนวนเที่ยว ตามชนิดรถ">
        <BarChart data={topN((r) => r.vehicle, 12)}>
          <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="name" /><YAxis {...axisProps(t)} width={64} />
          <Tooltip {...tooltipProps(t, " เที่ยว")} />
          <Bar dataKey="v" name="จำนวนเที่ยว" fill={t.orange} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </CC>

      <div className="dz-cc">
        <h4>%การใช้งานรายคัน (เทียบกับทะเบียนรถในกองรถ)</h4>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>ทะเบียนรถ</th><th>ประเภทรถ</th><th>ชนิดรถ</th><th>เริ่มใช้งาน</th><th>สถานะ</th>
              <th className="n">เที่ยว</th><th className="n">ระยะทาง</th>
              <th className="n">วันที่มีเที่ยว</th><th className="n">วันที่พร้อมใช้</th><th className="n">%ใช้งาน</th>
            </tr></thead>
            <tbody>
              {util.length === 0
                ? <Empty cols={10} text="ยังไม่มีรถในกองรถ — เพิ่มได้ที่หน้า “บันทึกข้อมูล”" />
                : util.map((x) => (
                  <tr key={x.f.plate}>
                    <td style={{ fontWeight: 700 }}>{x.f.plate}</td>
                    <td>{x.f.fleetType || "–"}</td>
                    <td>{x.f.vehicle || "–"}</td>
                    <td>{thDateSafe(x.f.start)}</td>
                    <td>{x.f.status || "–"}</td>
                    <td className="n">{fmtBaht(x.n)}</td>
                    <td className="n">{fmtBaht(x.km)}</td>
                    <td className="n">{fmtBaht(x.activeDays)}</td>
                    <td className="n">{x.avail == null ? "–" : fmtBaht(x.avail)}</td>
                    <td className="n" style={{ fontWeight: 700 }}>{x.pct == null ? "–" : `${x.pct}%`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <ZT>มูลค่าที่สูญเสียจากอัตราบรรทุกต่ำ / เที่ยวเปล่า / รถใช้ไม่คุ้มค่า</ZT>
      <div className="dz-cards four">
        <KC l="📦 Load Factor เฉลี่ย" v={`${avgLoad}%`} s="เฉพาะเที่ยวที่มีสินค้า + มีข้อมูลความจุ" />
        <KC l="🚛 เที่ยวเปล่า (Empty Leg)" v={fmtBaht(emptyRecs.length)}
          s={`${loadRecs.length ? Math.round(emptyRecs.length / loadRecs.length * 100) : 0}% ของเที่ยวที่มีข้อมูล`} />
        <KC l="💸 ต้นทุนที่เสียไปจากเที่ยวเปล่า" v={fmtBaht(emptyCost)} s="บาท" />
        <KC l="📉 มูลค่าเสียโอกาสจากบรรทุกไม่เต็ม" v={fmtBaht(lostVal)} s="บาท · โดยประมาณ" />
      </div>

      <div className="dz-row dz-11">
        <CC title="กระจายตัว Load Factor">
          <BarChart data={loadHist}>
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="label" /><YAxis {...axisProps(t)} width={64} />
            <Tooltip {...tooltipProps(t, " เที่ยว")} />
            <Bar dataKey="n" name="จำนวนเที่ยว" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {loadHist.map((_, i) => <Cell key={i} fill={loadColors[i]} />)}
            </Bar>
          </BarChart>
        </CC>
        <CC title="มูลค่าเสียโอกาส ตามชนิดรถ (Top 10)" tall>
          <BarChart data={lostByVeh} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={130} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="v" name="มูลค่าเสียโอกาส" fill="#DC6E11" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
      </div>

      <div className="dz-cc">
        <h4>เที่ยวที่เสียมูลค่ามากที่สุด (50 อันดับแรก)</h4>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>วันที่</th><th>เลขที่ใบ</th><th>เส้นทาง</th><th>ชนิดรถ</th><th>สถานะ</th>
              <th className="n">บรรทุกจริง</th><th className="n">ความจุ</th><th className="n">Load Factor</th><th className="n">มูลค่าเสียโอกาส</th>
            </tr></thead>
            <tbody>
              {lostRows.length === 0
                ? <Empty cols={9} text="ยังไม่มีเที่ยวที่กรอกข้อมูลความจุ/น้ำหนักบรรทุก" />
                : lostRows.slice(0, 50).map((x, i) => (
                  <tr key={i}>
                    <td>{thDateSafe(x.r.date)}</td>
                    <td>{x.r.docNo || "–"}</td>
                    <td>{routeLabel(x.r)}</td>
                    <td>{x.r.vehicle || "–"}</td>
                    <td><span className={"badge " + (x.status === "เที่ยวเปล่า" ? "unpaid" : "partial")}>{x.status}</span></td>
                    <td className="n">{fmtBaht(x.load)}</td>
                    <td className="n">{fmtBaht(x.cap)}</td>
                    <td className="n">{Math.round(x.factor)}%</td>
                    <td className="n profit-neg">{fmtBaht(x.lost)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ================= แท็บ: Service Performance ================= */
function ServicePane({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();

  const bills = useMemo(
    () => rows.flatMap((r) => recBills(r).map((b) => ({ b, r }))),
    [rows],
  );

  const qty = bills.reduce((s, x) => s + num(x.b.qty), 0);
  const timed = bills.filter((x) => x.b.plannedDate && x.b.actualDate);
  const onTimeN = timed.filter((x) => (x.b.actualDate ?? "") <= (x.b.plannedDate ?? "")).length;
  const onTime = timed.length ? onTimeN / timed.length * 100 : 0;
  const withDmg = bills.filter((x) => x.b.damageStatus);
  const dmgN = withDmg.filter((x) => x.b.damageStatus !== "ปกติ" && x.b.damageStatus !== "").length;
  const dmgRate = withDmg.length ? dmgN / withDmg.length * 100 : 0;
  const dmgQty = bills.reduce((s, x) => s + num(x.b.damageQty), 0);

  const byCust = useMemo(() => {
    const m = new Map<string, { timed: number; onTime: number; dmg: number; dmgTot: number; qty: number }>();
    for (const { b } of bills) {
      const name = b.sender || b.receiver || "(ไม่ระบุ)";
      const cur = m.get(name) ?? { timed: 0, onTime: 0, dmg: 0, dmgTot: 0, qty: 0 };
      if (b.plannedDate && b.actualDate) {
        cur.timed += 1;
        if ((b.actualDate ?? "") <= (b.plannedDate ?? "")) cur.onTime += 1;
      }
      if (b.damageStatus) {
        cur.dmgTot += 1;
        if (b.damageStatus !== "ปกติ") cur.dmg += 1;
      }
      cur.qty += num(b.qty);
      m.set(name, cur);
    }
    return [...m.entries()].map(([name, v]) => ({
      name, ...v,
      onTimePct: v.timed ? v.onTime / v.timed * 100 : null,
      dmgPct: v.dmgTot ? v.dmg / v.dmgTot * 100 : null,
    }));
  }, [bills]);

  const otWorst = byCust.filter((c) => c.onTimePct != null)
    .sort((a, b) => (a.onTimePct ?? 0) - (b.onTimePct ?? 0)).slice(0, 10);
  const dmWorst = byCust.filter((c) => c.dmgPct != null)
    .sort((a, b) => (b.dmgPct ?? 0) - (a.dmgPct ?? 0)).slice(0, 10);

  const trend = useMemo(() => {
    const m = new Map<string, { timed: number; onTime: number; dmg: number; dmgTot: number }>();
    for (const { b, r } of bills) {
      const key = monthKey(r); if (!key) continue;
      const cur = m.get(key) ?? { timed: 0, onTime: 0, dmg: 0, dmgTot: 0 };
      if (b.plannedDate && b.actualDate) {
        cur.timed += 1;
        if ((b.actualDate ?? "") <= (b.plannedDate ?? "")) cur.onTime += 1;
      }
      if (b.damageStatus) { cur.dmgTot += 1; if (b.damageStatus !== "ปกติ") cur.dmg += 1; }
      m.set(key, cur);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      month: mLabel(k),
      onTime: v.timed ? v.onTime / v.timed * 100 : 0,
      damage: v.dmgTot ? v.dmg / v.dmgTot * 100 : 0,
    }));
  }, [bills]);

  return (
    <>
      <div className="dz-cards four">
        <KC l="📦 จำนวนชิ้นสินค้ารวม" v={fmtBaht(qty)} s={`ชิ้น จาก ${fmtBaht(bills.length)} บิลที่มีข้อมูล`} />
        <KC l="⏱️ On-time Delivery" v={fmtPct(onTime, 0)} s="ของบิลที่มีทั้งกำหนดส่งและเวลาส่งจริง" />
        <KC l="💥 Damage Rate" v={fmtPct(dmgRate, 0)} s="ของบิลที่มีข้อมูลสถานะสินค้า" />
        <KC l="🧯 จำนวนชิ้นเสียหายรวม" v={fmtBaht(dmgQty)} s="ชิ้น" />
      </div>

      {timed.length === 0 && withDmg.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            ยังไม่มีบิลที่กรอก <b>วันที่นัดส่ง / วันที่ส่งจริง / สถานะสินค้า</b> —
            กราฟด้านล่างจึงยังว่าง กรอกช่องเหล่านี้ในฟอร์มบิลเพื่อให้หน้านี้ทำงาน
          </p>
        </div>
      )}

      <div className="dz-row dz-11">
        <CC title="On-time Delivery % ตามลูกค้า (Top 10 ที่แย่ที่สุด)" tall>
          <BarChart data={otWorst} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" domain={[0, 100]} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={140} />
            <Tooltip {...tooltipProps(t, "%")} />
            <Bar dataKey="onTimePct" name="On-time %" fill={t.categorical[1]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
        <CC title="Damage Rate % ตามลูกค้า (Top 10 ที่แย่ที่สุด)" tall>
          <BarChart data={dmWorst} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={140} />
            <Tooltip {...tooltipProps(t, "%")} />
            <Bar dataKey="dmgPct" name="Damage Rate %" fill="#E24B4B" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
      </div>

      <CC title="แนวโน้ม On-time / Damage Rate รายเดือน">
        <LineChart data={trend}>
          <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="month" /><YAxis {...axisProps(t)} width={64} />
          <Tooltip {...tooltipProps(t, "%")} />
          <Line type="monotone" dataKey="onTime" name="On-time %" stroke={t.categorical[2]} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="damage" name="Damage Rate %" stroke="#E24B4B" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        </LineChart>
      </CC>

      <div className="dz-cc">
        <h4>คุณภาพบริการรายลูกค้า</h4>
        <div className="scroll">
          <table className="dz-tbl">
            <thead><tr>
              <th>ลูกค้า</th><th className="n">ชิ้นสินค้า</th>
              <th className="n">บิลที่วัดเวลาได้</th><th className="n">On-time %</th>
              <th className="n">บิลที่มีสถานะ</th><th className="n">Damage Rate %</th>
            </tr></thead>
            <tbody>
              {byCust.length === 0 ? <Empty cols={6} text="ยังไม่มีบิลลูกค้า" /> : byCust.slice(0, 60).map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="n">{fmtBaht(c.qty)}</td>
                  <td className="n">{fmtBaht(c.timed)}</td>
                  <td className="n">{c.onTimePct == null ? "–" : fmtPct(c.onTimePct, 0)}</td>
                  <td className="n">{fmtBaht(c.dmgTot)}</td>
                  <td className="n">{c.dmgPct == null ? "–" : fmtPct(c.dmgPct, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ====================== แท็บ: ลูกหนี้ ====================== */
function DebtPane({ rows }: { rows: TripRecord[] }) {
  const t = useChartTheme();
  const today = todayISO();

  const bills = useMemo(
    () => rows.flatMap((r) => recBills(r).map((b) => ({ b, r }))),
    [rows],
  );

  let out = 0, paid = 0, cleared = 0, cnt = 0;
  for (const { b } of bills) {
    const v = num(b.total);
    if (b.goodsType === CLEARED_GOODS) { cleared += v; continue; }
    if (billIsPaid(b)) paid += v; else { out += v; cnt += 1; }
  }
  const gross = out + paid;

  const topDebt = useMemo(() => {
    const m = new Map<string, number>();
    for (const { b } of bills) {
      if (b.goodsType === CLEARED_GOODS || billIsPaid(b)) continue;
      const name = b.sender || b.receiver || "(ไม่ระบุ)";
      m.set(name, (m.get(name) ?? 0) + num(b.total));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, v }));
  }, [bills]);

  const pie = [
    { name: "ชำระแล้ว", v: paid }, { name: "ค้างชำระ", v: out }, { name: "บิลเคลียร์", v: cleared },
  ].filter((x) => x.v > 0);
  const pieColors = ["#1FA971", "#E24B4B", "#3672C4"];

  const agingBuckets: [number, number, string][] = [
    [0, 31, "0–30 วัน"], [31, 61, "31–60 วัน"], [61, 91, "61–90 วัน"], [91, Infinity, "90+ วัน"],
  ];
  const unpaid = bills.filter((x) => x.b.goodsType !== CLEARED_GOODS && !billIsPaid(x.b));
  const aging = agingBuckets.map(([lo, hi, label]) => ({
    label,
    v: unpaid.filter((x) => {
      const d = daysBetween(x.r.date, today);
      return d != null && d >= lo && d < hi;
    }).reduce((s, x) => s + num(x.b.total), 0),
  }));
  const agingColors = ["#F6C042", "#F5821F", "#DC6E11", "#E24B4B"];

  return (
    <>
      <div className="dz-cards four">
        <KC l="💳 ยอดค้างชำระรวม" v={fmtBaht(out)} s="บาท" />
        <KC l="✅ ยอดรับชำระแล้ว" v={fmtBaht(paid)} s="บาท" />
        <KC l="📋 จำนวนรายการค้างชำระ" v={fmtBaht(cnt)} s="ราย" />
        <KC l="% สัดส่วนค้างชำระ" v={fmtPct(gross ? out / gross * 100 : 0, 0)} s="ของยอดออกบิลทั้งหมด" />
      </div>

      <div className="dz-row dz-2">
        <CC title="ลูกหนี้ค้างชำระ (Top 10)" tall>
          <BarChart data={topDebt} layout="vertical">
            <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} type="number" tickFormatter={fmtShort} />
            <YAxis {...axisProps(t)} type="category" dataKey="name" width={140} />
            <Tooltip {...tooltipProps(t)} />
            <Bar dataKey="v" name="ค้างชำระ" fill="#E24B4B" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </CC>
        <CC title="สัดส่วนชำระแล้ว vs ค้างชำระ">
          <PieChart>
            <Tooltip {...tooltipProps(t)} />
            <Pie data={pie} dataKey="v" nameKey="name" innerRadius="45%" outerRadius="78%" isAnimationActive={false}>
              {pie.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
            </Pie>
          </PieChart>
        </CC>
      </div>

      <CC title="อายุหนี้ค้างชำระ (Aging Buckets)">
        <BarChart data={aging}>
          <CartesianGrid {...gridProps(t)} /><XAxis {...axisProps(t)} dataKey="label" /><YAxis {...axisProps(t)} tickFormatter={fmtShort} />
          <Tooltip {...tooltipProps(t)} />
          <Bar dataKey="v" name="ยอดค้างชำระ" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {aging.map((_, i) => <Cell key={i} fill={agingColors[i]} />)}
          </Bar>
        </BarChart>
      </CC>

      <div className="dz-cc">
        <h4>บิลค้างชำระ (เรียงจากค้างนานที่สุด)</h4>
        <div className="scroll" style={{ maxHeight: 420 }}>
          <table className="dz-tbl">
            <thead><tr>
              <th>วันที่ใบ</th><th>เลขที่บิล</th><th>ลูกค้า</th><th>ประเภทชำระ</th>
              <th className="n">ค้างกี่วัน</th><th className="n">ยอด</th>
            </tr></thead>
            <tbody>
              {unpaid.length === 0 ? <Empty cols={6} text="ไม่มีบิลค้างชำระ 🎉" /> : unpaid
                .map((x) => ({ ...x, days: daysBetween(x.r.date, today) ?? 0 }))
                .sort((a, b) => b.days - a.days).slice(0, 100)
                .map((x, i) => (
                  <tr key={i}>
                    <td>{thDateSafe(x.r.date)}</td>
                    <td>{x.b.no || "–"}</td>
                    <td>{x.b.sender || x.b.receiver || "–"}</td>
                    <td>{x.b.payType || "–"}</td>
                    <td className="n">{fmtBaht(x.days)}</td>
                    <td className="n">{fmtBaht(num(x.b.total))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
