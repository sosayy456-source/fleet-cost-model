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
 * ★ หน้าตาเปลี่ยนตาม "DSO Dashboard.html" ที่เจ้าของงานส่ง 27 ก.ย. 2569 (แทนข้อ 6–7 ข้างบน — การ์ดไล่สี/กราฟแท่งเลิกใช้):
 *   การ์ด 5 ใบ (ลูกหนี้ทั้งหมด · ชำระตามกำหนด = จ่ายตรงเวลา · เกินกำหนดชำระ = จ่ายช้าทั้งสองแบบ · ยังไม่ถึงกำหนด · DSO เทียบ ณ วันเดียวกันของเดือนก่อน) →
 *   ① วงกลม 4 สถานะ (จ่ายตรงเวลา · จ่ายช้าแต่จ่ายแล้ว · จ่ายช้าแต่ยังไม่ได้จ่าย · ยังไม่ถึงกำหนด — ตามจำนวนบิล) + ตาราง + กล่องสรุปบิลจ่ายช้า →
 *   ② โดนัทบิลจ่ายช้าสองวง แยกช่วงวันที่เกินกำหนดตามยอดเงิน (กดส่วนของวง/แถว = ป็อบอัพรายลูกค้าเดิม) →
 *   ③ ลูกหนี้ที่จ่ายช้าทุกราย เรียงยอดมากไปน้อย กล่องเลื่อนเห็นครั้งละ 10 ราย · % ต่อรายได้ = ยอดจ่ายช้า ÷ ยอดวางบิลทั้งหมดของรายนั้น
 *     (ไฟล์ต้นแบบใช้รายชื่อสมมติ "ใช้ยอด ณ เดือน 7" — ไฟล์ลูกหนี้ไม่มีรายได้แยก จึงใช้ยอดวางบิลแทน)
 *   **หน้าตาใช้ชุดดีไซน์ของโมเดล** (เจ้าของงานสั่งหลังรุ่นแรกที่ลอกสีของไฟล์ต้นแบบ): Hero ไล่สี · dz-cc + h4 · สีพาเล็ต D · SourceTag
 * ★ สถานะคำนวณในแอปจากวันที่ที่เลือก (นิยามเดียวกับหมายเหตุท้ายชีตสรุปวิเคราะห์ ตรวจแล้วได้ตัวเลขเท่าชีต
 *   ณ 01/03/2569: 2,847 / 2,404 / 76 / 367):
 *     อยู่ในขอบเขต   = วางบิลไม่เกินวันที่เลือก           ชำระแล้ว = วันที่จบ ≤ วันที่เลือก
 *     ค้างชำระ       = ยังไม่จบ และครบกำหนดก่อนวันที่เลือก  ยังไม่ถึงกำหนด = ยังไม่จบ และครบกำหนดตั้งแต่วันที่เลือกขึ้นไป
 *   เทียบวันที่เป็นสตริง ISO ได้ตรง ๆ เพราะ ETL เขียนเป็น YYYY-MM-DD ทุกช่อง
 * ★ ข้อจำกัดที่ต้องเขียนกำกับ (สเปกสั่ง): ข้อมูลชุดใหม่มีแค่ 7 เดือน และจับคู่กับข้อมูลในอดีตไม่ได้ครบ
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { numberForDebtor, useDebtorCodes } from "../../lib/custmap/debtorCodes";
import { ShortId } from "../../lib/custmap/ShortId";
import { custCode } from "../../lib/custmap/custmap";
import { monthSpan, thDateSafe, thMonthRange, thSlash } from "../../lib/record/date";
import type { DebtorManifest, DebtorRow, DebtorState } from "../../lib/data/useDebtors";
import { Hero, Note, Pane } from "../dash-fleet/parts";
import { SortTable, fmt, pct, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import TruckLoader from "../../lib/ui/TruckLoader";
import GrowBox from "../../lib/ui/GrowBox";
import SourceTag from "../../lib/ui/SourceTag";
import { D } from "../../lib/chart/theme";
import { ageBills, dayNum } from "../../lib/debtors/aging";
import type { Aged } from "../../lib/debtors/aging";

/**
 * ช่วงวันที่เกินกำหนด 6 ช่วง (เจ้าของงานสั่ง 23 ก.ย. 2569 — แยก 1–7 วันออกจาก 1–30 เดิม) · ช่องแรก = ยังไม่ถึงกำหนด/จ่ายตรงเวลา
 * ป็อบอัพรายลูกค้าใช้ชื่อช่วงชุดนี้
 */
const BUCKETS = ["ยังไม่ถึงกำหนด", "1–7 วัน", "8–30 วัน", "31–60 วัน", "61–90 วัน", "> 90 วัน"] as const;
/** ช่วงของบิลจ่ายช้า (โดนัท) = BUCKETS ตัดช่องแรก */
const LATE_RANGES = BUCKETS.slice(1);

type Series = "unpaid" | "paid";
/** ช่วงที่กด — ช่วงไหน และชุดไหน (ป็อบอัพเปิดตรงแท็บนั้น) */
interface Picked { i: number; tab: Series }

const bucketOf = (over: number): number =>
  (over <= 0 ? 0 : over <= 7 ? 1 : over <= 30 ? 2 : over <= 60 ? 3 : over <= 90 ? 4 : 5);

/**
 * 4 สถานะของวงกลม (DSO Dashboard.html ที่เจ้าของงานส่ง 27 ก.ย. 2569) — สีตามไฟล์ต้นแบบ
 *   0 จ่ายตรงเวลา = ชำระแล้ว วันที่จบ ≤ วันครบกำหนด · 1 จ่ายช้าแต่จ่ายแล้ว = ชำระแล้ว เกินกำหนด
 *   2 จ่ายช้าแต่ยังไม่ได้จ่าย = ค้าง เกินกำหนด (การ์ด "เกินกำหนดชำระ") · 3 ยังไม่ถึงกำหนด
 */
const STATUS = [
  { label: "ชำระตามกำหนด", color: D.emeraldLight },
  { label: "เกินกำหนดชำระแต่ชำระแล้ว", color: "#F87171" },
  { label: "เกินกำหนดชำระและยังไม่ได้ชำระ", color: "#B91C1C" },
  { label: "ยังไม่ถึงกำหนด", color: D.slate },
] as const;
const statusOf = (a: Aged): number => (a.status === "paid" ? (a.over > 0 ? 1 : 0) : a.status === "over" ? 2 : 3);
/**
 * โดนัทสองวง — ไล่เข้ม → อ่อนตามช่วงวัน ในโทนเดียวกับสถานะของวงนั้น
 * (เจ้าของงานสั่ง 27 ก.ย. 2569: จ่ายช้าแต่จ่ายแล้ว = แดงอ่อน · จ่ายช้าแต่ยังไม่ได้จ่าย = แดงเข้ม)
 */
const LATE_PAID_COLORS = ["#EF4444", "#F87171", "#FCA5A5", "#FECACA", "#FEE2E2"] as const;
const LATE_UNPAID_COLORS = ["#7F1D1D", "#B91C1C", "#DC2626", "#F87171", "#FECACA"] as const;
/** อันดับลูกหนี้จ่ายช้า — แสดงทุกรายในกล่องเลื่อน เห็นครั้งละ VISIBLE_ROWS แถว (เจ้าของงานสั่ง 27 ก.ย. 2569) · ความสูงแถวตรงกับ .dso2-rank */
const VISIBLE_ROWS = 10;
const RANK_ROW_PX = 50;

const sumAmt = (xs: Aged[]): number => xs.reduce((s, a) => s + a.r.amount, 0);
/** DSO มาตรฐาน = ยอดค้าง ÷ ยอดวางบิล × จำนวนวัน (ใบวางบิลใบแรกในไฟล์ → วันที่เลือก) */
function dsoOf(aged: Aged[], asOf: string, start: string): number | null {
  const all = sumAmt(aged);
  if (!all) return null;
  const unpaid = sumAmt(aged.filter((a) => a.status !== "paid"));
  return unpaid / all * Math.max(1, dayNum(asOf) - dayNum(start) + 1);
}
/** วันเดียวกันของเดือนก่อน (ISO) — วันที่ไม่มีในเดือนนั้นถอยเป็นวันสุดท้ายของเดือน */
function prevMonthISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** ค่าเริ่มต้นของ "ข้อมูล ณ วันที่" (ISO) — เจ้าของงานสั่ง 24 ก.ย. 2569 · ผู้ใช้เปลี่ยนเองได้ที่ช่องวันที่ */
const DEFAULT_AS_OF = "2026-05-31";

/**
 * ค่าเริ่มต้นของ "ข้อมูล ณ วันที่" — ใช้ได้เฉพาะเมื่อไฟล์มีใบวางบิลก่อนวันนั้น ไม่งั้นทุกใบ "ยังไม่วางบิล" หน้าจะว่าง
 * min = วันวางบิลแรกของชุดที่แสดง · Executive Summary ใช้ตัวเดียวกันคิดคะแนน DSO
 */
export function defaultAsOf(min: string | null, m: Pick<DebtorManifest, "refDate" | "asOf">): string {
  return min && min <= DEFAULT_AS_OF ? DEFAULT_AS_OF : m.refDate ?? m.asOf;
}

/** onAsOf = แจ้ง "ข้อมูล ณ วันที่" ที่เลือกอยู่ออกไป — คะแนน DSO ของ Performance Index ใช้วันเดียวกับส่วนนี้ */
export default function OverdueSection({ state, branch, onAsOf }: { state: DebtorState; branch: string; onAsOf?: (iso: string) => void }) {
  const { data, error } = state;
  const rows = useMemo(() => data ? (branch ? data.rows.filter((r) => r.br === branch) : data.rows) : [], [data, branch]);
  const range = useMemo(() => {
    if (!data) return { min: null, max: null };
    if (!branch) return data.manifest.dateRange;
    let min: string | null = null, max: string | null = null;
    for (const r of rows) {
      if (!min || r.issue < min) min = r.issue;
      if (!max || r.issue > max) max = r.issue;
    }
    return { min, max };
  }, [data, branch, rows]);
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
  const start = defaultAsOf(range.min, data.manifest);
  return <OverdueBody rows={rows} refDate={start}
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
  /** สถานะที่กดในส่วนภาพรวม (ไฮไลต์ชิ้นในโดนัท) — กดซ้ำ = ยกเลิก */
  const [stSel, setStSel] = useState<number | null>(null);
  const pickSt = (i: number) => setStSel((p) => (p === i ? null : i));
  /** ช่วงวันที่กดในโดนัทจ่ายช้าแต่ละวง (ไฮไลต์แบบเดียวกับภาพรวม) — กดซ้ำ = ยกเลิก */
  const [rgSel, setRgSel] = useState<Record<Series, number | null>>({ paid: null, unpaid: null });
  const pickRg = (k: Series, i: number) => setRgSel((p) => ({ ...p, [k]: p[k] === i ? null : i }));
  // ETL รันใหม่แล้ววันที่อ้างอิงเปลี่ยน → ตามไปด้วย (ผู้ใช้ยังแก้เองต่อได้)
  useEffect(() => { setAsOf(refDate); }, [refDate]);
  useEffect(() => { onAsOf?.(asOf); }, [asOf, onAsOf]);

  /* ---------- สถานะของทุกใบ ณ วันที่เลือก ---------- */
  const aged = useMemo<Aged[]>(() => ageBills(rows, asOf), [rows, asOf]);
  const start = range.min ?? asOf;

  const kpi = useMemo(() => {
    const paid = aged.filter((a) => a.status === "paid");
    const notdue = aged.filter((a) => a.status === "notdue");
    const over = aged.filter((a) => a.status === "over");
    // DSO เทียบเดือนก่อนหน้า = DSO ณ วันเดียวกันของเดือนก่อน (ถ้ายังอยู่ในช่วงไฟล์)
    const prev = prevMonthISO(asOf);
    const prevDso = range.min && prev >= range.min ? dsoOf(ageBills(rows, prev), prev, start) : null;
    return {
      all: aged.length, allAmt: sumAmt(aged),
      paid: paid.length, paidAmt: sumAmt(paid),
      notdue: notdue.length, notdueAmt: sumAmt(notdue),
      over: over.length, overAmt: sumAmt(over),
      dso: dsoOf(aged, asOf, start), prevDso,
      days: Math.max(1, dayNum(asOf) - dayNum(start) + 1),
    };
  }, [aged, asOf, start, range.min, rows]);

  /* ---------- 4 สถานะ (วงกลม) ---------- */
  const cats = useMemo(() => {
    const out = STATUS.map((s) => ({ ...s, bills: 0, amt: 0 }));
    for (const a of aged) {
      const c = out[statusOf(a)]!;
      c.bills++; c.amt += a.r.amount;
    }
    return out;
  }, [aged]);

  /* ---------- บิลจ่ายช้าแยกช่วงวัน (โดนัท 2 วง) ---------- */
  const donuts = useMemo(() => ([
    { key: "paid" as const, title: "เกินกำหนดชำระแต่ชำระแล้ว", colors: LATE_PAID_COLORS,
      list: aged.filter((a) => statusOf(a) === 1) },
    { key: "unpaid" as const, title: "เกินกำหนดชำระและยังไม่ได้ชำระ", colors: LATE_UNPAID_COLORS,
      list: aged.filter((a) => statusOf(a) === 2) },
  ]).map((d) => {
    const amt = LATE_RANGES.map(() => 0), n = LATE_RANGES.map(() => 0);
    for (const a of d.list) { const i = bucketOf(a.over) - 1; amt[i]! += a.r.amount; n[i]!++; }
    return { ...d, bills: d.list.length, total: sumAmt(d.list), amt, n };
  }), [aged]);

  /* ---------- ลูกหนี้ที่จ่ายช้า (จ่ายช้าแล้วจ่าย + ยังไม่จ่าย) ---------- */
  /**
   * % ต่อรายได้ = ยอดจ่ายช้าของลูกหนี้รายนั้น ÷ **รายได้รวมทั้งบริษัท** ตั้งแต่ 1 ม.ค. ของปีที่เลือกถึงวันที่เลือก
   * (เจ้าของงานแก้หลัก 27 ก.ย. 2569 — รุ่นแรกหารด้วยยอดวางบิลของลูกหนี้รายนั้นเอง ซึ่งผิด)
   * รายได้รวม = Σ "จำนวนเงิน" ของทุกใบวางบิลในไฟล์ลูกหนี้ที่วางบิลในช่วงนั้น (ตามสาขาที่กรอง)
   */
  const revFrom = `${asOf.slice(0, 4)}-01-01`;
  const revTotal = useMemo(() => sumAmt(aged.filter((a) => a.r.issue >= revFrom)), [aged, revFrom]);
  const topCust = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of aged) if (a.over > 0) m.set(a.r.cust, (m.get(a.r.cust) ?? 0) + a.r.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([cust, late], i) => {
        const n = numberForDebtor(cust);
        return { cust, n, late, rank: i + 1, code: n ? custCode(n) : "", share: revTotal ? late / revTotal * 100 : 0 };
      });
  }, [aged, revTotal]);
  // ค้นหาลูกค้าในตารางลูกหนี้จ่ายช้า — ตรงกับรหัส CUS หรือรหัสต้นฉบับ (บางส่วนก็ได้) · ลำดับยังเป็นอันดับในรายชื่อทั้งหมด
  const [custQ, setCustQ] = useState("");
  const custRows = useMemo(() => {
    const k = custQ.trim().toLowerCase();
    return k ? topCust.filter((c) => c.code.toLowerCase().includes(k) || c.cust.toLowerCase().includes(k)) : topCust;
  }, [topCust, custQ]);

  /** ใบทั้งหมดของช่วงที่กด — ทั้งค้างและชำระแล้ว ป็อบอัพแยกแท็บเอง */
  const pickedRows = useMemo(
    () => (picked == null ? [] : aged.filter((a) => bucketOf(a.over) === picked.i)),
    [aged, picked]);

  const limit = range.min && range.max ? coverageLimit(range.min, range.max) : null;
  const pctOf = (n: number, d: number): string => (d ? pct(n / d * 100) : "–");
  const onTime = cats[0]!, late = cats[1]!, lateUnpaid = cats[2]!;
  const dsoDiff = kpi.dso != null && kpi.prevDso != null ? Math.round(kpi.dso) - Math.round(kpi.prevDso) : null;

  return (
    <Pane deps={[aged]}>
      <div className="cp-sec">
        <div>
          <h3>สถานะการชำระเงินของลูกหนี้ และลูกหนี้ที่จ่ายช้าจนกระทบกระแสเงินสด<SourceTag sample={isSample} what="ไฟล์ลูกหนี้" /></h3>
          <p>แยกประเภทบิลจ่ายช้า: เกินกำหนดชำระแต่ชำระแล้ว / เกินกำหนดชำระและยังไม่ได้ชำระ · ไฟล์มีใบวางบิล {thDateSafe(range.min)} – {thDateSafe(range.max)} ·
            ส่วนนี้ไม่ขึ้นกับตัวกรองด้านบน ใช้ "ข้อมูล ณ วันที่" ทางขวาแทน</p>
          {limit && <p className="dso-limit">{limit}</p>}
        </div>
        <label className="cp-date">
          <span>ข้อมูล ณ วันที่</span>
          <input type="date" value={asOf} min={range.min ?? undefined}
            onChange={(e) => { if (e.target.value) { setAsOf(e.target.value); setPicked(null); } }} />
        </label>
      </div>

      <div className="dz-heroes dso-heroes">
        <Hero kind="cust" l={`บิลที่วางถึง ${thDateSafe(asOf)}`} v={fmt(kpi.all)} unit="บิล" s={`มูลค่า ${fmt(Math.round(kpi.allAmt))} บาท`} />
        {/* การ์ดสองใบนี้ตรงกับโดนัทภาพรวม (เจ้าของงานสั่ง 27 ก.ย. 2569): ชำระตามกำหนด = จ่ายตรงเวลา ·
            เกินกำหนดชำระ = เกินกำหนดชำระแต่ชำระแล้ว + เกินกำหนดชำระและยังไม่ได้ชำระ */}
        <Hero kind="profit" l="ชำระตามกำหนด" v={fmt(onTime.bills)} vSub={`(${pctOf(onTime.bills, kpi.all)})`}
          s={`${fmt(Math.round(onTime.amt))} บาท (${pctOf(onTime.amt, kpi.allAmt)})`} />
        <Hero kind="loss" l="เกินกำหนดชำระ" v={fmt(late.bills + lateUnpaid.bills)} vSub={`(${pctOf(late.bills + lateUnpaid.bills, kpi.all)})`}
          s={`${fmt(Math.round(late.amt + lateUnpaid.amt))} บาท (${pctOf(late.amt + lateUnpaid.amt, kpi.allAmt)})`} />
        <Hero kind="fleet" l="ยังไม่ถึงกำหนดชำระ" v={fmt(kpi.notdue)} vSub={`(${pctOf(kpi.notdue, kpi.all)})`}
          s={`${fmt(Math.round(kpi.notdueAmt))} บาท (${pctOf(kpi.notdueAmt, kpi.allAmt)})`} />
        <Hero kind="rev" l="DSO · วันเก็บหนี้เฉลี่ย" v={kpi.dso == null ? "–" : fmt(Math.round(kpi.dso))} unit="วัน"
          s={dsoDiff == null ? "ไม่มีข้อมูลเดือนก่อนหน้า"
            : `${dsoDiff === 0 ? "เท่าเดิม" : `${dsoDiff < 0 ? "↓" : "↑"} ${fmt(Math.abs(dsoDiff))} วัน`} เทียบ ณ ${thSlash(prevMonthISO(asOf))}`} />
      </div>

      {/* ① ภาพรวมสถานะการชำระเงิน — โดนัทกลาง + การ์ดสถานะซ้าย/ขวา + แถบสรุปบิลจ่ายช้า (ภาพที่เจ้าของงานส่ง 27 ก.ย. 2569) */}
      <div className="dz-cc dso2-block">
        <h4>ภาพรวมสถานะการชำระเงิน</h4>
        <div className="dso2-ov">
          <div className="dso2-ov-side">{[0, 1].map((i) => <StatusCard key={i} c={cats[i]!} total={kpi.all}
            on={stSel === i} dim={stSel != null && stSel !== i} onClick={() => pickSt(i)} />)}</div>
          <StatusDonut cats={cats} total={kpi.all} totalAmt={kpi.allAmt} sel={stSel} onPick={pickSt} />
          <div className="dso2-ov-side">{[2, 3].map((i) => <StatusCard key={i} c={cats[i]!} total={kpi.all}
            on={stSel === i} dim={stSel != null && stSel !== i} onClick={() => pickSt(i)} />)}</div>
        </div>
        <div className="dso2-ov-late" title="เกินกำหนดชำระแต่ชำระแล้ว + เกินกำหนดชำระและยังไม่ได้ชำระ">
          <span>บิลจ่ายช้าทั้งหมด</span>
          <b>{fmt(late.bills + lateUnpaid.bills)} บิล ({pctOf(late.bills + lateUnpaid.bills, kpi.all)})</b>
          <b>{fmt(Math.round(late.amt + lateUnpaid.amt))} บาท</b>
        </div>
      </div>

      <div className="dso2-two">
        {/* ② รายละเอียดบิลที่จ่ายช้า */}
        <div className="dz-cc dso2-block">
          <h4>รายละเอียดบิลที่จ่ายช้า</h4>
          <div className="dso2-donuts">{donuts.map((d) => (
            <div key={d.key} className="dso2-donut">
              <div className="dso2-donut-h"><b>{d.title}</b><span>{fmt(d.bills)} บิล · {fmt(Math.round(d.total))} บาท</span></div>
              <Donut amt={d.amt} n={d.n} colors={d.colors} total={d.total}
                sel={rgSel[d.key]} onPick={(i) => pickRg(d.key, i)} />
              <div className="dso2-leg">{LATE_RANGES.map((r, i) => {
                const on = rgSel[d.key] === i;
                return <div key={r} className={"dso2-leg-row" + (on ? " on" : "") + (rgSel[d.key] != null && !on ? " dim" : "")}
                  style={{ "--c": d.colors[i] } as React.CSSProperties}>
                  <button type="button" disabled={!d.amt[i]} aria-pressed={on} onClick={() => pickRg(d.key, i)}
                    title={d.amt[i] ? "กดเพื่อไฮไลต์ช่วงนี้ในวง" : undefined}>
                    <span><i style={{ background: d.colors[i] }} />{r}{d.n[i] ? <small>{fmt(d.n[i]!)} บิล</small> : null}</span>
                    <b>{fmt(Math.round(d.amt[i]!))}</b>
                    <em>{d.amt[i] ? pct(d.amt[i]! / d.total * 100) : "–"}</em>
                  </button>
                  {on && <button type="button" className="dso2-leg-go" onClick={() => setPicked({ i: i + 1, tab: d.key })}>
                    ดูรายลูกค้าของช่วงนี้ ›</button>}
                </div>;
              })}</div>
            </div>
          ))}</div>
          <Note>สัดส่วนตามยอดเงิน (บาท) · ช่วงวันที่เกินกำหนด — จ่ายแล้วนับวันที่จบ − วันครบกำหนด · ยังไม่จ่ายนับถึงวันที่เลือก ·
            <b> กดส่วนของวงหรือแถวเพื่อไฮไลต์ช่วงนั้น แล้วกด "ดูรายลูกค้าของช่วงนี้"</b></Note>
        </div>

        {/* ③ ลูกหนี้ที่จ่ายช้าจนกระทบกระแสเงินสด */}
        <div className="dz-cc dso2-block">
          <div className="dso2-rank-h">
            <h4>ลูกหนี้ที่จ่ายช้าจนกระทบกระแสเงินสด</h4>
            <input type="search" className="d3-tt-search" placeholder="ค้นหาลูกค้า (รหัส CUS / รหัสต้นฉบับ)" value={custQ}
              onChange={(e) => setCustQ(e.target.value)} aria-label="ค้นหาลูกค้า" />
          </div>
          <div className="dso2-revline">รายได้รวม {thSlash(revFrom)} – {thSlash(asOf)} <b>{fmt(Math.round(revTotal))}</b> บาท
            <span>· ฐานของ % ต่อรายได้ทุกแถว</span></div>
          <div className="dso2-rank th"><span>ลำดับ</span><span>ลูกหนี้</span><span>ยอดเงินจ่ายช้า (บาท)</span><span>% ต่อรายได้</span></div>
          {custRows.length ? <GrowBox rows={custRows} maxHeight={VISIBLE_ROWS * RANK_ROW_PX} render={(shown) => shown.map((c) => (
            <div key={c.cust} className="dso2-rank">
              <span className="dso2-rk">{c.rank}</span>
              <span className="dso2-nm"><ShortId v={c.cust} n={c.n ?? undefined} /></span>
              <span className="dso2-bar"><span className="dso2-rail"><i style={{ width: `${c.late / topCust[0]!.late * 100}%` }} /></span>
                <b>{fmt(Math.round(c.late))}</b></span>
              <span className="fu-pill low">{pct(c.share, 2)}</span>
            </div>
          ))} /> : <p className="dz-note">{topCust.length ? `ไม่พบลูกค้าที่ตรงกับ "${custQ.trim()}"` : "ไม่มีลูกหนี้ที่จ่ายช้า ณ วันที่เลือก"}</p>}
          <Note>ยอดจ่ายช้า = เกินกำหนดชำระแต่ชำระแล้ว + เกินกำหนดชำระและยังไม่ได้ชำระ · ทั้งหมด {fmt(topCust.length)} ราย เรียงยอดมากไปน้อย (เลื่อนในกล่องเพื่อดูต่อ) ·
            % ต่อรายได้ = ยอดจ่ายช้าของลูกหนี้รายนั้น ÷ รายได้รวมทั้งหมดตั้งแต่ 1 ม.ค. ถึงวันที่เลือก (ยอดวางบิลทุกใบในไฟล์ลูกหนี้) · DSO = ยอดค้าง ÷ ยอดวางบิล × {fmt(kpi.days)} วัน
            (ตั้งแต่ใบวางบิลใบแรกในไฟล์ถึงวันที่เลือก) ·
            <b> ข้อจำกัดของส่วนนี้:</b> ข้อมูลที่ใช้วิเคราะห์เป็นข้อมูลชุดใหม่ซึ่งมีระยะเวลาเพียง 7 เดือน และไม่สามารถจับคู่กับข้อมูลในอดีต
            ได้อย่างครบถ้วน จึงอาจส่งผลให้การวิเคราะห์มีข้อจำกัดด้านความแม่นยำและความครบถ้วนของผลลัพธ์</Note>
        </div>
      </div>

      {picked != null && (
        <OverdueModal key={`${picked.i}-${picked.tab}`} bucket={BUCKETS[picked.i] ?? ""} notDue={picked.i === 0}
          initTab={picked.tab} rows={pickedRows} asOf={asOf} onClose={() => setPicked(null)} />
      )}
    </Pane>
  );
}

