/**
 * รถบริษัท vs รถร่วม · ต้นทุนต่อเที่ยว ในเส้นทางเดียวกัน ชนิดรถเดียวกัน — ส่วนหนึ่งของแท็บกองรถ
 * (ตัดสินจากต้นทุน กำไรเป็นแค่บรรทัดประกอบ — เหตุผลอยู่หัวไฟล์ lib/fleetcompare/compare.ts)
 *
 * ตรรกะอยู่ใน lib/fleetcompare/compare.ts · ที่นี่แค่เลือกเกณฑ์ขั้นต่ำและแสดงผล
 * ตั้งใจวางใต้การ์ด "สัดส่วนเที่ยวตามประเภทรถ" เพราะการ์ดนั้นเป็นค่าเฉลี่ยรวมที่เส้นทางปนกัน
 * ส่วนนี้ตอบคำถามเดียวกันแบบเทียบงานเดียวกัน
 */
import { useMemo, useState } from "react";
import { compareSides } from "../../lib/fleetcompare/compare";
import type { PairRow, SideStat } from "../../lib/fleetcompare/compare";
import { D } from "../../lib/chart/theme";
import { Note } from "../dash-fleet/parts";
import { SortTable, fmt, pct, signed, useSort } from "./common";
import type { Col } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

const MIN_OPTS = [2, 3, 5] as const;
const COMP = D.indigo;
const PART = D.teal;
const CHEAPER = {
  comp: { label: "รถบริษัท", color: COMP },
  part: { label: "รถร่วม", color: PART },
  tie: { label: "พอ ๆ กัน", color: "var(--d-ink5)" },
} as const;

/** ตัวเลขหลัก = ต้นทุน/เที่ยว · บรรทัดเล็ก = จำนวนเที่ยว · กำไร/เที่ยว (อัตรากำไร) */
function SideCell({ s, win }: { s: SideStat; win: boolean }) {
  return (
    <div className="sc-side">
      <b style={{ color: win ? "var(--d-emerald-d)" : undefined }}>{fmt(Math.round(s.costPerTrip))}</b>
      <small>
        {fmt(s.n)} เที่ยว · กำไร{" "}
        <span style={{ color: s.perTrip < 0 ? "var(--d-rose-d)" : undefined }}>{signed(Math.round(s.perTrip))}</span>
        {s.margin != null && ` (${pct(s.margin, 0)})`}
      </small>
    </div>
  );
}

