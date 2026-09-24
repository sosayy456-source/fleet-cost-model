/**
 * แท็บ "ข้อ 3" ของเมนู Demo — สเปก ข้อ3ส่วนDEMO.pdf · ดีไซน์ตาม handoff "Fleet Report v3" (เจ้าของงานส่ง 24 ก.ย. 2569)
 *
 *   1. ต้นทุนขนส่งแต่ละชนิดรถ ปีล่าสุด + % เปลี่ยนแปลงบาท/ตัน-กม. จากปีก่อน → "รายละเอียด ข้อ 3" ส่วนที่ 1
 *   2. รถบริษัทชนิดไหนคุ้มค่าเสื่อมที่แบกไว้ (ทุกชนิด + แท่ง diverging)      → "รายละเอียด ข้อ 3" ส่วนที่ 2
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
 */
import { useMemo, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { Trip } from "../../lib/data/useCostRev";
import { depByKind, depreciation, kindYearCost, vehicleRows } from "../../lib/detail3/calc";
import { fleetSlices, fleetTypeShare, serviceFleetMix } from "../../lib/fleetcompare/utilization";
import { openExecTab } from "../../lib/ui/dashJump";
import { fmt, pct } from "../dash-costrev/common";

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
  role: "link" as const, tabIndex: 0, title: `กดเพื่อเปิด${label}ใน Executive Dashboard`, onClick: go,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } },
});

/**
 * ★ ตามตัวกรองของหน้า Demo (24 ก.ย. 2569 — หน้ายาว ตัวกรองชุดเดียว)
 *   trips     = กรองครบทุกตัว → ส่วนที่ 2 (ค่าเสื่อม) และ 3 (ภาพรวมกองรถ)
 *   costTrips = กรองทุกตัว **ยกเว้นปี** → ส่วนที่ 1 ต้องมีปีก่อนหน้าไว้เทียบ · year = ปีที่เลือก ("" = ปีล่าสุด)
 */
