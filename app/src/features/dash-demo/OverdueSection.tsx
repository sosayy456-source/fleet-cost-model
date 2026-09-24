/**
 * ส่วนที่ 2 ของแท็บ "กำไรลูกค้า" (Demo) — ลูกหนี้รายใดจ่ายช้ากระทบกระแสเงินสด (DSO) จากชุด debtors/
 * (ไฟล์ "ข้อมูลการรับชำระ_วิเคราะห์ 99.xlsx" · etl/build_debtors.py) สเปกข้อ 5–7 ของ "ปรับปรุงโมเดล.pdf"
 * แก้ตามสเปกรุ่นแก้ 23 ก.ย. 2569 ("ใช้ข้อมูลทั้งที่รับชำระแล้ว และยังไม่ได้รับชำระ")
 *
 *   5. ตัวกรอง "ข้อมูล ณ วันที่" อยู่ริมขวา **ค่าเริ่มต้น = 31/05/2026 (DEFAULT_AS_OF · เจ้าของงานสั่ง 24 ก.ย. 2569)**
 *      ถ้าไฟล์เริ่มหลังวันนั้น (ข้อมูลชุดอื่น) ถอยไปใช้วันที่อ้างอิงในชีตสรุปวิเคราะห์ (manifest.refDate) → asOf (วันล่าสุดในไฟล์)
 *      **ไม่ขึ้นกับตัวกรองปี/เดือนของส่วนที่ 1**
 *   6. การ์ดใหญ่ไล่สี 5 ใบ (แบบเดียวกับการ์ดของส่วนที่ 1 — เจ้าของงานสั่ง 23 ก.ย. 2569)
 *      รายการทั้งหมด · ชำระแล้ว · ยังไม่ชำระ · ยังไม่ถึงกำหนด · DSO
 *      **DSO แบบมาตรฐาน** (เจ้าของงานเลือก 23 ก.ย. 2569) = ยอดลูกหนี้ค้าง ณ วันที่เลือก ÷ ยอดวางบิล × จำนวนวัน
 *      ช่วงที่นับ = ใบวางบิลใบแรกในไฟล์ → วันที่เลือก (ข้อมูลมีแค่ราว 7 เดือน ตัดเป็น 90/365 วันไม่ได้)
 *      เทียบกับระยะเวลาเครดิตที่พบบ่อยสุดของใบในขอบเขต
 *   7. กราฟแท่ง แกน x = ช่วงวันที่เกินกำหนด 6 ช่วง (ยังไม่ถึง · 1–7 · 8–30 · 31–60 · 61–90 · > 90) **แกน y = ยอดเงิน (บาท) ไม่ใช่จำนวนรายการ**
 *      (สเปก: "คนเยอะไม่ได้แปลว่ายอดเยอะ") ป้ายบนแท่ง = ยอดค้างของช่วงนั้น
 *      **ยอดที่ชำระแล้ว** จัดเข้าช่วงตามวันที่จ่ายช้ากว่ากำหนด (วันที่จบ − วันครบกำหนด จ่ายตรงเวลา/ก่อนกำหนด
 *      เข้าช่องแรก) — เจ้าของงานเลือกแบบนี้ 23 ก.ย. 2569 เพื่อให้เห็นพฤติกรรมจ่ายช้าทั้งหมด ไม่ใช่แค่ยอดค้าง ณ วันนั้น
 *      **ปุ่มหัวกราฟเลือกได้ ยอดค้าง / ชำระแล้ว / ทั้งคู่** (เหลืออย่างน้อย 1 ชุด — เจ้าของงานสั่ง 23 ก.ย. 2569)
 *      เลือกทั้งคู่ = แท่งคู่ข้างกัน ไม่ซ้อนกัน เพราะยอดชำระแล้วใหญ่กว่ายอดค้างราว 10 เท่า ซ้อนแล้วแท่งค้างจมหาย
 *      ยอดค้างใช้สีตามอายุหนี้ (ตามรูปในสเปก) · ชำระแล้วใช้เขียวเดียวกับการ์ด "ชำระแล้ว"
 *      tooltip: จำนวนลูกค้า · ยอดค้าง (% ของยอดค้างทั้งหมด) · ยอดชำระ · กดแท่งเปิดป็อบอัพรายลูกค้าของช่วงนั้น
 *      มีสองแท็บ "ยังค้าง" / "ชำระแล้ว" — เปิดตรงแท็บของแท่งที่กด
 *      คอลัมน์ ลูกค้า · ระยะเวลาเครดิต (ค่าที่พบบ่อยสุด) · จำนวนบิล · ยอด · ค้างชำระเกินกำหนด (สูงสุด) · (เฉลี่ย)
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
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, gridProps } from "../../lib/chart/primitives";
import { D, DFONT, fmtShort, useChartTheme } from "../../lib/chart/theme";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { ShortId } from "../../lib/custmap/ShortId";
import { monthSpan, thDateSafe, thMonthRange, thSlash } from "../../lib/record/date";
import type { DebtorRow, DebtorState } from "../../lib/data/useDebtors";
import { Hero, Note, Pane, TableHead } from "../dash-fleet/parts";
import { SortTable, fmt, pct, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import TruckLoader from "../../lib/ui/TruckLoader";
import SourceTag from "../../lib/ui/SourceTag";
import { ageBills, dayNum } from "../../lib/debtors/aging";
import type { Aged } from "../../lib/debtors/aging";

/**
 * ช่วงวันที่เกินกำหนด 6 ช่วง (เจ้าของงานสั่ง 23 ก.ย. 2569 — แยก 1–7 วันออกจาก 1–30 เดิม)
 * สีไล่ เทา → เหลือง → ส้ม → ส้มเข้ม → แดง → แดงเข้ม ตามความรุนแรง
 * ช่องแรกของยอดค้าง = ยังไม่ถึงกำหนด · ของยอดชำระแล้ว = จ่ายตรงเวลา/ก่อนกำหนด (tooltip บอกแยกให้)
 */
