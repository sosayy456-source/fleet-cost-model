/**
 * ส่วนที่ 1 · ภาพรวมต้นทุนขนส่งสำหรับผู้บริหาร (สเปก ข้อ3.pdf ภาพ 1–4)
 *   1. KPI (Hero 3 + KC 2) + ต้นทุนของรถแต่ละชนิด แยกบริษัท/ร่วม (สลับ ต่อเที่ยว · ต่อกม. · ต่อตัน-กม.)
 *   2. เส้นทาง × ชนิดรถ (ต้นทุน/ตัน-กม. เฉลี่ยรายเที่ยว) ช่องที่เกิน 2 เท่าของค่าเฉลี่ยชนิดรถติด ⚠
 *   3. Top 5 เส้นทาง × ชนิดรถที่ถูกสุด + เที่ยวที่ควร Flag
 *   4. บริษัท vs ร่วม ตามชนิดรถ (ต้นทุน/กม.) + กราฟรายชนิด
 */
import { useMemo, useState } from "react";
import { DBar } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import type { Trip } from "../../../lib/data/useCostRev";
import {
  companyVsPartner, CVP_LABEL, CVP_TIE_PCT, FLAG_TIMES, kindSides, metricOf, overview, routeKindMatrix, TOP_MIN_TRIPS,
  type Cell, type CvpAdvice, type Metric, type VRow,
} from "../../../lib/detail3/calc";
import { thDateSafe } from "../../../lib/record/date";
import { Hero, KC, Note, TableHead } from "../../dash-fleet/parts";
import { fmt, ListFF, pct, type Col } from "../common";
import D3Table, { NEG, POS } from "./D3Table";

const COMP = D.indigo, PART = D.amber;
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: "trip", label: "ต่อเที่ยว", unit: "บาท/เที่ยว" },
  { id: "km", label: "ต่อกิโลเมตร", unit: "บาท/กม." },
  { id: "tkm", label: "ต่อตัน-กม.", unit: "บาท/ตัน-กม." },
];
const money = (n: number | null, d = 2): string => (n === null ? "–" : fmt(n, d));
const dec = (n: number): string => fmt(n, 2);
/** คำแนะนำ → สีป้ายชุดเดียวกับแท็บการใช้ประโยชน์ของกองรถ */
const PILL: Record<CvpAdvice, string> = { part: "part", comp: "comp", tie: "only-comp", "only-comp": "only-comp", "only-part": "only-part" };
/** ความสูงกราฟแท่งนอนตามจำนวนแถว — dz-box สูงตายตัว 270px ไม่พอเมื่อชนิดรถเกือบยี่สิบชนิด */
const barsHeight = (rows: number, perRow = 34): number => Math.max(180, rows * perRow + 50);

export default function Part1({ trips, rows }: { trips: Trip[]; rows: VRow[] }) {
  const o = useMemo(() => overview(trips), [trips]);
  return <>
    <div className="dz-heroes">
      <Hero kind="cost" l="ต้นทุนรวม" v={fmt(o.cost)} unit="บาท" s="SUM(ต้นทุนรวม) ของปีที่เลือก" />
      <Hero kind="fleet" l="จำนวนเที่ยว" v={fmt(o.n)} s="เที่ยว · นับเลขที่ใบรายการ" />
      <Hero kind="svc" l="ต้นทุนเฉลี่ย/เที่ยว" v={fmt(o.perTrip)} unit="บาท" s="ต้นทุนรวม ÷ จำนวนเที่ยว" />
    </div>
    <div className="dz-cards">
      <KC dot={D.teal} l="ต้นทุนเฉลี่ย/กม." v={dec(o.perKm)} s={<>บาท/กม. · ไม่นับ {fmt(o.noKm)} เที่ยวที่ไม่มีระยะทาง</>} />
      <KC dot={D.violet} l="ต้นทุนเฉลี่ย/ตัน-กม." v={dec(o.perTkm)}
        s={<>บาท/ตัน-กม. · SUM ÷ SUM · ไม่นับ {fmt(o.noTkm)} เที่ยวที่ไม่มีระยะทางหรือน้ำหนัก</>} />
    </div>
    <KindChart rows={rows} />
    <RouteKind rows={rows} />
    <CompanyVsPartner rows={rows} />
  </>;
}

