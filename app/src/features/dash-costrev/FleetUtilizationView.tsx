/** เนื้อหาแท็บกองรถตามเอกสาร พร้อมอันดับทั้งหมดในป็อปอัป */
import { useMemo, useState } from "react";
import { D } from "../../lib/chart/theme";
import { fleetDistribution, fleetKinds, fleetKpis, fleetRanking, type FleetGroup, type FleetSlice } from "../../lib/fleetcompare/utilization";
import FleetDetailDialog from "../../lib/ui/FleetDetailDialog";
import GrowBox from "../../lib/ui/GrowBox";
import { Hero, Note } from "../dash-fleet/parts";
import { fmt, pct, signed } from "./common";

const COLORS = [D.indigo, D.teal, D.amber, D.violet, D.cyan];
const tone = (profit: number) => profit >= 5000
  ? { label: "กำไรดี", cls: "good", color: D.emeraldLight }
  : profit >= 0 ? { label: "พอประมาณ", cls: "ok", color: D.orange }
  : { label: "ขาดทุน", cls: "loss", color: D.rose };
type Ranking = ReturnType<typeof fleetRanking>;

export default function FleetUtilizationView({ rows }: { rows: FleetSlice[] }) {
  const [mode, setMode] = useState<"trip" | "vehicle">("trip");
  const [modal, setModal] = useState<"ranking" | "kinds" | null>(null);
  const kpi = useMemo(() => fleetKpis(rows), [rows]);
  const ranking = useMemo(() => fleetRanking(rows, mode), [rows, mode]);
  const kinds = useMemo(() => fleetKinds(rows), [rows]);
  const distribution = useMemo(() => fleetDistribution(rows), [rows]);
  const topRank = useMemo(() => ranking.slice(0, 5), [ranking]);
  const topKinds = useMemo(() => kinds.slice(0, 10), [kinds]);
  const displayedTrips = topKinds.reduce((sum, row) => sum + row.n, 0);

  const toggle = <div className="fl-toggle" role="group" aria-label="หน่วยกำไรในการจัดอันดับ">
    <button type="button" className={mode === "trip" ? "on" : ""} aria-pressed={mode === "trip"}
      onClick={() => setMode("trip")}>กำไร/เที่ยว</button>
    <button type="button" className={mode === "vehicle" ? "on" : ""} aria-pressed={mode === "vehicle"}
      onClick={() => setMode("vehicle")}>กำไร/คัน</button>
  </div>;

  return <>
    <div className="dz-heroes fleet-util-heroes">
      <Hero kind="fleet" l="จำนวนรถที่ใช้งานจริง" v={fmt(kpi.vehicles)} s="คัน · นับทะเบียนไม่ซ้ำ" />
      <Hero kind="rev" l="จำนวนเที่ยววิ่งรวม" v={fmt(kpi.n)} s="เที่ยว · นับเลขที่ใบรายการไม่ซ้ำ" />
      <Hero kind="svc" l="อัตราหมุนรอบรถเฉลี่ย" v={fmt(kpi.turnover, 1)} s="เที่ยว/คัน · เที่ยวทั้งหมด ÷ รถที่ใช้งาน" />
      <Hero kind={kpi.profitPerVehicle < 0 ? "loss" : "profit"} l="กำไรเฉลี่ยต่อคัน"
        v={signed(kpi.profitPerVehicle)} s="บาท/คัน · กำไรรวม ÷ รถที่ใช้งาน" />
    </div>
    <div className="fleet-util-secondary">
      <div className="dz-cc"><h4>รถที่ขาดทุนสะสม</h4><b>{fmt(kpi.lossVehicles)} คัน</b>
        <p className="dz-note">นับรถที่กำไรสุทธิรวมรายเดือนติดลบ หากเลือกหลายเดือน รถหนึ่งคันนับครั้งเดียว</p></div>
      <div className="dz-cc"><h4>สัดส่วนเที่ยวที่ขาดทุน</h4><b>{pct(kpi.lossPct)}</b>
        <p className="dz-note">เที่ยวที่กำไรสุทธิติดลบ ÷ เที่ยวทั้งหมด · นับเลขที่ใบรายการไม่ซ้ำ</p></div>
    </div>

    <div className="dz-row dz-2" style={{ marginTop: 14 }}>
      <div className="dz-cc">
        <div className="fl-tophead"><div><h4>อันดับความคุ้มค่า · 5 อันดับแรก</h4>
          <p className="dz-note">ประเภทรถ · กลุ่มบริการ · เส้นทาง เรียงกำไรจากมากไปน้อย รวมกลุ่มขาดทุน</p></div>{toggle}</div>
        <RankingList rows={topRank} mode={mode} />
        <RankLegend />
        <button type="button" className="btn-ghost" disabled={!ranking.length} onClick={() => setModal("ranking")}>
          ดูอันดับทั้งหมด ({fmt(ranking.length)} กลุ่ม)
        </button>
      </div>
      <div className="dz-cc">
        <h4>สัดส่วนการใช้รถในแต่ละกลุ่มบริการ</h4>
        <p className="dz-note">5 ชนิดรถที่ใช้บ่อยที่สุดและอื่น ๆ · 100% ของเที่ยวในแต่ละกลุ่มบริการ</p>
        {!distribution.length && <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p>}
        {distribution.map((group) => {
          const top = group.kinds.slice(0, 5);
          const remaining = group.kinds.slice(5).reduce((sum, row) => sum + row.n, 0);
          const parts = [...top.map((row, i) => ({ label: row.key, n: row.n, color: COLORS[i] })),
            ...(remaining ? [{ label: "อื่น ๆ", n: remaining, color: D.slateDeep }] : [])];
          return <div key={group.service} className="fleet-service-group">
            <div className="fl-shead"><b>{group.service}</b><span>{fmt(group.n)} เที่ยว</span></div>
            <div className="fl-stack" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.n / group.n * 100)}`).join(" · ")}>
              {parts.map((p) => <span key={p.label} title={`${p.label}: ${fmt(p.n)} เที่ยว (${pct(p.n / group.n * 100)})`}
                style={{ width: `${p.n / group.n * 100}%`, background: p.color }} />)}
            </div>
            <div className="fl-legend">{parts.map((p) => <span key={p.label}>
              <i style={{ background: p.color }} />{p.label} <b>{pct(p.n / group.n * 100)}</b>
            </span>)}</div>
          </div>;
        })}
        <p className="dz-note">เที่ยวที่มีหลายกลุ่มบริการนับในแต่ละกลุ่มได้ จึงไม่ควรบวกจำนวนเที่ยวข้ามกลุ่มเทียบกับ KPI</p>
      </div>
    </div>

    <div className="dz-cc" style={{ marginTop: 14 }}>
      <h4>ชนิดรถที่ถูกใช้งานมากที่สุด · 10 อันดับแรก</h4>
      <KindList rows={topKinds} />
      <p className="dz-note">หน่วย: เที่ยว · รวมทั้งหมด {fmt(kpi.n)} เที่ยว ·
        อันดับที่แสดง {fmt(displayedTrips)} เที่ยว
        {kinds.length > 10 && <> · อีก {fmt(kinds.length - 10)} ชนิดรถอยู่ในรายละเอียด</>}</p>
      <button type="button" className="btn-ghost" disabled={!kinds.length} onClick={() => setModal("kinds")}>
        ดูรายละเอียดทุกชนิดรถ ({fmt(kinds.length)} ชนิด)
      </button>
    </div>
    <Note>รายได้รวมและเส้นทางใช้แหล่งเดิม กลุ่มบริการมาจากบิลรายได้ ·
      เลือกกลุ่มบริการแล้วกำไรที่แสดงเป็นส่วนของกลุ่มนั้น · เกณฑ์กำไรดี/พอประมาณ/ขาดทุนอิงกำไรเฉลี่ยต่อเที่ยวเสมอ</Note>

    {modal === "ranking" && <FleetDetailDialog title="อันดับความคุ้มค่าทั้งหมด" onClose={() => setModal(null)}>
      <p className="dz-note">{fmt(ranking.length)} กลุ่ม · ใช้ตัวกรองเดียวกับหน้ากองรถ</p>
      {toggle}<RankLegend />
      <GrowBox rows={ranking} render={(shown) => <RankingList rows={shown} mode={mode} />} />
    </FleetDetailDialog>}
    {modal === "kinds" && <FleetDetailDialog title="รายละเอียดการใช้งานทุกชนิดรถ" onClose={() => setModal(null)}>
      <p className="dz-note">{fmt(kinds.length)} ชนิด · รวม {fmt(kpi.n)} เที่ยว · ใช้ตัวกรองเดียวกับหน้ากองรถ</p>
      <GrowBox rows={kinds} render={(shown) => <KindList rows={shown} />} />
    </FleetDetailDialog>}
  </>;
}

function RankLegend() {
  return <div className="fl-legend">
    <span><i style={{ background: D.emeraldLight }} />กำไรดี ≥ 5,000 บาท/เที่ยว</span>
    <span><i style={{ background: D.orange }} />พอประมาณ 0 ถึงน้อยกว่า 5,000 บาท/เที่ยว</span>
    <span><i style={{ background: D.rose }} />ขาดทุน &lt; 0 บาท/เที่ยว</span>
  </div>;
}

function RankingList({ rows, mode }: { rows: Ranking; mode: "trip" | "vehicle" }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  if (!rows.length) return <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p>;
  return <ol className="fl-top">{rows.map((row, index) => {
    const color = tone(row.perTrip);
    return <li key={row.key}>
      <div className="fl-tname"><span className="fl-tno">{index + 1}</span><b>{row.label}</b>
        <span className={`fl-tbadge ${color.cls}`}>{color.label}</span>
        <span className="fl-tval" style={{ color: color.color }}>
          {mode === "vehicle" && !row.vehicles ? "ไม่ระบุทะเบียน" : `${signed(row.value)} ฿`}
        </span>
      </div>
      <div className="fl-rbar fat"><i style={{ width: `${Math.abs(row.value) / max * 100}%`, background: color.color }} /></div>
      <div className="fl-tsub">{fmt(row.n)} เที่ยว · {fmt(row.vehicles)} คัน
        {mode === "vehicle" && <> · เฉลี่ย {signed(row.perTrip)} บาท/เที่ยว</>}</div>
    </li>;
  })}</ol>;
}

function KindList({ rows }: { rows: FleetGroup[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p>;
  return <ol className="fl-rank wide">{rows.map((row, index) => <li key={row.key}>
    <span className="fl-badge">{index + 1}</span>
    <div className="fl-rmain"><div className="fl-rname"><b>{row.key}</b></div>
      <div className="fl-rbar"><i style={{ width: `${row.n / max * 100}%`, background: COLORS[index % COLORS.length] }} /></div>
    </div>
    <div className="fl-rval"><b>{fmt(row.n)} <small>เที่ยว</small></b>
      <small style={{ color: row.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(row.profit)} บาท</small></div>
  </li>)}</ol>;
}
