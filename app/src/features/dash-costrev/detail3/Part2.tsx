/**
 * ส่วนที่ 2 · คุ้มค่าเสื่อมหรือไม่ — เฉพาะรถบริษัท (สเปก ข้อ3.pdf หน้า 4–6 · ข้อ 5.1–5.7)
 *   5.1 KPI 4 ใบ (Hero) · 5.2 + 5.3 รวมเป็นกระดานเดียว (KindBoard) แถวละชนิดรถ: แท่งบวก/ลบเทียบเส้นเฉลี่ยรวม คู่กับ
 *   แท่ง VC/FC เต็ม 100% ป้ายในแท่ง FC เป็นลายทาง (ตามภาพที่เจ้าของงานส่ง 23 ก.ย. 2569) · ท้ายแถว = ต้นทุน/เที่ยว ·
 *   5.5 แยกตามเส้นทาง · 5.7 คำแนะนำ "ควรทำอย่างไรต่อ" (AdviceBoard แผงแยกตามโทน) · รายละเอียดทุกเที่ยว
 *
 * ★ สเปกอ้างคอลัมน์ของ Excel ตัวอย่าง (G ค่าเสื่อม · L Contribution · M/N coverage · O % เทียบเฉลี่ย · P สถานะ ·
 *   Q VC · R FC) ที่ไม่ได้ให้นิยามมา — นิยามที่ใช้อยู่ที่ depreciation() ใน lib/detail3/calc.ts
 */
import { useMemo } from "react";
import { D } from "../../../lib/chart/theme";
import {
  DEP_LOW_PCT, DEP_STATUS_LABEL, DEP_WARN_PCT, depAdvice, depByKind, depByRoute, depreciation,
  type DepAdviceTone, type DepRow, type DepStatus, type VRow,
} from "../../../lib/detail3/calc";
import { thDateSafe } from "../../../lib/record/date";
import { Hero, Note } from "../../dash-fleet/parts";
import { fmt, pct, signed, type Col } from "../common";
import D3Table, { NEG, POS } from "./D3Table";

const times = (n: number): string => `${fmt(n, 2)} เท่า`;
const spct = (n: number): string => `${n > 0 ? "+" : n < 0 ? "−" : ""}${pct(Math.abs(n))}`;
/** สถานะ → สีป้ายชุดเดียวกับแท็บการใช้ประโยชน์ของกองรถ */
const STATUS_PILL: Record<DepStatus, string> = { ok: "comp", watch: "only-comp", low: "low" };
type RouteRow = ReturnType<typeof depByRoute>[number];
type KindRow = ReturnType<typeof depByKind>[number];
/** สัดส่วนต่ำสุดที่ใส่ป้าย "VC 91%"/"FC 12%" ในแท่งได้ไม่ล้น — ต่ำกว่านี้ย้ายป้าย FC ไปท้ายแท่ง */
const FIT_PCT = 14;
type AdviceRow = ReturnType<typeof depAdvice>[number];

