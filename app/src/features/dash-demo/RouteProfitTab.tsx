/**
 * แท็บ "กำไรรายเส้นทาง" ของเมนู Demo — ลำดับการแสดงผลตามที่เจ้าของงานสั่ง (21 ก.ย. 2569)
 *
 *   1. การ์ดเด่น 3 ใบ  **กำไร (ใบใหญ่สุด)** · รายได้รวม · ต้นทุนรวม — เจ้าของงานสั่งสลับ 24 ก.ย. 2569
 *                      ใบแรกกว้างกว่าเพราะกฎ 1.35fr ของ .dz-heroes ใน index.css
 *   2. การ์ดย่อย 8 ใบ  **%Margin** · จำนวนบิล · จำนวนเที่ยว · จำนวนลูกค้า
 *                      **%เที่ยวที่ขาดทุน** · กำไรเฉลี่ย/บิล · กำไรเฉลี่ย/เที่ยว · กำไรเฉลี่ย/ลูกค้า
 *                      (สองการ์ด % อยู่หัวแถว · กด %เที่ยวที่ขาดทุน = ป็อบอัพรายการเที่ยวที่ขาดทุนทั้งหมด)
 *   2b. การ์ดกำไรส่วนเกิน/ตัน-กม. 4 ใบ (23 ก.ย. 2569) — ชุด loadfactor/ ตามตัวกรอง ปี/เดือน/ประเภทรถ/ชนิดรถ ของหน้า
 *      (24 ก.ย. 2569 · เดิมตรึงเดือนล่าสุด) กดแล้วไป Executive Dashboard › แท็บ "กำไรส่วนเกิน/ตัน-กม." (dash-costrev/tonkm/)
 *   3. กราฟ รายได้/ต้นทุน/กำไร รายเดือน — **ตามตัวกรองปีด้วย** (ต่างจากแท็บกำไรรายเที่ยวของ
 *      Executive Dashboard ที่จงใจโชว์ทุกปีเสมอ)
 *   4. ดีไซน์ใหม่ 24 ก.ย. 2569 (ภาพที่เจ้าของงานส่ง): แผนที่เส้นทาง (ซ้าย · RouteMap.tsx ฝังแอปแผนที่ map/ ผ่าน
 *      iframe) · จัดอันดับกำไรต่อเที่ยว (ขวาบน) · รายละเอียดต้นทุนของเส้นทางที่เลือก (ขวาล่าง) พร้อมปุ่ม i ·
 *      แผนที่เปิดมาเปล่า กดแถวในตาราง = เส้นนั้นโผล่พร้อมรถหนึ่งคัน (ไม่ใช่ "5 เส้นทางกำไรสูงสุด" แล้ว)
 *   5. การ์ดอัตรากำไรตามกลุ่มบริการ 3 ใบ — กดแล้วไป Executive Dashboard (กราฟของจริงจะทำทีหลัง)
 *
 * ★ ชุดเที่ยว = จับคู่ได้ + เที่ยววิ่งเปล่า (inProfitScope ใน lib/data/useCostRev.ts — ผู้เรียกกรองมาให้)
 *   เที่ยวเปล่านับเข้า ต้นทุน · กำไร · จำนวนเที่ยว · %เที่ยวที่ขาดทุน แต่มีบิล 0 ลูกค้าว่าง กลุ่มบริการ "ไม่ระบุ"
 * ★ จำนวนบิล/ลูกค้ามาจากฟิลด์ bn/cus ที่ ETL เติมให้เฉพาะเที่ยวที่จับคู่บิลได้
 *   ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ) นับแบบไม่ซ้ำทั้งชุดที่กรองอยู่
 *   ไม่ใช่ผลบวกของแต่ละเที่ยว — ลูกค้าคนเดียวส่งของหลายเที่ยวต้องนับครั้งเดียว
 * ★ ตัวกรองเป็นของหน้า (DemoDash · filter.tsx) ไม่ใช่ของส่วนนี้แล้ว — Demo รวมเป็นหน้ายาวหน้าเดียว 24 ก.ย. 2569
 */
