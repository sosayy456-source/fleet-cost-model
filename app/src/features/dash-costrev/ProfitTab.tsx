/**
 * แท็บ "กำไรรายเที่ยว" — สเปกส่วนที่ 2 (การใช้ประโยชน์กองรถและกำไรระดับเที่ยววิ่ง.md)
 *
 *   2.1 ตัวกรอง  ปี · ต้นทาง–ปลายทาง · ประเภทรถ/ชนิดรถ
 *   2.2 KPI      รายได้ ต้นทุน กำไร %margin จำนวนเที่ยว %เที่ยวขาดทุน
 *   2.3 VISUAL-05 เส้น 3 เส้น รายเดือนตลอดทุกปี (ไม่ใช้ตัวกรองปี เพราะสเปกให้เห็นทั้ง 3 ปีเทียบกัน)
 *       VISUAL-06 ฮิสโทแกรมอัตรากำไร · VISUAL-07/08 Top 5 เส้นทางกำไร/ขาดทุน
 *   2.4 VISUAL-09 5 กลุ่มค่าใช้จ่ายหลัก (น้ำมัน เบี้ยเลี้ยง ค่าธรรมเนียม ค่าซ่อม ค่าเสื่อม · ไม่รวมค่าเช่า)
 *       VISUAL-10 ต้นทุนเฉลี่ยตามชนิดรถ สลับ ต่อเที่ยว / ต่อกม. (กม.จาก routes.json เฉพาะที่จับคู่ได้)
 *       ตารางรายเที่ยว (TripTable.tsx) · ตารางกลุ่มบริการที่ปันต้นทุนวิธี ค (ServiceTable.tsx · ข้อมูล svc.json)
 *   2.5 ตารางสรุป เส้นทาง × กลุ่มบริการ × ชนิดรถ + สัดส่วนรถบริษัท/รถร่วม และคำแนะนำ (SummaryTable.tsx)
 */