export default function Part2({ rows }: { rows: VRow[] }) {
  const d = useMemo(() => depreciation(rows), [rows]);
  const kinds = useMemo(() => depByKind(d.list), [d.list]);
  const routes = useMemo(() => depByRoute(d.list, d.avgCoverage), [d.list, d.avgCoverage]);
  const advice = useMemo(() => depAdvice(d.list), [d.list]);

  if (!d.list.length) return <div className="dz-cc"><p className="dz-note">ไม่มีเที่ยวของรถบริษัทที่มีค่าเสื่อมในปีที่เลือก</p></div>;
  return <>
    <div className="dz-heroes">
      <Hero kind="cost" l="ค่าเสื่อมสะสมทั้งหมด" v={fmt(d.totalDep)} unit="บาท"
        s={<>{fmt(d.list.length)} เที่ยว จาก {fmt(kinds.length)} ชนิด (เฉพาะรถบริษัท)</>} />
      <Hero kind="profit" l="Contribution เฉลี่ย/เที่ยว" v={fmt(d.avgContribution)} unit="บาท" s="รายได้ − ต้นทุนผันแปร" />
      <Hero kind="svc" l="coverage เฉลี่ยรวม" v={fmt(d.avgCoverage, 2)} unit="เท่า" s="ΣContribution ÷ Σค่าเสื่อม" />
      <Hero kind="loss" l="เที่ยวที่ต่ำกว่าค่าเฉลี่ยรวม" v={fmt(d.below)} vSub={`/ ${fmt(d.list.length)} เที่ยว`}
        s="สถานะ ต่ำกว่าเฉลี่ยมาก + เฝ้าระวัง" />
    </div>

    <KindBoard kinds={kinds} />

    <RouteTable routes={routes} avg={d.avgCoverage} />

    <AdviceBoard advice={advice} />

    <TripTable list={d.list} />
    <Note>นิยาม: ต้นทุนผันแปร (VC) = ต้นทุนของคัน − ค่าเสื่อม · Contribution = รายได้ (ปันตามสัดส่วนต้นทุนของคัน) − VC ·
      coverage = Contribution ÷ ค่าเสื่อม · coverage เฉลี่ยรวม = ΣContribution ÷ Σค่าเสื่อม ·
      สถานะรายเที่ยว: ต่ำกว่าค่าเฉลี่ยรวมเกิน {Math.abs(DEP_LOW_PCT)}% = ต่ำกว่าเฉลี่ยมาก · ต่ำกว่า 0–{Math.abs(DEP_LOW_PCT)}% = เฝ้าระวัง ·
      ไม่นับรถบริษัทที่ไม่มีค่าเสื่อม {fmt(d.noDep)} คัน-เที่ยว (หารไม่ได้)</Note>
  </>;
}

/**
 * กระดานชนิดรถ — แถวเดียวกันอ่านได้ทั้งสองเรื่อง (ของเดิมแยกสองกล่อง สูงไม่เท่ากัน ต้องไล่ชื่อจับคู่เอง)
 * แกนบวก/ลบไม่สมมาตร: แต่ละฝั่งกว้างตามค่าสุดขั้วของฝั่งนั้น (สเกลเดียวกัน) ฝั่งที่เล็กมากกันไว้อย่างน้อย 25%
 * ของอีกฝั่ง — ของเดิมตั้ง ±500% ทั้งที่ฝั่งลบลึกสุดราว −80% แท่งแดงจึงสั้นจนอ่านไม่ออก
 */
