/**
 * ส่วนที่ 2 ของแท็บ "กำไรลูกค้า" (Demo) — ลูกหนี้ค้างชำระ จากชุด debtors/
 * (ไฟล์ "ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx" · etl/build_debtors.py) สเปกข้อ 5–7 ของ "ปรับปรุงโมเดล.pdf"
 *
 *   5. ตัวกรอง "ข้อมูล ณ วันที่" อยู่ริมขวา ค่าเริ่มต้น = วันที่อ้างอิงในชีตสรุปวิเคราะห์ (manifest.refDate)
 *      ไฟล์รุ่นเก่าไม่มี → ใช้ asOf (วันที่ล่าสุดในไฟล์) · **ไม่ขึ้นกับตัวกรองปี/เดือนของส่วนที่ 1**
 *   6. การ์ด 4 ใบ รายการทั้งหมด · ชำระแล้ว · ยังไม่ถึงกำหนด · ค้างชำระ
 *   7. กราฟแท่ง แกน x = ช่วงวันที่เกินกำหนด (ยังไม่ครบกำหนด · 1–30 · 31–60 · 61–90 · เกิน 90) แกน y = จำนวนรายการ
 *      tooltip บอกจำนวน + % จากรายการที่ยังไม่ชำระ (ยังไม่ถึงกำหนด + ค้างชำระ) · กดแท่งเปิดป็อบอัพรายลูกค้า
 *      คอลัมน์ ลูกค้า · ระยะเวลาเครดิต (ค่าที่พบบ่อยสุด) · จำนวนบิล · ยอดค้าง · เกินกำหนด (วัน) = มากสุด (เฉลี่ยในวงเล็บ)
 *      — เจ้าของงานเคาะ 22 ก.ย. 2569
 *
 * ★ สถานะคำนวณในแอปจากวันที่ที่เลือก (นิยามเดียวกับหมายเหตุท้ายชีตสรุปวิเคราะห์ ตรวจแล้วได้ตัวเลขเท่าชีต
 *   ณ 01/03/2569: 2,847 / 2,404 / 76 / 367):
 *     อยู่ในขอบเขต   = วางบิลไม่เกินวันที่เลือก           ชำระแล้ว = วันที่จบ ≤ วันที่เลือก
 *     ค้างชำระ       = ยังไม่จบ และครบกำหนดก่อนวันที่เลือก  ยังไม่ถึงกำหนด = ยังไม่จบ และครบกำหนดตั้งแต่วันที่เลือกขึ้นไป
 *   เทียบวันที่เป็นสตริง ISO ได้ตรง ๆ เพราะ ETL เขียนเป็น YYYY-MM-DD ทุกช่อง
 * ★ ข้อจำกัดที่ต้องเขียนกำกับ (สเปกสั่ง): ข้อมูลชุดใหม่มีแค่ 7 เดือน และจับคู่กับข้อมูลในอดีตไม่ได้ครบ
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { ShortId } from "../../lib/custmap/ShortId";
import { thDateSafe, thSlash } from "../../lib/record/date";
import type { DebtorRow, DebtorState } from "../../lib/data/useDebtors";
import { KC, Note, Pane } from "../dash-fleet/parts";
import { SortTable, fmt, pct, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import TruckLoader from "../../lib/ui/TruckLoader";

/** ช่วงวันที่เกินกำหนด — ช่องแรกคือยังไม่ครบกำหนด · สีตามรูปในสเปก (เทา → เหลือง → ส้ม → แดง → แดงเข้ม) */
const BUCKETS = [
  { label: "ยังไม่ครบกำหนด", color: D.slate },
  { label: "1–30 วัน", color: "#FACC15" },
  { label: "31–60 วัน", color: D.amber },
  { label: "61–90 วัน", color: D.rose },
  { label: "เกิน 90 วัน", color: "#9F1239" },
] as const;

const bucketOf = (over: number): number => (over <= 0 ? 0 : over <= 30 ? 1 : over <= 60 ? 2 : over <= 90 ? 3 : 4);

/** จำนวนวันระหว่างสองวันที่ ISO (a − b) — คิดเป็น UTC เพื่อไม่ให้เวลาออมแสง/โซนเวลามาปนตอนหาร 86,400,000 */
const dayNum = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

type Status = "paid" | "over" | "notdue";
interface Aged { r: DebtorRow; status: Status; over: number }

export default function OverdueSection({ state }: { state: DebtorState }) {
  const { data, error } = state;
  if (error || !data) {
    return (
      <div className="dz-cc">
        <h4>ลูกหนี้ค้างชำระ</h4>
        {error ? (
          <p className="dz-note" style={{ marginTop: 6 }}>
            ยังไม่มีชุดข้อมูลลูกหนี้ — วางไฟล์ <code>ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx</code> ใน{" "}
            <code>etl/data/debtors/</code> แล้ว dev server จะแปลงให้เอง (หรือรัน{" "}
            <code>python etl/build_debtors.py --dataset real</code>) · {error}
          </p>
        ) : <p className="dz-note" style={{ marginTop: 6 }}>กำลังโหลดข้อมูลลูกหนี้... <TruckLoader label={null} /></p>}
      </div>
    );
  }
  return <OverdueBody rows={data.rows} refDate={data.manifest.refDate ?? data.manifest.asOf}
    range={data.manifest.dateRange} />;
}

