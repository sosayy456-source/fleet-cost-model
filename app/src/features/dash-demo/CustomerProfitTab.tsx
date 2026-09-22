/**
 * แท็บ "กำไรลูกค้า" ของเมนู Demo — สองส่วนต่อกันในแท็บเดียว (เจ้าของงานสั่ง 20 ก.ย. 2569)
 *
 *   ส่วนที่ 1  กำไรลูกค้า        ตัวกรองปี/เดือน · การ์ด 3 ใบ · กราฟกระจายตัวของ %Margin
 *                               · ตารางกำไรรายลูกค้าใต้กราฟ (กดแท่งเพื่อกรอง)
 *   ส่วนที่ 2  ลูกหนี้ค้างชำระ    ตัวกรอง "ข้อมูล ณ วันที่" ริมขวา · การ์ด 4 ใบ
 *                               · กราฟช่วงวันเกินกำหนด (กดแท่งเพื่อดูรายลูกค้า)
 *
 * ★ สองส่วนนี้อ่านชุดข้อมูลคนละชุดและ **ไม่เชื่อมกันเลย** — ส่วนที่ 1 มาจาก alloc/
 *   (ไฟล์บิล + รายงานค่าเดินทาง) ส่วนที่ 2 มาจาก debtors/ (ไฟล์ใบวางบิล) ซึ่งรหัสลูกหนี้
 *   เป็น hex 40 ตัวคนละขนาดกับรหัสในไฟล์บิล จึง join กันไม่ได้และไม่ควร join
 *   แต่ละชุดตรวจ sample/real ของตัวเอง จึงเป็นคนละชุดข้อมูลพร้อมกันได้
 *
 * ★ ตัวเลขในส่วนที่ 1 ไม่เท่ากับหน้า "กำไรลูกค้า (ปันส่วนต้นทุน)" ใน Executive Dashboard
 *   เพราะหน้านั้นแยกผู้ส่ง/ผู้รับเป็นคนละระเบียน ส่วนหน้านี้ยุบรหัสเดียวให้เหลือแถวเดียว
 *   ตามที่สั่งให้ตัดคอลัมน์ผู้จ่ายออก — ตั้งใจ ไม่ใช่บั๊ก
 */
import { useMemo, useState } from "react";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { ShortId } from "../../lib/custmap/ShortId";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { useAlloc } from "../../lib/data/useAlloc";
import type { AllocData } from "../../lib/data/useAlloc";
import { useDebtors } from "../../lib/data/useDebtors";
import type { DebtorData, DebtorRow } from "../../lib/data/useDebtors";
import { daysBetween, thSlash } from "../../lib/record/date";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import FleetDetailDialog from "../../lib/ui/FleetDetailDialog";
import GrowBox from "../../lib/ui/GrowBox";
import { CC, Hero, KC, Note, Pane, searchStyle } from "../dash-fleet/parts";
import {
  ListFF, MonthFF, SortTable, fmt, marginTone, monthLabel, pct, signed, useSort,
} from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";

/* ================================================================ ส่วนที่ 1 */

/** เขียวเข้มกว่า D.emerald หนึ่งขั้น — แท่งขวาสุดในรูปที่เจ้าของงานส่งมา */
const GREEN_DEEP = "#065F46";

/**
 * ช่วง %Margin ของกราฟกระจายตัว — ขอบล่างรวม ขอบบนไม่รวม (ยกเว้นแท่งสุดท้าย)
 * สัดส่วนและลำดับตามรูปที่เจ้าของงานส่งมา
 */