const BUCKETS = [
  { label: "ยังไม่ถึงกำหนด", color: D.slate },
  { label: "1–7 วัน", color: "#FACC15" },
  { label: "8–30 วัน", color: D.amber },
  { label: "31–60 วัน", color: D.orange },
  { label: "61–90 วัน", color: D.rose },
  { label: "> 90 วัน", color: "#9F1239" },
] as const;
/** แท่งยอดชำระแล้ว — เขียวกลางของการ์ด "ชำระแล้ว" (hero.profit) ให้สองที่เป็นสีเดียวกัน */
const PAID_COLOR = "#0E9A86";
/** สีปุ่มของชุดยอดค้าง — แดงของการ์ด "ยังไม่ชำระ" (แท่งจริงไล่สีตามอายุหนี้) */
const UNPAID_COLOR = D.rose;

type Series = "unpaid" | "paid";
/** แท่งที่กด — ช่วงไหน และชุดไหน (ป็อบอัพเปิดตรงแท็บนั้น) */
interface Picked { i: number; tab: Series }

/**
 * ยอดเงินแบบย่อ — ป้ายบนแท่ง/แกน y (ล้านบาทเกินหลักล้าน)
 * เว้นวรรคแบบไม่ตัดบรรทัด (U+00A0) เพราะ LabelList ของ Recharts ตัดคำตามความกว้างแท่ง "5.07 ล้าน" จะแตกเป็นสองบรรทัด
 */
