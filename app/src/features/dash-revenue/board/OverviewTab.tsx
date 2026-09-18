/**
 * แท็บย่อย "ภาพรวม" — Transportation Revenue Dashboard ใน Executive Dashboard
 * คำนวณจากเที่ยววิ่งที่จับคู่ได้ในไฟล์ต้นทุน (trips ที่ m = true)
 * เพื่อให้ยอดรายได้รวม, จำนวนเที่ยว, แนวโน้ม และเส้นทาง ตรงกับแท็บ "กำไรรายเที่ยว" 100%
 */
import { useMemo, useState } from "react";
import { DBar, DPie } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { monthLabel } from "../../../lib/data/useDataset";
import { CC, Hero, KC, Note, Pane } from "../../dash-fleet/parts";
import { DualAxis, EmptyRow, fmt, PALETTE, pct, Tbl } from "./common";
import FilterBar, { ClearFiltersBtn } from "../../../lib/ui/FilterBar";
import type { Trip, CostRevManifest } from "../../../lib/data/useCostRev";

interface FilterState {
  y: string;
  mo: string;
  rt: string;
  sg: string;
  ft: string;
}

const F0: FilterState = { y: "", mo: "", rt: "", sg: "", ft: "" };

export default function OverviewTab({ trips, manifest }: {
  trips: Trip[];
  manifest?: CostRevManifest;
}) {
  const [f, setF] = useState<FilterState>(F0);
  const set = (k: keyof FilterState) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const reset = () => setF(F0);

  const years = useMemo(() => Array.from(new Set(trips.map((t) => String(t.y)))).sort(), [trips]);
  const months = useMemo(() => Array.from(new Set(trips.map((t) => t.mo))).sort(), [trips]);
  const routes = useMemo(() => Array.from(new Set(trips.map((t) => t.rt).filter(Boolean))).sort(), [trips]);
  const serviceGroups = useMemo(() => Array.from(new Set(trips.map((t) => t.sg || "ไม่ระบุ"))).sort(), [trips]);
  const fleetTypes = useMemo(() => Array.from(new Set(trips.map((t) => t.ft).filter(Boolean))).sort(), [trips]);

  const on = Boolean(f.y || f.mo || f.rt || f.sg || f.ft);

  const rows = useMemo(() => {
    return trips.filter((t) => {
      if (f.y && String(t.y) !== f.y) return false;
      if (f.mo && t.mo !== f.mo) return false;
      if (f.rt && t.rt !== f.rt) return false;
      if (f.sg && (t.sg || "ไม่ระบุ") !== f.sg) return false;
      if (f.ft && t.ft !== f.ft) return false;
      return true;
    });
  }, [trips, f]);

  const kpi = useMemo(() => {
    const totalRev = rows.reduce((s, t) => s + t.rev, 0);
    const totalCost = rows.reduce((s, t) => s + t.cost, 0);
    const totalProfit = rows.reduce((s, t) => s + t.profit, 0);
    const margin = totalRev ? (totalProfit / totalRev) * 100 : 0;
    const n = rows.length;
    const avgRev = n ? totalRev / n : 0;
    const avgCost = n ? totalCost / n : 0;
    const avgProfit = n ? totalProfit / n : 0;
    const clrAmt = rows.reduce((s, t) => s + t.clrAmt, 0);
    const clrN = rows.reduce((s, t) => s + t.clrN, 0);
    const emptyCount = rows.filter((t) => t.empty).length;
    const emptyPct = n ? (emptyCount / n) * 100 : 0;
    return { totalRev, totalCost, totalProfit, margin, n, avgRev, avgCost, avgProfit, clrAmt, clrN, emptyCount, emptyPct };
  }, [rows]);

  // แนวโน้มรายได้รายเดือน
  const monthlyTrend = useMemo(() => {
    const byMo = new Map<string, { mo: string; rev: number; cost: number; profit: number; n: number }>();
    for (const t of rows) {
      const item = byMo.get(t.mo) ?? { mo: t.mo, rev: 0, cost: 0, profit: 0, n: 0 };
      item.rev += t.rev;
      item.cost += t.cost;
      item.profit += t.profit;
      item.n++;
      byMo.set(t.mo, item);
    }
    return Array.from(byMo.values())
      .sort((a, b) => a.mo.localeCompare(b.mo))
      .map((m) => ({
        mo: monthLabel(m.mo),
        รายได้: Math.round(m.rev),
        "มูลค่าเฉลี่ย/เที่ยว": m.n ? Math.round(m.rev / m.n) : 0,
      }));
  }, [rows]);

  // สัดส่วนรายได้ตามกลุ่มบริการ (สินค้า)
  const productDonut = useMemo(() => {
    const bySg = new Map<string, { name: string; v: number; n: number }>();
    for (const t of rows) {
      const name = t.sg || "ไม่ระบุ";
      const item = bySg.get(name) ?? { name, v: 0, n: 0 };
      item.v += t.rev;
      item.n++;
      bySg.set(name, item);
    }
    return Array.from(bySg.values())
      .sort((a, b) => b.v - a.v)
      .map((p) => ({ name: p.name, v: Math.round(p.v), n: p.n }));
  }, [rows]);

  // 10 อันดับเส้นทางรายได้สูงสุด
  const routeRows = useMemo(() => {
    const byRt = new Map<string, { name: string; rev: number; cost: number; profit: number; n: number }>();
    for (const t of rows) {
      const name = t.rt || "(ไม่ระบุ)";
      const item = byRt.get(name) ?? { name, rev: 0, cost: 0, profit: 0, n: 0 };
      item.rev += t.rev;
      item.cost += t.cost;
      item.profit += t.profit;
      item.n++;
      byRt.set(name, item);
    }
    return Array.from(byRt.values()).sort((a, b) => b.rev - a.rev);
  }, [rows]);

  const topRoutes = useMemo(() => routeRows.slice(0, 10).map((r) => ({
    name: r.name,
    v: Math.round(r.rev),
  })), [routeRows]);

  return (
    <Pane deps={[trips, f]}>
      <FilterBar>
        <label className="ff">
          <span>ปี</span>
          <select value={f.y} onChange={(e) => set("y")(e.target.value)}>
            <option value="">ทุกปี ({years.join(", ")})</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="ff">
          <span>เดือน</span>
          <select value={f.mo} onChange={(e) => set("mo")(e.target.value)}>
            <option value="">ทุกเดือน</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <label className="ff">
          <span>เส้นทาง</span>
          <select value={f.rt} onChange={(e) => set("rt")(e.target.value)}>
            <option value="">ทุกเส้นทาง</option>
            {routes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
          </select>
        </label>
        <label className="ff">
          <span>กลุ่มบริการ</span>
          <select value={f.sg} onChange={(e) => set("sg")(e.target.value)}>
            <option value="">ทุกกลุ่ม</option>
            {serviceGroups.map((sg) => <option key={sg} value={sg}>{sg}</option>)}
          </select>
        </label>
        <label className="ff">
          <span>ประเภทรถ</span>
          <select value={f.ft} onChange={(e) => set("ft")(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {fleetTypes.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
          </select>
        </label>
        <ClearFiltersBtn active={on} onClick={reset} />
      </FilterBar>

      <Note>
        ข้อมูลคำนวณจากเที่ยววิ่งที่จับคู่ได้ใน <b>Executive Dashboard</b> ({fmt(trips.length)} เที่ยว) —
        ยอดรายได้รวมตรงกับแท็บ <b>กำไรรายเที่ยว</b> ทุกประการ
      </Note>

      <div className="dz-heroes">
        <Hero kind="rev" l="รายได้รวม" v={fmt(kpi.totalRev)} s="บาท" />
        <Hero kind="profit" l="กำไรสุทธิรวม" v={fmt(kpi.totalProfit)}
          s={`บาท · อัตรากำไร ${pct(kpi.margin, 2)}`} />
        <Hero kind={kpi.totalProfit < 0 ? "loss" : "rev"} l="ต้นทุนรวม"
          v={fmt(kpi.totalCost)} s="บาท" />
      </div>

      <div className="dz-cards">
        <KC dot={D.indigo} l="จำนวนเที่ยว" v={fmt(kpi.n)}
          s={on ? "เที่ยว (ตามตัวกรอง)" : "เที่ยว (จับคู่กับไฟล์ต้นทุนได้)"} />
        <KC dot={D.violet} l="รายได้เฉลี่ย/เที่ยว" v={fmt(kpi.avgRev)} s="บาท" />
        <KC dot={D.teal} l="ต้นทุนเฉลี่ย/เที่ยว" v={fmt(kpi.avgCost)} s="บาท" />
        <KC dot={D.emerald} l="กำไรเฉลี่ย/เที่ยว" v={fmt(kpi.avgProfit)} s="บาท" />
      </div>

      <div className="dz-cards" style={{ marginTop: 14 }}>
        <KC dot={D.orange} l="บิลเคลียร์ — มูลค่า"
          v={`${fmt(kpi.clrAmt)} บาท`}
          s={`${fmt(kpi.clrN)} รายการ`} />
        <KC dot={D.amber} l="เที่ยววิ่งเปล่า"
          v={`${fmt(kpi.emptyCount)} เที่ยว`}
          s={`${pct(kpi.emptyPct)} ของเที่ยวทั้งหมด`} />
        {manifest?.debtorPaid && (
          <KC dot={D.teal} l="บิลที่ชำระแล้ว (ไฟล์รายได้)"
            v={`฿${fmt(manifest.debtorPaid.total)}`}
            s={`${fmt(manifest.debtorPaid.bills)} บิล`} />
        )}
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <CC title="แนวโน้มรายได้รายเดือน" tall>
          <DualAxis data={monthlyTrend} xKey="mo"
            bar={{ key: "รายได้", label: "รายได้ (บาท)", color: D.amber }}
            line={{ key: "มูลค่าเฉลี่ย/เที่ยว", label: "เฉลี่ย/เที่ยว (บาท)", color: D.indigo }} />
        </CC>

        <div className="dz-cc">
          <h4>สัดส่วนรายได้ตามกลุ่มบริการ</h4>
          <div className="dz-box tall">
            <DPie data={productDonut} colors={PALETTE} />
          </div>
          <Note>กลุ่มบริการประเมินจากประเภทสินค้าในบิลรายได้ของเที่ยวที่จับคู่ได้</Note>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายได้ตามเส้นทาง · 10 อันดับแรก{on ? " (ตามตัวกรอง)" : ""}</h4>
        <div className="dz-box tall">
          <DBar data={topRoutes} xKey="name" horiz
            series={[{ key: "v", label: "รายได้", color: D.indigo }]} />
        </div>
        <Tbl head={["เส้นทาง", ["รายได้", "n"], ["จำนวนเที่ยว", "n"], ["ต้นทุน", "n"], ["กำไร", "n"], ["สัดส่วน", "n"]]}>
          {routeRows.length === 0 ? (
            <EmptyRow cols={6} text="ไม่มีเส้นทางตามตัวกรอง" />
          ) : (
            routeRows.slice(0, 30).map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="n">{fmt(r.rev)} บาท</td>
                <td className="n">{fmt(r.n)}</td>
                <td className="n">{fmt(r.cost)} บาท</td>
                <td className="n" style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>
                  {fmt(r.profit)} บาท
                </td>
                <td className="n">{pct(kpi.totalRev ? (r.rev / kpi.totalRev) * 100 : 0, 2)}</td>
              </tr>
            ))
          )}
        </Tbl>
        {routeRows.length > 30 && (
          <Note>แสดง 30 เส้นทางแรกจาก {fmt(routeRows.length)} เส้นทาง</Note>
        )}
      </div>
    </Pane>
  );
}
