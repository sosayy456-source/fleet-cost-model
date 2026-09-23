/**
 * แท็บ "ต้นทุนที่จมกับที่ว่าง" ของ Executive Dashboard — Load Factor รายเที่ยว
 * สเปก: lf_executive_dashboard.html (เจ้าของงานส่ง 22 ก.ย. 2569) เอา 5 ส่วนแรกมา ไม่รวมส่วนเอกสารสำหรับทีมโมเดล
 * ลอกเฉพาะ "สิ่งที่แสดง" แล้วปรับเข้าธีมของโมเดล (การ์ด dz-* · กราฟ Recharts · ตัวกรองบนแถบหัว)
 *
 *   1. ภาพรวม      ประโยค "ทุก 100 บาท จม X บาท" + แถบตู้รถ (ใช้จริง/จมกับที่ว่าง) + การ์ด 3 ใบ
 *                  + แนวโน้ม LF เฉลี่ยรายเดือน 3 ปี กับตารางเทียบปี (มีต้นทุนที่จมด้วย — ไฟล์เรามีต้นทุนครบทุกปี)
 *   2. เสียตรงไหน   จัดอันดับ Idle ตามชนิดรถ และตามเส้นทาง มีเส้นประ 80% · **กดแถวเพื่อกรองทั้งแท็บ**
 *   3. คุ้มทุน      Break-even LF ต่อกลุ่ม (เส้นทาง/ชนิดรถ) เทียบ LF เฉลี่ย — เขียว/เหลือง/แดง
 *   4. เที่ยวไหนควรแก้  กราฟจุด 4 กลุ่ม (LfMatrix.tsx) — **รายกลุ่มเป็นค่าเริ่มต้น** รายเที่ยวเปิดได้เมื่อกรองจนเหลือน้อย
 *   5. จำลองผล      ตัวเลื่อน +Δ LF → Idle ลดลงเท่าไร (คิดสดในเบราว์เซอร์)
 *
 * ★ ชุดข้อมูลอิสระ (loadfactor/) ไม่ใช้ trips ของ costrev เลย — แท็บนี้อยู่ใน STANDALONE ของ CostRevDash
 *   ต้องเข้าได้แม้ไฟล์ต้นทุนหาย · สูตรทั้งหมดอยู่ใน lib/loadfactor/calc.ts ห้ามคิดเองในไฟล์นี้
 * ★ ตัวกรองสองชั้น: แถบหัว (ปี · เดือน · ประเภทรถ) + กดข้ามส่วน (ชนิดรถ · เส้นทาง จากส่วนที่ 2) แสดงเป็นชิปใต้หัว
 *   ส่วนแนวโน้มเทียบปี **ไม่ตามตัวกรองปี/เดือน** (ต้องเห็นทุกปีถึงจะเทียบได้) แต่ตามประเภทรถ/ชนิดรถ/เส้นทาง
 * ★ รายการชนิดรถไม่กรองด้วยชนิดรถที่กดอยู่ (จะได้เห็นชนิดอื่นเทียบกัน) — เส้นทางก็เช่นกัน ตาม sel(exclude) ในสเปก
 */
import { useMemo, useState } from "react";
import { DLine } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import FilterBar, { ClearFiltersBtn } from "../../../lib/ui/FilterBar";
import GrowBox from "../../../lib/ui/GrowBox";
import EtlBanner from "../../../lib/ui/EtlBanner";
import { useAutoReloadOnEtl, useEtlStatus } from "../../../lib/data/etlStatus";
import { useLoadFactor } from "../../../lib/data/useLoadFactor";
import type { LfTrip } from "../../../lib/data/useLoadFactor";
import {
  BE_LABEL, beTone, groupTrips, rankGroups, summarize, trend, whatIf,
} from "../../../lib/loadfactor/calc";
import type { LfGroupKey, LfRank } from "../../../lib/loadfactor/calc";
import { FF, Hero, Note, Pane } from "../../dash-fleet/parts";
import { ListFF, MonthFF, duniq, fmt, isFiltered, monthName, pct } from "../common";
import LfMatrix from "./LfMatrix";
import TruckLoader from "../../../lib/ui/TruckLoader";

