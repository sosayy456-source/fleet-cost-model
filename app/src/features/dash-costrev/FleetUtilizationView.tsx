/**
 * เนื้อหาแท็บ "การใช้ประโยชน์ของกองรถ" — ดีไซน์ตามภาพที่เจ้าของงานส่ง 23 ก.ย. 2569
 *
 *   การ์ดหลัก 4 ใบ → การ์ดรอง 2 ใบ → **%การใช้งานเฉลี่ยต่อคัน · ระยะทางรวมทุกเที่ยว** →
 *   สัดส่วนประเภทรถในแต่ละกลุ่มบริการ → เส้นทาง 5 อันดับแรก (ซ้าย) + โดนัทประเภทรถ (ขวา) →
 *   ตารางสรุป เส้นทาง × กลุ่มบริการ × ชนิดรถ → **ตาราง %การใช้งานรายคัน (ท้ายสุด · เลื่อนในกล่อง)**
 *   การ์ดสองใบกับตารางรายคันย้ายมาจากเมนูแดชบอร์ด แท็บการใช้ประโยชน์กองรถ (เจ้าของงานสั่ง 24 ก.ย. 2569)
 *
 * แทนอันดับความคุ้มค่า/ชนิดรถ 10 อันดับของเดิมทั้งหมด · สูตรทุกตัวอยู่ใน lib/fleetcompare/utilization.ts
 * ★ ส่วนสัดส่วนนับ "เที่ยวของประเภทนั้น" ใบที่มีหัวกับหางคนละฝั่งนับทั้งสอง (ดูหัวข้อใน utilization.ts)
 */
import { useMemo, useState } from "react";
import { DDonut } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import {
  fleetKpis, fleetTypeShare, routeServiceKindTable, routeUsage, serviceFleetMix, USE_ADVICE_LABEL,
  type FleetSlice, type Share, type UseAdvice, type UseRow,
} from "../../lib/fleetcompare/utilization";
import { Hero, KC, Note } from "../dash-fleet/parts";
import { duniq, fmt, ListFF, marginTone, Meter, pct, signed, SortTable, useSort, type Col } from "./common";
import TripsModal from "../dash-demo/TripsModal";
import type { Trip } from "../../lib/data/useCostRev";
import type { VehicleUseRow } from "../../lib/fleetcompare/vehicleUse";
import { thDateSafe } from "../../lib/record/date";

/** ผลของ %การใช้งานรายคัน — FleetTab คิดให้ (ต้องใช้ทะเบียนรถกับตัวกรองของแท็บ) */
export interface FleetUse { vehicles: VehicleUseRow[]; avg: number; km: number; noKm: number; to: string }

/** สีประเภทรถ — ตรงกับภาพ: บริษัทคราม · ร่วมเขียวน้ำทะเล · ร่วมนอกพิเศษเหลืองอำพัน */
const FT_COLOR: Record<string, string> = { "รถบริษัท": D.indigo, "รถร่วม": D.teal, "รถร่วมนอกพิเศษ": D.amber };
const ftColor = (ft: string): string => FT_COLOR[ft] ?? D.slate;
/** สีชนิดรถในแต่ละเส้นทาง 3 ชนิดแรก + อื่น ๆ */
const KIND_COLORS = [D.indigo, D.teal, D.amber];
/** สีแถบของเส้นทางแต่ละอันดับ */
const ROUTE_COLORS = [D.indigo, D.teal, D.amber, D.violet, D.cyan];
const TOP_ROUTES = 5;

/**
 * @param trips เที่ยวตามตัวกรองระดับใบของแท็บ — ใช้แสดงรายการในป็อปอัปเส้นทางเท่านั้น
 *              ส่วนว่าเที่ยวไหนอยู่ในเส้นทางนั้น ดูจาก `ids` ของ routeUsage ซึ่งผ่านตัวกรองระดับรถแล้ว
 */
