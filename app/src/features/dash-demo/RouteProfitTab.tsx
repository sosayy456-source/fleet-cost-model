/**
 * แท็บ "กำไรรายเส้นทาง" ของเมนู Demo — ลำดับการแสดงผลตามที่เจ้าของงานสั่ง (21 ก.ย. 2569)
 *
 *   1. การ์ดเด่น 3 ใบ  รายได้รวม · ต้นทุนรวม · กำไร (ชุดเดียวกับ Executive Dashboard)
 *   2. การ์ดย่อย 8 ใบ  จำนวนบิล · จำนวนเที่ยว · จำนวนลูกค้า · %Margin
 *                      กำไรเฉลี่ย/บิล · กำไรเฉลี่ย/เที่ยว · กำไรเฉลี่ย/ลูกค้า · %เที่ยวที่ขาดทุน
 *   3. กราฟ รายได้/ต้นทุน/กำไร รายเดือน — **ตามตัวกรองปีด้วย** (ต่างจากแท็บกำไรรายเที่ยวของ
 *      Executive Dashboard ที่จงใจโชว์ทุกปีเสมอ)
 *   4. ตารางกำไรระดับเที่ยววิ่ง (ซ้าย) + รายละเอียดเส้นทางที่เลือก (ขวา) พร้อมปุ่ม i เปิดรายการทุกเที่ยว
 *   5. การ์ดอัตรากำไรตามกลุ่มบริการ 3 ใบ — กดแล้วไป Executive Dashboard (กราฟของจริงจะทำทีหลัง)
 *
 * ★ จำนวนบิล/ลูกค้ามาจากฟิลด์ bn/cus ที่ ETL เติมให้เฉพาะเที่ยวที่จับคู่บิลได้
 *   ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ) นับแบบไม่ซ้ำทั้งชุดที่กรองอยู่
 *   ไม่ใช่ผลบวกของแต่ละเที่ยว — ลูกค้าคนเดียวส่งของหลายเที่ยวต้องนับครั้งเดียว
 */