export default function SideCompare({ trips, ftFiltered }: { trips: Trip[]; ftFiltered: boolean }) {
  const [min, setMin] = useState<number>(3);
  const res = useMemo(() => compareSides(trips, min), [trips, min]);
  const s = res.summary;

  const cols = useMemo<Col<PairRow>[]>(() => [
    { key: "rt", label: "เส้นทาง · ชนิดรถ", get: (r) => `${r.rt} ${r.vk}`,
      render: (r) => <div className="sc-name"><b>{r.rt}</b><small>{r.vk}</small></div> },
    { key: "share", label: "สัดส่วนเที่ยว บริษัท : ร่วม", get: (r) => r.compShare,
      render: (r) => (
        <div className="sc-mix">
          <div className="bar" role="img" aria-label={`รถบริษัท ${pct(r.compShare * 100, 0)} รถร่วม ${pct((1 - r.compShare) * 100, 0)}`}>
            <i style={{ width: `${r.compShare * 100}%`, background: COMP }} />
            <i style={{ width: `${(1 - r.compShare) * 100}%`, background: PART }} />
          </div>
          <div className="t">
            <b style={{ color: COMP }}>{pct(r.compShare * 100, 0)}</b> : <b style={{ color: PART }}>{pct((1 - r.compShare) * 100, 0)}</b>
          </div>
          <small>{pct(r.tripShare * 100, 1)} ของเที่ยวทั้งหมด</small>
        </div>
      ) },
    { key: "comp", label: "รถบริษัท ต้นทุน/เที่ยว", num: true, get: (r) => r.comp.costPerTrip,
      render: (r) => <SideCell s={r.comp} win={r.cheaper === "comp"} /> },
    { key: "part", label: "รถร่วม ต้นทุน/เที่ยว", num: true, get: (r) => r.part.costPerTrip,
      render: (r) => <SideCell s={r.part} win={r.cheaper === "part"} /> },
    // ส่วนต่างอยู่ใต้ป้ายในคอลัมน์เดียวกัน — แยกคอลัมน์แล้วตารางกว้างเกินกล่องจนคอลัมน์ท้ายโดนตัด
    { key: "cheaper", label: "ต้นทุนถูกกว่า", get: (r) => Math.abs(r.diff),
      render: (r) => (
        <div className="sc-verdict">
          <span className={"sc-win" + (r.cheaper === "tie" ? " tie" : "")} style={{ "--c": CHEAPER[r.cheaper].color } as React.CSSProperties}>
            <i />{CHEAPER[r.cheaper].label}
          </span>
          <small>ต่าง {fmt(Math.abs(r.diff))} ฿/เที่ยว</small>
        </div>
      ) },
    { key: "gap", label: "ประหยัดได้รวม", num: true, get: (r) => r.gap,
      render: (r) => (r.gap ? fmt(r.gap) : <span style={{ color: "var(--d-ink5)" }}>–</span>) },
  ], []);
  const { sorted, sort, toggle } = useSort(res.rows, cols, { key: "gap", dir: -1 });

  const covered = s.totalTrips ? s.coveredTrips / s.totalTrips * 100 : 0;

  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <div className="sc-head">
        <div>
          <h4 style={{ margin: 0 }}>รถบริษัท vs รถร่วม · ฝั่งไหนต้นทุนถูกกว่า</h4>
          <p className="dz-note" style={{ margin: "4px 0 0" }}>
            ต้นทุนเฉลี่ยต่อเที่ยว เทียบเฉพาะเส้นทางเดียวกัน ชนิดรถเดียวกัน — ดูต้นทุนเพราะรายได้มาจากงาน ไม่ได้มาจากรถ
          </p>
        </div>
        <div className="fl-toggle" role="group" aria-label="เที่ยวขั้นต่ำต่อฝั่ง">
          {MIN_OPTS.map((m) => (
            <button key={m} type="button" className={min === m ? "on" : ""} onClick={() => setMin(m)}>≥ {m} เที่ยว/ฝั่ง</button>
          ))}
        </div>
      </div>

      {ftFiltered ? (
        <p className="dz-note">ตัวกรอง "ประเภทรถ" เลือกไว้ฝั่งเดียว — ล้างตัวกรองนั้นก่อนถึงจะเทียบสองฝั่งได้</p>
      ) : (
        <>
          <div className="sc-sum">
            <div><span>เทียบได้</span><b>{fmt(res.rows.length)}</b><small>เส้น · {fmt(s.coveredTrips)} เที่ยว ({pct(covered, 0)} ของเที่ยวทั้งหมด)</small></div>
            <div><span><i style={{ background: COMP }} />รถบริษัทถูกกว่า</span><b>{fmt(s.compCheaper)}</b><small>เส้น</small></div>
            <div><span><i style={{ background: PART }} />รถร่วมถูกกว่า</span><b>{fmt(s.partCheaper)}</b><small>เส้น</small></div>
            <div><span>พอ ๆ กัน</span><b>{fmt(s.tie)}</b><small>เส้น · ต่างไม่ถึง 5% ของต้นทุน/เที่ยว</small></div>
          </div>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key}
            empty={`ไม่มีเส้นทางที่ทั้งสองฝั่งวิ่งถึง ${min} เที่ยวตามตัวกรองที่เลือก — ลองลดเกณฑ์หรือเลือกช่วงเวลากว้างขึ้น`} />
          <Note>
            เทียบไม่ได้ {fmt(s.oneSided)} คู่ เส้นทาง × ชนิดรถ เพราะมีรถวิ่งฝั่งเดียว และอีก {fmt(s.tooFew)} คู่ที่มีสองฝั่งแต่เที่ยวไม่ถึงเกณฑ์ ·
            ชนิดรถที่มีทั้งรถบริษัทและรถร่วม {fmt(s.sharedKinds)} จาก {fmt(s.kinds)} ชนิด ·
            <b> ประหยัดได้รวม</b> = ส่วนต่างต้นทุน ฿/เที่ยว × จำนวนเที่ยวของฝั่งที่แพงกว่า (ช่วงเวลาที่กรอง) ถ้าย้ายงานได้จริง —
            ยังไม่ได้ดูว่ามีรถอีกฝั่งว่างรับงานหรือไม่ ·
            บรรทัดเล็กใต้ต้นทุน = จำนวนเที่ยว · กำไรต่อเที่ยว (อัตรากำไร) ไว้ดูประกอบ ไม่ได้ใช้ตัดสิน ·
            สัดส่วนเที่ยว = เที่ยวของแต่ละฝั่งในเส้นนั้น (ใช้รถจริงแบบไหนมากแค่ไหน) · "% ของเที่ยวทั้งหมด" = เส้นนั้นใหญ่แค่ไหนเทียบกับทุกเที่ยวในตัวกรอง ·
            รถร่วม รวมรถร่วมนอกพิเศษ · ไม่รวมเที่ยววิ่งเปล่า · ต้นทุน = คอลัมน์ต้นทุนของไฟล์ (ไฟล์ที่ไม่มีค่าเสื่อม ต้นทุนรถบริษัทจะต่ำกว่าจริง)
          </Note>
        </>
      )}
    </div>
  );
}