export default function FleetUtilizationView({ rows, trips, use }: { rows: FleetSlice[]; trips: Trip[]; use: FleetUse }) {
  const [openRt, setOpenRt] = useState<string | null>(null);
  const kpi = useMemo(() => fleetKpis(rows), [rows]);
  const mix = useMemo(() => serviceFleetMix(rows), [rows]);
  const routes = useMemo(() => routeUsage(rows), [rows]);
  const types = useMemo(() => fleetTypeShare(rows), [rows]);
  const top = routes.slice(0, TOP_ROUTES);
  const topTrips = top.reduce((sum, r) => sum + r.n, 0);
  const typeTotal = types.reduce((sum, r) => sum + r.n, 0);
  const openTrips = useMemo(() => {
    const ids = new Set(routes.find((r) => r.rt === openRt)?.ids ?? []);
    return ids.size ? trips.filter((t) => ids.has(t.id)) : [];
  }, [routes, openRt, trips]);

  return <>
    <div className="dz-heroes fleet-util-heroes">
      <Hero kind="fleet" l="จำนวนรถที่ใช้งานจริง" v={fmt(kpi.vehicles)} s="คัน · นับทะเบียนไม่ซ้ำ" />
      <Hero kind="rev" l="จำนวนเที่ยววิ่งรวม" v={fmt(kpi.n)} s="เที่ยว · นับเลขที่ใบรายการไม่ซ้ำ" />
      <Hero kind="svc" l="อัตราหมุนรอบรถเฉลี่ย" v={fmt(kpi.turnover, 1)} s="เที่ยว/คัน · เที่ยวรวม ÷ รถที่ใช้งาน" />
      <Hero kind={kpi.profitPerVehicle < 0 ? "loss" : "profit"} l="กำไรเฉลี่ยต่อคัน"
        v={signed(kpi.profitPerVehicle)} s="บาท/คัน · กำไรรวม ÷ รถที่ใช้งาน" />
    </div>
    <div className="fleet-util-secondary">
      <KC dot={D.rose} l="รถที่ขาดทุนสะสม" v={`${fmt(kpi.lossVehicles)} คัน`}
        s="รถที่มีเดือนกำไรสุทธิติดลบ · เลือกหลายเดือน รถหนึ่งคันนับครั้งเดียว" />
      <KC dot={D.amber} l="สัดส่วนเที่ยวขาดทุน" v={pct(kpi.lossPct)}
        s="เที่ยวที่กำไรสุทธิติดลบ ÷ เที่ยวทั้งหมด" />
    </div>
    <div className="fleet-util-secondary fu-use">
      {/* Meter ไม่ใช่ KC — แถบยาวตามค่าจริง (KC วาดแถบเต็มเสมอ ค่า 2% จะดูเหมือน 100%) */}
      <Meter dot={D.teal} l="%การใช้งานเฉลี่ยต่อคัน" v={`${use.avg}%`}
        s="วันที่มีเที่ยว ÷ วันที่พร้อมใช้งาน · เฉลี่ยเฉพาะรถบริษัท + รถร่วม" fill={use.avg} />
      <KC dot={D.violet} l="ระยะทางรวมทุกเที่ยว" v={fmt(use.km)}
        s={use.noKm ? `กม. · ไม่รวม ${fmt(use.noKm)} เที่ยวที่ยังไม่มีระยะทางในตารางเส้นทาง` : "กม."} />
    </div>

    <div className="dz-cc fu-card">
      <h4>สัดส่วนการใช้รถในแต่ละกลุ่มบริการ</h4>
      <p className="dz-note">สัดส่วนเที่ยวแยกตามประเภทรถ เพื่อใช้ประกอบการตัดสินใจจัดรถ</p>
      {!mix.length ? <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p> : (
        <div className="fu-mix">
          {mix.map((g) => <div key={g.service} className="fu-mix-col">
            <div className="fl-shead"><b>{g.service}</b><span>{fmt(g.n)} เที่ยว</span></div>
            <ShareBar parts={g.types} colorOf={ftColor} />
            <ShareLegend parts={g.types} colorOf={ftColor} />
            <p className="fu-main">ใช้{g.main}เป็นหลัก</p>
          </div>)}
        </div>
      )}
    </div>

    <div className="dz-row dz-2 fu-row">
      <div className="dz-cc">
        <h4>เส้นทางที่มีเที่ยววิ่งมากที่สุด · {TOP_ROUTES} อันดับแรก</h4>
        {!top.length ? <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p> : (
          <ol className="fu-routes">{top.map((r, i) => {
            const kinds = collapse(r.kinds, KIND_COLORS.length, "ชนิดอื่น ๆ");
            return <li key={r.rt} role="button" tabIndex={0} title="กดเพื่อดูทุกเที่ยวของเส้นทางนี้"
              onClick={() => setOpenRt(r.rt)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenRt(r.rt); } }}>
              <div className="fu-rhead"><span className="fu-rno">{i + 1}</span><b>{r.rt}</b>
                <span className="fu-rn">{fmt(r.n)} <small>เที่ยว</small></span></div>
              <div className="fl-rbar fat"><i style={{ width: `${r.n / top[0]!.n * 100}%`, background: ROUTE_COLORS[i] }} /></div>
              <ShareLegend parts={kinds} colorOf={(k) => kindColor(kinds, k)} />
            </li>;
          })}</ol>
        )}
        <p className="dz-note">หน่วย: เที่ยว · {fmt(top.length)} เส้นทางรวม {fmt(topTrips)} เที่ยว ·
          คิดเป็น {pct(kpi.n ? topTrips / kpi.n * 100 : 0)} ของเที่ยวทั้งหมด · จากทั้งหมด {fmt(routes.length)} เส้นทาง ·
          กดเส้นทางเพื่อดูทุกเที่ยว</p>
      </div>
      <div className="dz-cc">
        <h4>สัดส่วนการใช้รถแต่ละประเภท</h4>
        <p className="dz-note">รวม {fmt(typeTotal)} เที่ยว ในช่วงเวลาที่เลือก</p>
        {!types.length ? <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p> : <>
          <DDonut data={types.map((t) => ({ name: t.key, v: t.n }))} colors={types.map((t) => ftColor(t.key))}
            suffix=" เที่ยว" center={<><b>{fmt(typeTotal)}</b><span>เที่ยว</span></>} />
          <ul className="fu-dlegend">{types.map((t) => <li key={t.key}>
            <span><i style={{ background: ftColor(t.key) }} />{t.key}</span>
            <b>{pct(t.share, 0)} · {fmt(t.n)} เที่ยว</b>
          </li>)}</ul>
        </>}
        {typeTotal > kpi.n && <p className="dz-note">ใบที่มีรถหลายประเภท (เช่น หัวรถบริษัท + หางรถร่วม) นับในทุกประเภทที่มี
          ยอดรวมจึงมากกว่าจำนวนเที่ยว {fmt(kpi.n)} เที่ยวในการ์ดด้านบน</p>}
      </div>
    </div>

    <UseTable rows={rows} />
    <VehicleUseTable use={use} />
    {openRt && <TripsModal rt={openRt} trips={openTrips} onClose={() => setOpenRt(null)}
      note="ทุกเที่ยวของเส้นทางนี้ตามตัวกรองของแท็บ" />}
  </>;
}

