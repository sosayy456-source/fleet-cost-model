/**
 * แท็บ "ต้นทุน" — ตามเอกสาร "การจัดประเภทต้นทุนสำหรับ Dashboard"
 *
 *   ต้นทุนทั้งหมด = ต้นทุนสูญเปล่า + ต้นทุนปกติ
 *   ต้นทุนปกติ    = ผันแปร (น้ำมัน เบี้ยเลี้ยง ค่าธรรมเนียม) + กึ่งผันแปร (ค่าซ่อมรถ) + คงที่ (ค่าเสื่อม) + ค่าเช่า + อื่น ๆ
 *   (ฉบับแก้ 16 ก.ย. 2569: ค่าซ่อมแยกเป็นกลุ่มของตัวเอง · เบี้ยเลี้ยงนอกเส้นทางย้ายจากสูญเปล่ามาอยู่ในเบี้ยเลี้ยง)
 *
 *   KPI 9 ตัว · แต่ละกลุ่มมี "การแสดงผล" ตามเอกสาร · drill-down ตามเส้นทาง / เที่ยว / รถ
 *   ตัวกรอง: ช่วงเวลา เส้นทาง ประเภทรถ ทะเบียนรถ เที่ยวรถ (พนักงานขับรถตัดออก — ไฟล์ไม่มีคอลัมน์)
 */
import { useMemo, useState } from "react";
import { DBar, DPie } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { thDateSafe } from "../../lib/record/date";
import { CC, Hero, KC, Note, Pane, ResetBtn, TableHead, searchStyle } from "../dash-fleet/parts";
import { BASE_F0, ListFF, MonthFF, SortTable, YearFF, duniq, fmt, passBase, pct, routeArrow, sumBy, useSort } from "./common";
import type { BaseFilter, Col } from "./common";
import { fixedOf, normalOf, otherOf, semiOf, variableOf } from "../../lib/data/useCostRev";
import type { Trip } from "../../lib/data/useCostRev";

type Dim = "rt" | "pl" | "id";
const DIMS: { key: Dim; label: string }[] = [
  { key: "rt", label: "เส้นทาง" }, { key: "pl", label: "รถแต่ละคัน" }, { key: "id", label: "เที่ยวรถ" },
];

interface DrillRow { key: string; n: number; v: number; per: number; share: number; sub?: string }

/**
 * ตาราง drill-down หนึ่งกลุ่มต้นทุน — เลือกมิติ (เส้นทาง / รถ / เที่ยว) แล้วเรียงได้ทุกคอลัมน์ตัวเลข
 * ค่าของกลุ่มมาจาก valOf · แสดงเฉพาะแถวที่ค่า > 0 เพราะเที่ยวที่ไม่มีรายการนั้นไม่ควรโผล่
 */
function Drill({ title, trips, valOf, unit = "บาท", dims = DIMS }: {
  title: string; trips: Trip[]; valOf: (t: Trip) => number; unit?: string; dims?: { key: Dim; label: string }[];
}) {
  const [dim, setDim] = useState<Dim>(dims[0]!.key);
  const total = trips.reduce((s, t) => s + valOf(t), 0);
  const rows = useMemo<DrillRow[]>(() => {
    if (dim === "id") {
      return trips.filter((t) => valOf(t) > 0).map((t) => ({
        key: t.id, n: 1, v: valOf(t), per: valOf(t), share: total ? valOf(t) / total * 100 : 0,
        sub: `${thDateSafe(t.d)} · ${routeArrow(t)} · ${t.pl}`,
      }));
    }
    return sumBy(trips, (t) => t[dim], valOf).filter((a) => a.v > 0)
      .map((a) => ({ key: a.key, n: a.n, v: a.v, per: a.v / a.n, share: total ? a.v / total * 100 : 0 }));
  }, [trips, dim, valOf, total]);
  const cols = useMemo<Col<DrillRow>[]>(() => [
    { key: "key", label: dims.find((d) => d.key === dim)?.label ?? "", get: (r) => r.key,
      render: (r) => <>{r.key}{r.sub && <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{r.sub}</div>}</> },
    { key: "n", label: "เที่ยว", get: (r) => r.n, num: true },
    { key: "v", label: `รวม (${unit})`, get: (r) => r.v, num: true },
    { key: "per", label: `ต่อเที่ยว (${unit})`, get: (r) => r.per, num: true },
    { key: "share", label: "สัดส่วน", get: (r) => r.share, num: true, render: (r) => pct(r.share) },
  ], [dim, dims, unit]);
  const { sorted, sort, toggle } = useSort(rows, cols, { key: "v", dir: -1 });
  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <TableHead title={title}>
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>ดูตาม</span>
        <div className="srcfilter">
          {dims.map((d) => (
            <button key={d.key} type="button" className={dim === d.key ? "on" : ""} onClick={() => setDim(d.key)}>{d.label}</button>
          ))}
        </div>
      </TableHead>
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key} empty="ไม่มีรายการในกลุ่มนี้ตามเงื่อนไข" />
    </div>
  );
}

