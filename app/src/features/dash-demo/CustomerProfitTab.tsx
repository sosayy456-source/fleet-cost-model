/**
 * แท็บ "กำไรลูกค้า" ของเมนู Demo — สเปกจากเอกสาร "ปรับปรุงโมเดล.pdf" (22 ก.ย. 2569) มีสองส่วนต่อกัน
 *
 * ส่วนที่ 1 · กำไรลูกค้า (ชุด alloc/ ตัวเดียวกับ "กำไรลูกค้า (ปันส่วนต้นทุน)" ใน Dashboard รายได้)
 *   1. ตัวกรอง ปี · เดือน — ยุบ cust_months.json (ลูกค้า × เดือน) กลับเป็นรายลูกค้าตามที่เลือก
 *   2. การ์ดใหญ่ 3 ใบขนาดเท่ากัน จำนวนลูกค้า · ที่ทำกำไร (%) · ที่ขาดทุน (%) **กดได้** เพื่อกรองตารางข้างล่าง
 *      กำไร = 0 นับเข้ากลุ่ม "ทำกำไร" (เจ้าของงานเคาะ 22 ก.ย. 2569 — สองกลุ่มต้องรวมกันได้เท่าจำนวนทั้งหมด)
 *      เส้นในการ์ดเป็นลวดลายตกแต่ง ไม่ใช่ข้อมูล (เจ้าของงานยืนยัน)
 *   3. กราฟแท่งจำนวนลูกค้าตามช่วง %Margin 8 ช่วง (< −20 … ≥ 40) **กดแท่งได้** เพื่อกรองตาราง
 *      ลูกค้าที่รายได้ = 0 ใช้ margin −100 ถ้าขาดทุน (ตกช่อง < −20%) / 0 ถ้าไม่ขาดทุน — สูตรเดียวกับ ETL
 *   4. ตารางใต้กราฟ คอลัมน์ชุดเดียวกับหน้ากำไรลูกค้า **ตัดคอลัมน์ผู้จ่ายออก**
 *      ตั้งต้นแสดงทุกราย เรียงตามกำไรเป็นบาทจากมากไปน้อย และเลือกดูเฉพาะรายที่กำไร/ขาดทุนได้
 *      ป้าย Top 10 คงไว้ · เปิดรายละเอียดได้ Top 100 สองฝั่งและ Top 10 ของทุกช่วง %Margin
 *      รายละเอียดแสดงสูงสุด 100 บิลล่าสุดต่อรายตามช่วงเวลาที่เลือก
 *
 * ส่วนที่ 2 · ลูกหนี้ค้างชำระ (ชุด debtors/ จากไฟล์ "ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx")
 *   อยู่ใน OverdueSection.tsx — ไม่ขึ้นกับตัวกรองปี/เดือนของส่วนที่ 1 มีตัวกรอง "ข้อมูล ณ วันที่" ของตัวเอง
 *
 * ★ อัตรากำไรใช้ marginOf() ข้างล่าง ซึ่งต้องตรงกับ margin_of() ใน etl/build_alloc.py — ETL ใช้ตัดสินเสมอ
 *   ตอนคัด Top 10 และช่วง %Margin ของกราฟต้องนับเหมือน ETL ห้ามแก้ข้างเดียว
 *
 * ★ Demo รวมเป็นหน้ายาวหน้าเดียว (24 ก.ย. 2569) — ส่วนนี้ไม่มีตัวกรองของตัวเองแล้ว ใช้ ปี/เดือน จากตัวกรองของหน้า
 *   (ชุด alloc/ ยุบได้แค่ลูกค้า × เดือนตามวันที่บิล ตัวกรองอื่นขึ้นบรรทัดบอกผ่าน FilterScope)
 *   ส่วนที่ 2 (DSO) ใช้ตัวกรองสาขาของหน้า และมี "ข้อมูล ณ วันที่" ของตัวเอง · ช่วงข้อมูล + ข้อจำกัดอยู่ในปุ่มข้อมูลเมื่ออยู่บนส่วนนี้
 *   ป้ายตัวอย่าง/จริงของแต่ละส่วนอยู่ที่ SourceTag — สองชุดเลือก real/sample แยกกัน
 *
 * ★ ท้ายส่วน (25 ก.ย. 2569): กล่อง Customer Profitability & Cash Flow Index กล่องยาว (การ์ด Damage Rate ย้ายไปข้าง Service Quality)
 *   Customer Net Profit ให้สีรายลูกค้าจากชุดเดียวกับส่วนที่ 1 (rollupCustomers) · DSO ให้สีรายบิลจากไฟล์ลูกหนี้
 *   ณ "ข้อมูล ณ วันที่" เดียวกับส่วนที่ 2 (OverdueSection แจ้งวันที่ออกมาทาง onAsOf) · สูตรคะแนนอยู่ใน lib/pi/score.ts
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { baselineOf, evalPeriod, evalRange, firstDay, inRange, partialMonths, refSet, scopedValues } from "../../lib/pi/baseline";
import type { Range } from "../../lib/pi/baseline";
import { collectionDays } from "../../lib/debtors/aging";
import { INDEXES, metricResult, withPeriod } from "../../lib/pi/score";
import type { MetricResult } from "../../lib/pi/score";
import { PiBox } from "./PiIndex";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { ShortId, shortIdText } from "../../lib/custmap/ShortId";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { allocTopKey, loadAllocBills, useAlloc, useCustDays } from "../../lib/data/useAlloc";
import type { AllocCustDay } from "../../lib/data/useAlloc";
import { inPeriod, periodBounds, periodLabel as periodText } from "../../lib/filter/period";
import type { Period } from "../../lib/filter/period";
import type { AllocBill, AllocCustomer, AllocData } from "../../lib/data/useAlloc";
import { useDebtors } from "../../lib/data/useDebtors";
import type { DebtorData } from "../../lib/data/useDebtors";
import SourceTag from "../../lib/ui/SourceTag";
import { Hero, Note, Pane, searchStyle } from "../dash-fleet/parts";
import { SortTable, fmt, marginTone, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import CustBillsModal from "./CustBillsModal";
import { needsReview, reviewReasonText } from "../../lib/alloc/review";
import type { ReviewCounts } from "../../lib/alloc/review";
import OverdueSection from "./OverdueSection";
import { FilterScope } from "./filter";
import type { DemoFilter } from "./filter";
import TruckLoader from "../../lib/ui/TruckLoader";
import { trendArrow } from "./RouteProfitTab";
import imgPeople from "../../assets/icons3d/people-red.webp";

/** ไอคอนคนมุมขวาบนของการ์ดจำนวนลูกค้าทั้ง 3 ใบ — รูปเดียวกับการ์ดกำไรเฉลี่ย/ลูกค้า */
/** รูปกลุ่มคนสีแดงอ่อนของการ์ด "จำนวนลูกค้าทั้งหมด" (เจ้าของงานส่งรูป 29 ก.ย. 2569 · ย้อมจากม่วงเป็นแดงอ่อน) */
const ICON_PEOPLE = <img className="hero-art-img cp-people" src={imgPeople} alt="" />;