/** ตัดเหลือ n อันดับแรก ที่เหลือรวมเป็นก้อนเดียว — ร้อยละยังรวมได้ 100 */
function collapse(parts: Share[], n: number, otherLabel: string): Share[] {
  if (parts.length <= n + 1) return parts;
  const rest = parts.slice(n);
  return [...parts.slice(0, n), { key: otherLabel, n: rest.reduce((s, r) => s + r.n, 0),
    share: rest.reduce((s, r) => s + r.share, 0) }];
}
const kindColor = (parts: Share[], key: string): string => {
  const i = parts.findIndex((p) => p.key === key);
  return i >= 0 && i < KIND_COLORS.length ? KIND_COLORS[i]! : D.slateDeep;
};

function ShareBar({ parts, colorOf }: { parts: Share[]; colorOf: (key: string) => string }) {
  return <div className="fl-stack" role="img" aria-label={parts.map((p) => `${p.key} ${pct(p.share, 0)}`).join(" · ")}>
    {parts.map((p) => <span key={p.key} title={`${p.key}: ${fmt(p.n)} เที่ยว (${pct(p.share)})`}
      style={{ width: `${p.share}%`, background: colorOf(p.key) }} />)}
  </div>;
}

function ShareLegend({ parts, colorOf }: { parts: Share[]; colorOf: (key: string) => string }) {
  return <div className="fl-legend fu-legend">{parts.map((p) => <span key={p.key}>
    <i style={{ background: colorOf(p.key) }} />{p.key} <b>{pct(p.share, 0)}</b>
  </span>)}</div>;
}