const MARGIN_BUCKETS: { label: string; color: string; hit: (m: number) => boolean }[] = [
  { label: "< -20%", color: D.rose, hit: (m) => m < -20 },
  { label: "-20..-10%", color: D.pink, hit: (m) => m >= -20 && m < -10 },
  { label: "-10..0%", color: D.orange, hit: (m) => m >= -10 && m < 0 },
  { label: "0-10%", color: D.amber, hit: (m) => m >= 0 && m < 10 },
  { label: "10-20%", color: D.teal, hit: (m) => m >= 10 && m < 20 },
  { label: "20-30%", color: D.emeraldLight, hit: (m) => m >= 20 && m < 30 },
  { label: "30-40%", color: D.emerald, hit: (m) => m >= 30 && m < 40 },
  { label: "≥ 40%", color: GREEN_DEEP, hit: (m) => m >= 40 },
];

/** 1 แถวในตารางกำไรลูกค้า — i = ดัชนีใน custindex ซึ่งเป็นคีย์ที่ custmonths/topbills อ้างถึง */
interface CustRow {
  i: number; code: string; n: number; sides: number;
  bills: number; revenue: number; cost: number; profit: number; lossBills: number;
  margin: number | null;
}

/**
 * อัตรากำไรของลูกค้าหนึ่งราย — กติกาเดียวกับแท็บกำไรรายเส้นทางเป๊ะ
 * รายได้ 0 แล้วขาดทุน = เสียต้นทุนไปทั้งก้อนโดยไม่ได้อะไรกลับ → −100%
 * รายได้ 0 และไม่ขาดทุน (ต้นทุน 0 ด้วย) = null → ไม่เข้าแท่งไหนในกราฟ
 */
const marginOf = (revenue: number, profit: number): number | null =>
  revenue ? (profit / revenue) * 100 : profit < 0 ? -100 : null;

interface F1 { year: string; month: string }
const F1_0: F1 = { year: "", month: "" };

