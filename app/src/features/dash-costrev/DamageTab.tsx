/**
 * แท็บ "Damage Rate" — ความเสียหายของสินค้าแยกตามเส้นทาง (หลักการคิดdamage.md)
 *
 *   Damage Rate %           = มูลค่าบิลเคลียร์ ÷ รายได้รวม          มุมมองการเงิน
 *   Damage Incidence Rate % = เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด        "มีปัญหาไหม"
 *   Damage Incident Rate    = รายการบิลเคลียร์ ÷ เที่ยวทั้งหมด       "ปัญหาเยอะแค่ไหนต่อเที่ยว"
 *
 * กฎของเอกสารข้อ 4: ตัดข้อมูลย่อยระดับไหน ทั้งตัวเศษและตัวหารต้องตัดระดับเดียวกัน — ที่นี่ทุกค่า
 * มาจาก rows ชุดเดียวกันที่ผ่านตัวกรองแล้ว จึงเป็นระดับเดียวกันโดยอัตโนมัติ
 *
 * ★ มูลค่าความเสียหายมาจากบิลในไฟล์รายได้ (clrAmt/clrN) จึงมีเฉพาะเที่ยวที่จับคู่เลขที่ใบรายการได้
 *   (m = true) แท็บนี้จึงแสดงตัวเลขเฉพาะใน Executive Dashboard · หน้า "Dashboard รวม" ขึ้นข้อจำกัดแทน
 * ★ ไม่ใช้ธง clear จากไฟล์ต้นทุน — ธงนั้นบอกแค่ว่า "ใบนี้มีบิลเคลียร์" แต่ไม่มีมูลค่า และในชุดตัวอย่าง
 *   ยังไม่ตรงกับบิลจริงด้วย (ชุดตัวอย่าง 12 ไฟล์: ธง 125 ใบ แต่หาบิลเจอ 26 ใบ เพราะไฟล์รายได้ตัวอย่างถูกสุ่มมาบางส่วน)
 */
import { useMemo, useState } from "react";
import { DBar, DLine } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { CC, Hero, KC, Note, Pane } from "../dash-fleet/parts";
import { BASE_F0, isFiltered, ListFF, MonthFF, SortTable, YearFF, duniq, fmt, monthLabel, passBase, pct, routeArrow, useSort } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../lib/ui/FilterBar";
import type { BaseFilter, Col } from "./common";
import type { CostRevMode } from "./CostRevDash";
import type { Trip } from "../../lib/data/useCostRev";

/** เส้นทางที่เที่ยวน้อยกว่านี้ไม่เอาขึ้นกราฟอันดับ — ฐานน้อย % แกว่งจนอ่านผิด (ยังอยู่ในตารางครบ) */
const MIN_TRIPS_RANK = 5;
const TOP_ROUTES = 10;

interface DmgRow {
  route: string;
  /** จำนวนเที่ยวทั้งหมดของเส้นทางนี้ — ตัวหารของสองอัตราหลัง */
  n: number;
  rev: number;
  /** มูลค่าบิลเคลียร์ · จำนวนรายการบิลเคลียร์ · จำนวนเที่ยวที่มีความเสียหายอย่างน้อย 1 รายการ */
  clrAmt: number; clrN: number; dmgTrips: number;
  /** null เมื่อไม่มีรายได้ — หารไม่ได้ ห้ามแสดงเป็น 0 */
  rate: number | null;
  incidence: number;
  incident: number;
}