const ADVICE_ORDER: UseAdvice[] = ["comp", "part", "only-comp", "only-part"];
const T0 = { rt: "", service: "", vk: "", advice: "" };

/** ตารางสรุป เส้นทาง × กลุ่มบริการ × ชนิดรถ — ตัวกรองของตารางเอง แยกจากแถบกรองของแท็บ */
function UseTable({ rows }: { rows: FleetSlice[] }) {
  const [f, setF] = useState(T0);
  const set = (key: keyof typeof T0) => (value: string) => setF((cur) => ({ ...cur, [key]: value }));
  const all = useMemo(() => routeServiceKindTable(rows), [rows]);
  const shown = useMemo(() => all.filter((r) => (!f.rt || r.rt === f.rt) && (!f.service || r.service === f.service)
    && (!f.vk || r.vk === f.vk) && (!f.advice || r.advice === f.advice)), [all, f]);

  const cols = useMemo<Col<UseRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt, render: (r) => <b className="fu-trt">{r.rt}</b> },
    { key: "service", label: "กลุ่มบริการ", get: (r) => r.service },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.vk },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "compShare", label: "รถบริษัท", get: (r) => r.compShare, num: true, render: (r) => pct(r.compShare, 0) },
    { key: "partShare", label: "รถร่วม", get: (r) => r.partShare, num: true, render: (r) => pct(r.partShare, 0) },
    { key: "compMargin", label: "Margin รถบริษัท", get: (r) => r.compMargin, num: true, render: (r) => <MarginCell m={r.compMargin} /> },
    { key: "partMargin", label: "Margin รถร่วม", get: (r) => r.partMargin, num: true, render: (r) => <MarginCell m={r.partMargin} /> },
    { key: "advice", label: "คำแนะนำ", get: (r) => ADVICE_ORDER.indexOf(r.advice),
      render: (r) => <span className={`fu-pill ${r.advice}`}>{USE_ADVICE_LABEL[r.advice]}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(shown, cols, { key: "n", dir: -1 });

  return <div className="dz-cc fu-card">
    <div className="fu-thead"><h4>ตารางสรุป · เส้นทาง × กลุ่มบริการ × ชนิดรถ</h4>
      <span className="dz-note">{fmt(shown.length)} รายการ</span></div>
    <p className="dz-note">เปรียบเทียบ Margin ของรถบริษัทและรถร่วมในแต่ละเส้นทางและชนิดรถ</p>
    <div className="dz-filters fu-tfilters">
      <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.rt} onChange={set("rt")} opts={duniq(all.map((r) => r.rt))} />
      <ListFF label="กลุ่มบริการ" all="ทั้งหมด" value={f.service} onChange={set("service")} opts={duniq(all.map((r) => r.service))} />
      <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(all.map((r) => r.vk))} />
      <ListFF label="คำแนะนำ" all="ทั้งหมด" value={f.advice} onChange={set("advice")}
        opts={ADVICE_ORDER.filter((a) => all.some((r) => r.advice === a))} labelOf={(a) => USE_ADVICE_LABEL[a as UseAdvice]} />
    </div>
    <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key}
      empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" className="fu-tbl" />
    <Note>คำแนะนำเลือกฝั่งที่ Margin สูงกว่า (กำไร ÷ รายได้ของเที่ยวที่ใช้รถฝั่งนั้น) · รถร่วมนอกพิเศษนับเป็นฝั่งรถร่วม ·
      กลุ่มที่มีรถวิ่งฝั่งเดียวเทียบไม่ได้ จึงบอกแค่ว่ามีฝั่งไหน · รถบริษัท/รถร่วม = สัดส่วนเที่ยวของแต่ละฝั่ง</Note>
  </div>;
}

