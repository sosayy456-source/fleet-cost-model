/**
 * แท็บ "Damage Rate" — ความเสียหายของสินค้า (บิลเคลียร์) ตามช่วงเวลา เส้นทาง และรถ
 *
 * สเปก: `ออกแบบ Dashboard.pdf` (หน้าตา) + `dashboard คชจ.pdf` (นิยามข้อมูล) · เจ้าของงานเคาะรายละเอียด 23 ก.ย. 2569
 * สูตรทั้งหมดอยู่ที่ `lib/damage/damage.ts` — ไฟล์นี้วาดอย่างเดียว
 *
 * ลำดับบนหน้า: ตัวกรอง → การ์ด KPI → แนวโน้มรายเดือน + Damage Alert รายเดือน
 *   → วงกลมสัดส่วนชนิดรถ + แท่งเส้นทาง 10 อันดับ → ตารางเส้นทาง × ประเภทรถ × ชนิดรถ
 *   → Damage Alert ของตาราง → ตารางระดับความเสียหายและแนวทางการดำเนินการ
 *
 * ★ ตัวหาร = เที่ยวที่จับคู่บิลได้ **ไม่รวมเที่ยววิ่งเปล่า** (เจ้าของงานเคาะ 20 ก.ย. 2569)
 * ★ มูลค่าความเสียหายมาจากบิลในไฟล์รายได้ (clrAmt/clrN) จึงมีเฉพาะเที่ยวที่ m = true
 *   หน้า "Dashboard ค่าเดินทาง(ไม่ใช้)" จึงขึ้นข้อจำกัดแทน · ไม่ใช้ธง clear จากไฟล์ต้นทุน (ไม่ตรงกับบิลจริง)
 * ★ ตัวกรองมีสามชุดที่ขอบเขตไม่เท่ากัน — สลับกันแล้วตัวเลขผิดโดยไม่มี error:
 *     timed  = ตัวกรองเวลาอย่างเดียว → เกณฑ์ P75 (ภาพรวมบริษัท ไม่ตามเส้นทาง/รถ)
 *     rows   = เวลา + เส้นทาง/รถด้านบน → การ์ด วงกลม แท่ง Alert รายเดือน
 *     กราฟแนวโน้ม = ทั้งปีที่เลือก (ไม่ตัดตามช่วงเดือน) + เส้นทาง/รถด้านบน
 *   ตารางมีตัวกรองหัวตารางของตัวเอง ค่าว่าง = ตามตัวกรองด้านบน ถ้าเลือก = ทับมิตินั้น (ไม่มีตัวกรองเวลาของตัวเอง
 *   เพราะระดับความเสียหายต้องเทียบกับ P75 ของช่วงเวลาเดียวกับด้านบน)
 * ★ ห้ามเขียนหมายเหตุอธิบายใต้กราฟ (เจ้าของงานสั่ง) — มีได้แค่ป้ายสีบอกชื่อเส้น
 */
import { useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DPie } from "../../lib/chart/dcharts";
import { anim, axisProps, gridProps, legendProps, tooltipProps } from "../../lib/chart/primitives";
import { D, useChartTheme } from "../../lib/chart/theme";
import { FF, Hero, KC, Note, Pane, TableHead } from "../dash-fleet/parts";
import { ListFF, SortTable, YearFF, duniq, fmt, isFiltered, monthLabel, monthName, pct, routeArrow, useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import {
  CASES, LEVELS, MIN_TRIPS_ALERT, PERIOD_ALL, aggregateDamage, caseOf, damageCase, damageLevel, damageThresholds, inPeriod,
  isPartialYear, levelOf, totalDamage,
} from "../../lib/damage/damage";
import type { DamageAgg, DamageCase, DamageLevel, DamagePeriod, DamageThresholds } from "../../lib/damage/damage";
import type { Col } from "./common";
import type { CostRevMode } from "./CostRevDash";
import type { Trip } from "../../lib/data/useCostRev";

const TOP_ROUTES = 10;
/** จำนวนชนิดรถที่แยกสีในวงกลม/แท่ง — ที่เหลือรวมเป็น "อื่น ๆ" (ชุดตัวอย่างมีชนิดรถที่เสียหาย 13 ชนิด) */
const TOP_KINDS = 5;
const OTHER = "อื่น ๆ";
const PALETTE = [D.indigo, D.violet, D.amber, D.teal, D.rose, D.cyan, D.orange, D.pink, D.emerald, "#65A30D"];
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * ป้ายแกน % — Damage Rate ปกติต่ำกว่า 1% (ชุดตัวอย่าง 0.044%) ถ้าปัดทศนิยมตายตัว
 * ขีดแกนจะกลายเป็น "0%" ทุกขีด จึงเลือกจำนวนทศนิยมตามขนาดของค่าเอง
 */
const pctTick = (v: number): string =>
  v === 0 ? "0%" : `${Number(v.toFixed(Math.abs(v) < 0.01 ? 4 : Math.abs(v) < 0.1 ? 3 : Math.abs(v) < 1 ? 2 : 1))}%`;

/** สองเส้นของกราฟแนวโน้ม — แกนเดียว กดปุ่มหัวการ์ดเปิด-ปิดทีละเส้น (เจ้าของงานเลือก 23 ก.ย. 2569) */
const LINES = [
  { key: "dr", label: "Damage Rate", color: D.rose, p75: "p75Rate" },
  { key: "dir", label: "Damage Incidence Rate", color: D.cyan, p75: "p75Incidence" },
] as const;

const rtKey = (t: Trip): string => t.rt || routeArrow(t);
const orNone = (s: string): string => s || "(ไม่ระบุ)";

interface Dims { rt: string; ft: string; vk: string }
const passDims = (t: Trip, d: Dims): boolean =>
  (!d.rt || rtKey(t) === d.rt) && (!d.ft || t.ft === d.ft) && (!d.vk || t.vk === d.vk);

interface TopFilter extends DamagePeriod, Dims {}
const F0: TopFilter = { ...PERIOD_ALL, rt: "", ft: "", vk: "" };

/** ตัวเลือกระดับในหัวตาราง — "dmg" = ทุกระดับที่มีความเสียหาย (ค่าตั้งต้น ตามหัวข้อ "ที่มีบิลเคลียร์") */
type LevelPick = "dmg" | "all" | DamageLevel;
interface TableFilter extends Dims { level: LevelPick }
const T0: TableFilter = { rt: "", ft: "", vk: "", level: "dmg" };

interface GroupRow extends DamageAgg {
  route: string; ft: string; vk: string;
  level: DamageLevel | null;
  /** กรณีตามเกณฑ์ (5 กรณี) — ระดับปานกลางมีสองกรณีที่แนวทางต่างกัน ใช้บอกแนวทางบนป้าย */
  kase: DamageCase | null;
}

const rankOf = (l: DamageLevel | null): number => (l ? levelOf(l).rank : -1);

export default function DamageTab({ trips, mode, matchedTotal, isSample }: {
  trips: Trip[]; mode: CostRevMode; matchedTotal: number; isSample: boolean;
}) {
  const [f, setF] = useState<TopFilter>(F0);
  const [tf, setTf] = useState<TableFilter>(T0);
  /** เส้นที่ซ่อนในกราฟแนวโน้ม — เส้นประ P75 ของเส้นนั้นซ่อนตามไปด้วย เหลืออย่างน้อย 1 เส้นเสมอ */
  const [hidden, setHidden] = useState<string[]>([]);
  const toggleLine = (k: string) =>
    setHidden((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length < LINES.length - 1 ? [...p, k] : p));

  // เที่ยวที่จับคู่บิลได้ และไม่ใช่เที่ยววิ่งเปล่า — หน้า exec กรอง m มาให้แล้ว กรองซ้ำกันพลาด
  const base = useMemo(() => trips.filter((t) => t.m && !t.empty), [trips]);
  /** เที่ยวเปล่าที่จับคู่ได้ ตัดออกจากตัวหาร — โชว์ในหมายเหตุให้ตรวจยอดได้ */
  const emptyN = useMemo(() => trips.filter((t) => t.m && t.empty).length, [trips]);

  const timed = useMemo(() => base.filter((t) => inPeriod(t, f)), [base, f]);
  const th = useMemo(() => damageThresholds(timed), [timed]);
  const rows = useMemo(() => timed.filter((t) => passDims(t, f)), [timed, f]);
  const kpi = useMemo(() => totalDamage(rows), [rows]);

  /* ---------- กราฟแนวโน้ม: ทั้งปีที่เลือก (ช่วงเดือนแรเงาไว้) · ทุกปี = ทุกเดือนที่มีข้อมูล ---------- */
  const trend = useMemo(() => {
    const src = base.filter((t) => (!f.year || String(t.y) === f.year) && passDims(t, f));
    const byMo = new Map(aggregateDamage(src, (t) => t.mo).map((a) => [a.key, a]));
    const mos = f.year ? MONTHS.map((m) => `${f.year}-${m}`) : [...byMo.keys()].sort();
    return mos.map((mo) => {
      const a = byMo.get(mo);
      return {
        mo: monthLabel(mo),
        dr: a?.rate == null ? null : Math.round(a.rate * 1000) / 1000,
        dir: a ? Math.round(a.incidence * 100) / 100 : null,
      };
    });
  }, [base, f]);

  /** Damage Alert รายเดือน — เดือนในช่วงที่เลือกที่เกิน P75 ทั้งสองตัว (ระดับสูง) */
  const monthAlerts = useMemo(() =>
    aggregateDamage(rows, (t) => t.mo)
      .filter((a) => a.n >= MIN_TRIPS_ALERT && damageLevel(a, th) === "high")
      .sort((a, b) => a.key.localeCompare(b.key)), [rows, th]);

  /* ---------- วงกลม: สัดส่วนเที่ยวที่มีบิลเคลียร์ตามชนิดรถ ---------- */
  const damaged = useMemo(() => rows.filter((t) => t.clrN > 0), [rows]);
  const pieKinds = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of damaged) m.set(orNone(t.vk), (m.get(orNone(t.vk)) ?? 0) + 1);
    const all = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const top = all.slice(0, TOP_KINDS);
    const rest = all.slice(TOP_KINDS).reduce((s, [, v]) => s + v, 0);
    return rest ? [...top, [OTHER, rest] as [string, number]] : top;
  }, [damaged]);
  const fleetShare = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of damaged) m.set(orNone(t.ft), (m.get(orNone(t.ft)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [damaged]);

  /* ---------- แท่ง: Incidence รายเส้นทาง แบ่งท่อนตามสัดส่วนชนิดรถที่ใช้ในเส้นทางนั้น ---------- */
  const barRoutes = useMemo(() =>
    aggregateDamage(rows, rtKey)
      .filter((a) => a.n >= MIN_TRIPS_ALERT && a.incidence > 0)
      .sort((a, b) => b.incidence - a.incidence).slice(0, TOP_ROUTES), [rows]);
  const barKinds = useMemo(() => {
    const keep = new Set(barRoutes.map((r) => r.key));
    const m = new Map<string, number>();
    for (const t of rows) if (keep.has(rtKey(t))) m.set(orNone(t.vk), (m.get(orNone(t.vk)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_KINDS).map(([k]) => k);
  }, [rows, barRoutes]);

  /** สีของชนิดรถใช้ชุดเดียวกันทั้งวงกลมและแท่ง — ชนิดเดียวกันต้องสีเดียวกันทั้งสองกราฟ */
  const colorOf = useMemo(() => {
    const order: string[] = [];
    for (const [k] of pieKinds) if (k !== OTHER && !order.includes(k)) order.push(k);
    for (const k of barKinds) if (!order.includes(k)) order.push(k);
    return (k: string): string => (k === OTHER ? D.slate : PALETTE[order.indexOf(k) % PALETTE.length] ?? D.slate);
  }, [pieKinds, barKinds]);

  const barData = useMemo(() => {
    const byRoute = new Map<string, Map<string, number>>();
    const keep = new Set(barRoutes.map((r) => r.key));
    for (const t of rows) {
      const r = rtKey(t);
      if (!keep.has(r)) continue;
      const k = barKinds.includes(orNone(t.vk)) ? orNone(t.vk) : OTHER;
      const m = byRoute.get(r) ?? new Map<string, number>();
      m.set(k, (m.get(k) ?? 0) + 1);
      byRoute.set(r, m);
    }
    return barRoutes.map((r) => {
      const m = byRoute.get(r.key)!;
      // ท่อน = Incidence ของเส้นทาง × สัดส่วนเที่ยวของชนิดรถนั้น → ทุกท่อนรวมกันเท่ากับ Incidence ของเส้นทางพอดี
      const row: Record<string, string | number> = { name: r.key, total: r.incidence };
      [...barKinds, OTHER].forEach((k, i) => {
        const share = (m.get(k) ?? 0) / r.n;
        row[`k${i}`] = Math.round(r.incidence * share * 1000) / 1000;
        row[`s${i}`] = Math.round(share * 1000) / 10;
      });
      return row;
    });
  }, [rows, barRoutes, barKinds]);
  const barSeries = useMemo(() => {
    const ks = [...barKinds, OTHER];
    // "อื่น ๆ" ขึ้นเฉพาะเมื่อมีเที่ยวจริง ไม่งั้นป้ายสีมีชื่อที่ไม่มีท่อนให้เห็น
    return ks.map((k, i) => ({ key: `k${i}`, share: `s${i}`, label: k, color: colorOf(k) }))
      .filter((s) => barData.some((r) => Number(r[s.key]) > 0));
  }, [barKinds, barData, colorOf]);

  /* ---------- ตาราง: ตัวกรองหัวตารางทับตัวกรองด้านบนทีละมิติ ---------- */
  const eff: Dims = { rt: tf.rt || f.rt, ft: tf.ft || f.ft, vk: tf.vk || f.vk };
  const groups = useMemo<GroupRow[]>(() => {
    const g = aggregateDamage(timed.filter((t) => passDims(t, eff)), (t) => `${rtKey(t)}\u0000${t.ft}\u0000${t.vk}`);
    return g.map((a) => {
      const [route = "", ft = "", vk = ""] = a.key.split("\u0000");
      const kase = damageCase(a, th);
      return { ...a, route, ft, vk, kase, level: kase ? caseOf(kase).level : null };
    })
      // เรียงตั้งต้น: ระดับสูงก่อน แล้วตาม Damage Rate — useSort เรียงแบบ stable จึงคงลำดับรองนี้ไว้
      .sort((a, b) => rankOf(b.level) - rankOf(a.level) || (b.rate ?? 0) - (a.rate ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, th, eff.rt, eff.ft, eff.vk]);
  const shown = useMemo(() => groups.filter((r) =>
    tf.level === "all" ? true
      : tf.level === "dmg" ? r.clrAmt > 0
        : r.level === tf.level), [groups, tf.level]);
  /** Damage Alert ของตาราง — เฉพาะระดับสูงที่มีเที่ยวพอ (กลุ่มเที่ยวเดียวเสียหายได้ Incidence 100% ทันที) */
  const tableAlerts = useMemo(() =>
    groups.filter((r) => r.level === "high" && r.n >= MIN_TRIPS_ALERT), [groups]);

  const cols = useMemo<Col<GroupRow>[]>(() => [
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "ft", label: "ประเภทรถ", get: (r) => orNone(r.ft) },
    { key: "vk", label: "ชนิดรถ", get: (r) => orNone(r.vk) },
    // ไม่ใช่การหาร — เขียนเป็นตัวคั่นตามสเปก · เรียงตามจำนวนเที่ยวที่มีบิลเคลียร์
    { key: "ratio", label: "เที่ยวที่มีบิลเคลียร์ / เที่ยวทั้งหมด", get: (r) => r.dmgTrips, num: true,
      render: (r) => <><b>{fmt(r.dmgTrips)}</b> / {fmt(r.n)}</> },
    { key: "clrAmt", label: "มูลค่าบิลเคลียร์", get: (r) => r.clrAmt, num: true,
      render: (r) => <span style={{ fontWeight: r.clrAmt ? 700 : 400, color: r.clrAmt ? "var(--red)" : undefined }}>{fmt(r.clrAmt, 2)}</span> },
    { key: "rate", label: "% Damage Rate", get: (r) => r.rate, num: true,
      render: (r) => (r.rate == null ? "–" : pct(r.rate, 3)) },
    { key: "incidence", label: "Damage Incidence Rate (%)", get: (r) => r.incidence, num: true,
      render: (r) => pct(r.incidence, 2) },
    { key: "level", label: "ระดับความเสียหาย", get: (r) => rankOf(r.level),
      render: (r) => <LevelBadge level={r.level} kase={r.kase} /> },
  ], []);
  const { sorted, sort, toggle } = useSort(shown, cols, { key: "level", dir: -1 });

  if (mode === "all") {
    return (
      <div className="card">
        <h2>ดูได้เฉพาะใน Executive Dashboard</h2>
        <p className="muted">
          มูลค่าและจำนวนรายการความเสียหาย (บิลเคลียร์) อยู่ในไฟล์รายได้ ไม่ได้อยู่ในไฟล์ต้นทุน
          จึงคิดได้เฉพาะเที่ยวที่ <b>เลขที่ใบรายการจับคู่กับไฟล์รายได้ได้</b> เท่านั้น
          — เที่ยวที่เหลือในหน้านี้ไม่มีบิลให้อ้างอิง ถ้านับรวมเข้าไปตัวหารจะใหญ่เกินจริงและอัตราทุกตัวจะต่ำผิด
        </p>
        <p className="muted">
          ตัวเลขจริงดูได้ที่เมนู <b>Executive Dashboard</b> → แท็บ <b>Damage Rate</b>
          ({fmt(matchedTotal)} เที่ยวที่จับคู่ได้)
        </p>
      </div>
    );
  }

  const unfiltered = !isFiltered(f, F0);
  /** ฐานที่ควรได้ = เที่ยวที่จับคู่บิลได้ ลบเที่ยววิ่งเปล่าที่ตัดออกจากตัวหาร */
  const expectedN = matchedTotal - emptyN;
  const balanced = kpi.n === expectedN;
  const setDim = (k: keyof Dims) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setTDim = (k: keyof Dims) => (v: string) => setTf((p) => ({ ...p, [k]: v }));
  /** ตัวเลือกของตารางมาจากเที่ยวในช่วงเวลา (ไม่ใช่ที่กรองรถแล้ว) เพราะตัวกรองหัวตารางทับตัวกรองด้านบนได้ */
  const followTop = (top: string, all: string) => (top ? `ตามตัวกรองด้านบน (${top})` : all);
  const partial = isPartialYear(f);

  return (
    <>
      <FilterBar>
        <YearFF trips={base} value={f.year}
          onChange={(y) => setF((p) => (y ? { ...p, year: y } : { ...p, ...PERIOD_ALL }))} />
        <FF label="ตั้งแต่เดือน" value={f.from} disabled={!f.year}
          onChange={(v) => setF((p) => ({ ...p, from: v, to: p.to < v ? v : p.to }))}>
          {MONTHS.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </FF>
        <FF label="ถึงเดือน" value={f.to} disabled={!f.year} onChange={(v) => setF((p) => ({ ...p, to: v }))}>
          {MONTHS.filter((m) => m >= f.from).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </FF>
        <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.rt} onChange={setDim("rt")} opts={duniq(base.map(rtKey))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={setDim("ft")} opts={duniq(base.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={setDim("vk")} opts={duniq(base.map((t) => t.vk))} />
        <ClearFiltersBtn active={!unfiltered} onClick={() => setF(F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        {/* Row 1 การ์ดใหญ่ · Row 2 การ์ดเล็ก — ลำดับตาม `dashboard คชจ.pdf` หน้า 3 (เจ้าของงานเลือก 23 ก.ย. 2569) */}
        <div className="dz-heroes">
          <Hero kind="loss" l="Damage Rate" v={kpi.rate == null ? "–" : pct(kpi.rate, 3)} s="มูลค่าบิลเคลียร์ ÷ รายได้รวม" />
          <Hero kind="fleet" l="Damage Incidence Rate" v={pct(kpi.incidence, 2)} s="เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด" />
          <Hero kind="rev" l="มูลค่าบิลเคลียร์" v={fmt(kpi.clrAmt, 2)} s="บาท · มูลค่าความเสียหาย" />
        </div>
        <div className="dz-cards">
          <KC dot={D.rose} tone={kpi.dmgTrips ? "warn" : undefined} l="จำนวนเที่ยวที่มีบิลเคลียร์"
            v={fmt(kpi.dmgTrips)} s="เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" />
          <KC dot={D.emerald} l="รายได้รวม" v={fmt(kpi.rev)} s="บาท · เฉพาะเที่ยวที่จับคู่ได้" />
          <KC dot={D.indigo} l="จำนวนเที่ยวทั้งหมด" v={fmt(kpi.n)} s="เที่ยว · ฐานของทุกอัตรา" />
        </div>
        <Note>
          รวม <b>{fmt(kpi.n)}</b> เที่ยว
          {unfiltered && (balanced
            ? <> · ตรงกับเที่ยวที่จับคู่กับไฟล์รายได้ได้ {fmt(matchedTotal)} เที่ยว หักเที่ยววิ่งเปล่า {fmt(emptyN)} เที่ยว = {fmt(expectedN)} ✓</>
            : <b style={{ color: "var(--red)" }}> · ไม่ตรงกับฐานที่ควรได้ ({fmt(expectedN)} เที่ยว = จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)}) — มีเที่ยวตกหล่นจากการรวมยอด</b>)}
          {!unfiltered && <> · กรองอยู่ เทียบกับฐานทั้งหมด {fmt(expectedN)} เที่ยว (จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)})</>}
          {th.months === 1 && (
            <b style={{ color: "var(--orange-dark)" }}>
              {" "}· ช่วงที่เลือกมีข้อมูลเดือนเดียว เกณฑ์ P75 จึงเท่ากับค่าของเดือนนั้นเอง — ควรเลือกช่วงอย่างน้อย 2 เดือน
            </b>
          )}
        </Note>

        {/* กราฟ 1: แนวโน้มรายเดือน + เส้นประ P75 */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="แนวโน้ม Damage Rate และ Damage Incidence Rate รายเดือน">
            <div className="dmg-lines" role="group" aria-label="เลือกเส้นที่แสดง">
              {LINES.map((l) => {
                const on = !hidden.includes(l.key);
                return (
                  <button key={l.key} type="button" className={"dmg-line" + (on ? " on" : "")}
                    style={{ "--c": l.color } as React.CSSProperties} aria-pressed={on}
                    onClick={() => toggleLine(l.key)}>
                    <i />{l.label}
                  </button>
                );
              })}
            </div>
          </TableHead>
          <div className="dz-box">
            <TrendLines data={trend} hidden={hidden} th={th}
              band={partial ? [monthLabel(`${f.year}-${f.from}`), monthLabel(`${f.year}-${f.to}`)] : null} />
          </div>
          <AlertList title="Damage Alert · รายเดือน"
            empty="ไม่มีเดือนที่ Damage Rate และ Damage Incidence Rate เกินเกณฑ์ P75 พร้อมกัน"
            items={monthAlerts.map((a) => ({
              key: a.key, head: monthLabel(a.key),
              sub: `Damage Rate ${a.rate == null ? "–" : pct(a.rate, 3)} | Incidence Rate ${pct(a.incidence, 2)}`,
            }))} />
        </div>

        {/* แผนภูมิวงกลม + แท่งเส้นทาง */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <div className="dz-cc">
            <TableHead title="สัดส่วนเที่ยวที่มีบิลเคลียร์ ตามชนิดรถ" />
            <div className="dz-box">
              {pieKinds.length
                ? <DPie suffix=" เที่ยว" colors={pieKinds.map(([k]) => colorOf(k))}
                    data={pieKinds.map(([k, v]) => ({ name: `${k} · ${pct(v / damaged.length * 100, 0)}`, v }))} />
                : <EmptyChart text="ไม่มีเที่ยวที่มีบิลเคลียร์ตามตัวกรองที่เลือก" />}
            </div>
            {fleetShare.length > 0 && (
              <div className="dmg-fleet">
                {fleetShare.map(([k, v]) => (
                  <span key={k}>{k} <b>{pct(v / damaged.length * 100, 0)}</b></span>
                ))}
              </div>
            )}
          </div>
          <div className="dz-cc">
            <TableHead title={`Damage Incidence Rate รายเส้นทาง · ${TOP_ROUTES} อันดับแรก · แบ่งตามชนิดรถที่ใช้`} />
            <div className="dz-box tall">
              {barData.length
                ? <StackBars data={barData} series={barSeries} />
                : <EmptyChart text={`ไม่มีเส้นทางที่มีบิลเคลียร์และมีอย่างน้อย ${MIN_TRIPS_ALERT} เที่ยวตามตัวกรองที่เลือก`} />}
            </div>
          </div>
        </div>

        {/* ตารางเส้นทาง × ประเภทรถ × ชนิดรถ */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="ความเสียหายรายเส้นทาง × ประเภทรถ × ชนิดรถ">
            <ListFF label="เส้นทาง" all={followTop(f.rt, "ทุกเส้นทาง")} value={tf.rt} onChange={setTDim("rt")}
              opts={duniq(timed.map(rtKey))} />
            <ListFF label="ประเภทรถ" all={followTop(f.ft, "ทุกประเภทรถ")} value={tf.ft} onChange={setTDim("ft")}
              opts={duniq(timed.map((t) => t.ft))} />
            <ListFF label="ชนิดรถ" all={followTop(f.vk, "ทุกชนิดรถ")} value={tf.vk} onChange={setTDim("vk")}
              opts={duniq(timed.map((t) => t.vk))} />
            <FF label="ระดับความเสียหาย" value={tf.level} onChange={(v) => setTf((p) => ({ ...p, level: v as LevelPick }))}>
              <option value="dmg">มีความเสียหาย (ทุกระดับ)</option>
              {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              <option value="all">ทั้งหมด</option>
            </FF>
            <ClearFiltersBtn active={isFiltered(tf, T0)} onClick={() => setTf(T0)} />
          </TableHead>
          {/* dmg-tbl: หัวคอลัมน์ตัดบรรทัดได้ — 8 คอลัมน์ ถ้าไม่ตัด คอลัมน์ระดับความเสียหายหลุดขอบขวาไปอยู่นอกจอ */}
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} className="dmg-tbl"
            rowKey={(r) => r.key} empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" />
          <AlertList title="Damage Alert · ต้องเร่งตรวจสอบ"
            empty={`ไม่มีกลุ่มที่อยู่ในระดับความเสี่ยงสูง (นับเฉพาะกลุ่มที่มีอย่างน้อย ${MIN_TRIPS_ALERT} เที่ยว)`}
            items={tableAlerts.map((r) => ({
              key: r.key, head: `${r.route} · ${orNone(r.ft)} · ${orNone(r.vk)}`,
              sub: `Damage Rate ${r.rate == null ? "–" : pct(r.rate, 3)} | Incidence Rate ${pct(r.incidence, 2)} · ${fmt(r.dmgTrips)} จาก ${fmt(r.n)} เที่ยว`,
            }))} />
        </div>

        {/* ระดับความเสียหายและแนวทางการดำเนินการ (สเปกหน้า 6) — ต่อจาก Alert ของตาราง */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="ระดับความเสียหายและแนวทางการดำเนินการ" />
          <GuideTable th={th} />
        </div>
        <Note>
          <b>Damage Rate</b> = มูลค่าบิลเคลียร์ ÷ รายได้รวม ×100 ·
          <b> Damage Incidence Rate</b> = เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด ×100 (นับเที่ยว ไม่นับรายการบิลซ้ำ) ·
          <b> เกณฑ์ P75</b> คิดจาก KPI รายเดือนของ<b>ภาพรวมบริษัท</b>ในช่วงเวลาที่เลือก (สูตรเดียวกับ PERCENTILE.INC ของ Excel)
          ไม่เปลี่ยนตามตัวกรองเส้นทาง/รถ แล้วใช้เป็นเกณฑ์เดียวกันกับทุกกลุ่ม ·
          Damage Alert และกราฟแท่งนับเฉพาะกลุ่มที่มีอย่างน้อย {MIN_TRIPS_ALERT} เที่ยว
          (ตารางแสดงระดับของทุกกลุ่มครบ)
          {isSample && <b style={{ color: "var(--red)" }}> · ชุดข้อมูลตัวอย่างนี้สุ่มบิลมาบางส่วน ตัวเลขจึงต่ำกว่าความจริงมาก ให้ดูจากชุดข้อมูลจริง</b>}
        </Note>
      </Pane>
    </>
  );
}

/* ---------------- ชิ้นส่วนของแท็บ ---------------- */

function LevelBadge({ level, kase }: { level: DamageLevel | null; kase?: DamageCase | null }) {
  if (!level) return <span className="dmg-lv none">–</span>;
  // วางเมาส์ = แนวทางการดำเนินการของกรณีนั้น (ระดับปานกลางสองกรณีแนวทางไม่เหมือนกัน)
  return <span className={`dmg-lv ${level}`} title={kase ? caseOf(kase).action : undefined}>{levelOf(level).label}</span>;
}

function EmptyChart({ text }: { text: string }) {
  return <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>{text}</div>;
}

/** รายการเตือนระดับสูง — ใช้ทั้งใต้กราฟแนวโน้ม (รายเดือน) และใต้ตาราง (รายกลุ่ม) */
function AlertList({ title, items, empty }: {
  title: string; empty: string;
  items: { key: string; head: string; sub: string }[];
}) {
  const high = levelOf("high");
  return (
    <div className="dmg-alerts">
      <h5>{title}{items.length > 0 && <span> · {fmt(items.length)} รายการ</span>}</h5>
      {items.length === 0 ? <div className="dmg-ok">{empty}</div> : (
        <div className="dmg-alist">
          {items.map((it) => (
            <div key={it.key} className="dmg-alert">
              <div>
                <b>{it.head}</b>
                <small>{it.sub} → เร่งตรวจสอบและแก้ไข</small>
              </div>
              <span className="dmg-lv high">{high.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ตารางเกณฑ์การประเมิน 5 กรณี (ไฟล์ "dashboard คชจ (1).pdf" หน้า 1) พร้อมค่า P75 ของช่วงที่เลือก ให้ผู้ใช้เห็นว่าแต่ละระดับตัดสินจากอะไร */
function GuideTable({ th }: { th: DamageThresholds }) {
  return (
    <>
      <div className="dmg-th">
        เกณฑ์ P75 ของช่วงที่เลือก (ภาพรวมบริษัท {fmt(th.months)} เดือน):
        {" "}Damage Rate <b>{th.p75Rate == null ? "–" : pct(th.p75Rate, 3)}</b>
        {" "}· Damage Incidence Rate <b>{th.p75Incidence == null ? "–" : pct(th.p75Incidence, 2)}</b>
      </div>
      <table className="dz-tbl">
        <thead><tr><th>เงื่อนไข</th><th>ระดับความเสียหาย</th><th>แนวทางการดำเนินการ</th></tr></thead>
        <tbody>
          {CASES.map((c) => (
            <tr key={c.key}>
              <td style={{ whiteSpace: "nowrap" }}>{c.when}</td>
              <td><span className={`dmg-lv ${c.level}`}>{levelOf(c.level).label}</span></td>
              <td>{c.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * กราฟเส้น 2 ตัวชี้วัดบนแกน % เดียวกัน + เส้นประ P75 สีเดียวกับเส้นของมัน
 * band = ช่วงเดือนที่เลือก (แรเงา) เมื่อเลือกไม่เต็มปี — กราฟแสดงทั้งปีเสมอตามสเปก
 */
function TrendLines({ data, hidden, th, band }: {
  data: { mo: string; dr: number | null; dir: number | null }[];
  hidden: string[]; th: DamageThresholds; band: [string, string] | null;
}) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 14, right: 18, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="mo" />
        <YAxis {...axisProps(t)} width={58} domain={[0, "auto"]} tickFormatter={pctTick} />
        <Tooltip {...tooltipProps(t, "%", 3)} />
        <Legend {...legendProps} />
        {band && (band[0] === band[1]
          ? <ReferenceLine x={band[0]} stroke={D.slate} strokeWidth={10} strokeOpacity={0.18} />
          : <ReferenceArea x1={band[0]} x2={band[1]} fill={D.slate} fillOpacity={0.12} />)}
        {LINES.map((l) => {
          const v = th[l.p75];
          return v == null || hidden.includes(l.key) ? null : (
            <ReferenceLine key={`p75-${l.key}`} y={v} stroke={l.color} strokeDasharray="5 5" strokeWidth={1.4}
              ifOverflow="extendDomain"
              label={{ value: `P75 ${pctTick(Math.round(v * 1000) / 1000)}`, position: "insideTopRight", fill: l.color, fontSize: 12 }} />
          );
        })}
        {LINES.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2.4}
            dot={{ r: 2.5, fill: l.color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls
            hide={hidden.includes(l.key)} {...anim} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** แท่งนอนซ้อนท่อน — แกนนอน = Damage Incidence Rate % · แกนตั้ง = เส้นทาง · ท่อน = สัดส่วนชนิดรถที่ใช้ */
function StackBars({ data, series }: {
  data: Record<string, string | number>[];
  series: { key: string; share: string; label: string; color: string }[];
}) {
  const t = useChartTheme();
  const longest = data.reduce((m, r) => Math.max(m, String(r.name).length), 0);
  const tip = tooltipProps(t, "%", 2);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} layout="vertical" margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} type="number" tickFormatter={pctTick} />
        <YAxis {...axisProps(t)} type="category" dataKey="name" width={Math.min(230, Math.max(70, longest * 7.2 + 12))} />
        <Tooltip {...tip}
          labelFormatter={(label: string, payload: { payload?: Record<string, number> }[]) =>
            `${label} · Incidence ${pct(Number(payload?.[0]?.payload?.total ?? 0), 2)}`}
          formatter={(v: number, name: string, item: { dataKey?: string | number; payload?: Record<string, number> }) => {
            const s = series.find((x) => x.key === item.dataKey);
            const share = s && item.payload ? item.payload[s.share] : null;
            return [`${pct(v, 2)}${share != null ? ` · ใช้ ${share}% ของเที่ยวในเส้นทาง` : ""}`, name] as [string, string];
          }} />
        <Legend {...legendProps} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="vk" fill={s.color} {...anim} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