const FUEL_PARTS: { key: keyof Trip; label: string }[] = [
  { key: "f_down", label: "น้ำมันขาล่อง" }, { key: "f_up", label: "น้ำมันขาขึ้น" },
  { key: "f_pickup", label: "น้ำมันไปเก็บสินค้า" }, { key: "f_call", label: "น้ำมันเรียกรถไปขึ้นของ" },
  { key: "f_cash", label: "น้ำมันเดินทาง (เงินสด)" },
];
const ALLOW_PARTS: { key: keyof Trip; label: string }[] = [
  { key: "a_drv", label: "เบี้ยเลี้ยงพนักงานขับรถ" }, { key: "a_spare", label: "เบี้ยเลี้ยงพนักงานขับรถสำรอง" },
  { key: "a_off", label: "เบี้ยเลี้ยงนอกเส้นทาง" },
];
const FEE_PARTS: { key: keyof Trip; label: string }[] = [
  { key: "fe_tarp", label: "ค่าปิดเปิดผ้าใบ" }, { key: "fe_police", label: "ค่าตำรวจ" }, { key: "fe_insure", label: "ค่าประกันสินค้า" },
  { key: "fe_cont", label: "ค่าธรรมเนียมคืนตู้" }, { key: "fe_port", label: "ค่าเข้าท่าเรือ" }, { key: "fe_doc", label: "ค่าส่งเอกสาร" },
  { key: "fe_toll", label: "ค่าทางด่วน" },
];
const FEE_COLORS = [D.indigo, D.violet, D.teal, D.amber, D.orange, D.cyan, D.slate];

interface Filter extends BaseFilter { pl: string; q: string }
const F0: Filter = { ...BASE_F0, pl: "", q: "" };

