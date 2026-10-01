/**
 * Executive Dashboard › Recommendation (เจ้าของงานสั่ง 1 ต.ค. 2569 — แทน PiRecommend เดิมที่อ่านผล PI · ลบแล้วพร้อมเมนู Executive Summary)
 * รอบสี่ (1 ต.ค. 2569 · เจ้าของงานสั่ง "หน้าตาคล้ายเดิม ตามรายงาน สั้นกระชับ บอกว่าปรับแล้วเพิ่มกำไร/ลดต้นทุนเท่าไหร่"):
 *   แถบสถานะ 3 หัวข้อ (🔴/🟡/🟢 + ✓ เกณฑ์ที่ผ่าน) → การ์ดสองคอลัมน์แบบ PiRecommend เดิม (ลำดับ · ชื่อเรื่อง · ป้าย · หมวด·หลักฐาน · สิ่งที่ควรทำ)
 *   มุมขวา = ผลที่คาดเป็นเงิน แทนคะแนน /10 · สมมติฐาน/ที่มาอยู่หลังปุ่ม ⓘ ท้ายหน้า
 * รอบห้า (เจ้าของงานสั่ง): กดกล่องสถานะ = แผงรายละเอียดของหัวข้อนั้น (ตัวเลขสำคัญ · เกณฑ์ ✓/✗ · ข้อมูลประกอบ) + การ์ดเหลือเฉพาะหัวข้อนั้น ·
 *   มุมขวา ป้ายอยู่บนตัวเลข "เพิ่มกำไร / x.xx ล้านบาท/ปี" · ข้อที่ไม่มียอดเงินไม่เขียนอะไรมุมขวา
 * ตัวเลข เงื่อนไข ระดับ และข้อความอยู่ที่ lib/recommend/exec.ts (buildRecs · goodChecks) — หน้านี้แค่จัดวาง
 */
import { useMemo, useState, type ReactNode } from "react";
import type { Trip } from "../../lib/data/useCostRev";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { useAlloc } from "../../lib/data/useAlloc";
import type { DebtorState } from "../../lib/data/useDebtors";
import { hasTonKm, overview, periodFor } from "../../lib/tonkm/calc";
import { readTargetPct } from "../../lib/tonkm/prefs";
import { debtorFileEnd } from "../../lib/debtors/aging";
import { REC_GAIN, REC_LEVEL, REC_PER, SEC_NAME, THRESHOLDS, buildRecs, debtSection, emptySection, goodChecks, lfSection, profitSection, secStatus } from "../../lib/recommend/exec";
import type { DebtSection, EmptySection, LfSection, ProfitSection, Rec } from "../../lib/recommend/exec";
import { fmt } from "../dash-costrev/common";
import { Note } from "../dash-fleet/parts";
import { rollupCustomers } from "./CustomerProfitTab";
import { defaultAsOf } from "./OverdueSection";
import { passLfDemo } from "./filter";
import type { DemoFilter } from "./filter";