function KindBoard({ kinds }: { kinds: KindRow[] }) {
  const pos = Math.max(0, ...kinds.map((k) => k.vsAvg)), neg = Math.max(0, ...kinds.map((k) => -k.vsAvg));
  const L = Math.max(neg, pos * 0.25, 1), R = Math.max(pos, neg * 0.25, 1);
  const zero = (L / (L + R)) * 100;
  return <div className="dz-cc" style={{ marginTop: 14 }}>
    <h4>ชนิดรถไหนคุ้มค่าเสื่อม · โครงต้นทุนต่อเที่ยว</h4>
    <div className="fl-legend d3-kb-legend">
      <span><i style={{ background: D.emeraldLight }} />คุ้มค่าเสื่อมกว่าค่าเฉลี่ยรวม</span>
      <span><i style={{ background: D.rose }} />ต่ำกว่าค่าเฉลี่ยรวม</span>
      <span><i style={{ background: D.indigo }} />แท่งคราม = ต้นทุนผันแปร (VC)</span>
      <span><i className="d3-kb-stripe" />แท่งส้ม = ต้นทุนคงที่ · ค่าเสื่อม (FC)</span>
    </div>
    <div className="d3-kb" role="table">
      <div className="d3-kb-row d3-kb-th" role="row">
        <span>ชนิดรถ</span>
        <span className="d3-kb-div-h"><em style={{ left: `${zero}%` }}>ค่าเฉลี่ยรวม</em></span>
        <span className="num">เทียบเฉลี่ย</span>
        <span>ต้นทุนแต่ละชนิดรถไปอยู่ตรงไหนบ้าง</span>
        <span className="num">ต้นทุน/เที่ยว</span>
      </div>
      {kinds.map((k, i) => {
        const good = k.vsAvg >= 0, w = (Math.abs(k.vsAvg) / (L + R)) * 100;
        return <div key={k.vk} className="d3-kb-row" role="row" style={{ animationDelay: `${i * 0.03}s` }}>
          <span className="d3-kb-name"><b>{k.vk}</b><small>{fmt(k.n)} เที่ยว</small></span>
          <span className="d3-kb-div" title={`${spct(k.vsAvg)} เทียบค่าเฉลี่ยรวม`}>
            <i className="d3-kb-zero" style={{ left: `${zero}%` }} />
            <i className="d3-kb-bar" style={{ background: good ? D.emeraldLight : D.rose,
              width: `${w}%`, left: good ? `${zero}%` : `${zero - w}%`, transformOrigin: good ? "left" : "right" }} />
          </span>
          <span className="num d3-kb-pct" style={{ color: good ? "var(--green)" : "var(--red)" }}>{spct(k.vsAvg)}</span>
          <span className="d3-kb-cost" title={`VC ${fmt(k.vc)} บาท · FC ${fmt(k.fc)} บาท`}>
            <span className="d3-kb-stack">
              <span className="vc" style={{ width: `${k.vcShare}%`, background: D.indigo }}>
                {k.vcShare >= FIT_PCT && <>VC {pct(k.vcShare, 0)}</>}</span>
              <span className="fc" style={{ width: `${100 - k.vcShare}%` }}>
                {100 - k.vcShare >= FIT_PCT && <>FC {pct(100 - k.vcShare, 0)}</>}</span>
            </span>
            <small className="d3-kb-fcout">{100 - k.vcShare < FIT_PCT && <>FC {pct(100 - k.vcShare, 0)}</>}</small>
          </span>
          <span className="num d3-kb-total">฿{fmt(k.total)}</span>
        </div>;
      })}
    </div>
    <p className="dz-note">เทียบเฉลี่ย = ค่าเฉลี่ยของ % ที่ coverage รายเที่ยวต่างจาก coverage เฉลี่ยรวม ·
      แท่งต้นทุนเต็ม 100% แบ่งตามสัดส่วน VC/FC ของต้นทุนเฉลี่ยต่อเที่ยว · FC % = ค่าเสื่อม ÷ ต้นทุน ·
      ส่วนที่แคบเกินใส่ป้ายได้จะย้ายป้ายไปไว้ท้ายแท่ง</p>
  </div>;
}

/** ข้อความของแต่ละแผงคำแนะนำ — เรียงตามลำดับที่วาด (ดี → เฝ้าระวัง → เตือน) */
const ADVICE_PANEL: { tone: DepAdviceTone; title: string; desc: string; col: string; color: string }[] = [
  { tone: "good", title: "รักษาไว้ และขยายผล", col: "เส้นทางที่ดีที่สุด", color: D.emeraldLight,
    desc: "คุ้มค่าเสื่อมสูงกว่าค่าเฉลี่ยรวม — รักษารูปแบบการใช้งานปัจจุบันไว้ และใช้เส้นทางที่ดีที่สุดเป็นต้นแบบขยายไปยังชนิดอื่น" },
  { tone: "watch", title: "เฝ้าระวัง", col: "เส้นทางที่ต่ำสุด", color: D.amber,
    desc: `ต่ำกว่าค่าเฉลี่ยรวมไม่เกิน ${Math.abs(DEP_WARN_PCT)}% — เฝ้าระวังต่อ ยังไม่ต้องเปลี่ยนรูปแบบการใช้งาน` },
  { tone: "warn", title: "ทบทวนเส้นทาง", col: "เส้นทางที่ต่ำสุด", color: D.rose,
    desc: `ต่ำกว่าค่าเฉลี่ยรวมเกิน ${Math.abs(DEP_WARN_PCT)}% — ดูตาราง "แยกตามเส้นทาง" ว่าปัญหาอยู่ที่ตัวรถหรือเส้นทางที่ให้วิ่ง แล้วพิจารณาย้ายไปวิ่งเส้นทางอื่น` },
];

