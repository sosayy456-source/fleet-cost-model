/**
 * แท็บ "กองรถ" — สเปกส่วนที่ 1 การใช้ประโยชน์ของกองรถ (การใช้ประโยชน์กองรถและกำไรระดับเที่ยววิ่ง.md)
 *
 *   1.1 ตัวกรอง  ปี เดือน · จุดขึ้น–จุดลง · ประเภทรถ/ชนิดรถ   (กลุ่มบริการตัดออก — ไฟล์ไม่มีคอลัมน์)
 *   1.2 KPI 9 ตัว — 3 ตัวหลักเป็นการ์ดเด่น อีก 6 ตัวเป็นการ์ดที่มีแถบสัดส่วนบอกว่า "มากหรือน้อยเมื่อเทียบกับอะไร"
 *   1.3 VISUAL-02 อันดับความคุ้มค่า 5 อันดับแรก — แถวละ ประเภทรถ · กลุ่มบริการ · เส้นทาง
 *       สลับมุมมอง กำไร/เที่ยว ↔ กำไร/คัน · จำนวนเที่ยวใต้แท่ง · ป้าย กำไรดี/พอประมาณ/ขาดทุน
 *       (ตามรูปตัวอย่างของเจ้าของ 16 ก.ย. 2569) กลุ่มบริการ = ประเภทสินค้าที่พบมากสุดในบิลรายได้ของใบนั้น
 *       เที่ยวที่จับคู่บิลไม่ได้เป็น "ไม่ระบุ" — Dashboard รวม จะเห็นกลุ่มนี้ ส่วน Executive ไม่มี
 *       VISUAL-03 ตัดออก (ต้องใช้กลุ่มบริการรายเที่ยวจากไฟล์ต้นทุน ซึ่งไม่มี)
 *       VISUAL-04 รถที่ถูกใช้งานมากที่สุด (จำนวนเที่ยว) — เป็นตารางอันดับแทนกราฟแท่ง อ่านกำไรคู่กันได้
 *
 * ส่วนเสริมที่ไม่ได้อยู่ในสเปก แต่ตอบคำถามเดียวกันจากข้อมูลชุดเดิม:
 *   แถบสุขภาพกองรถ (สัดส่วนรถกำไร/ขาดทุนสะสม · เที่ยวกำไร/ขาดทุน/ตีเปล่า)
 *   สัดส่วนเที่ยวตามประเภทรถ
 *
 * ใช้ร่วมกันทั้ง Executive Dashboard และ Dashboard รวม — ต่างกันแค่ trips ที่ส่งเข้ามา
 */
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { D } from "../../lib/chart/theme";
import { Hero, Note, Pane, ResetBtn } from "../dash-fleet/parts";
import { BASE_F0, ListFF, MonthFF, YearFF, duniq, fmt, groupBy, passBase, pct, signed } from "./common";
import type { BaseFilter } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

const TOP_PLATES = 10;
const TOP_RANK = 5;
/** ป้ายความคุ้มค่า — เกณฑ์ตามคำอธิบายใต้กราฟในรูปตัวอย่าง ใช้เกณฑ์เดียวกันทั้งสองมุมมอง */
const GOOD_FROM = 5000;
type RankMode = "trip" | "vehicle";
const rankTone = (v: number): { label: string; color: string; cls: string } =>
  v >= GOOD_FROM ? { label: "กำไรดี", color: D.emeraldLight, cls: "good" }
  : v >= 0 ? { label: "พอประมาณ", color: D.orange, cls: "ok" }
  : { label: "ขาดทุน", color: D.rose, cls: "loss" };
/** สีวนของกราฟหลายหมวด — ลำดับเดียวกับแท็บอื่นของแดชบอร์ด */
const PALETTE = [D.indigo, D.violet, D.teal, D.cyan, D.emeraldLight, D.amber, D.orange, D.pink, D.rose, D.slateDeep];
const FLEET_COLORS = [D.indigo, D.teal, D.amber, D.pink, D.slateDeep];
const pctOf = (a: number, b: number): number => (b ? a / b * 100 : 0);

