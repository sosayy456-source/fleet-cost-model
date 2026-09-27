/**
 * แท็บ "Damage Rate" — ความเสียหายของสินค้า (บิลเคลียร์) ตามช่วงเวลา เส้นทาง และรถ
 *
 * สเปก: `ออกแบบ Dashboard.pdf` (หน้าตา) + `dashboard คชจ.pdf` (นิยามข้อมูล) · เจ้าของงานเคาะรายละเอียด 23 ก.ย. 2569
 * สูตรทั้งหมดอยู่ที่ `lib/damage/damage.ts` — ไฟล์นี้วาดอย่างเดียว
 *
 * ลำดับบนหน้า: ตัวกรอง → การ์ด KPI (แถว 1: DR · DIR · มูลค่า · เที่ยวที่มีบิลเคลียร์ · แถว 2: รายได้ · เที่ยวทั้งหมด)
 *   → แนวโน้มรายเดือน + Damage Alert รายเดือน → แท่งนอน DIR ตามชนิดรถ 15 อันดับ (ท่อน = ประเภทรถ) + ตามเส้นทาง 15 อันดับ
 *   → ตารางเส้นทาง × ประเภทรถ × ชนิดรถ (ระดับ + คำแนะนำ) → Damage Alert → ตารางคำแนะนำ → ตารางระดับความเสียหาย
 * ★ ไฟล์ "dashboard คชจ.md" (เจ้าของงานส่ง 27 ก.ย. 2569): เกณฑ์ระดับ 4 ระดับ + คำแนะนำ 4 แบบ (lib/damage/damage.ts) ·
 *   เลือกเดือนเดียว = ไม่ใช้ P75 เป็นเกณฑ์ (ไม่จัดระดับ/คำแนะนำ ไม่มี Alert ซ่อนเส้น P75) · กราฟแท่งนับทุกกลุ่ม ไม่ตัดกลุ่มเที่ยวน้อย
 *   (เจ้าของงานเลือก) แต่ Damage Alert ยังนับเฉพาะกลุ่ม ≥ MIN_TRIPS_ALERT เที่ยว
 *
 * ★ ตัวหาร = เที่ยวที่จับคู่บิลได้ **ไม่รวมเที่ยววิ่งเปล่า** (เจ้าของงานเคาะ 20 ก.ย. 2569)
 * ★ มูลค่าความเสียหายมาจากบิลในไฟล์รายได้ (clrAmt/clrN) จึงมีเฉพาะเที่ยวที่ m = true
 *   หน้า "Dashboard ค่าเดินทาง(ไม่ใช้)" จึงขึ้นข้อจำกัดแทน · ไม่ใช้ธง clear จากไฟล์ต้นทุน (ไม่ตรงกับบิลจริง)
 * ★ ตัวกรองมีสามชุดที่ขอบเขตไม่เท่ากัน — สลับกันแล้วตัวเลขผิดโดยไม่มี error:
 *     timed  = ตัวกรองเวลาอย่างเดียว → เกณฑ์ P75 (ภาพรวมบริษัท ไม่ตามเส้นทาง/รถ)
 *     rows   = เวลา + เส้นทาง/รถด้านบน → การ์ด กราฟแท่ง Alert รายเดือน
 *     กราฟแนวโน้ม = ทั้งปีที่เลือก (ไม่ตัดตามช่วงเดือน) + เส้นทาง/รถด้านบน
 *   ตารางมีตัวกรองหัวตารางของตัวเอง ค่าว่าง = ตามตัวกรองด้านบน ถ้าเลือก = ทับมิตินั้น (ไม่มีตัวกรองเวลาของตัวเอง
 *   เพราะระดับความเสียหายต้องเทียบกับ P75 ของช่วงเวลาเดียวกับด้านบน)
 * ★ ห้ามเขียนหมายเหตุอธิบายใต้กราฟ (เจ้าของงานสั่ง) — มีได้แค่ป้ายสีบอกชื่อเส้น
 */
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BAR_RADIUS, anim, axisProps, gridProps, legendProps, tooltipProps } from "../../lib/chart/primitives";
import { D, DFONT, useChartTheme } from "../../lib/chart/theme";
import type { ChartTheme } from "../../lib/chart/theme";
import { FF, Hero, KC, Note, Pane, TableHead } from "../dash-fleet/parts";
import { ListFF, PeriodFF, SortTable, duniq, fmt, isFiltered, monthLabel, pct, routeArrow, useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import {
  LEVELS, MIN_TRIPS_ALERT, PERIOD_ALL, RECS, aggregateDamage, damageLevel, damageRec, damageThresholds, inPeriod,
  isPartialYear, levelOf, recOf, totalDamage,
} from "../../lib/damage/damage";
import type { DamageAgg, DamageLevel, DamagePeriod, DamageRec, DamageThresholds } from "../../lib/damage/damage";
import type { Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

/** จำนวนแท่งของกราฟชนิดรถ/เส้นทาง (เจ้าของงานสั่ง 27 ก.ย. 2569 — เดิมเส้นทาง 10 · ชนิดรถเป็นวงกลม 5 + อื่น ๆ) */
const TOP_BARS = 15;
/** สีประเภทรถในแท่งชนิดรถ — ชุดเดียวกับแท็บ Vehicle Utilization (FT_COLOR ใน FleetUtilizationView.tsx) ผูกกับชื่อ ไม่ใช่ลำดับ */
const FT_ORDER = ["รถบริษัท", "รถร่วม", "รถร่วมนอกพิเศษ"];
const FT_COLOR: Record<string, string> = { "รถบริษัท": D.indigo, "รถร่วม": D.teal, "รถร่วมนอกพิเศษ": D.amber };
const ftColor = (ft: string): string => FT_COLOR[ft] ?? D.slate;
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * ป้ายแกน % — Damage Rate ปกติต่ำกว่า 1% (ชุดตัวอย่าง 0.044%) ถ้าปัดทศนิยมตายตัว
 * ขีดแกนจะกลายเป็น "0%" ทุกขีด จึงเลือกจำนวนทศนิยมตามขนาดของค่าเอง
 */
const pctTick = (v: number): string =>
  v === 0 ? "0%" : `${Number(v.toFixed(Math.abs(v) < 0.01 ? 4 : Math.abs(v) < 0.1 ? 3 : Math.abs(v) < 1 ? 2 : 1))}%`;

/** สองเส้นของกราฟแนวโน้ม — แกนเดียว กดปุ่มหัวการ์ดเปิด-ปิดทีละเส้น (เจ้าของงานเลือก 23 ก.ย. 2569) */
const LINES = [
  { key: "dr", label: "Damage Rate", color: D.rose, p75: "p75Rate", p75Label: "เส้นเกณฑ์ระดับมูลค่าความเสียหาย (P75)" },
  { key: "dir", label: "Damage Incidence Rate", color: D.cyan, p75: "p75Incidence", p75Label: "เส้นเกณฑ์ระดับการเกิดความเสียหาย (P75)" },
] as const;

/** ชื่อเดือนเต็ม — Damage Alert รายเดือนตามตัวอย่างในไฟล์ "เดือน มกราคม …" */
const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const fullMonth = (mo: string): string => `${TH_MONTH[Number(mo.slice(5, 7)) - 1]} ${Number(mo.slice(0, 4)) + 543}`;

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
  /** คำแนะนำตาม logic ในไฟล์ (ชุดแยกจากระดับ) */
  rec: DamageRec | null;
}

const rankOf = (l: DamageLevel | null): number => (l ? levelOf(l).rank : -1);

export default function DamageTab({ trips, matchedTotal, isSample }: {
  trips: Trip[]; matchedTotal: number; isSample: boolean;
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

  /* ---------- แท่งนอน: อัตราความถี่การเกิดความเสียหาย (DIR) ตามชนิดรถ · ท่อน = สัดส่วนประเภทรถของเที่ยวที่มีบิลเคลียร์ ---------- */
  const kindBars = useMemo(() => {
    const top = aggregateDamage(rows, (t) => orNone(t.vk))
      .filter((a) => a.dmgTrips > 0)
      .sort((a, b) => b.incidence - a.incidence || b.dmgTrips - a.dmgTrips).slice(0, TOP_BARS);
    const keep = new Set(top.map((a) => a.key));
    const byKind = new Map<string, Map<string, number>>();
    for (const t of rows) {
      if (!(t.clrN > 0) || !keep.has(orNone(t.vk))) continue;
      const m = byKind.get(orNone(t.vk)) ?? new Map<string, number>();
      m.set(orNone(t.ft), (m.get(orNone(t.ft)) ?? 0) + 1);
      byKind.set(orNone(t.vk), m);
    }
    const fts = [...new Set([...byKind.values()].flatMap((m) => [...m.keys()]))]
      .sort((a, b) => (FT_ORDER.indexOf(a) + 1 || 99) - (FT_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b, "th"));
    const data = top.map((a) => {
      const m = byKind.get(a.key) ?? new Map<string, number>();
      const row: KindBar = { name: a.key, total: a.incidence, dmg: a.dmgTrips, n: a.n, amt: a.clrAmt, shares: {} };
      // ท่อน = DIR ของชนิดรถ × สัดส่วนประเภทรถในเที่ยวที่มีบิลเคลียร์ → ทุกท่อนรวมเท่ากับ DIR ของชนิดรถพอดี
      fts.forEach((ft, i) => {
        const share = (m.get(ft) ?? 0) / a.dmgTrips;
        row[`f${i}`] = a.incidence * share;
        row.shares[ft] = share * 100;
      });
      return row;
    });
    return { data, series: fts.map((ft, i) => ({ key: `f${i}`, label: ft, color: ftColor(ft) })) };
  }, [rows]);

  /* ---------- แท่งนอน: DIR ตามเส้นทาง 15 อันดับ · แท่งสีเดียว ตัวเลข % ในแท่ง ---------- */
  const routeBars = useMemo(() =>
    aggregateDamage(rows, rtKey)
      .filter((a) => a.dmgTrips > 0)
      .sort((a, b) => b.incidence - a.incidence || b.dmgTrips - a.dmgTrips).slice(0, TOP_BARS)
      .map((a) => ({ name: a.key, v: a.incidence, dmg: a.dmgTrips, n: a.n })), [rows]);

  /* ---------- ตาราง: ตัวกรองหัวตารางทับตัวกรองด้านบนทีละมิติ ---------- */
  const eff: Dims = { rt: tf.rt || f.rt, ft: tf.ft || f.ft, vk: tf.vk || f.vk };
  const groups = useMemo<GroupRow[]>(() => {
    const g = aggregateDamage(timed.filter((t) => passDims(t, eff)), (t) => `${rtKey(t)}\u0000${t.ft}\u0000${t.vk}`);
    return g.map((a) => {
      const [route = "", ft = "", vk = ""] = a.key.split("\u0000");
      return { ...a, route, ft, vk, level: damageLevel(a, th), rec: damageRec(a, th) };
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
      render: (r) => <LevelBadge level={r.level} /> },
    { key: "rec", label: "คำแนะนำ", get: (r) => (r.rec ? RECS.findIndex((x) => x.key === r.rec) : -1),
      render: (r) => <RecBadge rec={r.rec} /> },
  ], []);
  const { sorted, sort, toggle } = useSort(shown, cols, { key: "level", dir: -1 });

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
        <PeriodFF trips={base} value={f} onChange={setF} />
        <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.rt} onChange={setDim("rt")} opts={duniq(base.map(rtKey))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={setDim("ft")} opts={duniq(base.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={setDim("vk")} opts={duniq(base.map((t) => t.vk))} />
        <ClearFiltersBtn active={!unfiltered} onClick={() => setF(F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        {/* Row 1 การ์ดใหญ่ · Row 2 การ์ดเล็ก — ลำดับตาม `dashboard คชจ.pdf` หน้า 3 (เจ้าของงานเลือก 23 ก.ย. 2569) */}
        {/* แถว 1 = 4 ใบ · แถว 2 = 2 ใบ ตามไฟล์ "dashboard คชจ.md" (27 ก.ย. 2569) */}
        <div className="dz-heroes dmg-heroes">
          <Hero kind="loss" l="Damage Rate" v={kpi.rate == null ? "–" : pct(kpi.rate, 3)} s="มูลค่าบิลเคลียร์ ÷ รายได้รวม" />
          <Hero kind="fleet" l="Damage Incidence Rate" v={pct(kpi.incidence, 2)} s="เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด" />
          <Hero kind="rev" l="มูลค่าบิลเคลียร์" v={fmt(kpi.clrAmt, 2)} s="บาท · มูลค่าความเสียหาย" />
          <Hero kind="warn" l="จำนวนเที่ยวที่มีบิลเคลียร์" v={fmt(kpi.dmgTrips)} s="เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" />
        </div>
        <div className="dz-cards dmg-cards2">
          <KC dot={D.emerald} l="รายได้รวม" v={fmt(kpi.rev)} s="บาท · เฉพาะเที่ยวที่จับคู่ได้" />
          <KC dot={D.indigo} l="จำนวนเที่ยวทั้งหมด" v={fmt(kpi.n)} s="เที่ยว · ฐานของทุกอัตรา" />
        </div>
        <Note>
          รวม <b>{fmt(kpi.n)}</b> เที่ยว
          {unfiltered && (balanced
            ? <> · ตรงกับเที่ยวที่จับคู่กับไฟล์รายได้ได้ {fmt(matchedTotal)} เที่ยว หักเที่ยววิ่งเปล่า {fmt(emptyN)} เที่ยว = {fmt(expectedN)} ✓</>
            : <b style={{ color: "var(--red)" }}> · ไม่ตรงกับฐานที่ควรได้ ({fmt(expectedN)} เที่ยว = จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)}) — มีเที่ยวตกหล่นจากการรวมยอด</b>)}
          {!unfiltered && <> · กรองอยู่ เทียบกับฐานทั้งหมด {fmt(expectedN)} เที่ยว (จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)})</>}
          {th.months > 0 && !th.usable && (
            <b style={{ color: "var(--orange-dark)" }}>
              {" "}· ช่วงที่เลือกมีข้อมูลเดือนเดียว ไม่ใช้ P75 เป็นเกณฑ์ — ไม่จัดระดับ/คำแนะนำ และไม่มี Damage Alert ·
              เลือกช่วงอย่างน้อย 2 เดือนเพื่อประเมิน
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
          <AlertList title="Damage Alert · รายเดือน" action="ควรเร่งตรวจสอบแก้ไข"
            empty="ไม่มีเดือนที่ Damage Rate และ Damage Incidence Rate เกินเกณฑ์ P75 พร้อมกัน"
            items={monthAlerts.map((a) => ({
              key: a.key, head: `เดือน ${fullMonth(a.key)}`,
              sub: `Damage Rate ${a.rate == null ? "–" : pct(a.rate, 3)}, Damage Incidence Rate ${pct(a.incidence, 2)}`,
            }))} />
        </div>

        {/* แท่งนอน DIR ตามชนิดรถ + ตามเส้นทาง (15 อันดับ · เจ้าของงานสั่ง 27 ก.ย. 2569 แทนวงกลม/แท่งแบ่งชนิดรถ) */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <div className="dz-cc">
            <TableHead title="อัตราความถี่การเกิดความเสียหายตามชนิดรถ" />
            <div className="dz-box" style={{ height: barsHeight(kindBars.data.length) }}>
              {kindBars.data.length
                ? <KindBars data={kindBars.data} series={kindBars.series} />
                : <EmptyChart text="ไม่มีเที่ยวที่มีบิลเคลียร์ตามตัวกรองที่เลือก" />}
            </div>
          </div>
          <div className="dz-cc">
            <TableHead title="อัตราความถี่การเกิดความเสียหายตามเส้นทาง" />
            <div className="dz-box" style={{ height: barsHeight(routeBars.length) }}>
              {routeBars.length
                ? <RouteBars data={routeBars} />
                : <EmptyChart text="ไม่มีเส้นทางที่มีบิลเคลียร์ตามตัวกรองที่เลือก" />}
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
          <AlertList title="Damage Alert · ต้องเร่งตรวจสอบ" action="เร่งตรวจสอบและแก้ไขด่วน"
            empty={`ไม่มีกลุ่มที่อยู่ในระดับความเสี่ยงสูง (นับเฉพาะกลุ่มที่มีอย่างน้อย ${MIN_TRIPS_ALERT} เที่ยว)`}
            items={tableAlerts.map((r) => ({
              key: r.key, head: `${r.route} · ${orNone(r.ft)} · ${orNone(r.vk)}`,
              sub: `Damage Rate = ${r.rate == null ? "–" : pct(r.rate, 3)} | Incidence Rate = ${pct(r.incidence, 2)} · ${fmt(r.dmgTrips)} จาก ${fmt(r.n)} เที่ยว`,
            }))} />
        </div>

        {/* คำแนะนำ (ต่อจาก Alert ของตารางตามไฟล์) + ระดับความเสียหาย — สองชุดเกณฑ์แยกกัน */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="คำแนะนำและแนวทางการดำเนินการ" />
          <RecTable th={th} />
        </div>
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="ระดับความเสียหาย" />
          <LevelTable />
        </div>
        <Note>
          <b>Damage Rate</b> = มูลค่าบิลเคลียร์ ÷ รายได้รวม ×100 ·
          <b> Damage Incidence Rate</b> = เที่ยวที่มีบิลเคลียร์ ÷ เที่ยวทั้งหมด ×100 (นับเที่ยว ไม่นับรายการบิลซ้ำ) ·
          <b> เกณฑ์ P75</b> คิดจาก KPI รายเดือนของ<b>ภาพรวมบริษัท</b>ในช่วงเวลาที่เลือก (สูตรเดียวกับ PERCENTILE.INC ของ Excel)
          ไม่เปลี่ยนตามตัวกรองเส้นทาง/รถ แล้วใช้เป็นเกณฑ์เดียวกันกับทุกกลุ่ม ·
          Damage Alert นับเฉพาะกลุ่มที่มีอย่างน้อย {MIN_TRIPS_ALERT} เที่ยว (ตารางและกราฟแท่งแสดงทุกกลุ่ม)
          {isSample && <b style={{ color: "var(--red)" }}> · ชุดข้อมูลตัวอย่างนี้สุ่มบิลมาบางส่วน ตัวเลขจึงต่ำกว่าความจริงมาก ให้ดูจากชุดข้อมูลจริง</b>}
        </Note>
      </Pane>
    </>
  );
}

/* ---------------- ชิ้นส่วนของแท็บ ---------------- */

function LevelBadge({ level }: { level: DamageLevel | null }) {
  if (!level) return <span className="dmg-lv none" title="ใช้ P75 เป็นเกณฑ์ไม่ได้ (ช่วงที่เลือกมีข้อมูลเดือนเดียว)">–</span>;
  const l = levelOf(level);
  return <span className={`dmg-lv ${level}`} title={`${l.meaning} · ${l.action}`}>{l.label}</span>;
}

function RecBadge({ rec }: { rec: DamageRec | null }) {
  if (!rec) return <span className="dmg-rec">–</span>;
  const r = recOf(rec);
  return <span className={`dmg-rec ${rec}`} title={r.action}>{r.label}</span>;
}

function EmptyChart({ text }: { text: string }) {
  return <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>{text}</div>;
}

/** รายการเตือนระดับสูง — ใช้ทั้งใต้กราฟแนวโน้ม (รายเดือน) และใต้ตาราง (รายกลุ่ม) */
function AlertList({ title, items, empty, action }: {
  title: string; empty: string;
  /** ข้อความหลังลูกศร — ไฟล์ใช้คนละคำ: รายเดือน "ควรเร่งตรวจสอบแก้ไข" · รายกลุ่ม "เร่งตรวจสอบและแก้ไขด่วน" */
  action: string;
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
                <small>{it.sub} → {action}</small>
              </div>
              <span className="dmg-lv high">{high.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** ตารางคำแนะนำ (ไฟล์ "dashboard คชจ.md") พร้อมค่า P75 ของช่วงที่เลือก ให้ผู้ใช้เห็นว่าตัดสินจากอะไร */
function RecTable({ th }: { th: DamageThresholds }) {
  return (
    <>
      <div className="dmg-th">
        เกณฑ์ P75 ของช่วงที่เลือก (ภาพรวมบริษัท {fmt(th.months)} เดือน):
        {" "}Damage Rate <b>{th.p75Rate == null ? "–" : pct(th.p75Rate, 3)}</b>
        {" "}· Damage Incidence Rate <b>{th.p75Incidence == null ? "–" : pct(th.p75Incidence, 2)}</b>
        {th.months > 0 && !th.usable && " · เดือนเดียว ไม่ใช้เป็นเกณฑ์"}
      </div>
      <table className="dz-tbl">
        <thead><tr><th>คำแนะนำ</th><th>เงื่อนไข</th><th>แนวทางการดำเนินการ</th></tr></thead>
        <tbody>
          {RECS.map((r) => (
            <tr key={r.key}>
              <td><RecBadge rec={r.key} /></td>
              <td style={{ whiteSpace: "nowrap" }}>{r.when}</td>
              <td>{r.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** ตารางระดับความเสียหาย 4 ระดับ (ไฟล์ "dashboard คชจ.md") — เรียงจากไม่มีความเสียหายถึงระดับสูง ตามไฟล์ */
function LevelTable() {
  return (
    <table className="dz-tbl">
      <thead><tr><th>เงื่อนไข</th><th>ระดับความเสียหาย</th><th>ความหมาย</th><th>แนวทางการดำเนินการ</th></tr></thead>
      <tbody>
        {[...LEVELS].reverse().map((l) => (
          <tr key={l.key}>
            <td style={{ whiteSpace: "nowrap" }}>{l.when}</td>
            <td><span className={`dmg-lv ${l.key}`}>{l.label}</span></td>
            <td>{l.meaning}</td>
            <td>{l.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
        {/* ชื่อเส้นประตามไฟล์อยู่ในป้ายสี (เดิมเขียนบนเส้น — เส้น Damage Rate อยู่ชิดแกนล่าง ป้ายทับชื่อเดือน) */}
        <Legend {...legendProps} height={undefined} payload={[
          ...LINES.filter((l) => !hidden.includes(l.key)).map((l) => ({ value: l.label, type: "circle" as const, color: l.color, id: l.key })),
          ...(th.usable ? LINES.filter((l) => !hidden.includes(l.key) && th[l.p75] != null).map((l) => ({
            value: `${l.p75Label} ${pctTick(Math.round(th[l.p75]! * 1000) / 1000)}`, type: "plainline" as const,
            color: l.color, id: `p75-${l.key}`, payload: { strokeDasharray: "5 5" },
          })) : []),
        ]} />
        {band && (band[0] === band[1]
          ? <ReferenceLine x={band[0]} stroke={D.slate} strokeWidth={10} strokeOpacity={0.18} />
          : <ReferenceArea x1={band[0]} x2={band[1]} fill={D.slate} fillOpacity={0.12} />)}
        {LINES.map((l) => {
          const v = th[l.p75];
          return v == null || !th.usable || hidden.includes(l.key) ? null : (
            <ReferenceLine key={`p75-${l.key}`} y={v} stroke={l.color} strokeDasharray="5 5" strokeWidth={1.4}
              ifOverflow="extendDomain" />
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

interface KindBar {
  name: string; total: number; dmg: number; n: number; amt: number;
  /** % ของเที่ยวที่มีบิลเคลียร์ แยกประเภทรถ (รวม 100) */
  shares: Record<string, number>;
  [seg: string]: string | number | Record<string, number>;
}

/** ความสูงกล่องตามจำนวนแท่ง — 15 แท่งไม่เบียด */
const barsHeight = (n: number): number => Math.max(230, n * 30 + 80);
const yWidth = (names: string[]): number => Math.min(230, Math.max(70, names.reduce((m, x) => Math.max(m, x.length), 0) * 7.6 + 14));
/** แท่งหนาเท่ากันทั้งสองกราฟ */
const BAR_SIZE = 16;
/** ชื่อแกนนอน — ใต้ป้ายแกน ขนาด/สีเดียวกับป้ายแกนของโมเดล */
const xAxisLabel = (t: ChartTheme) => ({
  value: "% Damage Incidence Rate", position: "insideBottom" as const, offset: -10,
  fill: t.ink2, fontSize: 13, fontFamily: DFONT,
});

/** กล่อง tooltip ธีมเดียวกับกราฟอื่นของโมเดล (tooltipProps: พื้นเข้ม ตัวขาว มุมมน 10) */
function TipBox({ t, title, lines }: { t: ChartTheme; title: string; lines: React.ReactNode[] }) {
  const st = tooltipProps(t).contentStyle;
  return (
    <div style={{ ...st, color: "#fff", lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

/**
 * ท่อนของแท่งซ้อน — มุมมน BAR_RADIUS เฉพาะด้านนอกสุดของแท่ง (ท่อนแรก = ซ้าย · ท่อนท้าย = ขวา)
 * ท่อนกลางเป็นสี่เหลี่ยม ต่อกันเนียนเป็นแท่งเดียวปลายมนแบบกราฟอื่นของโมเดล
 */
function segPath(x: number, y: number, w: number, h: number, left: boolean, right: boolean): string {
  const r = Math.min(BAR_RADIUS, h / 2, w / (left && right ? 2 : 1));
  const rl = left ? r : 0, rr = right ? r : 0;
  return `M${x + rl},${y}H${x + w - rr}${rr ? `A${rr},${rr} 0 0 1 ${x + w},${y + rr}` : ""}V${y + h - rr}`
    + `${rr ? `A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}` : ""}H${x + rl}${rl ? `A${rl},${rl} 0 0 1 ${x},${y + h - rl}` : ""}`
    + `V${y + rl}${rl ? `A${rl},${rl} 0 0 1 ${x + rl},${y}` : ""}Z`;
}

/** แท่งนอน DIR ตามชนิดรถ — แกนนอน %DIR · แกนตั้ง ชนิดรถ · ท่อน = ประเภทรถ (สัดส่วนเที่ยวที่มีบิลเคลียร์) · % ท้ายแท่ง */
function KindBars({ data, series }: { data: KindBar[]; series: { key: string; label: string; color: string }[] }) {
  const t = useChartTheme();
  // ท่อนแรก/ท่อนท้ายที่มีค่าของแต่ละแถว — ใช้วาดมุมมนและวางตัวเลข
  const ends = data.map((r) => {
    const on = series.filter((s) => Number(r[s.key]) > 0).map((s) => s.key);
    return { first: on[0], last: on[on.length - 1] };
  });
  const tip = tooltipProps(t);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" barSize={BAR_SIZE} margin={{ top: 6, right: 46, left: 0, bottom: 22 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} type="number" tickFormatter={pctTick} label={xAxisLabel(t)} height={40} />
        <YAxis {...axisProps(t)} type="category" dataKey="name" width={yWidth(data.map((r) => r.name))} />
        <Tooltip cursor={tip.cursor} content={({ active, payload }) => {
          const r = active ? (payload?.[0]?.payload as KindBar | undefined) : undefined;
          return r ? <TipBox t={t} title={r.name} lines={[
            <>Damage Incidence Rate <b>{pct(r.total, 2)}</b></>,
            <>มีบิลเคลียร์ <b>{fmt(r.dmg)}</b> จาก {fmt(r.n)} เที่ยว</>,
            <>มูลค่า <b>{fmt(r.amt, 2)}</b> บาท</>,
            ...series.map((s) => <span key={s.label}>
              <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: s.color, marginRight: 6 }} />
              {s.label} <b>{pct(r.shares[s.label] ?? 0, 0)}</b></span>),
          ]} /> : null;
        }} />
        {/* ป้ายสีห่างจากชื่อแกนนอนลงมาอีกนิด (เจ้าของงานขอ 27 ก.ย. 2569) */}
        <Legend {...legendProps} wrapperStyle={{ ...legendProps.wrapperStyle, paddingTop: 14 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="ft" fill={s.color} {...anim}
            shape={(raw: unknown) => {
              const p = raw as { x?: number; y?: number; width?: number; height?: number; index?: number };
              const e = ends[p.index ?? 0];
              if (!p.width || p.width <= 0) return <g />;
              return <path d={segPath(p.x ?? 0, p.y ?? 0, p.width, p.height ?? 0, e?.first === s.key, e?.last === s.key)} fill={s.color} />;
            }}>
            <LabelList dataKey={s.key} content={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
              const i = p.index ?? 0;
              if (ends[i]?.last !== s.key) return null;
              return <text x={Number(p.x) + Number(p.width) + 6} y={Number(p.y) + Number(p.height) / 2} dy={4}
                fontSize={12} fontWeight={700} fontFamily={DFONT} fill={t.ink}>{pct(data[i]!.total, 1)}</text>;
            }} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** ตัวเลข % ในแท่ง — แท่งสั้นเกินวางไว้ท้ายแท่งแทน */
function InBarLabel(p: { x?: number; y?: number; width?: number; height?: number; value?: number; ink?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = p;
  const txt = pct(value, value < 1 ? 2 : 1);
  const inside = width > txt.length * 7 + 12;
  return (
    <text x={inside ? x + width - 7 : x + width + 6} y={y + height / 2} dy={4} fontSize={12} fontWeight={700} fontFamily={DFONT}
      textAnchor={inside ? "end" : "start"} fill={inside ? "#fff" : p.ink}>{txt}</text>
  );
}

/** แท่งนอน DIR ตามเส้นทาง — แท่งสีเดียว ตัวเลข % ในแท่ง · ป็อบอัพ = กี่เที่ยว */
function RouteBars({ data }: { data: { name: string; v: number; dmg: number; n: number }[] }) {
  const t = useChartTheme();
  const tip = tooltipProps(t);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" barSize={BAR_SIZE} margin={{ top: 6, right: 46, left: 0, bottom: 22 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} type="number" tickFormatter={pctTick} label={xAxisLabel(t)} />
        <YAxis {...axisProps(t)} type="category" dataKey="name" width={yWidth(data.map((r) => r.name))} />
        <Tooltip cursor={tip.cursor} content={({ active, payload }) => {
          const r = active ? (payload?.[0]?.payload as { name: string; v: number; dmg: number; n: number } | undefined) : undefined;
          return r ? <TipBox t={t} title={r.name} lines={[
            <>Damage Incidence Rate <b>{pct(r.v, 2)}</b></>,
            <>มีบิลเคลียร์ <b>{fmt(r.dmg)}</b> จาก {fmt(r.n)} เที่ยว</>,
          ]} /> : null;
        }} />
        <Bar dataKey="v" name="Damage Incidence Rate" fill={D.cyan} radius={BAR_RADIUS} {...anim}>
          <LabelList dataKey="v" content={<InBarLabel ink={t.ink} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