/* ================================================================ วงกลม/โดนัท (SVG ล้วน) */
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
/** ชิ้นวงกลม (ir = 0) หรือวงแหวน — มุมเริ่มที่ 12 นาฬิกา ตามเข็ม */
function arcPath(cx: number, cy: number, r: number, ir: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  if (!ir) return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
  const [x2, y2] = polar(cx, cy, ir, a1), [x3, y3] = polar(cx, cy, ir, a0);
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ir},${ir} 0 ${large} 0 ${x3},${y3} Z`;
}

/** คำอธิบายของแต่ละสถานะ — ขึ้นเป็น tooltip ของการ์ด */
const STATUS_HINT = [
  "ชำระภายในวันครบกำหนด",
  "ชำระแล้ว แต่เลยวันครบกำหนด",
  "ยังไม่ชำระ และเลยวันครบกำหนดแล้ว ณ วันที่เลือก",
  "ยังไม่ชำระ และยังไม่ถึงวันครบกำหนด",
];

type Cat = { label: string; color: string; bills: number; amt: number };

function StatusCard({ c, total, on, dim, onClick }: { c: Cat; total: number; on: boolean; dim: boolean; onClick: () => void }) {
  const i = STATUS.findIndex((x) => x.label === c.label);
  return (
    <div className={"dso2-st" + (on ? " on" : "") + (dim ? " dim" : "")} title={STATUS_HINT[i]}
      style={{ "--c": c.color } as React.CSSProperties} role="button" tabIndex={0} aria-pressed={on} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
      <div className="dso2-st-h"><i style={{ background: c.color }} />{c.label}</div>
      <div className="dso2-st-v"><b key={c.bills} className="num-fd" style={{ color: c.color }}>{total ? pct(c.bills / total * 100) : "–"}</b>
        <span>{fmt(c.bills)} บิล</span></div>
      <div className="dso2-st-a"><b>{fmt(Math.round(c.amt))}</b> บาท</div>
    </div>
  );
}

/**
 * โดนัทสถานะตามจำนวนบิล — กดการ์ดหรือชิ้น = ไฮไลต์ชิ้นนั้น (ชิ้นอื่นจาง · ชิ้นที่เลือกยื่นออก) และกลางวงเปลี่ยนเป็นตัวเลขของสถานะนั้น
 * (เจ้าของงานสั่ง 27 ก.ย. 2569 — แทนเส้นเข้มคร่อมชิ้นจ่ายช้าที่เอาออก)
 */
function StatusDonut({ cats, total, totalAmt, sel, onPick }: {
  cats: Cat[]; total: number; totalAmt: number; sel: number | null; onPick: (i: number) => void;
}) {
  const C = 160, R = 132, IR = 84;
  let a = 0;
  const ang = cats.map((c) => { const a0 = a; a += total ? c.bills / total * Math.PI * 2 : 0; return [a0, a] as const; });
  const cur = sel == null ? null : cats[sel]!;
  return (
    <div className="dso2-ov-donut">
      <svg viewBox="0 0 320 320" role="img" aria-label={cats.map((c) => `${c.label} ${fmt(c.bills)} บิล`).join(" · ")}>
        {total ? cats.map((c, i) => {
          if (!c.bills) return null;
          const on = sel === i, [a0, a1] = ang[i]!;
          return <path key={c.label} d={arcPath(C, C, on ? R + 10 : R, on ? IR - 4 : IR, a0, a1)} fill={c.color}
            stroke="var(--d-card)" strokeWidth={3} className="dso2-ov-seg"
            style={{ opacity: sel == null || on ? 1 : 0.25 }} onClick={() => onPick(i)}>
            <title>{`${c.label}: ${fmt(c.bills)} บิล (${pct(c.bills / total * 100)})`}</title></path>;
        }) : <circle cx={C} cy={C} r={(R + IR) / 2} fill="none" stroke="var(--d-rail)" strokeWidth={R - IR} />}
      </svg>
      <div className="dso2-ov-m">{cur ? <>
        <span style={{ color: cur.color, fontWeight: 700 }}>{cur.label}</span>
        <b key={cur.label} className="num-fd">{fmt(cur.bills)}</b>
        <em>บิล · {(cur.amt / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้านบาท</em>
      </> : <>
        <span>บิลทั้งหมด</span>
        <b key={total} className="num-fd">{fmt(total)}</b>
        <em>{(totalAmt / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้านบาท</em>
      </>}</div>
    </div>
  );
}

/** สีพื้นสว่างพอต้องใช้ตัวหนังสือเข้ม — ความสว่างแบบ perceived luminance ของ #RRGGBB */
const isLight = (hex: string): boolean => {
  const v = parseInt(hex.slice(1), 16);
  return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) > 170;
};

/** ชิ้นที่กว้างพอใส่ป้าย % + (จำนวนบิล) บนวงแหวน — แคบกว่านี้ดูในรายการใต้วง */
const DONUT_LABEL_MIN = 0.08;

function Donut({ amt, n, colors, total, sel, onPick }: {
  amt: number[]; n: number[]; colors: readonly string[]; total: number; sel: number | null; onPick: (i: number) => void;
}) {
  let a = 0;
  const m = (v: number) => (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="dso2-donut-c">
      <svg viewBox="0 0 220 220" role="img" aria-label={amt.map((v, i) => `${LATE_RANGES[i]} ${fmt(Math.round(v))} บาท`).join(" · ")}>
        {total ? amt.map((v, i) => {
          const a0 = a, a1 = a + v / total * Math.PI * 2;
          a = a1;
          if (v <= 0) return null;
          const on = sel === i, frac = v / total, [lx, ly] = polar(110, 110, on ? 83 : 81, (a0 + a1) / 2);
          // พื้นสว่างใช้ตัวเข้ม พื้นเข้มใช้ตัวขาว (คิดจากความสว่างของสี) · เลือกช่วงไว้ = ช่วงอื่นจาง ช่วงที่เลือกยื่นออก (แบบโดนัทภาพรวม)
          return <g key={i} className="dso2-ov-seg" style={{ opacity: sel == null || on ? 1 : 0.25 }} onClick={() => onPick(i)}>
            <path d={arcPath(110, 110, on ? 110 : 104, on ? 55 : 58, a0, a1)} fill={colors[i]} stroke="var(--d-card)" strokeWidth={2}>
              <title>{`${LATE_RANGES[i]}: ${fmt(Math.round(v))} บาท · ${fmt(n[i]!)} บิล`}</title></path>
            {frac >= DONUT_LABEL_MIN && <text x={lx} y={ly} textAnchor="middle" className={"dso2-ring-t" + (isLight(colors[i]!) ? " dark" : "")}>
              <tspan x={lx} dy="-0.15em">{pct(frac * 100)}</tspan>
              <tspan x={lx} dy="1.2em" className="dso2-ring-n">({fmt(n[i]!)} บิล)</tspan>
            </text>}
          </g>;
        }) : <circle cx={110} cy={110} r={81} fill="none" stroke="var(--d-rail)" strokeWidth={46} />}
      </svg>
      <div className="dso2-donut-m">{sel != null && amt[sel] ? <>
        <span style={{ color: colors[Math.min(sel, 1)], fontWeight: 700 }}>{LATE_RANGES[sel]}</span>
        <b key={sel} className="num-fd">{amt[sel]! >= 1e6 ? m(amt[sel]!) : fmt(Math.round(amt[sel]!))}</b>
        <span>{amt[sel]! >= 1e6 ? "ล้านบาท" : "บาท"} · {fmt(n[sel]!)} บิล</span>
      </> : <><b>{m(total)}</b><span>ล้านบาท</span></>}</div>
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
            ยังค้าง ({fmt(unpaidN)} บิล)</button>
          <button type="button" className={paid ? "on" : ""} onClick={() => setTab("paid")}>
            {notDue ? "ชำระตามกำหนด" : "เกินกำหนดชำระแต่ชำระแล้ว"} ({fmt(all.length - unpaidN)} บิล)</button>
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