function ProfitSection({ data }: { data: AllocData }) {
  const { manifest, custIndex, custMonths, topBills } = data;
  const [f, setF] = useState<F1>(F1_0);
  const [bucket, setBucket] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CustRow | null>(null);

  const months = manifest.months ?? [];
  const years = useMemo(() => [...new Set(months.map((m) => m.slice(0, 4)))].sort(), [months]);

  /** เดือนที่ผ่านตัวกรอง — เป็นดัชนีใน manifest.months (คีย์เดียวกับ custmonths.mi) */
  const keepMi = useMemo(() => {
    if (!f.year && !f.month) return null;            // null = ไม่กรอง ใช้ยอดรวมทั้งชุด
    const keep = new Set<number>();
    months.forEach((m, i) => {
      if ((!f.year || m.slice(0, 4) === f.year) && (!f.month || m.slice(5, 7) === f.month)) keep.add(i);
    });
    return keep;
  }, [months, f]);

  /** ลูกค้าทั้งหมดตามตัวกรอง — ไม่กรอง = อ่าน custindex ตรง ๆ · กรองแล้ว = ยุบ custmonths */
  const all = useMemo<CustRow[]>(() => {
    if (!custIndex) return [];
    const base = (i: number, bills: number, revenue: number, cost: number, lossBills: number): CustRow => ({
      i, code: custIndex.code[i] ?? "", n: custIndex.n[i] ?? 0, sides: custIndex.sides[i] ?? 0,
      bills, revenue, cost, profit: revenue - cost, lossBills,
      margin: marginOf(revenue, revenue - cost),
    });
    if (keepMi == null) {
      return custIndex.code.map((_, i) => base(
        i, custIndex.bills[i] ?? 0, custIndex.revenue[i] ?? 0, custIndex.cost[i] ?? 0,
        custIndex.lossBills[i] ?? 0));
    }
    if (!custMonths) return [];
    const acc = new Map<number, [number, number, number, number]>();
    for (let k = 0; k < custMonths.ci.length; k++) {
      if (!keepMi.has(custMonths.mi[k] ?? -1)) continue;
      const ci = custMonths.ci[k] ?? 0;
      const a = acc.get(ci) ?? [0, 0, 0, 0];
      a[0] += custMonths.bills[k] ?? 0;
      a[1] += custMonths.revenue[k] ?? 0;
      a[2] += custMonths.cost[k] ?? 0;
      a[3] += custMonths.lossBills[k] ?? 0;
      acc.set(ci, a);
    }
    return [...acc].map(([i, a]) => base(i, a[0], a[1], a[2], a[3]));
  }, [custIndex, custMonths, keepMi]);

  /* ---------- การ์ด 3 ใบ ---------- */
  const kpi = useMemo(() => {
    const gain = all.filter((r) => r.profit > 0).length;
    const loss = all.filter((r) => r.profit < 0).length;
    const n = all.length;
    return { n, gain, loss, gainPct: n ? (gain / n) * 100 : 0, lossPct: n ? (loss / n) * 100 : 0 };
  }, [all]);

  /** เส้นแนวโน้มเล็ก ๆ ท้ายการ์ด — จำนวนลูกค้าที่มีรายการในแต่ละเดือนของชุดที่กรองอยู่ */
  const trend = useMemo(() => {
    if (!custMonths) return undefined;
    const per = new Array<number>(months.length).fill(0);
    for (let k = 0; k < custMonths.ci.length; k++) {
      const mi = custMonths.mi[k] ?? -1;
      if (mi >= 0 && (keepMi == null || keepMi.has(mi))) per[mi]! += 1;
    }
    const used = per.filter((_, i) => keepMi == null || keepMi.has(i));
    return used.length > 1 ? used : undefined;
  }, [custMonths, months.length, keepMi]);

  /* ---------- กราฟกระจายตัว %Margin ---------- */
  const hist = useMemo(() => {
    const n = MARGIN_BUCKETS.map(() => 0);
    let noMargin = 0;
    for (const r of all) {
      if (r.margin == null) { noMargin++; continue; }
      const i = MARGIN_BUCKETS.findIndex((b) => b.hit(r.margin!));
      if (i >= 0) n[i]! += 1;
    }
    return { rows: MARGIN_BUCKETS.map((b, i) => ({ ช่วง: b.label, ลูกค้า: n[i]! })), noMargin };
  }, [all]);

  /* ---------- ตารางใต้กราฟ ---------- */
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const b = bucket == null ? null : MARGIN_BUCKETS[bucket];
    return all.filter((r) =>
      (!b || (r.margin != null && b.hit(r.margin)))
      && (!needle || r.code.toLowerCase().includes(needle)));
  }, [all, bucket, needle]);

  const drill = useMemo(() => new Set(custIndex?.drill ?? []), [custIndex]);

  const cols = useMemo<Col<CustRow>[]>(() => [
    { key: "code", label: "ลูกค้า", get: (r) => r.code,
      render: (r) => (
        <span>
          <ShortId v={r.code} n={r.n} />
          {drill.has(r.i) && <span className="dm-drill" title="กดที่แถวเพื่อดูรายละเอียดบิล"> ▸</span>}
        </span>
      ) },
    { key: "bills", label: "บิล", get: (r) => r.bills, num: true },
    { key: "revenue", label: "รายได้", get: (r) => r.revenue, num: true,
      render: (r) => fmt(r.revenue) },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (r) => r.cost, num: true,
      render: (r) => fmt(r.cost) },
    { key: "profit", label: "กำไร/ขาดทุน", get: (r) => r.profit, num: true,
      render: (r) => (
        <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.profit))}</b>
      ) },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => (
        <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>
          {r.margin == null ? "–" : pct(r.margin, 0)}
        </span>
      ) },
    { key: "lossBills", label: "บิลที่ขาดทุน", get: (r) => r.lossBills, num: true },
  ], [drill]);
  const { sorted, sort, toggle } = useSort(rows, cols, { key: "profit", dir: -1 });

  /** บิลของลูกค้าที่กดเลือก — กรองตามเดือนที่เลือกด้วย ให้ตรงกับตัวเลขในแถว */
  const pickedBills = useMemo(() => {
    if (!picked || !topBills) return [];
    const out: { bill: string; mo: string; side: string; route: string; revenue: number; cost: number }[] = [];
    for (let k = 0; k < topBills.ci.length; k++) {
      if (topBills.ci[k] !== picked.i) continue;
      const mi = topBills.mi[k] ?? -1;
      if (keepMi != null && !keepMi.has(mi)) continue;
      const o = topBills.o[k] ?? -1, d = topBills.d[k] ?? -1;
      out.push({
        bill: topBills.bill[k] ?? "",
        mo: mi >= 0 ? monthLabel(months[mi] ?? "") : "–",
        side: topBills.side[k] === 1 ? "ผู้ส่ง" : "ผู้รับ",
        route: `${o >= 0 ? topBills.place[o] : "–"} → ${d >= 0 ? topBills.place[d] : "–"}`,
        revenue: topBills.revenue[k] ?? 0,
        cost: topBills.cost[k] ?? 0,
      });
    }
    return out.sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
  }, [picked, topBills, keepMi, months]);

  if (!custIndex) {
    return (
      <div className="card">
        <h2>กำไรลูกค้า</h2>
        <p className="muted">
          ยังไม่มีไฟล์ <code>alloc/custindex.json</code> — สร้างด้วย{" "}
          <code>python etl/build_alloc.py --dataset sample</code> (หรือ <code>--dataset real</code>)
        </p>
      </div>
    );
  }

  const top = data.manifest.byCustomer?.top ?? 10;

  return (
    <>
      <FilterBar>
        <ListFF label="ปี" all="ทุกปี" value={f.year}
          onChange={(v) => setF((p) => ({ ...p, year: v }))} opts={years}
          labelOf={(y) => `พ.ศ. ${+y + 543}`} />
        <MonthFF value={f.month} onChange={(v) => setF((p) => ({ ...p, month: v }))} />
        <ClearFiltersBtn active={f.year !== "" || f.month !== ""} onClick={() => setF(F1_0)} />
      </FilterBar>

      <Pane deps={[all, bucket]}>
        <div className="dz-heroes">
          <Hero kind="cust" l="จำนวนลูกค้าทั้งหมด" v={fmt(kpi.n)} unit="คน" trend={trend}
            s="ลูกค้าที่ผ่านตัวกรอง" />
          <Hero kind="profit" l="จำนวนลูกค้าที่มีกำไร" v={fmt(kpi.gain)} unit="คน" trend={trend}
            s={<>รายได้ &gt; ต้นทุน · <b>{pct(kpi.gainPct, 0)}</b> ของทั้งหมด</>} />
          <Hero kind="loss" l="จำนวนลูกค้าขาดทุน" v={fmt(kpi.loss)} unit="คน" trend={trend}
            s={<>รายได้ &lt; ต้นทุน · <b>{pct(kpi.lossPct, 0)}</b> ของทั้งหมด</>} />
        </div>

        <div style={{ marginTop: 14 }}>
          <CC title="การกระจายตัวของอัตรากำไร · จำนวนลูกค้าในแต่ละช่วง %margin" tall>
            <DBar data={hist.rows} xKey="ช่วง" suffix=" ราย"
              colors={MARGIN_BUCKETS.map((b) => b.color)}
              series={[{ key: "ลูกค้า", label: "จำนวนลูกค้า", color: D.emerald }]}
              onBarClick={(i) => setBucket((b) => (b === i ? null : i))} />
          </CC>
          <Note>
            กดที่แท่งเพื่อดูเฉพาะลูกค้าในช่วงนั้น กดซ้ำเพื่อล้าง
            {hist.noMargin > 0 && <> · ลูกค้าที่รายได้เป็น 0 และไม่ขาดทุน {fmt(hist.noMargin)} ราย
              คิดอัตรากำไรไม่ได้ จึงไม่อยู่ในแท่งไหน</>}
          </Note>
        </div>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                        gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>
              กำไรรายลูกค้า ({fmt(rows.length)} ราย)
              {bucket != null && <span className="muted"> · ช่วง {MARGIN_BUCKETS[bucket]!.label}</span>}
            </h4>
            <input style={{ ...searchStyle, minWidth: 220 }} value={q}
              onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหารหัสลูกค้า (รหัสต้นฉบับ)" />
          </div>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
            rowKey={(r) => r.code} empty="ไม่พบลูกค้าตามเงื่อนไขที่เลือก" className="dm-cust"
            rowProps={(r) => (drill.has(r.i) ? {
              onClick: () => setPicked(r),
              style: { cursor: "pointer" },
              title: "ดูรายละเอียดบิลของลูกค้ารายนี้",
            } : {})} />
          <Note>
            กดดูรายละเอียดบิลได้เฉพาะ {top} รายที่กำไรสูงสุดและ {top} รายที่ขาดทุนสูงสุด
            (มีเครื่องหมาย ▸ หน้ารหัส) ซึ่ง <b>คัดจากยอดรวมทั้งชุด ไม่ใช่ตามตัวกรองที่เลือกอยู่</b> —
            เก็บบิลของลูกค้าทุกรายจะทำให้ไฟล์ใหญ่เกินกว่าที่เบราว์เซอร์จะโหลดไหว
            รายอื่นยังเห็นยอดรวมครบทุกราย แต่กดเข้าไปดูไม่ได้
          </Note>
          <Note>
            ต้นทุนจัดสรร = ต้นทุนของเที่ยวที่ปันเข้าบิลตามภาระงาน (น้ำหนักที่ใช้คิด × ระยะทาง)
            โดยน้ำหนักที่ใช้คิดเลือกจาก น้ำหนักจริง เทียบกับ ปริมาตร × 0.167 ตัน/ลบ.ม.
            แล้วเอาค่าที่มากกว่า · ผู้จ่ายเงินมาจากประเภทการชำระเงินของบิล
            {data.manifest.byCustomer && data.manifest.byCustomer.noMonth.bills > 0 && (
              <> · บิล {fmt(data.manifest.byCustomer.noMonth.bills)} ใบอ่านเดือนไม่ออก
                จึงไม่ปรากฏเมื่อเลือกปีหรือเดือน</>
            )}
          </Note>
        </div>
      </Pane>

      {picked && (
        <FleetDetailDialog title={`บิลของลูกค้า ${picked.code.slice(0, 12)}…`} onClose={() => setPicked(null)}>
          <div className="dz-cards" style={{ marginBottom: 12 }}>
            <KC dot={D.indigo} l="จำนวนบิล" v={fmt(pickedBills.length)} s="ตามตัวกรองที่เลือกอยู่" />
            <KC dot={D.teal} l="รายได้" v={fmt(pickedBills.reduce((s, b) => s + b.revenue, 0))} s="บาท" />
            <KC dot={D.amber} l="ต้นทุนจัดสรร" v={fmt(pickedBills.reduce((s, b) => s + b.cost, 0))} s="บาท" />
            <KC dot={picked.profit < 0 ? D.rose : D.emerald} tone={picked.profit < 0 ? "bad" : "good"}
              l="กำไร/ขาดทุน"
              v={signed(Math.round(pickedBills.reduce((s, b) => s + b.revenue - b.cost, 0)))} s="บาท" />
          </div>
          <GrowBox rows={pickedBills} render={(shown) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>เลขที่บิล</th><th>เดือน</th><th>ฝ่าย</th><th>เส้นทาง</th>
                <th className="n">รายได้</th><th className="n">ต้นทุนจัดสรร</th><th className="n">กำไร</th>
              </tr></thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>
                    ไม่มีบิลในช่วงเวลาที่เลือก</td></tr>
                ) : shown.map((b) => (
                  <tr key={b.bill}>
                    <td style={{ fontWeight: 600 }}>{b.bill}</td>
                    <td>{b.mo}</td>
                    <td>{b.side}</td>
                    <td>{b.route}</td>
                    <td className="n">{fmt(b.revenue)}</td>
                    <td className="n">{fmt(b.cost)}</td>
                    <td className="n" style={{ fontWeight: 700,
                      color: b.revenue - b.cost < 0 ? "var(--red)" : "var(--green)" }}>
                      {signed(Math.round(b.revenue - b.cost))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )} />
        </FleetDetailDialog>
      )}
    </>
  );
}