export default function CostTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<Filter>(F0);
  const set = (k: keyof Filter) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const rows = useMemo(() => {
    const q = f.q.trim();
    return trips.filter((t) => passBase(t, f) && (!f.pl || t.pl === f.pl) && (!q || t.id.includes(q)));
  }, [trips, f]);

  const sum = (fn: (t: Trip) => number) => rows.reduce((s, t) => s + fn(t), 0);
  const n = rows.length;
  const kmRows = rows.filter((t) => t.km != null);
  const km = kmRows.reduce((s, t) => s + (t.km ?? 0), 0);
  const perKm = (fn: (t: Trip) => number) => (km ? kmRows.reduce((s, t) => s + fn(t), 0) / km : 0);
  const months = new Set(rows.map((t) => t.mo)).size;
  const plates = new Set(rows.map((t) => t.pl)).size;

  const k = {
    total: sum((t) => t.cost), normal: sum(normalOf), waste: sum((t) => t.waste),
    variable: sum(variableOf), semi: sum(semiOf), fixed: sum(fixedOf), rent: sum((t) => t.rent), other: sum(otherOf),
    fuel: sum((t) => t.fuel), allow: sum((t) => t.allow), fee: sum((t) => t.fee),
    repair: sum((t) => t.repair), dep: sum((t) => t.dep),
  };
  const wastePct = k.total ? k.waste / k.total * 100 : 0;

  const partRows = (parts: { key: keyof Trip; label: string }[]) =>
    parts.map((p) => ({ label: p.label, v: Math.round(sum((t) => t[p.key] as number)) }));
  const fuelParts = partRows(FUEL_PARTS);
  const allowParts = partRows(ALLOW_PARTS);
  const feeParts = partRows(FEE_PARTS).filter((p) => p.v > 0);

  return (
    <>
      <div className="dz-filters">
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="ต้นทาง" all="ทุกต้นทาง" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="ปลายทาง" all="ทุกปลายทาง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ListFF label="ทะเบียนรถ" all="ทุกทะเบียน" value={f.pl} onChange={set("pl")} opts={duniq(trips.map((t) => t.pl))} />
        <div className="ff">
          <label>เที่ยวรถ</label>
          <input style={{ ...searchStyle, minWidth: 180 }} value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="เลขที่ใบรายการ" />
        </div>
        <ResetBtn onClick={() => setF(F0)} />
      </div>

      <Pane deps={[rows]}>
        {/* KPI หลัก 8 ตัว */}
        <div className="dz-heroes">
          <Hero kind="cost" l="ต้นทุนทั้งหมด" v={fmt(k.total)} s={<>บาท · {fmt(n)} เที่ยว</>} />
          <Hero kind="fleet" l="ต้นทุนปกติ" v={fmt(k.normal)} s="บาท · ต้นทุนทั้งหมด − สูญเปล่า" />
          <Hero kind="loss" l="ต้นทุนสูญเปล่า" v={fmt(k.waste)} s={<>บาท · {pct(wastePct, 2)} ของต้นทุนทั้งหมด</>} />
        </div>
        <div className="dz-cards">
          <KC dot={D.rose} tone={wastePct > 0 ? "warn" : undefined} l="ต้นทุนสูญเปล่าต่อต้นทุนทั้งหมด" v={pct(wastePct, 2)} s="น้ำมันนอกเส้นทาง · Fleet Card นอกเส้นทาง · วิ่งอ้อม" />
          <KC dot={D.indigo} l="ต้นทุนผันแปร" v={fmt(k.variable)} s="บาท · น้ำมัน + เบี้ยเลี้ยง + ค่าธรรมเนียม" />
          <KC dot={D.amber} l="ต้นทุนคงที่กึ่งผันแปร" v={fmt(k.semi)} s="บาท · ค่าซ่อมรถ" />
          <KC dot={D.slateDeep} l="ต้นทุนคงที่" v={fmt(k.fixed)} s="บาท · ค่าเสื่อมราคา" />
          <KC dot={D.teal} l="ต้นทุนต่อเที่ยว" v={fmt(n ? k.total / n : 0)} s="บาท/เที่ยว" />
          <KC dot={D.cyan} l="ต้นทุนต่อกิโลเมตร" v={fmt(perKm((t) => t.cost), 2)}
            s={<>บาท/กม. · จากเที่ยวที่รู้ระยะทาง {n ? Math.round(kmRows.length / n * 100) : 0}%</>} />
        </div>
        <Note>
          ต้นทุนปกติ {fmt(k.normal)} = ผันแปร {fmt(k.variable)} + กึ่งผันแปร {fmt(k.semi)} + คงที่ {fmt(k.fixed)} + ค่าเช่ารถ {fmt(k.rent)} +
          อื่น ๆ {fmt(k.other)} (แก๊ส · Fleet Card เดินทาง · เพิ่มย้อนหลัง · SND) — ค่าเช่าและอื่น ๆ ไม่อยู่ในกลุ่มใดตามเอกสาร จึงแสดงไว้ให้ยอดบวกกันครบ
        </Note>

        {/* 1. ต้นทุนสูญเปล่า */}
        <Drill title={`1) ต้นทุนสูญเปล่า · รวม ${fmt(k.waste)} บาท (${pct(wastePct, 2)})`} trips={rows} valOf={(t) => t.waste} />

        {/* 2.1.1 ค่าน้ำมัน */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`2.1.1) ค่าน้ำมัน · รวม ${fmt(k.fuel)} บาท`}>
            <DBar data={fuelParts} xKey="label" horiz series={[{ key: "v", label: "บาท", color: D.indigo }]} />
          </CC>
          <div className="dz-cc">
            <h4>ค่าน้ำมัน · ตัวชี้วัด</h4>
            <div className="dz-cards" style={{ marginTop: 10 }}>
              <KC dot={D.indigo} l="ค่าน้ำมันรวม" v={fmt(k.fuel)} s="บาท" />
              <KC dot={D.teal} l="ต้นทุนน้ำมันต่อเที่ยว" v={fmt(n ? k.fuel / n : 0)} s="บาท/เที่ยว" />
              <KC dot={D.cyan} l="ต้นทุนน้ำมันต่อกิโลเมตร" v={fmt(perKm((t) => t.fuel), 2)} s="บาท/กม." />
              {fuelParts.map((p) => <KC key={p.label} dot={D.slate} l={p.label} v={fmt(p.v)} s="บาท" />)}
            </div>
          </div>
        </div>

        {/* 2.1.2 ค่าเบี้ยเลี้ยง */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`2.1.2) ค่าเบี้ยเลี้ยง · รวม ${fmt(k.allow)} บาท`}>
            <DBar data={allowParts} xKey="label" horiz series={[{ key: "v", label: "บาท", color: D.violet }]} />
          </CC>
          <div className="dz-cc">
            <h4>ค่าเบี้ยเลี้ยง · แยกตามประเภท</h4>
            <div className="dz-cards" style={{ marginTop: 10 }}>
              <KC dot={D.violet} l="ค่าเบี้ยเลี้ยงรวม" v={fmt(k.allow)} s="บาท" />
              {allowParts.map((p) => <KC key={p.label} dot={D.slate} l={p.label} v={fmt(p.v)} s="บาท" />)}
            </div>
            <Note>เบี้ยเลี้ยงนอกเส้นทางนับอยู่ในต้นทุนสูญเปล่า · "ดูตามพนักงานขับรถ" ยังทำไม่ได้ เพราะไฟล์ไม่มีคอลัมน์คนขับ</Note>
          </div>
        </div>
        <Drill title="ค่าเบี้ยเลี้ยง · ดูตามเที่ยว / เส้นทาง" trips={rows} valOf={(t) => t.allow}
          dims={[{ key: "rt", label: "เส้นทาง" }, { key: "id", label: "เที่ยวรถ" }]} />

        {/* 2.1.3 ค่าธรรมเนียม */}
        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`2.1.3) ค่าธรรมเนียม · สัดส่วนแต่ละประเภท · รวม ${fmt(k.fee)} บาท`} tall>
            {feeParts.length
              ? <DPie data={feeParts.map((p) => ({ name: p.label, v: p.v }))} colors={FEE_COLORS} />
              : <div style={{ padding: 20, color: "var(--ink-faint)", textAlign: "center" }}>ไม่มีค่าธรรมเนียมตามเงื่อนไข</div>}
          </CC>
          <div className="dz-cc">
            <h4>ค่าธรรมเนียม · แยกตามประเภท</h4>
            <div className="dz-cards" style={{ marginTop: 10 }}>
              <KC dot={D.teal} l="ค่าธรรมเนียมรวม" v={fmt(k.fee)} s="บาท" />
              {partRows(FEE_PARTS).map((p) => (
                <KC key={p.label} dot={D.slate} l={p.label} v={fmt(p.v)} s={k.fee ? pct(p.v / k.fee * 100) : "–"} />
              ))}
            </div>
          </div>
        </div>

        {/* 2.2.1 ค่าซ่อมรถ — ต้นทุนคงที่กึ่งผันแปร (การแยก FC/VC เป็นของทีมค่าซ่อม จึงแสดงแค่ยอดรวม) */}
        <div className="dz-cards" style={{ marginTop: 14 }}>
          <KC dot={D.amber} l="2.2.1) ค่าซ่อมรถรวม" v={fmt(k.repair)} s="บาท · ต้นทุนคงที่กึ่งผันแปร (มีทั้งส่วนคงที่ตามเวลาและผันแปรตามระยะทาง)" />
          <KC dot={D.amber} l="ค่าซ่อมต่อกิโลเมตร" v={fmt(perKm((t) => t.repair), 2)} s="บาท/กม." />
          <KC dot={D.amber} l="ค่าซ่อมต่อเที่ยว" v={fmt(n ? k.repair / n : 0)} s="บาท/เที่ยว" />
        </div>
        <Drill title="ค่าซ่อม · แยกตามรถและเส้นทาง" trips={rows} valOf={(t) => t.repair}
          dims={[{ key: "pl", label: "รถแต่ละคัน" }, { key: "rt", label: "เส้นทาง" }]} />

        {/* 2.3.1 ค่าเสื่อม */}
        <div className="dz-cards" style={{ marginTop: 14 }}>
          <KC dot={D.slateDeep} l="2.3.1) ค่าเสื่อมราคารวม" v={fmt(k.dep)} s="บาท · ต้นทุนคงที่" />
          <KC dot={D.slateDeep} l="ค่าเสื่อมราคาต่อเดือน" v={fmt(months ? k.dep / months : 0)} s={<>บาท/เดือน · {months} เดือนที่มีข้อมูล</>} />
          <KC dot={D.slateDeep} l="ค่าเสื่อมราคาต่อรถ" v={fmt(plates ? k.dep / plates : 0)} s={<>บาท/คัน · {plates} คัน</>} />
          <KC dot={D.slateDeep} l="ค่าเสื่อมราคาต่อเที่ยว" v={fmt(n ? k.dep / n : 0)} s="บาท/เที่ยว" />
          <KC dot={D.slateDeep} l="ค่าเสื่อมราคาต่อกิโลเมตร" v={fmt(perKm((t) => t.dep), 2)} s="บาท/กม." />
        </div>
      </Pane>
    </>
  );
}