import { useMemo, useState } from "react";
import { DBar, DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { CC, Hero, Note, Pane, TableHead } from "../dash-fleet/parts";
import { BASE_F0, isFiltered, ListFF, Meter, MonthFF, YearFF, duniq, fmt, groupBy, marginOf, monthLabel,
         passBase, pct, signed } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import SummaryTable from "./SummaryTable";
import ServiceTable from "./ServiceTable";
import TripTable from "./TripTable";
import type { BaseFilter } from "./common";
import type { SvcAlloc, Trip } from "../../lib/data/useCostRev";

/** ช่วงอัตรากำไรของฮิสโทแกรม — ช่วงละ 10% ปลายเปิดสองข้าง */
const BUCKETS: [number, number, string][] = [
  [-Infinity, -20, "< −20%"], [-20, -10, "−20…−10%"], [-10, 0, "−10…0%"],
  [0, 10, "0–10%"], [10, 20, "10–20%"], [20, 30, "20–30%"], [30, 40, "30–40%"], [40, Infinity, "≥ 40%"],
];
const BUCKET_COLORS = [D.rose, D.rose, D.orange, D.amber, D.teal, D.emeraldLight, D.emerald, D.emerald];

const COST_GROUPS: { key: keyof Trip; label: string; color: string }[] = [
  { key: "fuel", label: "ค่าน้ำมัน", color: D.indigo },
  { key: "allow", label: "ค่าเบี้ยเลี้ยง", color: D.violet },
  { key: "fee", label: "ค่าธรรมเนียม", color: D.teal },
  { key: "repair", label: "ค่าซ่อม", color: D.amber },
  { key: "dep", label: "ค่าเสื่อม", color: D.slateDeep },
];

/** จำนวนจุดของเส้นแนวโน้มในการ์ดเด่น — 12 เดือนล่าสุด (ดีไซน์ต้องการ 8–12 จุด) */
const TREND_POINTS = 12;

export default function ProfitTab({ trips, fileRows, svc }: {
  trips: Trip[];
  /** ต้นทุน/รายได้ที่ปันเข้ากลุ่มบริการ — null = ETL รุ่นเก่ายังไม่มี svc.json ซ่อนตารางกลุ่มบริการ */
  svc: SvcAlloc | null;
  /** จำนวนเที่ยวทั้งหมดในไฟล์ (manifest.rows) — ฐานของแถบ "จำนวนเที่ยว" */
  fileRows: number;
}) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [perKm, setPerKm] = useState(false);
  /** ตัวกรองเฉพาะแท็บนี้ — จับคู่กับรายได้จริง · ผลประกอบการ (กำไร = ไม่ติดลบ ตรงกับนิยามเที่ยวขาดทุนของ KPI) */
  const [matched, setMatched] = useState("");
  const [outcome, setOutcome] = useState("");
  /**
   * ตัวกรองจับคู่มีความหมายเฉพาะ Dashboard รวม — Executive Dashboard มีแค่เที่ยวจับคู่ได้ + เที่ยววิ่งเปล่า
   * ★ ดูเฉพาะเที่ยวที่ **มีรายได้** แต่จับคู่ไม่ได้ ไม่งั้นเที่ยวเปล่า (m = false เสมอ) จะทำให้ตัวกรองโผล่ใน exec
   *   แล้วตัวเลือก "จับคู่ไม่ได้" กลายเป็นเที่ยวเปล่าล้วน ชวนเข้าใจผิด
   */
  const hasBoth = useMemo(() => trips.some((t) => t.m) && trips.some((t) => !t.m && !t.empty), [trips]);

  const rows = useMemo(() => trips.filter((t) => passBase(t, f)
    && (!matched || (matched === "m") === t.m)
    && (!outcome || (outcome === "profit") === (t.profit >= 0))), [trips, f, matched, outcome]);

  const kpi = useMemo(() => {
    const rev = rows.reduce((s, t) => s + t.rev, 0);
    const cost = rows.reduce((s, t) => s + t.cost, 0);
    const loss = rows.filter((t) => t.profit < 0).length;
    return { rev, cost, profit: rev - cost, margin: rev ? (rev - cost) / rev * 100 : 0,
             loss, n: rows.length, lossPct: rows.length ? loss / rows.length * 100 : 0 };
  }, [rows]);

  /** VISUAL-05 — ทุกเดือนของทุกปี ตัวกรองอื่นใช้ แต่ไม่ใช้ตัวกรองปี */
  const monthly = useMemo(() => {
    const by = groupBy(trips.filter((t) => passBase(t, f, { ignoreYear: true, ignoreMonth: true })
      && (!matched || (matched === "m") === t.m)
      && (!outcome || (outcome === "profit") === (t.profit >= 0))), (t) => t.mo)
      .sort((a, b) => a.key.localeCompare(b.key));
    return by.map((a) => ({ mo: monthLabel(a.key), รายได้: Math.round(a.rev), ต้นทุน: Math.round(a.cost), กำไร: Math.round(a.profit) }));
  }, [trips, f, matched, outcome]);

  /** เส้นแนวโน้มในการ์ดเด่น — ชุดเดียวกับกราฟ VISUAL-05 ตัดเหลือ 12 เดือนล่าสุด */
  const trend = useMemo(() => {
    const last = monthly.slice(-TREND_POINTS);
    return {
      rev: last.map((r) => r.รายได้),
      cost: last.map((r) => r.ต้นทุน),
      profit: last.map((r) => r.กำไร),
    };
  }, [monthly]);

  /** VISUAL-06 */
  const hist = useMemo(() => {
    const ms = rows.map(marginOf).filter((m): m is number => m != null);
    return BUCKETS.map(([lo, hi, label]) => ({ label, n: ms.filter((m) => m >= lo && m < hi).length }));
  }, [rows]);

  /** VISUAL-07 / 08 — กำไรรวมต่อเส้นทาง */
  const byRoute = useMemo(() => groupBy(rows, (t) => t.rt), [rows]);
  const top5 = useMemo(() => [...byRoute].sort((a, b) => b.profit - a.profit).slice(0, 5)
    .map((a) => ({ name: a.key, v: Math.round(a.profit) })), [byRoute]);
  const bottom5 = useMemo(() => [...byRoute].filter((a) => a.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 5)
    .map((a) => ({ name: a.key, v: Math.round(a.profit) })), [byRoute]);

  /** VISUAL-09 */
  const costGroups = useMemo(() => COST_GROUPS.map((g) => ({
    label: g.label, v: Math.round(rows.reduce((s, t) => s + (t[g.key] as number), 0)) })), [rows]);
  const groupSum = costGroups.reduce((s, g) => s + g.v, 0);

  /** VISUAL-10 — ต่อเที่ยวใช้ทุกเที่ยว · ต่อกม. ใช้เฉพาะเที่ยวที่รู้ระยะทาง */
  const byKind = useMemo(() => groupBy(rows, (t) => t.vk).map((a) => ({
    name: a.key,
    perTrip: Math.round(a.cost / a.n),
    perKm: a.km ? Math.round(rows.filter((t) => t.vk === a.key && t.km != null).reduce((s, t) => s + t.cost, 0) / a.km * 100) / 100 : 0,
    kmPct: a.n ? Math.round(a.kmTrips / a.n * 100) : 0,
  })).sort((a, b) => (perKm ? b.perKm - a.perKm : b.perTrip - a.perTrip)), [rows, perKm]);
  const kmCoverage = rows.length ? Math.round(rows.filter((t) => t.km != null).length / rows.length * 100) : 0;

  return (
    <>
      <FilterBar>
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(trips.map((t) => t.vk))} />
        {hasBoth && (
          <ListFF label="ข้อมูล" all="ทั้งหมด" value={matched} onChange={setMatched} opts={["m", "nm"]}
            labelOf={(o) => (o === "m" ? "จับคู่ได้" : "จับคู่ไม่ได้")} />
        )}
        <ListFF label="ผลประกอบการ" all="ทั้งหมด" value={outcome} onChange={setOutcome} opts={["profit", "loss"]}
          labelOf={(o) => (o === "profit" ? "กำไร" : "ขาดทุน")} />
        <ClearFiltersBtn active={isFiltered(f, BASE_F0) || !!matched || !!outcome}
          onClick={() => { setF(BASE_F0); setMatched(""); setOutcome(""); }} />
      </FilterBar>

      <Pane deps={[rows]}>
        <div className="dz-heroes">
          <Hero kind="rev" l="รายได้" v={fmt(kpi.rev)} unit="บาท" s="รายได้ – ต้นทุน = กำไร" trend={trend.rev} />
          <Hero kind="cost" l="ต้นทุน" v={fmt(kpi.cost)} unit="บาท" trend={trend.cost} />
          <Hero kind={kpi.profit < 0 ? "loss" : "profit"} l="กำไร" v={signed(kpi.profit)} unit="บาท" trend={trend.profit} />
        </div>
        <div className="dz-cards three">
          <Meter dot={D.violet} bar={kpi.margin < 0 ? D.rose : D.emerald} tone={kpi.margin < 0 ? "bad" : "good"}
            l="%margin" v={pct(kpi.margin)} s="กำไร ÷ รายได้" fill={kpi.margin} />
          <Meter dot={D.indigo} l="จำนวนเที่ยว" v={fmt(kpi.n)}
            s={`เที่ยว · จาก ${fmt(fileRows)} เที่ยวในไฟล์`} fill={fileRows ? kpi.n / fileRows * 100 : 0} />
          <Meter dot={D.rose} tone={kpi.lossPct > 0 ? "warn" : undefined} l="%เที่ยวที่ขาดทุน" v={pct(kpi.lossPct)}
            s={`${fmt(kpi.loss)} เที่ยว · เที่ยวขาดทุน ÷ เที่ยวทั้งหมด`} fill={kpi.lossPct} />
        </div>

        {/* [VISUAL-05] */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>เปรียบเทียบ รายได้ / ต้นทุน / กำไร · รายเดือนทุกปี</h4>
          <div className="dz-box tall">
            <DLine data={monthly} xKey="mo" series={[
              { key: "รายได้", label: "รายได้", color: D.indigo },
              { key: "ต้นทุน", label: "ต้นทุน", color: D.rose },
              { key: "กำไร", label: "กำไร", color: D.emeraldLight },
            ]} />
          </div>
          <Note>กราฟนี้แสดงทุกเดือนตลอดทุกปีเสมอเพื่อเทียบแนวโน้มปีต่อปี — ตัวกรอง "ปี" และ "เดือน" ไม่มีผลกับกราฟนี้ ตัวกรองอื่นมีผล</Note>
        </div>

        {/* [VISUAL-06] */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>การกระจายตัวของอัตรากำไร · จำนวนเที่ยวในแต่ละช่วง %margin</h4>
          <div className="dz-box">
            <DBar data={hist} xKey="label" suffix=" เที่ยว" colors={BUCKET_COLORS}
              series={[{ key: "n", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </div>
          <Note>นับเฉพาะเที่ยวที่มีรายได้ (เที่ยวเปล่าคำนวณ %margin ไม่ได้)</Note>
        </div>

        {/* [VISUAL-07] [VISUAL-08] */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="5 เส้นทางที่ทำกำไรสูงสุด · กำไรรวม (บาท)">
            <DBar data={top5} xKey="name" horiz series={[{ key: "v", label: "กำไรรวม", color: D.emerald }]} />
          </CC>
          <CC title="5 เส้นทางที่ขาดทุนสูงสุด · ขาดทุนรวม (บาท)">
            {bottom5.length
              ? <DBar data={bottom5} xKey="name" horiz series={[{ key: "v", label: "ขาดทุนรวม", color: D.rose }]} />
              : <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>ไม่มีเส้นทางที่ขาดทุนตามเงื่อนไข</div>}
          </CC>
        </div>

        {/* [VISUAL-09] [VISUAL-10] */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <div className="dz-cc">
            <h4>5 ค่าใช้จ่ายหลักในต้นทุนรวม</h4>
            <div className="dz-box">
              <DBar data={costGroups} xKey="label" colors={COST_GROUPS.map((g) => g.color)}
                series={[{ key: "v", label: "บาท", color: D.indigo }]} />
            </div>
            <Note>
              รวม 5 กลุ่ม {fmt(groupSum)} บาท จากต้นทุนทั้งหมด {fmt(kpi.cost)} บาท ·
              ส่วนต่างคือค่าเช่ารถ สูญเปล่า และรายการที่ไม่จัดกลุ่ม (แก๊ส Fleet Card เพิ่มย้อนหลัง SND) — ดูแยกได้ในแท็บ "ต้นทุน"
            </Note>
          </div>
          <div className="dz-cc">
            <TableHead title="ต้นทุนเฉลี่ยตามชนิดรถ">
              <div className="srcfilter">
                <button type="button" className={!perKm ? "on" : ""} onClick={() => setPerKm(false)}>ต่อเที่ยว (บาท)</button>
                <button type="button" className={perKm ? "on" : ""} onClick={() => setPerKm(true)}>ต่อกิโลเมตร (บาท/กม.)</button>
              </div>
            </TableHead>
            <div className="dz-box">
              <DBar data={byKind} xKey="name" horiz suffix={perKm ? " บาท/กม." : " บาท/เที่ยว"} digits={perKm ? 2 : 0}
                series={[{ key: perKm ? "perKm" : "perTrip", label: perKm ? "ต้นทุน/กม." : "ต้นทุน/เที่ยว", color: D.teal }]} />
            </div>
            <Note>
              ระยะทางจาก routes.json ของแอป จับคู่ด้วยจุดขึ้น/จุดลง —
              เที่ยวที่รู้ระยะทาง <b>{kmCoverage}%</b> ของที่กรองอยู่ · ต้นทุนต่อกม. คิดเฉพาะเที่ยวเหล่านั้น
            </Note>
          </div>
        </div>

        <TripTable trips={rows} />

        {/* 2.5 */}
        <SummaryTable trips={rows} ftFiltered={!!f.ft} />

        {svc && <ServiceTable trips={rows} svc={svc} />}
      </Pane>
    </>
  );
}