/** รวมยอดตามคีย์ที่กำหนด — เขียนเองแทน groupBy() ของ common เพราะต้องมีคอลัมน์บิลเคลียร์ */
function aggregate(trips: Trip[], keyOf: (t: Trip) => string): DmgRow[] {
  const m = new Map<string, DmgRow>();
  for (const t of trips) {
    // ★ ไม่มี `if (!k) continue` แบบ groupBy() เพราะเที่ยวที่หลุดไปจะทำให้ผลรวมไม่ครบตามจำนวน
    //   เที่ยวที่จับคู่ได้ ซึ่งเป็นเงื่อนไขตรวจยอดของแท็บนี้ — keyOf ต้องคืนค่าที่ไม่ว่างเสมอ
    const k = keyOf(t);
    const a = m.get(k) ?? { route: k, n: 0, rev: 0, clrAmt: 0, clrN: 0, dmgTrips: 0, rate: null, incidence: 0, incident: 0 };
    a.n++; a.rev += t.rev; a.clrAmt += t.clrAmt; a.clrN += t.clrN;
    if (t.clrN > 0) a.dmgTrips++;
    m.set(k, a);
  }
  return [...m.values()].map((a) => ({
    ...a,
    rate: a.rev ? a.clrAmt / a.rev * 100 : null,
    incidence: a.n ? a.dmgTrips / a.n * 100 : 0,
    incident: a.n ? a.clrN / a.n : 0,
  }));
}

