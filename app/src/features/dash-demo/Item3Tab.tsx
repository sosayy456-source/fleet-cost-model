/**
 * แท็บ "ข้อ 3" ของเมนู Demo — สเปก ข้อ3ส่วนDEMO.pdf · ดีไซน์ตาม handoff "Fleet Report v3" (เจ้าของงานส่ง 24 ก.ย. 2569)
 *
 *   1. ต้นทุนขนส่งแต่ละชนิดรถ ปีล่าสุด + % เปลี่ยนแปลงบาท/ตัน-กม. จากปีก่อน → "รายละเอียด ข้อ 3" ส่วนที่ 1
 *   2. ความคุ้มค่าเสื่อม ยานพาหนะ (ตัวเลขสรุป + แท่งสัดส่วนเที่ยวคุ้ม/ไม่คุ้มรายชนิด
 *      เกณฑ์ coverage ≥ 1 · ภาพที่เจ้าของงานส่ง 27 ก.ย. 2569 แทนแท่ง diverging เทียบค่าเฉลี่ยรวม) → "รายละเอียด ข้อ 3" ส่วนที่ 2
 *   3. ภาพรวมการใช้ประโยชน์กองรถ (กลุ่มบริการ × ประเภทรถ + โดนัท)             → "การใช้ประโยชน์ของกองรถ"
 *
 * ★ ดีไซน์: การ์ดส่วนเรียงแนวตั้ง · หัวข้อเป็นป้ายไล่สี (ม่วง/เขียว/ฟ้า) · หัวตารางไล่สีเดียวกับหัวข้อ ·
 *   แท่งแบบ 3D (ชั้น gloss) · โดนัท SVG ไล่เฉด · **ไม่มีปุ่ม "ดูรายละเอียด" แล้ว — กดแถวในตาราง (ส่วน 1–2) หรือแผงข้อมูล (ส่วน 3)
 *   เพื่อลิงก์ไปหน้าปลายทาง** (เจ้าของงานสั่ง 24 ก.ย. 2569) ·
 *   ปุ่ม "กลับไปส่วนที่ 1 ↑" ท้ายส่วนที่ 3 · สีเป็นค่าตายตัวตาม handoff (คลาส .i3-* ในส่วนที่ 2 ของ index.css)
 *   ฟอนต์ยังเป็น LINE Seed ของทั้งโมเดล (handoff ใช้ Prompt)
 * ★ ใช้ชุดเดียวกับแท็บปลายทาง (จับคู่รายได้ได้ + เที่ยววิ่งเปล่า · 24 ก.ย. 2569) ตัวเลขจึงตรงกับหน้าที่ลิงก์ไปเมื่อไม่กรอง
 * ★ สูตรทั้งหมดมาจาก lib/detail3/calc.ts กับ lib/fleetcompare/utilization.ts — ห้ามคิดเองในไฟล์นี้
 * ★ การเลื่อนไปส่วนที่ 1/2 ส่ง anchor ผ่าน openExecTab(tab, anchor) (lib/ui/dashJump.ts)
 * ★ ส่วนที่ 1 (27 ก.ย. 2569 · เจ้าของงานสั่ง): ช่องต้นทาง + ปลายทาง (พิมพ์หรือเลือกจากรายการ · datalist ขึ้นรายการแนะนำตามที่พิมพ์) ·
 *   ดรอปดาวน์ชนิดรถ (ติ๊กได้หลายชนิด) ต่อขวาของช่องปลายทาง (KindDropdown · 27 ก.ย. 2569 — แทนชิปใต้ช่องค้นหา) · เลือกชนิดรถได้หลายชนิด · ติ๊ก "เฉพาะเที่ยวที่ถูก Flag" ·
 *   คอลัมน์ ชนิดรถ · เที่ยว · บาท/เที่ยว · บาท/กม. · บาท/ตัน-กม. · % เปลี่ยนแปลง เรียงได้สามจังหวะ (useSort) ·
 *   ⚠ แดง + จำนวนคันที่ติด Flag ของเกณฑ์นั้น (kindCostTable/costFlags ใน lib/detail3/calc.ts — เกิน 2 เท่าของค่าเฉลี่ยรายคันของชนิดรถ)
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { Trip } from "../../lib/data/useCostRev";
import { DEP_BREAKEVEN, FLAG_TIMES, depByKind, depreciation, kindCostTable, vehicleRows } from "../../lib/detail3/calc";
import { fleetSlices, fleetTypeShare, serviceFleetMix } from "../../lib/fleetcompare/utilization";
import { openExecTab } from "../../lib/ui/dashJump";
import { fmt, pct, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";

/** สีประเภทรถตาม handoff — [สีหลัก, สีอ่อนของโดนัท, ป้ายสั้น] */
const FT: Record<string, [string, string, string]> = {
  "รถบริษัท": ["#5B3FE0", "#A898F5", "บริษัท"],
  "รถร่วม": ["#0C9A7E", "#7FD9C4", "ร่วม"],
  "รถร่วมนอกพิเศษ": ["#F29A1F", "#FBD08A", "ร่วมนอกพิเศษ"],
};
const ftOf = (k: string): [string, string, string] => FT[k] ?? ["#8A85A0", "#C9C4D8", k];
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const be = (y: number): number => y + 543;
const money = (n: number | null, d = 1): string => (n === null ? "–" : fmt(n, d));
/** ขอบโดนัท (r = 70) */
const CIRC = 2 * Math.PI * 70;
const toPart1 = (): void => openExecTab("detail3", "d3-part1");
const toPart2 = (): void => openExecTab("detail3", "d3-part2");
const toFleet = (): void => openExecTab("fleet");
/** props ของสิ่งที่กดแล้วลิงก์ไป Executive Dashboard — แถวตาราง/แผง · กด Enter/เว้นวรรคได้ด้วย */
const linkProps = (go: () => void, label: string) => ({
  role: "link" as const, tabIndex: 0, title: `กดเพื่อเปิด ${label} ใน Overall Dashboard`, onClick: go,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } },
});

