/**
 * Manager Dashboard (เมนู id `dash-fleet` · เจ้าของงานส่งสเปก 26 ก.ย. 2569) — แทนเนื้อหาเดิมของ FleetDash ทั้งหน้า
 * (โค้ด FleetDash ยังอยู่ · สถานะกองรถของฝ่ายจัดรถไม่กระทบ) · สูตรทั้งหมดอยู่ใน lib/manager/manager.ts
 *
 *   ตัวกรองหัว: ช่วงเวลา รายวัน / รายเดือน / รายไตรมาส / รายปี + เลือกค่า (ตั้งต้น = ช่วงล่าสุดที่ไฟล์มีข้อมูล) · สาขา
 *   สาขา: ผู้จัดการ = สาขาที่เลือกในหน้าต่างหลังเข้าหน้า (ล็อก) · ผู้ดูแลระบบ = ทุกสาขา (ตั้งต้น) หรือเลือกสาขาเดียว
 *         "ทุกสาขา" เท่านั้นที่มีตารางเปรียบเทียบรายสาขา (เจ้าของงานเลือกแบบตารางอย่างเดียว)
 *   แท็บหน้างาน: การ์ด 4 ใบ (เที่ยวทั้งหมด · ผ่าน · เฝ้าระวัง · ไม่ผ่าน ตามสถานะรวม LF + Margin) + ตารางเที่ยวที่กำลังวิ่งในช่วง
 *              พร้อมคำแนะนำรายเที่ยว (27 ก.ย. 2569 — เดิมให้สีตาม LF อย่างเดียว)
 *   แท็บการเงิน: การ์ด 3 ใบ (กำไร · รายได้ · ต้นทุน ของเที่ยวที่ปล่อยรถในช่วง) + ลูกหนี้คงค้าง ณ สิ้นช่วง
 *              (การ์ด 5 ใบ + วางบิล/เก็บเงินในช่วง + ตารางลูกค้า + ตารางบิล · 27 ก.ย. 2569)
 *   ตารางทุกตัวเรียงได้ทุกคอลัมน์ (useSort) + แถวกรองรายคอลัมน์ (colFilter.tsx) · ช่องค้นหาเลขที่ใบ/บิล/ลูกค้าอยู่ในแถวกรอง
 *   กล่อง "ต้องจัดการ" (27 ก.ย. 2569): กดแล้วพาไปตารางพร้อมตัวกรอง (focus → ส่วนลูกล้าง onFocusDone) ·
 *   แถบสรุปปัญหาเหนือตารางเที่ยว (issue ของ tripAdvice) · ลูกหนี้กรอง "เกิน 30 วัน" / "ครบกำหนดใน 7 วัน" ได้
 *
 * ★ หน้าเดียว ตามไฟล์ "Dashboard ผู้จัดการสาขา.html" (เจ้าของงานส่ง 28 ก.ย. 2569 · ไม่มีแท็บแล้ว — ปุ่ม Fleet Operations /
 *   Profit & Collections ที่หัวกลายเป็นปุ่มเลื่อนไปส่วนนั้น · ส่วนเดิม "ห้ามตัดอะไรทิ้ง") เรียงตามความสำคัญของผู้บริหาร (เจ้าของงานเลือก 28 ก.ย. 2569):
 *   แถบสรุปสถานการณ์ + ต้องจัดการ → การเงินสาขา (การ์ด 4 · กราฟ 6 เดือน + ค่าใช้จ่ายตามหมวด) → หน้างานและกองรถ (การ์ดเที่ยว + เคลม ·
 *   สถานะรถ + ต้นทุน) → ลูกค้าและลูกหนี้ (อายุลูกหนี้ · รายได้แยกตามลูกค้า) → เปรียบเทียบรายสาขา (การ์ดเดียวสลับ การเงิน / สถานะเที่ยว)
 *   → ตารางเที่ยวที่กำลังวิ่ง → ลูกหนี้ค้างชำระ
 *   ส่วนในไฟล์ที่ไม่มีข้อมูล (ส่งตรงเวลา · พัสดุค้าง · COD · คนขับ · พรุ่งนี้) ไม่ทำ · สูตรภาพรวม lib/manager/overview.ts · หน้าตา Overview.tsx
 */