/** ลูกค้าหนึ่งรายหลังยุบตามตัวกรอง — ci ชี้กลับไป customers[] ของชุด alloc */
export interface CustRow extends AllocCustomer, ReviewCounts {
  ci: number;
  /** รายได้ของรายการที่ปันตามรายได้ — ป้าย "ปันตามรายได้" (lib/alloc/review.ts) */
  flagRev: number;
  /** อัตรากำไร % (ไม่เป็น null — ดู marginOf) */
  m: number;
}

/** สูตรเดียวกับ margin_of() ใน etl/build_alloc.py ห้ามแก้ข้างเดียว */
export const marginOf = (revenue: number, profit: number): number =>
  revenue > 0 ? profit / revenue * 100 : profit < 0 ? -100 : 0;

/** ช่วง %Margin ของกราฟ — ตามรูปในสเปก · [lo, hi) · สีไล่จากแดง (ขาดทุน) → ส้ม (บาง) → เขียว */
const BUCKETS = [
  { label: "< −20%", lo: -Infinity, hi: -20, color: D.rose },
  { label: "−20…−10%", lo: -20, hi: -10, color: "#F43F5E" },
  { label: "−10…0%", lo: -10, hi: 0, color: "#FB7185" },
  { label: "0–10%", lo: 0, hi: 10, color: D.amber },
  { label: "10–20%", lo: 10, hi: 20, color: D.teal },
  { label: "20–30%", lo: 20, hi: 30, color: "#0F9F8A" },
  { label: "30–40%", lo: 30, hi: 40, color: D.emeraldLight },
  { label: "≥ 40%", lo: 40, hi: Infinity, color: D.emerald },
] as const;
const bucketOf = (m: number): number => BUCKETS.findIndex((b) => m >= b.lo && m < b.hi);

/** สิ่งที่ผู้ใช้กดเลือกเพื่อกรองตาราง — การ์ดใบไหน หรือแท่งไหน (i = ดัชนีช่วง เฉพาะ bucket) · null = ไม่ได้เลือก */
interface Sel { kind: "all" | "gain" | "loss" | "bucket"; i: number }
const sel = (kind: Sel["kind"], i = -1): Sel => ({ kind, i });
const sameSel = (a: Sel | null, b: Sel): boolean => !!a && a.kind === b.kind && a.i === b.i;

/**
 * ยุบลูกค้า × เดือน → รายลูกค้าตามปี/เดือนที่เลือก — ใช้ทั้งส่วนที่ 1 และคะแนน Customer Net Profit
 * (ย้ายออกมาจาก ProfitPart 25 ก.ย. 2569 ให้สองที่นับลูกค้าชุดเดียวกัน)
 */
export function rollupCustomers(data: AllocData, f: Period, keep?: (mo: string) => boolean,
  /** รายวันของเดือนที่ช่วงคร่อมไม่เต็มเดือน — เดือนที่มีใน days ใช้แถวรายวันที่ inDay ผ่านแทนแถวรายเดือน (29 ก.ย. 2569) */
  days?: { days: Map<string, AllocCustDay[]>; inDay: (d: string) => boolean }): CustRow[] {
  const acc = new Map<number, CustRow>();
  const get = (ci: number): CustRow | null => {
    let a = acc.get(ci);
    if (!a) {
      const c = data.customers[ci];
      if (!c) return null;              // ดัชนีเกินตาราง = ไฟล์สองชุดไม่ใช่รุ่นเดียวกัน ข้ามแทนที่จะพัง
      a = { ...c, ci, bills: 0, revenue: 0, cost: 0, profit: 0, lossBills: 0, margin: null, m: 0,
        flagRev: 0, fNoSize: 0, fBig: 0, fTiny: 0 };
      acc.set(ci, a);
    }
    return a;
  };
  for (const r of data.custMonths ?? []) {
    if (days?.days.has(r.mo)) continue;   // เดือนนี้ใช้รายวันแทน
    // ปี + ช่วงเดือน (ตั้งแต่–ถึง) แบบ Damage Rate — ชุดเดียวกับตัวกรองของหน้า Demo
    // keep = เลือกเดือนเอง (Baseline ของ Performance Index ข้ามปีได้ Period แทนไม่ได้)
    if (keep ? !keep(r.mo) : !inPeriod({ y: Number(r.mo.slice(0, 4)), mo: r.mo }, f)) continue;
    const a = get(r.ci);
    if (!a) continue;
    a.bills += r.bills; a.revenue += r.revenue; a.cost += r.cost; a.profit += r.profit; a.lossBills += r.lossBills;
    a.flagRev += r.flagRev; a.fNoSize += r.fNoSize; a.fBig += r.fBig; a.fTiny += r.fTiny;
  }
  // รายวัน — ไม่มีคอลัมน์ "ต้องตรวจสอบ" (flag) ป้ายปันตามรายได้ของเดือนนั้นจึงไม่นับ
  for (const list of days?.days.values() ?? []) {
    for (const r of list) {
      if (!days!.inDay(r.d)) continue;
      const a = get(r.ci);
      if (!a) continue;
      a.bills += r.bills; a.revenue += r.revenue; a.cost += r.cost; a.profit += r.profit; a.lossBills += r.lossBills;
    }
  }
  for (const a of acc.values()) {
    a.m = marginOf(a.revenue, a.profit);
    a.margin = a.revenue ? a.m : null;
  }
  return [...acc.values()];
}

