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
 *      ตั้งต้นโชว์ "Top 10 กำไรสูงสุด + Top 10 ขาดทุนมากสุด" **เป็นบาท** ของช่วงเวลาที่กรอง (ETL คัดไว้ใน top.json)
 *      — เดิมจัดด้วยอัตรากำไร % แล้วติดแต่รายเล็กที่ต้นทุนจัดสรร ~0 (100%) เปลี่ยน 23 ก.ย. 2569 ดู top_by_period()
 *      สลับเป็น "ทุกราย" ได้ · กดแถวที่ติด Top 10 เพื่อเปิดป็อบอัพรายการบิล — **แถวอื่นกดไม่ได้**
 *      เพราะ bills.json เก็บบิลเฉพาะรายที่ติดอันดับ (ข้อมูลจริงมีบิลราว 2 ล้านใบ เก็บทุกใบไม่ไหว) มีโน้ตบอกไว้
 *
 * ส่วนที่ 2 · ลูกหนี้ค้างชำระ (ชุด debtors/ จากไฟล์ "ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx")
 *   อยู่ใน OverdueSection.tsx — ไม่ขึ้นกับตัวกรองปี/เดือนของส่วนที่ 1 มีตัวกรอง "ข้อมูล ณ วันที่" ของตัวเอง
 *
 * ★ อัตรากำไรใช้ marginOf() ข้างล่าง ซึ่งต้องตรงกับ margin_of() ใน etl/build_alloc.py — ETL ใช้ตัดสินเสมอ
 *   ตอนคัด Top 10 และช่วง %Margin ของกราฟต้องนับเหมือน ETL ห้ามแก้ข้างเดียว
 */
import { useMemo, useState } from "react";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { ShortId } from "../../lib/custmap/ShortId";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import EtlBanner from "../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { useAlloc } from "../../lib/data/useAlloc";
import type { AllocBill, AllocCustomer, AllocData } from "../../lib/data/useAlloc";
import { useDebtors } from "../../lib/data/useDebtors";
import { FF, Hero, Note, Pane } from "../dash-fleet/parts";
import { MonthFF, SortTable, fmt, isFiltered, marginTone, monthName, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import CustBillsModal from "./CustBillsModal";
import { needsReview, reviewReasonText } from "../../lib/alloc/review";
import type { ReviewCounts } from "../../lib/alloc/review";
import OverdueSection from "./OverdueSection";
import TruckLoader from "../../lib/ui/TruckLoader";

interface Filter { year: string; month: string }
const F0: Filter = { year: "", month: "" };

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

export default function CustomerProfitTab() {
  const alloc = useAlloc();
  const debtors = useDebtors();
  // ETL ของสองชุดนี้แยกกัน (วางไฟล์คนละโฟลเดอร์) — รีเฟรชเฉพาะชุดที่เปลี่ยน
  const etlAlloc = useEtlStatus("alloc");
  const etlDebt = useEtlStatus("debtors");
  useAutoReloadOnEtl(etlAlloc, alloc.reload);
  useAutoReloadOnEtl(etlDebt, debtors.reload);
  return (
    <>
      <EtlBanner status={etlAlloc} />
      <EtlBanner status={etlDebt} />
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
        <ProfitPart data={alloc.data} />
      )}

      {/* ส่วนที่ 2 — เว้นบรรทัดจากส่วนแรกตามสเปก */}
      <div style={{ height: 28 }} />
      <OverdueSection state={debtors} />
    </>
  );
}

