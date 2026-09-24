/**
 * แท็บ "เที่ยววิ่งเปล่า" — ทำตาม docs/spec-เที่ยววิ่งเปล่า.md (ตกลงกับเจ้าของข้อมูล 17 ก.ย. 2569
 * · ปรับหน้าตารอบสองตาม `ออกแบบ Dashboard (1).pdf` 23 ก.ย. 2569)
 * เจ้าของกำหนดว่าห้ามแสดงอะไรเกินจากในเอกสาร — จะเพิ่มกราฟ/ตัวเลขต้องถามก่อน
 *
 *   เที่ยววิ่งเปล่า = t.empty (ETL ดูสองคอลัมน์รายได้ = 0 พร้อมกัน) · ห้ามใช้ t.rev === 0 แทน
 *   ★ ชุดเที่ยว = inProfitScope() (จับคู่รายได้ได้ + เที่ยววิ่งเปล่า) ชุดเดียวกับแท็บอื่น — เจ้าของงานเคาะ 24 ก.ย. 2569
 *     เดิม (22 ก.ย.) ใช้ทุกแถวในไฟล์ ตัวหารจึงรวมเที่ยวมีรายได้ที่จับคู่ไม่ได้ซึ่งหน้าอื่นไม่นับ
 *     % จึงต่ำกว่าเมื่อเทียบกับหน้าอื่น (ชุดตัวอย่างรวมทุกปี 2.58% → 6.44%) · เที่ยวเปล่ายังอยู่ครบทุกเที่ยว
 *   ทุก % = ต้นทุนเที่ยวเปล่า ÷ ต้นทุนของ "ทุกเที่ยว" (รวมเที่ยวเปล่า) ในขอบเขตเดียวกัน
 *
 *   KPI  การ์ด 2 ใบขนาดเท่ากัน: % ต้นทุนเที่ยวเปล่าของปีล่าสุด (เส้นแนวโน้มรายปีในการ์ด · ส่วนเปรียบเทียบข้างล่าง
 *        = "มูลค่ารถเที่ยวเปล่า (YTD ม.ค.–พ.ค. 69)" 3 บรรทัด: เฉลี่ย/เดือน · % ของต้นทุนวิ่งรวม · YoY ช่วงเดือนเดียวกัน
 *        ของปีก่อน — เจ้าของงานสั่ง 24 ก.ย. 2569 แทน "เทียบปีก่อน ± จุด" เดิม · lib/empty/ytd.ts)
 *        · มูลค่าต้นทุนเที่ยวเปล่า (จำนวนเที่ยวเปล่าอยู่ใต้ตัวเลขในการ์ดเดียวกัน)
 *   [1]  รายเดือน: แท่งเทา = ต้นทุนรวม · เส้น = % ต้นทุนเที่ยวเปล่า (แกนขวา) · ค่าเริ่มต้น "ทุกเส้นทาง"
 *        เลือกได้ทีละเส้นทาง · กดเดือน = ป็อบอัพรายการเที่ยววิ่งเปล่าของเดือนนั้น
 *   [2]  Top 10 เส้นทาง กรอบเดียว ปุ่มสลับ จำนวนเที่ยว ↔ ต้นทุน · กดแท่ง = ป็อบอัพรายการของเส้นทางนั้น
 *   [3]  ตารางทุกเส้นทางที่มีเที่ยวเปล่า (ไม่มีเกณฑ์ขั้นต่ำแล้ว — เกณฑ์ ≥ 20 เที่ยวเคยใช้คู่กับกราฟจุดที่ตัดออก)
 *   ตัดออก 23 ก.ย. 2569: กราฟ % รายปี · แท่ง 100% เปล่า vs มีรายได้ · กราฟจุดรายเส้นทาง
 *
 * ★ ในชุดตัวอย่าง เส้นทางที่มีเที่ยวเปล่า 28 จาก 29 เส้นทางเป็นเที่ยวเปล่าล้วน (เส้นทางตีรถกลับโดยเฉพาะ)
 *   ดูรายเส้นทางเส้น % จึงอยู่ที่ 100% เกือบทุกเดือน — ค่าเริ่มต้นของกราฟรายเดือนจึงเป็นภาพรวมทุกเส้นทาง
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DBar } from "../../lib/chart/dcharts";
import { BAR_RADIUS, anim, axisProps, gridProps, legendProps } from "../../lib/chart/primitives";
import { D, DFONT, fmtShort, useChartTheme } from "../../lib/chart/theme";
import { thDateSafe } from "../../lib/record/date";
import { Hero, Note, Pane } from "../dash-fleet/parts";
import { BASE_F0, isFiltered, ListFF, MonthFF, SortTable, YearFF, duniq, fmt, monthLabel, passBase, pct,
         useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import type { BaseFilter, Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";
import { emptyYtd, prevYY, ytdLabel, ytdMonths } from "../../lib/empty/ytd";
import type { EmptyYtd } from "../../lib/empty/ytd";

const TOP_N = 10;

const pctOf = (a: number, b: number): number => (b ? a / b * 100 : 0);
/** ป้ายแกน % — ภาพรวมบริษัทอยู่ราว 2–3% ปัดเป็นจำนวนเต็มแล้วทุกขีดจะซ้ำกัน */
const pctTick = (v: number): string => `${v < 10 ? Number(v.toFixed(1)) : Math.round(v)}%`;
const beYear = (y: number | string): number => Number(y) + 543;
const sumCost = (xs: Trip[]): number => xs.reduce((s, t) => s + t.cost, 0);