/**
 * ★ ตามตัวกรองของหน้า Demo (24 ก.ย. 2569 — หน้ายาว ตัวกรองชุดเดียว)
 *   trips     = กรองครบทุกตัว → ส่วนที่ 2 (ค่าเสื่อม) และ 3 (ภาพรวมกองรถ)
 *   costTrips = กรองทุกตัว **ยกเว้นปี** → ส่วนที่ 1 ต้องมีปีก่อนหน้าไว้เทียบ · year = ปีที่เลือก ("" = ปีล่าสุด)
 */
/** hideFleet = ไม่วาดส่วนที่ 3 (ภาพรวมกองรถ) — เมนู Executive Summary ใช้แค่ส่วนที่ 1–2 (27 ก.ย. 2569) */
export default function Item3Tab({ trips, costTrips, year, hideFleet }: { trips: Trip[]; costTrips: Trip[]; year: string; hideFleet?: boolean }) {
  const top = useRef<HTMLElement>(null);
  const rows = useMemo(() => vehicleRows(trips), [trips]);
  // ส่วนที่ 1: ค้นหาเส้นทาง · เลือกชนิดรถหลายชนิด · เฉพาะเที่ยวที่ถูก Flag
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [kindSel, setKindSel] = useState<Set<string>>(() => new Set());
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const costRows = useMemo(() => vehicleRows(costTrips), [costTrips]);
  const cost = useMemo(
    () => kindCostTable(costRows, year ? Number(year) : undefined, { origin, dest, kinds: kindSel, flaggedOnly }),
    [costRows, year, origin, dest, kindSel, flaggedOnly]);
  type KindRow = (typeof cost.list)[number];
  const costCols = useMemo<Col<KindRow>[]>(() => [
    { key: "vk", label: "ชนิดรถ", get: (k) => k.vk },
    { key: "n", label: "เที่ยว", get: (k) => k.n, num: true },
    { key: "perTrip", label: "บาท/เที่ยว", get: (k) => k.perTrip, num: true },
    { key: "perKm", label: "บาท/กม.", get: (k) => k.perKm ?? -Infinity, num: true },
    { key: "perTkm", label: "บาท/ตัน-กม.", get: (k) => k.perTkm ?? -Infinity, num: true },
    { key: "change", label: "% เปลี่ยนแปลงจากปีก่อน", get: (k) => k.change ?? -Infinity, num: true },
  ], []);
  const costSort = useSort(cost.list, costCols, { key: "n", dir: -1 });
  const dep = useMemo(() => depreciation(rows), [rows]);
  const depKinds = useMemo(() => depByKind(dep.list), [dep.list]);
  const worthPct = dep.list.length ? (dep.list.length - dep.notWorth) / dep.list.length * 100 : 0;
  const slices = useMemo(() => fleetSlices(trips), [trips]);
  const mix = useMemo(() => serviceFleetMix(slices), [slices]);
  const types = useMemo(() => fleetTypeShare(slices), [slices]);
  const typeTotal = types.reduce((s, t) => s + t.n, 0);
  // ช่วงเดือนของปีล่าสุด — ปีล่าสุดมักยังไม่ครบ ต้องบอกผู้ใช้ว่าเทียบช่วงไหน
  const span = useMemo(() => {
    const ms = costTrips.filter((t) => t.y === cost.year).map((t) => Number(t.mo.slice(5, 7))).filter((m) => m >= 1 && m <= 12);
    return ms.length ? `${MONTHS[Math.min(...ms) - 1]}–${MONTHS[Math.max(...ms) - 1]}` : "";
  }, [costTrips, cost.year]);
  const donut = useMemo(() => {
    let acc = 0;
    return types.map((t) => {
      const len = typeTotal ? t.n / typeTotal * CIRC : 0, seg = { ...t, len, offset: -acc };
      acc += len;
      return seg;
    });
  }, [types, typeTotal]);

  return <div className="i3-page">
    <Section ref={top} tone="violet" title="ต้นทุนขนส่งแต่ละชนิดรถ"
      sub={cost.year ? `ปี ${be(cost.year)}${span && ` (${span})`} เทียบปี ${be(cost.prev!)} · รวมรถบริษัทและรถร่วม` : "ยังไม่มีข้อมูล"}>
      <div className="i3-tools">
        <PlaceInput label="ต้นทาง" value={origin} onChange={setOrigin} opts={cost.origins} />
        <span className="i3-arrow" aria-hidden="true">→</span>
        <PlaceInput label="ปลายทาง" value={dest} onChange={setDest} opts={cost.dests} />
        <KindDropdown all={cost.kinds} sel={kindSel} onChange={setKindSel} />
        <label className="i3-check">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          แสดงเฉพาะเที่ยวที่ถูก Flag <span className="i3-flag">⚠ {fmt(cost.flagged)}</span>
        </label>
      </div>

      <div className="i3-tbl-wrap"><table className="i3-tbl">
        <thead><tr>
          {costCols.map((c) => (
            <th key={c.key} className={c.num ? "n i3-sort" : "i3-sort"} onClick={() => costSort.toggle(c.key)}
              title="กดเพื่อเรียงมากไปน้อย · กดซ้ำเป็นน้อยไปมาก · กดอีกครั้งเพื่อกลับลำดับเดิม">
              {c.label}<span className={costSort.sort.key === c.key ? "on" : ""}>
                {costSort.sort.key === c.key ? (costSort.sort.dir === 1 ? "▲" : "▼") : "▲▼"}</span>
            </th>
          ))}
        </tr></thead>
        <tbody className="i3-link">{!costSort.sorted.length && <tr><td colSpan={costCols.length} className="i3-empty">
          {flaggedOnly ? "ไม่มีเที่ยวที่ถูก Flag ตามที่ค้นหา" : "ไม่มีเที่ยวตามที่ค้นหา"}</td></tr>}
        {costSort.sorted.map((k) => <tr key={k.vk} {...linkProps(toPart1, "Vehicle Utilization Cost (ต้นทุนขนส่ง)")}>
          <td><b className="i3-kname">{k.vk}</b></td>
          <td className="n">{fmt(k.n)}</td>
          <td className="n i3-strong">{fmt(k.perTrip)}<FlagMark n={k.fTrip} what="ต้นทุน/เที่ยว" /></td>
          <td className="n i3-soft">{money(k.perKm)}<FlagMark n={k.fKm} what="ต้นทุน/กม." /></td>
          <td className="n i3-soft">{money(k.perTkm)}<FlagMark n={k.fTkm} what="ต้นทุน/ตัน-กม." /></td>
          <td className="n">{k.change === null
            ? <span className="i3-pill none" title={k.perTkm === null ? "ปีนี้หารไม่ได้ (ไม่มีน้ำหนัก/ระยะทาง)" : "ปีก่อนไม่มีชนิดนี้"}>ไม่มีข้อมูลเทียบ</span>
            : <span className={`i3-pill ${k.change >= 0 ? "bad" : "good"}`}>{k.change >= 0 ? "▲" : "▼"} {pct(Math.abs(k.change))}</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="i3-note"><b className="bad">⚠ n</b> = จำนวนเที่ยว (รายคัน) ที่ค่านั้นเกิน {FLAG_TIMES} เท่าของค่าเฉลี่ยรายคันของชนิดรถเดียวกันในปีนี้ ·
        ต้นทุน/กม. ไม่นับคันที่ไม่มีระยะทาง · ค่าเฉลี่ยคิดจากทั้งปีตามตัวกรองของหน้า ไม่เปลี่ยนตามช่องค้นหา ·
        % เปลี่ยนแปลง = (บาท/ตัน-กม. ปีนี้ − บาท/ตัน-กม. ปีก่อน) ÷ บาท/ตัน-กม. ปีก่อน (ปีก่อนตามช่องต้นทาง/ปลายทาง/ชนิดรถ) ·
        <b className="bad"> ▲ แดง = ต้นทุนสูงขึ้น</b> · <b className="good">▼ เขียว = ถูกลง</b> ·
        ต้นทุนแยกรายคัน (หัว/หางคิดแยก) บาท/ตัน-กม. ของหางจึงต่ำกว่าหัวมาก</p>
    </Section>

    <Section tone="green" title="ความคุ้มค่าเสื่อม ยานพาหนะ"
      sub="สัดส่วนเที่ยววิ่งที่คุ้มค่าเสื่อมเทียบกับไม่คุ้มค่าเสื่อม แยกตามชนิดรถ · เฉพาะรถบริษัท (รถร่วมไม่มีค่าเสื่อมเป็นของตัวเอง)">
      {!depKinds.length ? <p className="i3-note">ไม่มีเที่ยวของรถบริษัทที่มีค่าเสื่อม</p> : <>
        <div className="i3-stats i3-link" {...linkProps(toPart2, "Vehicle Utilization Cost (คุ้มค่าเสื่อม)")}>
          <div><span>เที่ยวทั้งหมดในช่วงที่เลือก</span><b>{fmt(dep.list.length)} <small>เที่ยว</small></b></div>
          <div><span>เที่ยวที่คุ้มค่าเสื่อม</span><b className="good">{pct(worthPct)}</b>
            <small>{fmt(dep.list.length - dep.notWorth)} เที่ยว</small></div>
          <div><span>เที่ยวที่ไม่คุ้มค่าเสื่อม</span><b className="bad">{pct(100 - worthPct)}</b>
            <small>{fmt(dep.notWorth)} เที่ยว</small></div>
          <div><span>ค่าเสื่อมรวม</span><b>฿{fmt(dep.totalDep)}</b><small>{fmt(depKinds.length)} ชนิดรถ</small></div>
        </div>
        <div className="i3-tbl-wrap"><table className="i3-tbl">
          <thead><tr>
            <th>ชนิดรถ</th><th className="n">ค่าเสื่อมเฉลี่ย/เที่ยว</th>
            <th className="i3-divcol">สัดส่วนเที่ยวคุ้ม / ไม่คุ้มค่าเสื่อม</th><th className="n">คุ้มค่าเสื่อม</th>
          </tr></thead>
          <tbody className="i3-link">{depKinds.map((k) => <tr key={k.vk} {...linkProps(toPart2, "Vehicle Utilization Cost (คุ้มค่าเสื่อม)")}>
            <td><Kind name={k.vk} n={k.n} /></td>
            <td className="n i3-bold">฿{fmt(k.fc)}</td>
            <td><div className="i3-worth" title={`คุ้ม ${fmt(k.nWorth)} · ไม่คุ้ม ${fmt(k.n - k.nWorth)} เที่ยว`}>
              <div className="i3-worth-bar"><i className="ok" style={{ width: `${k.worthPct}%` }} /><i className="no" style={{ width: `${100 - k.worthPct}%` }} /></div>
              <div className="i3-worth-lbl"><span className="good">คุ้ม {pct(k.worthPct)}</span><span className="bad">ไม่คุ้ม {pct(100 - k.worthPct)}</span></div>
            </div></td>
            <td className="n"><div className="i3-worth-verdict">
              <span className={`i3-pill dot ${k.worth ? "good" : "bad"}`}><i />{k.worth ? "คุ้มทุน" : "ไม่คุ้มทุน"}</span>
              <small>coverage {fmt(k.coverage, 2)} เท่า</small>
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </>}
      <p className="i3-note">เกณฑ์: coverage = (กำไร + ค่าเสื่อม) ÷ ค่าเสื่อม ของแต่ละเที่ยว · ≥ {fmt(DEP_BREAKEVEN, 2)} = คุ้มค่าเสื่อม ·
        ป้ายท้ายแถวใช้ coverage ของชนิดรถ (Σกำไรก่อนหักค่าเสื่อม ÷ Σค่าเสื่อม) · ต้นทุน/ค่าเสื่อมแยกรายคัน (หัว/หางนับแยก)</p>
    </Section>

    {!hideFleet && <Section tone="blue" title="ภาพรวมการใช้ประโยชน์กองรถ"
      sub="การใช้รถตามกลุ่มบริการและประเภทรถ">
      <div className="i3-fleet">
        <div className="i3-panel i3-link" {...linkProps(toFleet, "Vehicle Utilization")}>
          <div className="i3-panel-head"><b>การจัดรถตามกลุ่มบริการ</b><span>ดูสัดส่วนรถบริษัท รถร่วม และรถร่วมนอกพิเศษ</span></div>
          <div className="i3-groups">{mix.map((g) => {
            const comp = g.main === "รถบริษัท";
            return <div key={g.service} className="i3-group">
              <div className="i3-group-head"><b>{g.service}</b><span>{fmt(g.n)} เที่ยว</span></div>
              <div className="i3-stack" role="img" aria-label={g.types.map((t) => `${t.key} ${pct(t.share, 0)}`).join(" · ")}>
                {g.types.map((t) => <i key={t.key} title={`${t.key}: ${fmt(t.n)} เที่ยว (${pct(t.share)})`}
                  style={{ width: `${t.share}%`, ["--c" as string]: ftOf(t.key)[0] }} />)}
              </div>
              <div className="i3-legend">{g.types.map((t) => <span key={t.key}>
                <i style={{ background: ftOf(t.key)[0] }} />{ftOf(t.key)[2]} <b>{pct(t.share, 0)}</b></span>)}</div>
              <span className={`i3-verdict ${comp ? "comp" : "part"}`}>ใช้{g.main}เป็นหลัก</span>
            </div>;
          })}</div>
        </div>

        <div className="i3-panel i3-donut-panel i3-link" {...linkProps(toFleet, "Vehicle Utilization")}>
          <div className="i3-panel-head"><b>สัดส่วนการใช้รถแต่ละประเภท</b><span>รวม {fmt(typeTotal)} เที่ยว ในช่วงเวลาที่เลือก</span></div>
          <div className="i3-donut">
            <svg viewBox="0 0 180 180" role="img" aria-label={types.map((t) => `${t.key} ${pct(t.share, 0)}`).join(" · ")}>
              <circle cx="90" cy="90" r="70" fill="none" stroke="#F2F0F6" strokeWidth="22" />
              {/* สีทึบตามป้ายด้านล่าง ไม่ไล่เฉด (เจ้าของงานสั่ง 24 ก.ย. 2569) */}
              <g transform="rotate(-90 90 90)">{donut.map((s) =>
                <circle key={s.key} cx="90" cy="90" r="70" fill="none" stroke={ftOf(s.key)[0]} strokeWidth="22"
                  strokeDasharray={`${Math.max(0, s.len - 2)} ${CIRC}`} strokeDashoffset={s.offset}>
                  <title>{`${s.key}: ${fmt(s.n)} เที่ยว`}</title></circle>)}</g>
            </svg>
            <div className="i3-donut-total"><b>{fmt(typeTotal)}</b><span>เที่ยว</span></div>
          </div>
          <ul className="i3-dlegend">{types.map((t) => <li key={t.key}>
            <span className="i3-dl-name"><i style={{ background: ftOf(t.key)[0] }} />
              <span><b>{t.key}</b><small>{fmt(t.n)} เที่ยว</small></span></span>
            <strong>{pct(t.share, 0)}</strong>
          </li>)}</ul>
        </div>
      </div>
      <p className="i3-note">ใบที่มีรถหลายประเภท (เช่น หัวรถบริษัท + หางรถร่วม) นับในทุกประเภทที่มี ยอดรวมโดนัทจึงมากกว่าจำนวนเที่ยว</p>
      <button type="button" className="i3-back" onClick={() => scrollToTop(top)}>กลับไปส่วนที่ 1 ↑</button>
    </Section>}
  </div>;
}

function Section({ ref, tone, title, sub, children }: {
  ref?: RefObject<HTMLElement | null>; tone: "violet" | "green" | "blue"; title: string; sub: string; children: ReactNode;
}) {
  return <section ref={ref} className="i3-sec">
    <header className="i3-sec-head">
      <div><h2 className={`i3-h ${tone}`}>{title}</h2><p>{sub}</p></div>
    </header>
    {children}
  </section>;
}

/**
 * ช่องต้นทาง/ปลายทาง — พิมพ์เองได้ · กดแล้วเลือกจากรายการได้ · พิมพ์แล้วรายการแนะนำกรองตามตัวอักษร (datalist ของเบราว์เซอร์)
 * กรองแบบ "มีคำนี้" จึงพิมพ์บางส่วนก็ได้ · ปุ่ม × ล้างช่อง
 */
function PlaceInput({ label, value, onChange, opts }: {
  label: string; value: string; onChange: (v: string) => void; opts: string[];
}) {
  const id = `i3-${label === "ต้นทาง" ? "o" : "de"}-list`;
  return (
    <span className="i3-place">
      <input type="text" list={id} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} (พิมพ์หรือเลือก)`} aria-label={label} autoComplete="off" />
      {value && <button type="button" className="i3-clear" onClick={() => onChange("")} aria-label={`ล้าง${label}`}>×</button>}
      <datalist id={id}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
    </span>
  );
}

/** ⚠ แดง + จำนวนเที่ยวที่ติด Flag ของเกณฑ์นั้น — ไม่มี = ไม่แสดง */
function FlagMark({ n, what }: { n: number; what: string }) {
  if (!n) return null;
  return <span className="i3-flag" title={`${fmt(n)} เที่ยว ${what} เกิน ${FLAG_TIMES} เท่าของค่าเฉลี่ยชนิดรถ`}> ⚠ {fmt(n)}</span>;
}

/**
 * ดรอปดาวน์ชนิดรถ ต่อขวาของช่องปลายทาง (เจ้าของงานสั่ง 27 ก.ย. 2569 — แทนชิปใต้ช่องค้นหา)
 * ติ๊กได้หลายชนิด · ไม่ติ๊กเลย = ทุกชนิดรถ · กดข้างนอก/Esc = ปิด
 */
function KindDropdown({ all, sel, onChange }: { all: string[]; sel: Set<string>; onChange: (s: Set<string>) => void }) {
  const box = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) box.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const toggle = (k: string) => { const n = new Set(sel); if (n.has(k)) n.delete(k); else n.add(k); onChange(n); };
  const label = !sel.size ? "ทุกชนิดรถ" : sel.size === 1 ? [...sel][0] : `ชนิดรถ ${sel.size} ชนิด`;
  return (
    <details ref={box} className="i3-kinds"
      onKeyDown={(e) => { if (e.key === "Escape" && box.current) { box.current.open = false; box.current.querySelector("summary")?.focus(); } }}>
      <summary title="เลือกชนิดรถ (ติ๊กได้หลายชนิด)">{label}</summary>
      <div className="i3-kinds-list">
        <button type="button" className="i3-kinds-all" onClick={() => onChange(new Set())} disabled={!sel.size}>ล้าง (ทุกชนิดรถ)</button>
        {all.map((k) => (
          <label key={k}><input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} />{k}</label>
        ))}
      </div>
    </details>
  );
}

function Kind({ name, n }: { name: string; n: number }) {
  return <div className="i3-kind"><b>{name}</b><span>{fmt(n)} เที่ยว</span></div>;
}

/** เลื่อนกลับส่วนที่ 1 — หักความสูงแถบหัวที่ติดบน (76px ตาม handoff) */
function scrollToTop(ref: RefObject<HTMLElement | null>): void {
  const el = ref.current;
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
}