function OverdueBody({ rows, refDate, range }: {
  rows: DebtorRow[]; refDate: string; range: { min: string | null; max: string | null };
}) {
  useDebtorCodes();
  const [asOf, setAsOf] = useState(refDate);
  const [picked, setPicked] = useState<number | null>(null);
  // ETL รันใหม่แล้ววันที่อ้างอิงเปลี่ยน → ตามไปด้วย (ผู้ใช้ยังแก้เองต่อได้)
  useEffect(() => { setAsOf(refDate); }, [refDate]);

  /* ---------- สถานะของทุกใบ ณ วันที่เลือก ---------- */
  const aged = useMemo<Aged[]>(() => {
    const d0 = dayNum(asOf);
    const out: Aged[] = [];
    for (const r of rows) {
      if (r.issue > asOf) continue;                       // ยังไม่วางบิล ณ วันนั้น
      if (r.close && r.close <= asOf) { out.push({ r, status: "paid", over: 0 }); continue; }
      const over = d0 - dayNum(r.due);
      out.push({ r, status: over > 0 ? "over" : "notdue", over });
    }
    return out;
  }, [rows, asOf]);

  const kpi = useMemo(() => {
    const sum = (xs: Aged[]) => xs.reduce((s, a) => s + a.r.amount, 0);
    const paid = aged.filter((a) => a.status === "paid");
    const notdue = aged.filter((a) => a.status === "notdue");
    const over = aged.filter((a) => a.status === "over");
    return {
      all: aged.length, allAmt: sum(aged),
      paid: paid.length, paidAmt: sum(paid),
      notdue: notdue.length, notdueAmt: sum(notdue),
      over: over.length, overAmt: sum(over),
      unpaid: notdue.length + over.length,
    };
  }, [aged]);

  /* ---------- กราฟช่วงวันที่เกินกำหนด (เฉพาะที่ยังไม่ชำระ) ---------- */
  const unpaid = useMemo(() => aged.filter((a) => a.status !== "paid"), [aged]);
  const hist = useMemo(() => {
    const counts = BUCKETS.map(() => 0);
    for (const a of unpaid) counts[bucketOf(a.over)] = (counts[bucketOf(a.over)] ?? 0) + 1;
    return BUCKETS.map((b, i) => ({ label: b.label, จำนวนรายการ: counts[i] ?? 0 }));
  }, [unpaid]);

  const pickedRows = useMemo(
    () => (picked == null ? [] : unpaid.filter((a) => bucketOf(a.over) === picked)),
    [unpaid, picked]);

  return (
    <Pane deps={[aged]}>
      <div className="cp-sec">
        <div>
          <h3>ลูกหนี้ค้างชำระ</h3>
          <p>สถานะของทุกใบวางบิล ณ วันที่ที่เลือก · ไฟล์มีใบวางบิล {thDateSafe(range.min)} – {thDateSafe(range.max)}</p>
        </div>
        <label className="cp-date">
          <span>ข้อมูล ณ วันที่</span>
          <input type="date" value={asOf} min={range.min ?? undefined}
            onChange={(e) => { if (e.target.value) { setAsOf(e.target.value); setPicked(null); } }} />
          <b>{thSlash(asOf)}</b>
        </label>
      </div>

      {/* 6 — การ์ด 4 ใบ */}
      <div className="dz-cards four">
        <KC dot={D.indigo} l="จำนวนรายการทั้งหมด" v={fmt(kpi.all)}
          s={`ใบวางบิล · ${fmt(Math.round(kpi.allAmt))} บาท`} />
        <KC dot={D.emerald} tone="good" l="ชำระแล้ว" v={fmt(kpi.paid)}
          s={`ใบ · ${fmt(Math.round(kpi.paidAmt))} บาท · ${kpi.all ? pct(kpi.paid / kpi.all * 100, 0) : "–"}`} />
        <KC dot={D.amber} l="ยังไม่ถึงกำหนดชำระ" v={fmt(kpi.notdue)}
          s={`ใบ · ${fmt(Math.round(kpi.notdueAmt))} บาท`} />
        <KC dot={D.rose} tone={kpi.over ? "bad" : undefined} l="ค้างชำระ (เกินกำหนด)" v={fmt(kpi.over)}
          s={`ใบ · ${fmt(Math.round(kpi.overAmt))} บาท`} />
      </div>

      {/* 7 — กราฟ */}
      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายการที่ยังไม่ชำระ แยกตามช่วงวันที่เกินกำหนด · ณ {thSlash(asOf)}</h4>
        <div className="dz-box">
          <DBar data={hist} xKey="label" suffix=" รายการ" colors={BUCKETS.map((b) => b.color)} showValues
            series={[{ key: "จำนวนรายการ", label: "จำนวนรายการ", color: D.slate }]}
            onBarClick={(i) => setPicked(i)} activeIndex={picked}
            tooltipExtra={(i) => (kpi.unpaid ? `${pct((hist[i]?.จำนวนรายการ ?? 0) / kpi.unpaid * 100)} ของที่ยังไม่ชำระ` : null)} />
        </div>
        <Note>
          กดแท่งเพื่อดูรายลูกค้าในช่วงนั้น · ฐานของ % คือรายการที่ยังไม่ชำระทั้งหมด ({fmt(kpi.unpaid)} = ยังไม่ถึงกำหนด + ค้างชำระ) ·
          <b> ข้อจำกัดของส่วนนี้:</b> ข้อมูลที่ใช้วิเคราะห์เป็นข้อมูลชุดใหม่ซึ่งมีระยะเวลาเพียง 7 เดือน และไม่สามารถจับคู่กับข้อมูลในอดีต
          ได้อย่างครบถ้วน จึงอาจส่งผลให้การวิเคราะห์มีข้อจำกัดด้านความแม่นยำและความครบถ้วนของผลลัพธ์
        </Note>
      </div>

      {picked != null && (
        <OverdueModal bucket={BUCKETS[picked]?.label ?? ""} rows={pickedRows} asOf={asOf} onClose={() => setPicked(null)} />
      )}
    </Pane>
  );
}