import { useMemo, useState } from "react";
import { DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { Hero, KC, Note, Pane } from "../dash-fleet/parts";
import {
  Meter, SortTable, fmt, groupBy, monthLabel, passBase, pct, signed, useSort,
} from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { passDemo } from "./filter";
import type { DemoFilter } from "./filter";
import ServicePanel from "./ServicePanel";
import TripsModal from "./TripsModal";
import { type MapRoute } from "./RouteMap";
import { CostBreakdown, RP, RouteMapCard, buildCostTree, useRouteEnds, type CostTree } from "./routeMapParts";
import TonKmDemoRow from "../dash-costrev/tonkm/TonKmDemoRow";
import type { Trip } from "../../lib/data/useCostRev";
// กลุ่มบริการของการ์ดท้ายหน้า + %Margin รายเส้นทาง — ชุดเดียวกับ Performance Index (Route & Service)
import { SERVICE_GROUPS, routeMargin } from "../../lib/pi/route";


// สี · กลุ่มต้นทุน · การ์ดแผนที่ อยู่ใน routeMapParts.tsx (ใช้ร่วมกับแผนที่เที่ยววิ่งเปล่าของ Overall Dashboard · 26 ก.ย. 2569)

interface RouteRow {
  rt: string; o: string; de: string; n: number; rev: number; cost: number; profit: number; perTrip: number;
  margin: number | null;
  /** อันดับตามกำไรต่อเที่ยว (มากไปน้อย) — คอลัมน์ # ของตารางจัดอันดับ คงที่ไม่ขยับตามการกดเรียงคอลัมน์อื่น */
  rank: number;
}

export default function RouteProfitTab({ trips, f }: { trips: Trip[]; f: DemoFilter }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  /** ป็อบอัพเที่ยวที่ขาดทุนทั้งหมด (กดการ์ด %เที่ยวที่ขาดทุน) */
  const [showLoss, setShowLoss] = useState(false);
  /** การ์ดกลุ่มบริการที่กางแผงอยู่ — กดซ้ำที่การ์ดเดิม = ปิด */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const rows = useMemo(() => trips.filter((t) => passDemo(t, f)), [trips, f]);

  /* ---------- 1–2. ยอดรวมและการ์ดย่อย ---------- */
  const kpi = useMemo(() => {
    const rev = rows.reduce((s, t) => s + t.rev, 0);
    const cost = rows.reduce((s, t) => s + t.cost, 0);
    const profit = rev - cost;
    const bills = rows.reduce((s, t) => s + t.bn, 0);
    // ลูกค้าไม่ซ้ำทั้งชุด ไม่ใช่ผลบวกรายเที่ยว
    const custs = new Set<string>();
    for (const t of rows) for (const c of t.cus) custs.add(c);
    const loss = rows.filter((t) => t.profit < 0).length;
    return {
      rev, cost, profit, bills, custs: custs.size, n: rows.length, loss,
      margin: rev ? profit / rev * 100 : 0,
      perBill: bills ? profit / bills : 0,
      perTrip: rows.length ? profit / rows.length : 0,
      perCust: custs.size ? profit / custs.size : 0,
      lossPct: rows.length ? loss / rows.length * 100 : 0,
    };
  }, [rows]);

  /** เที่ยวที่ขาดทุน — นิยามเดียวกับตัวเศษของ %เที่ยวที่ขาดทุน (กำไร < 0) */
  const lossTrips = useMemo(() => rows.filter((t) => t.profit < 0), [rows]);

  /* ---------- 3. กราฟรายเดือน (ตามตัวกรองทั้งหมด รวมปี) ---------- */
  const monthly = useMemo(() => groupBy(rows, (t) => t.mo)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({ mo: monthLabel(a.key), รายได้: Math.round(a.rev), ต้นทุน: Math.round(a.cost), กำไร: Math.round(a.profit) })),
    [rows]);

  /* ---------- 4. แผนที่ 5 เส้นทางกำไรสูงสุด + จัดอันดับกำไรต่อเที่ยว + รายละเอียดต้นทุน ---------- */
  const ends = useRouteEnds(rows);
  const byRoute = useMemo<RouteRow[]>(() => {
    const list = groupBy(rows, (t) => t.rt).map((a) => ({
      rt: a.key, ...(ends.get(a.key) ?? { o: "", de: "" }), n: a.n, rev: a.rev, cost: a.cost, profit: a.profit,
      perTrip: a.profit / a.n,
      // รายได้ 0 แล้วขาดทุน = เสียต้นทุนไปทั้งก้อนโดยไม่ได้อะไรกลับ → −100% (เจ้าของงานเลือก 21 ก.ย. 2569)
      // หารด้วยศูนย์ตรง ๆ ไม่ได้ · รายได้ 0 และไม่ขาดทุน (ต้นทุน 0 ด้วย) ยังเป็น null = "–"
      margin: routeMargin(a.rev, a.profit),
      rank: 0,
    }));
    [...list].sort((a, b) => b.perTrip - a.perTrip).forEach((r, i) => { r.rank = i + 1; });
    return list;
  }, [rows, ends]);

  /** ฐานของความยาวแท่ง — ค่าสัมบูรณ์มากสุดในชุดที่กรองอยู่ */
  const barMax = useMemo(() => Math.max(1, ...byRoute.map((r) => Math.abs(r.perTrip))), [byRoute]);

  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rank", label: "#", get: (r) => r.rank,
      render: (r) => <span className="rp-rank">{String(r.rank).padStart(2, "0")}</span> },
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt,
      render: (r) => <div className="rp-rt"><b>{r.rt}</b><small>{fmt(r.n)} เที่ยว</small></div> },
    { key: "perTrip", label: "กำไร/เที่ยว (บาท)", get: (r) => r.perTrip, num: true,
      render: (r) => (
        <div className="rp-val">
          <b style={r.perTrip < 0 ? { color: RP.loss } : undefined}>{signed(Math.round(r.perTrip))}</b>
          <span className="rp-track" aria-hidden="true">
            <i style={{ width: `${Math.abs(r.perTrip) / barMax * 100}%`, background: r.perTrip < 0 ? RP.loss : RP.profit }} />
          </span>
        </div>
      ) },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => <span className="rp-margin" style={{ color: r.margin != null && r.margin < 0 ? RP.loss : RP.profit }}>
        {r.margin == null ? "–" : pct(r.margin)}</span> },
  ], [barMax]);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "perTrip", dir: -1 });

  /**
   * เส้นบนแผนที่ = เฉพาะเส้นทางที่ผู้ใช้กดในตารางด้านขวา (เจ้าของงานกำหนด 24 ก.ย. 2569) — เปิดมายังไม่กด = แผนที่เปล่า
   * แม้การ์ดรายละเอียดจะแสดงแถวแรกของตารางไว้ก่อนก็ตาม · memo ด้วยต้นทาง/ปลายทาง ไม่งั้นเปลี่ยนตัวกรองแล้วแผนที่วาดเส้นเดิมซ้ำ
   */
  const pickedRow = useMemo(() => byRoute.find((r) => r.rt === picked) ?? null, [byRoute, picked]);
  const mapRoutes = useMemo<MapRoute[]>(() => (pickedRow && pickedRow.o && pickedRow.de
    ? [{ key: pickedRow.rt, from: pickedRow.o, to: pickedRow.de, profit: Math.round(pickedRow.profit),
        color: pickedRow.profit < 0 ? RP.loss : RP.profit }]
    : []), [pickedRow?.rt, pickedRow?.o, pickedRow?.de, pickedRow ? pickedRow.profit < 0 : null]);
  /** เส้นที่แผนที่วาดไม่ได้ (ชื่อจุดไม่มีพิกัดใน map/src/network.js หรือต้นทาง = ปลายทาง) */
  const [missing, setMissing] = useState<string[]>([]);


  // เส้นทางที่เลือกไว้หลุดจากตัวกรอง → กลับไปใช้แถวแรกของตาราง
  const detail = useMemo(
    () => byRoute.find((r) => r.rt === picked) ?? sorted[0] ?? null,
    [byRoute, picked, sorted]);
  const detailTrips = useMemo(
    () => (detail ? rows.filter((t) => t.rt === detail.rt) : []),
    [rows, detail]);
  /** ต้นทุนของเส้นทางที่เลือก แยกตามการจัดประเภท (ปกติ → ผันแปร/กึ่งผันแปร/คงที่/ค่าเช่า/อื่น ๆ · สูญเปล่า) */
  const costTree = useMemo(() => buildCostTree(detailTrips), [detailTrips]);

  /** เที่ยวสำหรับแผงกลุ่มบริการ — ตัวกรองแท็บทุกตัว ยกเว้นกลุ่มบริการ เพราะกราฟต้องวาดครบสามเส้น */
  const rowsNoSg = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);

  /* ---------- 5. อัตรากำไรตามกลุ่มบริการ (คิดตามตัวกรองด้านบน) ---------- */
  const groups = useMemo(() => SERVICE_GROUPS.map((g) => {
    const gs = rows.filter((t) => t.sg === g);
    const rev = gs.reduce((s, t) => s + t.rev, 0);
    const profit = gs.reduce((s, t) => s + t.profit, 0);
    return { name: g, n: gs.length, rev, profit, margin: rev ? profit / rev * 100 : null };
  }), [rows]);

  return (
    <>
      <Pane deps={[rows]}>
        {/* 1 */}
        <div className="dz-heroes">
          <Hero kind={kpi.profit < 0 ? "loss" : "profit"} l="กำไร" v={signed(kpi.profit)} unit="บาท" s="รายได้ – ต้นทุน = กำไร" />
          <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.rev)} unit="บาท" />
          <Hero kind="cost" l="ต้นทุนรวม" v={fmt(kpi.cost)} unit="บาท" />
        </div>

        {/* 2 — สองแถว แถวละ 4 ใบ */}
        <div className="dz-cards four">
          <Meter dot={D.emerald} bar={kpi.margin < 0 ? D.rose : D.emerald} tone={kpi.margin < 0 ? "bad" : "good"}
            l="%Margin" v={pct(kpi.margin)} s="กำไร ÷ รายได้" fill={Math.abs(kpi.margin)} />
          <KC dot={D.indigo} l="จำนวนบิล" v={fmt(kpi.bills)} s="บิล · ทุกบิลของใบรายการที่จับคู่ได้" />
          <KC dot={D.violet} l="จำนวนเที่ยว" v={fmt(kpi.n)} s="เที่ยว" />
          <KC dot={D.teal} l="จำนวนลูกค้า" v={fmt(kpi.custs)} s="ราย · ผู้จ่ายเงินไม่ซ้ำ" />
          <Meter dot={D.rose} bar={D.rose} tone={kpi.lossPct > 0 ? "bad" : "good"}
            l="%เที่ยวที่ขาดทุน" v={pct(kpi.lossPct)}
            s={kpi.loss ? `${fmt(kpi.loss)} เที่ยวขาดทุน ÷ เที่ยวทั้งหมด · กดดูรายการ` : "เที่ยวขาดทุน ÷ เที่ยวทั้งหมด"}
            fill={kpi.lossPct} onClick={kpi.loss ? () => setShowLoss(true) : undefined} />
          <KC dot={D.indigo} tone={kpi.perBill < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/บิล"
            v={signed(Math.round(kpi.perBill))} s="บาท ต่อบิล" />
          <KC dot={D.violet} tone={kpi.perTrip < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/เที่ยว"
            v={signed(Math.round(kpi.perTrip))} s="บาท ต่อเที่ยว" />
          <KC dot={D.teal} tone={kpi.perCust < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/ลูกค้า"
            v={signed(Math.round(kpi.perCust))} s="บาท ต่อลูกค้า" />
        </div>

        {/* 2b — กำไรส่วนเกิน/ตัน-กม. (ข้อมูลคนละชุด ไม่ตามตัวกรอง) */}
        <TonKmDemoRow f={f} />

        {/* 3 */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>เปรียบเทียบ รายได้ / ต้นทุน / กำไร · รายเดือน</h4>
          <div className="dz-box tall">
            <DLine data={monthly} xKey="mo" series={[
              { key: "รายได้", label: "รายได้", color: D.indigo },
              { key: "ต้นทุน", label: "ต้นทุน", color: D.rose },
              { key: "กำไร", label: "กำไร", color: D.emeraldLight },
            ]} />
          </div>
        </div>

        {/* 4 — ดีไซน์ที่เจ้าของงานส่ง 24 ก.ย. 2569: แผนที่ (ซ้าย) · จัดอันดับ + รายละเอียดต้นทุน (ขวา) */}
        {/* การ์ดเดียวสองคอลัมน์: แผนที่ (ลากเส้นแบ่งปรับความกว้างได้) | จัดอันดับ + รายละเอียด */}
        <RouteMapCard routes={mapRoutes} onMissing={setMissing}
          chip={pickedRow ? pickedRow.rt : "กดเส้นทางในตารางเพื่อดูบนแผนที่"} chipLoss={!!pickedRow && pickedRow.profit < 0}
          cantDraw={!!pickedRow && (missing.includes(pickedRow.rt) || !pickedRow.o || !pickedRow.de)}>
            <section className="rp-sec">
              <header className="rp-sh">
                <span className="rp-ico green" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7" /></svg>
                </span>
                <div className="rp-sht">
                  <h3>จัดอันดับกำไรต่อเที่ยว</h3>
                  <p>คลิกเส้นทางเพื่อดูรายละเอียดต้นทุน · กดซ้ำเพื่อเอาเส้นทางออกจากแผนที่</p>
                </div>
                <span className="rp-pill">บาท/เที่ยว</span>
              </header>
              <div className="rp-tblwrap">
                <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.rt}
                  empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" className="rp-tbl" maxHeight={300}
                  rowProps={(r) => ({
                    className: r.rt === detail?.rt ? "on" : undefined,
                    // กดแถวเดิมซ้ำ = ยกเลิก แผนที่กลับเป็นแผนที่เปล่า (เจ้าของงานขอ 24 ก.ย. 2569)
                    onClick: () => setPicked((p) => (p === r.rt ? null : r.rt)),
                    title: r.rt === picked ? "กดอีกครั้งเพื่อเอาเส้นทางออกจากแผนที่" : "กดเพื่อดูรายละเอียดต้นทุนและเส้นทางบนแผนที่",
                  })} />
              </div>
            </section>

            <section className="rp-sec">
              {detail ? <RouteDetail r={detail} tree={costTree} onList={() => setShowList(true)} />
                : <p className="rp-foot rp-pad">เลือกเส้นทางจากรายการด้านบน</p>}
            </section>
        </RouteMapCard>
        <Note>
          ปุ่ม <b>i</b> เปิดรายการทุกเที่ยวของเส้นทางนั้นตามตัวกรองด้านบน · ต้นทุนแยกตามการจัดประเภท: <b>ต้นทุนปกติ</b>
          (ผันแปร + กึ่งผันแปร + คงที่ + ค่าเช่า + อื่น ๆ) และ <b>ต้นทุนสูญเปล่า</b> ·
          % ของกำไรเทียบรายได้ · % ของต้นทุนแต่ละกลุ่มเทียบต้นทุนรวม · แนวเส้นบนแผนที่ตามทางหลวงหลักโดยประมาณ ไม่ใช่เส้นทาง GPS จริง
        </Note>

        {/* 5 */}
        <div className="dm-sgs">
          {groups.map((g, i) => (
            <button key={g.name} type="button"
              className={`dm-sg c${i + 1}` + (openGroup === g.name ? " open" : "")}
              aria-expanded={openGroup === g.name}
              onClick={() => setOpenGroup((p) => (p === g.name ? null : g.name))}
              title={openGroup === g.name ? "กดอีกครั้งเพื่อปิด" : "กดเพื่อดูกราฟและรายเส้นทางของกลุ่มนี้"}>
              <span className="l">อัตรากำไร · {g.name}</span>
              <span className="v">{g.margin == null ? "–" : pct(g.margin)}</span>
              <span className="s">{fmt(g.n)} เที่ยว · กำไร {signed(Math.round(g.profit))} บาท</span>
            </button>
          ))}
        </div>
        <Note>การ์ดกลุ่มบริการคิดตามตัวกรองด้านบน · กดการ์ดเพื่อกางกราฟกับรายเส้นทางของกลุ่มนั้น กดซ้ำเพื่อปิด</Note>
        {openGroup && <ServicePanel trips={rowsNoSg} groups={SERVICE_GROUPS} picked={openGroup} />}
      </Pane>

      {showList && detail && (
        <TripsModal rt={detail.rt} trips={detailTrips} onClose={() => setShowList(false)} />
      )}
      {showLoss && (
        <TripsModal rt="เที่ยวที่ขาดทุน" trips={lossTrips} onClose={() => setShowLoss(false)} showRoute
          note="ทุกเที่ยวที่กำไรติดลบ ตามตัวกรองที่เลือกอยู่ · เรียงขาดทุนมากสุดก่อน"
          initialSort={{ key: "profit", dir: 1 }} />
      )}
    </>
  );
}

/**
 * การ์ดรายละเอียดของเส้นทางที่เลือก (ขวาล่าง) — ตัวเลขต่อเที่ยวสามช่อง · แถบรายได้แบ่งเป็นกำไร + ต้นทุนแต่ละกลุ่ม ·
 * รายการกำไร/ต้นทุนรวม/กลุ่มต้นทุน (% ของกำไรเทียบรายได้ · % ของต้นทุนเทียบต้นทุนรวม) ตามภาพดีไซน์ 24 ก.ย. 2569
 * ★ ขาดทุน: แถบยาวเท่าต้นทุน (รายได้ไม่พอคลุม) ไม่มีท่อนกำไร · "อื่น ๆ" ติดลบได้ แถบวาดเฉพาะค่าบวก
 */
function RouteDetail({ r, tree, onList }: { r: RouteRow; tree: CostTree; onList: () => void }) {
  const per = (v: number) => fmt(Math.round(v / r.n));
  const loss = r.profit < 0;
  return (
    <>
      <header className="rp-sh rp-dh">
        <div className="rp-sht">
          <h3>{r.rt}</h3>
          <p>{fmt(r.n)} เที่ยว · {loss ? "ขาดทุนรวม" : "กำไรรวม"} {fmt(Math.round(Math.abs(r.profit)))} บาท</p>
        </div>
        <button type="button" className="rp-i" onClick={onList}
          title="ดูรายการทุกเที่ยวของเส้นทางนี้" aria-label="ดูรายการทุกเที่ยวของเส้นทางนี้">i</button>
      </header>
      <div className="rp-dbody">
        <div className="rp-stats">
          <div><span>รายได้/เที่ยว</span><b>{per(r.rev)}</b></div>
          <div><span>ต้นทุน/เที่ยว</span><b>{per(r.cost)}</b></div>
          <div className={loss ? "pf loss" : "pf"}><span>กำไร/เที่ยว</span><b>{signed(Math.round(r.perTrip))}</b></div>
        </div>
        <CostBreakdown tree={tree} n={r.n} cost={r.cost} />
      </div>
    </>
  );
}
