/**
 * ตารางสรุป เส้นทาง × ชนิดรถ — ท้ายแท็บ "กำไรรายเที่ยว"
 *
 * ตรรกะ (สัดส่วนสองฝั่ง · ต้นทุนเฉลี่ยต่อเที่ยว · คำแนะนำ) อยู่ใน lib/fleetcompare/compare.ts
 * ที่นี่แค่กรองและแสดงผล · ตัวกรองในหัวตารางกรองเฉพาะตารางนี้ ไม่กระทบกราฟด้านบน
 *
 * ★ เจ้าของงานสั่ง 20 ก.ย. 2569: ตัดคอลัมน์กลุ่มบริการออก (เหลือเป็นตัวกรอง) · รวมสองคอลัมน์ %
 *   เป็นแถบสัดส่วนที่แยกสีสองฝั่ง (รถบริษัท = คราม · รถร่วม = เขียวน้ำทะเล) · ห้ามตัดคอลัมน์ต้นทุนรวม
 *   ให้กดที่กำไรสุทธิแล้วเปิดหน้าต่างรายละเอียดพร้อมรายการเที่ยวของกลุ่มนั้น ปิดด้วยปุ่ม
 * ★ ตั้งต้นโชว์ 10 อันดับแรกเพื่อให้เห็นครบโดยไม่ต้องเลื่อน สลับเป็นทั้งหมดได้
 */