const shortBaht = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} ล้าน` : fmtShort(n);

const bucketOf = (over: number): number =>
  (over <= 0 ? 0 : over <= 7 ? 1 : over <= 30 ? 2 : over <= 60 ? 3 : over <= 90 ? 4 : 5);

// สถานะ/วันที่เกินกำหนดของแต่ละใบ อยู่ใน lib/debtors/aging.ts (ใช้ร่วมกับคะแนน DSO ของ Performance Index)

/** แถวของกราฟ — ยอดเป็นบาท ที่เหลือใช้ใน tooltip */
interface HistRow {
  label: string; ค้าง: number; ชำระ: number;
  unpaidN: number; paidN: number; custN: number; share: number;
}

/** ค่าเริ่มต้นของ "ข้อมูล ณ วันที่" (ISO) — เจ้าของงานสั่ง 24 ก.ย. 2569 · ผู้ใช้เปลี่ยนเองได้ที่ช่องวันที่ */
const DEFAULT_AS_OF = "2026-05-31";

/** onAsOf = แจ้ง "ข้อมูล ณ วันที่" ที่เลือกอยู่ออกไป — คะแนน DSO ของ Performance Index ใช้วันเดียวกับส่วนนี้ */
export default function OverdueSection({ state, onAsOf }: { state: DebtorState; onAsOf?: (iso: string) => void }) {
  const { data, error } = state;
  if (error || !data) {
    return (
      <div className="dz-cc">
        <h4>ลูกหนี้รายใดจ่ายช้ากระทบกระแสเงินสด (DSO)</h4>
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
  const range = data.manifest.dateRange;
  // ค่าเริ่มต้นตามที่เจ้าของงานสั่ง — ใช้ได้เฉพาะเมื่อไฟล์มีใบวางบิลก่อนวันนั้น ไม่งั้นทุกใบ "ยังไม่วางบิล" หน้าจะว่าง
  const fallback = data.manifest.refDate ?? data.manifest.asOf;
  const start = range.min && range.min <= DEFAULT_AS_OF ? DEFAULT_AS_OF : fallback;
  return <OverdueBody rows={data.rows} refDate={start}
    range={range} isSample={data.manifest.isSample} onAsOf={onAsOf} />;
}

/**
 * ข้อจำกัดเมื่อไฟล์ลูกหนี้ครอบไม่ถึง 12 เดือน — null ถ้าครบ (เจ้าของงานสั่ง 24 ก.ย. 2569: ไฟล์จริงมีเฉพาะปี 2569
 * ยังไม่ครบปี) · คิดจากช่วงวันที่วางบิลในไฟล์ทุกครั้ง ไม่เขียนปี/เดือนตายตัว ไฟล์รอบหน้าครบปีแล้วบรรทัดนี้หายเอง
 */
function coverageLimit(min: string, max: string): string | null {
  const span = monthSpan(min, max);
  if (span >= 12) return null;
  const y1 = min.slice(0, 4), y2 = max.slice(0, 4);
  const range = thMonthRange(min, max);
  const what = y1 === y2 ? `มีเฉพาะปี ${+y1 + 543} (${range.replace(` ${+y1 + 543}`, "")})` : `มีเฉพาะ ${range} (${span} เดือน)`;
  return `ข้อจำกัดด้านข้อมูล: ไฟล์ลูกหนี้${what} ยังไม่ครบทั้งปี — ยอดค้าง ยอดชำระ และ DSO ในส่วนนี้คิดจากช่วงนี้เท่านั้น`;
}

function OverdueBody({ rows, refDate, range, isSample, onAsOf }: {
  rows: DebtorRow[]; refDate: string; range: { min: string | null; max: string | null }; isSample: boolean;
  onAsOf?: (iso: string) => void;
}) {
  useDebtorCodes();
  const [asOf, setAsOf] = useState(refDate);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [show, setShow] = useState<Record<Series, boolean>>({ unpaid: true, paid: true });
  // ปิดได้ทีละชุด แต่ต้องเหลืออย่างน้อยหนึ่ง — กราฟว่างไม่มีประโยชน์ (กติกาเดียวกับปุ่มเส้นของแท็บ Damage)
  const toggleShow = (k: Series) => setShow((p) => {
    const next = { ...p, [k]: !p[k] };
    return next.unpaid || next.paid ? next : p;
  });
  // ETL รันใหม่แล้ววันที่อ้างอิงเปลี่ยน → ตามไปด้วย (ผู้ใช้ยังแก้เองต่อได้)
  useEffect(() => { setAsOf(refDate); }, [refDate]);
  useEffect(() => { onAsOf?.(asOf); }, [asOf, onAsOf]);

  /* ---------- สถานะของทุกใบ ณ วันที่เลือก ---------- */
  const aged = useMemo<Aged[]>(() => ageBills(rows, asOf), [rows, asOf]);

  const kpi = useMemo(() => {
    const sum = (xs: Aged[]) => xs.reduce((s, a) => s + a.r.amount, 0);
    const paid = aged.filter((a) => a.status === "paid");
    const notdue = aged.filter((a) => a.status === "notdue");
    const over = aged.filter((a) => a.status === "over");
    const allAmt = sum(aged), unpaidAmt = sum(notdue) + sum(over);
    // DSO มาตรฐาน — ช่วงที่นับเริ่มจากใบวางบิลใบแรกในไฟล์
    const start = range.min ?? aged.reduce((m, a) => (a.r.issue < m ? a.r.issue : m), asOf);
    const days = Math.max(1, dayNum(asOf) - dayNum(start) + 1);
    return {
      all: aged.length, allAmt,
      paid: paid.length, paidAmt: sum(paid),
      notdue: notdue.length, notdueAmt: sum(notdue),
      over: over.length, overAmt: sum(over),
      unpaid: notdue.length + over.length, unpaidAmt,
      dso: allAmt > 0 ? unpaidAmt / allAmt * days : null, days,
      term: aged.length ? mode(aged.map((a) => a.r.term)) : null,
    };
  }, [aged, asOf, range.min]);

  /* ---------- กราฟช่วงวันที่เกินกำหนด (ยอดเงิน) ---------- */
  const hist = useMemo<HistRow[]>(() => {
    const out = BUCKETS.map((b) => ({ label: b.label, ค้าง: 0, ชำระ: 0, unpaidN: 0, paidN: 0, custN: 0, share: 0 }));
    const cust = BUCKETS.map(() => new Set<string>());
    for (const a of aged) {
      const i = bucketOf(a.over), h = out[i]!;
      if (a.status === "paid") { h.ชำระ += a.r.amount; h.paidN++; }
      else { h.ค้าง += a.r.amount; h.unpaidN++; cust[i]!.add(a.r.cust); }
    }
    for (const [i, h] of out.entries()) {
      h.custN = cust[i]!.size;
      h.share = kpi.unpaidAmt ? h.ค้าง / kpi.unpaidAmt * 100 : 0;
      h.ค้าง = Math.round(h.ค้าง); h.ชำระ = Math.round(h.ชำระ);
    }
    return out;
  }, [aged, kpi.unpaidAmt]);

  /** ใบทั้งหมดของช่วงที่กด — ทั้งค้างและชำระแล้ว ป็อบอัพแยกแท็บเอง */
  const pickedRows = useMemo(
    () => (picked == null ? [] : aged.filter((a) => bucketOf(a.over) === picked.i)),
    [aged, picked]);

  const dsoGap = kpi.dso != null && kpi.term != null ? Math.round(kpi.dso - kpi.term) : null;
  const limit = range.min && range.max ? coverageLimit(range.min, range.max) : null;

  return (
    <Pane deps={[aged]}>
      <div className="cp-sec">
        <div>
          <h3>ลูกหนี้รายใดจ่ายช้ากระทบกระแสเงินสด (DSO)<SourceTag sample={isSample} what="ไฟล์ลูกหนี้" /></h3>
          <p>ใช้ข้อมูลทั้งที่รับชำระแล้วและยังไม่ได้รับชำระ · สถานะของทุกใบวางบิล ณ วันที่ที่เลือก ·
            ไฟล์มีใบวางบิล {thDateSafe(range.min)} – {thDateSafe(range.max)} ·
            ส่วนนี้ไม่ขึ้นกับตัวกรองด้านบน ใช้ "ข้อมูล ณ วันที่" ทางขวาแทน</p>
          {limit && <p className="dso-limit">{limit}</p>}
        </div>
        <label className="cp-date">
          <span>ข้อมูล ณ วันที่</span>
          <input type="date" value={asOf} min={range.min ?? undefined}
            onChange={(e) => { if (e.target.value) { setAsOf(e.target.value); setPicked(null); } }} />
        </label>
      </div>

      {/* 6 — การ์ดใหญ่ไล่สี 5 ใบ ตามลำดับในสเปก (ชุดสีเดียวกับการ์ดของส่วนที่ 1) */}
      <div className="dz-heroes dso-heroes">
        <Hero kind="cust" l="จำนวนบิลทั้งหมด" v={fmt(kpi.all)} s={`ใบวางบิล · ${fmt(Math.round(kpi.allAmt))} บาท`} />
        <Hero kind="profit" l="ชำระแล้ว" v={fmt(kpi.paid)}
          vSub={kpi.all ? `(${pct(kpi.paid / kpi.all * 100, 0)})` : undefined}
          s={`ใบ · ${fmt(Math.round(kpi.paidAmt))} บาท`} />
        <Hero kind="loss" l="ยังไม่ชำระ" v={fmt(kpi.unpaid)}
          vSub={kpi.all ? `(${pct(kpi.unpaid / kpi.all * 100, 0)})` : undefined}
          s={`${fmt(Math.round(kpi.unpaidAmt))} บาท · เกินกำหนด ${fmt(kpi.over)} ใบ`} />
        <Hero kind="fleet" l="ยังไม่ถึงกำหนดชำระ" v={fmt(kpi.notdue)} s={`ใบ · ${fmt(Math.round(kpi.notdueAmt))} บาท`} />
        <Hero kind="rev" l="DSO · วันเก็บหนี้เฉลี่ย" v={kpi.dso == null ? "–" : fmt(Math.round(kpi.dso))} unit="วัน"
          s={kpi.term == null ? "ไม่มีใบวางบิลในขอบเขต"
            : `เครดิตที่พบบ่อยสุด ${fmt(kpi.term)} วัน · ${dsoGap! > 0 ? `ช้ากว่าเครดิต ${fmt(dsoGap!)} วัน`
              : dsoGap! < 0 ? `เร็วกว่าเครดิต ${fmt(-dsoGap!)} วัน` : "เท่ากับเครดิต"}`} />
      </div>

      {/* 7 — กราฟ */}
      <div className="dz-cc" style={{ marginTop: 14 }}>
        <TableHead title={`ยอดเงินแยกตามช่วงวันที่เกินกำหนด · ณ ${thSlash(asOf)}`}>
          <div className="od-series" role="group" aria-label="เลือกชุดข้อมูลของกราฟ">
            {([
              ["unpaid", "ยอดค้างชำระ", UNPAID_COLOR, kpi.unpaidAmt],
              ["paid", "ชำระแล้ว", PAID_COLOR, kpi.paidAmt],
            ] as const).map(([k, label, color, amt]) => (
              <button key={k} type="button" className={"od-chip" + (show[k] ? " on" : "")}
                style={{ "--c": color } as React.CSSProperties} aria-pressed={show[k]}
                title={show[k] ? "กดเพื่อซ่อนชุดนี้" : "กดเพื่อแสดงชุดนี้"} onClick={() => toggleShow(k)}>
                <i aria-hidden="true">{show[k] ? "✓" : ""}</i>
                <span>{label}<b>{shortBaht(Math.round(amt))} บาท</b></span>
              </button>
            ))}
          </div>
        </TableHead>
        <div className="dz-box tall">
          <OverdueChart data={hist} show={show} picked={picked} onPick={setPicked} />
        </div>
        <Note>
          เลือกชุดข้อมูลที่ปุ่มหัวกราฟ (ยอดค้าง · ชำระแล้ว · หรือทั้งคู่) · ยอดชำระแล้วจัดช่วงตามจำนวนวันที่จ่ายช้ากว่ากำหนด
          (จ่ายตรงเวลาอยู่ช่อง "ยังไม่ถึงกำหนด") ·
          <b>กดแท่งเพื่อดูรายละเอียดรายลูกค้าของช่วงนั้น</b> (แยกแท็บ ยังค้าง / ชำระแล้ว) · DSO = ยอดค้าง ÷ ยอดวางบิล × {fmt(kpi.days)} วัน
          (ตั้งแต่ใบวางบิลใบแรกในไฟล์ถึงวันที่เลือก) ·
          <b> ข้อจำกัดของส่วนนี้:</b> ข้อมูลที่ใช้วิเคราะห์เป็นข้อมูลชุดใหม่ซึ่งมีระยะเวลาเพียง 7 เดือน และไม่สามารถจับคู่กับข้อมูลในอดีต
          ได้อย่างครบถ้วน จึงอาจส่งผลให้การวิเคราะห์มีข้อจำกัดด้านความแม่นยำและความครบถ้วนของผลลัพธ์
        </Note>
      </div>

      {picked != null && (
        <OverdueModal key={`${picked.i}-${picked.tab}`} bucket={BUCKETS[picked.i]?.label ?? ""} notDue={picked.i === 0}
          initTab={picked.tab} rows={pickedRows} asOf={asOf} onClose={() => setPicked(null)} />
      )}
    </Pane>
  );
}

/* ================================================================ กราฟแท่ง */
/**
 * เขียนเองแทน DBar เพราะต้องสลับชุดได้ แท่งคู่สีต่างกันต่อช่วง และ tooltip หลายบรรทัด
 * แกน/กริดเขียนตรง ๆ เป็นลูกของกราฟ — ห่อไม่ได้ (ดู primitives.ts)
 */
function OverdueChart({ data, show, picked, onPick }: {
  data: HistRow[]; show: Record<Series, boolean>; picked: Picked | null; onPick: (p: Picked) => void;
}) {
  const t = useChartTheme();
  const both = show.unpaid && show.paid;
  // ช่วงที่กดอยู่เข้ม ช่วงอื่นจางลง ให้เห็นว่ากำลังดูรายละเอียดของช่วงไหน
  const dim = (i: number): number => (picked == null || picked.i === i ? 1 : 0.3);
  const label = {
    position: "top" as const, offset: 8,
    formatter: (v: unknown) => (typeof v === "number" && v > 0 ? shortBaht(v) : ""),
    style: { fontFamily: DFONT, fontSize: 12.5, fontWeight: 700, fill: t.ink2 },
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 26, right: 12, left: 4, bottom: 0 }}
        barCategoryGap={both ? "24%" : "30%"} barGap={6}>
        <CartesianGrid {...gridProps(t)} vertical={false} />
        <XAxis {...axisProps(t)} dataKey="label" tickMargin={8} />
        <YAxis {...axisProps(t)} tickFormatter={shortBaht} width={74} axisLine={false} />
        <Tooltip cursor={{ fill: t.grid, fillOpacity: 0.7, radius: 10 } as object}
          content={<OverdueTip show={show} />} />
        {show.unpaid && (
          <Bar dataKey="ค้าง" name="ยอดค้างชำระ" radius={[8, 8, 0, 0]} maxBarSize={both ? 56 : 88}
            cursor="pointer" onClick={(_d: unknown, i: number) => onPick({ i, tab: "unpaid" })} {...anim}>
            {data.map((_, i) => <Cell key={i} fill={BUCKETS[i]!.color} fillOpacity={dim(i)} />)}
            <LabelList dataKey="ค้าง" {...label} />
          </Bar>
        )}
        {show.paid && (
          <Bar dataKey="ชำระ" name="ชำระแล้ว" radius={[8, 8, 0, 0]} maxBarSize={both ? 56 : 88}
            cursor="pointer" onClick={(_d: unknown, i: number) => onPick({ i, tab: "paid" })} {...anim}>
            {data.map((_, i) => <Cell key={i} fill={PAID_COLOR} fillOpacity={dim(i) * (both ? 0.9 : 1)} />)}
            <LabelList dataKey="ชำระ" {...label} />
          </Bar>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function OverdueTip({ active, payload, show }: {
  active?: boolean; payload?: { payload: HistRow }[]; show: Record<Series, boolean>;
}) {
  const h = active && payload?.[0]?.payload;
  if (!h) return null;
  const first = h.label === BUCKETS[0].label;
  const i = BUCKETS.findIndex((b) => b.label === h.label);
  const dot = (c: string) => (
    <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: c, marginRight: 7 }} />
  );
  return (
    <div style={{ background: "#17161A", color: "#fff", borderRadius: 12, padding: "11px 13px", fontFamily: DFONT,
                  fontSize: 13.5, lineHeight: 1.6, boxShadow: "0 10px 28px -10px rgba(0,0,0,.45)" }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{h.label}</div>
      {show.unpaid && (
        <>
          <div>{dot(BUCKETS[i]?.color ?? UNPAID_COLOR)}{first ? "ยังไม่ครบกำหนด" : "ยอดค้างชำระ"}{" "}
            <b>{fmt(h.ค้าง)}</b> บาท</div>
          <div style={{ opacity: 0.75, paddingLeft: 16 }}>
            {fmt(h.unpaidN)} ใบ · {fmt(h.custN)} ราย · {pct(h.share)} ของยอดค้างทั้งหมด</div>
        </>
      )}
      {show.paid && (
        <>
          <div>{dot(PAID_COLOR)}{first ? "ชำระตรงเวลา" : "ชำระแล้ว (จ่ายช้า)"} <b>{fmt(h.ชำระ)}</b> บาท</div>
          <div style={{ opacity: 0.75, paddingLeft: 16 }}>{fmt(h.paidN)} ใบ</div>
        </>
      )}
      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>กดแท่งเพื่อดูรายลูกค้า</div>
    </div>
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

function OverdueModal({ bucket, notDue, initTab, rows: all, asOf, onClose }: {
  bucket: string; notDue: boolean; initTab: Series; rows: Aged[]; asOf: string; onClose: () => void;
}) {
  const unpaidN = all.filter((a) => a.status !== "paid").length;
  // เปิดตรงแท็บของแท่งที่กด — ถ้าแท็บนั้นว่างค่อยสลับไปอีกแท็บ
  const [tab, setTab] = useState<Series>(
    initTab === "unpaid" ? (unpaidN ? "unpaid" : "paid") : (all.length - unpaidN ? "paid" : "unpaid"));
  const paid = tab === "paid";
  const rows = useMemo(() => all.filter((a) => (a.status === "paid") === paid), [all, paid]);
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

  const cols = useMemo<Col<CustAgg>[]>(() => [
    { key: "cust", label: "ลูกค้า", get: (c) => c.cust,
      // ป้าย "เกิน 90 วัน" ตามรูปในสเปก — ดูจากใบที่ค้างนานสุดของลูกค้ารายนั้น
      render: (c) => <>{<ShortId v={c.cust} n={c.n ?? undefined} />}{c.overMax > 90 && <> <span className="cp-tag loss">เกิน 90 วัน</span></>}</> },
    { key: "term", label: "ระยะเวลาเครดิต", get: (c) => c.term, num: true, render: (c) => `${c.term} วัน` },
    { key: "bills", label: "จำนวนบิล", get: (c) => c.bills, num: true },
    { key: "amount", label: paid ? "ยอดชำระ" : "ยอดค้าง", get: (c) => c.amount, num: true, render: (c) => fmt(Math.round(c.amount)) },
    // สูงสุด/เฉลี่ยแยกเป็นสองคอลัมน์ให้เรียงได้ทีละตัว (เจ้าของงานสั่ง 23 ก.ย. 2569 — เดิมเฉลี่ยอยู่ในวงเล็บ)
    // ช่องแรก over เป็นลบหรือศูนย์ — กลับเครื่องหมายให้อ่านเป็น "อีกกี่วันถึงกำหนด" / "จ่ายก่อนกี่วัน"
    //   ค่ามากสุดของ over จึงเป็นใบที่ใกล้กำหนดที่สุด ป้ายใช้ "ใกล้สุด/น้อยสุด" แทน "สูงสุด"
    { key: "over", label: notDue ? (paid ? "จ่ายก่อนกำหนด (น้อยสุด)" : "ถึงกำหนดในอีก (ใกล้สุด)") : "ค้างชำระเกินกำหนด (สูงสุด)",
      get: (c) => (notDue ? -c.overMax : c.overMax), num: true,
      render: (c) => notDue ? `${fmt(-c.overMax)} วัน`
        : <span style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(c.overMax)} วัน</span> },
    { key: "overAvg", label: notDue ? (paid ? "จ่ายก่อนกำหนด (เฉลี่ย)" : "ถึงกำหนดในอีก (เฉลี่ย)") : "ค้างชำระเกินกำหนด (เฉลี่ย)",
      get: (c) => (notDue ? -c.overAvg : c.overAvg), num: true,
      render: (c) => `${fmt(Math.round(notDue ? -c.overAvg : c.overAvg))} วัน` },
  ], [notDue, paid]);
  const { sorted, sort, toggle } = useSort(byCust, cols, { key: "amount", dir: -1 });

  const host = document.getElementById("view-dash") ?? document.body;
  const title = notDue ? bucket : `เกินกำหนด ${bucket}`;
  const total = Math.round(rows.reduce((s, a) => s + a.r.amount, 0));
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`ลูกหนี้ ${title}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{title} <span>· ณ {thSlash(asOf)}</span></div>
            <p>{fmt(byCust.length)} ราย · {fmt(rows.length)} ใบวางบิล · {paid ? "ยอดชำระ" : "ยอดค้าง"} {fmt(total)} บาท ·
              สูงสุด/เฉลี่ย = ของทุกบิลของลูกค้ารายนั้นในช่วงนี้ · ระยะเวลาเครดิต = ค่าที่พบบ่อยสุด</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="cp-seg" role="group" aria-label="สถานะ" style={{ margin: "0 0 10px" }}>
          <button type="button" className={!paid ? "on" : ""} onClick={() => setTab("unpaid")}>
            ยังค้าง ({fmt(unpaidN)} ใบ)</button>
          <button type="button" className={paid ? "on" : ""} onClick={() => setTab("paid")}>
            {notDue ? "ชำระตรงเวลา" : "ชำระแล้ว (จ่ายช้า)"} ({fmt(all.length - unpaidN)} ใบ)</button>
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