interface Filter { year: string; month: string; ft: string }
const F0: Filter = { year: "", month: "", ft: "" };

const pctOf = (x: number, d = 0): string => pct(x * 100, d);
const baht = (n: number): string => fmt(Math.round(n));

export default function LoadFactorTab() {
  const { data, error, reload } = useLoadFactor();
  const etl = useEtlStatus("loadfactor");
  useAutoReloadOnEtl(etl, reload);
  return (
    <>
      <EtlBanner status={etl} />
      {error ? (
        <div className="card">
          <div className="banner">{error}</div>
          <p className="muted">
            สร้างไฟล์ข้อมูลด้วย <code>python etl/build_loadfactor.py --dataset sample</code> (หรือ <code>--dataset real</code>
            เมื่อวางไฟล์จริงใน <code>etl/data/Loadfactor/</code> แล้ว)
          </p>
        </div>
      ) : !data ? (
        <div className="card"><p className="muted">กำลังโหลดข้อมูล Load Factor... <TruckLoader label={null} /></p></div>
      ) : (
        <Body trips={data.trips} isSample={data.manifest.isSample} files={data.manifest.sourceFiles} />
      )}
    </>
  );
}

function Body({ trips, isSample, files }: { trips: LfTrip[]; isSample: boolean; files: string[] }) {
  const [f, setF] = useState<Filter>(F0);
  const set = (k: keyof Filter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  /** ตัวกรองจากการกดข้ามส่วน — null = ไม่กรอง · กดซ้ำ = ยกเลิก */
  const [vk, setVk] = useState<string | null>(null);
  const [rt, setRt] = useState<string | null>(null);
  const [beKey, setBeKey] = useState<LfGroupKey>("rt");
  const [delta, setDelta] = useState(15);

  const years = useMemo(() => duniq(trips.map((t) => String(t.y))), [trips]);

  /** ชั้นที่ 1: ประเภทรถ + ชนิดรถ/เส้นทางที่กด (ยังไม่กรองเวลา — ส่วนแนวโน้มใช้ชุดนี้) */
  const scope = useMemo(
    () => trips.filter((t) => (!f.ft || t.ft === f.ft) && (!vk || t.vk === vk) && (!rt || t.rt === rt)),
    [trips, f.ft, vk, rt]);
  const inPeriod = (t: LfTrip) => (!f.year || String(t.y) === f.year) && (!f.month || t.mo.slice(5) === f.month);
  /** ชั้นที่ 2: + ปี/เดือน — ทุกส่วนยกเว้นแนวโน้มใช้ชุดนี้ */
  const rows = useMemo(() => scope.filter(inPeriod), [scope, f.year, f.month]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 1. ภาพรวม ---------- */
  const sum = useMemo(() => summarize(rows), [rows]);
  const tr = useMemo(() => trend(scope), [scope]);
  const trendData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const row: Record<string, string | number | null> = { mo: monthName(String(i + 1).padStart(2, "0")) };
    for (const y of tr.years) { const v = y.byMonth[i]; row[String(y.year)] = v == null ? null : Math.round(v * 1000) / 10; }
    return row;
  }), [tr]);
  const YEAR_COLORS = [D.slate, D.indigo, D.emerald, D.rose, D.amber];

  /* ---------- 2. เสียตรงไหน — รายการชนิดรถไม่กรองด้วยชนิดรถที่กด (และกลับกัน) ---------- */
  const rankVk = useMemo(
    () => rankGroups(groupTrips(trips.filter((t) => (!f.ft || t.ft === f.ft) && (!rt || t.rt === rt) && inPeriod(t)), "vk")),
    [trips, f, rt]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rankRt = useMemo(
    () => rankGroups(groupTrips(trips.filter((t) => (!f.ft || t.ft === f.ft) && (!vk || t.vk === vk) && inPeriod(t)), "rt")),
    [trips, f, vk]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 3. คุ้มทุน ---------- */
  const be = useMemo(() => groupTrips(rows, beKey).sort((a, b) => a.margin - b.margin), [rows, beKey]);

  /* ---------- 5. จำลองผล ---------- */
  const wi = useMemo(() => whatIf(rows, delta / 100), [rows, delta]);

  const chips = [
    vk && { k: "ชนิดรถ", v: vk, clear: () => setVk(null) },
    rt && { k: "เส้นทาง", v: rt, clear: () => setRt(null) },
  ].filter(Boolean) as { k: string; v: string; clear: () => void }[];
  const periodLabel = (f.year ? `พ.ศ. ${+f.year + 543}` : "ทุกปี") + (f.month ? ` · ${monthName(f.month)}` : "");

  return (
    <>
      <FilterBar>
        <FF label="ปี" value={f.year} onChange={set("year")}>
          <option value="">ทุกปี</option>
          {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
        </FF>
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ClearFiltersBtn active={isFiltered(f, F0) || !!vk || !!rt} onClick={() => { setF(F0); setVk(null); setRt(null); }} />
      </FilterBar>

      <Pane deps={[rows, delta, beKey]}>
        {/* ชิปบอกว่ากำลังกรองอะไรจากการกดข้ามส่วน */}
        <div className="lf-chips">
          {chips.length ? (
            <>
              <span>กำลังดูเฉพาะ:</span>
              {chips.map((c) => (
                <span key={c.k} className="lf-chip">{c.k}: {c.v}
                  <button type="button" onClick={c.clear} aria-label={`ล้างตัวกรอง${c.k}`}>×</button></span>
              ))}
            </>
          ) : <span>ดูทุกเที่ยว — กดชนิดรถหรือเส้นทางในส่วน "ต้นทุนที่จมเกิดจากตรงไหน" เพื่อกรองทั้งแท็บ</span>}
          <span className="lf-src">{isSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"} · {fmt(trips.length)} เที่ยว · {files.join(", ")}</span>
        </div>

        {/* ===== 1. ภาพรวม ===== */}
        <div className="dz-cc lf-hero">
          <h2>ทุก 100 บาทที่จ่ายค่าขนส่ง มี <b>{Math.round(sum.share * 100)} บาท</b>จมไปกับที่ว่างบนรถ</h2>
          <p>จากต้นทุนขนส่งรวม {baht(sum.cost)} บาท ของ {fmt(sum.n)} เที่ยว ({periodLabel}) — ส่วนที่ว่างคือ 100% − Max LF ของแต่ละเที่ยว
            {(vk || rt || f.ft) && " (เฉพาะกลุ่มที่เลือก)"}</p>
          <CargoBar idleShare={sum.share} />
          <div className="lf-legend">
            <span><i className="sw used" />ต้นทุนที่ได้ขนของจริง</span>
            <span><i className="sw hatch" />ต้นทุนที่จมกับที่ว่าง (จ่ายเต็ม แต่ขนได้ไม่เต็มคัน)</span>
          </div>
        </div>
        <div className="dz-heroes cp-heroes" style={{ marginTop: 14 }}>
          <Hero kind="loss" l="ต้นทุนที่จมกับที่ว่าง" v={baht(sum.idle)} unit="บาท"
            s={`${pctOf(sum.share, 1)} ของต้นทุนรวม ${baht(sum.cost)}`} />
          <Hero kind="profit" l="เงินที่กู้คืนได้ถ้าถึงเป้า" v={baht(sum.recov)} unit="บาท"
            s={`${sum.idle ? pctOf(sum.recov / sum.idle) : "–"} ของต้นทุนที่จม · ต่ำกว่าเป้า ${fmt(sum.below)} จาก ${fmt(sum.n)} เที่ยว`} />
          <Hero kind="cust" l="LF เฉลี่ยเทียบเป้า" v={pctOf(sum.avgLf)} vSub={`เป้า ${pctOf(sum.avgTg)}`}
            s={`ห่างจากเป้า ${Math.round((sum.avgTg - sum.avgLf) * 100)} จุด`} />
        </div>

        <div className="dz-row dz-2" style={{ marginTop: 14 }}>
          <div className="dz-cc">
            <h4>LF เฉลี่ยรายเดือน เทียบแต่ละปี</h4>
            <div className="dz-box">
              <DLine data={trendData} xKey="mo" suffix="%" digits={1}
                series={tr.years.map((y, i) => ({ key: String(y.year), label: `พ.ศ. ${y.year + 543}`, color: YEAR_COLORS[i % YEAR_COLORS.length]! }))} />
            </div>
            <Note>เทียบเดือนเดียวกันของแต่ละปีเพื่อตัดผลของฤดูกาล · ส่วนนี้ไม่ตามตัวกรองปี/เดือน (ตามประเภทรถ ชนิดรถ เส้นทางที่เลือก)</Note>
          </div>
          <div className="dz-cc">
            <h4>เทียบช่วงเดียวกันของแต่ละปี{tr.months.length ? ` (${tr.months.map((m) => monthName(String(m).padStart(2, "0"))).join(" · ")})` : ""}</h4>
            <table className="dz-tbl lf-yr">
              <thead><tr><th>ปี</th><th className="n">LF เฉลี่ย</th><th className="n">พื้นที่ว่าง</th><th className="n">ต้นทุนที่จม</th><th className="n">% ของต้นทุน</th></tr></thead>
              <tbody>
                {tr.years.map((y, i) => {
                  const prev = tr.years[i - 1]?.ytd;
                  const d = y.ytd && prev ? (y.ytd.lf - prev.lf) * 100 : null;
                  return (
                    <tr key={y.year}>
                      <td>พ.ศ. {y.year + 543}
                        {d != null && <span className={"lf-delta" + (d < 0 ? " neg" : " pos")}>{d > 0 ? "+" : ""}{d.toFixed(1)} จุด</span>}
                      </td>
                      <td className="n">{y.ytd ? pctOf(y.ytd.lf, 1) : "–"}</td>
                      <td className="n">{y.ytd ? pctOf(1 - y.ytd.lf, 1) : "–"}</td>
                      <td className="n">{y.ytd ? baht(y.ytd.idle) : "–"}</td>
                      <td className="n">{y.ytd ? pctOf(y.ytd.share, 1) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Note>พื้นที่ว่าง = 100% − LF เฉลี่ยต่อเที่ยว · ตัวเลขในวงเล็บคือผลต่าง LF จากปีก่อนเป็นจุดเปอร์เซ็นต์ (ไม่ใช่ % เปลี่ยนแปลง) ·
              ใช้เฉพาะเดือนที่ปีล่าสุดมีข้อมูล เพื่อให้เทียบกันได้</Note>
          </div>
        </div>

        {/* ===== 2. เสียตรงไหน ===== */}
        <div className="dz-t" style={{ marginTop: 22 }}>ต้นทุนที่จมเกิดจากตรงไหน</div>
        <Note>เรียงจากมากไปน้อย · กดแถวเพื่อกรองทั้งแท็บ เช่น กดชนิดรถแล้วดูว่ารถชนิดนั้นเสียที่เส้นทางไหน กดซ้ำเพื่อยกเลิก</Note>
        <div className="dz-row dz-11" style={{ marginTop: 10 }}>
          <RankPanel title="แยกตามชนิดรถ" unit="ชนิดรถ" rank={rankVk} picked={vk} onPick={(n) => setVk((p) => (p === n ? null : n))} />
          <RankPanel title="แยกตามเส้นทาง" unit="เส้นทาง" rank={rankRt} picked={rt} onPick={(n) => setRt((p) => (p === n ? null : n))} />
        </div>
        <Note>เส้นประ = จุดที่รวมกันได้ 80% ของต้นทุนที่จม กลุ่มที่อยู่เหนือเส้นคือกลุ่มที่ควรแก้ก่อน · ตัวเลขใต้ชื่อคือจำนวนเที่ยวและ LF เฉลี่ยเทียบเป้า</Note>

        {/* ===== 3. คุ้มทุน ===== */}
        <div className="dz-t" style={{ marginTop: 22 }}>งานที่รับ ต่ำสุดกี่ % ของความจุรถถึงไม่ขาดทุน</div>
        <Note>จุดคุ้มทุน = ต้นทุนของเที่ยว ÷ รายได้ที่จะได้ถ้าบรรทุกเต็ม 100% ใช้ตัดสินใจรับงานหรือต่อรองราคา</Note>
        <div className="dz-cc" style={{ marginTop: 10 }}>
          <div className="cp-th">
            <div>
              <h4 style={{ margin: 0 }}>Break-even LF ต่อกลุ่ม</h4>
              <p>{be.length ? takeawayBE(be[0]!) : "ไม่มีข้อมูลตามตัวกรอง"}</p>
            </div>
            <div className="cp-seg" role="group" aria-label="เลือกมุมมอง">
              <button type="button" className={beKey === "rt" ? "on" : ""} onClick={() => setBeKey("rt")}>ตามเส้นทาง</button>
              <button type="button" className={beKey === "vk" ? "on" : ""} onClick={() => setBeKey("vk")}>ตามชนิดรถ</button>
            </div>
          </div>
          <div className="lf-beaxis"><span>กลุ่ม</span><span className="scale"><span>0%</span><span>50%</span><span>100% ของความจุ</span></span><span /></div>
          {/* เส้นทางจริงมีเกือบร้อยกลุ่ม — กล่องเลื่อนในตัว ไม่งั้นหน้ายาวหลายจอ */}
          <GrowBox rows={be} maxHeight="52vh" render={(shown) => (
          <div className="lf-be">
            {shown.map((g) => {
              const tone = beTone(g.margin);
              return (
                <div key={g.name} className="row">
                  <div className="nm">{g.name}<small>{fmt(g.n)} เที่ยว · LF เฉลี่ย {pctOf(g.lf)} · คุ้มทุนที่ {pctOf(g.be)}</small></div>
                  <div className="lf-track" role="img" aria-label={`LF เฉลี่ย ${pctOf(g.lf)} จุดคุ้มทุน ${pctOf(g.be)}`}>
                    <i className="fill" style={{ width: `${Math.min(100, g.lf * 100)}%` }} />
                    <i className="mark" style={{ left: `calc(${Math.min(100, g.be * 100)}% - 1.5px)` }} />
                  </div>
                  <div className="st">
                    <span className={`lf-pill ${tone}`}>{BE_LABEL[tone]}</span>
                    <small>{g.margin >= 0 ? "เผื่อ " : "ขาด "}{Math.abs(Math.round(g.margin * 100))} จุด</small>
                  </div>
                </div>
              );
            })}
            {be.length === 0 && <p className="dz-note">ไม่มีข้อมูลตามตัวกรอง</p>}
          </div>
          )} />
          <Note>
            <i className="sw used" />แถบน้ำเงินคือ LF เฉลี่ยปัจจุบัน เส้นดำคือจุดคุ้มทุน · เขียว = เผื่อไว้ตั้งแต่ 10 จุดขึ้นไป · เหลือง = เผื่อไม่ถึง 10 จุด ·
            แดง = LF ต่ำกว่าจุดคุ้มทุน · ต้นทุนเที่ยวถือเป็นต้นทุนคงที่ เพราะค่าจ้างรถ คนขับ และน้ำมันไม่ลดตามน้ำหนักที่บรรทุก
          </Note>
        </div>

        {/* ===== 4. เที่ยวไหนควรแก้ ===== */}
        <div className="dz-t" style={{ marginTop: 22 }}>เที่ยวแต่ละเที่ยวควรแก้แบบไหน</div>
        <Note>จุดหนึ่งจุดคือหนึ่งกลุ่ม (หรือหนึ่งเที่ยวเมื่อเลือกมุมมองรายเที่ยว) ยิ่งไปทางขวายิ่งเต็ม ยิ่งขึ้นบนยิ่งได้กำไรมาก ขนาดจุดคือต้นทุนรวม</Note>
        <LfMatrix trips={rows} />

        {/* ===== 5. จำลองผล ===== */}
        <div className="dz-t" style={{ marginTop: 22 }}>ถ้าทุกเที่ยวบรรทุกเพิ่มขึ้น จะประหยัดได้เท่าไหร่</div>
        <Note>ลากตัวเลื่อนเพื่อจำลองว่า ถ้าเที่ยวที่ยังว่างอยู่บรรทุกได้เต็มขึ้น (เช่น รวมเที่ยว หรือจัดสินค้าใหม่) ต้นทุนที่จมจะลดลงเท่าไหร่ เพดานคือ LF 100%</Note>
        <div className="dz-cc" style={{ marginTop: 10 }}>
          <label htmlFor="lf-delta" className="lf-dlabel">เพิ่ม Load Factor ขึ้น <b>+{delta}</b> จุด</label>
          <input id="lf-delta" type="range" min={0} max={40} step={1} value={delta} className="lf-range"
            onChange={(e) => setDelta(Number(e.target.value))} />
          <div className="lf-presets">
            {[5, 10, 15, 20, 30].map((d) => (
              <button key={d} type="button" className={delta === d ? "on" : ""} onClick={() => setDelta(d)}>+{d}</button>
            ))}
          </div>
          <div className="lf-wibar">
            <div className="cap"><span>ตอนนี้</span><span>ต้นทุนที่จม <b>{baht(wi.oldIdle)}</b> · LF เฉลี่ย {pctOf(wi.lfOld)}</span></div>
            <CargoBar idleShare={wi.cost ? wi.oldIdle / wi.cost : 0} small />
          </div>
          <div className="lf-wibar">
            <div className="cap"><span>หลังปรับ</span><span>ต้นทุนที่จม <b>{baht(wi.newIdle)}</b> · LF เฉลี่ย {pctOf(wi.lfNew)}</span></div>
            <CargoBar idleShare={wi.cost ? wi.newIdle / wi.cost : 0} small />
          </div>
          <div className="lf-out">
            <div><span className="k">ประหยัดต้นทุนที่จมได้</span><b className="v">{baht(wi.saved)}</b><span className="s">บาท · ในช่วงที่กรอง ({fmt(wi.n)} เที่ยว)</span></div>
            <div><span className="k">เทียบเท่าต้นทุนของ</span><b className="v">≈ {wi.tripsEq.toFixed(1)} เที่ยว</b><span className="s">ต้นทุนเฉลี่ย {baht(wi.avgCost)} บาทต่อเที่ยว</span></div>
            <div><span className="k">ต้นทุนที่จมลดลง</span><b className="v">{wi.oldIdle ? pctOf(wi.saved / wi.oldIdle) : "0%"}</b><span className="s">{baht(wi.oldIdle)} เหลือ {baht(wi.newIdle)}</span></div>
          </div>
          <Note>คำนวณสดในเบราว์เซอร์ (ต้นทุนรวมของเที่ยว × ส่วนที่ว่างก่อนและหลังปรับ) · เที่ยวที่ LF เกิน 100% อยู่แล้วจะคงเดิม ไม่ถูกลดลง</Note>
        </div>
      </Pane>
    </>
  );
}

/** แถบตู้รถ — ส่วนที่ใช้ขนของจริง (ทึบ) กับส่วนที่จมกับที่ว่าง (ลายทแยง) ต่อ 100 บาท */
function CargoBar({ idleShare, small }: { idleShare: number; small?: boolean }) {
  const i = Math.max(0, Math.min(1, idleShare)) * 100;
  return (
    <div className={"lf-cargo" + (small ? " sm" : "")} role="img"
      aria-label={`ต้นทุน 100 บาท ใช้ขนของจริง ${(100 - i).toFixed(0)} บาท จมกับที่ว่าง ${i.toFixed(0)} บาท`}>
      <div className="seg used" style={{ width: `${100 - i}%` }}><span>{(100 - i).toFixed(0)} บาท</span></div>
      <div className="seg idle hatch" style={{ width: `${i}%` }}><span className="lbl">{i.toFixed(0)} บาท</span></div>
    </div>
  );
}

/** รายการจัดอันดับ Idle ของกลุ่ม — กดแถวเพื่อกรอง · เส้นประหลังแถวที่รวมกันได้ 80% */
function RankPanel({ title, unit, rank, picked, onPick }: {
  title: string; unit: string; rank: LfRank; picked: string | null; onPick: (name: string) => void;
}) {
  const max = Math.max(1, rank.rows[0]?.idle ?? 0);
  const top = rank.rows[0];
  let takeaway = "";
  if (top && rank.rows.length > 1) {
    const cumK = rank.rows[rank.k80 - 1]?.cum ?? 0;
    takeaway = `${rank.k80} จาก ${rank.rows.length} ${unit} กินต้นทุนที่จม ${pctOf(cumK)}`;
    if (top.share > top.nShare + 0.05)
      takeaway += ` โดย ${top.name} มี ${pctOf(top.nShare)} ของเที่ยว แต่สร้าง ${pctOf(top.share)} ของต้นทุนที่จม`;
  } else if (top) {
    takeaway = `เหลือ 1 ${unit} ในกลุ่มที่เลือก`;
  }
  return (
    <div className="dz-cc">
      <h4>{title}</h4>
      {takeaway && <p className="lf-take">{takeaway}</p>}
      {/* กล่องเลื่อนในตัว — เส้นทางจริงมีเกือบร้อยแถว */}
      <GrowBox rows={rank.rows} maxHeight="52vh" render={(shown) => (
      <div className="lf-rank">
        {shown.map((g, i) => (
          <div key={g.name}>
            <button type="button" className="row" aria-pressed={picked === g.name} onClick={() => onPick(g.name)}>
              <span className="nm">{g.name}<span className="mt">{fmt(g.n)} เที่ยว · LF เฉลี่ย {pctOf(g.lf)} เป้า {pctOf(g.tg)}</span></span>
              <span className="bar"><i className="hatch" style={{ width: `${g.idle / max * 100}%` }} /></span>
              <span className="val">{baht(g.idle)}<small>{pctOf(g.share)} (สะสม {pctOf(g.cum)})</small></span>
            </button>
            {i + 1 === rank.k80 && rank.k80 < rank.rows.length && (
              <div className="lf-cut">รวมถึงตรงนี้ = 80% ของต้นทุนที่จม</div>
            )}
          </div>
        ))}
        {rank.rows.length === 0 && <p className="dz-note">ไม่มีข้อมูลตามตัวกรอง</p>}
      </div>
      )} />
    </div>
  );
}

function takeawayBE(g: { name: string; lf: number; be: number; margin: number }): string {
  return beTone(g.margin) === "bad"
    ? `${g.name} มี LF เฉลี่ย ${pctOf(g.lf)} ต่ำกว่าจุดคุ้มทุน ${pctOf(g.be)} แล้ว`
    : `${g.name} ใกล้จุดคุ้มทุนที่สุด: LF เฉลี่ย ${pctOf(g.lf)} เทียบจุดคุ้มทุน ${pctOf(g.be)} (เผื่อไว้ ${Math.round(g.margin * 100)} จุด)`;
}