import { useMemo, useState } from "react";
import { DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { Hero, KC, Note, Pane } from "../dash-fleet/parts";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import {
  BASE_F0, ListFF, Meter, SortTable, YearFF, duniq, fmt, groupBy, isFiltered, marginTone, monthLabel,
  passBase, pct, signed, useSort,
} from "../dash-costrev/common";
import type { BaseFilter, Col } from "../dash-costrev/common";
import ServicePanel from "./ServicePanel";
import TripsModal from "./TripsModal";
import { fixedOf, otherOf, semiOf, variableOf } from "../../lib/data/useCostRev";
import type { Trip } from "../../lib/data/useCostRev";

/** กลุ่มบริการที่ทำเป็นการ์ดท้ายหน้า — ชื่อต้องตรงกับ sg ที่ ETL เติมจากประเภทสินค้าในบิล */
const SERVICE_GROUPS = ["สินค้าทั่วไป", "สินค้าแช่เย็น", "สินค้าแช่แข็ง"] as const;

/**
 * กลุ่มต้นทุนตามเอกสาร "การจัดประเภทต้นทุนสำหรับ Dashboard" (ชุดเดียวกับแท็บต้นทุนของ Executive Dashboard)
 *   ต้นทุนทั้งหมด = ต้นทุนปกติ + ต้นทุนสูญเปล่า
 *   ต้นทุนปกติ    = ผันแปร (น้ำมัน+เบี้ยเลี้ยง+ค่าธรรมเนียม) + กึ่งผันแปร (ค่าซ่อม) + คงที่ (ค่าเสื่อม) + ค่าเช่า + อื่น ๆ
 */
interface CostPart { label: string; color: string; of: (t: Trip) => number; subs?: CostPart[] }
const COST_TREE: { group: string; parts: CostPart[] }[] = [
  { group: "ต้นทุนปกติ", parts: [
    { label: "ผันแปร", color: D.indigo, of: variableOf, subs: [
      // ★ ไฟล์มีคอลัมน์ย่อยของสามก้อนนี้เท่านั้น (น้ำมัน 5 · เบี้ยเลี้ยง 3 · ค่าธรรมเนียม 7)
      //   เจ้าของงานเลือกให้แสดงแค่สองชั้น จึงหยุดที่ระดับนี้ ไม่ลงรายก้อนย่อย (21 ก.ย. 2569)
      { label: "น้ำมัน", color: D.indigo, of: (t) => t.fuel },
      { label: "เบี้ยเลี้ยง", color: D.violet, of: (t) => t.allow },
      { label: "ค่าธรรมเนียม", color: D.teal, of: (t) => t.fee },
    ] },
    // ค่าซ่อมรวม / ค่าเสื่อม / ค่าเช่ารวม เป็นคอลัมน์เดียวในไฟล์ต้นฉบับ ไม่มีรายละเอียดย่อยให้แยก
    { label: "กึ่งผันแปร (ค่าซ่อม)", color: D.amber, of: semiOf },
    { label: "คงที่ (ค่าเสื่อม)", color: D.slateDeep, of: fixedOf },
    { label: "ค่าเช่า", color: D.cyan, of: (t) => t.rent },
    { label: "อื่น ๆ", color: D.slate, of: otherOf },
  ] },
  // สูญเปล่าในไฟล์ต้นฉบับมี 3 คอลัมน์ (น้ำมันนอกเส้นทาง · Fleet Card · รถวิ่งอ้อม) แต่ ETL รวมเป็นก้อนเดียว
  // เจ้าของงานเลือกให้ใช้ก้อนเดียวต่อ ไม่ต้องแก้ ETL
  { group: "ต้นทุนสูญเปล่า", parts: [
    { label: "สูญเปล่า", color: D.rose, of: (t) => t.waste },
  ] },
];

interface Filter extends BaseFilter { sg: string }
const F0: Filter = { ...BASE_F0, sg: "" };

interface RouteRow { rt: string; n: number; rev: number; cost: number; profit: number; perTrip: number; margin: number | null }

export default function RouteProfitTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<Filter>(F0);
  const set = (k: keyof Filter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const [picked, setPicked] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  /** การ์ดกลุ่มบริการที่กางแผงอยู่ — กดซ้ำที่การ์ดเดิม = ปิด */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const rows = useMemo(
    () => trips.filter((t) => passBase(t, f) && (!f.sg || (t.sg || "ไม่ระบุ") === f.sg)),
    [trips, f]);

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
      rev, cost, profit, bills, custs: custs.size, n: rows.length,
      margin: rev ? profit / rev * 100 : 0,
      perBill: bills ? profit / bills : 0,
      perTrip: rows.length ? profit / rows.length : 0,
      perCust: custs.size ? profit / custs.size : 0,
      lossPct: rows.length ? loss / rows.length * 100 : 0,
    };
  }, [rows]);

  /* ---------- 3. กราฟรายเดือน (ตามตัวกรองทั้งหมด รวมปี) ---------- */
  const monthly = useMemo(() => groupBy(rows, (t) => t.mo)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({ mo: monthLabel(a.key), รายได้: Math.round(a.rev), ต้นทุน: Math.round(a.cost), กำไร: Math.round(a.profit) })),
    [rows]);

  /* ---------- 4. ตารางรายเส้นทาง + แผงรายละเอียด ---------- */
  const byRoute = useMemo<RouteRow[]>(() => groupBy(rows, (t) => t.rt).map((a) => ({
    rt: a.key, n: a.n, rev: a.rev, cost: a.cost, profit: a.profit,
    perTrip: a.profit / a.n,
    // รายได้ 0 แล้วขาดทุน = เสียต้นทุนไปทั้งก้อนโดยไม่ได้อะไรกลับ → −100% (เจ้าของงานเลือก 21 ก.ย. 2569)
    // หารด้วยศูนย์ตรง ๆ ไม่ได้ · รายได้ 0 และไม่ขาดทุน (ต้นทุน 0 ด้วย) ยังเป็น null = "–"
    margin: a.rev ? a.profit / a.rev * 100 : a.profit < 0 ? -100 : null,
  })), [rows]);

  /** ฐานของความยาวแท่ง — ค่าสัมบูรณ์มากสุดในชุดที่กรองอยู่ */
  const barMax = useMemo(() => Math.max(1, ...byRoute.map((r) => Math.abs(r.perTrip))), [byRoute]);

  const cols = useMemo<Col<RouteRow>[]>(() => [
    { key: "rt", label: "เส้นทาง", get: (r) => r.rt,
      render: (r) => <div className="dm-rt"><b>{r.rt}</b><small>{fmt(r.n)} เที่ยว</small></div> },
    { key: "bar", label: "กำไรต่อเที่ยว (บาท)", get: (r) => r.perTrip,
      render: (r) => (
        <span className="dm-bar" aria-hidden="true">
          <i style={{ width: `${Math.abs(r.perTrip) / barMax * 100}%`,
                      background: r.perTrip < 0 ? "var(--d-rose)" : "var(--d-emerald)" }} />
        </span>
      ) },
    { key: "perTrip", label: "กำไรต่อเที่ยว", get: (r) => r.perTrip, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: r.perTrip < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(r.perTrip))}</span> },
    { key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>{r.margin == null ? "–" : pct(r.margin)}</span> },
  ], [picked, barMax]);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "perTrip", dir: -1 });

  // เส้นทางที่เลือกไว้หลุดจากตัวกรอง → กลับไปใช้แถวแรกของตาราง
  const detail = useMemo(
    () => byRoute.find((r) => r.rt === picked) ?? sorted[0] ?? null,
    [byRoute, picked, sorted]);
  const detailTrips = useMemo(
    () => (detail ? rows.filter((t) => t.rt === detail.rt) : []),
    [rows, detail]);
  /** ต้นทุนของเส้นทางที่เลือก แยกตามการจัดประเภท (ปกติ → ผันแปร/กึ่งผันแปร/คงที่/ค่าเช่า/อื่น ๆ · สูญเปล่า) */
  const costTree = useMemo(() => {
    const sum = (of: (t: Trip) => number) => detailTrips.reduce((s, t) => s + of(t), 0);
    return COST_TREE.map((g) => {
      const parts = g.parts
        .map((p) => ({
          ...p, v: sum(p.of),
          subs: (p.subs ?? []).map((c) => ({ ...c, v: sum(c.of) })).filter((c) => Math.abs(c.v) > 0.5),
        }))
        .filter((p) => Math.abs(p.v) > 0.5);
      return { group: g.group, parts, sum: parts.reduce((s, p) => s + p.v, 0) };
    }).filter((g) => g.parts.length);
  }, [detailTrips]);

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
      <FilterBar>
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(trips.map((t) => t.vk))} />
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่มบริการ" value={f.sg} onChange={set("sg")}
          opts={duniq(trips.map((t) => t.sg || "ไม่ระบุ"))} />
        <ClearFiltersBtn active={isFiltered(f, F0)} onClick={() => setF(F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        {/* 1 */}
        <div className="dz-heroes">
          <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.rev)} unit="บาท" s="รายได้ – ต้นทุน = กำไร" />
          <Hero kind="cost" l="ต้นทุนรวม" v={fmt(kpi.cost)} unit="บาท" />
          <Hero kind={kpi.profit < 0 ? "loss" : "profit"} l="กำไร" v={signed(kpi.profit)} unit="บาท" />
        </div>

        {/* 2 — สองแถว แถวละ 4 ใบ */}
        <div className="dz-cards four">
          <KC dot={D.indigo} l="จำนวนบิล" v={fmt(kpi.bills)} s="บิล · ทุกบิลของใบรายการที่จับคู่ได้" />
          <KC dot={D.violet} l="จำนวนเที่ยว" v={fmt(kpi.n)} s="เที่ยว" />
          <KC dot={D.teal} l="จำนวนลูกค้า" v={fmt(kpi.custs)} s="ราย · ผู้จ่ายเงินไม่ซ้ำ" />
          <Meter dot={D.emerald} bar={kpi.margin < 0 ? D.rose : D.emerald} tone={kpi.margin < 0 ? "bad" : "good"}
            l="%Margin" v={pct(kpi.margin)} s="กำไร ÷ รายได้" fill={Math.abs(kpi.margin)} />
          <KC dot={D.indigo} tone={kpi.perBill < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/บิล"
            v={signed(Math.round(kpi.perBill))} s="บาท ต่อบิล" />
          <KC dot={D.violet} tone={kpi.perTrip < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/เที่ยว"
            v={signed(Math.round(kpi.perTrip))} s="บาท ต่อเที่ยว" />
          <KC dot={D.teal} tone={kpi.perCust < 0 ? "bad" : undefined} l="กำไรเฉลี่ย/ลูกค้า"
            v={signed(Math.round(kpi.perCust))} s="บาท ต่อลูกค้า" />
          <Meter dot={D.rose} bar={D.rose} tone={kpi.lossPct > 0 ? "bad" : "good"}
            l="%เที่ยวที่ขาดทุน" v={pct(kpi.lossPct)} s="เที่ยวขาดทุน ÷ เที่ยวทั้งหมด" fill={kpi.lossPct} />
        </div>

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

        {/* 4 */}
        <div className="dz-row dz-2" style={{ marginTop: 14 }}>
          <div className="dz-cc">
            <h4>กำไรระดับเที่ยววิ่ง · รายเส้นทาง</h4>
            <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.rt}
              empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" className="dm-tbl"
              rowProps={(r) => ({
                className: r.rt === picked ? "on" : undefined,
                onClick: () => setPicked(r.rt),
                title: "กดเพื่อดูรายละเอียดเส้นทางนี้",
              })} />
          </div>
          <div className="dz-cc">
            {detail ? (
              <>
                <div className="dm-dh">
                  <div>
                    <h4 style={{ margin: 0 }}>{detail.rt}</h4>
                    <p>{fmt(detail.n)} เที่ยว · กำไรรวม {signed(detail.profit)} บาท</p>
                  </div>
                  <button type="button" className="dm-i" onClick={() => setShowList(true)}
                    title="ดูรายการทุกเที่ยวของเส้นทางนี้" aria-label="ดูรายการทุกเที่ยวของเส้นทางนี้">i</button>
                </div>
                <div className="dm-avg">
                  <div><span>รายได้/เที่ยว</span><b>{fmt(Math.round(detail.rev / detail.n))}</b></div>
                  <div><span>ต้นทุน/เที่ยว</span><b>{fmt(Math.round(detail.cost / detail.n))}</b></div>
                  <div><span>กำไร/เที่ยว</span>
                    <b style={{ color: detail.perTrip < 0 ? "var(--red)" : "var(--green)" }}>
                      {signed(Math.round(detail.perTrip))}</b></div>
                </div>
                <div className="dm-parts">
                  <div className="bar" role="img" aria-label="สัดส่วนต้นทุนตามการจัดประเภท">
                    {costTree.flatMap((g) => g.parts).map((p) => (
                      <i key={p.label} style={{ width: `${Math.max(0, p.v) / detail.cost * 100}%`, background: p.color }}
                        title={`${p.label} ${fmt(p.v)} บาท`} />
                    ))}
                  </div>
                  {costTree.map((g) => (
                    <div key={g.group} className="dm-cg">
                      <div className="dm-cgh">
                        <span>{g.group}</span>
                        <b>{pct(g.sum / detail.cost * 100, 1)}</b>
                        <small>{fmt(Math.round(g.sum / detail.n))} ฿/เที่ยว</small>
                      </div>
                      <ul>
                        {g.parts.map((p) => (
                          <li key={p.label}>
                            <span className="row">
                              <i style={{ background: p.color }} />
                              <span>{p.label}</span>
                              <b>{pct(p.v / detail.cost * 100, 1)}</b>
                              <small>{fmt(Math.round(p.v / detail.n))} ฿/เที่ยว</small>
                            </span>
                            {p.subs.length > 0 && (
                              <ul className="sub">
                                {p.subs.map((c) => (
                                  <li key={c.label}>
                                    <span className="row">
                                      <i style={{ background: c.color }} />
                                      <span>{c.label}</span>
                                      <b>{pct(c.v / detail.cost * 100, 1)}</b>
                                      <small>{fmt(Math.round(c.v / detail.n))} ฿/เที่ยว</small>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="dz-note">เลือกเส้นทางจากตารางด้านซ้าย</p>}
          </div>
        </div>
        <Note>
          กดชื่อเส้นทางในตารางเพื่อดูรายละเอียดฝั่งขวา · ปุ่ม <b>i</b> เปิดรายการทุกเที่ยวของเส้นทางนั้นตามตัวกรองด้านบน ·
          ต้นทุนฝั่งขวาแยกตามการจัดประเภทต้นทุน: <b>ต้นทุนปกติ</b> (ผันแปร + กึ่งผันแปร + คงที่ + ค่าเช่า + อื่น ๆ)
          และ <b>ต้นทุนสูญเปล่า</b> — ชุดเดียวกับแท็บ "ต้นทุน" ใน Executive Dashboard
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
    </>
  );
}
