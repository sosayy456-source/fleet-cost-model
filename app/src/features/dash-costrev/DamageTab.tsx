/**
 * แท็บ "Damage Rate" — ความเสียหายของสินค้าแยกตามเส้นทาง (หลักการคิดdamage.md)
 *
 *   Damage Rate %           = มูลค่าบิลเคลียร์ ÷ รายได้รวม          มุมมองการเงิน
 *   Damage Incidence Rate % = เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด        "มีปัญหาไหม"
 *   Damage Incident Rate    = รายการบิลเคลียร์ ÷ เที่ยวทั้งหมด       "ปัญหาเยอะแค่ไหนต่อเที่ยว"
 *
 * ★ ตัวหาร = "เที่ยววิ่งจริง" คือเที่ยวที่จับคู่บิลได้ **ไม่รวมเที่ยววิ่งเปล่า** (เจ้าของงานเคาะ 20 ก.ย. 2569)
 *   เที่ยวเปล่าไม่มีรายได้และไม่มีของให้เสียหาย ถ้านับเข้าไปตัวหารใหญ่เกินจริงแล้วทุกอัตราต่ำผิด
 *
 * กฎของเอกสารข้อ 4: ตัดข้อมูลย่อยระดับไหน ทั้งตัวเศษและตัวหารต้องตัดระดับเดียวกัน — ที่นี่ทุกค่า
 * มาจาก rows ชุดเดียวกันที่ผ่านตัวกรองแล้ว จึงเป็นระดับเดียวกันโดยอัตโนมัติ
 *
 * ★ มูลค่าความเสียหายมาจากบิลในไฟล์รายได้ (clrAmt/clrN) จึงมีเฉพาะเที่ยวที่จับคู่เลขที่ใบรายการได้
 *   (m = true) แท็บนี้จึงแสดงตัวเลขเฉพาะใน Executive Dashboard · หน้า "Dashboard รวม" ขึ้นข้อจำกัดแทน
 * ★ ไม่ใช้ธง clear จากไฟล์ต้นทุน — ธงนั้นบอกแค่ว่า "ใบนี้มีบิลเคลียร์" แต่ไม่มีมูลค่า และในชุดตัวอย่าง
 *   ยังไม่ตรงกับบิลจริงด้วย (ชุดตัวอย่าง 12 ไฟล์: ธง 125 ใบ แต่หาบิลเจอ 26 ใบ เพราะไฟล์รายได้ตัวอย่างถูกสุ่มมาบางส่วน)
 */
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DBar } from "../../lib/chart/dcharts";
import { anim, axisProps, gridProps, legendProps, tooltipProps } from "../../lib/chart/primitives";
import { D, useChartTheme } from "../../lib/chart/theme";
import { Hero, KC, Note, Pane, TableHead } from "../dash-fleet/parts";
import { BASE_F0, isFiltered, ListFF, MonthFF, SortTable, YearFF, duniq, fmt, monthLabel, passBase, pct, routeArrow, useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import type { BaseFilter, Col } from "./common";
import type { CostRevMode } from "./CostRevDash";
import type { Trip } from "../../lib/data/useCostRev";

/** เส้นทางที่เที่ยวน้อยกว่านี้ไม่เอาขึ้นกราฟอันดับ — ฐานน้อย % แกว่งจนอ่านผิด (ยังอยู่ในตารางครบ) */
const MIN_TRIPS_RANK = 5;
const TOP_ROUTES = 10;

/**
 * ป้ายแกน % ของ Damage Rate — ค่าปกติต่ำกว่า 1% (ชุดตัวอย่าง 0.044%) ถ้าปัดทศนิยมตายตัว
 * ขีดแกนจะกลายเป็น "0%" ทุกขีด จึงเลือกจำนวนทศนิยมตามขนาดของค่าเอง
 */
const pctTick = (v: number): string =>
  v === 0 ? "0%" : `${Number(v.toFixed(Math.abs(v) < 0.01 ? 4 : Math.abs(v) < 0.1 ? 3 : Math.abs(v) < 1 ? 2 : 1))}%`;

/** สามเส้นของกราฟแนวโน้ม — ทุกเส้นเป็นสเกล % เดียวกัน (Incident คูณ 100 มาแล้ว) */
const LINES = [
  { key: "Damage Rate %", color: D.rose },
  { key: "Damage Incidence Rate %", color: D.amber },
  { key: "Incident Rate %", color: D.teal },
] as const;

interface DmgRow {
  route: string;
  /** จำนวนเที่ยวทั้งหมดของเส้นทางนี้ — ตัวหารของสองอัตราหลัง */
  n: number;
  rev: number;
  /** มูลค่าบิลเคลียร์ · จำนวนรายการบิลเคลียร์ · จำนวนเที่ยวที่มีความเสียหายอย่างน้อย 1 รายการ */
  clrAmt: number; clrN: number; dmgTrips: number;
  /** null เมื่อไม่มีรายได้ — หารไม่ได้ ห้ามแสดงเป็น 0 */
  rate: number | null;
  incidence: number;
  incident: number;
}

/** รวมยอดตามคีย์ที่กำหนด — เขียนเองแทน groupBy() ของ common เพราะต้องมีคอลัมน์บิลเคลียร์ */
function aggregate(trips: Trip[], keyOf: (t: Trip) => string): DmgRow[] {
  const m = new Map<string, DmgRow>();
  for (const t of trips) {
    // ★ ไม่มี `if (!k) continue` แบบ groupBy() เพราะเที่ยวที่หลุดไปจะทำให้ผลรวมไม่ครบตามจำนวน
    //   เที่ยวที่จับคู่ได้ ซึ่งเป็นเงื่อนไขตรวจยอดของแท็บนี้ — keyOf ต้องคืนค่าที่ไม่ว่างเสมอ
    const k = keyOf(t);
    const a = m.get(k) ?? { route: k, n: 0, rev: 0, clrAmt: 0, clrN: 0, dmgTrips: 0, rate: null, incidence: 0, incident: 0 };
    a.n++; a.rev += t.rev; a.clrAmt += t.clrAmt; a.clrN += t.clrN;
    if (t.clrN > 0) a.dmgTrips++;
    m.set(k, a);
  }
  return [...m.values()].map((a) => ({
    ...a,
    rate: a.rev ? a.clrAmt / a.rev * 100 : null,
    incidence: a.n ? a.dmgTrips / a.n * 100 : 0,
    incident: a.n ? a.clrN / a.n : 0,
  }));
}

export default function DamageTab({ trips, mode, matchedTotal, isSample }: {
  trips: Trip[]; mode: CostRevMode; matchedTotal: number; isSample: boolean;
}) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  /** เส้นที่ถูกซ่อนในกราฟแนวโน้ม — กดที่ป้ายสีใต้กราฟ (ทาง A+C ที่เจ้าของงานเลือก) */
  const [hiddenLines, setHidden] = useState<string[]>([]);
  const toggleLine = (k: string) =>
    setHidden((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length < LINES.length - 1 ? [...p, k] : p));

  // เที่ยวที่จับคู่บิลได้ และไม่ใช่เที่ยววิ่งเปล่า — หน้า exec กรอง m มาให้แล้ว กรองซ้ำกันพลาด
  const base = useMemo(() => trips.filter((t) => t.m && !t.empty), [trips]);
  /** เที่ยวเปล่าที่จับคู่ได้ ตัดออกจากตัวหาร — โชว์ในหมายเหตุให้ตรวจยอดได้ */
  const emptyN = useMemo(() => trips.filter((t) => t.m && t.empty).length, [trips]);
  const rows = useMemo(() => base.filter((t) => passBase(t, f)), [base, f]);

  const byRoute = useMemo(() => aggregate(rows, (t) => t.rt || routeArrow(t)), [rows]);

  /** ยอดรวมภาพรวม — รวมจาก rows ตรง ๆ ไม่ใช่เฉลี่ยจากรายเส้นทาง (เฉลี่ยของอัตราไม่ใช่อัตรารวม) */
  const kpi = useMemo(() => {
    const n = rows.length;
    const rev = rows.reduce((s, t) => s + t.rev, 0);
    const clrAmt = rows.reduce((s, t) => s + t.clrAmt, 0);
    const clrN = rows.reduce((s, t) => s + t.clrN, 0);
    const dmgTrips = rows.filter((t) => t.clrN > 0).length;
    return { n, rev, clrAmt, clrN, dmgTrips,
             rate: rev ? clrAmt / rev * 100 : null,
             incidence: n ? dmgTrips / n * 100 : 0,
             incident: n ? clrN / n : 0 };
  }, [rows]);

  /** [กราฟขวา] แนวโน้มรายเดือน 3 เส้น — แสดงทุกเดือนทุกปีเสมอ ตัวกรองปี/เดือนไม่มีผล
      Incident Rate คูณ 100 ให้อยู่สเกลเดียวกับอีกสองเส้น = "ครั้งต่อ 100 เที่ยว" (ไม่ใช่ % จริง เกิน 100 ได้) */
  const monthly = useMemo(() => aggregate(
    base.filter((t) => passBase(t, f, { ignoreYear: true, ignoreMonth: true })), (t) => t.mo)
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((a) => ({
      mo: monthLabel(a.route),
      [LINES[0]!.key]: Math.round((a.rate ?? 0) * 1000) / 1000,
      [LINES[1]!.key]: Math.round(a.incidence * 100) / 100,
      [LINES[2]!.key]: Math.round(a.incident * 100 * 100) / 100,
    })), [base, f]);

  /** [กราฟซ้าย] อันดับเส้นทางตาม Damage Rate % — แท่งเดียวต่อเส้นทาง มีตัวกรองปีของกราฟเองที่มุมขวาบน
      ปีของกราฟซ้อนบนตัวกรองปีด้านบนอีกชั้น (ตัวเลือกจึงมีเฉพาะปีที่เหลือหลังกรองด้านบนแล้ว) */
  const [chartYear, setChartYear] = useState("");
  const chartYears = useMemo(() => [...new Set(rows.map((t) => String(t.y)))].sort(), [rows]);
  const topRate = useMemo(() => {
    const src = chartYear ? rows.filter((t) => String(t.y) === chartYear) : rows;
    return aggregate(src, (t) => t.rt || routeArrow(t))
      .filter((r) => r.n >= MIN_TRIPS_RANK && r.rate != null && r.rate > 0)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).slice(0, TOP_ROUTES)
      .map((r) => ({ name: r.route, v: Math.round((r.rate ?? 0) * 1000) / 1000 }));
  }, [rows, chartYear]);

  const cols = useMemo<Col<DmgRow>[]>(() => [
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "n", label: "จำนวนเที่ยวทั้งหมด", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้รวม", get: (r) => r.rev, num: true },
    { key: "clrAmt", label: "มูลค่าบิลเคลียร์", get: (r) => r.clrAmt, num: true,
      render: (r) => <span style={{ fontWeight: r.clrAmt ? 700 : 400, color: r.clrAmt ? "var(--red)" : undefined }}>{fmt(r.clrAmt, 2)}</span> },
    { key: "dmgTrips", label: "เที่ยวที่เสียหาย", get: (r) => r.dmgTrips, num: true },
    { key: "clrN", label: "รายการบิลเคลียร์", get: (r) => r.clrN, num: true },
    { key: "rate", label: "Damage Rate %", get: (r) => r.rate, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: dmgTone(r.rate) }}>{r.rate == null ? "–" : pct(r.rate, 3)}</span> },
    { key: "incidence", label: "Incidence Rate %", get: (r) => r.incidence, num: true,
      render: (r) => pct(r.incidence, 2) },
    { key: "incident", label: "Incident/เที่ยว", get: (r) => r.incident, num: true,
      render: (r) => fmt(r.incident, 4) },
  ], []);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "clrAmt", dir: -1 });

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

  const unfiltered = f.year === "" && f.month === "" && f.o === "" && f.de === "" && f.ft === "" && f.vk === "";
  const sumN = byRoute.reduce((s, r) => s + r.n, 0);
  /** ฐานที่ควรได้ = เที่ยวที่จับคู่บิลได้ ลบเที่ยววิ่งเปล่าที่ตัดออกจากตัวหาร */
  const expectedN = matchedTotal - emptyN;
  const balanced = sumN === expectedN;

  return (
    <>
      <FilterBar>
        <YearFF trips={base} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="จุดขึ้น" all="ทุกจุดขึ้น" value={f.o} onChange={set("o")} opts={duniq(base.map((t) => t.o))} />
        <ListFF label="จุดลง" all="ทุกจุดลง" value={f.de} onChange={set("de")} opts={duniq(base.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(base.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(base.map((t) => t.vk))} />
        <ClearFiltersBtn active={isFiltered(f, BASE_F0)} onClick={() => setF(BASE_F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        <div className="dz-heroes">
          <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.rev)} s="บาท · เฉพาะเที่ยวที่จับคู่ได้" />
          <Hero kind="loss" l="มูลค่าบิลเคลียร์" v={fmt(kpi.clrAmt, 2)} s="บาท · มูลค่าความเสียหาย" />
          <Hero kind="svc" l="Damage Rate" v={kpi.rate == null ? "–" : pct(kpi.rate, 3)} s="มูลค่าบิลเคลียร์ ÷ รายได้รวม" />
        </div>
        <div className="dz-cards">
          <KC dot={D.indigo} l="จำนวนเที่ยวทั้งหมด" v={fmt(kpi.n)} s="เที่ยว · ฐานของทุกอัตรา" />
          <KC dot={D.violet} l="จำนวนเส้นทาง" v={fmt(byRoute.length)} s="เส้นทาง · จุดขึ้น-จุดลง ไม่ซ้ำ" />
          <KC dot={D.rose} tone={kpi.dmgTrips ? "warn" : undefined} l="เที่ยวที่เสียหาย" v={fmt(kpi.dmgTrips)} s="เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" />
          <KC dot={D.orange} l="รายการบิลเคลียร์" v={fmt(kpi.clrN)} s="รายการ · เที่ยวเดียวมีได้หลายรายการ" />
          <KC dot={D.amber} tone={kpi.incidence > 0 ? "warn" : undefined} l="Damage Incidence Rate"
            v={pct(kpi.incidence, 2)} s="เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด" />
          <KC dot={D.teal} l="Damage Incident Rate" v={fmt(kpi.incident, 4)}
            s={`รายการ/เที่ยว · เท่ากับ ${fmt(kpi.incident * 100, 2)} ครั้งต่อ 100 เที่ยว`} />
        </div>
        <Note>
          รวม <b>{fmt(sumN)}</b> เที่ยว จาก <b>{fmt(byRoute.length)}</b> เส้นทาง
          {unfiltered && (balanced
            ? <> · ตรงกับเที่ยวที่จับคู่กับไฟล์รายได้ได้ {fmt(matchedTotal)} เที่ยว หักเที่ยววิ่งเปล่า {fmt(emptyN)} เที่ยว = {fmt(expectedN)} ✓</>
            : <b style={{ color: "var(--red)" }}> · ไม่ตรงกับฐานที่ควรได้ ({fmt(expectedN)} เที่ยว = จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)}) — มีเที่ยวตกหล่นจากการรวมยอด</b>)}
          {!unfiltered && <> · กรองอยู่ เทียบกับฐานทั้งหมด {fmt(expectedN)} เที่ยว (จับคู่ได้ {fmt(matchedTotal)} − วิ่งเปล่า {fmt(emptyN)})</>}
        </Note>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          {/* ซ้าย: อันดับเส้นทางตาม Damage Rate % · ตัวกรองปีของกราฟเองที่มุมขวาบน */}
          <div className="dz-cc">
            <TableHead title={`เส้นทางที่ความเสียหายสูงสุด · Damage Rate % · ${TOP_ROUTES} อันดับแรก`}>
              <ListFF label="ปี" all="ทุกปี" value={chartYear} onChange={setChartYear}
                opts={chartYears} labelOf={(y) => `พ.ศ. ${Number(y) + 543}`} />
            </TableHead>
            <div className="dz-box tall">
              {topRate.length
                ? <DBar data={topRate} xKey="name" horiz suffix="%" digits={3} valueTick={pctTick}
                    series={[{ key: "v", label: "Damage Rate %", color: D.rose }]} />
                : <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>
                    ไม่มีเส้นทางที่มีความเสียหายตามตัวกรองที่เลือก
                  </div>}
            </div>
          </div>

          {/* ขวา: แนวโน้มรายเดือน 3 เส้นซ้อนกัน · ปุ่มที่หัวการ์ดกดเปิด-ปิดทีละเส้น */}
          <div className="dz-cc">
            <TableHead title="แนวโน้มความเสียหายรายเดือน">
              <div className="dmg-lines" role="group" aria-label="เลือกเส้นที่แสดง">
                {LINES.map((l) => {
                  const on = !hiddenLines.includes(l.key);
                  return (
                    <button key={l.key} type="button" className={"dmg-line" + (on ? " on" : "")}
                      style={{ "--c": l.color } as React.CSSProperties} aria-pressed={on}
                      onClick={() => toggleLine(l.key)}>
                      <i />{l.key.replace(" %", "")}
                    </button>
                  );
                })}
              </div>
            </TableHead>
            <div className="dz-box tall">
              <TrendLines data={monthly} hidden={hiddenLines} />
            </div>
          </div>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>ความเสียหายรายเส้นทาง · คลิกหัวคอลัมน์เพื่อเรียง</h4>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
            rowKey={(r) => r.route} empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" />
        </div>
        <Note>
          ทุกอัตราคิดจากฐานของเส้นทางนั้นเอง ไม่ใช่ฐานรวมทั้งบริษัท ·
          <b> Damage Rate</b> = มูลค่าบิลเคลียร์ ÷ รายได้รวม ·
          <b> Incidence Rate</b> = เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด (นับเที่ยว ไม่นับซ้ำ) ·
          <b> Incident Rate</b> = รายการบิลเคลียร์ ÷ เที่ยวทั้งหมด (≥ Incidence เสมอ เพราะเที่ยวเดียวเสียหายได้หลายรายการ)
          {isSample && <b style={{ color: "var(--red)" }}> · ชุดข้อมูลตัวอย่างนี้สุ่มบิลมาบางส่วน ตัวเลขจึงต่ำกว่าความจริงมาก ให้ดูจากชุดข้อมูลจริง</b>}
        </Note>
      </Pane>
    </>
  );
}

