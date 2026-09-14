/**
 * แดชบอร์ด 6 แท็บ — พอร์ตจาก renderDashMain / renderDashTrip / renderDashCustomer /
 * renderDashFleet / renderDashService / renderDashDebt ใน index.html บน main
 *
 * ทุกแท็บมีชุดตัวกรองของตัวเองเหมือนต้นฉบับ (ไม่ใช่ชุดเดียวใช้ร่วมกัน) เพราะแต่ละแท็บ
 * กรองคนละมิติ และเปลี่ยนแท็บแล้วตัวกรองของอีกแท็บต้องไม่ค้างมาด้วย
 *
 * สูตรทุกบรรทัดยกมาตรง ๆ จาก main — ที่ต่างกันคือแหล่งข้อมูล (props แทน global)
 * และการวาด (Recharts แทน Chart.js) เท่านั้น
 */
import { useMemo, useRef, useState } from "react";
import { DBar, DLine, DMixed, DPie } from "../../lib/chart/dcharts";
import { useDashInk } from "../../lib/chart/dashfx";
import RefreshBtn from "../../lib/ui/RefreshBtn";
import { D, fmtN } from "../../lib/chart/theme";
import { CC, Empty, Hero, KC, ListFF, Note, Pane, ResetBtn, SrcFF, TableHead, ZT,
         searchStyle, selectStyle } from "./parts";