/**
 * "ควรทำอย่างไรต่อ" (สเปก 5.7) ตามภาพที่เจ้าของงานส่ง 23 ก.ย. 2569 — ป้ายนับจำนวนชนิดที่หัว · แผงสีแยกตามโทน
 * แถวละชนิดรถ: ชื่อ · เส้นทางอ้างอิง (ดี = ดีที่สุด · อื่น = ต่ำสุด ถ้ามีเส้นทางเดียวใช้เส้นนั้น) · แถบยาวตาม |%| เทียบตัวสุดในแผง · %
 * แผงเฝ้าระวังขึ้นเฉพาะเมื่อมีชนิดเข้าเกณฑ์
 */
function AdviceBoard({ advice }: { advice: AdviceRow[] }) {
  const panels = ADVICE_PANEL.map((p) => ({ ...p, list: advice.filter((a) => a.tone === p.tone) })).filter((p) => p.list.length);
  const count = (t: DepAdviceTone) => advice.filter((a) => a.tone === t).length;
  return <div className="dz-cc" style={{ marginTop: 14 }}>
    <div className="d3-adv-head">
      <h4>ควรทำอย่างไรต่อ</h4>
      <div className="d3-adv-pills">
        {count("good") > 0 && <span className="good"><i />ดีกว่าค่าเฉลี่ย {fmt(count("good"))} ชนิด</span>}
        {count("watch") > 0 && <span className="watch"><i />เฝ้าระวัง {fmt(count("watch"))} ชนิด</span>}
        {count("warn") > 0 && <span className="warn"><i />ต่ำกว่าเกณฑ์ {fmt(count("warn"))} ชนิด</span>}
      </div>
    </div>
    <div className="d3-adv-grid">{panels.map((p) => {
      const max = Math.max(1, ...p.list.map((a) => Math.abs(a.vsAvg)));
      return <section key={p.tone} className={`d3-adv-panel ${p.tone}`}>
        <header><h5>{p.title}</h5><p>{p.desc}</p></header>
        <div className="d3-adv-th"><span>ชนิดรถ · {p.col}</span><span>vs ค่าเฉลี่ย</span></div>
        <ul>{p.list.map((a, i) => {
          const ref = p.tone === "good" ? a.best : a.worst ?? a.best;
          return <li key={a.vk} style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="d3-adv-main">
              <div className="d3-adv-line"><b>{a.vk}</b>
                <small>{ref ? <>{ref.rt} · <b>{times(ref.coverage)}</b></> : "ไม่มีข้อมูลเส้นทาง"}</small></div>
              <div className="d3-adv-rail"><i style={{ width: `${(Math.abs(a.vsAvg) / max) * 100}%`, background: p.color }} /></div>
            </div>
            <strong style={{ color: p.color }}>{spct(a.vsAvg)}</strong>
          </li>;
        })}</ul>
      </section>;
    })}</div>
    <Note>เกณฑ์ (สเปก 5.7): ค่าเฉลี่ย % เทียบค่าเฉลี่ยรวมของชนิดรถ ≥ 0% = ดี · ต่ำกว่า {DEP_WARN_PCT}% = เตือน · ระหว่างนั้น = เฝ้าระวัง ·
      ตัวเลขหลังชื่อเส้นทาง = coverage เฉลี่ยของชนิดรถนั้นบนเส้นทางนั้น ·
      ข้อมูลตัวอย่างมีจำนวนเที่ยวน้อยในบางชนิด — ก่อนตัดสินใจ เช่น ขาย/เปลี่ยนรถ ควรดูข้อมูลย้อนหลังหลายเดือน</Note>
  </div>;
}