/** สีตามระดับ Damage Rate — เทียบกับ 0.409% ที่เป็นค่าอ้างอิงในเอกสาร (เขียว < 0.5 · ส้ม < 1 · แดง ≥ 1) */
const dmgTone = (r: number | null): string | undefined =>
  r == null ? "var(--ink-faint)" : r === 0 ? undefined : r < 0.5 ? "var(--green)" : r < 1 ? "var(--orange-dark)" : "var(--red)";

/** กราฟเส้น 3 ตัวชี้วัด — ปุ่มเปิด-ปิดเส้นอยู่ที่หัวการ์ด · ป้ายสีใต้กราฟบอกชื่อเส้น เหลืออย่างน้อย 1 เส้นเสมอ */
function TrendLines({ data, hidden }: { data: Record<string, string | number>[]; hidden: string[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="mo" />
        <YAxis {...axisProps(t)} width={58} domain={[0, "auto"]} tickFormatter={pctTick} />
        <Tooltip {...tooltipProps(t, "%", 2)} />
        {/* ป้ายสีใต้กราฟบอกว่าเส้นไหนคืออะไร — เส้นที่ปิดจากปุ่มหัวการ์ดจะไม่ขึ้นในป้าย */}
        <Legend {...legendProps} />
        {LINES.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.key} stroke={l.color} strokeWidth={2.4}
            dot={false} activeDot={{ r: 5 }} connectNulls hide={hidden.includes(l.key)} {...anim} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