/* ================================================================ ป็อบอัพรายลูกค้า */
interface CustAgg { cust: string; n: number | null; term: number; bills: number; amount: number; overMax: number; overAvg: number }

/** ค่าที่พบบ่อยสุด — ระยะเวลาเครดิตของลูกค้าที่มีหลายค่าในช่วงเดียวกัน (เจ้าของงานเลือก 22 ก.ย. 2569) */
function mode(xs: number[]): number {
  const c = new Map<number, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  let best = xs[0] ?? 0, n = -1;
  for (const [k, v] of c) if (v > n || (v === n && k < best)) { best = k; n = v; }
  return best;
}

function OverdueModal({ bucket, rows, asOf, onClose }: { bucket: string; rows: Aged[]; asOf: string; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const byCust = useMemo<CustAgg[]>(() => {
    const m = new Map<string, Aged[]>();
    for (const a of rows) (m.get(a.r.cust) ?? m.set(a.r.cust, []).get(a.r.cust)!).push(a);
    return [...m.entries()].map(([cust, xs]) => ({
      cust, n: numberForDebtor(cust),
      term: mode(xs.map((a) => a.r.term)),
      bills: xs.length,
      amount: xs.reduce((s, a) => s + a.r.amount, 0),
      overMax: Math.max(...xs.map((a) => a.over)),
      overAvg: xs.reduce((s, a) => s + a.over, 0) / xs.length,
    }));
  }, [rows]);

  const notDue = bucket === BUCKETS[0].label;
  const cols = useMemo<Col<CustAgg>[]>(() => [
    { key: "cust", label: "ลูกค้า", get: (c) => c.cust, render: (c) => <ShortId v={c.cust} n={c.n ?? undefined} /> },
    { key: "term", label: "ระยะเวลาเครดิต", get: (c) => c.term, num: true, render: (c) => `${c.term} วัน` },
    { key: "bills", label: "จำนวนบิล", get: (c) => c.bills, num: true },
    { key: "amount", label: "ยอดค้าง", get: (c) => c.amount, num: true, render: (c) => fmt(Math.round(c.amount)) },
    { key: "over", label: notDue ? "ถึงกำหนดในอีก (วัน)" : "เกินกำหนด (วัน)", get: (c) => c.overMax, num: true,
      // ช่องยังไม่ครบกำหนด over เป็นลบ — กลับเครื่องหมายให้อ่านเป็น "อีกกี่วันถึงกำหนด" (ใกล้สุดขึ้นก่อน)
      render: (c) => notDue
        ? <span>{fmt(-c.overMax)} <small style={{ color: "var(--ink-soft)" }}>(เฉลี่ย {fmt(Math.round(-c.overAvg))})</small></span>
        : <span style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(c.overMax)} <small style={{ fontWeight: 400, color: "var(--ink-soft)" }}>(เฉลี่ย {fmt(Math.round(c.overAvg))})</small></span> },
  ], [notDue]);
  const { sorted, sort, toggle } = useSort(byCust, cols, { key: "amount", dir: -1 });

  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`ลูกหนี้ ${bucket}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{bucket} <span>· ณ {thSlash(asOf)}</span></div>
            <p>{fmt(byCust.length)} ราย · {fmt(rows.length)} ใบวางบิล · ยอดค้าง {fmt(Math.round(rows.reduce((s, a) => s + a.r.amount, 0)))} บาท ·
              เกินกำหนด (วัน) = มากที่สุดของลูกค้ารายนั้น (เฉลี่ยในวงเล็บ) · ระยะเวลาเครดิต = ค่าที่พบบ่อยสุด</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(c) => c.cust}
            empty="ไม่มีรายการในช่วงนี้" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