/* ---------------- ต้นทุนของรถแต่ละชนิด ---------------- */
function KindChart({ rows }: { rows: VRow[] }) {
  const [metric, setMetric] = useState<Metric>("km");
  const data = useMemo(() => kindSides(rows)
    .map((k) => ({ vk: k.vk, comp: metricOf(k.comp, metric), part: metricOf(k.part, metric) }))
    .filter((k) => k.comp !== null || k.part !== null)
    .sort((a, b) => Math.max(b.comp ?? 0, b.part ?? 0) - Math.max(a.comp ?? 0, a.part ?? 0)), [rows, metric]);
  const unit = METRICS.find((m) => m.id === metric)!.unit;
  return <div className="dz-cc" style={{ marginTop: 14 }}>
    <div className="fl-tophead">
      <div><h4>1. ต้นทุนของรถแต่ละชนิด · {unit}</h4>
        <p className="dz-note">GROUP BY ชนิดรถ, ประเภทรถ → SUM(ต้นทุน) ÷ SUM({metric === "trip" ? "เที่ยว" : metric === "km" ? "ระยะทาง" : "ตัน-กม."})</p></div>
      <div className="fl-toggle" role="group" aria-label="หน่วยต้นทุน">
        {METRICS.map((m) => <button key={m.id} type="button" className={metric === m.id ? "on" : ""}
          aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</button>)}
      </div>
    </div>
    {!data.length ? <p className="dz-note">ไม่มีข้อมูลตามปีที่เลือก</p> :
      <div className="dz-box" style={{ height: barsHeight(data.length, 40) }}>
        <DBar data={data} xKey="vk" horiz suffix={` ${unit}`} digits={2} valueTick={(n) => fmt(n, metric === "trip" ? 0 : 2)}
          series={[{ key: "comp", label: "รถบริษัท", color: COMP }, { key: "part", label: "รถร่วม", color: PART }]} />
      </div>}
    <Note>แยกรายคัน: หัวกับหางของใบเดียวกันเป็นคนละแถว ได้ต้นทุนของคันนั้นและน้ำหนัก/ระยะทางเต็มของใบ ·
      รถร่วมนอกพิเศษรวมในรถร่วม · ชนิดที่มีแท่งเดียวคือไม่มีอีกฝั่งให้เทียบ</Note>
  </div>;
}

/* ---------------- เส้นทาง × ชนิดรถ · Top 5 · Flag ---------------- */
interface MRow { rt: string; n: number; cells: Record<string, Cell> }
type Flag = ReturnType<typeof routeKindMatrix>["flagged"][number];