/** เดือนที่ต้องโหลดรายวัน = เดือนหัว/ท้ายที่ช่วงประเมินและ Baseline คร่อมไม่เต็มเดือน */
export function custDayMonths(alloc: AllocData | null, f: Period): string[] {
  if (!alloc?.custMonths) return [];
  const mos = alloc.custMonths.map((r) => r.mo);
  const ev = evalRange(f, mos);
  if (!ev) return [];
  return [...new Set([...partialMonths(ev), ...partialMonths(baselineOf(ev, null, []))])];
}

/**
 * Customer Net Profit (รายลูกค้า) + DSO (รายลูกค้า) — ใช้ทั้งกล่อง PI ของส่วนนี้และ Executive Summary
 * Methodology 29 ก.ย. 2569 (lib/pi/baseline.ts): ช่วงประเมิน = ช่วงที่เลือกบนหน้า (ไม่เลือกปี = เดือนล่าสุดของแต่ละไฟล์)
 * Reference Baseline = 12 เดือนปฏิทินก่อนเดือนที่ประเมิน ระดับบริษัท ไม่ตามตัวกรอง
 *   Customer Net Profit = ลูกค้าจากไฟล์ปันส่วน (ยุบรายเดือน — Baseline นับเฉพาะเดือนที่อยู่ในช่วงทั้งเดือน · ประเมินไม่เต็มเดือน = ทั้งเดือน)
 *   DSO = ลูกค้าที่**วางบิลในช่วง** นับวันเก็บเงินถึงวันสุดท้ายของช่วง (เจ้าของงานเลือก — เดิมใช้ "ข้อมูล ณ วันที่" ของส่วน DSO)
 *         Baseline ทุกสาขา · ไฟล์ลูกหนี้ยังไม่ครบปี = ใช้เท่าที่มี (ไม่มีบิลก่อนช่วงเลย = N/A)
 * _asOf คงไว้ให้ผู้เรียกเดิม — ไม่ใช้แล้ว
 */
export function custPiResults(alloc: AllocData | null, debtors: DebtorData | null, _asOf: string | null, f: DemoFilter,
  /** รายวันของเดือนที่ช่วงประเมิน/Baseline คร่อมไม่เต็มเดือน (custDayMonths) · ไม่ส่ง = ระดับเดือน */
  days?: Map<string, AllocCustDay[]>): MetricResult[] {
  let cust = metricResult("custProfit", null);
  const a = alloc?.custMonths ? alloc : null;
  if (a) {
    const mos = a.custMonths!.map((r) => r.mo);
    const ev = evalRange(f, mos);
    if (ev) {
      const b = baselineOf(ev, firstDay(a.custMonths!), mos);
      const pick = (r: Range) => (days && days.size ? { days: new Map([...days].filter(([m]) => partialMonths(r).includes(m))),
        inDay: (d: string) => d >= r.start && d <= r.end } : undefined);
      const refRows = rollupCustomers(a, f, (mo) => inRange({ mo }, b, "inside"), pick(b));
      const pf = evalPeriod(f, mos);
      const rows = rollupCustomers(a, pf, undefined, pick(ev));
      let rev = 0, profit = 0;
      for (const r of rows) { rev += r.revenue; profit += r.profit; }
      cust = withPeriod(metricResult("custProfit", rows.map((r) => r.m), refSet(refRows.map((r) => r.m), "ลูกค้า", b, false,
        f.br ? "ระดับบริษัท (ไฟล์ปันส่วนไม่มีสาขา)" : "ระดับบริษัท"),
        rows.length ? marginOf(rev, profit) : null), periodText(pf));
    }
  }
  let dso = metricResult("dso", null);
  if (debtors && debtors.rows.length) {
    const mos = debtors.rows.map((r) => r.mo);
    const ev = evalRange(f, mos);
    if (ev) {
      const evalRows = debtors.rows.filter((r) => (!f.br || r.br === f.br) && r.issue >= ev.start && r.issue <= ev.end);
      const days = collectionDays(evalRows, ev.end);
      const first = debtors.rows.reduce((m, r) => (!m || r.issue < m ? r.issue : m), "");
      const b = baselineOf(ev, first || null, mos);
      const baseRows = debtors.rows.filter((r) => r.issue >= b.start && r.issue <= b.end);
      // เลือกสาขา = Baseline ลูกค้าของสาขา (ถึง 30 ราย) · ไม่ถึง = ทุกสาขา (29 ก.ย. 2569)
      const sv = scopedValues(collectionDays(baseRows, b.end), f.br ? collectionDays(baseRows.filter((r) => r.br === f.br), b.end) : null,
        f.br, "ลูกค้า");
      dso = withPeriod(metricResult("dso", days, refSet(sv.values, "ลูกค้า", b, true, sv.scope),
        days.length ? days.reduce((s, v) => s + v, 0) / days.length : null), ev.label);
    }
  }
  return [cust, dso];
}