type Sec = 1 | 2 | 3;
const TH_MONTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** ตัวเลข + หน่วย — หลักล้าน "7.50" + "ล้านบาท" · ต่ำกว่านั้นเต็มจำนวน + "บาท" */
const moneyParts = (n: number): [string, string] => (Math.abs(n) >= 1e6 ? [fmt(n / 1e6, 2), "ล้านบาท"] : [fmt(Math.round(n)), "บาท"]);
const baht = (n: number): string => moneyParts(n).join(" ");
const p1 = (x: number): string => `${fmt(x * 100, 1)}%`;
const dateTh = (iso: string): string => `${Number(iso.slice(8, 10))} ${TH_MONTH[Number(iso.slice(5, 7))]} ${Number(iso.slice(0, 4)) + 543}`;
const monthsTh = (ms: number[]): string => (ms.length ? `${TH_MONTH[ms[0]!]}–${TH_MONTH[ms[ms.length - 1]!]}` : "");
const lastDay = (y: number, m: number): string => `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

const STATUS = { bad: "ต้องแก้", warn: "เฝ้าระวัง", good: "ดีแล้ว" } as const;

function RecCard({ r, i }: { r: Rec; i: number }) {
  const [v, unit] = moneyParts(r.value);
  return (
    <li className={`xr-c ${r.level}`}>
      <span className="xr-no">{i + 1}</span>
      <div className="xr-c-main">
        <div className="xr-c-h"><b>{r.title}</b><em className={`xr-lv ${r.level}`}>{REC_LEVEL[r.level]}</em></div>
        <small className="xr-c-why">{SEC_NAME[r.sec]} · {r.why}</small>
        <p className="xr-c-a">{r.action}{r.start && <> — เริ่มที่ <b>{r.start}</b></>}</p>
      </div>
      {r.gain && r.value > 0 && (
        <div className="xr-c-v">
          <span>{REC_GAIN[r.gain]}</span>
          <b>{v}<i> {unit}{REC_PER[r.gain]}</i></b>
          {r.note && <small>{r.note}</small>}
        </div>
      )}
    </li>
  );
}

/** ตัวเลขสำคัญ + ข้อมูลประกอบของแต่ละหัวข้อ — แผงที่กางเมื่อกดกล่องสถานะ */
interface Kpi { l: string; v: string; s?: string; bad?: boolean }
function detailOf(k: Sec, ps: ProfitSection | null, ls: LfSection | null, es: EmptySection | null, ds: DebtSection | null): { kpis: Kpi[]; facts: ReactNode[] } {
  if (k === 1 && ps) return {
    kpis: [
      { l: ps.profit >= 0 ? "อัตรากำไร" : "อัตราขาดทุน", v: ps.margin == null ? "–" : `${fmt(Math.abs(ps.margin), 1)}%`, s: `${ps.profit >= 0 ? "กำไร" : "ขาดทุน"} ${baht(Math.abs(ps.profit))}`, bad: ps.profit < 0 },
      { l: "รายได้ / ต้นทุน", v: baht(ps.revenue), s: `ต้นทุน ${baht(ps.cost)}` },
      { l: "เที่ยวขาดทุน", v: `${fmt(ps.lossTripPct, 1)}%`, s: `จาก ${fmt(ps.n)} เที่ยว${ps.bills ? ` · ${fmt(ps.bills)} บิล` : ""}`, bad: ps.lossTripPct >= THRESHOLDS.lossTripPct },
      ...(ps.cust ? [{ l: "ลูกค้าขาดทุน", v: `${fmt(ps.cust.lossN)} ราย`, s: `ขาดทุนรวม ${baht(ps.cust.loss)}`, bad: ps.cust.lossN > 0 }] : []),
    ],
    facts: [
      ps.tk?.best && <>กำไรส่วนเกิน/ตัน-กม. สูงสุด <b>{ps.tk.best.vk}</b> {fmt(ps.tk.best.rate, 2)} บาท{ps.tk.worst && <> · ต่ำสุด <b>{ps.tk.worst.vk}</b> {fmt(ps.tk.worst.rate, 2)} บาท</>}{ps.tk.judged > 0 && <> · ถึงเป้า {ps.tk.ok} จาก {ps.tk.judged} ชนิด</>}</>,
      ps.best && <>เส้นทางกำไรรวมสูงสุด <b>{ps.best.rt}</b> {baht(ps.best.profit)} จาก {fmt(ps.best.n)} เที่ยว (อัตรากำไร {fmt(ps.best.margin, 1)}% · ต้นทุนผันแปร {p1(ps.best.varShare)} · สูญเปล่า {p1(ps.best.wasteShare)})</>,
      ps.svc.length > 0 && <>อัตรากำไรรายกลุ่มบริการ: {ps.svc.map((g) => `${g.sg} ${fmt(g.margin, 1)}%`).join(" · ")}</>,
    ],
  };
  if (k === 2 && (ls || es)) return {
    kpis: [
      ...(ls ? [
        { l: "อัตราการบรรทุกเฉลี่ย", v: p1(ls.avgLf), s: `เป้า ${p1(ls.avgTg)}`, bad: ls.gapPP >= THRESHOLDS.lfGapPP },
        { l: "ต้นทุนจมจากที่ว่าง", v: baht(ls.idle), s: `${p1(ls.share)} ของต้นทุนขนส่ง`, bad: ls.gapPP >= THRESHOLDS.lfGapPP },
      ] : []),
      ...(es ? [{ l: "ต้นทุนเที่ยววิ่งเปล่า", v: p1(es.share), s: `${baht(es.cost)} · ${fmt(es.n)} เที่ยว`, bad: es.share >= THRESHOLDS.emptyCostShare }] : []),
    ],
    facts: [
      ls?.yoy && <>แนวโน้มช่วง {monthsTh(ls.yoy.months)}: LF ปี {ls.yoy.from.year + 543} {p1(ls.yoy.from.lf)} → ปี {ls.yoy.to.year + 543} <b>{p1(ls.yoy.to.lf)}</b> · ต้นทุนจม {baht(ls.yoy.from.idle)} → {baht(ls.yoy.to.idle)}</>,
      ls && <>ต้นทุนจม 80% อยู่ในรถ <b>{ls.kinds80.k} จาก {ls.kinds80.of}</b> ชนิด{ls.topIdleRoute && <> · ต้นทุนจมสูงสุด <b>{ls.topIdleRoute.rt}</b> {baht(ls.topIdleRoute.idle)}</>}{ls.lowLfRoute && <> · LF ต่ำสุด <b>{ls.lowLfRoute.rt}</b> {p1(ls.lowLfRoute.lf)}</>}</>,
      es?.top && <>เที่ยวเปล่าแพงสุด <b>{es.top.rt}</b> {baht(es.top.cost)} ({p1(es.top.shareOfEmpty)} ของต้นทุนเที่ยวเปล่า · เฉลี่ย {baht(es.top.perTrip)}/เที่ยว · ต้นทุนผันแปร {p1(es.top.varShare)})</>,
    ],
  };
  if (k === 3 && ds) return {
    kpis: [
      ...(ds.dso != null ? [{ l: "ระยะเวลาเก็บหนี้ (DSO)", v: `${fmt(ds.dso, 0)} วัน`, s: ds.term != null ? `เครดิตเทอม ${fmt(ds.term, 0)} วัน` : undefined, bad: ds.late != null && ds.late >= THRESHOLDS.dsoLateDays }] : []),
      { l: "บิลที่วาง", v: fmt(ds.bills), s: baht(ds.amount) },
      { l: "บิลชำระช้า", v: p1(ds.latePaid.nShare), s: `${fmt(ds.latePaid.n)} บิล · ${baht(ds.latePaid.amount)}` },
      { l: "ค้างเกินกำหนด", v: baht(ds.overdue.amount), s: `${fmt(ds.overdue.n)} บิล`, bad: ds.amount > 0 && ds.overdue.amount / ds.amount >= THRESHOLDS.overdueShare },
    ],
    facts: [
      <>บิลที่วาง {dateTh(ds.from)} – {dateTh(ds.asOf)} · ชำระช้าคิดเป็น {p1(ds.latePaid.amtShare)} ของยอดขายเครดิต</>,
      ds.short != null && <>ยอดที่ล่าช้า {p1(ds.short)} อยู่ในช่วง 1–30 วัน · ชำระแล้วแต่ช้าเกิน 60 วัน {fmt(ds.latePaid.over60)} บิล</>,
    ],
  };
  return { kpis: [], facts: [] };
}

export default function ExecRecommend({ trips, f, debtors }: { trips: Trip[] | null; f: DemoFilter; debtors: DebtorState }) {
  const { data: lf } = useLoadFactor();
  const { data: alloc } = useAlloc();
  /** หัวข้อที่กดดูรายละเอียด — null = ทุกหัวข้อ */
  const [pick, setPick] = useState<Sec | null>(null);

  const tk = useMemo(() => {
    if (!lf || !hasTonKm(lf.trips)) return null;
    const ts = lf.trips.filter((t) => (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk));
    const p = periodFor(ts, f.year, f.from, f.to);
    return p ? overview(ts, p, readTargetPct()) : null;
  }, [lf, f.ft, f.vk, f.year, f.from, f.to]);
  const cust = useMemo(() => (alloc ? rollupCustomers(alloc, f) : null), [alloc, f]);
  const ps = useMemo(() => (trips && trips.length ? profitSection(trips, cust, tk) : null), [trips, cust, tk]);
  const ls = useMemo(() => {
    if (!lf) return null;
    const anyYear = lf.trips.filter((t) => (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk));
    return lfSection(lf.trips.filter((t) => passLfDemo(t, f)), anyYear);
  }, [lf, f]);
  const es = useMemo(() => (trips ? emptySection(trips) : null), [trips]);
  // ลูกหนี้ — เลือกปี = บิลที่วางในช่วงที่เลือก · ไม่เลือก = 1 ม.ค. ของปีถึงวันที่ข้อมูล
  const ds = useMemo(() => {
    const d = debtors.data;
    if (!d) return null;
    const rows = d.rows.filter((r) => !f.br || r.br === f.br);
    if (!rows.length) return null;
    const end = debtorFileEnd(rows);
    let from: string, asOf: string;
    if (f.year) {
      from = `${f.year}-${f.from || "01"}-01`;
      const to = lastDay(Number(f.year), Number(f.to || "12"));
      asOf = to < end ? to : end;
    } else {
      const min = rows.reduce((m, r) => (r.issue < m ? r.issue : m), rows[0]!.issue);
      asOf = defaultAsOf(min, d.manifest);
      from = `${asOf.slice(0, 4)}-01-01`;
    }
    return debtSection(rows, from, asOf);
  }, [debtors.data, f.br, f.year, f.from, f.to]);

  const recs = useMemo(() => buildRecs(ps, ls, es, ds), [ps, ls, es, ds]);
  // แถบสถานะ — หัวข้อที่ยังไม่มีข้อมูลไม่แสดง
  const secs = ([1, 2, 3] as const).filter((k) => (k === 1 ? ps : k === 2 ? ls || es : ds)).map((k) => {
    const checks = goodChecks(k, ps, ls, es, ds);
    return { k, checks, st: secStatus(recs.filter((r) => r.sec === k), checks), ok: checks.filter((c) => c.ok) };
  });
  const sel = pick && secs.some((s) => s.k === pick) ? pick : null;
  const shown = sel ? recs.filter((r) => r.sec === sel) : recs;
  const det = sel ? detailOf(sel, ps, ls, es, ds) : null;
  const selChecks = sel ? secs.find((s) => s.k === sel)!.checks : [];

  if (!secs.length) {
    return <p className="dz-note">{debtors.loading || !lf ? "กำลังโหลดข้อมูล…" : "ไม่มีข้อมูลตามตัวกรองที่เลือก"}</p>;
  }
  return (
    <div className="xr">
      <div className="xr-strip">
        {secs.map((s) => (
          <button key={s.k} type="button" className={`xr-strip-i ${s.st}` + (sel === s.k ? " on" : "")} aria-expanded={sel === s.k}
            title={sel === s.k ? "กดอีกครั้งเพื่อดูทุกหัวข้อ" : "กดเพื่อดูรายละเอียดของหัวข้อนี้"}
            onClick={() => setPick((p) => (p === s.k ? null : s.k))}>
            <span className="xr-strip-h"><b>{s.k}. {SEC_NAME[s.k]}</b><em className={`xr-st ${s.st}`}>{STATUS[s.st]}</em></span>
            {s.ok.length > 0 && <small>{s.ok.map((c) => `✓ ${c.text}`).join("  ")}</small>}
            <span className="xr-strip-more">{sel === s.k ? "ซ่อนรายละเอียด ▲" : "ดูรายละเอียด ▼"}</span>
          </button>
        ))}
      </div>
      {det && (
        <section className="dz-cc xr-det">
          <h4>{sel}. {SEC_NAME[sel!]}</h4>
          <div className="xr-kpis">
            {det.kpis.map((k) => (
              <div key={k.l} className={"xr-kpi" + (k.bad ? " bad" : "")}><span>{k.l}</span><b>{k.v}</b>{k.s && <small>{k.s}</small>}</div>
            ))}
          </div>
          {selChecks.length > 0 && (
            <p className="xr-checks">
              <b>เกณฑ์ดี:</b> {selChecks.map((c) => <span key={c.text} className={c.ok ? "ok" : "no"}>{c.ok ? "✓" : "✗"} {c.text}</span>)}
            </p>
          )}
          <ul className="xr-facts">{det.facts.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      )}
      {shown.length
        ? <ol className="xr-grid">{shown.map((r, i) => <RecCard key={`${r.sec}-${r.title}`} r={r} i={i} />)}</ol>
        : <p className="xr-good">✓ {sel ? "หัวข้อนี้อยู่ในเกณฑ์ดี" : "ทุกด้านอยู่ในเกณฑ์ดี"} ยังไม่มีข้อเสนอแนะเพิ่มเติม</p>}
      <Note className="xr-info">
        <p>ยอดเงินมุมขวาเป็นประมาณการสูงสุดภายใต้สมมติฐาน: เพิ่มกำไร/ลดต้นทุนคิดต่อปี (ยอดของช่วง ÷ จำนวนเดือน × 12) · เงินสดกลับมาเป็นยอดครั้งเดียว ·
          ลูกค้าขาดทุนกับเที่ยวขาดทุนเป็นขาดทุนก้อนเดียวกันคนละมุม ห้ามบวกรวม</p>
        <p>สมมติฐาน: LF ขึ้นถึงเป้ารายชนิดรถ · ลดเที่ยวเปล่า {THRESHOLDS.emptyCut[0] * 100}–{THRESHOLDS.emptyCut[1] * 100}% · เก็บหนี้ค้างได้ {THRESHOLDS.collectShare * 100}% ·
          ต้นทุนจมจาก LF เป็นเงินที่จ่ายไปแล้ว จะเป็นผลประโยชน์ได้เมื่อลดจำนวนเที่ยวหรือหารายได้ใหม่มาใช้พื้นที่ว่าง (ความเสี่ยง: ส่งมอบช้าลงเพราะรอรวมสินค้า)</p>
        <p>ป้าย: เร่งด่วน = ผลกระทบ ≥ {THRESHOLDS.urgentCostShare * 100}% ของต้นทุน (กลุ่มบริการ: อัตรากำไรของกลุ่ม &lt; {THRESHOLDS.svcUrgentMargin}% · ลูกค้าขาดทุน ≥ {THRESHOLDS.custLossUrgent * 100}% ของต้นทุน ·
          ค้างเกินกำหนด ≥ {THRESHOLDS.overdueUrgent * 100}% ของยอดวางบิล) · ติดตาม = ไม่ประเมินเป็นเงิน · หัวข้อ "ดีแล้ว" = ผ่านเกณฑ์ ✓ ครบและไม่มีข้อควรทำ</p>
        <p>ที่มา: ไฟล์ต้นทุน (จับคู่ได้ + เที่ยวเปล่า) ตามตัวกรองทุกตัว · ลูกค้าจากไฟล์ปันส่วน · Load Factor/ตัน-กม. จากไฟล์ Load Factor ตามปี/ช่วงเดือน/ประเภท/ชนิดรถ ·
          ลูกหนี้ตามสาขา{ds ? ` บิลที่วาง ${dateTh(ds.from)} – ${dateTh(ds.asOf)}` : ""}</p>
      </Note>
    </div>
  );
}