import { useEffect, useMemo, useRef, useState } from "react";
import TripBillsModal from "./TripBillsModal";
import { AgingBox, CostBox, CostParts, CustRevenueBox, Delta, FleetBox, MonthChart, Verdict, money, moneyText } from "./Overview";
import {
  claimsIn, costByPart, costKpis, custRevenue, finTotals, fleetStatusAt, monthlyFin, pctChange, prevPeriod,
} from "../../lib/manager/overview";
import { useRoster } from "../../lib/store/roster";
import type { ReactNode } from "react";
import DashShell, { Meta, dataRangeText } from "../../lib/ui/DashShell";
import EtlBanner from "../../lib/ui/EtlBanner";
import FilterBar from "../../lib/ui/FilterBar";
import SourceTag from "../../lib/ui/SourceTag";
import TruckLoader from "../../lib/ui/TruckLoader";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { inProfitScope, useCostRev } from "../../lib/data/useCostRev";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { useDebtors } from "../../lib/data/useDebtors";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { ShortId } from "../../lib/custmap/ShortId";
import { thDateSafe } from "../../lib/record/date";
import { loadSessionBranch } from "../../lib/store/sessionBranch";
import {
  BAND_LABEL, DEBT_STATUS_LABEL, buildTrips, fileSrc, recordSrc, byBranch, byCustomer, debtSummary, finSummary, latestPeriod, outstandingAt,
  BENCH_MIN, DUE_SOON_DAYS, OVER_BAHT, OVER_PCT, dueSoon, issueCounts, issueLabel, lfSummary, managerTodo, onRoad, periodLabel, periodOptions, periodRange, releasedIn,
} from "../../lib/manager/manager";
import type { DebtCust, DebtStatus, IssueKey, MgrBill, MgrPeriod, MgrSrc, MgrTrip, PeriodKind, Range, Todo } from "../../lib/manager/manager";
import { branchOf } from "../../lib/manager/manager";
import type { DebtorRow } from "../../lib/data/useDebtors";
import type { RoleKey, TripRecord } from "../../types/record";
import { buildForecast } from "../../lib/forecast/forecast";
import { Hero, Note } from "../dash-fleet/parts";
import { SortTable, fmt, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { useColFilters } from "./colFilter";
import { clearManagerNav, clearManagerPending, peekManagerPending, registerManagerNav, setManagerActive } from "../../lib/ui/managerNav";
import type { ManagerTabId } from "../../lib/ui/managerNav";
import ThemeScope from "../../lib/ui/ThemeScope";

const KIND_LABEL: Record<PeriodKind, string> = { day: "รายวัน", month: "รายเดือน", quarter: "รายไตรมาส", year: "รายปี" };
const ALL = "";

const BAND_DOT: Record<string, string> = { g: "🟢", y: "🟡", r: "🔴", na: "⚪" };
/** เรียงคอลัมน์สถานะ: มากไปน้อย = ผ่าน → ไม่ผ่าน */
const BAND_RANK: Record<string, number> = { g: 3, y: 2, r: 1, na: 0 };
const LF_OPTS = [
  { v: "g", label: "🟢 ≥ 70%" }, { v: "y", label: "🟡 40–70%" }, { v: "r", label: "🔴 < 40%" }, { v: "na", label: "⚪ ไม่มี LF" },
];
const MARGIN_OPTS = [{ v: "g", label: "🟢 > 10%" }, { v: "y", label: "🟡 5–10%" }, { v: "r", label: "🔴 < 5%" }];
const DEBT_DOT: Record<DebtStatus, string> = { notdue: "🟢", late30: "🟡", late60: "🟠", late61: "🔴" };
/** เรียงคอลัมน์สถานะ: มากไปน้อย = ค้างนานสุดก่อน */
const DEBT_RANK: Record<DebtStatus, number> = { notdue: 0, late30: 1, late60: 2, late61: 3 };
/** "ในเดือนพฤษภาคม 2569" / "วันที่ 31 พฤษภาคม 2569" / "ในไตรมาส 2/2569" — บอกให้ชัดว่ายอดนับเฉพาะช่วงที่เลือก ไม่ใช่ยอดสะสม */
const periodIn = (p: MgrPeriod): string =>
  p.kind === "day" ? `วันที่ ${periodLabel(p)}` : p.kind === "month" ? `ในเดือน${periodLabel(p)}` : `ใน${periodLabel(p)}`;
const share = (x: number, of: number) => (of > 0 ? `(${pct(x / of * 100, 0)})` : undefined);
/** "เดือนก่อน" / "วันก่อน" / "ไตรมาสก่อน" / "ปีก่อน" — ป้ายเทียบช่วงก่อนของการ์ด */
const PREV_WORD: Record<PeriodKind, string> = { day: "วันก่อน", month: "เดือนก่อน", quarter: "ไตรมาสก่อน", year: "ปีก่อน" };
const custCode = (n: number | null): string => (n ? `CUS${String(n).padStart(7, "0")}` : "");

/** records = ใบที่บันทึกใหม่ในโมเดล (useRecords ของ App) — ขึ้นเฉพาะใบที่ไฟล์ของบริษัทยังไม่มี */
export default function ManagerDash({ role, records }: { role: RoleKey; records: TripRecord[] }) {
  const cr = useCostRev();
  const lf = useLoadFactor();
  const debtors = useDebtors();
  const etl = useEtlStatus("costrev");
  // แถบที่หัวหน้า = สถานะรวมทุกงาน ETL (งานปันส่วนกำไรลูกค้าแปลงต่อหลังงานนี้อีกนาน)
  const etlAll = useEtlStatus("all");
  useAutoReloadOnEtl(etl, cr.reload);
  useDebtorCodes();

  /* ---------- สาขา: ผู้จัดการล็อกตามที่เลือกในหน้าต่างก่อนดูข้อมูล ---------- */
  const locked = role === "manager" ? loadSessionBranch() : null;
  const [pickBr, setPickBr] = useState(ALL);
  const branch = role === "manager" ? locked ?? "" : pickBr;

  /* ---------- เที่ยว = ไฟล์ต้นทุน + LF ---------- */
  const lfById = useMemo(() => new Map((lf.data?.trips ?? []).map((t) => [t.id, t.lf])), [lf.data]);
  const fileRows = useMemo(() => (cr.data ? fileSrc(cr.data.trips.filter(inProfitScope), lfById) : []), [cr.data, lfById]);
  // ใบใหม่: เลขซ้ำกับไฟล์ (ทั้งไฟล์ ไม่ใช่แค่ชุด inProfitScope) = ใช้ไฟล์ · ยังไม่มีต้นทุนจริง = ต้นทุนพยากรณ์
  const fc = useMemo(() => (cr.data ? buildForecast(cr.data.trips) : null), [cr.data]);
  const newRows = useMemo(
    () => recordSrc(records, new Set((cr.data?.trips ?? []).map((t) => t.id)), fc),
    [records, cr.data, fc]);
  const all = useMemo(() => buildTrips(fileRows, newRows), [fileRows, newRows]);
  // ช่วงข้อมูล = ไฟล์ + ใบที่บันทึกใหม่ (เจ้าของงานเลือก 27 ก.ย. 2569 — ช่วงตั้งต้นเปิดที่ช่วงล่าสุดของทั้งสองแหล่ง)
  const newSpan = useMemo(() => newRows.reduce<[string, string]>(
    ([lo, hi], t) => [!lo || t.d < lo ? t.d : lo, t.d > hi ? t.d : hi], ["", ""]), [newRows]);
  const maxDate = [cr.data?.manifest.dateRange.max ?? "", newSpan[1]].sort().pop() || null;
  const minDate = [cr.data?.manifest.dateRange.min ?? "", newSpan[0]].filter(Boolean).sort()[0] ?? null;

  /* ---------- ช่วงเวลา ---------- */
  const [kind, setKind] = useState<PeriodKind>("month");
  const [value, setValue] = useState<string>("");
  // ค่าตั้งต้น/เปลี่ยนชนิด = ช่วงล่าสุดที่มีข้อมูล · ใบใหม่โหลดเสร็จทีหลังได้ — เลื่อนตามเฉพาะตอนผู้ใช้ยังไม่ได้เลือกช่วงเอง
  const picked = useRef(false);
  useEffect(() => { picked.current = false; }, [kind]);
  useEffect(() => { if (maxDate && !picked.current) setValue(latestPeriod(kind, maxDate).value); }, [kind, maxDate]);
  const pickValue = (v: string) => { picked.current = true; setValue(v); };
  const period: MgrPeriod | null = value ? { kind, value } : null;
  const range = useMemo(() => (period ? periodRange(period) : null), [period?.kind, period?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const branches = useMemo(() => [...new Set(all.map((t) => t.br))].sort((a, b) => a.localeCompare(b, "th")), [all]);
  const inBranch = <T extends { br: string }>(x: T): boolean =>
    role === "manager" ? !!locked && x.br === locked : !branch || x.br === branch;

  const running = useMemo(() => (range ? all.filter((t) => onRoad(t, range) && inBranch(t)) : []), [all, range, branch]); // eslint-disable-line react-hooks/exhaustive-deps
  const released = useMemo(() => (range ? all.filter((t) => releasedIn(t, range) && inBranch(t)) : []), [all, range, branch]); // eslint-disable-line react-hooks/exhaustive-deps
  // บิลทั้งไฟล์ของสาขาที่เลือก — ส่วนลูกหนี้คิดยอดคงค้าง ณ สิ้นช่วง + กระแสของช่วงเอง
  const debtRows = useMemo(
    () => (debtors.data ? debtors.data.rows.filter((r) => inBranch({ br: branchOf(r.br) })) : []),
    [debtors.data, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ลูกหนี้คงค้าง ณ สิ้นช่วง — ใช้ทั้งแท็บ Profit & Collections และกล่อง "ต้องจัดการ"
  const open = useMemo(() => (range ? outstandingAt(debtRows, range.end) : []), [debtRows, range]);
  const todo = useMemo(() => managerTodo(running, open), [running, open]);

  /* ---------- ภาพรวมสาขา (ไฟล์ต้นแบบ) — เที่ยวดิบของสาขา + ช่วงก่อน ---------- */
  const srcs = useMemo(() => [...fileRows, ...newRows].filter((t) => inBranch({ br: branchOf(t.br) })),
    [fileRows, newRows, branch]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => (period ? periodRange(prevPeriod(period)) : null), [period?.kind, period?.value]); // eslint-disable-line react-hooks/exhaustive-deps
  const [roster] = useRoster();
  const vehicles = useMemo(() => roster.filter((v) => (role === "manager" ? !!locked && (v.branches ?? []).includes(locked)
    : !branch || (v.branches ?? []).includes(branch))), [roster, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- ปุ่มส่วน (เดิมแท็บ) = เลื่อนไปส่วนนั้น — หน้าเดียวแล้ว (28 ก.ย. 2569) ---------- */
  const [tab, setTabRaw] = useState<ManagerTabId>(() => peekManagerPending() ?? "ops");
  // กดรายการในกล่อง "ต้องจัดการ" = ตั้งตัวกรองของตาราง แล้วส่วนนั้นเลื่อนไปหาตารางเอง · ส่วนลูกใช้แล้วล้าง
  const [focus, setFocus] = useState<Focus | null>(null);
  const setTab = (t: ManagerTabId) => {
    setTabRaw(t);
    document.getElementById(`mg-sec-${t}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const go = (f: Focus) => { setTabRaw(f.tab); setFocus(f); };
  useEffect(() => {
    const first = peekManagerPending();
    clearManagerPending();
    registerManagerNav((t) => setTab(t));
    if (first) requestAnimationFrame(() => setTab(first));
    return clearManagerNav;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setManagerActive(tab); }, [tab]);
  // ปุ่ม Fleet Operations / Profit & Collections ในหัวแคปซูลเอาออกแล้ว (เจ้าของงานสั่ง 28 ก.ย. 2569 — หน้าเดียวแล้ว เลื่อนดูเอง)

  const m = cr.data?.manifest;
  const meta = m && (
    <Meta parts={[
      <>สาขา <b>{branch || (role === "manager" ? "รอเลือกสาขา" : "ทุกสาขา")}</b>{locked && " (สาขาของคุณ)"}</>,
      period ? periodLabel(period) : "",
      <span className="dh-num">{m.dateRange.min} → {m.dateRange.max}</span>,
    ]} />
  );

  const body: ReactNode = role === "manager" && !locked ? (
    <div className="card"><p className="muted">เลือกสาขาเพื่อดูข้อมูลใน Manager Dashboard</p></div>
  ) : cr.error ? (
    <div className="card"><div className="banner">{cr.error}</div></div>
  ) : !cr.data || !range || !period ? (
    <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>
  ) : (
    <>
      {/* ลำดับตามความสำคัญของผู้บริหาร (เจ้าของงานเลือก 28 ก.ย. 2569): สถานการณ์ + ต้องจัดการ → การเงิน → หน้างาน →
          ลูกค้า/ลูกหนี้ → เทียบรายสาขา → ตารางรายละเอียด */}
      <Verdict todo={todo} debts={!debtors.error && !!debtors.data} period={periodIn(period)} />
      <TodoBox todo={todo} debts={!debtors.error && !!debtors.data} go={go} />
      <section id="mg-sec-fin" className="mg-sec">
        <FinTab trips={released} srcs={srcs} range={range} prev={prev} vs={PREV_WORD[period.kind]}
          open={open} debtError={debtors.error} />
      </section>
      <section id="mg-sec-ops" className="mg-sec">
        <h3 className="mg-h mo-sec-h">หน้างานและกองรถ</h3>
        <OpsHeroes trips={running} lfSample={lf.data?.manifest.isSample} srcs={srcs} range={range} prev={prev} vs={PREV_WORD[period.kind]} />
        <div className="mo-grid mo-fit">
          <div className="dz-cc">
            <h4>สถานะรถ ({fmt(vehicles.length)} คัน · ณ {thDateSafe(range.end)})</h4>
            <FleetBox st={fleetStatusAt(vehicles, srcs, range.end)}
              lfAvg={(() => { const l = running.filter((t) => t.lf != null); return l.length ? l.reduce((x, t) => x + t.lf!, 0) / l.length : null; })()}
              emptyPct={running.length ? running.filter((t) => t.empty).length / running.length * 100 : null} />
          </div>
          <div className="dz-cc">
            <h4>ต้นทุน ({periodLabel(period)})</h4>
            <CostBox k={costKpis(srcs, range)} />
          </div>
        </div>
      </section>
      {/* อายุลูกหนี้เป็นแถบสั้น ตารางลูกค้ายาว — วางเต็มแถวทีละกล่อง ไม่จับคู่ซ้ายขวา (คู่กันแล้วกล่องอายุหนี้เหลือที่ว่าง) */}
      <h3 className="mg-h mo-sec-h">ลูกค้าและลูกหนี้</h3>
      <div className="dz-cc mo-full">
        <h4>อายุลูกหนี้ ({moneyText(open.reduce((x, b) => x + b.amount, 0))})</h4>
        {debtors.error ? <p className="dz-note">ยังไม่มีชุดข้อมูลลูกหนี้</p> : <AgingBox open={open} />}
      </div>
      <div className="dz-cc mo-full">
        <h4>รายได้แยกตามลูกค้า ({periodLabel(period)})</h4>
        {debtors.error ? <p className="dz-note">ยังไม่มีชุดข้อมูลลูกหนี้</p>
          : <CustRevenueBox {...custRevenue(debtRows, range, prev ?? range)} vs={PREV_WORD[period.kind]} />}
      </div>
      {!branch && <BranchCompare running={running} released={released} />}
      <OpsTab trips={running} records={records} lfMissing={!!lf.error}
        focus={focus?.tab === "ops" ? focus : null} onFocusDone={() => setFocus(null)} />
      <DebtPart rows={debtRows} open={open} range={range} period={period} sample={debtors.data?.manifest.isSample} error={debtors.error}
        focus={focus?.tab === "fin" ? focus : null} onFocusDone={() => setFocus(null)} />
    </>
  );

  return (
    <>
      <EtlBanner status={etlAll} />
      <DashShell sample={m?.isSample} meta={meta || undefined}
        onRefresh={cr.reload} loading={cr.loading} refreshTitle="ดึงไฟล์ที่ ETL สร้างไว้มาใหม่"
        capsule={{ tabs: null, filters: true, sub: m ? dataRangeText(m.dateRange.min, m.dateRange.max) : undefined }}>
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
                onChange={(e) => e.target.value && pickValue(e.target.value)} />
            </div>
          ) : (
            <div className="ff">
              <label>{kind === "month" ? "เดือน" : kind === "quarter" ? "ไตรมาส" : "ปี"}</label>
              <select value={value} onChange={(e) => pickValue(e.target.value)}>
                {minDate && maxDate && periodOptions(kind, minDate, maxDate).map((p) => (
                  <option key={p.value} value={p.value}>{periodLabel(p)}</option>
                ))}
              </select>
            </div>
          )}
          {role === "manager" ? (
            <div className="ff mg-lock" title="ผู้จัดการดูได้เฉพาะสาขาของตัวเอง — เปลี่ยนได้ที่ปุ่ม เปลี่ยนหน้าที่">
              <label>สาขา</label><b>{locked || "รอเลือกสาขา"}</b>
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
        {/* สีรายแท็บจากหน้าการตั้งค่า (lib/ui/ThemeScope.tsx) */}
        <ThemeScope scope={`manager:${tab}`}>{body}</ThemeScope>
      </DashShell>
    </>
  );
}

/* ================================================================ ต้องจัดการ */
type OpsFocus = { tab: "ops"; band?: "r"; issue?: IssueKey };
type FinFocus = { tab: "fin"; pick: DebtPick };
type Focus = OpsFocus | FinFocus;

/**
 * กล่อง "ต้องจัดการ" บนสุดของทั้งสองแท็บ (เจ้าของงานสั่ง 27 ก.ย. 2569) — รายการสั้นจากข้อมูลช่วง/สาขาที่เลือก
 * กดแล้วเปิดแท็บ + ตั้งตัวกรองของตาราง · รายการที่เป็น 0 ไม่แสดง · ไม่มีเลย = บอกว่าไม่มีเรื่องเร่งด่วน
 */
function TodoBox({ todo, debts, go }: { todo: Todo; debts: boolean; go: (f: Focus) => void }) {
  const items: { key: string; tone: "r" | "y" | "b"; text: ReactNode; f: Focus }[] = [];
  if (todo.fail) items.push({ key: "fail", tone: "r", f: { tab: "ops", band: "r" },
    text: <>เที่ยวไม่ผ่านเกณฑ์ <b>{fmt(todo.fail)}</b> เที่ยว{todo.failLoss ? <> (ขาดทุน <b>{fmt(todo.failLoss)}</b>)</> : null}</> });
  if (todo.topIssue) items.push({ key: "issue", tone: "y", f: { tab: "ops", issue: todo.topIssue.key },
    text: <>ปัญหาที่พบบ่อยสุด: {issueLabel(todo.topIssue.key)} <b>{fmt(todo.topIssue.n)}</b> เที่ยว</> });
  if (todo.est) items.push({ key: "est", tone: "b", f: { tab: "ops", issue: "costEst" },
    text: <>ใบใหม่รอฝ่ายบัญชีกรอกค่าใช้จ่าย <b>{fmt(todo.est)}</b> ใบ</> });
  if (debts && todo.over30.bills) items.push({ key: "over30", tone: "r", f: { tab: "fin", pick: "over30" },
    text: <>ลูกค้าค้างเกิน 30 วัน <b>{fmt(todo.over30.cust)}</b> ราย รวม <b>{fmt(Math.round(todo.over30.amount))}</b> บาท</> });
  if (debts && todo.soon.bills) items.push({ key: "soon", tone: "y", f: { tab: "fin", pick: "soon" },
    text: <>บิลครบกำหนดใน {DUE_SOON_DAYS} วัน <b>{fmt(todo.soon.cust)}</b> ราย รวม <b>{fmt(Math.round(todo.soon.amount))}</b> บาท — โทรเตือนก่อนเลยกำหนด</> });
  return (
    <div className="mg-todo">
      <h3>ต้องจัดการ</h3>
      {items.length ? (
        <ul>
          {items.map((x) => (
            <li key={x.key}>
              <button type="button" className={`mg-todo-i ${x.tone}`} onClick={() => go(x.f)}>
                <i aria-hidden="true" /><span>{x.text}</span><em>ดู →</em>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mg-todo-ok">✓ ไม่มีเรื่องที่ต้องจัดการในช่วงนี้</p>}
    </div>
  );
}

/* ================================================================ หน้างาน */
/**
 * KPI บนสุด: การ์ดเที่ยว 4 ใบ (สถานะรวม LF + Margin) + เคลม (บิลเคลียร์ของเที่ยวที่ปล่อยรถในช่วง เทียบช่วงก่อน)
 * — ย้ายออกจาก OpsTab ตอนรวมเป็นหน้าเดียว (28 ก.ย. 2569) ตำแหน่งตาม KPI แถวแรกของไฟล์ต้นแบบ
 */
function OpsHeroes({ trips, lfSample, srcs, range, prev, vs }: {
  trips: MgrTrip[]; lfSample?: boolean; srcs: MgrSrc[]; range: Range; prev: Range | null; vs: string;
}) {
  const s = useMemo(() => lfSummary(trips), [trips]);
  const share = (n: number) => (s.n ? `(${pct(n / s.n * 100, 0)})` : undefined);
  const c = useMemo(() => claimsIn(srcs, range), [srcs, range]);
  const cp = useMemo(() => (prev ? claimsIn(srcs, prev) : null), [srcs, prev]);
  return (
    <>
      <SourceTag block sample={lfSample} what="Load Factor (ไฟล์ Load Factor)" />
      <div className="dz-heroes mg-heroes5">
        <Hero kind="cust" l="เที่ยวทั้งหมด" v={fmt(s.n)} s="เที่ยวที่กำลังวิ่งในช่วงที่เลือก" />
        <Hero kind="profit" l="🟢 ผ่านเกณฑ์" v={fmt(s.g)} vSub={share(s.g)} s="คะแนน LF + Margin ≥ 1.5" />
        <Hero kind="warn" l="🟡 เฝ้าระวัง" v={fmt(s.y)} vSub={share(s.y)} s="คะแนน LF + Margin = 1" />
        <Hero kind="loss" l="🔴 ไม่ผ่านเกณฑ์" v={fmt(s.r)} vSub={share(s.r)} s="คะแนน ≤ 0.5 หรือขาดทุน" />
        <Hero kind="fleet" l="เคลม (บิลเคลียร์)" v={fmt(c.items)} unit="รายการ"
          s={<>{fmt(c.trips)} เที่ยว · {moneyText(c.amount)}<br />
            {!cp ? null : cp.items ? <Delta v={pctChange(c.items, cp.items)} vs={vs} goodUp={false} />
              : <span className="mo-d">{vs} 0 รายการ</span>}</>} />
      </div>
    </>
  );
}

function OpsTab({ trips, records, lfMissing, focus, onFocusDone }: {
  trips: MgrTrip[]; records: TripRecord[]; lfMissing: boolean;
  focus: OpsFocus | null; onFocusDone: () => void;
}) {
  /** กดแถว = ป็อบอัพรายการบิลของเที่ยวนั้น (เจ้าของงานขอ 28 ก.ย. 2569) */
  const [billTrip, setBillTrip] = useState<MgrTrip | null>(null);
  // แถบสรุปปัญหา — กดชิป = กรองตารางเหลือเที่ยวที่มีปัญหานั้น กดซ้ำเพื่อยกเลิก
  const issues = useMemo(() => issueCounts(trips), [trips]);
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const shown = useMemo(() => (issue ? trips.filter((t) => t.issues.includes(issue)) : trips), [trips, issue]);

  const cols = useMemo<Col<MgrTrip>[]>(() => [
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id,
      render: (t) => <>{t.id}{t.src === "new" && <span className="mg-new" title="ใบที่บันทึกใหม่ในโมเดล (ไฟล์ของบริษัทยังไม่มี)">ใหม่</span>}</> },
    { key: "br", label: "สาขา", get: (t) => t.br },
    { key: "d", label: "วันที่ปล่อยรถ", get: (t) => t.d, render: (t) => thDateSafe(t.d) },
    { key: "rt", label: "เส้นทาง", get: (t) => `${t.o} → ${t.de}` },
    { key: "rev", label: "รายได้", get: (t) => t.rev, num: true, render: (t) => fmt(Math.round(t.rev)) },
    { key: "cost", label: "ต้นทุน", get: (t) => t.cost, num: true,
      render: (t) => <>{fmt(Math.round(t.cost))}{t.costEst && <span className="mg-est" title="ฝ่ายบัญชียังไม่กรอกค่าใช้จ่าย — ใช้ต้นทุนพยากรณ์ (ค่าเฉลี่ยเส้นทาง × ชนิดรถ)">พยากรณ์</span>}</> },
    { key: "profit", label: "กำไร/ขาดทุน", get: (t) => t.profit, num: true,
      render: (t) => <b style={{ color: t.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(t.profit))}</b> },
    { key: "lf", label: "Load Factor", get: (t) => t.lf ?? -1, num: true,
      render: (t) => <span className={`mg-lf ${t.lfb ?? "na"}`}>
        {BAND_DOT[t.lfb ?? "na"]} {t.lf == null ? "ไม่มี LF" : pct(t.lf, 0)}{t.empty && " · เที่ยวเปล่า"}</span> },
    { key: "margin", label: "Margin", get: (t) => t.margin ?? -Infinity, num: true,
      render: (t) => <span className={`mg-lf ${t.mb ?? "na"}`}>{BAND_DOT[t.mb ?? "na"]} {t.margin == null ? "–" : pct(t.margin)}</span> },
    { key: "band", label: "สถานะ", get: (t) => BAND_RANK[t.band ?? "na"] ?? 0,
      render: (t) => <span className={`mg-band ${t.band ?? "na"}`}>{BAND_LABEL[t.band ?? "na"]}</span> },
    { key: "advice", label: "คำแนะนำ", get: (t) => t.advice.join(" · "),
      render: (t) => <ul className="mg-adv">{t.advice.map((a) => <li key={a}>{a}</li>)}</ul> },
  ], []);
  const cf = useColFilters(shown, {
    id: { kind: "text", get: (t) => t.id, placeholder: "ค้นหาเลขที่ใบรายการ" },
    br: { kind: "select", get: (t) => t.br },
    d: { kind: "select", get: (t) => t.d },
    cost: { kind: "select", get: (t) => (t.costEst ? "est" : "real"),
      opts: [{ v: "real", label: "ต้นทุนจริง" }, { v: "est", label: "ต้นทุนพยากรณ์" }] },
    rt: { kind: "select", get: (t) => `${t.o} → ${t.de}` },
    rev: { kind: "min", get: (t) => t.rev },
    profit: { kind: "select", get: (t) => (t.profit < 0 ? "loss" : "gain"),
      opts: [{ v: "gain", label: "กำไร" }, { v: "loss", label: "ขาดทุน" }] },
    lf: { kind: "select", get: (t) => t.lfb ?? "na", opts: LF_OPTS },
    margin: { kind: "select", get: (t) => t.mb ?? "na", opts: MARGIN_OPTS },
    band: { kind: "select", get: (t) => t.band ?? "na",
      opts: (["g", "y", "r"] as const).map((k) => ({ v: k, label: `${BAND_DOT[k]} ${BAND_LABEL[k]}` })) },
    advice: { kind: "text", get: (t) => t.advice.join(" "), placeholder: "ค้นหา เช่น ค่าน้ำมัน" },
  });
  const { sorted, sort, toggle } = useSort(cf.filtered, cols, { key: "d", dir: -1 });
  // มาจากกล่อง "ต้องจัดการ": ตั้งตัวกรองชุดใหม่ทั้งหมด แล้วเลื่อนไปที่ตาราง
  useEffect(() => {
    if (!focus) return;
    setIssue(focus.issue ?? null);
    cf.replace(focus.band ? { band: focus.band } : {});
    onFocusDone();
    requestAnimationFrame(() => document.getElementById("mg-ops-table")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <>
      <div className="dz-cc" style={{ marginTop: 14 }} id="mg-ops-table">
        <h4>เที่ยวรถที่กำลังวิ่ง ({fmt(sorted.length)}{cf.active || issue ? ` จาก ${fmt(trips.length)}` : ""} เที่ยว)</h4>
        {issues.length > 0 && (
          <div className="mg-issues" role="group" aria-label="สรุปปัญหาของเที่ยว">
            <span className="mg-issues-h">ปัญหาที่พบ</span>
            {issues.map((x) => (
              <button key={x.key} type="button" className={"mg-chip" + (issue === x.key ? " on" : "") + (x.key === "costEst" ? " est" : "")}
                aria-pressed={issue === x.key} onClick={() => setIssue((c) => (c === x.key ? null : x.key))}
                title="กดเพื่อดูเฉพาะเที่ยวที่มีปัญหานี้ · กดซ้ำเพื่อยกเลิก">
                {issueLabel(x.key)} <b>{fmt(x.n)}</b>
              </button>
            ))}
          </div>
        )}
        <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(t) => t.id}
          empty={trips.length ? "ไม่มีเที่ยวตามตัวกรอง" : "ไม่มีเที่ยวที่วิ่งอยู่ในช่วงที่เลือก"}
          className="mg-tbl mg-click" filterRow={cf.filterRow}
          rowProps={(t) => ({ onClick: () => setBillTrip(t), title: "กดเพื่อดูรายการบิลของเที่ยวนี้" })} />
        {billTrip && <TripBillsModal trip={billTrip} records={records} onClose={() => setBillTrip(null)} />}
        <Note>
          สถานะ = คะแนน Load Factor + Margin (เขียว 1 · เหลือง 0.5 · แดง 0): ≥ 1.5 ผ่าน · 1 เฝ้าระวัง · ≤ 0.5 ไม่ผ่าน · ขาดทุน = ไม่ผ่านเสมอ ·
          LF ≥ 70% / 40–70% / &lt; 40% · Margin &gt; 10% / 5–10% / &lt; 5% ·
          เที่ยวที่ไม่มีในไฟล์ Load Factor ให้สีตาม Margin อย่างเดียว · เที่ยววิ่งเปล่านับ LF 0% ·
          ใบที่บันทึกใหม่ในโมเดล (ป้าย "ใหม่") ขึ้นเฉพาะเลขที่ใบรายการที่ไฟล์ของบริษัทยังไม่มี · LF ของใบใหม่ = น้ำหนักบรรทุก ÷ ความจุ (กก.) จากหน้าจัดรถ ·
          ฝ่ายบัญชียังไม่กรอกค่าใช้จ่าย = ต้นทุนพยากรณ์ (ป้าย "พยากรณ์") ·
          คำแนะนำด้านต้นทุนเทียบค่าเฉลี่ยต่อเที่ยวของเส้นทาง × ชนิดรถเดียวกันทั้งไฟล์ (มีไม่ถึง {BENCH_MIN} เที่ยว = เทียบชนิดรถ)
          ชี้กลุ่มที่สูงกว่าเฉลี่ย ≥ {OVER_PCT}% และ ≥ {OVER_BAHT} บาท ·
          กำลังวิ่ง = วันปล่อยรถถึงวันที่คาดว่าถึง (ระยะทาง ÷ 500 กม./วัน ปัดขึ้น อย่างน้อย 1 วัน) ทับช่วงที่เลือก
          {lfMissing && " · โหลดไฟล์ Load Factor ไม่ได้"}
        </Note>
      </div>
    </>
  );
}

/* ================================================================ การเงิน */
/**
 * การเงินสาขา (ส่วน "การเงินสาขา" ของไฟล์ต้นแบบ): การ์ด กำไร · รายได้ · ต้นทุน (+ เทียบช่วงก่อน) · ลูกหนี้ค้างชำระ
 * → กราฟรายได้ vs ค่าใช้จ่าย 6 เดือน + ค่าใช้จ่ายตามหมวด → เปรียบเทียบรายสาขา (ของเดิม) · ส่วนลูกหนี้ละเอียดอยู่ DebtPart ท้ายหน้า
 */
function FinTab({ trips, srcs, range, prev, vs, open, debtError }: {
  trips: MgrTrip[]; srcs: MgrSrc[]; range: Range; prev: Range | null; vs: string;
  open: MgrBill[]; debtError: string | null;
}) {
  const f = useMemo(() => finSummary(trips), [trips]);
  const fp = useMemo(() => (prev ? finTotals(srcs, prev) : null), [srcs, prev]);
  const months = useMemo(() => monthlyFin(srcs, range.end), [srcs, range]);
  const parts = useMemo(() => costByPart(srcs, range), [srcs, range]);
  const owed = open.reduce((x, b) => x + b.amount, 0);
  const owed60 = open.filter((b) => b.status === "late61").reduce((x, b) => x + b.amount, 0);


  return (
    <>
      <h3 className="mg-h mo-sec-h">การเงินสาขา</h3>
      <div className="dz-heroes mg-heroes4">
        <Hero kind={f.profit < 0 ? "loss" : "profit"} l={f.profit < 0 ? "ขาดทุน" : "กำไร"} unit="บาท"
          v={fmt(Math.round(Math.abs(f.profit)))}
          s={<>{f.rev ? `Margin ${pct(f.profit / f.rev * 100)}` : "ไม่มีรายได้"}<br />
            {fp && <Delta v={pctChange(f.profit, fp.profit)} vs={vs} />}</>} />
        <Hero kind="rev" l="รายได้รวม" unit="บาท" v={fmt(Math.round(f.rev))}
          s={<>{`${fmt(f.n)} เที่ยวที่ปล่อยรถในช่วง${f.fresh ? ` · ใบใหม่ ${fmt(f.fresh)}` : ""}`}<br />
            {fp && <Delta v={pctChange(f.rev, fp.rev)} vs={vs} />}</>} />
        <Hero kind="cost" l="ต้นทุนรวม" unit="บาท" v={fmt(Math.round(f.cost))}
          s={<>{f.est ? `รวมต้นทุนพยากรณ์ ${fmt(f.est)} เที่ยว (รอฝ่ายบัญชี)` : f.fresh ? "ไฟล์ต้นทุน + ใบที่บันทึกใหม่" : "ต้นทุนจากไฟล์ต้นทุน"}<br />
            {fp && <Delta v={pctChange(f.cost, fp.cost)} vs={vs} goodUp={false} />}</>} />
        <Hero kind="cust" l="ลูกหนี้ค้างชำระ" {...money(owed)}
          s={debtError ? "ยังไม่มีชุดข้อมูลลูกหนี้" : `เกิน 60 วัน ${moneyText(owed60)}`} />
      </div>
      <div className="mo-grid mo-fin mo-fit">
        <div className="dz-cc">
          <h4>รายได้ vs ค่าใช้จ่าย 6 เดือน (ล้านบาท)</h4>
          <MonthChart data={months} />
        </div>
        <div className="dz-cc">
          <h4>ค่าใช้จ่ายแบ่งตามหมวด</h4>
          <CostParts rows={parts} />
          <p className="mo-note">แถบ = สัดส่วนของช่วงนี้ · เส้นดำ = สัดส่วนเฉลี่ย 6 เดือนก่อน (ไม่มีงบ จึงเทียบกับอดีตของสาขาเอง) · สีแดง = สูงกว่าเฉลี่ย</p>
        </div>
      </div>
    </>
  );
}

/* ================================================================ เปรียบเทียบรายสาขา */
/**
 * เทียบรายสาขา (ทุกสาขาเท่านั้น) — เดิมสองตาราง (ในส่วนการเงิน + ส่วนหน้างาน) ยาวทั้งคู่ · รวมเป็นการ์ดเดียวปุ่มสลับ
 * (เจ้าของงานเลือก 28 ก.ย. 2569) ข้อมูลครบเท่าเดิม: การเงิน = เที่ยวที่ปล่อยรถในช่วง · สถานะเที่ยว = เที่ยวที่กำลังวิ่งในช่วง
 */
function BranchCompare({ running, released }: { running: MgrTrip[]; released: MgrTrip[] }) {
  const [view, setView] = useState<"fin" | "ops">("fin");
  type FinRow = ReturnType<typeof finSummary> & { br: string };
  const finRows = useMemo(() => byBranch(released, finSummary), [released]);
  const finCols = useMemo<Col<FinRow>[]>(() => [
    { key: "br", label: "สาขา", get: (r) => r.br },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้รวม", get: (r) => r.rev, num: true, render: (r) => fmt(Math.round(r.rev)) },
    { key: "cost", label: "ต้นทุนรวม", get: (r) => r.cost, num: true, render: (r) => fmt(Math.round(r.cost)) },
    { key: "profit", label: "กำไร", get: (r) => r.profit, num: true,
      render: (r) => <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.profit))}</b> },
    { key: "m", label: "Margin", get: (r) => (r.rev ? r.profit / r.rev * 100 : -Infinity), num: true,
      render: (r) => (r.rev ? pct(r.profit / r.rev * 100) : "–") },
  ], []);
  const fin = useSort(finRows, finCols, { key: "profit", dir: -1 });
  type OpsRow = ReturnType<typeof lfSummary> & { br: string };
  const opsRows = useMemo(() => byBranch(running, lfSummary), [running]);
  const opsCols = useMemo<Col<OpsRow>[]>(() => [
    { key: "br", label: "สาขา", get: (r) => r.br },
    { key: "n", label: "เที่ยวทั้งหมด", get: (r) => r.n, num: true },
    { key: "g", label: "🟢 ผ่านเกณฑ์", get: (r) => r.g, num: true },
    { key: "y", label: "🟡 เฝ้าระวัง", get: (r) => r.y, num: true },
    { key: "r", label: "🔴 ไม่ผ่านเกณฑ์", get: (r) => r.r, num: true },
    { key: "noLf", label: "ไม่มี LF", get: (r) => r.noLf, num: true },
    { key: "gp", label: "% ผ่านเกณฑ์", get: (r) => (r.n ? r.g / r.n * 100 : 0), num: true,
      render: (r) => (r.n ? pct(r.g / r.n * 100, 0) : "–") },
  ], []);
  const ops = useSort(opsRows, opsCols, { key: "n", dir: -1 });
  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <div className="fl-tophead">
        <h4>เปรียบเทียบรายสาขา</h4>
        <div className="fl-toggle" role="group" aria-label="มุมมองการเปรียบเทียบ">
          {([["fin", "การเงิน"], ["ops", "สถานะเที่ยว"]] as const).map(([k, l]) => (
            <button key={k} type="button" className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>
      {view === "fin" ? (
        <SortTable rows={fin.sorted} cols={finCols} sort={fin.sort} onSort={fin.toggle} rowKey={(r) => r.br}
          empty="ไม่มีเที่ยวในช่วงที่เลือก" maxHeight="40vh" />
      ) : (
        <SortTable rows={ops.sorted} cols={opsCols} sort={ops.sort} onSort={ops.toggle} rowKey={(r) => r.br}
          empty="ไม่มีเที่ยวในช่วงที่เลือก" maxHeight="40vh" />
      )}
      <Note>{view === "fin" ? "การเงิน = เที่ยวที่ปล่อยรถในช่วงที่เลือก" : "สถานะเที่ยว = เที่ยวที่กำลังวิ่งในช่วงที่เลือก (สถานะรวม LF + Margin)"}</Note>
    </div>
  );
}

/* ---------------- ลูกหนี้ค้างชำระ ---------------- */
/** ตัวกรองลูกหนี้: รายช่วงอายุหนี้ (การ์ด) · over30 = เกิน 30 วัน (31–60 + 61+) · soon = ครบกำหนดใน DUE_SOON_DAYS วัน */
type DebtPick = Exclude<DebtStatus, "notdue"> | "over30" | "soon" | null;
const PICK_LABEL: Record<Exclude<DebtPick, null>, string> = {
  late30: DEBT_STATUS_LABEL.late30, late60: DEBT_STATUS_LABEL.late60, late61: DEBT_STATUS_LABEL.late61,
  over30: "เกินกำหนดเกิน 30 วัน", soon: `ครบกำหนดใน ${DUE_SOON_DAYS} วัน`,
};
const pickOk = (p: DebtPick, b: MgrBill): boolean =>
  !p ? true : p === "over30" ? b.status === "late60" || b.status === "late61" : p === "soon" ? dueSoon(b) : b.status === p;

/**
 * ลูกหนี้คงค้าง ณ วันสิ้นช่วง (27 ก.ย. 2569) — การ์ด 5 ใบ (คงค้างรวม · 1–30 · 31–60 · 61+ · DSO) + กระแสของช่วง
 * + ตารางลูกค้าที่ค้าง (กดแถว = กรองตารางบิลเหลือลูกค้ารายนั้น กดซ้ำเพื่อยกเลิก) + ตารางบิลค้าง
 */
function DebtPart({ rows, open, range, period, sample, error, focus, onFocusDone }: {
  period: MgrPeriod; open: MgrBill[]; focus: FinFocus | null; onFocusDone: () => void;
  rows: DebtorRow[]; range: { start: string; end: string }; sample?: boolean; error: string | null;
}) {
  const [pick, setPick] = useState<DebtPick>(null);
  const [pickCust, setPickCust] = useState<string | null>(null);
  const toggle = (p: Exclude<DebtPick, null>) => setPick((c) => (c === p ? null : p));
  const s = useMemo(() => debtSummary(open, rows, range), [open, rows, range]);
  const byStatus = useMemo(() => (pick ? open.filter((b) => pickOk(pick, b)) : open), [open, pick]);
  const soon = useMemo(() => open.filter(dueSoon), [open]);
  // มาจากกล่อง "ต้องจัดการ"
  useEffect(() => {
    if (!focus) return;
    setPick(focus.pick); setPickCust(null); onFocusDone();
    requestAnimationFrame(() => document.getElementById("mg-debt-cust")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const custs = useMemo(() => byCustomer(byStatus), [byStatus]);
  const shownBills = useMemo(() => (pickCust ? byStatus.filter((b) => b.cust === pickCust) : byStatus), [byStatus, pickCust]);
  const custName = (c: string) => custCode(numberForDebtor(c)) || c;

  /* ---------- ตารางลูกค้า ---------- */
  const custCols = useMemo<Col<DebtCust>[]>(() => [
    { key: "cust", label: "ลูกค้า", get: (c) => custName(c.cust),
      render: (c) => <ShortId v={c.cust} n={numberForDebtor(c.cust) ?? undefined} /> },
    { key: "br", label: "สาขา", get: (c) => c.br },
    { key: "n", label: "บิลค้าง", get: (c) => c.n, num: true },
    { key: "amount", label: "ยอดค้าง", get: (c) => c.amount, num: true, render: (c) => fmt(Math.round(c.amount)) },
    { key: "overdueAmt", label: "เลยกำหนดแล้ว", get: (c) => c.overdueAmt, num: true,
      render: (c) => (c.overdueAmt ? fmt(Math.round(c.overdueAmt)) : "–") },
    { key: "maxOver", label: "ค้างนานสุด (วัน)", get: (c) => c.maxOver, num: true,
      render: (c) => (c.maxOver ? <b style={{ color: c.maxOver > 60 ? "var(--red)" : c.maxOver > 30 ? "#B45309" : undefined }}>
        {fmt(c.maxOver)}</b> : "–") },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps
  const ccf = useColFilters(custs, {
    cust: { kind: "text", get: (c) => `${custName(c.cust)} ${c.cust}`, placeholder: "ค้นหาลูกค้า" },
    br: { kind: "text", get: (c) => c.br, placeholder: "ค้นหาสาขา" },
    n: { kind: "min", get: (c) => c.n },
    amount: { kind: "min", get: (c) => c.amount },
    overdueAmt: { kind: "min", get: (c) => c.overdueAmt },
    maxOver: { kind: "min", get: (c) => c.maxOver },
  });
  const cs = useSort(ccf.filtered, custCols, { key: "amount", dir: -1 });

  /* ---------- ตารางบิล ---------- */
  const cols = useMemo<Col<MgrBill>[]>(() => [
    { key: "doc", label: "เลขที่บิล", get: (b) => b.doc },
    { key: "cust", label: "ลูกค้า", get: (b) => custName(b.cust),
      render: (b) => <ShortId v={b.cust} n={numberForDebtor(b.cust) ?? undefined} /> },
    { key: "br", label: "สาขา", get: (b) => b.br },
    { key: "issue", label: "วันวางบิล", get: (b) => b.issue, render: (b) => thDateSafe(b.issue) },
    { key: "due", label: "ครบกำหนด", get: (b) => b.due, render: (b) => thDateSafe(b.due) },
    { key: "amount", label: "มูลค่า", get: (b) => b.amount, num: true, render: (b) => fmt(Math.round(b.amount)) },
    { key: "overdue", label: "ค้างชำระ (วัน)", get: (b) => b.overdue, num: true,
      render: (b) => (b.overdue ? fmt(b.overdue) : "–") },
    { key: "dueIn", label: "ครบกำหนดในอีก (วัน)", get: (b) => b.dueIn ?? -1, num: true,
      render: (b) => (b.dueIn == null ? "–" : dueSoon(b) ? <b className="mg-soon">{b.dueIn === 0 ? "วันนี้" : fmt(b.dueIn)}</b> : fmt(b.dueIn)) },
    { key: "status", label: "สถานะ", get: (b) => DEBT_RANK[b.status],
      render: (b) => <span className={`mg-st ${b.status}`}>{DEBT_DOT[b.status]} {DEBT_STATUS_LABEL[b.status]}</span> },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps
  const cf = useColFilters(shownBills, {
    doc: { kind: "text", get: (b) => b.doc, placeholder: "ค้นหาเลขที่บิล" },
    cust: { kind: "text", get: (b) => `${custName(b.cust)} ${b.cust}`, placeholder: "ค้นหาลูกค้า" },
    br: { kind: "select", get: (b) => b.br },
    amount: { kind: "min", get: (b) => b.amount },
    overdue: { kind: "min", get: (b) => b.overdue },
    dueIn: { kind: "select", get: (b) => (dueSoon(b) ? "soon" : ""), opts: [{ v: "soon", label: `ภายใน ${DUE_SOON_DAYS} วัน` }] },
    status: { kind: "select", get: (b) => b.status,
      opts: (Object.keys(DEBT_STATUS_LABEL) as DebtStatus[]).map((k) => ({ v: k, label: `${DEBT_DOT[k]} ${DEBT_STATUS_LABEL[k]}` })) },
  });
  const { sorted, sort, toggle: toggleSort } = useSort(cf.filtered, cols, { key: "overdue", dir: -1 });

  return (
    <div className="mg-debt">
      <h3 className="mg-h">ลูกหนี้ค้างชำระ<SourceTag sample={sample} what="ไฟล์ลูกหนี้" /></h3>
      <p className="mg-sub">ยอดคงค้าง ณ {thDateSafe(range.end)} (วันสุดท้ายของช่วง) · ทุกบิลที่ยังไม่ชำระ ไม่ว่าวางบิลเมื่อไหร่</p>
      {error ? (
        <p className="dz-note">ยังไม่มีชุดข้อมูลลูกหนี้ — วางไฟล์ในโฟลเดอร์ etl/data/debtors/ แล้วรัน ETL · {error}</p>
      ) : (
        <>
          <div className="dz-heroes dso-heroes">
            <Hero kind="cust" l="ลูกหนี้คงค้างรวม" {...money(s.outstanding)}
              s={`${fmt(s.n.all)} บิล · ยังไม่ถึงกำหนด ${moneyText(s.notdue)}`}
              onClick={() => { setPick(null); setPickCust(null); }} active={pick === null && open.length > 0} />
            <Hero kind="warn" l="เกินกำหนด 1–30 วัน" {...money(s.late30)}
              vSub={share(s.late30, s.outstanding)} s={`${fmt(s.n.late30)} บิล · กดเพื่อดูเฉพาะกลุ่มนี้`} onClick={() => toggle("late30")} active={pick === "late30"} />
            <Hero kind="loss" l="เกินกำหนด 31–60 วัน" {...money(s.late60)}
              vSub={share(s.late60, s.outstanding)} s={`${fmt(s.n.late60)} บิล · กดเพื่อดูเฉพาะกลุ่มนี้`} onClick={() => toggle("late60")} active={pick === "late60"} />
            <Hero kind="loss" l="เกินกำหนด 61 วันขึ้นไป" {...money(s.late61)}
              vSub={share(s.late61, s.outstanding)} s={`${fmt(s.n.late61)} บิล · กดเพื่อดูเฉพาะกลุ่มนี้`} onClick={() => toggle("late61")} active={pick === "late61"} />
            <Hero kind="fleet" l="อายุหนี้เฉลี่ย (DSO)" unit="วัน" v={s.dso == null ? "–" : fmt(Math.round(s.dso))}
              s={s.dso == null ? "ไม่มีบิลวางในช่วง — หารไม่ได้" : `คงค้าง ÷ วางบิลในช่วง × ${fmt(s.days)} วัน`} />
          </div>
          <div className="mg-flow">
            <span>วางบิล{periodIn(period)} <b>{fmt(Math.round(s.billed))}</b> บาท ({fmt(s.billedN)} บิล)</span>
            <span>เก็บเงินได้{periodIn(period)} <b>{fmt(Math.round(s.collected))}</b> บาท ({fmt(s.collectedN)} บิล)</span>
          </div>

          <div className="dz-cc" style={{ marginTop: 14 }} id="mg-debt-cust">
            <h4>
              ลูกค้าที่ค้างชำระ ({fmt(cs.sorted.length)} ราย)
              {pick && <span className="cp-pick"> · {PICK_LABEL[pick]}</span>}
            </h4>
            <div className="mg-issues">
              <button type="button" className={"mg-chip soon" + (pick === "soon" ? " on" : "")} aria-pressed={pick === "soon"}
                onClick={() => toggle("soon")} title="ลูกค้าที่มีบิลครบกำหนดภายใน 7 วันหลังวันสิ้นช่วง — โทรเตือนก่อนเลยกำหนด">
                ⏰ ครบกำหนดใน {DUE_SOON_DAYS} วัน <b>{fmt(new Set(soon.map((b) => b.cust)).size)} ราย · {fmt(Math.round(soon.reduce((x, b) => x + b.amount, 0)))} บาท</b>
              </button>
              <button type="button" className={"mg-chip" + (pick === "over30" ? " on" : "")} aria-pressed={pick === "over30"}
                onClick={() => toggle("over30")}>
                เกินกำหนดเกิน 30 วัน <b>{fmt(Math.round(s.late60 + s.late61))} บาท</b>
              </button>
            </div>
            <SortTable rows={cs.sorted} cols={custCols} sort={cs.sort} onSort={cs.toggle} rowKey={(c) => c.cust}
              empty={open.length ? "ไม่มีลูกค้าตามตัวกรอง" : "ไม่มีบิลค้างชำระ ณ วันสิ้นช่วง"}
              className="mg-tbl mg-click" filterRow={ccf.filterRow} maxHeight="45vh"
              rowProps={(c) => ({
                onClick: () => setPickCust((x) => (x === c.cust ? null : c.cust)),
                className: pickCust === c.cust ? "on" : undefined,
                title: "กดเพื่อดูบิลของลูกค้ารายนี้ · กดซ้ำเพื่อยกเลิก",
              })} />
            <Note>กดแถวเพื่อดูบิลของลูกค้ารายนั้นในตารางด้านล่าง · ค้างนานสุด = บิลที่เลยกำหนดนานที่สุดของลูกค้า</Note>
          </div>

          <div className="dz-cc" style={{ marginTop: 14 }}>
            <h4>
              บิลค้างชำระ ({fmt(sorted.length)} บิล)
              {pick && <span className="cp-pick"> · {PICK_LABEL[pick]}</span>}
              {pickCust && <span className="cp-pick"> · ลูกค้า {custName(pickCust)}
                <button type="button" className="mg-x" onClick={() => setPickCust(null)} aria-label="ยกเลิกเลือกลูกค้า">×</button></span>}
            </h4>
            <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggleSort} rowKey={(b) => b.doc}
              empty={open.length ? "ไม่มีบิลตามตัวกรอง" : "ไม่มีบิลค้างชำระ ณ วันสิ้นช่วง"}
              className="mg-tbl" filterRow={cf.filterRow} />
            <Note>
              ลูกหนี้คงค้าง = ทุกบิลที่วางแล้วและยังไม่ชำระ ณ วันสุดท้ายของช่วง ไม่ว่าวางบิลเมื่อไหร่ (รวมที่ยังไม่ถึงกำหนด) ·
              ค้างชำระ (วัน) = วันที่เลยกำหนด ณ วันนั้น · วางบิล/เก็บเงินได้ในช่วง = วันวางบิล/วันที่จบอยู่ในช่วง ·
              DSO = ลูกหนี้คงค้าง ÷ ยอดวางบิลในช่วง × จำนวนวันในช่วง · เห็นเฉพาะบิลที่อยู่ในไฟล์ลูกหนี้ ·
              กดการ์ดเกินกำหนด/ปุ่มเหนือตารางลูกค้าเพื่อกรองทั้งสองตาราง กดซ้ำเพื่อยกเลิก ·
              ครบกำหนดใน {DUE_SOON_DAYS} วัน = ยังไม่ถึงกำหนด และครบภายใน {DUE_SOON_DAYS} วันหลังวันสิ้นช่วง
            </Note>
          </div>
        </>
      )}
    </div>
  );
}