export default function CustomerProfitTab({ f, onProfitInfo, onDebtorInfo }: {
  f: DemoFilter;
  onProfitInfo?: (content: ReactNode, sample?: boolean) => void;
  onDebtorInfo?: (content: ReactNode, sample?: boolean) => void;
}) {
  const alloc = useAlloc();
  const debtors = useDebtors();
  const allocSample = alloc.data?.manifest.isSample;
  useEffect(() => {
    onProfitInfo?.(<>
      <h3>Customer Performance · กำไรลูกค้า</h3>
      <p>ข้อมูลจากการปันต้นทุนเที่ยวให้บิลรายได้ ยุบเป็นรายลูกค้า × เดือนตามวันที่บิล{allocSample !== undefined && ` · ${allocSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"}`}</p>
      <p>รายละเอียดเปิดได้สูงสุด 100 บิลล่าสุดต่อรายในช่วงเวลาที่เลือก แต่ยอดรวมในตารางคำนวณจากทุกบิล</p>
      <p>เมื่อบิลส่วนใหญ่ไม่มีน้ำหนัก/ขนาด หรือขนาดผิดปกติ ระบบปันต้นทุนตามสัดส่วนรายได้แทนน้ำหนัก × ระยะทาง และแสดงป้าย “ปันตามรายได้”</p>
      <FilterScope f={f} uses={["year", "month"]} why="ยอดกำไรลูกค้ายุบไว้เป็นรายลูกค้า × เดือนของบิล ไม่มีสาขาและไม่ได้แยกตามเส้นทาง/รถ/กลุ่มบริการ" />
    </>, allocSample);
  }, [onProfitInfo, allocSample, f]);
  /** "ข้อมูล ณ วันที่" ที่ส่วน DSO เลือกอยู่ — คะแนน DSO ใช้วันเดียวกัน */
  const [asOf, setAsOf] = useState<string | null>(null);
  const dayMonths = useMemo(() => custDayMonths(alloc.data, f), [alloc.data, f.year, f.from, f.to, f.d1, f.d2]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = useCustDays(alloc.data, dayMonths);
  const custPi = useMemo(() => custPiResults(alloc.data, debtors.data, asOf, f, days ?? undefined),
    [alloc.data, debtors.data, asOf, f.year, f.from, f.to, f.d1, f.d2, f.br, days]); // eslint-disable-line react-hooks/exhaustive-deps
  // ETL ของสองชุดนี้แยกกัน (วางไฟล์คนละโฟลเดอร์) — รีเฟรชเฉพาะชุดที่เปลี่ยน
  const etlAlloc = useEtlStatus("alloc");
  const etlDebt = useEtlStatus("debtors");
  useAutoReloadOnEtl(etlAlloc, alloc.reload);
  useAutoReloadOnEtl(etlDebt, debtors.reload);
  return (
    <>
      {/* แถบสถานะ ETL อยู่ที่หัวหน้า (สถานะรวมทุกงาน) — ส่วนนี้แค่รีเฟรชเองเมื่อชุดของตัวเองเสร็จ */}
      {alloc.error ? (
        <div className="card">
          <div className="banner">{alloc.error}</div>
          <p className="muted">
            สร้างไฟล์ข้อมูลด้วย <code>python etl/build_alloc.py --dataset sample</code> (หรือ <code>--dataset real</code>)
          </p>
        </div>
      ) : !alloc.data ? (
        <div className="card"><p className="muted">กำลังโหลดข้อมูลกำไรลูกค้า... <TruckLoader label={null} /></p></div>
      ) : !alloc.data.custMonths ? (
        <div className="card">
          <h2>ไฟล์ข้อมูลรุ่นเก่า</h2>
          <p className="muted">
            ชุด alloc/ นี้ยังไม่มี <code>cust_months.json</code> (สร้างก่อน 22 ก.ย. 2569) — รัน{" "}
            <code>python etl/build_alloc.py</code> ใหม่แล้วกด ↻ รีเฟรชข้อมูล
          </p>
        </div>
      ) : (
        <><div data-demo-info="cust" className="dm-info-anchor" /><ProfitPart data={alloc.data} f={f} infoInHeader={!!onProfitInfo} /></>
      )}

      {/* ส่วนที่ 2 — เว้นบรรทัดจากส่วนแรกตามสเปก */}
      <div style={{ height: 28 }} />
      <div data-demo-info="cust-debtors" className="dm-info-anchor" />
      <OverdueSection state={debtors} branch={f.br} onAsOf={setAsOf} onInfo={onDebtorInfo} />

      {/* Performance Index — กล่องยาว */}
      <PiBox index={INDEXES.cust} results={custPi} />
    </>
  );
}

/* ================================================================ ส่วนที่ 1 */
function ProfitPart({ data, f: page, infoInHeader }: { data: AllocData; f: DemoFilter; infoInHeader: boolean }) {
  // ใช้แค่ปี/เดือนของตัวกรองหน้า — แยกออกมาเป็น object เล็ก ตัวกรองอื่นเปลี่ยนแล้วจะได้ไม่คำนวณซ้ำ
  const f = useMemo<Period>(() => ({ year: page.year, from: page.from, to: page.to, d1: page.d1, d2: page.d2 }),
    [page.year, page.from, page.to, page.d1, page.d2]);
  // เลือกไม่เต็มเดือน = เดือนหัว/ท้ายใช้ลูกค้า × วัน (โหลดเฉพาะเดือนนั้น) · ยังโหลดไม่เสร็จ = ทั้งเดือนไปก่อน
  const evr = useMemo(() => periodBounds(f), [f]);
  const days = useCustDays(data, useMemo(() => (evr ? partialMonths(evr) : []), [evr]));
  const [pick, setPick] = useState<Sel | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [openCi, setOpenCi] = useState<number | null>(null);
  const [billState, setBillState] = useState<{ ci: number; rows: AllocBill[] | null; error: string | null } | null>(null);
  const toggle = (p: Sel) => setPick((cur) => (sameSel(cur, p) ? null : p));

  /* ---------- ยุบลูกค้า × เดือน → รายลูกค้า ตามตัวกรอง ---------- */
  const rows = useMemo<CustRow[]>(() => rollupCustomers(data, f, undefined,
    evr && days && days.size ? { days, inDay: (d) => d >= evr.start && d <= evr.end } : undefined), [data, f, evr, days]);

  /* ---------- การ์ด 3 ใบ ---------- */
  const kpi = useMemo(() => {
    const gain = rows.filter((r) => r.profit >= 0).length;
    const n = rows.length;
    // ยอดเงินใต้การ์ด = กำไรสุทธิของกลุ่มนั้น (เจ้าของงานเลือก 24 ก.ย. 2569) · กำไร 0 นับฝั่งทำกำไรเหมือนจำนวนคน
    let gainAmt = 0, lossAmt = 0;
    for (const r of rows) if (r.profit >= 0) gainAmt += r.profit; else lossAmt += r.profit;
    return { n, gain, loss: n - gain, gainPct: n ? gain / n * 100 : 0, lossPct: n ? (n - gain) / n * 100 : 0,
      gainAmt, lossAmt, netAmt: gainAmt + lossAmt };
  }, [rows]);

  /* ---------- กราฟช่วง %Margin ---------- */
  const hist = useMemo(() => {
    const counts = BUCKETS.map(() => 0);
    const profits = BUCKETS.map(() => 0);
    for (const r of rows) {
      const i = bucketOf(r.m);
      counts[i] = (counts[i] ?? 0) + 1;
      profits[i] = (profits[i] ?? 0) + r.profit;
    }
    return BUCKETS.map((b, i) => ({ label: b.label, จำนวนลูกค้า: counts[i] ?? 0, profit: profits[i] ?? 0 }));
  }, [rows]);

  /* ---------- Top 100 สำหรับรายละเอียด และ Top 10 สำหรับป้าย/ช่วง Margin ---------- */
  const top = data.top?.[allocTopKey(f)];
  const gainSet = useMemo(() => new Set(top?.gain.slice(0, 10) ?? []), [top]);
  const lossSet = useMemo(() => new Set(top?.loss.slice(0, 10) ?? []), [top]);
  const detailSet = useMemo(() => new Set([
    ...(top?.gain ?? []), ...(top?.loss ?? []), ...(top?.margin?.flat() ?? []),
  ]), [top]);

  /* ---------- ตาราง ---------- */
  const subset = useMemo(() => {
    if (!pick || pick.kind === "all") return rows;
    if (pick.kind === "gain") return rows.filter((r) => r.profit >= 0);
    if (pick.kind === "loss") return rows.filter((r) => r.profit < 0);
    return rows.filter((r) => bucketOf(r.m) === pick.i);
  }, [rows, pick]);
  const searched = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("th");
    if (!query) return subset;
    return subset.filter((r) =>
      r.code.toLocaleLowerCase("th").includes(query)
      || shortIdText(r.code, r.n).toLocaleLowerCase("th").includes(query));
  }, [subset, customerQuery]);
  const lossMode = pick?.kind === "loss";
  const rankByCustomer = useMemo(() => new Map(
    (lossMode ? rows.filter((r) => r.profit < 0) : [...rows])
      .sort((a, b) => (lossMode ? a.profit - b.profit : b.profit - a.profit) || a.ci - b.ci)
      .map((r, i) => [r.ci, i + 1] as const)), [rows, lossMode]);
  const rankedSubset = useMemo(() => [...searched].sort((a, b) =>
    (rankByCustomer.get(a.ci) ?? 0) - (rankByCustomer.get(b.ci) ?? 0)), [searched, rankByCustomer]);

  const cols = useMemo<Col<CustRow>[]>(() => [
    { key: "rank", label: "อันดับ", get: (r) => rankByCustomer.get(r.ci) ?? 0,
      render: (r) => rankByCustomer.get(r.ci) ?? 0, num: true },
    { key: "code", label: "ลูกค้า", get: (r) => r.code,
      // ป้ายเล็ก — ต้นทุนส่วนใหญ่ของรายนี้ปันตามรายได้ เพราะน้ำหนัก/ขนาดในบิลเชื่อไม่ได้ (23 ก.ย. 2569)
      render: (r) => <>{<ShortId v={r.code} n={r.n} />}{needsReview(r.revenue, r.flagRev) && (
        <span className="cp-rev" title={`ต้นทุนส่วนใหญ่ปันตามรายได้ — น้ำหนัก/ขนาดในบิลเชื่อไม่ได้: ${reviewReasonText(r)}`}>ปันตามรายได้</span>
      )}</> },
    { key: "top", label: "", get: () => "", sortable: false,
      render: (r) => gainSet.has(r.ci) ? <span className="cp-tag gain">Top 10</span>
        : lossSet.has(r.ci) ? <span className="cp-tag loss">Top 10</span> : null },
    { key: "bills", label: "บิล", get: (r) => r.bills, num: true },
    { key: "revenue", label: "รายได้", get: (r) => r.revenue, num: true },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (r) => r.cost, num: true },
    { key: "profit", label: "กำไร/ขาดทุน", get: (r) => r.profit, num: true,
      render: (r) => <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.profit))}</b> },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.m, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>{r.margin == null ? "–" : pct(r.m, 0)}</span> },
    { key: "lossBills", label: "บิลที่ขาดทุน", get: (r) => r.lossBills, num: true },
  ], [rankByCustomer, gainSet, lossSet]);

  /** บิลของรายที่เปิดอยู่ ตามตัวกรองปี/เดือน/วันเดียวกับตาราง */
  const openRow = openCi == null ? null : rows.find((r) => r.ci === openCi) ?? null;
  useEffect(() => {
    if (openCi == null) return;
    let alive = true;
    loadAllocBills(data, openCi)
      .then((bills) => { if (alive) setBillState({ ci: openCi, rows: bills, error: null }); })
      .catch((error: unknown) => { if (alive) setBillState({ ci: openCi, rows: null, error: String(error) }); });
    return () => { alive = false; };
  }, [data, openCi]);
  const currentBills = billState?.ci === openCi ? billState : null;
  const openBills = useMemo<AllocBill[]>(() => {
    if (openCi == null || !currentBills?.rows) return [];
    return currentBills.rows.filter((b) => b.ci === openCi
      && inPeriod({ y: Number(b.date.slice(0, 4)), mo: b.date.slice(0, 7), d: b.date }, f))
      .sort((a, b) => b.date.localeCompare(a.date) || b.bill.localeCompare(a.bill))
      .slice(0, 100);
  }, [currentBills, openCi, f]);

  const pickLabel = !pick ? null
    : pick.kind === "all" ? "ลูกค้าทั้งหมด" : pick.kind === "gain" ? "ลูกค้าที่ทำกำไร"
    : pick.kind === "loss" ? "ลูกค้าที่ขาดทุน" : `ช่วง %Margin ${BUCKETS[pick.i]?.label ?? ""}`;
  /* ---------- วงกลมสัดส่วน Top 10 (เจ้าของงานส่งภาพ 28 ก.ย. 2569) ----------
   * กำไร = Σกำไรของ Top 10 กำไรสูงสุด ÷ กำไรรวมของลูกค้าที่มีกำไร (ตัวเลขเดียวกับ foot ของการ์ด "ลูกค้าที่มีกำไร")
   * ขาดทุน = Σขาดทุนของ Top 10 ขาดทุนมากสุด ÷ ขาดทุนรวมของลูกค้าที่ขาดทุน
   * Top 10 = ชุดเดียวกับป้าย "Top 10" ในตาราง (top.json ของ ETL) · ไฟล์รุ่นก่อนไม่มีคีย์ช่วง → จัดอันดับจาก rows เอง */
  const [pieSide, setPieSide] = useState<"gain" | "loss">("gain");
  const pie = useMemo(() => {
    const gains = rows.filter((r) => r.profit >= 0), losses = rows.filter((r) => r.profit < 0);
    const topOf = (list: CustRow[], set: Set<number>, desc: boolean): CustRow[] => top
      ? list.filter((r) => set.has(r.ci))
      : [...list].sort((a, b) => (desc ? b.profit - a.profit : a.profit - b.profit) || a.ci - b.ci).slice(0, 10);
    const sum = (list: CustRow[]) => list.reduce((s, r) => s + Math.abs(r.profit), 0);
    const gTop = topOf(gains, gainSet, true), lTop = topOf(losses, lossSet, false);
    return {
      gain: { top: sum(gTop), rest: sum(gains) - sum(gTop), n: gTop.length, all: gains.length },
      loss: { top: sum(lTop), rest: sum(losses) - sum(lTop), n: lTop.length, all: losses.length },
    };
  }, [rows, top, gainSet, lossSet]);
  const pieNow = pie[pieSide];
  const pieTotal = pieNow.top + pieNow.rest;
  // เขียว/แดงชุดเดียวกับการ์ดรายได้/ต้นทุนของธีม (revA/revB · costA/costB) · Top 10 = เข้ม · ลูกค้าอื่น = อ่อน ·
  // กรอบ = เฉดเข้มกว่าของฝั่งนั้น (เจ้าของงานสั่ง 28 ก.ย. 2569 — แทนกรอบดำ)
  const pieColors = pieSide === "gain" ? ["#0C5A45", "#34A07F"] : ["#8E1B1B", "#D44C45"];
  const pieData = useMemo(() => [
    { name: pieSide === "gain" ? "Top 10 กำไรสูงสุด" : "Top 10 ขาดทุนมากสุด", v: pieNow.top },
    { name: "ลูกค้าอื่น", v: pieNow.rest },
  ], [pieSide, pieNow]);
  const pieShare = (v: number) => pieTotal ? pct(v / pieTotal * 100, 2) : "–";

  const periodLabel = periodText(f);

  return (
    <>
      <Pane deps={[rows]}>
        {!infoInHeader && <>
          <SourceTag block sample={data.manifest.isSample} what="ส่วนกำไรลูกค้า (ไฟล์ต้นทุน + บิลรายได้)" />
          <FilterScope f={page} uses={["year", "month"]} why="ยอดกำไรลูกค้ายุบไว้เป็นรายลูกค้า × เดือนของบิล ไม่มีสาขาและไม่ได้แยกตามเส้นทาง/รถ/กลุ่มบริการ" />
        </>}
        {/* 3 — การ์ดใหญ่ 3 ใบขนาดเท่ากัน กดเพื่อกรองตาราง */}
        <div className="dz-heroes cp-heroes">
          {/* ลำดับ: มีกำไร · ทั้งหมด (กลาง) · ขาดทุน · ไอคอนคนเฉพาะใบกลาง · มีกำไร/ขาดทุน = ลูกศร 3 มิติขึ้น/ลงแบบการ์ดกำไร (เจ้าของงานสั่ง 29 ก.ย. 2569) */}
          <Hero kind="profit" l="จำนวนลูกค้าที่มีกำไร" v={fmt(kpi.gain)} art={trendArrow(true)}
            s="คน · รายได้ ≥ ต้นทุน" foot={`กำไรรวม ${signed(kpi.gainAmt)} บาท`}
            onClick={() => toggle(sel("gain"))} active={sameSel(pick, sel("gain"))} />
          <Hero kind="cust" l="จำนวนลูกค้าทั้งหมด" v={fmt(kpi.n)} s="คน · ลูกค้าที่ผ่านตัวกรอง" art={ICON_PEOPLE}
            foot={`กำไรสุทธิรวม ${signed(kpi.netAmt)} บาท`}
            onClick={() => toggle(sel("all"))} active={sameSel(pick, sel("all"))} />
          <Hero kind="loss" l="จำนวนลูกค้าขาดทุน" v={fmt(kpi.loss)} art={trendArrow(false)}
            s="คน · รายได้ < ต้นทุน" foot={`ขาดทุนรวม ${fmt(-kpi.lossAmt)} บาท`}
            onClick={() => toggle(sel("loss"))} active={sameSel(pick, sel("loss"))} />
        </div>

        {/* 4 — วงกลมสัดส่วน Top 10 (ซ้าย) + กราฟช่วง %Margin (ขวา) */}
        <div className="cp-dist">
        <div className="dz-cc cp-pie">
          {/* หัวข้อไม่เปลี่ยนตามฝั่ง ปุ่มสลับจึงอยู่ที่เดิมเสมอ — ชื่อฝั่งไปอยู่บรรทัดใต้หัวแทน */}
          <div className="cp-pie-h">
            <h4>สัดส่วน Top 10</h4>
            <div className="cp-seg cp-pie-seg" role="group" aria-label="เลือกฝั่ง">
              <button type="button" className={pieSide === "gain" ? "on" : ""} aria-pressed={pieSide === "gain"} onClick={() => setPieSide("gain")}>กำไร</button>
              <button type="button" className={pieSide === "loss" ? "on" : ""} aria-pressed={pieSide === "loss"} onClick={() => setPieSide("loss")}>ขาดทุน</button>
            </div>
          </div>
          {pieTotal > 0 ? <>
            {/* โดนัทแบบวงสถานะการชำระเงินของ DSO (เจ้าของงานสั่ง 29 ก.ย. 2569 — แทนวงกลมเต็ม) · ยอดรวมอยู่กลางวง */}
            <Top10Donut values={pieData.map((d) => d.v)} colors={pieColors}
              label={pieSide === "gain" ? "กำไรทั้งหมด" : "ขาดทุนทั้งหมด"} total={pieTotal} />
            <ul className="cp-pie-legend">
              {pieData.map((d, i) => <li key={d.name}>
                <i style={{ background: pieColors[i] }} />
                <span>{i === 0 ? d.name : `ลูกค้าอื่น (${fmt(Math.max(0, pieNow.all - pieNow.n))} ราย)`}</span>
                <b>{pieShare(d.v)}</b>
                <em>{fmt(Math.round(d.v))} บาท</em>
              </li>)}
            </ul>
          </> : <p className="muted cp-pie-empty">ไม่มีลูกค้าที่{pieSide === "gain" ? "มีกำไร" : "ขาดทุน"}ในช่วงนี้</p>}
        </div>
        <div className="dz-cc cp-hist">
          <h4>การกระจายตัวของอัตรากำไร · จำนวนลูกค้าในแต่ละช่วง %Margin</h4>
          <div className="dz-box">
            <DBar data={hist} xKey="label" suffix=" ราย" colors={BUCKETS.map((b) => b.color)}
              series={[{ key: "จำนวนลูกค้า", label: "จำนวนลูกค้า", color: D.teal }]}
              tooltipExtra={(i) => {
                const profit = hist[i]?.profit ?? 0;
                return `${profit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"}: ${fmt(Math.abs(Math.round(profit)))} บาท`;
              }}
              onBarClick={(i) => toggle(sel("bucket", i))}
              activeIndex={pick?.kind === "bucket" ? pick.i : null} />
          </div>
          <Note>กดแท่งเพื่อดูรายลูกค้าในช่วงนั้นที่ตารางข้างล่าง กดซ้ำเพื่อยกเลิก · การ์ดสามใบด้านบนกดได้เหมือนกัน</Note>
        </div>
        </div>

        {/* ตารางกำไรรายลูกค้า */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>
                กำไรรายลูกค้า ({fmt(searched.length)} ราย)
                {pickLabel && <span className="cp-pick"> · {pickLabel}</span>}
              </h4>
              <p>{periodLabel} · {lossMode ? "เรียงจากลูกค้าที่ขาดทุนมากที่สุด" : "เรียงตามกำไรจากมากไปน้อย"}</p>
            </div>
            <div className="cp-actions">
              <input type="search" style={searchStyle} value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                aria-label="ค้นหารหัสลูกค้า" placeholder="ค้นหารหัสลูกค้า" />
              <div className="cp-seg" role="group" aria-label="กรองลูกค้าตามกำไร">
                <button type="button" className={!pick || pick.kind === "all" ? "on" : ""} aria-pressed={!pick || pick.kind === "all"} onClick={() => setPick(null)}>แสดงทุกราย</button>
                <button type="button" className={pick?.kind === "gain" ? "on" : ""} aria-pressed={pick?.kind === "gain"} onClick={() => setPick(sel("gain"))}>ลูกค้าที่ทำกำไร</button>
                <button type="button" className={pick?.kind === "loss" ? "on" : ""} aria-pressed={pick?.kind === "loss"} onClick={() => setPick(sel("loss"))}>ลูกค้าที่ขาดทุน</button>
              </div>
            </div>
          </div>
          <CustomerProfitTable key={lossMode ? "loss" : "other"} rows={rankedSubset} cols={cols} lossMode={lossMode}
            detailSet={detailSet} onOpen={setOpenCi}
            empty={customerQuery.trim() ? "ไม่พบลูกค้าตามคำค้นหา" : "ไม่มีลูกค้าในกลุ่มนี้"}
          />
          <Note>
            กดที่แถวของลูกค้าที่ติด <b>Top 100 กำไรสูงสุด/ขาดทุนมากสุด</b> หรือ <b>Top 10 ของแต่ละช่วง %Margin</b> เพื่อดูรายละเอียด ·
            อัตรากำไร = กำไร ÷ รายได้ · รายได้ 0 แล้วขาดทุนคิดเป็น −100%
            {!infoInHeader && <> · <b>ข้อจำกัดทางข้อมูล:</b> ดูได้สูงสุด 100 บิลล่าสุดต่อรายในช่วงเวลาที่เลือก ยอดรวมในตารางยังคำนวณจากทุกบิล ·
              ป้าย <span className="cp-rev">ปันตามรายได้</span> = บิลส่วนใหญ่ของรายนี้ไม่มีน้ำหนัก/ขนาด หรือกรอกขนาดผิดปกติ จึงปันต้นทุนตามสัดส่วนรายได้แทนน้ำหนัก × ระยะทาง</>}
          </Note>
        </div>
      </Pane>

      {openRow && (
        <CustBillsModal row={openRow} bills={openBills} period={periodLabel}
          loading={!currentBills} error={currentBills?.error ?? null} onClose={() => setOpenCi(null)} />
      )}
    </>
  );
}