export default function DamageTab({ trips, mode, matchedTotal, isSample }: {
  trips: Trip[]; mode: CostRevMode; matchedTotal: number; isSample: boolean;
}) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // เที่ยวที่จับคู่ได้เท่านั้น — หน้า exec กรองมาให้แล้ว กรองซ้ำกันพลาดเวลามีคนส่ง trips ชุดอื่นเข้ามา
  const base = useMemo(() => trips.filter((t) => t.m), [trips]);
  const rows = useMemo(() => base.filter((t) => passBase(t, f)), [base, f]);

  const byRoute = useMemo(() => aggregate(rows, (t) => t.rt || routeArrow(t)), [rows]);

  /** ยอดรวมภาพรวม — รวมจาก rows ตรง ๆ ไม่ใช่เฉลี่ยจากรายเส้นทาง (เฉลี่ยของอัตราไม่ใช่อัตรารวม) */
  const kpi = useMemo(() => {
    const n = rows.length;
    const rev = rows.reduce((s, t) => s + t.rev, 0);
    const clrAmt = rows.reduce((s, t) => s + t.clrAmt, 0);
    const clrN = rows.reduce((s, t) => s + t.clrN, 0);
    const dmgTrips = rows.filter((t) => t.clrN > 0).length;
    return { n, rev, clrAmt, clrN, dmgTrips,
             rate: rev ? clrAmt / rev * 100 : null,
             incidence: n ? dmgTrips / n * 100 : 0,
             incident: n ? clrN / n : 0 };
  }, [rows]);

  /** อันดับเส้นทางที่เสียหายหนักสุดตามสัดส่วนมูลค่า */
  const topRate = useMemo(() => byRoute
    .filter((r) => r.n >= MIN_TRIPS_RANK && r.rate != null && r.rate > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).slice(0, TOP_ROUTES)
    .map((r) => ({ name: r.route, v: Math.round((r.rate ?? 0) * 1000) / 1000 })), [byRoute]);

  /** แนวโน้มรายเดือน — แสดงทุกเดือนทุกปีเสมอ ตัวกรองปี/เดือนไม่มีผล (แบบเดียวกับแท็บกำไรรายเที่ยว) */
  const monthly = useMemo(() => aggregate(
    base.filter((t) => passBase(t, f, { ignoreYear: true, ignoreMonth: true })), (t) => t.mo)
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((a) => ({
      mo: monthLabel(a.route),
      "Damage Rate %": Math.round((a.rate ?? 0) * 1000) / 1000,
      "Incidence Rate %": Math.round(a.incidence * 100) / 100,
    })), [base, f]);

  const cols = useMemo<Col<DmgRow>[]>(() => [
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "n", label: "จำนวนเที่ยวทั้งหมด", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้รวม", get: (r) => r.rev, num: true },
    { key: "clrAmt", label: "มูลค่าบิลเคลียร์", get: (r) => r.clrAmt, num: true,
      render: (r) => <span style={{ fontWeight: r.clrAmt ? 700 : 400, color: r.clrAmt ? "var(--red)" : undefined }}>{fmt(r.clrAmt, 2)}</span> },
    { key: "dmgTrips", label: "เที่ยวที่เสียหาย", get: (r) => r.dmgTrips, num: true },
    { key: "clrN", label: "รายการบิลเคลียร์", get: (r) => r.clrN, num: true },
    { key: "rate", label: "Damage Rate %", get: (r) => r.rate, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: dmgTone(r.rate) }}>{r.rate == null ? "–" : pct(r.rate, 3)}</span> },
    { key: "incidence", label: "Incidence Rate %", get: (r) => r.incidence, num: true,
      render: (r) => pct(r.incidence, 2) },
    { key: "incident", label: "Incident/เที่ยว", get: (r) => r.incident, num: true,
      render: (r) => fmt(r.incident, 4) },
  ], []);
  const { sorted, sort, toggle } = useSort(byRoute, cols, { key: "clrAmt", dir: -1 });

  if (mode === "all") {
    return (
      <div className="card">
        <h2>ดูได้เฉพาะใน Executive Dashboard</h2>
        <p className="muted">
          มูลค่าและจำนวนรายการความเสียหาย (บิลเคลียร์) อยู่ในไฟล์รายได้ ไม่ได้อยู่ในไฟล์ต้นทุน
          จึงคิดได้เฉพาะเที่ยวที่ <b>เลขที่ใบรายการจับคู่กับไฟล์รายได้ได้</b> เท่านั้น
          — เที่ยวที่เหลือในหน้านี้ไม่มีบิลให้อ้างอิง ถ้านับรวมเข้าไปตัวหารจะใหญ่เกินจริงและอัตราทุกตัวจะต่ำผิด
        </p>
        <p className="muted">
          ตัวเลขจริงดูได้ที่เมนู <b>Executive Dashboard</b> → แท็บ <b>Damage Rate</b>
          ({fmt(matchedTotal)} เที่ยวที่จับคู่ได้)
        </p>
      </div>
    );
  }

  const unfiltered = f.year === "" && f.month === "" && f.o === "" && f.de === "" && f.ft === "" && f.vk === "";
  const sumN = byRoute.reduce((s, r) => s + r.n, 0);
  const balanced = sumN === matchedTotal;

  return (
    <>
      <FilterBar>
        <YearFF trips={base} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="จุดขึ้น" all="ทุกจุดขึ้น" value={f.o} onChange={set("o")} opts={duniq(base.map((t) => t.o))} />
        <ListFF label="จุดลง" all="ทุกจุดลง" value={f.de} onChange={set("de")} opts={duniq(base.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(base.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(base.map((t) => t.vk))} />
        <ClearFiltersBtn active={isFiltered(f, BASE_F0)} onClick={() => setF(BASE_F0)} />
      </FilterBar>

      <Pane deps={[rows]}>
        <div className="dz-heroes">
          <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.rev)} s="บาท · เฉพาะเที่ยวที่จับคู่ได้" />
          <Hero kind="loss" l="มูลค่าบิลเคลียร์" v={fmt(kpi.clrAmt, 2)} s="บาท · มูลค่าความเสียหาย" />
          <Hero kind="svc" l="Damage Rate" v={kpi.rate == null ? "–" : pct(kpi.rate, 3)} s="มูลค่าบิลเคลียร์ ÷ รายได้รวม" />
        </div>
        <div className="dz-cards">
          <KC dot={D.indigo} l="จำนวนเที่ยวทั้งหมด" v={fmt(kpi.n)} s="เที่ยว · ฐานของทุกอัตรา" />
          <KC dot={D.violet} l="จำนวนเส้นทาง" v={fmt(byRoute.length)} s="เส้นทาง · จุดขึ้น-จุดลง ไม่ซ้ำ" />
          <KC dot={D.rose} tone={kpi.dmgTrips ? "warn" : undefined} l="เที่ยวที่เสียหาย" v={fmt(kpi.dmgTrips)} s="เที่ยว · มีบิลเคลียร์อย่างน้อย 1 รายการ" />
          <KC dot={D.orange} l="รายการบิลเคลียร์" v={fmt(kpi.clrN)} s="รายการ · เที่ยวเดียวมีได้หลายรายการ" />
          <KC dot={D.amber} tone={kpi.incidence > 0 ? "warn" : undefined} l="Damage Incidence Rate"
            v={pct(kpi.incidence, 2)} s="เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด" />
          <KC dot={D.teal} l="Damage Incident Rate" v={fmt(kpi.incident, 4)}
            s={`รายการ/เที่ยว · เท่ากับ ${fmt(kpi.incident * 100, 2)} ครั้งต่อ 100 เที่ยว`} />
        </div>
        <Note>
          รวม <b>{fmt(sumN)}</b> เที่ยว จาก <b>{fmt(byRoute.length)}</b> เส้นทาง
          {unfiltered && (balanced
            ? <> · ตรงกับจำนวนเที่ยวที่จับคู่กับไฟล์รายได้ได้ทั้งหมด ({fmt(matchedTotal)} เที่ยว) ✓</>
            : <b style={{ color: "var(--red)" }}> · ไม่ตรงกับจำนวนเที่ยวที่จับคู่ได้ ({fmt(matchedTotal)} เที่ยว) — มีเที่ยวตกหล่นจากการรวมยอด</b>)}
          {!unfiltered && <> · กรองอยู่ เทียบกับ {fmt(matchedTotal)} เที่ยวที่จับคู่ได้ทั้งหมด</>}
        </Note>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`เส้นทางที่ความเสียหายสูงสุด · Damage Rate % · ${TOP_ROUTES} อันดับแรก`} tall>
            <DBar data={topRate} xKey="name" horiz suffix=" %" digits={3}
              series={[{ key: "v", label: "Damage Rate %", color: D.rose }]} />
          </CC>
          <CC title="แนวโน้มความเสียหายรายเดือน" tall>
            <DLine data={monthly} xKey="mo" suffix=" %" digits={2} series={[
              { key: "Damage Rate %", label: "Damage Rate %", color: D.rose },
              { key: "Incidence Rate %", label: "Incidence Rate %", color: D.amber },
            ]} />
          </CC>
        </div>
        <Note>
          กราฟอันดับนับเฉพาะเส้นทางที่มีอย่างน้อย {MIN_TRIPS_RANK} เที่ยว — ฐานน้อยกว่านี้ % แกว่งจนเทียบกันไม่ได้
          (เส้นทางเหล่านั้นยังอยู่ในตารางด้านล่างครบ) · กราฟแนวโน้มแสดงทุกเดือนตลอดทุกปีเสมอ ตัวกรองปี/เดือนไม่มีผลกับกราฟนี้
        </Note>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <h4>ความเสียหายรายเส้นทาง · คลิกหัวคอลัมน์เพื่อเรียง</h4>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
            rowKey={(r) => r.route} empty="ไม่มีข้อมูลตามตัวกรองที่เลือก" />
        </div>
        <Note>
          ทุกอัตราคิดจากฐานของเส้นทางนั้นเอง ไม่ใช่ฐานรวมทั้งบริษัท ·
          <b> Damage Rate</b> = มูลค่าบิลเคลียร์ ÷ รายได้รวม ·
          <b> Incidence Rate</b> = เที่ยวที่เสียหาย ÷ เที่ยวทั้งหมด (นับเที่ยว ไม่นับซ้ำ) ·
          <b> Incident Rate</b> = รายการบิลเคลียร์ ÷ เที่ยวทั้งหมด (≥ Incidence เสมอ เพราะเที่ยวเดียวเสียหายได้หลายรายการ)
          {isSample && <b style={{ color: "var(--red)" }}> · ชุดข้อมูลตัวอย่างนี้สุ่มบิลมาบางส่วน ตัวเลขจึงต่ำกว่าความจริงมาก ให้ดูจากชุดข้อมูลจริง</b>}
        </Note>
      </Pane>
    </>
  );
}

/** สีตามระดับ Damage Rate — เทียบกับ 0.409% ที่เป็นค่าอ้างอิงในเอกสาร (เขียว < 0.5 · ส้ม < 1 · แดง ≥ 1) */
const dmgTone = (r: number | null): string | undefined =>
  r == null ? "var(--ink-faint)" : r === 0 ? undefined : r < 0.5 ? "var(--green)" : r < 1 ? "var(--orange-dark)" : "var(--red)";
