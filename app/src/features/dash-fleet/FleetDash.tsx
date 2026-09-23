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
import DashShell, { Meta } from "../../lib/ui/DashShell";
import FilterBar from "../../lib/ui/FilterBar";
import GrowBox from "../../lib/ui/GrowBox";
import { D, fmtN } from "../../lib/chart/theme";
import { CC, Empty, FF, Hero, KC, ListFF, Note, Pane, ResetBtn, SrcFF, TableHead, ZT,
         searchStyle, selectStyle } from "./parts";
import { recCost, adminWriteOff, CLEARED_GOODS } from "../../lib/cost/recCost";
import { billIsPaid, recBills } from "../../lib/record/payment";
import { debtStatus, unifyDebtRows } from "../../lib/record/debtRows";
import type { DebtRow } from "../../lib/record/debtRows";
import { daysBetween, thDateSafe, todayISO, TH_MONTHS } from "../../lib/record/date";
import { KM_PER_DAY, tripProgress, tripStart } from "../../lib/record/tripEta";
import { finishTrip } from "../../lib/store/finishTrip";
import { ShortId, custLabel } from "../../lib/custmap/ShortId";
import { useRoster } from "../../lib/store/roster";
import FleetRoster from "../entry/panels/FleetRoster";
import type { OldDebtor, RecordsState } from "../../lib/store/useRecords";
import type { RoleKey, TripRecord } from "../../types/record";