function MarginCell({ m }: { m: number | null }) {
  return <span style={{ fontWeight: 700, color: marginTone(m) }}>{m == null ? "–" : pct(m)}</span>;
}

/**
 * ตาราง %การใช้งานรายคัน เทียบกับทะเบียนรถในกองรถ — ท้ายสุดของแท็บ เลื่อนในกล่อง (SortTable ใช้ GrowBox)
 * ทุกคันในทะเบียน รวมคันที่ไม่มีเที่ยว (0%) · สูตรอยู่ที่ lib/fleetcompare/vehicleUse.ts
 */
function VehicleUseTable({ use }: { use: FleetUse }) {
  const cols = useMemo<Col<VehicleUseRow>[]>(() => [
    { key: "plate", label: "ทะเบียนรถ", get: (r) => r.v.plate, render: (r) => <b>{r.v.plate}</b> },
    { key: "ft", label: "ประเภทรถ", get: (r) => r.v.fleetType || "–" },
    { key: "vk", label: "ชนิดรถ", get: (r) => r.v.vehicle || "–" },
    { key: "start", label: "เริ่มใช้งาน", get: (r) => r.v.start, render: (r) => thDateSafe(r.v.start) },
    { key: "status", label: "สถานะ", get: (r) => r.v.status || "–" },
    { key: "n", label: "จำนวนเที่ยว", get: (r) => r.n, num: true },
    { key: "km", label: "กม.รวม", get: (r) => r.km, num: true },
    { key: "activeDays", label: "วันที่ใช้งานจริง", get: (r) => r.activeDays, num: true },
    { key: "availDays", label: "วันพร้อมใช้งาน", get: (r) => r.availDays, num: true,
      render: (r) => (r.availDays == null ? "–" : fmt(r.availDays)) },
    { key: "pct", label: "%การใช้งาน", get: (r) => r.pct, num: true,
      render: (r) => <b>{r.pct == null ? "–" : `${r.pct}%`}</b> },
  ], []);
  const { sorted, sort, toggle } = useSort(use.vehicles, cols, { key: "pct", dir: -1 });
  return (
    <div className="dz-cc fu-card">
      <h4>%การใช้งานรายคัน (เทียบกับทะเบียนรถในกองรถ) · {fmt(use.vehicles.length)} คัน</h4>
      {/* vu-tbl: หัวคอลัมน์ตัดบรรทัดได้ — 10 คอลัมน์ ถ้าไม่ตัด คอลัมน์ %การใช้งานหลุดขอบขวา */}
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.v.plate}
        className="vu-tbl" empty="ไม่มีรถในทะเบียนตามตัวกรองที่เลือก" />
      <Note>
        %การใช้งาน = วันที่มีเที่ยววิ่งจริง (นับวันไม่ซ้ำ) ÷ วันที่พร้อมใช้งาน × 100 ·
        วันที่พร้อมใช้งานนับตั้งแต่วันเริ่มใช้งานในทะเบียน (หรือวันแรกของไฟล์ ถ้าเริ่มก่อน) ถึงวันสุดท้ายที่ไฟล์ต้นทุนมีข้อมูล
        ({thDateSafe(use.to)}) และนับเฉพาะปี/เดือนที่เลือก · รถที่ไม่มีเที่ยวเลยแสดง 0% · ไม่รู้วันเริ่มใช้งานแสดง – ·
        ใบที่มีหลายทะเบียน (หัว · คันที่ 2 · พ่วง) นับเที่ยวให้ทุกคัน ·
        ตารางแสดงทุกคันในทะเบียนรวมรถร่วมนอกพิเศษ แต่ค่าเฉลี่ยในการ์ดนับเฉพาะรถบริษัท + รถร่วม
      </Note>
    </div>
  );
}