function CustomerProfitTable({ rows, cols, lossMode, detailSet, onOpen, empty }: {
  rows: CustRow[]; cols: Col<CustRow>[]; lossMode: boolean;
  detailSet: Set<number>; onOpen: (ci: number) => void; empty: string;
}) {
  const { sorted, sort, toggle: toggleSort } = useSort(rows, cols, { key: "profit", dir: lossMode ? 1 : -1 });
  return <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggleSort} rowKey={(r) => String(r.ci)}
    empty={empty} className="dm-tbl cp-tbl"
    rowProps={(r) => {
      const can = detailSet.has(r.ci);
      return can
        ? { onClick: () => onOpen(r.ci), title: "กดเพื่อดูรายการบิลของลูกค้ารายนี้" }
        : { className: "nolink", title: "ดูบิลได้เฉพาะลูกค้า Top 100 กำไร/ขาดทุน หรือ Top 10 ของช่วง Margin" };
    }} />;
}

/**
 * โดนัท Top 10 ของ Customer Performance — หน้าตาเดียวกับวง "ภาพรวมสถานะการชำระเงิน" ของส่วน DSO (.dso2-ov-donut · 29 ก.ย. 2569)
 * ชิ้น = values ตามลำดับ (Top 10 · ลูกค้าอื่น) คั่นด้วยเส้นขาว · % บนชิ้นที่กว้างพอ · กลางวง = ยอดรวมเป็นล้านบาท
 */