/* ================================================================ ส่วนที่ 2 */

/** วันที่ตั้งต้นของช่อง "ข้อมูล ณ วันที่" (เจ้าของงานเลือก 20 ก.ย. 2569) */
const AS_OF_DEFAULT = "2026-06-01";

/**
 * ช่วงวันเกินกำหนดชำระ — แท่งแรกคือใบที่ยังไม่ถึงกำหนด ที่เหลือไล่ตามจำนวนวันที่เลย
 * กำหนดมาแล้ว (ตามรูปที่เจ้าของงานส่งมา)
 */
const AGING: { label: string; color: string; hit: (over: number) => boolean }[] = [
  { label: "ยังไม่ครบกำหนด", color: D.slate, hit: (o) => o <= 0 },
  { label: "1-30 วัน", color: D.amber, hit: (o) => o >= 1 && o <= 30 },
  { label: "31-60 วัน", color: D.orange, hit: (o) => o >= 31 && o <= 60 },
  { label: "61-90 วัน", color: D.rose, hit: (o) => o >= 61 && o <= 90 },
  { label: "เกิน 90 วัน", color: "#9F1239", hit: (o) => o > 90 },
];

/** ใบวางบิลหนึ่งใบพร้อมสถานะที่คิด ณ วันที่ที่ผู้ใช้เลือก */
interface AgedRow { r: DebtorRow; over: number }