const TABS = [
  { id: "main", label: "หลัก" },
  { id: "trip", label: "กำไรรายเที่ยว" },
  { id: "customer", label: "กำไรลูกค้า" },
  { id: "fleet", label: "การใช้ประโยชน์กองรถ" },
  { id: "status", label: "สถานะกองรถ" },
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
export default function FleetDash({ state, role, sample = false }: {
  state: RecordsState; role: RoleKey;
  /** ชุดข้อมูลตัวอย่าง → ชิปเตือนในหัว (ค่าเดียวกับแถบเตือนเดิมของ App) */
  sample?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("main");
  const barRef = useRef<HTMLDivElement>(null);
  const nothing = !state.loading && state.records.length === 0 && state.oldRecords.length === 0;
  /**
   * บล็อกทั้งหน้าด้วย "กำลังโหลด..." เฉพาะตอนยังไม่เคยมีข้อมูลอะไรให้โชว์เลย (เปิดแอปครั้งแรกสุด)
   * ถ้ามีของเดิมอยู่แล้ว (จากรอบก่อน/แคช) ให้โชว์ค้างไว้เงียบ ๆ ระหว่างรีเฟรช ไม่งั้นทุกครั้งที่กด
   * "รีเฟรช" หรือเปิดแอปใหม่จะเห็นทั้งหน้าเนื้อหาหายวับไปเป็นการ์ดเปล่าเสมอ ทั้งที่ข้อมูลเก่ายังใช้ดูได้อยู่
   */
  const showLoading = state.loading && state.records.length === 0 && state.oldRecords.length === 0;
  // แท็บโผล่หลังมีข้อมูลแล้ว — ให้เส้นเลื่อนวัดตำแหน่งใหม่ตอนนั้นด้วย
  useDashInk(barRef, `${tab}:${showLoading || nothing}`);

  const newCount = state.records.length;
  const oldCount = state.oldRecords.length;
  const meta = (
    <Meta parts={[
      <><b>{fmt(newCount)}</b> ใบใหม่</>,
      <><b>{fmt(oldCount)}</b> แถวข้อมูลเก่าจากชีต</>,
      state.connected ? "เชื่อม Google Sheet แล้ว" : "ยังไม่ได้เชื่อม Google Sheet — อ่านจากในเครื่องอย่างเดียว",
    ]} />
  );

  const tabs = !showLoading && !nothing && (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {TABS.map((t) => (
        <button key={t.id} type="button"
          className={"dtab" + (tab === t.id ? " active" : "")}
          onClick={() => setTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );

  /* ปุ่มรีเฟรชอยู่ในหัว (DashShell) จึงกดได้ทุกสถานะ รวมถึงตอนยังไม่มีข้อมูล
     ไม่งั้นแดชบอร์ดที่ว่างอยู่จะดึงใบเข้ามาไม่ได้เลยถ้าไม่รีโหลดทั้งหน้า */
  return (
    <DashShell sample={sample} meta={meta} tabs={tabs || undefined}
      onRefresh={state.reload} loading={state.loading}
      refreshTitle={state.connected
        ? "ดึงใบรายการล่าสุดจาก Google Sheet มาคำนวณใหม่"
        : "ยังไม่ได้ตั้งค่า Google Sheet — อ่านจากในเครื่องอย่างเดียว"}>
      {showLoading ? (
        <div className="card"><p className="muted">กำลังโหลด...</p></div>
      ) : nothing ? (
        <div className="card">
          <h2>ยังไม่มีข้อมูล</h2>
          <p className="muted">
            ยังไม่มีใบรายการให้สรุป — กรอกใบแรกที่หน้า “บันทึกข้อมูล”
            หรือเชื่อม Google Sheet เพื่อดึงใบที่มีอยู่แล้วเข้ามา
          </p>
        </div>
      ) : (
        <>
          {tab === "main" && <MainPane state={state} />}
          {tab === "trip" && <TripPane state={state} />}
          {tab === "customer" && <CustomerPane state={state} />}
          {tab === "fleet" && <FleetPane state={state} />}
          {tab === "status" && <StatusPane state={state} role={role} />}
          {tab === "service" && <ServicePane state={state} />}
          {tab === "debt" && <DebtPane state={state} />}
        </>
      )}
    </DashShell>
  );
}

/* ============================ แท็บ: หลัก ============================ */
const MAIN_F0 = { src: "", year: "", branch: "", fleet: "", veh: "", plate: "", rectype: "", origin: "", dest: "" };

function MainPane({ state }: { state: RecordsState }) {
  /** สลับเนื้อหาในแท็บ "หลัก" เอง แทนที่จะแยกเป็นแท็บใหม่ — ปุ่มอยู่กลางแถวตัวกรอง
   * ต่อจากช่อง "ทะเบียนรถ" ตามดีไซน์ที่ขอมา */
  const [view, setView] = useState<"main" | "ops">("main");
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

  const modeSwitch = (
    <div className="op-modesw">
      <button type="button" className={view === "main" ? "active" : ""} onClick={() => setView("main")}>หลัก</button>
      <button type="button" className={view === "ops" ? "active" : ""} onClick={() => setView("ops")}>หน้างาน</button>
    </div>
  );

  return (
    <>
      <FilterBar>
        {view === "main" && <>
          <SrcFF value={f.src} onChange={set("src")} />
          <YearFF rows={base} value={f.year} onChange={set("year")} />
          <ListFF label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={duniq(base.map((r) => r.branch))} />
          <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.fleet} onChange={set("fleet")} opts={duniq(base.map((r) => r.fleetType))} />
          <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
          <ListFF label="ทะเบียนรถ" all="ทุกทะเบียน" value={f.plate} onChange={set("plate")} opts={duniq(base.map((r) => r.plate))} />
        </>}
        {modeSwitch}
        {view === "main" && <>
          <ListFF label="ประเภทใบรายการ" all="ทุกประเภทใบรายการ" value={f.rectype} onChange={set("rectype")} opts={duniq(base.map((r) => r.docType))} />
          <ListFF label="จุดขึ้น (ต้นทาง)" all="ทุกต้นทาง" value={f.origin} onChange={set("origin")} opts={duniq(base.map((r) => r.origin))} />
          <ListFF label="จุดลง (ปลายทาง)" all="ทุกปลายทาง" value={f.dest} onChange={set("dest")} opts={duniq(base.map((r) => r.dest))} />
          <ResetBtn onClick={() => setF(MAIN_F0)} />
        </>}
      </FilterBar>

      {view === "ops" ? <OpsPane state={state} /> : (
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
      )}
    </>
  );
}

/* ====================== มุมมอง "หน้างาน" ในแท็บ "หลัก" ======================
 * สลับด้วยปุ่ม op-modesw ข้างช่องตัวกรอง "ทะเบียนรถ" — ไม่ใช่แท็บแยก
 * สรุปคุณภาพงานปฏิบัติการรายวัน/รายสัปดาห์/รายเดือน — สีเขียว/เหลือง/แดง
 * ยึดโทนสีจากดีไซน์ "Dashboard ผู้บริหาร" (เขียว #2C6B44 · เหลือง #B4762A · แดง #A63A3A)
 *
 * เกณฑ์ต้นแบบให้ดู 3 อย่าง (เวลาปล่อยจริง vs แผน / Load Factor / ของตกค้าง) แต่ฟอร์มปัจจุบัน
 * มีแค่ Load Factor ต่อเที่ยวจริง ๆ (เวลาปล่อยรถตามแผนกับของตกค้างยังไม่มีช่องกรอก) จึงให้สี
 * ต่อเที่ยวจาก Load Factor อย่างเดียวไปก่อน ส่วน On-time delivery / Damage ที่มีข้อมูลอยู่แล้ว
 * (จากฝั่งบิลลูกหนี้) แสดงเป็นการ์ดแยกต่างหาก ไม่ปนกับสีของเที่ยว
 */
const OPS_F0 = { src: "", period: "today", branch: "", tier: "" };
const shiftISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const tierMeta = { green: { label: "เขียว · ผ่านเกณฑ์", ink: "var(--op-green)" },
  amber: { label: "เหลือง · เฝ้าระวัง", ink: "var(--op-amber)" },
  red: { label: "แดง · ไม่ผ่านเกณฑ์", ink: "var(--op-red)" } } as const;

function OpsPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(OPS_F0);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const base = useSourced(state, f.src);
  const { oldDebtors } = state;

  const today = todayISO();
  const periodStart = f.period === "today" ? today
    : f.period === "7d" ? shiftISO(today, -6)
    : `${today.slice(0, 7)}-01`;
  const periodLabel = f.period === "today" ? "วันนี้" : f.period === "7d" ? "7 วันล่าสุด" : "เดือนนี้";

  const recs = useMemo(() => base.filter((r) =>
    (r.date ?? "") >= periodStart && (r.date ?? "") <= today
    && (!f.branch || (r.branch ?? "") === f.branch)), [base, f.branch, periodStart, today]);

  /** ให้สีต่อเที่ยวจาก Load Factor — เกณฑ์เดียวกับแท็บ "การใช้ประโยชน์กองรถ" (_v4 เท่านั้นถึงจะมีช่องความจุ) */
  const scored = useMemo(() => recs
    .filter((r) => r._v4 && (num(r.capacity) > 0 || r.emptyLeg))
    .map((r) => {
      const factor = r.emptyLeg ? 0 : Math.min(100, Math.round(num(r.loadActual) / num(r.capacity) * 100));
      const tier: "green" | "amber" | "red" = r.emptyLeg ? "red" : factor >= 70 ? "green" : factor >= 40 ? "amber" : "red";
      const cost = recCost(r).total, rev = num(r.revenue);
      return { r, factor, tier, cost, rev, profit: rev - cost };
    }), [recs]);

  const nScored = scored.length;
  const cnt = (t: "green" | "amber" | "red") => scored.filter((x) => x.tier === t).length;
  const nGreen = cnt("green"), nAmber = cnt("amber"), nRed = cnt("red");
  const pct = (n: number) => nScored ? Math.round(n / nScored * 100) : 0;
  const passPct = pct(nGreen);
  const passTier: "green" | "amber" | "red" = passPct >= 80 ? "green" : passPct >= 70 ? "amber" : "red";
  const noData = recs.length - nScored;

  /** On-time delivery / Damage rate — จากบิลของใบในช่วงเดียวกัน (รวมข้อมูลเก่า) เหมือนแท็บ Service Performance */
  const bills = useMemo(() => {
    type B = { plannedDate: string | null; actualDate: string | null; damageStatus: string; damageQty: number };
    const out: B[] = [];
    const take = (b: Record<string, unknown>): B => ({
      plannedDate: (b.plannedDate as string) ?? null, actualDate: (b.actualDate as string) ?? null,
      damageStatus: String(b.damageStatus ?? ""), damageQty: num(b.damageQty) });
    if (f.src !== "เก่า") for (const r of recs) for (const b of recBills(r)) out.push(take(b as unknown as Record<string, unknown>));
    if (f.src !== "ใหม่") for (const d of oldDebtors)
      if ((d.date ?? "") >= periodStart && (d.date ?? "") <= today) out.push(take(d as unknown as Record<string, unknown>));
    return out;
  }, [recs, oldDebtors, f.src, periodStart, today]);
  const otBills = bills.filter((b) => b.plannedDate && b.actualDate);
  const onTimePct = otBills.length
    ? Math.round(otBills.filter((b) => (b.actualDate ?? "") <= (b.plannedDate ?? "")).length / otBills.length * 100) : null;
  const dmgBills = bills.filter((b) => b.damageStatus);
  const dmgPct = dmgBills.length
    ? Math.round(dmgBills.filter((b) => b.damageStatus !== "ปกติ").length / dmgBills.length * 100) : null;
  const dmgQty = bills.reduce((s, b) => s + b.damageQty, 0);

  const byBranch = useMemo(() => {
    const m = new Map<string, { g: number; a: number; r: number }>();
    for (const x of scored) {
      const key = x.r.branch || "(ไม่ระบุสาขา)";
      const cur = m.get(key) ?? { g: 0, a: 0, r: 0 };
      if (x.tier === "green") cur.g++; else if (x.tier === "amber") cur.a++; else cur.r++;
      m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => {
      const t = v.g + v.a + v.r, p = t ? Math.round(v.g / t * 100) : 0;
      return { name, ...v, t, p, tier: (p >= 80 ? "green" : p >= 70 ? "amber" : "red") as "green" | "amber" | "red" };
    }).sort((a, b) => b.t - a.t);
  }, [scored]);

  const tripRows = useMemo(() => {
    const rows = f.tier ? scored.filter((x) => x.tier === f.tier) : scored;
    return rows.slice().sort((a, b) => (b.r.date ?? "").localeCompare(a.r.date ?? ""));
  }, [scored, f.tier]);

  return (
    <div className="opsview">
      <FilterBar>
        <SrcFF value={f.src} onChange={set("src")} />
        <div className="ff">
          <label>ช่วงเวลา</label>
          <select value={f.period} onChange={(e) => set("period")(e.target.value)}>
            <option value="today">วันนี้</option>
            <option value="7d">7 วันล่าสุด</option>
            <option value="month">เดือนนี้</option>
          </select>
        </div>
        <ListFF label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={duniq(base.map((r) => r.branch))} />
        <ResetBtn onClick={() => setF(OPS_F0)} />
      </FilterBar>

      {/* คีย์ตาม f เพื่อให้แอนิเมชันเข้าเฟรม/แถบโต replay ใหม่ทุกครั้งที่เปลี่ยนตัวกรอง — ดูมีชีวิตขึ้นแทนที่จะโชว์ค้าง */}
      <Pane key={`${f.src}|${f.period}|${f.branch}|${f.tier}`} deps={[scored, f]}>
        <div className="op-tiles">
          <div className="op-tile green" style={{ animationDelay: ".02s" }}>
            <div className="op-head"><i className="op-dot" /><span>เขียว · ผ่านเกณฑ์</span></div>
            <div className="op-val"><b key={nGreen} data-real={fmt(nGreen)}>{fmt(nGreen)}</b><span className="op-unit">เที่ยว</span>
              <span className="op-pct">{pct(nGreen)}%</span></div>
            <div className="op-kbar"><i style={{ width: `${pct(nGreen)}%`, background: "var(--op-green)" }} /></div>
            <div className="op-sub">Load Factor ≥ 70% · ไม่ใช่เที่ยวเปล่า</div>
          </div>
          <div className="op-tile amber" style={{ animationDelay: ".08s" }}>
            <div className="op-head"><i className="op-dot" /><span>เหลือง · เฝ้าระวัง</span></div>
            <div className="op-val"><b key={nAmber} data-real={fmt(nAmber)}>{fmt(nAmber)}</b><span className="op-unit">เที่ยว</span>
              <span className="op-pct">{pct(nAmber)}%</span></div>
            <div className="op-kbar"><i style={{ width: `${pct(nAmber)}%`, background: "var(--op-amber)" }} /></div>
            <div className="op-sub">Load Factor 40–70%</div>
          </div>
          <div className="op-tile red" style={{ animationDelay: ".14s" }}>
            <div className="op-head"><i className="op-dot" /><span>แดง · ไม่ผ่านเกณฑ์</span></div>
            <div className="op-val"><b key={nRed} data-real={fmt(nRed)}>{fmt(nRed)}</b><span className="op-unit">เที่ยว</span>
              <span className="op-pct">{pct(nRed)}%</span></div>
            <div className="op-kbar"><i style={{ width: `${pct(nRed)}%`, background: "var(--op-red)" }} /></div>
            <div className="op-sub">Load Factor &lt; 40% หรือเที่ยวเปล่า</div>
          </div>
          <div className="dz-kc" style={{ animationDelay: ".2s" }}>
            <div className="l">เที่ยวที่ยังไม่มีข้อมูล Load Factor</div>
            <div className="v">{fmt(noData)}</div>
            <div className="s">จากทั้งหมด {fmt(recs.length)} เที่ยว · ยังไม่ได้กรอกความจุ/น้ำหนักบรรทุก</div>
          </div>
        </div>

        <div className="op-passcard" style={{ animationDelay: ".24s" }}>
          <div className="op-passhead">
            <h3><i className="op-livedot" style={{ background: tierMeta[passTier].ink }} />อัตราผ่านเกณฑ์ {periodLabel}</h3>
            <span className="op-passline">
              เป้าหมาย เขียว ≥ 80% ของเที่ยวที่มีข้อมูล Load Factor · ทำได้{" "}
              <b key={passPct} data-real={`${passPct}%`} style={{ fontFamily: "var(--d-num)", color: tierMeta[passTier].ink }}>{passPct}%</b>
            </span>
          </div>
          <div className="op-bar">
            <span style={{ width: `${pct(nGreen)}%`, background: "var(--op-green)" }} />
            <span style={{ width: `${pct(nAmber)}%`, background: "var(--op-amber)", transitionDelay: ".06s", animationDelay: ".06s" }} />
            <span style={{ width: `${pct(nRed)}%`, background: "var(--op-red)", transitionDelay: ".12s", animationDelay: ".12s" }} />
          </div>
          <div className="op-legend">
            <span><i style={{ background: "var(--op-green)" }} />เขียว = Load Factor ≥ 70% และไม่ใช่เที่ยวเปล่า</span>
            <span><i style={{ background: "var(--op-amber)" }} />เหลือง = Load Factor 40–70%</span>
            <span><i style={{ background: "var(--op-red)" }} />แดง = Load Factor &lt; 40% หรือเที่ยวเปล่า</span>
          </div>
        </div>

        <ZT>คุณภาพการส่งสินค้า ({periodLabel})</ZT>
        <div className="dz-cards">
          <KC dot={D.violet} l="On-time Delivery" v={onTimePct == null ? "–" : `${onTimePct}%`}
            s="ของบิลที่มีทั้งกำหนดส่งและเวลาส่งจริงในช่วงนี้"
            bar={onTimePct == null ? undefined : D.violet} />
          <KC dot={D.rose} tone="bad" l="Damage Rate" v={dmgPct == null ? "–" : `${dmgPct}%`}
            s="ของบิลที่มีข้อมูลสถานะสินค้าในช่วงนี้" />
          <KC dot={D.orange} tone="warn" l="จำนวนชิ้นเสียหาย" v={fmt(dmgQty)} s="ชิ้น" />
        </div>

        <ZT>สรุปรายสาขา ({periodLabel})</ZT>
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                <th>สาขา</th><th className="n">เที่ยวที่มีข้อมูล</th>
                <th className="n">เขียว</th><th className="n">เหลือง</th><th className="n">แดง</th>
                <th className="n">ผ่านเกณฑ์</th>
              </tr></thead>
              <tbody>
                {byBranch.length === 0 ? <Empty cols={6} text="ไม่พบเที่ยวที่มีข้อมูล Load Factor ในช่วงนี้" /> : byBranch.map((b) => (
                  <tr key={b.name}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td className="n">{fmt(b.t)}</td>
                    <td className="n" style={{ color: "var(--op-green)", fontWeight: 600 }}>{fmt(b.g)}</td>
                    <td className="n" style={{ color: "var(--op-amber)", fontWeight: 600 }}>{fmt(b.a)}</td>
                    <td className="n" style={{ color: "var(--op-red)", fontWeight: 600 }}>{fmt(b.r)}</td>
                    <td className="n"><span className={`op-status ${b.tier}`}><i />{b.p}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title={`รายเที่ยว ${periodLabel} (มีข้อมูล Load Factor)`}>
            <select style={selectStyle} value={f.tier} onChange={(e) => set("tier")(e.target.value)}>
              <option value="">ทุกสี</option>
              <option value="green">เขียว</option>
              <option value="amber">เหลือง</option>
              <option value="red">แดง</option>
            </select>
          </TableHead>
          <GrowBox rows={tripRows} render={(shownTripRows) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>สถานะ</th><th>วันที่</th><th>เลขที่ใบรายการ</th><th>สาขา</th><th>เส้นทาง</th>
                <th className="n">Load Factor</th><th className="n">รายได้</th><th className="n">ต้นทุน</th>
                <th className="n">กำไร/ขาดทุน</th>
              </tr></thead>
              <tbody>
                {tripRows.length === 0 ? <Empty cols={9} text="ไม่พบเที่ยวตามเงื่อนไข" /> : shownTripRows.map((x, i) => (
                  <tr key={i}>
                    <td><span className={`op-status op-status-dot ${x.tier}`} title={tierMeta[x.tier].label}><i /></span></td>
                    <td>{thDateSafe(x.r.date)}</td>
                    <td>{x.r.docNo || "–"}</td>
                    <td>{x.r.branch || "–"}</td>
                    <td>{routeLabel(x.r)}</td>
                    <td className="n" style={{ fontWeight: 600, color: tierMeta[x.tier].ink }}>
                      {x.r.emptyLeg ? "เที่ยวเปล่า" : `${x.factor}%`}
                    </td>
                    <td className="n">{fmt(x.rev)}</td>
                    <td className="n">{fmt(x.cost)}</td>
                    <td className="n" style={{ fontWeight: 700, color: x.profit < 0 ? "var(--red)" : "var(--green)" }}>
                      {(x.profit < 0 ? "−" : "") + fmt(Math.abs(x.profit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )} />
        </div>

        <Note>
          สีของแต่ละเที่ยวตัดสินจาก Load Factor เพียงอย่างเดียว (บรรทุกจริง ÷ ความจุ) เพราะฟอร์มยังไม่มีช่อง
          “เวลาปล่อยรถตามแผน/จริง” และ “ของตกค้าง/ลืมส่งลูกค้า” ให้คำนวณ — นับเฉพาะใบที่กรอกความจุรถแล้ว (ตั้งแต่เวอร์ชันฟอร์มที่มีช่องนี้) ·
          On-time Delivery / Damage Rate คำนวณจากข้อมูลบิลลูกหนี้ในช่วงเวลาเดียวกัน แยกจากสีของเที่ยวข้างต้น
        </Note>
      </Pane>
    </div>
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

/* ====================== แท็บ: กำไรรายเที่ยว ======================
 * ครอบคลุมสเปก "กำไรระดับเที่ยววิ่ง": ตัวกรอง ช่วงเวลา/เส้นทาง/รถ · KPI 6 ตัว ·
 * แนวโน้มรายเดือน · การกระจายอัตรากำไร · เส้นทางกำไร/ขาดทุนสูงสุด · โครงสร้างต้นทุน ·
 * ต้นทุนเฉลี่ยตามชนิดรถ · ตารางสรุปรายเส้นทางที่เรียงลำดับได้
 *
 * ต้นทุนต่อเที่ยวกับต้นทุนต่อกิโลเมตรแยกเป็นคนละกราฟ ไม่ใช่สองแกนในใบเดียว
 * เพราะคนละหน่วยกัน — แท่งที่หน่วยต่างกันในแกนเดียวเทียบความสูงกันไม่ได้
 */
const TRIP_F0 = { src: "", year: "", month: "", branch: "", fleet: "", veh: "", origin: "", dest: "", svc: "" };

/** ช่วงอัตรากำไรของกราฟการกระจาย — ขอบล่างรวม ขอบบนไม่รวม */
const MARGIN_BANDS: [number, number, string][] = [
  [-Infinity, 0, "ขาดทุน"], [0, 10, "0–10%"], [10, 20, "10–20%"],
  [20, 30, "20–30%"], [30, Infinity, "30%+"]];

type RouteSortKey = "route" | "veh" | "svc" | "trips" | "rev" | "cost" | "profit" | "margin";

function TripPane({ state }: { state: RecordsState }) {
  const [f, setF] = useState(TRIP_F0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [rsort, setRsort] = useState<{ k: RouteSortKey; dir: "asc" | "desc" }>({ k: "profit", dir: "desc" });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const base = useSourced(state, f.src);

  /** กำไรรายเที่ยวไม่หักค่าบริหาร เพราะบิลเคลียร์เป็นค่าใช้จ่ายระดับบิล ไม่ใช่ระดับเที่ยว */
  const calc = (r: TripRecord) => {
    const c = recCost(r), rev = num(r.revenue), profit = rev - c.total;
    return { r, c, rev, cost: c.total, profit, margin: rev ? profit / rev * 100 : null };
  };
  /** ignoreMonth ใช้กับกราฟแนวโน้ม ซึ่งต้องเห็นทุกเดือนถึงจะเป็นเส้นแนวโน้มได้ */
  const pass = (r: TripRecord, ignoreMonth: boolean) =>
    (!f.year || yearOf(r) === f.year)
    && (ignoreMonth || !f.month || monthOf(r) === f.month)
    && (!f.branch || (r.branch ?? "") === f.branch)
    && (!f.fleet || (r.fleetType ?? "") === f.fleet)
    && (!f.veh || (r.vehicle ?? "") === f.veh)
    && (!f.origin || (r.origin ?? "") === f.origin)
    && (!f.dest || (r.dest ?? "") === f.dest)
    && (!f.svc || (r.serviceGroup ?? "") === f.svc);

  const rows = useMemo(() => base.filter((r) => pass(r, false)).map(calc), [base, f]);
  const spanRows = useMemo(() => base.filter((r) => pass(r, true)).map(calc), [base, f]);

  const rev = rows.reduce((s, x) => s + x.rev, 0);
  const cost = rows.reduce((s, x) => s + x.cost, 0);
  const profit = rev - cost;
  const lossRows = rows.filter((x) => x.profit < 0);
  const marginRows = rows.filter((x) => x.margin != null);

  const hist = MARGIN_BANDS.map(([lo, hi, label]) => ({
    label, n: marginRows.filter((x) => (x.margin ?? 0) >= lo && (x.margin ?? 0) < hi).length }));
  const histColors = [D.rose, D.amber, D.mint[1], D.mint[2], D.emerald];

  /** แนวโน้มรายเดือน — ไม่สนตัวกรองเดือน ไม่งั้นเหลือจุดเดียวบนเส้น */
  const trend = useMemo(() => {
    const m = new Map<string, { rev: number; cost: number }>();
    for (const x of spanRows) {
      const key = monthOf(x.r);
      if (!key) continue;
      const cur = m.get(key) ?? { rev: 0, cost: 0 };
      cur.rev += x.rev; cur.cost += x.cost; m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ m: mLabel(k), rev: v.rev, cost: v.cost, profit: v.rev - v.cost }));
  }, [spanRows]);

  /** สรุปรายเส้นทาง × ชนิดรถ × กลุ่มบริการ — ใช้ทั้งกราฟ Top 5 และตารางสรุป */
  const routeRows = useMemo(() => {
    const m = new Map<string, {
      route: string; veh: string; svc: string;
      trips: number; rev: number; cost: number;
    }>();
    for (const x of rows) {
      const route = routeLabel(x.r), veh = x.r.vehicle || "–", svc = x.r.serviceGroup || "–";
      const key = `${route}\u0000${veh}\u0000${svc}`;
      const cur = m.get(key) ?? { route, veh, svc, trips: 0, rev: 0, cost: 0 };
      cur.trips += 1; cur.rev += x.rev; cur.cost += x.cost;
      m.set(key, cur);
    }
    return [...m.values()].map((v) => ({
      ...v, profit: v.rev - v.cost, margin: v.rev ? (v.rev - v.cost) / v.rev * 100 : null }));
  }, [rows]);

  /** Top 5 กำไร/ขาดทุน ยุบตามเส้นทางล้วน ไม่แยกชนิดรถ — คำถามคือ "เส้นทางไหน" */
  const byRoute = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of rows) {
      const key = routeLabel(x.r);
      m.set(key, (m.get(key) ?? 0) + x.profit);
    }
    return [...m.entries()].map(([name, v]) => ({ name, v }));
  }, [rows]);
  const topRoutes = byRoute.filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
  const lossRoutes = byRoute.filter((x) => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 5)
    .map((x) => ({ name: x.name, v: Math.abs(x.v) }));

  const costMix = [
    { name: "น้ำมันเชื้อเพลิง", v: rows.reduce((s, x) => s + x.c.fuel, 0) },
    { name: "เบี้ยเลี้ยงคนขับ", v: rows.reduce((s, x) => s + x.c.driver, 0) },
    { name: "ค่าซ่อมบำรุง", v: rows.reduce((s, x) => s + x.c.repair, 0) },
    { name: "ค่าธรรมเนียมอื่นๆ", v: rows.reduce((s, x) => s + x.c.other, 0) },
    { name: "ต้นทุนสูญเปล่า", v: rows.reduce((s, x) => s + x.c.waste, 0) },
  ];
  const costMixColors = [D.violet, D.teal, D.orange, D.indigo, D.rose];

  /** ต้นทุนเฉลี่ยตามชนิดรถ — ต่อกิโลเมตรนับเฉพาะเที่ยวที่กรอกระยะทางไว้ */
  const byVeh = useMemo(() => {
    const m = new Map<string, { cost: number; trips: number; kmCost: number; km: number }>();
    for (const x of rows) {
      const key = x.r.vehicle || "–";
      const cur = m.get(key) ?? { cost: 0, trips: 0, kmCost: 0, km: 0 };
      cur.cost += x.cost; cur.trips += 1;
      const km = num(x.r.dist);
      if (km > 0) { cur.km += km; cur.kmCost += x.cost; }
      m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => ({
      name, perTrip: v.trips ? v.cost / v.trips : 0, perKm: v.km ? v.kmCost / v.km : 0 }))
      .sort((a, b) => b.perTrip - a.perTrip);
  }, [rows]);

  const sortedRoutes = useMemo(() => {
    const dir = rsort.dir === "asc" ? 1 : -1;
    return routeRows.slice().sort((a, b) => {
      const x = a[rsort.k], y = b[rsort.k];
      if (typeof x === "string" && typeof y === "string") return dir * x.localeCompare(y, "th");
      return dir * ((x ?? -Infinity) as number - ((y ?? -Infinity) as number));
    });
  }, [routeRows, rsort]);

  const rTh = (k: RouteSortKey, label: string, n?: boolean) => (
    <th className={n ? "n" : undefined} onClick={() => setRsort((p) => ({
      k, dir: p.k === k && p.dir === "desc" ? "asc" : "desc" }))}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{rsort.k === k ? (rsort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = needle
      ? rows.filter((x) => `${x.r.docNo ?? ""} ${x.r.plate ?? ""} ${routeLabel(x.r)}`.toLowerCase().includes(needle))
      : rows.slice();
    return out.sort((a, b) => sort === "asc" ? a.profit - b.profit : b.profit - a.profit);
  }, [rows, q, sort]);

  /** เดือนที่เลือกได้ต้องตามปีที่กรองอยู่ ไม่งั้นเลือกแล้วได้ตารางว่าง */
  const monthOpts = duniq(base.filter((r) => !f.year || yearOf(r) === f.year).map(monthOf));

  return (
    <>
      <FilterBar>
        <SrcFF value={f.src} onChange={set("src")} />
        <YearFF rows={base} value={f.year} onChange={set("year")} />
        <FF label="เดือน" value={f.month} onChange={set("month")}>
          <option value="">ทุกเดือน</option>
          {monthOpts.map((m) => <option key={m} value={m}>{mLabel(m)}</option>)}
        </FF>
        <ListFF label="สาขา" all="ทุกสาขา" value={f.branch} onChange={set("branch")} opts={duniq(base.map((r) => r.branch))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.fleet} onChange={set("fleet")} opts={duniq(base.map((r) => r.fleetType))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
        <ListFF label="จุดขึ้น (ต้นทาง)" all="ทุกต้นทาง" value={f.origin} onChange={set("origin")} opts={duniq(base.map((r) => r.origin))} />
        <ListFF label="จุดลง (ปลายทาง)" all="ทุกปลายทาง" value={f.dest} onChange={set("dest")} opts={duniq(base.map((r) => r.dest))} />
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.svc} onChange={set("svc")} opts={duniq(base.map((r) => r.serviceGroup))} />
        <ResetBtn onClick={() => setF(TRIP_F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        <div className="dz-heroes">
          <Hero kind="rev" l="รายได้" v={fmt(rev)} s="บาท · จากเที่ยวที่ผ่านตัวกรอง" />
          <Hero kind="cost" l="ต้นทุน" v={fmt(cost)} s="บาท · ปกติ + สูญเปล่า" />
          <Hero kind={profit < 0 ? "loss" : "profit"} l="กำไร"
            v={(profit < 0 ? "−" : "") + fmt(Math.abs(profit))} s="บาท · รายได้ − ต้นทุน" />
        </div>
        <div className="dz-cards">
          <KC dot={profit < 0 ? D.rose : D.emeraldLight} tone={profit < 0 ? "bad" : "good"}
            l="อัตรากำไร" v={`${rev ? Math.round(profit / rev * 100) : 0}%`} s="ของรายได้รวม" />
          <KC dot={D.indigo} l="จำนวนเที่ยว" v={fmt(rows.length)} s="เที่ยววิ่ง" />
          <KC dot={D.rose} tone="bad" l="เที่ยวที่ขาดทุน"
            v={`${rows.length ? Math.round(lossRows.length / rows.length * 100) : 0}%`}
            s={<>{fmt(lossRows.length)} เที่ยว</>} />
        </div>

        <ZT>แนวโน้ม &amp; การกระจายกำไร</ZT>
        <div className="dz-row dz-2">
          <CC title="รายได้ · ต้นทุน · กำไร รายเดือน">
            <DLine data={trend} xKey="m" series={[
              { key: "rev", label: "รายได้", color: D.indigo },
              { key: "cost", label: "ต้นทุน", color: D.amber },
              { key: "profit", label: "กำไร", color: D.emerald }]} />
          </CC>
          <CC title="การกระจายอัตรากำไรต่อเที่ยว">
            <DBar data={hist} xKey="label" suffix=" เที่ยว" colors={histColors}
              series={[{ key: "n", label: "จำนวนเที่ยว", color: D.indigo }]} />
          </CC>
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="5 เส้นทางที่ทำกำไรสูงสุด">
            <DBar data={topRoutes} xKey="name" horiz
              series={[{ key: "v", label: "กำไรรวม", color: D.emerald }]} />
          </CC>
          <CC title="5 เส้นทางที่ขาดทุนสูงสุด">
            <DBar data={lossRoutes} xKey="name" horiz
              series={[{ key: "v", label: "ขาดทุนรวม", color: D.rose }]} />
          </CC>
        </div>

        <ZT>โครงสร้างต้นทุน</ZT>
        <div>
          <CC title="ค่าใช้จ่ายหลักในต้นทุนรวม">
            <DBar data={costMix} xKey="name" colors={costMixColors}
              series={[{ key: "v", label: "ต้นทุน", color: D.indigo }]} />
          </CC>
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title="ต้นทุนเฉลี่ยต่อเที่ยว ตามชนิดรถ">
            <DBar data={byVeh} xKey="name"
              series={[{ key: "perTrip", label: "ต้นทุน/เที่ยว", color: D.violet }]} />
          </CC>
          <CC title="ต้นทุนเฉลี่ยต่อกิโลเมตร ตามชนิดรถ">
            <DBar data={byVeh} xKey="name" digits={2} suffix=" บาท/กม."
              series={[{ key: "perKm", label: "ต้นทุน/กม.", color: D.teal }]} />
          </CC>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="สรุปรายเส้นทาง · คลิกหัวคอลัมน์เพื่อเรียงลำดับ" />
          <div className="scroll">
            <table className="dz-tbl">
              <thead><tr>
                {rTh("route", "เส้นทาง")}
                {rTh("veh", "ชนิดรถ")}
                {rTh("svc", "กลุ่มบริการ")}
                {rTh("trips", "จำนวนเที่ยว", true)}
                {rTh("rev", "รายได้", true)}
                {rTh("cost", "ต้นทุน", true)}
                {rTh("profit", "กำไร/ขาดทุน", true)}
                {rTh("margin", "อัตรากำไร", true)}
              </tr></thead>
              <tbody>
                {sortedRoutes.length === 0 ? <Empty cols={8} text="ไม่พบเส้นทางตามเงื่อนไข" /> : (
                  <>
                    {sortedRoutes.slice(0, 200).map((x, i) => (
                      <tr key={i}>
                        <td>{x.route}</td>
                        <td>{x.veh}</td>
                        <td>{x.svc}</td>
                        <td className="n">{fmt(x.trips)}</td>
                        <td className="n">{fmt(x.rev)}</td>
                        <td className="n">{fmt(x.cost)}</td>
                        <td className="n" style={{ fontWeight: 700, color: x.profit < 0 ? "var(--red)" : "var(--green)" }}>
                          {(x.profit < 0 ? "−" : "") + fmt(Math.abs(x.profit))}
                        </td>
                        <td className="n">{x.margin == null ? "–" : Math.round(x.margin) + "%"}</td>
                      </tr>
                    ))}
                    {sortedRoutes.length > 200 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 10 }}>
                        …แสดง 200 รายการแรกจากทั้งหมด {fmt(sortedRoutes.length)} รายการ · ใช้ตัวกรองเพื่อดูรายการอื่น
                      </td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
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
          <GrowBox rows={list} render={(shownList) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่ใบรายการ</th><th>เส้นทาง</th><th>ชนิดรถ</th><th>ทะเบียน</th>
                <th className="n">รายได้</th><th className="n">ต้นทุนรวม</th>
                <th className="n">กำไร/ขาดทุน</th><th className="n">อัตรากำไร</th>
              </tr></thead>
              <tbody>
                {list.length === 0 ? <Empty cols={9} text="ไม่พบเที่ยววิ่งตามเงื่อนไข" /> : (
                  <>
                    {shownList.map((x, i) => (
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
                  </>
                )}
              </tbody>
            </table>
          )} />
        </div>

        <Note>
          กำไร/ขาดทุนต่อเที่ยว = รายได้ (ช่อง “รายได้” ในฟอร์มบันทึก) − ต้นทุนรวม (ปกติ + สูญเปล่า) ต่อเที่ยว ·
          ยังไม่รวมค่าบริหาร (บิลเคลียร์) เพราะเป็นค่าใช้จ่ายระดับบิล ไม่ใช่ระดับเที่ยว ·
          กราฟแนวโน้มรายเดือนไม่สนตัวกรอง “เดือน” เพื่อให้ยังเห็นเส้นตลอดช่วง ·
          ต้นทุนต่อกิโลเมตรนับเฉพาะเที่ยวที่กรอกระยะทางไว้
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
      <FilterBar>
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
      </FilterBar>

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
          <GrowBox rows={shown} render={(shownShown) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>ลูกค้า</th><th className="n">จำนวนบิล</th><th className="n">รายได้รวม</th>
                <th className="n">ต้นทุนปันส่วน</th><th className="n">กำไร/ขาดทุน</th><th className="n">อัตรากำไร</th>
              </tr></thead>
              <tbody>
                {shown.length === 0 ? <Empty cols={6} text="ไม่พบข้อมูลลูกค้าตามเงื่อนไข" /> : (
                  <>
                    {shownShown.map((x) => (
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
                  </>
                )}
              </tbody>
            </table>
          )} />
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
      <FilterBar>
        <SrcFF value={f.src} onChange={set("src")} />
        <YearFF rows={base} value={f.year} onChange={set("year")} />
        <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.route} onChange={set("route")} opts={duniq(base.map(routeLabel))} />
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.group} onChange={set("group")} opts={duniq(base.map((r) => r.serviceGroup))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.veh} onChange={set("veh")} opts={duniq(base.map((r) => r.vehicle))} />
        <ResetBtn onClick={() => setF(FLEET_F0)} />
      </FilterBar>

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
          <GrowBox rows={lostRows} render={(shownLostRows) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่ใบรายการ</th><th>เส้นทาง</th><th>ชนิดรถ</th><th>สถานะ</th>
                <th className="n">บรรทุกจริง (กก.)</th><th className="n">ความจุ (กก.)</th>
                <th className="n">Load Factor</th><th className="n">มูลค่าเสียโอกาส</th>
              </tr></thead>
              <tbody>
                {lostRows.length === 0
                  ? <Empty cols={9} text="ยังไม่มีเที่ยวที่กรอกข้อมูลความจุ/น้ำหนักบรรทุก" />
                  : shownLostRows.map((x, i) => (
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
          )} />
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

/* ================= แท็บ: สถานะกองรถ =================
 * ยังไม่มี GPS/telematics เชื่อมจริง จึง "เดา" สถานะจากใบรายการล่าสุดของรถแต่ละคัน
 * เหมือนเปิดสมุดบันทึกเดินรถดูว่าใบล่าสุดของคันนี้ออกวันไหน ไปไหน ไกลเท่าไหร่:
 *   - รถที่ status ในทะเบียนรถไม่ใช่ "ใช้งาน" (ซ่อมบำรุง/จอด/ปลดระวาง) → ไม่ต้องดูใบเลย
 *   - ยังไม่ถึงวันที่ประมาณว่าจะถึงปลายทาง (tripProgress) → กำลังเดินทาง ตำแหน่ง = ต้นทาง→ปลายทาง
 *   - เลยวันประมาณการ / คนขับกดจบงานแล้ว / ไม่มีใบเลย → ว่าง ตำแหน่ง = จุดลงของเที่ยวล่าสุด
 * ข้อจำกัด: สดใหม่แค่เท่าที่มีคนกรอกใบหรือกดจบงาน ไม่ใช่ตำแหน่งเรียลไทม์บนแผนที่
 */
type FleetStatusKey = "idle" | "moving" | "down";
const STATUS_META: Record<FleetStatusKey, { label: string; badge: string }> = {
  idle: { label: "ว่างอยู่ที่คลัง", badge: "paid" },
  moving: { label: "กำลังเดินทาง", badge: "b1" },
  down: { label: "ไม่พร้อมใช้งาน", badge: "unpaid" },
};
/** ลำดับแสดงในตาราง "สถานะรายคัน" — เดินทาง (ต้องติดตาม) ก่อน แล้วว่าง สุดท้ายไม่พร้อมใช้งาน */
const STATUS_SORT: Record<FleetStatusKey, number> = { moving: 0, idle: 1, down: 2 };

function StatusPane({ state, role }: { state: RecordsState; role: RoleKey }) {
  const [src, setSrc] = useState("");
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | FleetStatusKey>("");
  const [busy, setBusy] = useState<string | null>(null);
  const base = useSourced(state, src);
  const [roster] = useRoster();
  const today = todayISO();

  const rows = useMemo(() => roster.map((v) => {
    // เรียงด้วยวันที่เริ่มวิ่งจริง (วันปล่อยรถก่อน ไม่มีค่อยใช้วันที่ใบ) ไม่ใช่วันที่ใบอย่างเดียว
    const trips = base.filter((r) => r.plate === v.plate)
      .slice().sort((a, b) => tripStart(b).localeCompare(tripStart(a)));
    const latest = trips[0] ?? null;
    const p = latest ? tripProgress(latest, today) : null;
    // เที่ยวที่ออกไปแล้วจริง ๆ — ใบที่ลงวันปล่อยรถไว้ล่วงหน้ายังไม่พารถไปไหน
    // ถ้าเอา dest ของใบอนาคตมาโชว์ จะกลายเป็นบอกว่ารถอยู่ปลายทางทั้งที่ยังจอดรออยู่
    const arrived = trips.find((r) => { const s = tripStart(r); return !!s && s <= today; }) ?? null;

    let statusKey: FleetStatusKey;
    let position: string;
    if (v.status !== "ใช้งาน") {
      statusKey = "down";
      position = v.status || "–";
    } else if (p?.moving) {
      statusKey = "moving";
      position = routeLabel(latest!);
    } else {
      statusKey = "idle";
      // จุดลงของเที่ยวล่าสุดที่ออกไปแล้ว = ที่ที่รถน่าจะจอดอยู่ตอนนี้
      position = arrived?.dest || (arrived ? "ไม่ระบุปลายทาง"
        : latest ? "รอออกเดินทาง" : "ไม่มีประวัติ");
    }

    return { v, latest, statusKey, position, eta: p?.eta ?? null };
  }), [roster, base, today]);

  async function onFinish(r: TripRecord) {
    if (!confirm(`ยืนยันว่าเที่ยวนี้จบแล้ว?\n${r.plate} · ${routeLabel(r)}`)) return;
    setBusy(r.id);
    try {
      await finishTrip(r, role);
      state.reload();
    } finally {
      setBusy(null);
    }
  }

  const cnt = (k: FleetStatusKey) => rows.filter((x) => x.statusKey === k).length;
  const nIdle = cnt("idle"), nMoving = cnt("moving"), nDown = cnt("down");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((x) =>
        (!filterStatus || x.statusKey === filterStatus)
        && (!needle || `${x.v.plate} ${x.v.vehicle} ${x.v.fleetType} ${x.position}`.toLowerCase().includes(needle)))
      // เดินทาง (ต้องติดตาม) ขึ้นก่อน แล้วว่าง สุดท้ายค่อยไม่พร้อมใช้งาน — ตามที่เจ้าของข้อมูลขอ
      .sort((a, b) => STATUS_SORT[a.statusKey] - STATUS_SORT[b.statusKey]);
  }, [rows, filterStatus, q]);

  return (
    <>
      <FilterBar>
        <SrcFF value={src} onChange={setSrc} />
        <div className="ff">
          <label>สถานะ</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | FleetStatusKey)}>
            <option value="">ทุกสถานะ</option>
            <option value="idle">ว่างอยู่ที่คลัง</option>
            <option value="moving">กำลังเดินทาง</option>
            <option value="down">ไม่พร้อมใช้งาน</option>
          </select>
        </div>
        <ResetBtn onClick={() => { setSrc(""); setFilterStatus(""); setQ(""); }} />
      </FilterBar>

      <Pane deps={[rows, filterStatus, q]}>
        <div className="dz-heroes">
          <Hero kind="fleet" l="รถในกองรถทั้งหมด" v={fmt(roster.length)}
            s={<>คัน · ว่าง {fmt(nIdle)} · เดินทาง {fmt(nMoving)} · ไม่พร้อมใช้งาน {fmt(nDown)}</>} />
        </div>
        <div className="dz-cards">
          <KC dot={D.emeraldLight} tone="good" l="ว่างอยู่ที่คลัง" v={fmt(nIdle)}
            s={<>คัน · {roster.length ? Math.round(nIdle / roster.length * 100) : 0}% ของกองรถ</>} />
          <KC dot={D.indigo} l="กำลังเดินทาง" v={fmt(nMoving)}
            s={<>คัน · {roster.length ? Math.round(nMoving / roster.length * 100) : 0}% ของกองรถ</>} />
          <KC dot={D.rose} tone="bad" l="ไม่พร้อมใช้งาน" v={fmt(nDown)} s="คัน · ซ่อมบำรุง/จอด/ปลดระวาง" />
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title="สถานะรายคัน (เดาจากใบรายการล่าสุด)">
            <input style={searchStyle} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหา ทะเบียน / ชนิดรถ / ตำแหน่ง" />
          </TableHead>
          {/* เลื่อนในกล่อง (สูงสุด 60vh) หัวตารางติดบน — กองรถ 274 คัน ถ้าวางยาวทั้งหน้า
              ต้องเลื่อนผ่านทั้งตารางกว่าจะถึงแผงทะเบียนรถข้างล่าง (เจ้าของงานขอ 23 ก.ย. 2569) */}
          <GrowBox rows={shown} render={(page) => (
            <table className="dz-tbl">
              <thead><tr>
                {/* คอลัมน์ "ว่างมาแล้ว" ถูกตัดออกตามสเปก 22 ก.ย. 2569 — ตำแหน่งปัจจุบันคือจุดลงของเที่ยวล่าสุด */}
                <th>ทะเบียนรถ</th><th>ชนิดรถ</th><th>ประเภทรถ</th><th>สถานะ</th><th>ตำแหน่งปัจจุบัน</th>
                <th>ใบล่าสุด</th><th>ประมาณการเสร็จ</th><th />
              </tr></thead>
              <tbody>
                {page.length === 0 ? <Empty cols={8} text="ไม่พบรถตามเงื่อนไข" /> : page.map((x) => (
                  <tr key={x.v.plate}>
                    <td style={{ fontWeight: 700 }}>{x.v.plate}</td>
                    <td>{x.v.vehicle || "–"}</td>
                    <td>{x.v.fleetType || "–"}</td>
                    <td><span className={`badge ${STATUS_META[x.statusKey].badge}`}>{STATUS_META[x.statusKey].label}</span></td>
                    <td>{x.position}</td>
                    <td>{x.latest ? `${thDateSafe(x.latest.date)} · ${x.latest.docNo || "–"}` : "ไม่มีประวัติ"}</td>
                    <td>{x.statusKey === "moving" ? (x.eta ? thDateSafe(x.eta) : "ไม่ทราบ") : "–"}</td>
                    <td>
                      {/* ใบข้อมูลเก่าจากชีตแก้ไม่ได้ จึงไม่มีปุ่มให้กด */}
                      {x.statusKey === "moving" && x.latest && x.latest.source !== "เก่า" && (
                        <button type="button" className="btn-mini" disabled={busy === x.latest.id}
                          onClick={() => onFinish(x.latest!)}>
                          {busy === x.latest.id ? "กำลังบันทึก..." : "จบงาน"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )} />
        </div>

        <Note>
          ทุกอย่างในหน้านี้เดาจากใบรายการล่าสุดของรถคันนั้น ไม่ใช่ตำแหน่ง GPS จริง ·
          “ประมาณการเสร็จ” = วันปล่อยรถ + (ระยะทาง ÷ {fmt(KM_PER_DAY)} กม./วัน) ปัดขึ้น ·
          ระหว่างที่ยังไม่ถึงวันนั้นถือว่ากำลังเดินทาง พอเลยวันแล้วถือว่าถึงปลายทาง กลายเป็นรถว่าง
          ที่จุดลงของเที่ยวนั้น · กด “จบงาน” เพื่อปิดงานก่อนกำหนดได้ (คนขับกดเองได้ที่หน้า “เที่ยวรถของฉัน”) ·
          ใบที่ไม่ได้กรอกระยะทางและไม่มีเส้นทางในตาราง จะประมาณไม่ได้ ต้องกดจบงานเอง ·
          รถที่ตั้ง “สถานะ” เป็นอื่นนอกจาก “ใช้งาน” ในหน้าทะเบียนรถจะขึ้นว่าไม่พร้อมใช้งานทันทีโดยไม่ดูใบ
        </Note>

        {/* ★ แผงทะเบียนรถย้ายมาจากโซนฝ่ายจัดรถในฟอร์มบันทึกข้อมูล (สเปก 22 ก.ย. 2569)
            ฟอร์มตัดส่วนนี้ออกแล้ว การเพิ่ม/ลบรถอยู่ที่นี่ที่เดียว — ตรงกับที่ใช้ดูสถานะรถพอดี */}
        <FleetRoster />
      </Pane>
    </>
  );
}

/**
 * หน้า "สถานะกองรถ" เดี่ยว ๆ สำหรับฝ่ายเจ้าหน้าที่จัดรถ (ROLE_VIEWS.dispatch)
 *
 * เนื้อหาคือ StatusPane ตัวเดียวกับแท็บในแดชบอร์ดเต็ม — ห้ามก๊อปสูตรมาไว้อีกที่
 * ต่างกันแค่ไม่มีแถบแท็บ เพราะตำแหน่งนี้เข้าถึงได้แท็บเดียว
 *
 * ★ ไม่บล็อกด้วย "ยังไม่มีข้อมูล" เหมือน FleetDash เพราะรายชื่อรถมาจาก refdata/fleet.json
 *   ไม่ได้มาจากใบรายการ — ต่อให้ยังไม่มีใบสักใบ หน้านี้ก็ยังบอกได้ว่ากองรถมีกี่คันและว่างอยู่
 */
export function FleetStatusPage({ state, role, sample = false }: {
  state: RecordsState; role: RoleKey; sample?: boolean;
}) {
  const meta = (
    <Meta parts={[
      <><b>{fmt(state.records.length)}</b> ใบใหม่</>,
      <><b>{fmt(state.oldRecords.length)}</b> แถวข้อมูลเก่าจากชีต</>,
      state.connected ? "เชื่อม Google Sheet แล้ว" : "ยังไม่ได้เชื่อม Google Sheet — อ่านจากในเครื่องอย่างเดียว",
    ]} />
  );
  return (
    <DashShell sample={sample} meta={meta}
      onRefresh={state.reload} loading={state.loading}
      refreshTitle={state.connected
        ? "ดึงใบรายการล่าสุดจาก Google Sheet มาคำนวณใหม่"
        : "ยังไม่ได้ตั้งค่า Google Sheet — อ่านจากในเครื่องอย่างเดียว"}>
      <StatusPane state={state} role={role} />
    </DashShell>
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
      <FilterBar>
        <SrcFF value={src} onChange={setSrc} />
        <YearFF rows={raw} value={year} onChange={setYear} />
        <ListFF label="ผู้รับ (ลูกค้า)" all="ทุกลูกค้า (ผู้รับ)" value={receiver} onChange={setReceiver}
          opts={duniq(raw.map((b) => b.receiver))} />
        <ResetBtn onClick={() => { setSrc(""); setYear(""); setReceiver(""); }} />
      </FilterBar>

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
          <GrowBox rows={list} render={(shownList) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>วันที่</th><th>เลขที่บิล</th><th>ผู้รับ</th><th className="n">จำนวน</th>
                <th>กำหนดส่ง</th><th>ส่งจริง</th><th className="n">ส่งช้า (วัน)</th>
                <th>สถานะสินค้า</th><th className="n">จำนวนเสียหาย</th>
              </tr></thead>
              <tbody>
                {list.length === 0
                  ? <Empty cols={9} text="ไม่พบบิลที่ส่งช้าหรือสินค้าเสียหายตามเงื่อนไข" />
                  : shownList.map((b, i) => {
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
          )} />
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
      <FilterBar>
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
      </FilterBar>

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
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-faint)" }}>
                (ถือว่า “ช้า” ถ้าจ่ายเกิน
                <input type="number" min={1} value={thresh}
                  onChange={(e) => setThresh(Math.max(1, Number(e.target.value) || 30))}
                  style={{ width: 48, padding: "3px 5px", fontSize: 13, margin: "0 4px",
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