export default function Item3Tab({ trips, costTrips, year }: { trips: Trip[]; costTrips: Trip[]; year: string }) {
  const top = useRef<HTMLElement>(null);
  const rows = useMemo(() => vehicleRows(trips), [trips]);
  const cost = useMemo(() => kindYearCost(vehicleRows(costTrips), year ? Number(year) : undefined), [costTrips, year]);
  const dep = useMemo(() => depreciation(rows), [rows]);
  const depKinds = useMemo(() => depByKind(dep.list), [dep.list]);
  const slices = useMemo(() => fleetSlices(trips), [trips]);
  const mix = useMemo(() => serviceFleetMix(slices), [slices]);
  const types = useMemo(() => fleetTypeShare(slices), [slices]);
  const typeTotal = types.reduce((s, t) => s + t.n, 0);
  // ช่วงเดือนของปีล่าสุด — ปีล่าสุดมักยังไม่ครบ ต้องบอกผู้ใช้ว่าเทียบช่วงไหน
  const span = useMemo(() => {
    const ms = costTrips.filter((t) => t.y === cost.year).map((t) => Number(t.mo.slice(5, 7))).filter((m) => m >= 1 && m <= 12);
    return ms.length ? `${MONTHS[Math.min(...ms) - 1]}–${MONTHS[Math.max(...ms) - 1]}` : "";
  }, [costTrips, cost.year]);
  // แท่ง diverging: ฝั่งลบกว้าง 18% ของช่อง สเกลตามค่าลบสุด · ฝั่งบวกใช้ที่เหลือ สเกลตามค่าบวกสุด
  const maxPos = Math.max(0, ...depKinds.map((k) => k.vsAvg)), maxNeg = Math.max(0, ...depKinds.map((k) => -k.vsAvg));
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
      <div className="i3-tbl-wrap"><table className="i3-tbl">
        <thead><tr>
          <th>ชนิดรถ</th><th className="n">บาท/เที่ยว</th><th className="n">บาท/กม.</th>
          <th className="n">บาท/ตัน-กม.</th><th className="n">% เปลี่ยนแปลงจากปีก่อน</th>
        </tr></thead>
        <tbody className="i3-link">{cost.list.map((k) => <tr key={k.vk} {...linkProps(toPart1, "รายละเอียด ข้อ 3 (ต้นทุนขนส่ง)")}>
          <td><Kind name={k.vk} n={k.n} /></td>
          <td className="n i3-strong">{fmt(k.perTrip)}</td>
          <td className="n i3-soft">{money(k.perKm)}</td>
          <td className="n i3-soft">{money(k.perTkm)}</td>
          <td className="n">{k.change === null
            ? <span className="i3-pill none" title={k.perTkm === null ? "ปีนี้หารไม่ได้ (ไม่มีน้ำหนัก/ระยะทาง)" : "ปีก่อนไม่มีชนิดนี้"}>ไม่มีข้อมูลเทียบ</span>
            : <span className={`i3-pill ${k.change >= 0 ? "bad" : "good"}`}>{k.change >= 0 ? "▲" : "▼"} {pct(Math.abs(k.change))}</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="i3-note">% เปลี่ยนแปลง = (บาท/ตัน-กม. ปีนี้ − บาท/ตัน-กม. ปีก่อน) ÷ บาท/ตัน-กม. ปีก่อน ·
        <b className="bad"> ▲ แดง = ต้นทุนสูงขึ้น</b> · <b className="good">▼ เขียว = ถูกลง</b> ·
        ต้นทุนแยกรายคัน (หัว/หางคิดแยก) บาท/ตัน-กม. ของหางจึงต่ำกว่าหัวมาก</p>
    </Section>

    <Section tone="green" title="รถบริษัทชนิดไหนคุ้มค่าเสื่อมที่แบกไว้"
      sub="เทียบเฉพาะรถบริษัท (รถร่วมไม่มีค่าเสื่อมเป็นของตัวเอง)">
      {!depKinds.length ? <p className="i3-note">ไม่มีเที่ยวของรถบริษัทที่มีค่าเสื่อม</p> : <div className="i3-tbl-wrap"><table className="i3-tbl">
        <thead><tr>
          <th>ชนิดรถ</th><th className="n">ค่าเสื่อมเฉลี่ย/เที่ยว</th><th className="i3-divcol">เทียบค่าเฉลี่ยรวม</th><th className="n">คุ้มค่าเสื่อม</th>
        </tr></thead>
        <tbody className="i3-link">{depKinds.map((k) => <tr key={k.vk} {...linkProps(toPart2, "รายละเอียด ข้อ 3 (คุ้มค่าเสื่อม)")}>
          <td><Kind name={k.vk} n={k.n} /></td>
          <td className="n i3-bold">฿{fmt(k.fc)}</td>
          <td><div className="i3-div" title={`${k.vsAvg >= 0 ? "+" : "−"}${pct(Math.abs(k.vsAvg))} เทียบ coverage เฉลี่ยรวม`}>
            <div className="i3-div-neg"><i style={{ width: k.vsAvg < 0 && maxNeg ? `${-k.vsAvg / maxNeg * 100}%` : 0 }} /></div>
            <span className="i3-div-zero" />
            <div className="i3-div-pos"><i style={{ width: k.vsAvg > 0 && maxPos ? `${k.vsAvg / maxPos * 100}%` : 0 }} /></div>
          </div></td>
          <td className="n"><span className={`i3-pill dot ${k.vsAvg >= 0 ? "good" : "bad"}`}>
            <i />{k.vsAvg >= 0 ? "คุ้มทุน +" : "ต่ำกว่าทุน −"}{pct(Math.abs(k.vsAvg))}</span></td>
        </tr>)}</tbody>
      </table></div>}
      <p className="i3-note">คุ้มค่าเสื่อม = coverage ของชนิดรถ (Contribution ÷ ค่าเสื่อม) เทียบ coverage เฉลี่ยรวม {fmt(dep.avgCoverage, 2)} เท่า</p>
    </Section>

    <Section tone="blue" title="ภาพรวมการใช้ประโยชน์กองรถ"
      sub="การใช้รถตามกลุ่มบริการและประเภทรถ">
      <div className="i3-fleet">
        <div className="i3-panel i3-link" {...linkProps(toFleet, "การใช้ประโยชน์ของกองรถ")}>
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

        <div className="i3-panel i3-donut-panel i3-link" {...linkProps(toFleet, "การใช้ประโยชน์ของกองรถ")}>
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
    </Section>
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

function Kind({ name, n }: { name: string; n: number }) {
  return <div className="i3-kind"><b>{name}</b><span>{fmt(n)} เที่ยว</span></div>;
}

/** เลื่อนกลับส่วนที่ 1 — หักความสูงแถบหัวที่ติดบน (76px ตาม handoff) */
function scrollToTop(ref: RefObject<HTMLElement | null>): void {
  const el = ref.current;
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
}