/* ================================================================ ส่วนที่ 1 */
function ProfitPart({ data }: { data: AllocData }) {
  const [f, setF] = useState<Filter>(F0);
  const set = (k: keyof Filter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [pick, setPick] = useState<Sel | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openCi, setOpenCi] = useState<number | null>(null);
  const toggle = (p: Sel) => setPick((cur) => (sameSel(cur, p) ? null : p));

  const cm = data.custMonths ?? [];
  const years = useMemo(() => [...new Set(cm.map((r) => r.mo.slice(0, 4)))].sort(), [cm]);

  /* ---------- ยุบลูกค้า × เดือน → รายลูกค้า ตามตัวกรอง ---------- */
  const rows = useMemo<CustRow[]>(() => {
    const acc = new Map<number, CustRow>();
    for (const r of cm) {
      if (f.year && r.mo.slice(0, 4) !== f.year) continue;
      if (f.month && r.mo.slice(5) !== f.month) continue;
      let a = acc.get(r.ci);
      if (!a) {
        const c = data.customers[r.ci];
        if (!c) continue;                 // ดัชนีเกินตาราง = ไฟล์สองชุดไม่ใช่รุ่นเดียวกัน ข้ามแทนที่จะพัง
        a = { ...c, ci: r.ci, bills: 0, revenue: 0, cost: 0, profit: 0, lossBills: 0, margin: null, m: 0,
          flagRev: 0, fNoSize: 0, fBig: 0, fTiny: 0 };
        acc.set(r.ci, a);
      }
      a.bills += r.bills; a.revenue += r.revenue; a.cost += r.cost; a.profit += r.profit; a.lossBills += r.lossBills;
      a.flagRev += r.flagRev; a.fNoSize += r.fNoSize; a.fBig += r.fBig; a.fTiny += r.fTiny;
    }
    for (const a of acc.values()) {
      a.m = marginOf(a.revenue, a.profit);
      a.margin = a.revenue ? a.m : null;
    }
    return [...acc.values()];
  }, [cm, data.customers, f]);

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
    for (const r of rows) counts[bucketOf(r.m)] = (counts[bucketOf(r.m)] ?? 0) + 1;
    return BUCKETS.map((b, i) => ({ label: b.label, จำนวนลูกค้า: counts[i] ?? 0 }));
  }, [rows]);

  /* ---------- Top 10 ของช่วงเวลาที่กรอง (ETL คัดไว้) ---------- */
  const top = data.top?.[`${f.year}|${f.month}`];
  const gainSet = useMemo(() => new Set(top?.gain ?? []), [top]);
  const lossSet = useMemo(() => new Set(top?.loss ?? []), [top]);

  /* ---------- ตาราง ---------- */
  const subset = useMemo(() => {
    if (!pick || pick.kind === "all") return rows;
    if (pick.kind === "gain") return rows.filter((r) => r.profit >= 0);
    if (pick.kind === "loss") return rows.filter((r) => r.profit < 0);
    return rows.filter((r) => bucketOf(r.m) === pick.i);
  }, [rows, pick]);
  const shown = useMemo(
    () => (showAll ? subset : subset.filter((r) => gainSet.has(r.ci) || lossSet.has(r.ci))),
    [subset, showAll, gainSet, lossSet]);

  const cols = useMemo<Col<CustRow>[]>(() => [
    { key: "code", label: "ลูกค้า", get: (r) => r.code,
      // ป้ายเล็ก — ต้นทุนส่วนใหญ่ของรายนี้ปันตามรายได้ เพราะน้ำหนัก/ขนาดในบิลเชื่อไม่ได้ (23 ก.ย. 2569)
      render: (r) => <>{<ShortId v={r.code} n={r.n} />}{needsReview(r.revenue, r.flagRev) && (
        <span className="cp-rev" title={`ต้นทุนส่วนใหญ่ปันตามรายได้ — น้ำหนัก/ขนาดในบิลเชื่อไม่ได้: ${reviewReasonText(r)}`}>ปันตามรายได้</span>
      )}</> },
    { key: "rank", label: "อันดับ", get: (r) => (gainSet.has(r.ci) ? 1 : lossSet.has(r.ci) ? 2 : 3),
      render: (r) => gainSet.has(r.ci) ? <span className="cp-tag gain">Top 10 กำไร</span>
        : lossSet.has(r.ci) ? <span className="cp-tag loss">Top 10 ขาดทุน</span> : <span className="cp-tag none">–</span> },
    { key: "bills", label: "บิล", get: (r) => r.bills, num: true },
    { key: "revenue", label: "รายได้", get: (r) => r.revenue, num: true },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (r) => r.cost, num: true },
    { key: "profit", label: "กำไร/ขาดทุน", get: (r) => r.profit, num: true,
      render: (r) => <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.profit))}</b> },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.m, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>{r.margin == null ? "–" : pct(r.m, 0)}</span> },
    { key: "lossBills", label: "บิลที่ขาดทุน", get: (r) => r.lossBills, num: true },
  ], [gainSet, lossSet]);
  const { sorted, sort, toggle: toggleSort } = useSort(shown, cols, { key: "profit", dir: -1 });

  /** บิลของรายที่เปิดอยู่ ตามตัวกรองปี/เดือนเดียวกับตาราง */
  const openRow = openCi == null ? null : rows.find((r) => r.ci === openCi) ?? null;
  const openBills = useMemo<AllocBill[]>(() => {
    if (openCi == null || !data.bills) return [];
    return data.bills.filter((b) => b.ci === openCi
      && (!f.year || b.date.slice(0, 4) === f.year) && (!f.month || b.date.slice(5, 7) === f.month));
  }, [data.bills, openCi, f]);

  const pickLabel = !pick ? null
    : pick.kind === "all" ? "ลูกค้าทั้งหมด" : pick.kind === "gain" ? "ลูกค้าที่ทำกำไร"
    : pick.kind === "loss" ? "ลูกค้าที่ขาดทุน" : `ช่วง %Margin ${BUCKETS[pick.i]?.label ?? ""}`;
  const periodLabel = (f.year ? `พ.ศ. ${+f.year + 543}` : "ทุกปี") + (f.month ? ` · ${monthName(f.month)}` : "");

  return (
    <>
      <FilterBar>
        <FF label="ปี" value={f.year} onChange={set("year")}>
          <option value="">ทุกปี</option>
          {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
        </FF>
        <MonthFF value={f.month} onChange={set("month")} />
        <ClearFiltersBtn active={isFiltered(f, F0)} onClick={() => setF(F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        {/* 3 — การ์ดใหญ่ 3 ใบขนาดเท่ากัน กดเพื่อกรองตาราง */}
        <div className="dz-heroes cp-heroes">
          <Hero kind="cust" l="จำนวนลูกค้าทั้งหมด" v={fmt(kpi.n)} s="คน · ลูกค้าที่ผ่านตัวกรอง"
            foot={`กำไรสุทธิรวม ${signed(kpi.netAmt)} บาท`}
            onClick={() => toggle(sel("all"))} active={sameSel(pick, sel("all"))} />
          <Hero kind="profit" l="จำนวนลูกค้าที่มีกำไร" v={fmt(kpi.gain)} vSub={`(${pct(kpi.gainPct, 0)})`}
            s="คน · รายได้ ≥ ต้นทุน" foot={`กำไรรวม ${signed(kpi.gainAmt)} บาท`}
            onClick={() => toggle(sel("gain"))} active={sameSel(pick, sel("gain"))} />
          <Hero kind="loss" l="จำนวนลูกค้าขาดทุน" v={fmt(kpi.loss)} vSub={`(${pct(kpi.lossPct, 0)})`}
            s="คน · รายได้ < ต้นทุน" foot={`ขาดทุนรวม ${fmt(-kpi.lossAmt)} บาท`}
            onClick={() => toggle(sel("loss"))} active={sameSel(pick, sel("loss"))} />
        </div>

        {/* 4 — กราฟช่วง %Margin */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>การกระจายตัวของอัตรากำไร · จำนวนลูกค้าในแต่ละช่วง %Margin</h4>
          <div className="dz-box">
            <DBar data={hist} xKey="label" suffix=" ราย" colors={BUCKETS.map((b) => b.color)}
              series={[{ key: "จำนวนลูกค้า", label: "จำนวนลูกค้า", color: D.teal }]}
              onBarClick={(i) => toggle(sel("bucket", i))}
              activeIndex={pick?.kind === "bucket" ? pick.i : null} />
          </div>
          <Note>กดแท่งเพื่อดูรายลูกค้าในช่วงนั้นที่ตารางข้างล่าง กดซ้ำเพื่อยกเลิก · การ์ดสามใบด้านบนกดได้เหมือนกัน</Note>
        </div>

        {/* ตารางกำไรรายลูกค้า */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>
                กำไรรายลูกค้า ({fmt(sorted.length)} ราย)
                {pickLabel && <span className="cp-pick"> · {pickLabel}</span>}
              </h4>
              <p>{periodLabel} · {showAll ? `ทุกรายในกลุ่มนี้ (${fmt(subset.length)} ราย)` : "Top 10 กำไรสูงสุด และ Top 10 ขาดทุนมากสุด (เรียงตามยอดบาท) ของช่วงเวลาที่กรอง"}</p>
            </div>
            <div className="cp-seg" role="group" aria-label="ขอบเขตรายชื่อ">
              <button type="button" className={!showAll ? "on" : ""} onClick={() => setShowAll(false)}>Top 10 กำไร / ขาดทุน</button>
              <button type="button" className={showAll ? "on" : ""} onClick={() => setShowAll(true)}>แสดงทุกราย</button>
            </div>
          </div>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggleSort} rowKey={(r) => String(r.ci)}
            empty={showAll ? "ไม่มีลูกค้าในกลุ่มนี้" : "ไม่มีลูกค้า Top 10 ในกลุ่มนี้ — สลับเป็น \"แสดงทุกราย\""}
            className="dm-tbl cp-tbl"
            rowProps={(r) => {
              const can = gainSet.has(r.ci) || lossSet.has(r.ci);
              return can
                ? { onClick: () => setOpenCi(r.ci), title: "กดเพื่อดูรายการบิลของลูกค้ารายนี้" }
                : { className: "nolink", title: "ดูบิลได้เฉพาะลูกค้าที่ติด Top 10" };
            }} />
          <Note>
            กดที่แถวของลูกค้าที่ติด <b>Top 10</b> เพื่อดูรายการบิล · <b>ข้อจำกัด:</b> ระบบเก็บบิลรายใบไว้เฉพาะลูกค้าที่ติด
            Top 10 กำไรสูงสุด/ขาดทุนมากสุด (บาท) ของช่วงเวลาใดช่วงหนึ่ง (ข้อมูลจริงมีบิลราว 2 ล้านใบ เก็บทุกใบไม่ไหว)
            ลูกค้ารายอื่นจึงแสดงเป็นยอดรวมรายลูกค้าโดยกดดูรายละเอียดบิลไม่ได้ ·
            อัตรากำไร = กำไร ÷ รายได้ · รายได้ 0 แล้วขาดทุนคิดเป็น −100% ·
            ป้าย <span className="cp-rev">ปันตามรายได้</span> = บิลส่วนใหญ่ของรายนี้ไม่มีน้ำหนัก/ขนาด หรือกรอกขนาดผิดปกติ
            จึงปันต้นทุนตามสัดส่วนรายได้แทนน้ำหนัก × ระยะทาง
          </Note>
        </div>
      </Pane>

      {openRow && (
        <CustBillsModal row={openRow} bills={openBills} period={periodLabel} onClose={() => setOpenCi(null)} />
      )}
    </>
  );
}