function RouteKind({ rows }: { rows: VRow[] }) {
  const m = useMemo(() => routeKindMatrix(rows), [rows]);
  const cols = useMemo<Col<MRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt, render: (r) => <b>{r.rt}</b> },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    ...m.kinds.map((vk): Col<MRow> => ({ key: `k:${vk}`, label: vk, num: true, get: (r) => r.cells[vk]?.avg ?? null,
      render: (r) => { const c = r.cells[vk]; return !c ? "–"
        : <span className={c.flag ? "d3-flag" : undefined} title={`${fmt(c.n)} เที่ยว · ${fmt(c.times, 1)} เท่าของค่าเฉลี่ย ${vk}`}>
          {dec(c.avg)}{c.flag && " ⚠"}</span>; } })),
  ], [m.kinds]);
  const top5 = useMemo(() => m.cheapest.slice(0, 5).map((c) => ({ label: `${c.rt} · ${c.vk}`, v: c.avg })), [m.cheapest]);
  const flagCols = useMemo<Col<Flag>[]>(() => [
    { key: "d", label: "วันที่", get: (f) => f.row.d, render: (f) => thDateSafe(f.row.d) },
    { key: "id", label: "เลขที่ใบรายการ", get: (f) => f.row.id, render: (f) => <span className="d3-tt-id">{f.row.id}</span> },
    { key: "rt", label: "เส้นทาง", get: (f) => f.row.rt },
    { key: "vk", label: "ชนิดรถ", get: (f) => f.row.vk, render: (f) => <span className="d3-tt-kind">{f.row.vk}</span> },
    { key: "pl", label: "ทะเบียน", get: (f) => f.row.pl || "–", render: (f) => <b>{f.row.pl || "–"}</b> },
    { key: "wt", label: "น้ำหนัก (ตัน)", get: (f) => f.row.wt, num: true, render: (f) => fmt(f.row.wt, 3) },
    { key: "v", label: "ต้นทุน/ตัน-กม.", get: (f) => f.row.perTkm, num: true, render: (f) => dec(f.row.perTkm!) },
    { key: "avg", label: "ค่าเฉลี่ยกลุ่ม", get: (f) => f.kindAvg, num: true, render: (f) => dec(f.kindAvg) },
    { key: "times", label: "เท่าของค่าเฉลี่ย", get: (f) => f.times, num: true,
      render: (f) => <span className="d3-tt-cov neg">{fmt(f.times, 1)}×</span> },
  ], []);
  const flaggedCells = useMemo(() => m.routes.reduce((s, r) => s + Object.values(r.cells).filter((c) => c.flag).length, 0), [m.routes]);

  return <>
    <D3Table title="2. เส้นทาง กับการใช้งานรถ · ต้นทุน/ตัน-กม." unit="เส้นทาง" rows={m.routes} cols={cols}
      initial={{ key: "n", dir: -1 }} rowKey={(r) => r.rt} empty="ไม่มีเที่ยวที่มีทั้งน้ำหนักและระยะทาง"
      search={(r) => [r.rt, ...Object.keys(r.cells)]} placeholder="ค้นหาเส้นทาง, ชนิดรถ…"
      note={<>ค่าในช่อง = AVG(ต้นทุน/ตัน-กม. รายเที่ยว) ของเส้นทาง × ชนิดรถ ·
        สีแดง ⚠ = เกิน {FLAG_TIMES} เท่าของค่าเฉลี่ยชนิดรถเดียวกัน ควรตรวจสอบเพิ่มเติม</>}
      legend={[[NEG, `⚠ เกิน ${FLAG_TIMES} เท่าของค่าเฉลี่ยชนิดรถ`]]}>
      <Note>ไม่นับ {fmt(m.excluded)} คัน-เที่ยวที่ไม่มีน้ำหนักหรือระยะทาง หรือต้นทุนของคันเป็น 0 ·
        ค่าเฉลี่ยรายเที่ยวไวต่อเที่ยวที่บรรทุกน้อยมาก (docs/หลักข้อ3.md ข้อ 4)</Note>
    </D3Table>

    <div className="dz-row dz-2" style={{ marginTop: 14 }}>
      <div className="dz-cc">
        <h4>3. เส้นทาง × ชนิดที่ต้นทุน/ตัน-กม. ถูกสุด (Top 5)</h4>
        {!top5.length ? <p className="dz-note">ไม่มีกลุ่มที่มีเที่ยวถึง {TOP_MIN_TRIPS} เที่ยว</p> :
          <div className="dz-box" style={{ height: barsHeight(top5.length, 46) }}>
            <DBar data={top5} xKey="label" horiz suffix=" บาท/ตัน-กม." digits={2} valueTick={dec} showValues
              series={[{ key: "v", label: "บาท/ตัน-กม.", color: D.emeraldLight }]} />
          </div>}
        <Note>นับเฉพาะกลุ่มที่มีอย่างน้อย {TOP_MIN_TRIPS} เที่ยว · แยกรายคัน หางมีต้นทุนแค่ค่าเสื่อม + ค่าซ่อม จึงมักติดอันดับถูกสุด</Note>
      </div>
      <div className="dz-cc">
        <h4>จุดที่ควรตรวจสอบ</h4>
        <div className="dz-cards" style={{ marginTop: 10 }}>
          <KC dot={D.rose} tone={m.flagged.length ? "bad" : undefined} l="เที่ยวที่ควร Flag" v={fmt(m.flagged.length)}
            s={<>คัน-เที่ยว · ต้นทุน/ตัน-กม. เกิน {FLAG_TIMES} เท่าของค่าเฉลี่ยชนิดรถ</>} />
          <KC dot={D.amber} l="ช่องที่ติด ⚠" v={fmt(flaggedCells)} s="ช่องเส้นทาง × ชนิดรถในตารางข้อ 2" />
        </div>
        <Note>เป็นสัญญาณให้ไปตรวจสอบเพิ่มเติม ไม่ได้ชี้ว่าผิดพลาดเสมอ — ส่วนใหญ่เป็นเที่ยวที่บิลมีน้ำหนักน้อยมาก</Note>
      </div>
    </div>

    <D3Table title="เที่ยวที่ควร Flag ให้ผู้บริหารตรวจสอบ" unit="คัน-เที่ยว" rows={m.flagged} cols={flagCols}
      initial={{ key: "times", dir: -1 }} rowKey={(f) => `${f.row.id}|${f.row.pl}`} empty="ไม่มีเที่ยวที่เกินเกณฑ์"
      search={(f) => [f.row.pl, f.row.rt, f.row.vk, f.row.id]} placeholder="ค้นหาทะเบียน, เส้นทาง…"
      legend={[[NEG, `เกิน ${FLAG_TIMES} เท่าของค่าเฉลี่ยชนิดรถ`]]} />
  </>;
}

/* ---------------- บริษัท vs ร่วม ตามชนิดรถ ---------------- */
type Cvp = ReturnType<typeof companyVsPartner>[number];