import { useEffect, useMemo, useState } from "react";
import { summarize } from "../../lib/fleetcompare/compare";
import type { Advice, SummaryRow } from "../../lib/fleetcompare/compare";
import { thDateSafe } from "../../lib/record/date";
import { D } from "../../lib/chart/theme";
import { Note, TableHead } from "../dash-fleet/parts";
import { ListFF, SortTable, duniq, fmt, marginTone, pct, signed, useSort } from "./common";
import type { Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

const ADVICE: Record<Advice, { label: string; tone: "good" | "warn" | "bad" }> = {
  "keep-comp": { label: "คงรถบริษัท", tone: "good" },
  "consider-part": { label: "พิจารณาใช้รถร่วม", tone: "warn" },
  "switch-part": { label: "เปลี่ยนเป็นรถร่วม", tone: "bad" },
  "review-low": { label: "ทบทวน (Margin ต่ำ)", tone: "warn" },
  "review-loss": { label: "ทบทวน (ขาดทุน)", tone: "bad" },
};
const ADVICE_ORDER: Advice[] = ["switch-part", "consider-part", "review-loss", "review-low", "keep-comp"];

const COMP = D.indigo;
const PART = D.teal;
const TOP_N = 10;
const F0 = { o: "", de: "", sg: "", vk: "", adv: "" };

/** ต้นทุน/เที่ยวของฝั่งหนึ่ง · * = ไม่มีรถฝั่งนี้ในกลุ่มนี้ ใช้ค่าเฉลี่ยของชนิดรถทั้งชุดแทน */
const sideCost = (v: number | null, est: boolean): string => (v == null ? "–" : fmt(Math.round(v)) + (est ? "*" : ""));

export default function SummaryTable({ trips, ftFiltered }: { trips: Trip[]; ftFiltered: boolean }) {
  const [f, setF] = useState(F0);
  const set = (k: keyof typeof F0) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<SummaryRow | null>(null);

  const scope = useMemo(() => trips.filter((t) =>
    (!f.o || t.o === f.o) && (!f.de || t.de === f.de) && (!f.vk || t.vk === f.vk)
    && (!f.sg || (t.sg || "ไม่ระบุ") === f.sg)), [trips, f.o, f.de, f.vk, f.sg]);
  const res = useMemo(() => summarize(scope), [scope]);
  const rows = useMemo(() => res.rows.filter((r) => !f.adv || r.advice === f.adv), [res, f.adv]);

  const cols = useMemo<Col<SummaryRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt,
      render: (r) => <span className="sm-rt" title={r.rt}>{r.rt}</span> },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk,
      render: (r) => <span className="sm-rt" title={r.vk}>{r.vk}</span> },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "share", label: "บริษัท : ร่วม", get: (r) => r.compShare,
      render: (r) => (
        <div className="sm-mix" title={`รถบริษัท ${fmt(r.compN)} เที่ยว · รถร่วม ${fmt(r.partN)} เที่ยว`}>
          <span className="bar">
            <i style={{ width: `${r.compShare * 100}%`, background: COMP }} />
            <i style={{ width: `${r.partShare * 100}%`, background: PART }} />
          </span>
          <span className="t">
            <b style={{ color: COMP }}>{Math.round(r.compShare * 100)}</b>
            <em>:</em>
            <b style={{ color: PART }}>{Math.round(r.partShare * 100)}</b>
          </span>
        </div>
      ) },
    { key: "rev", label: "รายได้", get: (r) => r.rev, num: true },
    { key: "cost", label: "ต้นทุนรวม", get: (r) => r.cost, num: true },
    { key: "profit", label: "กำไรสุทธิ", get: (r) => r.profit, num: true,
      render: (r) => (
        <button type="button" className="sm-profit" onClick={() => setOpen(r)}
          title="กดเพื่อดูรายได้ ต้นทุน และรายการเที่ยวของกลุ่มนี้"
          style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>
          {signed(r.profit)}
        </button>
      ) },
    { key: "margin", label: "Margin", get: (r) => r.margin, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>
        {r.margin == null ? "–" : (r.margin > 0 ? "+" : "") + pct(r.margin)}</span> },
    { key: "advice", label: "คำแนะนำ", get: (r) => ADVICE[r.advice].label,
      render: (r) => (
        <div className="sm-adv">
          <span className={`sm-chip ${ADVICE[r.advice].tone}`}>{ADVICE[r.advice].label}</span>
          <small title="ต้นทุนเฉลี่ยต่อเที่ยวของสองฝั่ง — ตัวเลขที่ใช้ตัดสินคำแนะนำ">
            บ. {sideCost(r.compCost, r.compEst)} · ร่วม {sideCost(r.partCost, r.partEst)}
          </small>
        </div>
      ) },
  ], []);
  const { sorted, sort, toggle } = useSort(rows, cols, { key: "profit", dir: -1 });
  const shown = useMemo(() => (all ? sorted : sorted.slice(0, TOP_N)), [all, sorted]);

  const s = res.summary;
  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <TableHead title="ตารางสรุป · เส้นทาง × ชนิดรถ">
        <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่ม" value={f.sg} onChange={set("sg")}
          opts={duniq(trips.map((t) => t.sg || "ไม่ระบุ"))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(trips.map((t) => t.vk))} />
        <ListFF label="คำแนะนำ" all="ทุกคำแนะนำ" value={f.adv} onChange={set("adv")}
          opts={ADVICE_ORDER.filter((a) => s.byAdvice[a] > 0)}
          labelOf={(a) => `${ADVICE[a as Advice].label} (${fmt(s.byAdvice[a as Advice])})`} />
        <div className="fl-toggle" role="group" aria-label="จำนวนแถวที่แสดง">
          <button type="button" className={!all ? "on" : ""} onClick={() => setAll(false)}>{TOP_N} อันดับแรก</button>
          <button type="button" className={all ? "on" : ""} onClick={() => setAll(true)}>ทั้งหมด ({fmt(rows.length)})</button>
        </div>
      </TableHead>

      {ftFiltered && (
        <p className="dz-note">
          เลือกตัวกรอง "ประเภทรถ" ไว้ฝั่งเดียว — แถบสัดส่วนและคำแนะนำจึงเทียบสองฝั่งไม่ได้ ล้างตัวกรองนั้นก่อน
        </p>
      )}
      <SortTable rows={shown} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key}
        empty="ไม่พบข้อมูลตามเงื่อนไข" />
      <Note>
        <i className="sm-sw" style={{ background: COMP }} />รถบริษัท
        <i className="sm-sw" style={{ background: PART }} />รถร่วม (รวมรถร่วมนอกพิเศษ) ·
        <b> กดที่ตัวเลขกำไรสุทธิ</b> เพื่อดูรายได้ ต้นทุน และรายการเที่ยวของกลุ่มนั้น ·
        {!all && rows.length > TOP_N ? ` แสดง ${TOP_N} อันดับแรกจาก ${fmt(rows.length)} กลุ่ม ตามคอลัมน์ที่เรียงอยู่ · ` : " "}
        <b>คำแนะนำ</b> ดูสองอย่างคู่กัน คือ <b>Margin</b> ของกลุ่มนั้น กับ <b>ต้นทุนเฉลี่ยต่อเที่ยว</b>ว่าฝั่งไหนถูกกว่า
        (ต่างไม่ถึง 5% ถือว่าพอ ๆ กัน) — ใช้ต้นทุนไม่ใช่กำไรในการเทียบสองฝั่ง เพราะรายได้มาจากงาน ไม่ได้มาจากรถ ·
        คงรถบริษัท = Margin ตั้งแต่ 10% และรถบริษัทไม่ได้แพงกว่า · พิจารณาใช้รถร่วม = รถร่วมถูกกว่าแต่กลุ่มนี้ยังกำไรดี ·
        ทบทวน = Margin ต่ำกว่า 10% หรือขาดทุน โดยรถร่วมก็ไม่ได้ถูกกว่า · เปลี่ยนเป็นรถร่วม = Margin ต่ำกว่า 5% และรถร่วมถูกกว่า ·
        เลข <b>*</b> = กลุ่มนี้ไม่มีรถฝั่งนั้นวิ่งเลย ใช้ค่าเฉลี่ยต้นทุนของชนิดรถนั้นทั้งชุดมาแทน ·
        กลุ่มที่มีรถวิ่งจริงทั้งสองฝั่ง {fmt(s.bothSides)} จาก {fmt(s.groups)} กลุ่ม ({pct(s.bothSidesTripShare * 100, 0)} ของเที่ยว) ·
        ชนิดรถที่มีทั้งสองฝั่ง {fmt(s.sharedKinds)} จาก {fmt(s.kinds)} ชนิด · ไม่รวมเที่ยววิ่งเปล่า · คลิกหัวคอลัมน์เพื่อเรียง
      </Note>

      {open && <DetailModal row={open} trips={scope} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------------- หน้าต่างรายละเอียดของกลุ่ม ---------------- */

/** กลุ่มต้นทุนที่แยกให้เห็น — ที่เหลือรวมเป็น "อื่น ๆ" (แก๊ส Fleet Card เพิ่มย้อนหลัง SND) */
const COST_PARTS: { key: keyof Trip; label: string }[] = [
  { key: "fuel", label: "น้ำมัน" }, { key: "allow", label: "เบี้ยเลี้ยง" }, { key: "fee", label: "ค่าธรรมเนียม" },
  { key: "repair", label: "ค่าซ่อม" }, { key: "dep", label: "ค่าเสื่อม" }, { key: "rent", label: "ค่าเช่า" },
  { key: "waste", label: "สูญเปล่า" },
];

function DetailModal({ row, trips, onClose }: { row: SummaryRow; trips: Trip[]; onClose: () => void }) {
  // ปิดด้วย Esc ได้ด้วย นอกจากปุ่มปิดกับคลิกนอกกล่อง
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const list = useMemo(
    () => trips.filter((t) => !t.empty && t.rt === row.rt && t.vk === row.vk),
    [trips, row]);
  const parts = useMemo(() => {
    const out = COST_PARTS.map((p) => ({ label: p.label, v: list.reduce((s, t) => s + (t[p.key] as number), 0) }))
      .filter((p) => p.v !== 0);
    const rest = row.cost - out.reduce((s, p) => s + p.v, 0);
    return Math.abs(rest) > 1 ? [...out, { label: "อื่น ๆ", v: rest }] : out;
  }, [list, row.cost]);

  const cols = useMemo<Col<Trip>[]>(() => [
    { key: "d", label: "วันที่", get: (t) => t.d, render: (t) => thDateSafe(t.d) },
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
    { key: "br", label: "สาขา", get: (t) => t.br || "–" },
    { key: "pl", label: "ทะเบียนรถ", get: (t) => t.pl || "–" },
    { key: "ft", label: "ประเภทรถ", get: (t) => t.ft,
      render: (t) => <span className={"sm-side " + (t.ft === "รถบริษัท" ? "comp" : "part")}>{t.ft}</span> },
    { key: "dir", label: "ทิศทาง", get: (t) => t.dir || "–" },
    { key: "rev", label: "รายได้", get: (t) => t.rev, num: true },
    { key: "cost", label: "ต้นทุน", get: (t) => t.cost, num: true },
    { key: "profit", label: "กำไร", get: (t) => t.profit, num: true,
      render: (t) => <span style={{ fontWeight: 700, color: t.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(t.profit)}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(list, cols, { key: "profit", dir: -1 });

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${row.rt}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{row.rt} <span>· {row.vk}</span></div>
            <p>
              {fmt(row.n)} เที่ยว · รถบริษัท {fmt(row.compN)} ({pct(row.compShare * 100, 0)}) ·
              รถร่วม {fmt(row.partN)} ({pct(row.partShare * 100, 0)}) ·
              ต้นทุนเฉลี่ย/เที่ยว บริษัท {sideCost(row.compCost, row.compEst)} · ร่วม {sideCost(row.partCost, row.partEst)}
            </p>
          </div>
          <span className={`sm-chip ${ADVICE[row.advice].tone}`}>{ADVICE[row.advice].label}</span>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="sm-nums">
          <div><span>รายได้</span><b>{fmt(row.rev)}</b></div>
          <div><span>ต้นทุนรวม</span><b>{fmt(row.cost)}</b></div>
          <div><span>กำไรสุทธิ</span>
            <b style={{ color: row.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(row.profit)}</b></div>
          <div><span>Margin</span>
            <b style={{ color: marginTone(row.margin) }}>{row.margin == null ? "–" : pct(row.margin)}</b></div>
        </div>

        <div className="sm-parts">
          <b>ต้นทุนแยกกลุ่ม</b>
          {parts.map((p) => <span key={p.label}>{p.label} <b>{fmt(p.v)}</b></span>)}
        </div>

        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(t, i) => `${t.id}-${i}`}
            empty="ไม่มีเที่ยวในกลุ่มนี้" />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
