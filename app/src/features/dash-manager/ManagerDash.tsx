/**
 * Manager Dashboard (เมนู id `dash-fleet` · เจ้าของงานส่งสเปก 26 ก.ย. 2569) — แทนเนื้อหาเดิมของ FleetDash ทั้งหน้า
 * (โค้ด FleetDash ยังอยู่ · สถานะกองรถของฝ่ายจัดรถไม่กระทบ) · สูตรทั้งหมดอยู่ใน lib/manager/manager.ts
 *
 *   ตัวกรองหัว: ช่วงเวลา รายวัน / รายเดือน / รายไตรมาส + เลือกค่า (ตั้งต้น = ช่วงล่าสุดที่ไฟล์มีข้อมูล) · สาขา
 *   สาขา: ผู้จัดการ = สาขาที่เลือกตอนเลือกตำแหน่ง (ล็อก) · ผู้ดูแลระบบ = ทุกสาขา (ตั้งต้น) หรือเลือกสาขาเดียว
 *         "ทุกสาขา" เท่านั้นที่มีตารางเปรียบเทียบรายสาขา (เจ้าของงานเลือกแบบตารางอย่างเดียว)
 *   แท็บหน้างาน: การ์ด 4 ใบ (เที่ยวทั้งหมด · ผ่าน · เฝ้าระวัง · ไม่ผ่าน ตาม Load Factor) + ตารางเที่ยวที่กำลังวิ่งในช่วง
 *   แท็บการเงิน: การ์ด 3 ใบ (กำไร · รายได้ · ต้นทุน ของเที่ยวที่ปล่อยรถในช่วง) + ลูกหนี้ค้างชำระ (การ์ด 4 ใบ + ตารางบิล)
 *   ตารางทุกตัวเรียงได้ทุกคอลัมน์ (useSort) + แถวกรองรายคอลัมน์ (colFilter.tsx) · ช่องค้นหาเลขที่ใบ/บิล/ลูกค้าอยู่ในแถวกรอง
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import DashShell, { Meta } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import FilterBar from "../../lib/ui/FilterBar";
import SourceTag from "../../lib/ui/SourceTag";
import TruckLoader from "../../lib/ui/TruckLoader";
import { useDashInk } from "../../lib/chart/dashfx";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { inProfitScope, useCostRev } from "../../lib/data/useCostRev";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { useDebtors } from "../../lib/data/useDebtors";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { ShortId } from "../../lib/custmap/ShortId";
import { thDateSafe } from "../../lib/record/date";
import { loadSessionBranch } from "../../lib/store/sessionBranch";
import {
  DEBT_STATUS_LABEL, LF_BAND_LABEL, billsInPeriod, buildTrips, byBranch, debtSummary, finSummary, latestPeriod,
  lfSummary, onRoad, periodLabel, periodOptions, periodRange, releasedIn,
} from "../../lib/manager/manager";
import type { DebtStatus, MgrBill, MgrPeriod, MgrTrip, PeriodKind } from "../../lib/manager/manager";
import type { RoleKey } from "../../types/record";
import { Hero, Note } from "../dash-fleet/parts";
import { SortTable, fmt, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { useColFilters } from "./colFilter";

type Tab = "ops" | "fin";
const TABS: { id: Tab; label: string }[] = [{ id: "ops", label: "หน้างาน" }, { id: "fin", label: "การเงิน" }];
const KIND_LABEL: Record<PeriodKind, string> = { day: "รายวัน", month: "รายเดือน", quarter: "รายไตรมาส" };
const ALL = "";

const BAND_DOT: Record<string, string> = { g: "🟢", y: "🟡", r: "🔴", na: "⚪" };
const DEBT_DOT: Record<DebtStatus, string> = { notdue: "🟢", late30: "🟡", late31: "🔴", paid: "✔" };
const custCode = (n: number | null): string => (n ? `CUS${String(n).padStart(7, "0")}` : "");

export default function ManagerDash({ role }: { role: RoleKey }) {
  const cr = useCostRev();
  const lf = useLoadFactor();
  const debtors = useDebtors();
  const etl = useEtlStatus("costrev");
  // แถบที่หัวหน้า = สถานะรวมทุกงาน ETL (งานปันส่วนกำไรลูกค้าแปลงต่อหลังงานนี้อีกนาน)
  const etlAll = useEtlStatus("all");
  useAutoReloadOnEtl(etl, cr.reload);
  useDebtorCodes();

  /* ---------- สาขา: ผู้จัดการล็อกตามที่เลือกตอนเลือกตำแหน่ง ---------- */
  const locked = role === "manager" ? loadSessionBranch() : null;
  const [pickBr, setPickBr] = useState(ALL);
  const branch = locked ?? pickBr;

  /* ---------- เที่ยว = ไฟล์ต้นทุน + LF ---------- */
  const lfById = useMemo(() => new Map((lf.data?.trips ?? []).map((t) => [t.id, t.lf])), [lf.data]);
  const all = useMemo(
    () => (cr.data ? buildTrips(cr.data.trips.filter(inProfitScope), lfById) : []),
    [cr.data, lfById]);
  const maxDate = cr.data?.manifest.dateRange.max ?? null;
  const minDate = cr.data?.manifest.dateRange.min ?? null;

  /* ---------- ช่วงเวลา ---------- */
  const [kind, setKind] = useState<PeriodKind>("month");
  const [value, setValue] = useState<string>("");
  // ค่าตั้งต้น/เปลี่ยนชนิด = ช่วงล่าสุดที่ไฟล์มีข้อมูล
  useEffect(() => { if (maxDate) setValue(latestPeriod(kind, maxDate).value); }, [kind, maxDate]);
  const period: MgrPeriod | null = value ? { kind, value } : null;
  const range = useMemo(() => (period ? periodRange(period) : null), [period?.kind, period?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const branches = useMemo(() => [...new Set(all.map((t) => t.br))].sort((a, b) => a.localeCompare(b, "th")), [all]);
  const inBranch = <T extends { br: string }>(x: T): boolean => !branch || x.br === branch;

  const running = useMemo(() => (range ? all.filter((t) => onRoad(t, range) && inBranch(t)) : []), [all, range, branch]); // eslint-disable-line react-hooks/exhaustive-deps
  const released = useMemo(() => (range ? all.filter((t) => releasedIn(t, range) && inBranch(t)) : []), [all, range, branch]); // eslint-disable-line react-hooks/exhaustive-deps
  const bills = useMemo(
    () => (range && debtors.data ? billsInPeriod(debtors.data.rows, range).filter(inBranch) : []),
    [debtors.data, range, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- แท็บ ---------- */
  const [tab, setTab] = useState<Tab>("ops");
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, `${tab}:${!!cr.data}`);
  const tabs = (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {TABS.map((t) => (
        <button key={t.id} type="button" className={"dtab" + (tab === t.id ? " active" : "")}
          onClick={() => setTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );

  const m = cr.data?.manifest;
  const meta = m && (
    <Meta parts={[
      <>สาขา <b>{branch || "ทุกสาขา"}</b>{locked && " (สาขาของคุณ)"}</>,
      period ? periodLabel(period) : "",
      <span className="dh-num">ข้อมูล {m.dateRange.min} → {m.dateRange.max}</span>,
    ]} />
  );

  const body: ReactNode = cr.error ? (
    <div className="card"><div className="banner">{cr.error}</div></div>
  ) : !cr.data || !range || !period ? (
    <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
  ) : role === "manager" && !locked ? (
    <div className="card"><p className="muted">ยังไม่ได้เลือกสาขา — กด "เปลี่ยนหน้าที่" แล้วเลือกตำแหน่งผู้จัดการพร้อมสาขาของคุณ</p></div>
  ) : tab === "ops" ? (
    <OpsTab trips={running} compare={!branch} lfSample={lf.data?.manifest.isSample} lfMissing={!!lf.error} />
  ) : (
    <FinTab trips={released} bills={bills} range={range} compare={!branch}
      debtSample={debtors.data?.manifest.isSample} debtError={debtors.error} />
  );

  return (
    <>
      <EtlBanner status={etlAll} />
      <DashShell sample={m?.isSample} meta={meta || undefined} tabs={tabs}
        onRefresh={cr.reload} loading={cr.loading} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้มาใหม่">
        <FilterBar>
          <div className="ff">
            <label>ช่วงเวลา</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as PeriodKind)}>
              {(Object.keys(KIND_LABEL) as PeriodKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          {kind === "day" ? (
            <div className="ff">
              <label>วันที่</label>
              <input type="date" value={value} min={minDate ?? undefined} max={maxDate ?? undefined}
                onChange={(e) => e.target.value && setValue(e.target.value)} />
            </div>
          ) : (
            <div className="ff">
              <label>{kind === "month" ? "เดือน" : "ไตรมาส"}</label>
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                {minDate && maxDate && periodOptions(kind, minDate, maxDate).map((p) => (
                  <option key={p.value} value={p.value}>{periodLabel(p)}</option>
                ))}
              </select>
            </div>
          )}
          {locked ? (
            <div className="ff mg-lock" title="ผู้จัดการดูได้เฉพาะสาขาของตัวเอง — เปลี่ยนได้ที่ปุ่ม เปลี่ยนหน้าที่">
              <label>สาขา</label><b>{locked}</b>
            </div>
          ) : (
            <div className="ff">
              <label>สาขา</label>
              <select value={pickBr} onChange={(e) => setPickBr(e.target.value)}>
                <option value={ALL}>ทุกสาขา</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </FilterBar>
        {body}
      </DashShell>
    </>
  );
}

/* ================================================================ หน้างาน */
function OpsTab({ trips, compare, lfSample, lfMissing }: {
  trips: MgrTrip[]; compare: boolean; lfSample?: boolean; lfMissing: boolean;
}) {
  const s = useMemo(() => lfSummary(trips), [trips]);
  const share = (n: number) => (s.n ? `(${pct(n / s.n * 100, 0)})` : undefined);

  const cols = useMemo<Col<MgrTrip>[]>(() => [
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
    { key: "br", label: "สาขา", get: (t) => t.br },
    { key: "d", label: "วันที่ปล่อยรถ", get: (t) => t.d, render: (t) => thDateSafe(t.d) },
    { key: "rt", label: "เส้นทาง", get: (t) => `${t.o} → ${t.de}` },
    { key: "lf", label: "Load Factor", get: (t) => t.lf ?? -1, num: true,
      render: (t) => <span className={`mg-lf ${t.band ?? "na"}`} title={LF_BAND_LABEL[t.band ?? "na"]}>
        {BAND_DOT[t.band ?? "na"]} {t.lf == null ? "ไม่มี LF" : pct(t.lf, 0)}{t.empty && " · เที่ยวเปล่า"}</span> },
    { key: "rev", label: "รายได้", get: (t) => t.rev, num: true, render: (t) => fmt(Math.round(t.rev)) },
    { key: "cost", label: "ต้นทุน", get: (t) => t.cost, num: true, render: (t) => fmt(Math.round(t.cost)) },
    { key: "profit", label: "กำไร/ขาดทุน", get: (t) => t.profit, num: true,
      render: (t) => <b style={{ color: t.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(t.profit))}</b> },
  ], []);
  const cf = useColFilters(trips, {
    id: { kind: "text", get: (t) => t.id, placeholder: "ค้นหาเลขที่ใบรายการ" },
    br: { kind: "select", get: (t) => t.br },
    d: { kind: "select", get: (t) => t.d },
    rt: { kind: "select", get: (t) => `${t.o} → ${t.de}` },
    lf: { kind: "select", get: (t) => t.band ?? "na",
      opts: (["g", "y", "r", "na"] as const).map((k) => ({ v: k, label: `${BAND_DOT[k]} ${LF_BAND_LABEL[k]}` })) },
    rev: { kind: "min", get: (t) => t.rev },
    cost: { kind: "min", get: (t) => t.cost },
    profit: { kind: "select", get: (t) => (t.profit < 0 ? "loss" : "gain"),
      opts: [{ v: "gain", label: "กำไร" }, { v: "loss", label: "ขาดทุน" }] },
  });
  const { sorted, sort, toggle } = useSort(cf.filtered, cols, { key: "d", dir: -1 });

  /* ---------- เทียบรายสาขา (ทุกสาขาเท่านั้น) ---------- */
  type BrRow = ReturnType<typeof lfSummary> & { br: string };
  const brRows = useMemo(() => byBranch(trips, lfSummary), [trips]);
  const brCols = useMemo<Col<BrRow>[]>(() => [
    { key: "br", label: "สาขา", get: (r) => r.br },
    { key: "n", label: "เที่ยวทั้งหมด", get: (r) => r.n, num: true },
    { key: "g", label: "🟢 ผ่านเกณฑ์", get: (r) => r.g, num: true },
    { key: "y", label: "🟡 เฝ้าระวัง", get: (r) => r.y, num: true },
    { key: "r", label: "🔴 ไม่ผ่านเกณฑ์", get: (r) => r.r, num: true },
    { key: "na", label: "ไม่มี LF", get: (r) => r.na, num: true },
    { key: "gp", label: "% ผ่านเกณฑ์", get: (r) => (r.n ? r.g / r.n * 100 : 0), num: true,
      render: (r) => (r.n ? pct(r.g / r.n * 100, 0) : "–") },
  ], []);
  const br = useSort(brRows, brCols, { key: "n", dir: -1 });

  return (
    <>
      <SourceTag block sample={lfSample} what="Load Factor (ไฟล์ Load Factor)" />
      <div className="dz-heroes mg-heroes">
        <Hero kind="cust" l="เที่ยวทั้งหมด" v={fmt(s.n)} s="เที่ยวที่กำลังวิ่งในช่วงที่เลือก"
          foot={s.na ? `ไม่มี LF ${fmt(s.na)} เที่ยว` : undefined} />
        <Hero kind="profit" l="🟢 ผ่านเกณฑ์" v={fmt(s.g)} vSub={share(s.g)} s="Load Factor ≥ 70%" />
        <Hero kind="warn" l="🟡 เฝ้าระวัง" v={fmt(s.y)} vSub={share(s.y)} s="Load Factor 40% ถึง < 70%" />
        <Hero kind="loss" l="🔴 ไม่ผ่านเกณฑ์" v={fmt(s.r)} vSub={share(s.r)} s="Load Factor < 40%" />
      </div>

      {compare && (
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>เปรียบเทียบรายสาขา</h4>
          <SortTable rows={br.sorted} cols={brCols} sort={br.sort} onSort={br.toggle} rowKey={(r) => r.br}
            empty="ไม่มีเที่ยวในช่วงที่เลือก" maxHeight="40vh" />
        </div>
      )}

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>เที่ยวรถที่กำลังวิ่ง ({fmt(sorted.length)}{cf.active ? ` จาก ${fmt(trips.length)}` : ""} เที่ยว)</h4>
        <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(t) => t.id}
          empty={trips.length ? "ไม่มีเที่ยวตามตัวกรองคอลัมน์" : "ไม่มีเที่ยวที่วิ่งอยู่ในช่วงที่เลือก"}
          className="mg-tbl" filterRow={cf.filterRow} />
        <Note>
          กำลังวิ่ง = ช่วงตั้งแต่วันปล่อยรถถึงวันที่คาดว่าถึง (ระยะทาง ÷ 500 กม./วัน ปัดขึ้น อย่างน้อย 1 วัน) ทับช่วงที่เลือก ·
          Load Factor จากไฟล์ Load Factor จับคู่ด้วยเลขที่ใบรายการ · เที่ยววิ่งเปล่านับเป็น 0% ·
          เที่ยวที่ไม่มีในไฟล์ Load Factor ขึ้น "ไม่มี LF" {lfMissing && "· โหลดไฟล์ Load Factor ไม่ได้"}
        </Note>
      </div>
    </>
  );
}

/* ================================================================ การเงิน */
function FinTab({ trips, bills, range, compare, debtSample, debtError }: {
  trips: MgrTrip[]; bills: MgrBill[]; range: { start: string; end: string }; compare: boolean;
  debtSample?: boolean; debtError: string | null;
}) {
  const f = useMemo(() => finSummary(trips), [trips]);

  type BrRow = ReturnType<typeof finSummary> & { br: string };
  const brRows = useMemo(() => byBranch(trips, finSummary), [trips]);
  const brCols = useMemo<Col<BrRow>[]>(() => [
    { key: "br", label: "สาขา", get: (r) => r.br },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้รวม", get: (r) => r.rev, num: true, render: (r) => fmt(Math.round(r.rev)) },
    { key: "cost", label: "ต้นทุนรวม", get: (r) => r.cost, num: true, render: (r) => fmt(Math.round(r.cost)) },
    { key: "profit", label: "กำไร", get: (r) => r.profit, num: true,
      render: (r) => <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.profit))}</b> },
    { key: "m", label: "Margin", get: (r) => (r.rev ? r.profit / r.rev * 100 : -Infinity), num: true,
      render: (r) => (r.rev ? pct(r.profit / r.rev * 100) : "–") },
  ], []);
  const br = useSort(brRows, brCols, { key: "profit", dir: -1 });

  return (
    <>
      <div className="dz-heroes mg-heroes3">
        <Hero kind={f.profit < 0 ? "loss" : "profit"} l={f.profit < 0 ? "ขาดทุน" : "กำไร"} unit="บาท"
          v={fmt(Math.round(Math.abs(f.profit)))} s={f.rev ? `Margin ${pct(f.profit / f.rev * 100)}` : "ไม่มีรายได้"} />
        <Hero kind="rev" l="รายได้รวม" unit="บาท" v={fmt(Math.round(f.rev))} s={`${fmt(f.n)} เที่ยวที่ปล่อยรถในช่วง`} />
        <Hero kind="cost" l="ต้นทุนรวม" unit="บาท" v={fmt(Math.round(f.cost))} s="ต้นทุนจากไฟล์ต้นทุน" />
      </div>

      {compare && (
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>เปรียบเทียบรายสาขา</h4>
          <SortTable rows={br.sorted} cols={brCols} sort={br.sort} onSort={br.toggle} rowKey={(r) => r.br}
            empty="ไม่มีเที่ยวในช่วงที่เลือก" maxHeight="40vh" />
        </div>
      )}

      <DebtPart bills={bills} range={range} sample={debtSample} error={debtError} />
    </>
  );
}

/* ---------------- ลูกหนี้ค้างชำระ ---------------- */
type DebtPick = "late30" | "late31" | null;

function DebtPart({ bills, range, sample, error }: {
  bills: MgrBill[]; range: { start: string; end: string }; sample?: boolean; error: string | null;
}) {
  const [pick, setPick] = useState<DebtPick>(null);
  const toggle = (p: Exclude<DebtPick, null>) => setPick((c) => (c === p ? null : p));
  const s = useMemo(() => debtSummary(bills, range), [bills, range]);
  const shownBills = useMemo(() => (pick ? bills.filter((b) => b.status === pick) : bills), [bills, pick]);

  const cols = useMemo<Col<MgrBill>[]>(() => [
    { key: "doc", label: "เลขที่บิล", get: (b) => b.doc },
    { key: "cust", label: "ลูกค้า", get: (b) => custCode(numberForDebtor(b.cust)) || b.cust,
      render: (b) => <ShortId v={b.cust} n={numberForDebtor(b.cust) ?? undefined} /> },
    { key: "br", label: "สาขา", get: (b) => b.br },
    { key: "amount", label: "มูลค่า", get: (b) => b.amount, num: true, render: (b) => fmt(Math.round(b.amount)) },
    { key: "overdue", label: "ค้างชำระ (วัน)", get: (b) => b.overdue, num: true,
      render: (b) => (b.overdue ? fmt(b.overdue) : "–") },
    { key: "status", label: "สถานะ", get: (b) => b.status,
      render: (b) => <span className={`mg-st ${b.status}`}>{DEBT_DOT[b.status]} {DEBT_STATUS_LABEL[b.status]}</span> },
  ], []);
  const cf = useColFilters(shownBills, {
    doc: { kind: "text", get: (b) => b.doc, placeholder: "ค้นหาเลขที่บิล" },
    cust: { kind: "text", get: (b) => `${custCode(numberForDebtor(b.cust))} ${b.cust}`, placeholder: "ค้นหาลูกค้า" },
    br: { kind: "select", get: (b) => b.br },
    amount: { kind: "min", get: (b) => b.amount },
    overdue: { kind: "min", get: (b) => b.overdue },
    status: { kind: "select", get: (b) => b.status,
      opts: (Object.keys(DEBT_STATUS_LABEL) as DebtStatus[]).map((k) => ({ v: k, label: `${DEBT_DOT[k]} ${DEBT_STATUS_LABEL[k]}` })) },
  });
  const { sorted, sort, toggle: toggleSort } = useSort(cf.filtered, cols, { key: "overdue", dir: -1 });

  return (
    <div className="mg-debt">
      <h3 className="mg-h">ลูกหนี้ค้างชำระ<SourceTag sample={sample} what="ไฟล์ลูกหนี้" /></h3>
      <p className="mg-sub">บิลที่วางในช่วงที่เลือก · สถานะ ณ {thDateSafe(range.end)} (วันสุดท้ายของช่วง)</p>
      {error ? (
        <p className="dz-note">ยังไม่มีชุดข้อมูลลูกหนี้ — วางไฟล์ในโฟลเดอร์ etl/data/debtors/ แล้วรัน ETL · {error}</p>
      ) : (
        <>
          <div className="dz-heroes mg-heroes">
            <Hero kind="cust" l="ลูกหนี้คงค้างรวม" unit="บาท" v={fmt(Math.round(s.outstanding))}
              s={`จากยอดวางบิล ${fmt(Math.round(s.billed))} บาท`}
              onClick={() => setPick(null)} active={pick === null && bills.length > 0} />
            <Hero kind="warn" l="ค้างเกิน 1–30 วัน" unit="บาท" v={fmt(Math.round(s.late30))}
              s="กดเพื่อดูเฉพาะบิลกลุ่มนี้" onClick={() => toggle("late30")} active={pick === "late30"} />
            <Hero kind="loss" l="ค้างเกิน 31 วันขึ้นไป" unit="บาท" v={fmt(Math.round(s.late31))}
              s="กดเพื่อดูเฉพาะบิลกลุ่มนี้" onClick={() => toggle("late31")} active={pick === "late31"} />
            <Hero kind="fleet" l="อายุหนี้เฉลี่ย (DSO)" unit="วัน" v={s.dso == null ? "–" : fmt(Math.round(s.dso))}
              s={`ยอดค้าง ÷ ยอดวางบิล × ${fmt(s.days)} วัน`} />
          </div>

          <div className="dz-cc" style={{ marginTop: 14 }}>
            <h4>
              ตารางลูกหนี้ ({fmt(sorted.length)} บิล)
              {pick && <span className="cp-pick"> · {DEBT_STATUS_LABEL[pick]}</span>}
            </h4>
            <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggleSort} rowKey={(b) => b.doc}
              empty={bills.length ? "ไม่มีบิลตามตัวกรอง" : "ไม่มีบิลที่วางในช่วงที่เลือก"}
              className="mg-tbl" filterRow={cf.filterRow} />
            <Note>
              ค้างชำระ (วัน) = วันที่เกินกำหนด ณ วันสุดท้ายของช่วง · ยังไม่ถึงกำหนด/ชำระแล้วแสดง "–" ·
              ลูกหนี้คงค้างรวม = บิลที่ยังไม่ชำระทั้งหมด (รวมที่ยังไม่ถึงกำหนด) · กดการ์ดค้างเกินเพื่อกรองตาราง กดซ้ำเพื่อยกเลิก
            </Note>
          </div>
        </>
      )}
    </div>
  );
}