function DebtorSection({ data }: { data: DebtorData }) {
  const { manifest, rows } = data;
  const codes = useDebtorCodes();
  const [bar, setBar] = useState<number | null>(null);

  const [asOf, setAsOf] = useState(() => {
    // ตั้งต้นที่วันที่เจ้าของงานกำหนด แต่ต้องไม่หลุดช่วงข้อมูลที่ไฟล์มีจริง
    const min = manifest.dateRange.min;
    if (min && AS_OF_DEFAULT < min) return min;
    if (AS_OF_DEFAULT > manifest.asOf) return manifest.asOf;
    return AS_OF_DEFAULT;
  });

  /**
   * แยกสถานะ ณ วันที่ที่เลือก — คิดใหม่ทั้งหมดจากวันที่ในแต่ละใบ ไม่ใช้ฟิลด์ over ที่ ETL
   * เติมไว้ เพราะตัวนั้นคิดจาก asOf ของไฟล์ (วันล่าสุดในไฟล์) ซึ่งเป็นคนละวันกับที่นี่
   *
   * ★ ยืนยันแล้วว่านิยามชุดนี้ตรงกับชีต "สรุปวิเคราะห์" ในไฟล์ต้นฉบับทุกตัว —
   *   ตั้งวันอ้างอิง 01/03/2026 ได้ ทั้งหมด 2,847 · ชำระแล้ว 2,404 · ยังไม่ถึงกำหนด 367 ·
   *   ค้างชำระ 76 ทั้งจำนวนรายการและยอดเงิน
   */
  const split = useMemo(() => {
    const inScope: DebtorRow[] = [];
    const paid: DebtorRow[] = [];
    const notDue: AgedRow[] = [];
    const overdue: AgedRow[] = [];
    for (const r of rows) {
      if (r.issue > asOf) continue;                       // ยังไม่วางบิล ณ วันนั้น
      inScope.push(r);
      if (r.close && r.close <= asOf) { paid.push(r); continue; }
      const over = daysBetween(r.due, asOf) ?? 0;
      (r.due < asOf ? overdue : notDue).push({ r, over });
    }
    return { inScope, paid, notDue, overdue, unpaid: [...notDue, ...overdue] };
  }, [rows, asOf]);

  const sum = (list: { amount: number }[]) => list.reduce((s, x) => s + x.amount, 0);
  const amt = (list: AgedRow[]) => list.reduce((s, x) => s + x.r.amount, 0);

  /** จำนวนรายการต่อช่วง + % จากรายการที่ยังไม่ชำระทั้งหมด (ยังไม่ถึงกำหนด + ค้างชำระ) */
  const buckets = useMemo(() => {
    const base = split.unpaid.length;
    return AGING.map((b) => {
      const hit = split.unpaid.filter((x) => b.hit(x.over));
      return {
        ช่วง: b.label,
        รายการ: hit.length,
        amount: hit.reduce((s, x) => s + x.r.amount, 0),
        share: base ? (hit.length / base) * 100 : 0,
      };
    });
  }, [split]);

  /** ยุบรายการในแท่งที่กดเป็นรายลูกหนี้ */
  const picked = useMemo(() => {
    if (bar == null) return [];
    const b = AGING[bar]!;
    const by = new Map<string, { cust: string; terms: Set<number>; bills: number; amount: number; over: number }>();
    for (const x of split.unpaid) {
      if (!b.hit(x.over)) continue;
      const k = x.r.cust || "(ไม่ระบุ)";
      const g = by.get(k) ?? { cust: k, terms: new Set<number>(), bills: 0, amount: 0, over: 0 };
      g.terms.add(x.r.term);
      g.bills++;
      g.amount += x.r.amount;
      g.over = Math.max(g.over, x.over);
      by.set(k, g);
    }
    return [...by.values()].sort((a, b2) => b2.amount - a.amount);
  }, [bar, split]);

  return (
    <Pane deps={[asOf, split]}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="dz-t" style={{ margin: 0 }}>ลูกหนี้ค้างชำระ</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span className="muted">ข้อมูล ณ วันที่</span>
          <input type="date" value={asOf} min={manifest.dateRange.min ?? undefined} max={manifest.asOf}
            onChange={(e) => { setAsOf(e.target.value || manifest.asOf); setBar(null); }}
            style={{ ...searchStyle, minWidth: 150 }} />
          <span className="dh-num muted">{thSlash(asOf)}</span>
        </label>
      </div>

      <div className="dz-cards four">
        <KC dot={D.indigo} l="จำนวนรายการทั้งหมด" v={fmt(split.inScope.length)}
          s={`${fmt(sum(split.inScope))} บาท · วางบิลแล้ว ณ วันที่เลือก`} />
        <KC dot={D.emerald} tone="good" l="จำนวนรายการที่ชำระแล้ว" v={fmt(split.paid.length)}
          s={`${fmt(sum(split.paid))} บาท`} />
        <KC dot={D.amber} l="ยังไม่ถึงกำหนดชำระ" v={fmt(split.notDue.length)}
          s={`${fmt(amt(split.notDue))} บาท`} />
        <KC dot={D.rose} tone={split.overdue.length ? "bad" : undefined} l="จำนวนรายการที่ค้างชำระ"
          v={fmt(split.overdue.length)} s={`${fmt(amt(split.overdue))} บาท · เลยกำหนดแล้ว`} />
      </div>

      <div style={{ marginTop: 14 }}>
        <CC title="จำนวนรายการตามช่วงวันที่เกินกำหนดชำระ" tall>
          <DBar data={buckets} xKey="ช่วง" suffix=" รายการ"
            colors={AGING.map((b) => b.color)}
            series={[{ key: "รายการ", label: "จำนวนรายการ", color: D.indigo }]}
            onBarClick={(i) => setBar(i)}
            tipFormat={(v, name, row) => [
              `${fmt(v)} รายการ (${pct(Number(row.share ?? 0), 1)}) · ${fmt(Number(row.amount ?? 0))} บาท`,
              name,
            ]} />
        </CC>
        <Note>
          % คิดจากรายการที่ยังไม่ชำระทั้งหมด ({fmt(split.unpaid.length)} รายการ = ยังไม่ถึงกำหนด +
          ค้างชำระ) ไม่ใช่จากรายการทั้งหมด · กดที่แท่งเพื่อดูรายลูกหนี้
        </Note>
        <Note>
          ข้อจำกัด: ข้อมูลที่ใช้วิเคราะห์เป็นข้อมูลใหม่ ซึ่งมีระยะเวลาเพียง 7 เดือน
          และไม่สามารถจับคู่กับข้อมูลในอดีตได้อย่างครบถ้วน จึงอาจส่งผลให้การวิเคราะห์มีข้อจำกัด
          ด้านความแม่นยำและความครบถ้วนของผลลัพธ์
        </Note>
      </div>

      {bar != null && (
        <FleetDetailDialog title={`ลูกหนี้ในช่วง "${AGING[bar]!.label}" ณ ${thSlash(asOf)}`}
          onClose={() => setBar(null)}>
          <GrowBox rows={picked} render={(shown) => (
            <table className="dz-tbl">
              <thead><tr>
                <th>ลูกค้า</th><th className="n">ระยะเวลาเครดิต</th><th className="n">จำนวนบิล</th>
                <th className="n">ยอดค้าง</th><th className="n">เกินกำหนด (วัน)</th>
              </tr></thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>
                    ไม่มีรายการในช่วงนี้</td></tr>
                ) : shown.map((g) => (
                  <tr key={g.cust}>
                    <td><ShortId v={g.cust} n={numberForDebtor(g.cust) ?? 0} /></td>
                    {/* เครดิตเป็นราย "บิล" ลูกค้ารายเดียวจึงมีได้หลายค่า */}
                    <td className="n">{[...g.terms].sort((a, b2) => a - b2).join(", ")} วัน</td>
                    <td className="n">{fmt(g.bills)}</td>
                    <td className="n">{fmt(g.amount)} บาท</td>
                    <td className="n" style={g.over > 30 ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                      {g.over > 0 ? g.over : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )} />
          {!codes && <Note>กำลังโหลดตารางรหัสลูกหนี้ — รหัส CUS จะขึ้นเมื่อโหลดเสร็จ</Note>}
        </FleetDetailDialog>
      )}
    </Pane>
  );
}

/* ================================================================ รวมสองส่วน */

export default function CustomerProfitTab() {
  const alloc = useAlloc();
  const debtors = useDebtors();

  return (
    <>
      {alloc.error ? (
        <div className="card">
          <h2>กำไรลูกค้า</h2>
          <div className="banner">{alloc.error}</div>
          <p className="muted">
            สร้างไฟล์ข้อมูลด้วย <code>python etl/build_alloc.py --dataset sample</code>
          </p>
        </div>
      ) : !alloc.data ? (
        <div className="card"><p className="muted">กำลังโหลดข้อมูลกำไรลูกค้า...</p></div>
      ) : (
        <ProfitSection data={alloc.data} />
      )}

      {/* ★ ส่วนที่ 2 ต้องไม่ทำให้ส่วนที่ 1 พัง — ไม่มีไฟล์ลูกหนี้ (เช่นบน GitHub Pages ที่บังคับ
          ชุดตัวอย่าง) ให้ขึ้นข้อความบอกวิธีสร้างเฉย ๆ */}
      <div style={{ marginTop: 22 }}>
        {debtors.error ? (
          <div className="dz-cc">
            <div className="dz-t" style={{ marginTop: 0 }}>ลูกหนี้ค้างชำระ</div>
            <p className="muted">
              ยังไม่มีชุดข้อมูลลูกหนี้ — วางไฟล์ใบวางบิล (<code>.xlsx</code>) ใน{" "}
              <code>etl/data/debtors/</code> แล้วรัน{" "}
              <code>python etl/build_debtors.py --dataset real</code>
            </p>
          </div>
        ) : !debtors.data ? (
          <div className="dz-cc"><p className="muted">กำลังโหลดข้อมูลลูกหนี้...</p></div>
        ) : (
          <DebtorSection data={debtors.data} />
        )}
      </div>
    </>
  );
}