function CompanyVsPartner({ rows }: { rows: VRow[] }) {
  const list = useMemo(() => companyVsPartner(rows), [rows]);
  const cols = useMemo<Col<Cvp>[]>(() => [
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk, render: (r) => <span className="d3-tt-kind">{r.vk}</span> },
    { key: "n", label: "เที่ยวรวม", get: (r) => r.n, num: true },
    { key: "compKm", label: "ต้นทุน/กม. บริษัท", get: (r) => r.compKm, num: true, render: (r) => money(r.compKm) },
    { key: "partKm", label: "ต้นทุน/กม. ร่วม", get: (r) => r.partKm, num: true, render: (r) => money(r.partKm) },
    { key: "diff", label: "ส่วนต่าง", get: (r) => r.diff, num: true, render: (r) => r.diff === null ? "–"
      : <span className={`d3-tt-cov ${r.diff > 0 ? "neg" : "pos"}`}>{r.diff > 0 ? "▲" : "▼"} {pct(Math.abs(r.diff))}</span> },
    { key: "advice", label: "คำแนะนำ", get: (r) => r.advice,
      render: (r) => <span className={`fu-pill ${PILL[r.advice]}`}>{CVP_LABEL[r.advice]}</span> },
  ], []);
  const both = useMemo(() => list.filter((k) => k.compKm !== null && k.partKm !== null).sort((a, b) => b.n - a.n), [list]);
  const [pick, setPick] = useState("");
  const cur = list.find((k) => k.vk === pick) ?? both[0] ?? list[0];

  return <>
    <D3Table title="4. บริษัท vs ร่วม ตามชนิดรถ · ต้นทุน/กม." unit="ชนิด" rows={list} cols={cols}
      initial={{ key: "n", dir: -1 }} rowKey={(r) => r.vk} empty="ไม่มีข้อมูลตามปีที่เลือก"
      search={(r) => [r.vk]} placeholder="ค้นหาชนิดรถ…"
      note="เทียบต้นทุน/กม. ของรถบริษัทกับรถร่วม ชนิดเดียวกัน — ดูว่าชนิดไหนควรใช้รถร่วมแทน"
      legend={[[NEG, "บริษัทแพงกว่ารถร่วม"], [POS, "บริษัทถูกกว่ารถร่วม"]]}>
      <Note>ต้นทุน/กม. แต่ละฝั่ง = รวมต้นทุนทุกเที่ยวในกลุ่ม ÷ รวมระยะทางทุกเที่ยว (ไม่เฉลี่ยค่ารายเที่ยว) · ส่วนต่าง = (บริษัท − ร่วม) ÷ ร่วม ·
        ต่างไม่เกิน {CVP_TIE_PCT}% ถือว่าใกล้เคียงกัน · รถร่วมนอกพิเศษรวมในรถร่วม</Note>
    </D3Table>
    {cur && <div className="dz-row dz-2" style={{ marginTop: 14 }}>
      <div className="dz-cc">
        <TableHead title={`ดูรายละเอียดตามชนิดรถ · ${cur.vk}`}>
          <ListFF label="ชนิดรถ" all="เลือกชนิดรถ" value={cur.vk} onChange={setPick} opts={list.map((k) => k.vk)} />
        </TableHead>
        <div className="dz-box" style={{ height: 180 }}>
          <DBar data={[{ side: "รถบริษัท", v: cur.compKm ?? 0 }, { side: "รถร่วม", v: cur.partKm ?? 0 }]} xKey="side" horiz
            colors={[COMP, PART]} series={[{ key: "v", label: "บาท/กม.", color: COMP }]} suffix=" บาท/กม." digits={2}
            valueTick={dec} showValues />
        </div>
      </div>
      <div className="dz-cc">
        <h4>สรุป · {cur.vk}</h4>
        <div className="dz-cards" style={{ marginTop: 10 }}>
          <KC dot={D.slateDeep} l="เที่ยวรวม" v={fmt(cur.n)} s="คัน-เที่ยว" />
          <KC dot={cur.diff === null ? D.slate : cur.diff > 0 ? D.rose : D.emeraldLight}
            tone={cur.diff === null ? undefined : cur.diff > CVP_TIE_PCT ? "bad" : cur.diff < -CVP_TIE_PCT ? "good" : "warn"}
            l="ส่วนต่าง บริษัท − ร่วม" v={cur.diff === null ? "–" : `${cur.diff > 0 ? "+" : "−"}${pct(Math.abs(cur.diff))}`}
            s={CVP_LABEL[cur.advice]} />
        </div>
        <Note>{cur.diff === null ? "ยังไม่มีอีกฝั่งให้เทียบ — ต้องมีทั้งรถบริษัทและรถร่วมชนิดเดียวกันจึงจะเทียบได้"
          : cur.diff > 0 ? `ต้นทุน/กม. ของรถบริษัทสูงกว่ารถร่วม ${pct(cur.diff)} — พิจารณาโอนงานไปรถร่วมเมื่อมีคิวว่าง`
          : `ต้นทุน/กม. ของรถบริษัทต่ำกว่ารถร่วม ${pct(-cur.diff)} — ควรใช้รถบริษัทชนิดนี้ก่อน`}</Note>
      </div>
    </div>}
  </>;
}