import { recCost, adminWriteOff, CLEARED_GOODS } from "../../lib/cost/recCost";
import { billIsPaid, recBills } from "../../lib/record/payment";
import { debtStatus, unifyDebtRows } from "../../lib/record/debtRows";
import type { DebtRow } from "../../lib/record/debtRows";
import { daysBetween, thDateSafe, todayISO, TH_MONTHS } from "../../lib/record/date";
import { ShortId, custLabel } from "../../lib/custmap/ShortId";
import { useRoster } from "../../lib/store/roster";
import type { OldDebtor, RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const TABS = [
  { id: "main", label: "หลัก" },
  { id: "trip", label: "กำไรรายเที่ยว" },
  { id: "customer", label: "กำไรลูกค้า" },
  { id: "fleet", label: "การใช้ประโยชน์กองรถ" },
  { id: "service", label: "Service Performance" },
  { id: "debt", label: "ลูกหนี้" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ---------------- ตัวช่วยที่ main มีเป็น global ---------------- */
const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const fmt = (n: number, d = 0) => fmtN(n, d);
const routeLabel = (r: { origin?: string; dest?: string }): string =>
  (r.origin || "?") + " → " + (r.dest || "?");
/** duniq() ของ main — ตัดค่าว่างทิ้ง แล้วเรียงแบบไทย */
const duniq = (a: (string | undefined | null)[]): string[] =>
  [...new Set(a.filter((v): v is string => v != null && v !== ""))]
    .sort((x, y) => String(x).localeCompare(String(y), "th"));
const yearOf = (r: { date?: string }) => String(r.date ?? "").slice(0, 4);
const monthOf = (r: { date?: string }) => String(r.date ?? "").slice(0, 7);
const mLabel = (m: string): string => {
  const [y, mm] = m.split("-");
  return y && mm ? `${TH_MONTHS[+mm - 1]} ${+y + 543 - 2500}` : m;
};
/** สินค้าประเภท “บิลเคลียร์” = ตัดหนี้สูญ ไม่นับเป็นลูกหนี้ */
const billCleared = (b: { goodsType?: string }) => (b.goodsType || "") === CLEARED_GOODS;

/** รายการที่แท็บหนึ่งใช้ — ตัวกรอง “แหล่งข้อมูล” ตัดตั้งแต่ต้นทางเหมือน main */
function useSourced(state: RecordsState, src: string): TripRecord[] {
  const { records, oldRecords } = state;
  return useMemo(() => {
    const out: TripRecord[] = [];
    if (src !== "เก่า") for (const r of records) out.push({ ...r, source: "ใหม่" });
    if (src !== "ใหม่") for (const r of oldRecords) out.push(r as unknown as TripRecord);
    return out;
  }, [records, oldRecords, src]);
}

/** ตัวเลือกปีในตัวกรอง — main แสดงเป็น พ.ศ. แต่เก็บค่าเป็น ค.ศ. */
function YearFF({ rows, value, onChange }: {
  rows: { date?: string }[]; value: string; onChange: (v: string) => void;
}) {
  const years = duniq(rows.map(yearOf));
  return (
    <div className="ff">
      <label>ปี</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">ทุกปี</option>
        {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
      </select>
    </div>
  );
}

/* ============================ ตัวหลัก ============================ */
export default function FleetDash({ state }: { state: RecordsState }) {
  const [tab, setTab] = useState<TabId>("main");
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, tab);

  /* ปุ่มเดียวกันทุกทางออกของคอมโพเนนต์ รวมถึงตอนยังไม่มีข้อมูล
     ไม่งั้นแดชบอร์ดที่ว่างอยู่จะดึงใบเข้ามาไม่ได้เลยถ้าไม่รีโหลดทั้งหน้า */
  const refresh = (
    <RefreshBtn className="dash-reload" onClick={state.reload} loading={state.loading}
      title={state.connected
        ? "ดึงใบรายการล่าสุดจาก Google Sheet มาคำนวณใหม่"
        : "ยังไม่ได้ตั้งค่า Google Sheet — อ่านจากในเครื่องอย่างเดียว"} />
  );

  if (state.loading) {
    return <div className="card"><p className="muted">กำลังโหลด...</p></div>;
  }

  const nothing = state.records.length === 0 && state.oldRecords.length === 0;
  if (nothing) {
    return (
      <div className="card">
        <h2>ยังไม่มีข้อมูล</h2>
        <p className="muted">
          ยังไม่มีใบรายการให้สรุป — กรอกใบแรกที่หน้า “บันทึกข้อมูล”
          หรือเชื่อม Google Sheet เพื่อดึงใบที่มีอยู่แล้วเข้ามา
        </p>
        <div style={{ marginTop: 12 }}>{refresh}</div>
      </div>
    );
  }

  return (
    <>
      <div className="dash-tabs" ref={barRef}>
        <span className="dink" />
        {TABS.map((t) => (
          <button key={t.id} type="button"
            className={"dtab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        {/* อยู่บนแถบแท็บจึงติดมากับทุกแท็บ ไม่ต้องไปเติมทีละแพน */}
        {refresh}
      </div>

      {tab === "main" && <MainPane state={state} />}
      {tab === "trip" && <TripPane state={state} />}
      {tab === "customer" && <CustomerPane state={state} />}
      {tab === "fleet" && <FleetPane state={state} />}
      {tab === "service" && <ServicePane state={state} />}
      {tab === "debt" && <DebtPane state={state} />}
    </>
  );
}

/* ============================ แท็บ: หลัก ============================ */
const MAIN_F0 = { src: "", year: "", branch: "", fleet: "", veh: "", plate: "", rectype: "", origin: "", dest: "" };

function MainPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(MAIN_F0);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const base = useSourced(state, f.src);
  const { oldDebtors } = state;

  /** passMain() — ignoreYear ใช้กับกราฟรายปี ซึ่งต้องเห็นทุกปีถึงจะเทียบกันได้ */
  const pass = (r: TripRecord, ignoreYear: boolean) =>
    (ignoreYear || !f.year || yearOf(r) === f.year)
    && (!f.branch || (r.branch ?? "") === f.branch)
    && (!f.fleet || (r.fleetType ?? "") === f.fleet)
    && (!f.veh || (r.vehicle ?? "") === f.veh)
    && (!f.plate || (r.plate ?? "") === f.plate)
    && (!f.rectype || (r.docType ?? "") === f.rectype)
    && (!f.origin || (r.origin ?? "") === f.origin)
    && (!f.dest || (r.dest ?? "") === f.dest);

  const recs = useMemo(() => base.filter((r) => pass(r, false)), [base, f]);
  const yrecs = useMemo(() => base.filter((r) => pass(r, true)), [base, f]);

  /** ข้อมูลเก่าเก็บลูกหนี้ไว้คนละแท็บ จึงต้องผูกกลับด้วยเลขที่ใบรายการ */
  const oldBillsOf = (r: TripRecord): OldDebtor[] =>
    r.source === "เก่า" && r.docNo ? oldDebtors.filter((d) => d.docNo === r.docNo) : [];
  const adminOf = (r: TripRecord): number =>
    adminWriteOff(r) + oldBillsOf(r).filter(billCleared).reduce((s, d) => s + num(d.total), 0);

  const k = useMemo(() => {
    let fuel = 0, driver = 0, repair = 0, other = 0, waste = 0, cost = 0, admin = 0, ar = 0;
    const rev = recs.reduce((s, r) => s + num(r.revenue), 0);
    for (const r of recs) {
      const c = recCost(r);
      fuel += c.fuel; driver += c.driver; repair += c.repair;
      other += c.other; waste += c.waste; cost += c.total; admin += adminOf(r);
      for (const b of recBills(r)) if (!billIsPaid(b) && !billCleared(b)) ar += num(b.total);
      for (const d of oldBillsOf(r)) if (!d.paid && !billCleared(d)) ar += num(d.total);
    }
    const profit = rev - cost - admin;
    return { fuel, driver, repair, other, waste, cost, admin, ar, rev, profit,
             trips: recs.length,
             avg: recs.length ? Math.round(profit / recs.length) : 0,
             margin: rev ? Math.round(profit / rev * 100) : 0 };
  }, [recs, oldDebtors]);

  const months = useMemo(() => duniq(recs.map(monthOf)), [recs]);
  const sumBy = (list: TripRecord[], fn: (r: TripRecord) => number) => list.reduce((s, r) => s + fn(r), 0);

  const trend = useMemo(() => months.map((m) => {
    const inM = recs.filter((r) => monthOf(r) === m);
    const cost = sumBy(inM, (r) => recCost(r).total);
    const rev = sumBy(inM, (r) => num(r.revenue));
    return { m: mLabel(m), cost, rev, profit: rev - cost - sumBy(inM, adminOf) };
  }), [months, recs]);

  const byYear = useMemo(() => duniq(yrecs.map(yearOf)).map((y) => {
    const inY = yrecs.filter((r) => yearOf(r) === y);
    const rev = sumBy(inY, (r) => num(r.revenue));
    const cost = sumBy(inY, (r) => recCost(r).total);
    return { y: "พ.ศ. " + (+y + 543), rev, cost, profit: rev - cost - sumBy(inY, adminOf) };
  }), [yrecs]);

  const byVeh = useMemo(() => duniq(recs.map((r) => r.vehicle)).map((v) => {
    const inV = recs.filter((r) => r.vehicle === v);
    const rev = sumBy(inV, (r) => num(r.revenue));
    const cost = sumBy(inV, (r) => recCost(r).total);
    return { v, rev, cost, profit: rev - cost - sumBy(inV, adminOf) };
  }), [recs]);

  const byBranch = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recs) {
      const key = r.branch || "(ไม่ระบุสาขา)";
      m.set(key, (m.get(key) ?? 0) + recCost(r).total);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, v }));
  }, [recs]);

  const allCost = useMemo(() => COST_ITEMS
    .map(([label, key]) => ({ name: label, v: sumBy(recs, (r) => num((r as unknown as Record<string, unknown>)[key])) }))
    .filter((x) => x.v > 0).sort((a, b) => b.v - a.v), [recs]);

  const breakdown = [
    { name: "ค่าน้ำมัน", v: k.fuel }, { name: "เบี้ยเลี้ยงคนขับ", v: k.driver },
    { name: "ค่าซ่อมแซม", v: k.repair }, { name: "ค่าธรรมเนียมอื่นๆ", v: k.other },
    { name: "สูญเปล่า", v: k.waste },
  ];

  const nNew = recs.filter((r) => r.source !== "เก่า").length;

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={f.src} onChange={set("src")} />
        <YearFF rows={base} value={f.year} onChange={set("year")} />
        <ListFF label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={duniq(base.map((r) => r.branch))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.fleet} onChange={set("fleet")} opts={duniq(base.map((r) => r.fleetType))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
        <ListFF label="ทะเบียนรถ" all="ทุกทะเบียน" value={f.plate} onChange={set("plate")} opts={duniq(base.map((r) => r.plate))} />
        <ListFF label="ประเภทใบรายการ" all="ทุกประเภทใบรายการ" value={f.rectype} onChange={set("rectype")} opts={duniq(base.map((r) => r.docType))} />
        <ListFF label="จุดขึ้น (ต้นทาง)" all="ทุกต้นทาง" value={f.origin} onChange={set("origin")} opts={duniq(base.map((r) => r.origin))} />
        <ListFF label="จุดลง (ปลายทาง)" all="ทุกปลายทาง" value={f.dest} onChange={set("dest")} opts={duniq(base.map((r) => r.dest))} />
        <ResetBtn onClick={() => setF(MAIN_F0)} />
      </div>

      <Pane deps={[recs, f]}>
        <div className="dz-heroes">
          <Hero kind="cost" l="ค่าใช้จ่ายรวม" v={fmt(k.cost)} s="บาท · ปกติ + สูญเปล่า" />
          <Hero kind="rev" l="รายได้รวม" v={fmt(k.rev)} s="บาท" />
          <Hero kind={k.profit < 0 ? "loss" : "profit"} l="กำไรสุทธิ"
            v={(k.profit < 0 ? "−" : "") + fmt(Math.abs(k.profit))}
            s="บาท · รายได้ − ค่าใช้จ่ายรวม − ค่าบริหาร" />
        </div>

        <div className="dz-cards">
          <KC dot={D.indigo} l="จำนวนเที่ยววิ่ง" v={fmt(k.trips)} s="เที่ยว" />
          <KC dot={D.amber} l="ค่าน้ำมันรวม" v={fmt(k.fuel)} s="บาท · ค่าน้ำมันเหมา + แก๊ส" />
          <KC dot={D.teal} l="ค่าเบี้ยเลี้ยงคนขับรวม" v={fmt(k.driver)} s="บาท" />
          <KC dot={D.violet} l="ค่าธรรมเนียมอื่นๆ" v={fmt(k.other)} s="บาท" />
          <KC dot={D.orange} l="ค่าซ่อมแซม" v={fmt(k.repair)} s="บาท" />
          <KC dot={D.rose} tone="bad" l="ต้นทุนสูญเปล่า" v={fmt(k.waste)} s="บาท · นอกเส้นทาง + วิ่งอ้อม" />
          <KC dot={D.slateDeep} l="ค่าบริหาร (บิลเคลียร์)" v={fmt(k.admin)} s="บาท" />
          <KC dot={D.pink} l="ลูกหนี้ค้างชำระ" v={fmt(k.ar)} s="บาท" />
          <KC dot={D.emeraldLight} tone="good" l="กำไรเฉลี่ย/เที่ยว" v={fmt(k.avg)}
            s={<>บาท · อัตรากำไร {k.margin}%</>} />
        </div>

        <ZT>แนวโน้ม &amp; โครงสร้างต้นทุน</ZT>
        <div className="dz-row dz-2">
          <CC title="แนวโน้มต้นทุนรายเดือน">
            <DLine data={trend} xKey="m" series={[{ key: "cost", label: "ต้นทุนรวม", color: D.indigo }]} />
          </CC>
          <CC title="สัดส่วนค่าใช้จ่าย">
            <DPie data={breakdown}
              colors={[D.violet, D.indigo, D.indigo, D.slate, D.slateDeep]} />
          </CC>
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="ต้นทุน vs รายได้ รายปี (เส้น = กำไร)">
            <DMixed data={byYear} xKey="y"
              bars={[{ key: "rev", label: "รายได้", color: D.indigo },
                     { key: "cost", label: "ต้นทุน", color: D.indigo }]}
              line={{ key: "profit", label: "กำไร", color: D.emerald }} />
          </CC>
          <CC title="แนวโน้มรายได้ · ต้นทุน · กำไร รายเดือน">
            <DLine data={trend} xKey="m" series={[
              { key: "rev", label: "รายได้", color: D.indigo },
              { key: "cost", label: "ต้นทุน", color: D.indigo },
              { key: "profit", label: "กำไร", color: D.emerald }]} />
          </CC>
        </div>

        <div style={{ marginTop: 14 }}>
          <CC title="ต้นทุน vs รายได้ และกำไร ตามชนิดรถ">
            <DMixed data={byVeh} xKey="v"
              bars={[{ key: "rev", label: "รายได้", color: D.indigo },
                     { key: "cost", label: "ต้นทุน", color: D.indigo }]}
              line={{ key: "profit", label: "กำไร", color: D.emerald }} />
          </CC>
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="ต้นทุนแยกตามสาขา (Top 10)" tall>
            <DBar data={byBranch} xKey="name" horiz
              series={[{ key: "v", label: "ต้นทุน", color: D.violet }]} />
          </CC>
          <CC title="ต้นทุนทุกประเภท (มาก → น้อย)" tall>
            <DBar data={allCost} xKey="name" horiz
              series={[{ key: "v", label: "ต้นทุน", color: D.pink }]} />
          </CC>
        </div>

        <Note>
          นับจาก {fmt(recs.length)} เที่ยว (ข้อมูลใหม่ {fmt(nNew)} · ข้อมูลเก่า {fmt(recs.length - nNew)}) ·
          ค่าน้ำมันใช้ช่อง “ค่าน้ำมันเหมา” เป็นต้นทุนจริง
          ส่วนน้ำมันนอกเส้นทาง/วิ่งอ้อม นับเป็นต้นทุนสูญเปล่าแยกต่างหาก
        </Note>
      </Pane>
    </>
  );
}

/** COST_ITEMS ของ main:3227 — ลำดับและป้ายชื่อต้องตรง ไม่งั้นกราฟล่างสุดอ่านไม่เหมือนกัน */
const COST_ITEMS: [string, string][] = [
  ["ค่าแก๊ส", "gas"], ["น้ำมัน (เงินสด)", "fuelCash"], ["น้ำมันขาล่อง (บิล)", "fuelDownBill"],
  ["น้ำมัน (Fleet Card)", "fuelFleet"], ["น้ำมันไปเก็บสินค้า", "fuelPickup"], ["น้ำมันขาขึ้น (บิล)", "fuelUpBill"],
  ["ค่าเรียกรถไปขึ้นของ", "fuelCallTruck"],
  ["เบี้ยเลี้ยงพขร.", "drv"], ["เบี้ยเลี้ยงพขร.สำรอง", "spare"], ["เบี้ยเลี้ยง SND", "snd"],
  ["ค่าเปิดปิดผ้าใบ", "feeTarp"], ["ค่าตำรวจ", "feePolice"], ["ค่าคืนตู้", "feeCont"], ["ค่าเข้าท่าเรือ", "feePort"],
  ["ค่าส่งเอกสาร", "feeDoc"], ["ค่าทางด่วน", "feeToll"],
  ["ค่าซ่อมตามเวลา", "repFix"], ["ค่าซ่อมตามระยะทาง", "repVar"],
  ["สูญเปล่า: น้ำมันนอกเส้นทาง", "fuelOff"], ["สูญเปล่า: วิ่งอ้อม", "fuelDetour"],
  ["สูญเปล่า: นอกเส้นทาง (Fleet)", "fuelOffFleet"], ["สูญเปล่า: เบี้ยเลี้ยงนอกเส้นทาง", "laborOff"],
];

/* ====================== แท็บ: กำไรรายเที่ยว ====================== */
const TRIP_F0 = { src: "", year: "", branch: "", fleet: "", veh: "", route: "" };

function TripPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(TRIP_F0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const base = useSourced(state, f.src);

  /** กำไรรายเที่ยวไม่หักค่าบริหาร เพราะบิลเคลียร์เป็นค่าใช้จ่ายระดับบิล ไม่ใช่ระดับเที่ยว */
  const rows = useMemo(() => base.filter((r) =>
    (!f.year || yearOf(r) === f.year)
    && (!f.branch || (r.branch ?? "") === f.branch)
    && (!f.fleet || (r.fleetType ?? "") === f.fleet)
    && (!f.veh || (r.vehicle ?? "") === f.veh)
    && (!f.route || routeLabel(r) === f.route)
  ).map((r) => {
    const cost = recCost(r).total, rev = num(r.revenue), profit = rev - cost;
    return { r, rev, cost, profit, margin: rev ? profit / rev * 100 : null };
  }), [base, f]);

  const lossRows = rows.filter((x) => x.profit < 0);
  const lossSum = lossRows.reduce((s, x) => s + x.profit, 0);
  const marginRows = rows.filter((x) => x.margin != null);
  const avgMargin = marginRows.length
    ? marginRows.reduce((s, x) => s + (x.margin ?? 0), 0) / marginRows.length : 0;
  const bestProfit = rows.length ? Math.max(...rows.map((x) => x.profit)) : 0;

  const buckets: [number, number, string][] = [
    [-Infinity, 0, "ขาดทุน"], [0, 10, "0–10%"], [10, 20, "10–20%"],
    [20, 30, "20–30%"], [30, 40, "30–40%"], [40, Infinity, "40%+"]];
  const hist = buckets.map(([lo, hi, label]) => ({
    label, n: marginRows.filter((x) => (x.margin ?? 0) >= lo && (x.margin ?? 0) < hi).length }));
  const histColors = [D.rose, D.amber, D.mint[0], D.mint[1], D.mint[2], D.emerald];

  const byRoute = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const x of rows) {
      const key = routeLabel(x.r);
      const cur = m.get(key) ?? { sum: 0, n: 0 };
      cur.sum += x.profit; cur.n += 1; m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, v: v.sum / v.n }))
      .sort((a, b) => b.v - a.v).slice(0, 10);
  }, [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = needle
      ? rows.filter((x) => `${x.r.docNo ?? ""} ${x.r.plate ?? ""} ${routeLabel(x.r)}`.toLowerCase().includes(needle))
      : rows.slice();
    return out.sort((a, b) => sort === "asc" ? a.profit - b.profit : b.profit - a.profit);
  }, [rows, q, sort]);

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={f.src} onChange={set("src")} />
        <YearFF rows={base} value={f.year} onChange={set("year")} />
        <ListFF label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={duniq(base.map((r) => r.branch))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.fleet} onChange={set("fleet")} opts={duniq(base.map((r) => r.fleetType))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
        <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.route} onChange={set("route")} opts={duniq(base.map(routeLabel))} />
        <ResetBtn onClick={() => setF(TRIP_F0)} />
      </div>

      <Pane deps={[rows]}>
        <div className="dz-heroes">
          <Hero kind="loss" l="เที่ยวขาดทุน" v={fmt(lossRows.length)}
            s={<>เที่ยว จากทั้งหมด {fmt(rows.length)}</>} />
        </div>
        <div className="dz-cards">
          <KC dot={D.rose} tone="bad" l="ขาดทุนรวม (เที่ยวที่ขาดทุน)" v={fmt(Math.abs(lossSum))} s="บาท" />
          <KC dot={D.indigo} l="อัตรากำไรเฉลี่ย/เที่ยว" v={`${Math.round(avgMargin)}%`} s="ของรายได้ต่อเที่ยว" />
          <KC dot={D.emeraldLight} tone="good" l="กำไรสูงสุดต่อเที่ยว" v={fmt(bestProfit)} s="บาท" />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="กระจายตัวอัตรากำไรต่อเที่ยว">
            <DBar data={hist} xKey="label" suffix=" เที่ยว" colors={histColors}
              series={[{ key: "n", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </CC>
          <CC title="กำไรเฉลี่ย/เที่ยว ตามเส้นทาง (Top 10)">
            <DBar data={byRoute} xKey="name" horiz
              series={[{ key: "v", label: "กำไรเฉลี่ย/เที่ยว", color: D.indigo }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="เที่ยววิ่งทั้งหมด เรียงตามกำไร/ขาดทุน">
            <select style={selectStyle} value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")}>
              <option value="asc">ขาดทุนก่อน (น้อย → มาก)</option>
              <option value="desc">กำไรมากก่อน (มาก → น้อย)</option>
            </select>
            <input style={searchStyle} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหา เลขที่ใบรายการ / ทะเบียน / เส้นทาง" />
          </TableHead>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่ใบรายการ</th><th>เส้นทาง</th><th>ชนิดรถ</th><th>ทะเบียน</th>
                <th className="n">รายได้</th><th className="n">ต้นทุนรวม</th>
                <th className="n">กำไร/ขาดทุน</th><th className="n">อัตรากำไร</th>
              </tr></thead>
              <tbody>
                {list.length === 0 ? <Empty cols={9} text="ไม่พบเที่ยววิ่งตามเงื่อนไข" /> : (
                  <>
                    {list.slice(0, 300).map((x, i) => (
                      <tr key={i}>
                        <td>{thDateSafe(x.r.date)}</td>
                        <td>{x.r.docNo || "–"}</td>
                        <td>{routeLabel(x.r)}</td>
                        <td>{x.r.vehicle || "–"}</td>
                        <td>{x.r.plate || "–"}</td>
                        <td className="n">{fmt(x.rev)}</td>
                        <td className="n">{fmt(x.cost)}</td>
                        <td className="n" style={{ fontWeight: 700, color: x.profit < 0 ? "var(--red)" : "var(--green)" }}>
                          {(x.profit < 0 ? "−" : "") + fmt(Math.abs(x.profit))}
                        </td>
                        <td className="n">{x.margin == null ? "–" : Math.round(x.margin) + "%"}</td>
                      </tr>
                    ))}
                    {list.length > 300 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 10 }}>
                        …แสดง 300 รายการแรกจากทั้งหมด {fmt(list.length)} รายการ · ใช้ตัวกรอง/ค้นหาเพื่อดูรายการอื่น
                      </td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Note>
          กำไร/ขาดทุนต่อเที่ยว = รายได้ (ช่อง “รายได้” ในฟอร์มบันทึก) − ต้นทุนรวม (ปกติ + สูญเปล่า) ต่อเที่ยว ·
          ยังไม่รวมค่าบริหาร (บิลเคลียร์) เพราะเป็นค่าใช้จ่ายระดับบิล ไม่ใช่ระดับเที่ยว
        </Note>
      </Pane>
    </>
  );
}

/* ====================== แท็บ: กำไรลูกค้า ====================== */
function CustomerPane({ state }: { state: RecordsState }) {
  const [src, setSrc] = useState("");
  const [year, setYear] = useState("");
  const [role, setRole] = useState<"sender" | "receiver">("sender");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [q, setQ] = useState("");
  const base = useSourced(state, src);
  const { oldDebtors } = state;

  /** ปันส่วนต้นทุนของใบให้แต่ละบิลตามสัดส่วนยอดบิล — ใบหนึ่งวิ่งให้ลูกค้าหลายรายได้ */
  const list = useMemo(() => {
    const recs = base.filter((r) => !year || yearOf(r) === year);
    const m = new Map<string, { n: number; rev: number; cost: number }>();
    for (const r of recs) {
      const bs = recBills(r).filter((b) => !billCleared(b));
      const oldBs = r.source === "เก่า" && r.docNo
        ? oldDebtors.filter((d) => d.docNo === r.docNo && !billCleared(d)) : [];
      const all = [...bs, ...oldBs].map((b) => ({
        name: String((b as Record<string, unknown>)[role] ?? "") || "(ไม่ระบุ)",
        total: num((b as Record<string, unknown>).total),
      }));
      if (!all.length) continue;
      const sumTotal = all.reduce((s, b) => s + b.total, 0);
      const cost = recCost(r).total;
      for (const b of all) {
        const share = sumTotal > 0 ? b.total / sumTotal : 1 / all.length;
        const cur = m.get(b.name) ?? { n: 0, rev: 0, cost: 0 };
        cur.n += 1; cur.rev += b.total; cur.cost += cost * share;
        m.set(b.name, cur);
      }
    }
    return [...m.entries()].map(([name, v]) => ({
      name, ...v, profit: v.rev - v.cost, margin: v.rev ? (v.rev - v.cost) / v.rev * 100 : null }));
  }, [base, year, role, oldDebtors]);

  const lossList = list.filter((x) => x.profit < 0);
  const top = list.length ? list.reduce((a, b) => a.profit >= b.profit ? a : b) : null;
  const bot = list.length ? list.reduce((a, b) => a.profit <= b.profit ? a : b) : null;

  const sorted = useMemo(() => list.slice()
    .sort((a, b) => sort === "asc" ? a.profit - b.profit : b.profit - a.profit), [list, sort]);
  const top15 = sorted.slice(0, 15).map((x) => ({ name: custLabel(x.name), v: x.profit }));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? sorted.filter((x) => x.name.toLowerCase().includes(needle)) : sorted;
  }, [sorted, q]);

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={src} onChange={setSrc} />
        <YearFF rows={base} value={year} onChange={setYear} />
        <div className="ff">
          <label>มองลูกค้าจาก</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "sender" | "receiver")}>
            <option value="sender">ผู้ส่ง (Sender)</option>
            <option value="receiver">ผู้รับ (Receiver)</option>
          </select>
        </div>
        <div className="ff">
          <label>เรียงลำดับ</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as "desc" | "asc")}>
            <option value="desc">กำไรมากก่อน</option>
            <option value="asc">กำไรน้อย/ขาดทุนก่อน</option>
          </select>
        </div>
        <ResetBtn onClick={() => { setSrc(""); setYear(""); setRole("sender"); setSort("desc"); }} />
      </div>

      <Pane deps={[list, sort]}>
        <div className="dz-heroes">
          <Hero kind="cust" l="จำนวนลูกค้า" v={fmt(list.length)} s="ราย (มีบิลอย่างน้อย 1 รายการ)" />
        </div>
        <div className="dz-cards">
          <KC dot={D.emeraldLight} tone="good" small l="ลูกค้าที่สร้างกำไรสูงสุด"
            v={top ? custLabel(top.name) : "–"} s={top ? "+" + fmt(top.profit) + " บาท" : "–"} />
          <KC dot={D.rose} tone="bad" small l="ลูกค้าที่กัดกำไรมากสุด"
            v={bot ? custLabel(bot.name) : "–"}
            s={bot ? (bot.profit < 0 ? "−" : "+") + fmt(Math.abs(bot.profit)) + " บาท" : "–"} />
          <KC dot={D.orange} l="ลูกค้าที่ขาดทุน" v={fmt(lossList.length)} s="ราย จากทั้งหมด" />
        </div>

        <div style={{ marginTop: 14 }}>
          <CC title="กำไร/ขาดทุนต่อลูกค้า (Top 15)" tall>
            <DBar data={top15} xKey="name" horiz
              colors={top15.map((x) => x.v < 0 ? D.rose : D.emerald)}
              series={[{ key: "v", label: "กำไร/ขาดทุน", color: D.emerald }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="กำไรรายลูกค้า (ทั้งหมด)">
            <input style={{ ...searchStyle, minWidth: 220 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหาชื่อลูกค้า" />
          </TableHead>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>ลูกค้า</th><th className="n">จำนวนบิล</th><th className="n">รายได้รวม</th>
                <th className="n">ต้นทุนปันส่วน</th><th className="n">กำไร/ขาดทุน</th><th className="n">อัตรากำไร</th>
              </tr></thead>
              <tbody>
                {shown.length === 0 ? <Empty cols={6} text="ไม่พบข้อมูลลูกค้าตามเงื่อนไข" /> : (
                  <>
                    {shown.slice(0, 300).map((x) => (
                      <tr key={x.name}>
                        <td><ShortId v={x.name} /></td>
                        <td className="n">{fmt(x.n)}</td>
                        <td className="n">{fmt(x.rev)}</td>
                        <td className="n">{fmt(x.cost)}</td>
                        <td className="n" style={{ fontWeight: 700, color: x.profit < 0 ? "var(--red)" : "var(--green)" }}>
                          {(x.profit < 0 ? "−" : "") + fmt(Math.abs(x.profit))}
                        </td>
                        <td className="n">{x.margin == null ? "–" : Math.round(x.margin) + "%"}</td>
                      </tr>
                    ))}
                    {shown.length > 300 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 10 }}>
                        …แสดง 300 รายการแรกจากทั้งหมด {fmt(shown.length)} รายการ
                      </td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Note>
          ต้นทุนปันส่วน = ต้นทุนรวมของแต่ละเที่ยว กระจายตามสัดส่วนมูลค่าบิลของลูกค้าในเที่ยวนั้น
          (ไม่รวมบิลประเภท “บิลเคลียร์” ซึ่งนับเป็นค่าบริหารแยกต่างหาก) ·
          ใช้สำหรับดูแนวโน้มเชิงเปรียบเทียบ ไม่ใช่ต้นทุนที่แท้จริงต่อลูกค้า 100%
        </Note>
      </Pane>
    </>
  );
}

/* ================= แท็บ: การใช้ประโยชน์กองรถ ================= */
const FLEET_F0 = { src: "", year: "", route: "", group: "", veh: "" };

function FleetPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(FLEET_F0);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const base = useSourced(state, f.src);
  const [roster] = useRoster();

  const recs = useMemo(() => base.filter((r) =>
    (!f.year || yearOf(r) === f.year)
    && (!f.route || routeLabel(r) === f.route)
    && (!f.group || (r.serviceGroup ?? "") === f.group)
    && (!f.veh || (r.vehicle ?? "") === f.veh)), [base, f]);

  const km = recs.reduce((s, r) => s + num(r.dist), 0);
  const plates = duniq(recs.map((r) => r.plate));
  const usedN = plates.filter((p) => roster.some((x) => x.plate === p)).length;

  const today = todayISO();
  const endDate = f.year ? `${f.year}-12-31` : today;
  const endUse = endDate > today ? today : endDate;

  const util = useMemo(() => roster.map((x) => {
    const own = recs.filter((r) => r.plate === x.plate);
    const kmOwn = own.reduce((s, r) => s + num(r.dist), 0);
    const activeDays = duniq(own.map((r) => r.date)).length;
    const availDays = x.start ? Math.max(1, (daysBetween(x.start, endUse) ?? 0) + 1) : null;
    const pct = availDays && availDays > 0 ? Math.min(100, Math.round(activeDays / availDays * 100)) : null;
    return { f: x, n: own.length, km: kmOwn, activeDays, availDays, pct };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)), [roster, recs, endUse]);

  const withPct = util.filter((x) => x.pct != null);
  const avgUtil = withPct.length
    ? Math.round(withPct.reduce((s, x) => s + (x.pct ?? 0), 0) / withPct.length) : 0;

  const countBy = (key: (r: TripRecord) => string | undefined, limit?: number) => {
    const m = new Map<string, number>();
    for (const r of recs) { const k = key(r) || "(ไม่ระบุ)"; m.set(k, (m.get(k) ?? 0) + 1); }
    const out = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, v }));
    return limit ? out.slice(0, limit) : out;
  };

  /* ---- Load Factor / มูลค่าที่สูญเสีย ---- */
  // main นับเฉพาะใบที่ประทับ _v4 — ใบก่อนหน้านั้นไม่มีช่องความจุ/น้ำหนักบรรทุก
  // ถ้าไม่กรองออก ใบเก่าจะถูกอ่านว่า "ความจุ 0" แล้วโผล่เป็นเที่ยวเสียโอกาสทั้งหมด
  const loadRecs = recs.filter((r) => r._v4 && (num(r.capacity) > 0 || r.emptyLeg));
  const emptyRecs = loadRecs.filter((r) => r.emptyLeg);
  const loadedRecs = loadRecs.filter((r) => !r.emptyLeg && num(r.capacity) > 0);
  const factors = loadedRecs.map((r) => Math.min(100, num(r.loadActual) / num(r.capacity) * 100));
  const avgLoad = factors.length ? Math.round(factors.reduce((s, x) => s + x, 0) / factors.length) : 0;
  const emptyCost = emptyRecs.reduce((s, r) => s + recCost(r).total, 0);

  const lostRows = useMemo(() => {
    const out: { r: TripRecord; load: number; cap: number; factor: number; lost: number; status: string }[] = [];
    for (const r of emptyRecs)
      out.push({ r, load: 0, cap: num(r.capacity), factor: 0, lost: recCost(r).total, status: "เที่ยวเปล่า" });
    for (const r of loadedRecs) {
      const cost = recCost(r).total;
      const factor = Math.min(1, num(r.loadActual) / num(r.capacity));
      out.push({ r, load: num(r.loadActual), cap: num(r.capacity), factor: factor * 100,
                 lost: cost * (1 - factor), status: "บรรทุกไม่เต็ม" });
    }
    return out.sort((a, b) => b.lost - a.lost);
  }, [emptyRecs, loadedRecs]);

  const lostVal = lostRows.filter((x) => x.status === "บรรทุกไม่เต็ม").reduce((s, x) => s + x.lost, 0);

  const loadBuckets: [number, number, string][] = [
    [0, 20, "0–20%"], [20, 40, "20–40%"], [40, 60, "40–60%"], [60, 80, "60–80%"], [80, 100.01, "80–100%"]];
  const loadHist = loadBuckets.map(([lo, hi, label]) => ({
    label, n: factors.filter((x) => x >= lo && x < hi).length }));

  const lostByVeh = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of lostRows) m.set(x.r.vehicle || "(ไม่ระบุ)", (m.get(x.r.vehicle || "(ไม่ระบุ)") ?? 0) + x.lost);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, v }));
  }, [lostRows]);

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={f.src} onChange={set("src")} />
        <YearFF rows={base} value={f.year} onChange={set("year")} />
        <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.route} onChange={set("route")} opts={duniq(base.map(routeLabel))} />
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.group} onChange={set("group")} opts={duniq(base.map((r) => r.serviceGroup))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
        <ResetBtn onClick={() => setF(FLEET_F0)} />
      </div>

      <Pane deps={[recs, roster]}>
        <ZT>การใช้ประโยชน์กองรถ (Fleet Utilization)</ZT>
        <div className="dz-heroes">
          <Hero kind="fleet" l="รถในกองรถทั้งหมด" v={fmt(roster.length)}
            s={<>{fmt(roster.filter((x) => x.status === "ใช้งาน").length)} คัน สถานะ “ใช้งาน”</>} />
        </div>
        <div className="dz-cards">
          <KC dot={D.indigo} l="รถที่มีเที่ยววิ่งในช่วงนี้" v={fmt(usedN)}
            s={<>จาก {fmt(roster.length)} คันในกองรถ</>} />
          <KC dot={D.teal} l="%การใช้งานเฉลี่ยต่อคัน" v={`${avgUtil}%`}
            s="วันที่มีเที่ยว ÷ วันที่พร้อมใช้งาน" bar={D.teal} />
          <KC dot={D.violet} l="ระยะทางรวมทุกเที่ยว" v={fmt(km)} s="กม." />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="จำนวนเที่ยว ตามเส้นทาง (Top 10)">
            <DBar data={countBy(routeLabel, 10)} xKey="name" horiz suffix=" เที่ยว"
              series={[{ key: "v", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </CC>
          <CC title="จำนวนเที่ยว ตามกลุ่มบริการ">
            <DBar data={countBy((r) => r.serviceGroup)} xKey="name" suffix=" เที่ยว"
              series={[{ key: "v", label: "จำนวนเที่ยว", color: D.violet }]} />
          </CC>
        </div>

        <div style={{ marginTop: 14 }}>
          <CC title="จำนวนเที่ยว ตามชนิดรถ">
            <DBar data={countBy((r) => r.vehicle)} xKey="name" suffix=" เที่ยว"
              series={[{ key: "v", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>%การใช้งานรายคัน (เทียบกับทะเบียนรถในกองรถ)</h4>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>ทะเบียนรถ</th><th>ประเภทรถ</th><th>ชนิดรถ</th><th>เริ่มใช้งาน</th><th>สถานะ</th>
                <th className="n">จำนวนเที่ยว</th><th className="n">กม.รวม</th>
                <th className="n">วันที่ใช้งานจริง</th><th className="n">วันพร้อมใช้งาน</th><th className="n">%การใช้งาน</th>
              </tr></thead>
              <tbody>
                {util.length === 0
                  ? <Empty cols={10} text="ยังไม่มีรถในกองรถ — เพิ่มได้ที่หน้า “การตั้งค่า”" />
                  : util.map((x) => (
                    <tr key={x.f.plate}>
                      <td style={{ fontWeight: 700 }}>{x.f.plate}</td>
                      <td>{x.f.fleetType || "–"}</td>
                      <td>{x.f.vehicle || "–"}</td>
                      <td>{thDateSafe(x.f.start)}</td>
                      <td>{x.f.status || "–"}</td>
                      <td className="n">{fmt(x.n)}</td>
                      <td className="n">{fmt(x.km)}</td>
                      <td className="n">{fmt(x.activeDays)}</td>
                      <td className="n">{x.availDays == null ? "–" : fmt(x.availDays)}</td>
                      <td className="n" style={{ fontWeight: 700 }}>{x.pct == null ? "–" : `${x.pct}%`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <Note>
          %การใช้งาน = จำนวนวันที่มีเที่ยววิ่งจริง (นับวันไม่ซ้ำ) ÷ จำนวนวันตั้งแต่ “วันที่เริ่มใช้งาน”
          ในทะเบียนรถ ถึงวันนี้ (หรือถึงวันสุดท้ายของตัวกรองปีที่เลือก) × 100 ·
          รถที่ไม่มีเที่ยวเลยจะแสดง 0% · เพิ่ม/แก้ทะเบียนรถได้ที่หน้า “การตั้งค่า”
        </Note>

        <ZT>มูลค่าที่สูญเสียจากอัตราบรรทุกต่ำ / เที่ยวเปล่า / รถใช้ไม่คุ้มค่า</ZT>
        <div className="dz-cards">
          <KC dot={D.cyan} l="Load Factor เฉลี่ย" v={`${avgLoad}%`}
            s="เฉพาะเที่ยวที่มีสินค้า + มีข้อมูลความจุ" bar={D.cyan} />
          <KC dot={D.violet} l="เที่ยวเปล่า (Empty Leg)" v={fmt(emptyRecs.length)}
            s={<>{loadRecs.length ? Math.round(emptyRecs.length / loadRecs.length * 100) : 0}% ของเที่ยวที่มีข้อมูล</>} />
          <KC dot={D.rose} tone="bad" l="ต้นทุนที่เสียไปจากเที่ยวเปล่า" v={fmt(emptyCost)} s="บาท" />
          <KC dot={D.amber} tone="warn" l="มูลค่าเสียโอกาสจากบรรทุกไม่เต็ม" v={fmt(lostVal)} s="บาท · โดยประมาณ" />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="กระจายตัว Load Factor">
            <DBar data={loadHist} xKey="label" suffix=" เที่ยว"
              colors={[D.rose, D.amber, D.mint[0], D.mint[2], D.emerald]}
              series={[{ key: "n", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </CC>
          <CC title="มูลค่าเสียโอกาส ตามชนิดรถ (Top 10)">
            <DBar data={lostByVeh} xKey="name" horiz
              series={[{ key: "v", label: "มูลค่าเสียโอกาส (บาท)", color: D.indigoDeep }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="เที่ยวที่ใช้รถไม่คุ้มค่าที่สุด (Load Factor ต่ำสุด / เที่ยวเปล่า) เรียงตามมูลค่าเสียโอกาส" />
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่ใบรายการ</th><th>เส้นทาง</th><th>ชนิดรถ</th><th>สถานะ</th>
                <th className="n">บรรทุกจริง (กก.)</th><th className="n">ความจุ (กก.)</th>
                <th className="n">Load Factor</th><th className="n">มูลค่าเสียโอกาส</th>
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
                      <td className="n">{fmt(x.load)}</td>
                      <td className="n">{fmt(x.cap)}</td>
                      <td className="n">{Math.round(x.factor)}%</td>
                      <td className="n" style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(x.lost)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <Note>
          มูลค่าเสียโอกาส (โดยประมาณ) = ต้นทุนรวมของเที่ยวนั้น × สัดส่วนความจุที่ไม่ได้ใช้ (100% − Load Factor) ·
          สำหรับเที่ยวเปล่า = ต้นทุนรวมทั้งเที่ยว (เพราะไม่มีรายได้เลย) ·
          เป็นค่าประมาณเชิงเปรียบเทียบ ไม่ใช่มูลค่าความเสียหายที่แท้จริง 100% ·
          แสดงเฉพาะเที่ยวที่กรอกความจุรถ/น้ำหนักบรรทุกแล้วเท่านั้น
        </Note>
      </Pane>
    </>
  );
}

/* ================= แท็บ: Service Performance ================= */
interface SvcBill {
  date: string; no: string; receiver: string; qty: number;
  plannedDate: string | null; actualDate: string | null;
  damageStatus: string; damageQty: number;
}

function ServicePane({ state }: { state: RecordsState }) {
  const [src, setSrc] = useState("");
  const [year, setYear] = useState("");
  const [receiver, setReceiver] = useState("");
  const [q, setQ] = useState("");
  const { records, oldDebtors } = state;

  /** main รวมบิลจากใบใหม่กับแท็บข้อมูลเก่า แล้วแปะวันที่ของใบให้บิลใหม่ */
  const raw = useMemo(() => {
    const out: SvcBill[] = [];
    const take = (b: Record<string, unknown>, date: string): SvcBill => ({
      date, no: String(b.no ?? ""), receiver: String(b.receiver ?? ""), qty: num(b.qty),
      plannedDate: (b.plannedDate as string) ?? null, actualDate: (b.actualDate as string) ?? null,
      damageStatus: String(b.damageStatus ?? ""), damageQty: num(b.damageQty),
    });
    if (src !== "เก่า")
      for (const r of records) for (const b of recBills(r)) out.push(take(b as unknown as Record<string, unknown>, r.date));
    if (src !== "ใหม่")
      for (const d of oldDebtors) out.push(take(d as Record<string, unknown>, String(d.date ?? "")));
    return out;
  }, [records, oldDebtors, src]);

  const bills = useMemo(() => raw.filter((b) =>
    (!year || b.date.slice(0, 4) === year) && (!receiver || b.receiver === receiver)), [raw, year, receiver]);

  const qtyBills = bills.filter((b) => b.qty > 0);
  const otBills = bills.filter((b) => b.plannedDate && b.actualDate);
  const onTimeN = otBills.filter((b) => (b.actualDate ?? "") <= (b.plannedDate ?? "")).length;
  const dmgBills = bills.filter((b) => b.damageStatus);
  const dmgN = dmgBills.filter((b) => b.damageStatus !== "ปกติ").length;

  const byCust = useMemo(() => {
    const m = new Map<string, { ot: number; otN: number; dm: number; dmN: number }>();
    const get = (k: string) => m.get(k) ?? { ot: 0, otN: 0, dm: 0, dmN: 0 };
    for (const b of otBills) {
      const k = b.receiver || "(ไม่ระบุ)"; const c = get(k);
      c.otN += 1; if ((b.actualDate ?? "") <= (b.plannedDate ?? "")) c.ot += 1; m.set(k, c);
    }
    for (const b of dmgBills) {
      const k = b.receiver || "(ไม่ระบุ)"; const c = get(k);
      c.dmN += 1; if (b.damageStatus !== "ปกติ") c.dm += 1; m.set(k, c);
    }
    return [...m.entries()];
  }, [otBills, dmgBills]);

  const otWorst = byCust.filter(([, v]) => v.otN > 0)
    .map(([k, v]) => ({ name: custLabel(k), v: Math.round(v.ot / v.otN * 100) }))
    .sort((a, b) => a.v - b.v).slice(0, 10);
  const dmWorst = byCust.filter(([, v]) => v.dmN > 0)
    .map(([k, v]) => ({ name: custLabel(k), v: Math.round(v.dm / v.dmN * 100) }))
    .sort((a, b) => b.v - a.v).slice(0, 10);

  const trend = useMemo(() => duniq(bills.map((b) => b.date.slice(0, 7))).sort().map((m) => {
    const ot = otBills.filter((b) => b.date.slice(0, 7) === m);
    const dm = dmgBills.filter((b) => b.date.slice(0, 7) === m);
    return {
      m: mLabel(m),
      onTime: ot.length ? Math.round(ot.filter((b) => (b.actualDate ?? "") <= (b.plannedDate ?? "")).length / ot.length * 100) : null,
      damage: dm.length ? Math.round(dm.filter((b) => b.damageStatus !== "ปกติ").length / dm.length * 100) : null,
    };
  }), [bills, otBills, dmgBills]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = bills.filter((b) =>
      (b.plannedDate && b.actualDate && b.actualDate > b.plannedDate)
      || (b.damageStatus && b.damageStatus !== "ปกติ"));
    if (needle) out = out.filter((b) => `${b.receiver} ${b.no}`.toLowerCase().includes(needle));
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [bills, q]);

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={src} onChange={setSrc} />
        <YearFF rows={raw} value={year} onChange={setYear} />
        <ListFF label="ผู้รับ (ลูกค้า)" all="ทุกลูกค้า (ผู้รับ)" value={receiver} onChange={setReceiver}
          opts={duniq(raw.map((b) => b.receiver))} />
        <ResetBtn onClick={() => { setSrc(""); setYear(""); setReceiver(""); }} />
      </div>

      <Pane deps={[bills]}>
        <div className="dz-heroes">
          <Hero kind="svc" l="On-time Delivery"
            v={otBills.length ? Math.round(onTimeN / otBills.length * 100) + "%" : "0%"}
            s="ของบิลที่มีทั้งกำหนดส่งและเวลาส่งจริง" />
        </div>
        <div className="dz-cards">
          <KC dot={D.indigo} l="จำนวนชิ้นสินค้ารวม" v={fmt(qtyBills.reduce((s, b) => s + b.qty, 0))}
            s={<>ชิ้น จาก {fmt(qtyBills.length)} บิลที่มีข้อมูล</>} />
          <KC dot={D.rose} tone="bad" l="Damage Rate"
            v={dmgBills.length ? Math.round(dmgN / dmgBills.length * 100) + "%" : "0%"}
            s="ของบิลที่มีข้อมูลสถานะสินค้า" />
          <KC dot={D.orange} tone="warn" l="จำนวนชิ้นเสียหายรวม"
            v={fmt(bills.reduce((s, b) => s + b.damageQty, 0))} s="ชิ้น" />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="On-time Delivery % ตามลูกค้า (Top 10 ที่แย่ที่สุด)">
            <DBar data={otWorst} xKey="name" horiz suffix="%"
              series={[{ key: "v", label: "On-time %", color: D.violet }]} />
          </CC>
          <CC title="Damage Rate % ตามลูกค้า (Top 10 ที่แย่ที่สุด)">
            <DBar data={dmWorst} xKey="name" horiz suffix="%"
              series={[{ key: "v", label: "Damage Rate %", color: D.rose }]} />
          </CC>
        </div>

        <div style={{ marginTop: 14 }}>
          <CC title="แนวโน้ม On-time / Damage Rate รายเดือน">
            <DLine data={trend} xKey="m" suffix="%" series={[
              { key: "onTime", label: "On-time %", color: D.violet },
              { key: "damage", label: "Damage Rate %", color: D.rose }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="บิลที่ส่งล่าช้า หรือสินค้าเสียหาย">
            <input style={{ ...searchStyle, minWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหา ผู้รับ / เลขที่บิล" />
          </TableHead>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่บิล</th><th>ผู้รับ</th><th className="n">จำนวน</th>
                <th>กำหนดส่ง</th><th>ส่งจริง</th><th className="n">ส่งช้า (วัน)</th>
                <th>สถานะสินค้า</th><th className="n">จำนวนเสียหาย</th>
              </tr></thead>
              <tbody>
                {list.length === 0
                  ? <Empty cols={9} text="ไม่พบบิลที่ส่งช้าหรือสินค้าเสียหายตามเงื่อนไข" />
                  : list.slice(0, 300).map((b, i) => {
                    const late = b.plannedDate && b.actualDate ? daysBetween(b.plannedDate, b.actualDate) : null;
                    return (
                      <tr key={i}>
                        <td>{thDateSafe(b.date)}</td>
                        <td style={{ fontWeight: 600 }}>{b.no || "–"}</td>
                        <td><ShortId v={b.receiver} /></td>
                        <td className="n">{b.qty ? fmt(b.qty) : "–"}</td>
                        <td>{thDateSafe(b.plannedDate)}</td>
                        <td>{thDateSafe(b.actualDate)}</td>
                        <td className="n">{late != null && late > 0 ? fmt(late) : "–"}</td>
                        <td>{b.damageStatus && b.damageStatus !== "ปกติ"
                          ? <span className="badge unpaid">{b.damageStatus}</span>
                          : (b.damageStatus || "–")}</td>
                        <td className="n">{b.damageQty ? fmt(b.damageQty) : "–"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <Note>
          On-time Delivery % และ Damage Rate % คำนวณจากข้อมูลที่กรอกในส่วน “รายการลูกหนี้ / บิล”
          ของฟอร์มบันทึกข้อมูล (กำหนดส่ง / เวลาส่งจริง / สถานะสินค้า / จำนวนชิ้นเสียหาย) ·
          บิลเก่าที่ยังไม่มีข้อมูลเหล่านี้จะไม่ถูกนับในอัตราส่วน
        </Note>
      </Pane>
    </>
  );
}

/* ====================== แท็บ: ลูกหนี้ ====================== */
const DEBT_F0 = { src: "", status: "", sender: "", receiver: "", pay: "", prod: "" };

function DebtPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(DEBT_F0);
  const [q, setQ] = useState("");
  const [thresh, setThresh] = useState(30);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const { records, oldDebtors } = state;

  const all = useMemo(() => unifyDebtRows(records, oldDebtors, "all"), [records, oldDebtors]);
  const rows = useMemo(() => {
    const scoped = f.src === "เก่า" ? all.filter((x) => x.old)
      : f.src === "ใหม่" ? all.filter((x) => !x.old) : all;
    return scoped.filter((x) =>
      (!f.status || debtStatus(x) === f.status)
      && (!f.sender || x.sender === f.sender)
      && (!f.receiver || x.receiver === f.receiver)
      && (!f.pay || x.payType === f.pay)
      && (!f.prod || x.goodsType === f.prod));
  }, [all, f]);

  let outT = 0, paidT = 0, clrT = 0, cntUnpaid = 0;
  for (const x of rows) {
    const t = num(x.total), k = debtStatus(x);
    if (k === "unpaid") { outT += t; cntUnpaid += 1; }
    else if (k === "cleared") clrT += t;
    else paidT += t;
  }
  const billed = outT + paidT + clrT;

  const top = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of rows) {
      if (debtStatus(x) !== "unpaid") continue;
      const lab = custLabel(x.sender) + " → " + custLabel(x.receiver);
      m.set(lab, (m.get(lab) ?? 0) + num(x.total));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, v]) => ({ name, v }));
  }, [rows]);

  const agingBuckets: [number, number, string][] = [
    [0, 30, "0–30 วัน"], [31, 60, "31–60 วัน"], [61, 90, "61–90 วัน"], [91, Infinity, "90+ วัน"]];
  const aging = agingBuckets.map(([lo, hi, label]) => ({
    label,
    v: rows.filter((x) => debtStatus(x) === "unpaid" && x.aging != null && x.aging >= lo && x.aging <= hi)
      .reduce((s, x) => s + num(x.total), 0),
  }));

  /** ลูกค้าที่จ่ายช้ากว่าเกณฑ์ซ้ำ ๆ — นับเฉพาะบิลที่จ่ายแล้วและใช้เวลาเกินเกณฑ์ */
  const late = useMemo(() => {
    const m = new Map<string, { n: number; days: number; total: number }>();
    for (const x of rows) {
      if (debtStatus(x) !== "paid" || x.daysToPay == null || x.daysToPay <= thresh) continue;
      const key = x.receiver || x.sender || "(ไม่ระบุ)";
      const cur = m.get(key) ?? { n: 0, days: 0, total: 0 };
      cur.n += 1; cur.days += x.daysToPay; cur.total += num(x.total);
      m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, n: v.n, avg: v.days / v.n, total: v.total }))
      .sort((a, b) => b.n - a.n || b.avg - a.avg).slice(0, 15);
  }, [rows, thresh]);

  const unpaidList = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((x) => debtStatus(x) === "unpaid");
    if (needle) list = list.filter((x) =>
      `${x.no} ${x.docNo} ${x.sender} ${x.receiver}`.toLowerCase().includes(needle));
    return list.sort((a, b) => num(b.total) - num(a.total));
  }, [rows, q]);

  const pie = [
    { name: "ชำระแล้ว", v: paidT }, { name: "ค้างชำระ", v: outT }, { name: "บิลเคลียร์", v: clrT }];

  /**
   * main เปิด modal ชำระเงินจากตารางนี้ได้เลย (openPayModal)
   * ที่นี่หน้าต่างนั้นอยู่กับหน้า "รายการลูกหนี้" จึงส่งบิลที่เลือกไปเปิดที่นั่นแทน
   */
  const openPay = (x: DebtRow) => {
    sessionStorage.setItem("payBillKey", x.key);
    location.hash = "#/debtors";
  };

  return (
    <>
      <div className="dz-filters">
        <SrcFF value={f.src} onChange={set("src")} />
        <div className="ff">
          <label>สถานะ</label>
          <select value={f.status} onChange={(e) => set("status")(e.target.value)}>
            <option value="">ทั้งหมด</option>
            <option value="unpaid">ค้างชำระ</option>
            <option value="paid">ชำระแล้ว</option>
            <option value="cleared">บิลเคลียร์</option>
          </select>
        </div>
        <ListFF label="ผู้ส่ง" all="ผู้ส่งทั้งหมด" value={f.sender} onChange={set("sender")} opts={duniq(all.map((x) => x.sender))} />
        <ListFF label="ผู้รับ" all="ผู้รับทั้งหมด" value={f.receiver} onChange={set("receiver")} opts={duniq(all.map((x) => x.receiver))} />
        <ListFF label="ประเภทการชำระเงิน" all="ทุกประเภทการชำระ" value={f.pay} onChange={set("pay")} opts={duniq(all.map((x) => x.payType))} />
        <ListFF label="ประเภทสินค้า" all="ทุกประเภทสินค้า" value={f.prod} onChange={set("prod")} opts={duniq(all.map((x) => x.goodsType))} />
        <ResetBtn onClick={() => setF(DEBT_F0)} />
      </div>

      <Pane deps={[rows, thresh]}>
        <div className="dz-cards">
          <KC dot={D.rose} tone="bad" l="ยอดค้างชำระรวม" v={fmt(outT)} s="บาท" />
          <KC dot={D.emeraldLight} tone="good" l="ยอดรับชำระแล้ว" v={fmt(paidT)} s="บาท" />
          <KC dot={D.violet} l="จำนวนรายการค้างชำระ" v={fmt(cntUnpaid)} s="ราย" />
          <KC dot={D.amber} l="% สัดส่วนค้างชำระ"
            v={(billed ? Math.round(outT / billed * 100) : 0) + "%"} s="ของยอดออกบิลทั้งหมด" />
        </div>

        <div className="dz-row dz-11">
          <CC title="ลูกหนี้ค้างชำระ (Top 10)">
            <DBar data={top} xKey="name" horiz
              series={[{ key: "v", label: "ค้างชำระ", color: D.rose }]} />
          </CC>
          <CC title="สัดส่วนชำระแล้ว vs ค้างชำระ">
            <DPie data={pie} colors={[D.emerald, D.rose, D.violet]} />
          </CC>
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="อายุหนี้ค้างชำระ (Aging Buckets)">
            <DBar data={aging} xKey="label"
              colors={[D.amber, D.indigo, D.indigoDeep, D.rose]}
              series={[{ key: "v", label: "ยอดค้างชำระ (บาท)", color: D.indigo }]} />
          </CC>
          <div className="dz-cc">
            <h4 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              ลูกค้าที่จ่ายช้าซ้ำ ๆ
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-faint)" }}>
                (ถือว่า “ช้า” ถ้าจ่ายเกิน
                <input type="number" min={1} value={thresh}
                  onChange={(e) => setThresh(Math.max(1, Number(e.target.value) || 30))}
                  style={{ width: 48, padding: "3px 5px", fontSize: 11.5, margin: "0 4px",
                           border: "1px solid var(--border-strong)", borderRadius: 6, textAlign: "center" }} />
                วันหลังวันที่ในใบรายการ)
              </span>
            </h4>
            <div className="scroll" style={{ maxHeight: 250 }}>
              <table className="dz-tbl">
                <thead><tr>
                  <th>ผู้รับ / ผู้ส่ง</th><th className="n">จำนวนบิลจ่ายช้า</th>
                  <th className="n">จ่ายช้าเฉลี่ย (วัน)</th><th className="n">ยอดที่เกี่ยวข้อง</th>
                </tr></thead>
                <tbody>
                  {late.length === 0
                    ? <Empty cols={4} text="ไม่พบลูกค้าที่จ่ายช้าเกินเกณฑ์ในตัวกรองปัจจุบัน" />
                    : late.map((x) => (
                      <tr key={x.name}>
                        <td><ShortId v={x.name} /></td>
                        <td className="n">{fmt(x.n)}</td>
                        <td className="n">{fmt(x.avg, 1)}</td>
                        <td className="n">{fmt(x.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="รายการค้างชำระทั้งหมด">
            <input style={{ ...searchStyle, minWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหา ผู้ส่ง / ผู้รับ / เลขที่บิล / เลขที่ใบรายการ" />
          </TableHead>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>แหล่งข้อมูล</th><th>วันที่</th><th>เลขที่ใบรายการ</th><th>เลขที่บิล</th><th>ประเภทสินค้า</th>
                <th>ผู้ส่ง</th><th>ผู้รับ</th><th>ประเภทการชำระ</th>
                <th className="n">ค้างชำระ</th><th className="n">ค้าง (วัน)</th><th>ชำระ</th>
              </tr></thead>
              <tbody>
                {unpaidList.length === 0
                  ? <Empty cols={11} text="ไม่มีรายการค้างชำระ" />
                  : unpaidList.map((x: DebtRow) => (
                    <tr key={x.key}>
                      <td><span className={"badge " + (x.old ? "src-old" : "src-new")}>{x.old ? "เก่า" : "ใหม่"}</span></td>
                      <td>{thDateSafe(x.date)}</td>
                      <td className="doc">{x.docNo || "–"}</td>
                      <td style={{ fontWeight: 600 }}>{x.no || "–"}</td>
                      <td>{x.goodsType || "–"}</td>
                      <td><ShortId v={x.sender} /></td>
                      <td><ShortId v={x.receiver} /></td>
                      <td>{x.payType || "–"}</td>
                      <td className="n">{fmt(num(x.total))}</td>
                      <td className="n">{x.aging == null ? "–" : x.aging}</td>
                      <td>{x.old
                        ? <span className="locknote">แก้ในชีต</span>
                        : <button className="btn-mini" type="button" onClick={() => openPay(x)}>บันทึกจ่าย</button>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Pane>
    </>
  );
}