/** เฉลี่ยต่อเดือน — หลักล้านเขียนเป็น "4.83 ล้านบาท" ตามตัวอย่างของเจ้าของงาน ต่ำกว่านั้นเขียนเต็ม */
const perMonth = (v: number): string =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)} ล้านบาท/เดือน` : `${fmt(Math.round(v))} บาท/เดือน`;

/** หัวข้อ + 3 บรรทัดใต้การ์ดแรก — เฉลี่ย/เดือน · % ของต้นทุนวิ่งรวม · YoY ช่วงเดือนเดียวกัน */
function YtdLines({ r, pickedMonth }: { r: EmptyYtd; pickedMonth: boolean }) {
  const py = prevYY(r.year);
  const yoy = r.yoy != null
    ? `${r.yoy > 0 ? "+" : r.yoy < 0 ? "−" : "±"}${Math.abs(r.yoy).toFixed(1)}%`
    : r.prevEmpty == null ? `ไม่มีข้อมูลปี ${py} ช่วงเดียวกัน` : `ปี ${py} ช่วงเดียวกันไม่มีเที่ยวเปล่า`;
  return (
    <span className="em-ytd">
      <b>มูลค่ารถเที่ยวเปล่า ({ytdLabel(r.year, r.months, pickedMonth)})</b>
      <span>{perMonth(r.avgPerMonth)}</span>
      <span>{r.share == null ? "–" : pct(r.share)} ของต้นทุนวิ่งรวม</span>
      <span>เทียบ YoY ({py}): {yoy}</span>
    </span>
  );
}

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

/** ขอบเขตของป็อบอัพ — ทุกเที่ยวในขอบเขต (ใช้คิดต้นทุนรวม/%) รายการในตารางเป็นเฉพาะเที่ยวเปล่า */
interface Detail { title: string; scope: Trip[] }

export default function EmptyTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const rows = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);
  const [detail, setDetail] = useState<Detail | null>(null);

  /* ---------- KPI ---------- */
  const empties = useMemo(() => rows.filter((t) => t.empty), [rows]);
  /**
   * % รายปี ใช้ทุกตัวกรองยกเว้นปี — การ์ดต้องเทียบกับปีก่อนและวาดเส้นแนวโน้มได้แม้กรองปีอยู่
   * ปีที่การ์ดโชว์ = ปีที่กรอง ถ้าไม่กรองคือปีล่าสุดที่มีข้อมูล
   */
  const yearShare = useMemo(() => {
    const m = new Map<number, { cost: number; empty: number }>();
    for (const t of trips) {
      if (!passBase(t, f, { ignoreYear: true })) continue;
      const a = m.get(t.y) ?? { cost: 0, empty: 0 };
      a.cost += t.cost;
      if (t.empty) a.empty += t.cost;
      m.set(t.y, a);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
      .map(([y, a]) => ({ y, share: Math.round(pctOf(a.empty, a.cost) * 100) / 100 }));
  }, [trips, f]);
  const focusY = f.year ? Number(f.year) : yearShare[yearShare.length - 1]?.y;
  const focusIdx = yearShare.findIndex((x) => x.y === focusY);
  const focus = yearShare[focusIdx];
  /**
   * ส่วนเปรียบเทียบใต้การ์ดแรก (เจ้าของงานสั่ง 24 ก.ย. 2569 — แทนบรรทัด "เทียบปีก่อน ± จุด" เดิม)
   * มูลค่าเที่ยวเปล่าช่วง YTD ของปีที่การ์ดโชว์ เทียบปีก่อนหน้า **ช่วงเดือนเดียวกัน** · สูตรอยู่ใน lib/empty/ytd.ts
   * ป้าย "YTD ม.ค.–พ.ค." บอกเองว่าปีนั้นยังไม่เต็มปี (แทนข้อความ "ปีนี้ยังไม่เต็มปี" เดิม)
   */
  const ytd = useMemo(() => {
    if (focusY == null) return null;
    const months = ytdMonths(trips, focusY, f.month);
    return emptyYtd(trips.filter((t) => passBase(t, f, { ignoreYear: true })), focusY, months);
  }, [trips, f, focusY]);
  const scope = f.year ? `ปี พ.ศ. ${beYear(f.year)}` : `รวม ${yearShare.length} ปี`;

  /* ---------- [1] รายเดือน ---------- */
  const routes = useMemo(() => byRoute(rows), [rows]);
  const emptyRoutes = useMemo(() => routes.filter((r) => r.emptyN > 0)
    .sort((a, b) => b.emptyCost - a.emptyCost), [routes]);
  const [route, setRoute] = useState("");       // "" = ทุกเส้นทาง
  const curRoute = emptyRoutes.some((r) => r.route === route) ? route : "";
  const inRoute = useMemo(() => (curRoute ? rows.filter((t) => t.rt === curRoute) : rows), [rows, curRoute]);
  const monthly = useMemo(() => {
    const acc = new Map<string, { cost: number; empty: number; n: number; emptyN: number }>();
    for (const t of inRoute) {
      const a = acc.get(t.mo) ?? { cost: 0, empty: 0, n: 0, emptyN: 0 };
      a.cost += t.cost; a.n++;
      if (t.empty) { a.empty += t.cost; a.emptyN++; }
      acc.set(t.mo, a);
    }
    // แกนเวลาเป็นเดือนของทั้งขอบเขตที่กรอง — เดือนที่เส้นทางนั้นไม่มีเที่ยวเลยเว้นว่าง ไม่ใช่ 0%
    return [...new Set(rows.map((t) => t.mo))].sort().map((mo) => {
      const a = acc.get(mo);
      return {
        key: mo, mo: monthLabel(mo),
        cost: a ? Math.round(a.cost) : null,
        share: a && a.cost ? Math.round(pctOf(a.empty, a.cost) * 100) / 100 : null,
        empty: a ? Math.round(a.empty) : 0,
        n: a?.n ?? 0, emptyN: a?.emptyN ?? 0,
      };
    });
  }, [rows, inRoute]);
  const openMonth = (mo: string) => setDetail({
    title: `${curRoute || "ทุกเส้นทาง"} · ${monthLabel(mo)}`,
    scope: inRoute.filter((t) => t.mo === mo),
  });

  /* ---------- [2] Top 10 ---------- */
  const [topView, setTopView] = useState<"n" | "cost">("n");
  const top = useMemo(() => [...emptyRoutes]
    .sort((a, b) => (topView === "n" ? b.emptyN - a.emptyN || b.emptyCost - a.emptyCost : b.emptyCost - a.emptyCost))
    .slice(0, TOP_N), [emptyRoutes, topView]);
  const topData = useMemo(() => top.map((r) => ({
    name: r.route, v: topView === "n" ? r.emptyN : Math.round(r.emptyCost),
  })), [top, topView]);
  const openRoute = (rt: string) => setDetail({ title: rt, scope: rows.filter((t) => t.rt === rt) });

  /* ---------- [3] ตาราง ---------- */
  const cols = useMemo<Col<RouteAgg>[]>(() => [
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "emptyN", label: "เที่ยวเปล่า", get: (r) => r.emptyN, num: true },
    { key: "n", label: "เที่ยวรวม", get: (r) => r.n, num: true },
    { key: "emptyCost", label: "ต้นทุนเที่ยวเปล่า", get: (r) => r.emptyCost, num: true },
    { key: "cost", label: "ต้นทุนรวมของเส้นทาง", get: (r) => r.cost, num: true },
    { key: "share", label: "% เที่ยวเปล่า", get: (r) => r.share, num: true,
      render: (r) => <b style={{ color: "var(--d-rose-d)" }}>{pct(r.share)}</b> },
  ], []);
  const { sorted, sort, toggle } = useSort(emptyRoutes, cols, { key: "emptyCost", dir: -1 });

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
        {/* KPI — 2 ใบขนาดเท่ากัน · เส้นในการ์ดแรกเป็น % รายปีจริง ไม่ใช่ลายตกแต่ง */}
        <div className="dz-heroes em-heroes">
          <Hero kind="loss"
            l={focusY != null ? `% ต้นทุนเที่ยวเปล่า · ปี พ.ศ. ${beYear(focusY)}` : "% ต้นทุนเที่ยวเปล่า"}
            v={focus ? pct(focus.share) : "–"}
            trend={yearShare.length >= 2 ? yearShare.map((x) => x.share) : undefined}
            s={ytd && <YtdLines r={ytd} pickedMonth={!!f.month} />} />
          <Hero kind="cost" l={`มูลค่าต้นทุนเที่ยวเปล่า · ${scope}`} v={fmt(sumCost(empties))} unit="บาท"
            s={<><b>{fmt(empties.length)}</b> เที่ยววิ่งเปล่า · จาก {fmt(rows.length)} เที่ยว</>} />
        </div>

        {/* [1] รายเดือน */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>% ต้นทุนเที่ยวเปล่า ÷ ต้นทุนวิ่งรถทั้งหมด · รายเดือน</h4>
              <p>แท่ง = ต้นทุนรวม · เส้น = % ต้นทุนเที่ยวเปล่า · กดเดือนเพื่อดูรายการเที่ยววิ่งเปล่า</p>
            </div>
            <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={curRoute} onChange={setRoute}
              opts={emptyRoutes.map((r) => r.route)} />
          </div>
          <div className="dz-box tall">
            {monthly.length ? <MonthChart data={monthly} onPick={openMonth} /> : <NoData />}
          </div>
        </div>

        {/* [2] Top 10 — กรอบเดียว ปุ่มสลับ */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>
                {topView === "n"
                  ? `Top ${TOP_N} เส้นทางที่วิ่งเที่ยวเปล่าบ่อยสุด · จำนวนเที่ยว`
                  : `Top ${TOP_N} เส้นทางที่ต้นทุนเที่ยวเปล่าสูงสุด · บาท`}
              </h4>
              <p>กดแท่งเพื่อดูรายการเที่ยววิ่งเปล่าของเส้นทางนั้น</p>
            </div>
            <div className="cp-seg" role="group" aria-label="เลือกมุมมอง">
              <button type="button" className={topView === "n" ? "on" : ""} onClick={() => setTopView("n")}>จำนวนเที่ยว</button>
              <button type="button" className={topView === "cost" ? "on" : ""} onClick={() => setTopView("cost")}>ต้นทุน (บาท)</button>
            </div>
          </div>
          <div className="dz-box tall">
            {topData.length
              ? <DBar key={topView} data={topData} xKey="name" horiz
                  suffix={topView === "n" ? " เที่ยว" : " บาท"}
                  series={[topView === "n"
                    ? { key: "v", label: "เที่ยวเปล่า", color: D.amber }
                    : { key: "v", label: "ต้นทุนเที่ยวเปล่า", color: D.rose }]}
                  // ชี้แท่งแล้วเห็นอีกมุมหนึ่งด้วย (เจ้าของงานสั่ง): จำนวนเที่ยว → เห็นเงิน · เงิน → เห็นจำนวนเที่ยว
                  tooltipExtra={(i) => {
                    const r = top[i];
                    if (!r) return null;
                    return topView === "n" ? `ต้นทุน ${fmt(r.emptyCost)} บาท` : `${fmt(r.emptyN)} เที่ยว`;
                  }}
                  onBarClick={(i) => { const r = top[i]; if (r) openRoute(r.route); }} />
              : <NoData />}
          </div>
        </div>

        {/* [3] ตาราง */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>ต้นทุนเที่ยวเปล่ารายเส้นทาง · คลิกหัวคอลัมน์เพื่อเรียง</h4>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
            rowKey={(r) => r.route} empty="ไม่มีเส้นทางที่มีเที่ยววิ่งเปล่าตามตัวกรองที่เลือก" />
        </div>

        <Note>
          เที่ยววิ่งเปล่า = เที่ยวที่ ราคารวมจากรายได้ และ ค่าบรรทุกทั้งใบรายการ เป็น 0 ทั้งคู่ (ไม่จำกัดประเภทใบรายการ) ·
          ต้นทุนวิ่งรถทั้งหมด = ต้นทุนของทุกเที่ยว รวมเที่ยวเปล่าด้วย · เส้นทาง = จุดขึ้น-จุดลง ·
          % เที่ยวเปล่า = ต้นทุนเที่ยวเปล่า ÷ ต้นทุนรวมของเส้นทางนั้น
        </Note>
      </Pane>

      {detail && <EmptyTripsModal detail={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

const NoData = () => (
  <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>ไม่มีข้อมูลตามตัวกรองที่เลือก</div>
);

interface MonthRow { key: string; mo: string; cost: number | null; share: number | null; empty: number; n: number; emptyN: number }

/**
 * แท่งเทา = ต้นทุนรวม (แกนซ้าย บาท) · เส้น = % ต้นทุนเที่ยวเปล่า (แกนขวา)
 * กดที่ไหนก็ได้ในคอลัมน์ของเดือน (แท่งหรือจุด) = เปิดป็อบอัพของเดือนนั้น
 */
function MonthChart({ data, onPick }: { data: MonthRow[]; onPick: (mo: string) => void }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} style={{ cursor: "pointer" }}
        onClick={(s: { activeTooltipIndex?: number | string | null } | null) => {
          const i = Number(s?.activeTooltipIndex);
          const row = Number.isInteger(i) ? data[i] : undefined;
          if (row) onPick(row.key);
        }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="mo" />
        <YAxis {...axisProps(t)} yAxisId="c" width={62} tickFormatter={fmtShort} />
        <YAxis {...axisProps(t)} yAxisId="p" orientation="right" width={52} domain={[0, "auto"]} tickFormatter={pctTick} />
        <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.6 }} content={<MonthTip />} />
        <Legend {...legendProps} />
        <Bar yAxisId="c" dataKey="cost" name="ต้นทุนรวม (บาท)" fill={D.slate} fillOpacity={0.55} radius={BAR_RADIUS} {...anim} />
        <Line yAxisId="p" type="monotone" dataKey="share" name="% ต้นทุนเที่ยวเปล่า" stroke={D.rose} strokeWidth={2.4}
          dot={{ r: 3, fill: D.rose, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls {...anim} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** tooltip รายเดือน — ต้นทุนเที่ยวเปล่า + ต้นทุนรวมของเดือนนั้นเป็นบาท (เจ้าของงานสั่ง) */
function MonthTip({ active, payload }: { active?: boolean; payload?: { payload: MonthRow }[] }) {
  const p = active && payload?.[0]?.payload;
  if (!p) return null;
  return (
    <div style={{ background: "#17161A", color: "#fff", borderRadius: 10, padding: 11, fontFamily: DFONT, fontSize: 14,
                  boxShadow: "0 8px 24px -8px rgba(0,0,0,.35)", lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.mo}</div>
      {p.cost == null ? <div>ไม่มีเที่ยววิ่งในเดือนนี้</div> : <>
        <div>ต้นทุนเที่ยวเปล่า <b>{fmt(p.empty)}</b> บาท ({fmt(p.emptyN)} เที่ยว)</div>
        <div>ต้นทุนรวม <b>{fmt(p.cost)}</b> บาท ({fmt(p.n)} เที่ยว)</div>
        <div>% ต้นทุนเที่ยวเปล่า <b>{p.share == null ? "–" : pct(p.share, 2)}</b></div>
        <div style={{ opacity: .7, fontSize: 12.5, marginTop: 2 }}>กดเพื่อดูรายการเที่ยววิ่งเปล่า</div>
      </>}
    </div>
  );
}

/**
 * ป็อบอัพรายการเที่ยววิ่งเปล่าของเดือน/เส้นทางที่กด — หัวป็อบอัพสรุปจากทุกเที่ยวในขอบเขต
 * ★ portal ไป #view-dash (ไม่ใช่ body) เหตุผลเดียวกับ dash-demo/TripsModal: โทเคนสีของแดชบอร์ดอยู่ใต้ #view-dash
 */
function EmptyTripsModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const list = useMemo(() => detail.scope.filter((t) => t.empty), [detail]);
  const emptyCost = sumCost(list);
  const total = sumCost(detail.scope);
  const cols = useMemo<Col<Trip>[]>(() => [
    { key: "d", label: "วันที่ปล่อยรถ", get: (t) => t.d, render: (t) => thDateSafe(t.d) },
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
    { key: "pl", label: "ทะเบียนรถ", get: (t) => t.pl || "–" },
    { key: "vk", label: "ชนิดรถ", get: (t) => t.vk || "–" },
    { key: "ft", label: "ประเภทรถ", get: (t) => t.ft || "–" },
    { key: "t", label: "ประเภทใบรายการ", get: (t) => t.t || "–" },
    { key: "rt", label: "เส้นทาง", get: (t) => t.rt || "–" },
    { key: "cost", label: "ต้นทุน", get: (t) => t.cost, num: true },
  ], []);
  const { sorted, sort, toggle } = useSort(list, cols, { key: "cost", dir: -1 });

  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`เที่ยววิ่งเปล่า ${detail.title}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">เที่ยววิ่งเปล่า · {detail.title}</div>
            <p>
              {fmt(list.length)} เที่ยว · ต้นทุนเที่ยวเปล่า <b>{fmt(emptyCost)}</b> บาท ·
              ต้นทุนรวม {fmt(total)} บาท ({fmt(detail.scope.length)} เที่ยว) ·
              % เที่ยวเปล่า <b>{pct(pctOf(emptyCost, total))}</b>
            </p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(t, i) => `${t.id}-${i}`}
            empty="ไม่มีเที่ยววิ่งเปล่าในช่วงนี้" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