function Top10Donut({ values, colors, label, total }: { values: number[]; colors: string[]; label: string; total: number }) {
  const C = 110, R = 104, IR = 62;
  const pt = (r: number, a: number): [number, number] => [C + r * Math.sin(a), C - r * Math.cos(a)];
  const arc = (a0: number, a1: number): string => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(IR, a1), [x3, y3] = pt(IR, a0);
    return `M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${IR} ${IR} 0 ${big} 0 ${x3} ${y3}Z`;
  };
  let a = 0;
  const mil = (total / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="dso2-ov-donut cp-pie-donut">
      <svg viewBox="0 0 220 220" role="img" aria-label={`${label} ${fmt(Math.round(total))} บาท`}>
        {values.map((v, i) => {
          const a0 = a, a1 = a + (total ? v / total : 0) * Math.PI * 2;
          a = a1;
          if (v <= 0) return null;
          const frac = v / total, [lx, ly] = pt((R + IR) / 2, (a0 + a1) / 2);
          return <g key={i}>
            <path d={arc(a0, a1)} fill={colors[i]} stroke="var(--d-card,#fff)" strokeWidth={2.5} />
            {frac >= 0.08 && <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              style={{ fill: "#fff", fontSize: 12, fontWeight: 800, fontFamily: "var(--d-num)" }}>{pct(frac * 100, 1)}</text>}
          </g>;
        })}
      </svg>
      <div className="dso2-ov-m"><span>{label}</span><b>{mil}</b><em>ล้านบาท</em></div>
    </div>
  );
}