export default function FleetTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const rows = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);

  const kpi = useMemo(() => {
    const plates = groupBy(rows, (t) => t.pl);
    const n = rows.length;
    const vehicles = plates.length;
    const profit = rows.reduce((s, t) => s + t.profit, 0);
    const cost = rows.reduce((s, t) => s + t.cost, 0);
    const empty = rows.filter((t) => t.empty);
    // แยกเที่ยวเป็น 3 กลุ่มที่ไม่ทับกัน เพื่อวาดแถบซ้อน — ตีเปล่ามาก่อน เพราะเที่ยวตีเปล่าส่วนใหญ่ไม่มีรายได้
    // และจะถูกนับเป็นขาดทุนซ้ำ ส่วน KPI "สัดส่วนเที่ยวที่ขาดทุน" ยังนับทุกเที่ยวที่กำไร < 0 ตามสเปก
    const loss = rows.filter((t) => t.profit < 0).length;
    const lossNonEmpty = rows.filter((t) => !t.empty && t.profit < 0).length;
    return {
      vehicles, n, cost,
      turnover: vehicles ? n / vehicles : 0,
      maxTrips: plates.reduce((m, p) => Math.max(m, p.n), 0),
      profitPerVehicle: vehicles ? profit / vehicles : 0,
      lossVehicles: plates.filter((p) => p.profit < 0).length,
      emptyTrips: empty.length,
      emptyCost: empty.reduce((s, t) => s + t.cost, 0),
      repair: rows.reduce((s, t) => s + t.repair, 0),
      lossPct: pctOf(loss, n),
      tripMix: { good: n - empty.length - lossNonEmpty, loss: lossNonEmpty, empty: empty.length },
    };
  }, [rows]);

  /** VISUAL-02 — กำไรต่อเที่ยว/ต่อคัน ตาม ประเภทรถ · กลุ่มบริการ · เส้นทาง เอา 5 อันดับแรก */
  const [rankMode, setRankMode] = useState<RankMode>("trip");
  const ranked = useMemo(() => {
    const plates = new Map<string, Set<string>>();
    for (const t of rows) {
      const k = `${t.ft}|${t.sg || "ไม่ระบุ"}|${t.rt}`;
      (plates.get(k) ?? plates.set(k, new Set()).get(k)!).add(t.pl);
    }
    return groupBy(rows, (t) => `${t.ft}|${t.sg || "ไม่ระบุ"}|${t.rt}`)
      .map((a) => {
        const vehicles = plates.get(a.key)?.size ?? 1;
        return { key: a.key, label: a.key.split("|").join(" · "), n: a.n, vehicles,
                 v: rankMode === "trip" ? a.profit / a.n : a.profit / vehicles };
      })
      .sort((a, b) => b.v - a.v)
      .slice(0, TOP_RANK);
  }, [rows, rankMode]);
  const rankMax = Math.max(1, ...ranked.map((r) => Math.abs(r.v)));

  /** สัดส่วนเที่ยวตามประเภทรถ (รถบริษัท / รถร่วม / …) พร้อมกำไรเฉลี่ยต่อเที่ยวของแต่ละประเภท */
  const byFleet = useMemo(() => groupBy(rows, (t) => t.ft)
    .map((a) => ({ name: a.key, n: a.n, avg: a.profit / a.n,
                   vehicles: new Set(rows.filter((t) => t.ft === a.key).map((t) => t.pl)).size }))
    .sort((a, b) => b.n - a.n), [rows]);

  /** VISUAL-04 — ทะเบียนที่วิ่งมากสุด พร้อมกำไรสะสมของคันนั้น */
  const byPlate = useMemo(() => groupBy(rows, (t) => t.pl)
    .map((a) => ({ plate: a.key, n: a.n, profit: a.profit, kind: rows.find((t) => t.pl === a.key)?.vk ?? "" }))
    .sort((a, b) => b.n - a.n).slice(0, TOP_PLATES), [rows]);

  const plateMax = byPlate[0]?.n ?? 0;
  const profitGood = kpi.vehicles - kpi.lossVehicles;

  return (
    <>
      <div className="dz-filters">
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="จุดขึ้น" all="ทุกจุดขึ้น" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="จุดลง" all="ทุกจุดลง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(trips.map((t) => t.vk))} />
        <ResetBtn onClick={() => setF(BASE_F0)} />
      </div>

      <Pane deps={[rows]}>
        {/* [VISUAL-01] ตัวเลขหลัก 3 ตัว */}
        <div className="dz-heroes">
          <Hero kind="fleet" l="จำนวนรถที่ใช้งานจริง" v={fmt(kpi.vehicles)}
            s={<>คัน · นับทะเบียนไม่ซ้ำ</>} />
          <Hero kind="rev" l="จำนวนเที่ยววิ่งรวม" v={fmt(kpi.n)}
            s={<>เที่ยว · เฉลี่ย {fmt(kpi.turnover, 1)} เที่ยวต่อคัน</>} />
          <Hero kind={kpi.profitPerVehicle < 0 ? "loss" : "profit"} l="กำไรเฉลี่ยต่อคัน"
            v={signed(kpi.profitPerVehicle)} s="บาท/คัน · กำไรรวม ÷ รถที่ใช้งานจริง" />
        </div>

        {/* สุขภาพกองรถ — ภาพรวมในบรรทัดเดียวก่อนลงรายละเอียด */}
        <div className="fl-health">
          <div className="fl-hrow">
            <div className="fl-hhead">
              <span>รถ {fmt(kpi.vehicles)} คัน</span>
              <b>{pct(pctOf(profitGood, kpi.vehicles))} กำไรสะสม</b>
            </div>
            <Stack parts={[
              { v: profitGood, color: D.emeraldLight, label: "กำไรสะสม ≥ 0" },
              { v: kpi.lossVehicles, color: D.rose, label: "ขาดทุนสะสม" },
            ]} unit="คัน" />
          </div>
          <div className="fl-hrow">
            <div className="fl-hhead">
              <span>เที่ยว {fmt(kpi.n)} เที่ยว</span>
              <b>{pct(pctOf(kpi.tripMix.good, kpi.n))} มีกำไร</b>
            </div>
            <Stack parts={[
              { v: kpi.tripMix.good, color: D.emeraldLight, label: "มีกำไร/เท่าทุน" },
              { v: kpi.tripMix.loss, color: D.rose, label: "ขาดทุน" },
              { v: kpi.tripMix.empty, color: D.amber, label: "ตีเปล่า" },
            ]} unit="เที่ยว" />
          </div>
        </div>

        {/* KPI ที่เหลือ — แถบใต้ตัวเลขบอกขนาดเทียบกับฐานที่เขียนไว้ใต้การ์ด */}
        <div className="dz-cards fl-cards">
          <Meter dot={D.teal} l="อัตราหมุนรอบรถเฉลี่ย" v={fmt(kpi.turnover, 1)}
            s={`เที่ยว/คัน · คันที่วิ่งมากสุด ${fmt(kpi.maxTrips)} เที่ยว`} fill={pctOf(kpi.turnover, kpi.maxTrips)} />
          <Meter dot={D.rose} tone={kpi.lossVehicles ? "bad" : undefined} l="รถที่ขาดทุนสะสม" v={fmt(kpi.lossVehicles)}
            s={`คัน · ${pct(pctOf(kpi.lossVehicles, kpi.vehicles))} ของรถที่ใช้งาน`} fill={pctOf(kpi.lossVehicles, kpi.vehicles)} />
          <Meter dot={D.rose} tone={kpi.lossPct > 0 ? "warn" : undefined} l="สัดส่วนเที่ยวที่ขาดทุน" v={pct(kpi.lossPct)}
            s="เที่ยวขาดทุน ÷ เที่ยวทั้งหมด" fill={kpi.lossPct} />
          <Meter dot={D.amber} l="เที่ยววิ่งตีเปล่า" v={fmt(kpi.emptyTrips)}
            s={`เที่ยว · ${pct(pctOf(kpi.emptyTrips, kpi.n))} ของเที่ยวทั้งหมด`} fill={pctOf(kpi.emptyTrips, kpi.n)} />
          <Meter dot={D.orange} tone={kpi.emptyCost ? "warn" : undefined} l="ต้นทุนสูญเปล่า" v={fmt(kpi.emptyCost)}
            s={`บาท · ${pct(pctOf(kpi.emptyCost, kpi.cost))} ของต้นทุนรวม`} fill={pctOf(kpi.emptyCost, kpi.cost)} />
          <Meter dot={D.slateDeep} l="ค่าซ่อมบำรุงรวม" v={fmt(kpi.repair)}
            s={`บาท · ${pct(pctOf(kpi.repair, kpi.cost))} ของต้นทุนรวม`} fill={pctOf(kpi.repair, kpi.cost)} />
        </div>

        <div className="dz-row dz-2" style={{ marginTop: 14 }}>
          {/* [VISUAL-02] */}
          <div className="dz-cc">
            <div className="fl-tophead">
              <div>
                <h4>อันดับความคุ้มค่าตามประเภทรถ · {TOP_RANK} อันดับแรก</h4>
                <p className="dz-note">
                  {rankMode === "trip" ? "กำไรเฉลี่ยต่อเที่ยว" : "กำไรรวมต่อคัน (÷ ทะเบียนไม่ซ้ำในกลุ่ม)"} แยกตามประเภทรถ กลุ่มบริการ และเส้นทาง
                </p>
              </div>
              <div className="fl-toggle" role="group" aria-label="มุมมอง">
                <button type="button" className={rankMode === "trip" ? "on" : ""} onClick={() => setRankMode("trip")}>กำไร/เที่ยว</button>
                <button type="button" className={rankMode === "vehicle" ? "on" : ""} onClick={() => setRankMode("vehicle")}>กำไร/คัน</button>
              </div>
            </div>
            {ranked.length === 0 ? <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p> : (
              <ol className="fl-top">
                {ranked.map((r, i) => {
                  const tone = rankTone(r.v);
                  return (
                    <li key={r.key} style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="fl-tname">
                        <span className="fl-tno">{i + 1}</span>
                        <b>{r.label}</b>
                        <span className={"fl-tbadge " + tone.cls}>{tone.label}</span>
                        <span className="fl-tval" style={{ color: tone.color }}>{signed(Math.round(r.v))} ฿</span>
                      </div>
                      <div className="fl-rbar fat">
                        <i style={{ width: `${pctOf(Math.abs(r.v), rankMax)}%`, background: tone.color }} />
                      </div>
                      <div className="fl-tsub">{fmt(r.n)} เที่ยว{rankMode === "vehicle" ? ` · ${fmt(r.vehicles)} คัน` : ""}</div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="fl-legend">
              <span><i style={{ background: D.emeraldLight }} />กำไรดี · ตั้งแต่ {fmt(GOOD_FROM)} ฿</span>
              <span><i style={{ background: D.orange }} />พอประมาณ · 0 ถึง {fmt(GOOD_FROM - 1)} ฿</span>
              <span><i style={{ background: D.rose }} />ขาดทุน · ต่ำกว่า 0 ฿</span>
            </div>
          </div>
          <div className="dz-cc">
            <h4>สัดส่วนเที่ยวตามประเภทรถ</h4>
            <ul className="fl-share">
              {byFleet.map((a, i) => (
                <li key={a.name} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="fl-shead">
                    <span><i style={{ background: FLEET_COLORS[i % FLEET_COLORS.length] }} />{a.name}</span>
                    <b>{pct(pctOf(a.n, kpi.n))}</b>
                  </div>
                  <div className="fl-rbar fat">
                    <i style={{ width: `${pctOf(a.n, kpi.n)}%`, background: FLEET_COLORS[i % FLEET_COLORS.length] }} />
                  </div>
                  <div className="fl-ssub">
                    {fmt(a.n)} เที่ยว · {fmt(a.vehicles)} คัน · กำไรเฉลี่ย{" "}
                    <b style={{ color: a.avg < 0 ? "var(--d-rose-d)" : "var(--d-emerald-d)" }}>{signed(a.avg)}</b> บาท/เที่ยว
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* [VISUAL-04] */}
        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>รถที่ถูกใช้งานมากที่สุด · {TOP_PLATES} อันดับแรก</h4>
          {byPlate.length === 0 ? <p className="dz-note">ไม่มีข้อมูลตามตัวกรองที่เลือก</p> : (
            <ol className="fl-rank wide">
              {byPlate.map((p, i) => (
                <li key={p.plate} style={{ animationDelay: `${i * 45}ms` }}>
                  <span className={"fl-badge" + (i < 3 ? ` top${i + 1}` : "")}>{i + 1}</span>
                  <div className="fl-rmain">
                    <div className="fl-rname"><b>{p.plate}</b><small>{p.kind}</small></div>
                    <div className="fl-rbar">
                      <i style={{ width: `${pctOf(p.n, plateMax)}%`, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                  <div className="fl-rval">
                    <b>{fmt(p.n)} <small>เที่ยว</small></b>
                    <small style={{ color: p.profit < 0 ? "var(--d-rose-d)" : "var(--d-emerald-d)" }}>
                      {signed(p.profit)} บาท
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <Note>
          แถบสุขภาพกองรถแยกเที่ยวตีเปล่าออกก่อน แล้วค่อยแบ่งที่เหลือเป็นกำไร/ขาดทุน จึงไม่นับซ้ำ —
          การ์ด "สัดส่วนเที่ยวที่ขาดทุน" นับทุกเที่ยวที่กำไรติดลบรวมตีเปล่าด้วยตามสเปก ตัวเลขสองที่จึงต่างกันได้ ·
          กราฟสัดส่วนการใช้รถในแต่ละกลุ่มบริการ (VISUAL-03) ยังไม่แสดง — ไฟล์ต้นทุนไม่มีคอลัมน์กลุ่มบริการ
        </Note>
      </Pane>
    </>
  );
}

/** การ์ดตัวเลข + แถบสัดส่วน — รูปเดียวกับ KC แต่แถบยาวตามค่าจริง (KC วาดแถบเต็มเสมอ) */
function Meter({ l, v, s, dot, tone, fill }: {
  l: string; v: string; s: string; dot: string; tone?: "good" | "warn" | "bad"; fill: number;
}) {
  const w = Math.max(0, Math.min(100, fill));
  return (
    <div className={"dz-kc" + (tone ? ` t-${tone}` : "")} style={{ "--dot": dot } as CSSProperties}>
      <div className="l"><i className="d" />{l}</div>
      {/* key + data-real — ดูเหตุผลที่ useCountUp() */}
      <div className="v" key={v} data-real={v}>{v}</div>
      <div className="s">{s}</div>
      <div className="kbar"><i style={{ width: `${w}%`, background: dot }} /></div>
    </div>
  );
}

/** แถบซ้อนแนวนอน + คำอธิบายสี */
function Stack({ parts, unit }: { parts: { v: number; color: string; label: string }[]; unit: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  return (
    <>
      <div className="fl-stack" role="img"
        aria-label={parts.map((p) => `${p.label} ${fmt(p.v)} ${unit}`).join(", ")}>
        {parts.map((p) => p.v > 0 && (
          <span key={p.label} style={{ width: `${pctOf(p.v, total)}%`, background: p.color }} />
        ))}
      </div>
      <div className="fl-legend">
        {parts.map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label} <b>{fmt(p.v)}</b> {unit}</span>
        ))}
      </div>
    </>
  );
}