function RouteTable({ routes, avg }: { routes: RouteRow[]; avg: number }) {
  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt, render: (r) => <b>{r.rt}</b> },
    { key: "n", label: "จำนวนเที่ยว", get: (r) => r.n, num: true },
    { key: "coverage", label: "Coverage เฉลี่ย", get: (r) => r.coverage, num: true,
      render: (r) => <span className={`d3-tt-cov ${r.below ? "neg" : "pos"}`}>{times(r.coverage)}</span> },
    { key: "below", label: "สถานะ", get: (r) => (r.below ? 0 : 1), render: (r) => r.below
      ? <span className="fu-pill low">ต่ำกว่าเฉลี่ย</span> : <span className="fu-pill comp">ปกติ</span> },
    // ชนิดรถไว้ท้ายสุด — ป้ายหลายอันกว้าง ถ้าวางก่อนจะดัน coverage/สถานะหลุดขอบขวา
    { key: "kinds", label: "ชนิดรถที่วิ่ง", get: (r) => r.kinds.join(", "),
      render: (r) => <span className="d3-tt-kinds">{r.kinds.map((k) => <span key={k} className="d3-tt-kind">{k}</span>)}</span> },
  ], []);
  return <D3Table title="แยกตามเส้นทาง (ทุกชนิดรถ)" unit="เส้นทาง" rows={routes} cols={cols} initial={{ key: "coverage", dir: 1 }}
    rowKey={(r) => r.rt} empty="ไม่มีข้อมูล" search={(r) => [r.rt, ...r.kinds]} placeholder="ค้นหาเส้นทาง, ชนิดรถ…"
    note={<>เส้นทางไหนของบริษัทที่ดึงค่าเสื่อมลง ไม่ว่าจะเป็นรถชนิดใด · สถานะ = coverage เฉลี่ยของเส้นทาง เทียบ coverage เฉลี่ยรวม <b>{times(avg)}</b></>}
    legend={[[NEG, "ต่ำกว่าเฉลี่ย"], [POS, "ปกติ"]]} />;
}

/** รายละเอียดทุกเที่ยว — ต้นแบบของดีไซน์ตาราง (ภาพที่เจ้าของงานส่ง 23 ก.ย. 2569) */
function TripTable({ list }: { list: DepRow[] }) {
  const cols = useMemo<Col<DepRow>[]>(() => [
    { key: "d", label: "วันที่", get: (r) => r.d, render: (r) => thDateSafe(r.d) },
    { key: "id", label: "เลขที่ใบรายการ", get: (r) => r.id, render: (r) => <span className="d3-tt-id">{r.id}</span> },
    { key: "pl", label: "ทะเบียน", get: (r) => r.pl || "–", render: (r) => <b>{r.pl || "–"}</b> },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk, render: (r) => <span className="d3-tt-kind">{r.vk}</span> },
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt },
    { key: "rev", label: "รายได้ (บาท)", get: (r) => r.rev, num: true },
    { key: "vc", label: "VC", get: (r) => r.vc, num: true },
    { key: "dep", label: "ค่าเสื่อม", get: (r) => r.dep, num: true },
    { key: "contribution", label: "Contribution", get: (r) => r.contribution, num: true,
      render: (r) => <b className={r.contribution < 0 ? "d3-tt-neg" : "d3-tt-pos"}>{signed(r.contribution)}</b> },
    { key: "coverage", label: "Coverage", get: (r) => r.coverage, num: true,
      render: (r) => <span className={`d3-tt-cov ${r.coverage < 0 ? "neg" : "pos"}`}>{times(r.coverage)}</span> },
    { key: "vsAvg", label: "เทียบเฉลี่ยรวม", get: (r) => r.vsAvg, num: true,
      render: (r) => <b className={r.vsAvg < 0 ? "d3-tt-neg" : "d3-tt-pos"}>{spct(r.vsAvg)}</b> },
    { key: "status", label: "สถานะ", get: (r) => r.status,
      render: (r) => <span className={`fu-pill ${STATUS_PILL[r.status]}`}>{DEP_STATUS_LABEL[r.status]}</span> },
  ], []);
  return <D3Table title="รายละเอียดทุกเที่ยวของบริษัท" unit="คัน-เที่ยว" rows={list} cols={cols} initial={{ key: "vsAvg", dir: 1 }}
    rowKey={(r) => `${r.id}|${r.pl}`} empty="ไม่มีข้อมูล" search={(r) => [r.pl, r.rt, r.vk, r.id]}
    placeholder="ค้นหาทะเบียน, เส้นทาง…" legend={[[NEG, "ขาดทุน"], [POS, "มีกำไร"]]} />;
}
