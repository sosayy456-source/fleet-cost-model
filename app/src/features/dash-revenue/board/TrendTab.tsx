/**
 * แท็บย่อย "แนวโน้ม & สินค้า" — คำนวณจากเที่ยววิ่งที่จับคู่ได้ใน Executive Dashboard
 * แสดงแนวโน้มรายได้รายเดือน และสัดส่วนตามกลุ่มบริการสินค้า / ประเภทรถ
 */
import { useMemo } from "react";
import { DPie } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { monthLabel } from "../../../lib/data/useDataset";
import { Note, Pane } from "../../dash-fleet/parts";
import { DualAxis, EmptyRow, fmt, PALETTE, pct, Tbl } from "./common";
import type { Trip } from "../../../lib/data/useCostRev";

export default function TrendTab({ trips }: { trips: Trip[] }) {
  // สรุปยอดรายเดือน
  const monthly = useMemo(() => {
    const byMo = new Map<string, { mo: string; rev: number; cost: number; profit: number; n: number }>();
    for (const t of trips) {
      const row = byMo.get(t.mo) ?? { mo: t.mo, rev: 0, cost: 0, profit: 0, n: 0 };
      row.rev += t.rev;
      row.cost += t.cost;
      row.profit += t.profit;
      row.n++;
      byMo.set(t.mo, row);
    }
    const sorted = Array.from(byMo.values()).sort((a, b) => a.mo.localeCompare(b.mo));
    return sorted.map((m, i) => {
      const prevRev = i > 0 ? sorted[i - 1]?.rev : null;
      const growth = prevRev ? ((m.rev - prevRev) / prevRev) * 100 : null;
      return {
        key: m.mo,
        mo: monthLabel(m.mo),
        รายได้: Math.round(m.rev),
        ต้นทุน: Math.round(m.cost),
        กำไร: Math.round(m.profit),
        เที่ยว: m.n,
        "มูลค่าเฉลี่ย/เที่ยว": m.n ? Math.round(m.rev / m.n) : 0,
        growth,
      };
    });
  }, [trips]);

  // สัดส่วนกลุ่มบริการสินค้า
  const product = useMemo(() => {
    const bySg = new Map<string, { name: string; rev: number; cost: number; profit: number; n: number }>();
    for (const t of trips) {
      const name = t.sg || "(ไม่ระบุ)";
      const row = bySg.get(name) ?? { name, rev: 0, cost: 0, profit: 0, n: 0 };
      row.rev += t.rev;
      row.cost += t.cost;
      row.profit += t.profit;
      row.n++;
      bySg.set(name, row);
    }
    return Array.from(bySg.values()).sort((a, b) => b.rev - a.rev);
  }, [trips]);

  const totalProductRev = product.reduce((s, p) => s + p.rev, 0);
  const donut = useMemo(() => product.map((p) => ({
    name: p.name,
    v: Math.round(p.rev),
  })), [product]);

  // สัดส่วนประเภทรถ
  const byFleetType = useMemo(() => {
    const byFt = new Map<string, { name: string; rev: number; n: number }>();
    for (const t of trips) {
      const name = t.ft || "(ไม่ระบุ)";
      const row = byFt.get(name) ?? { name, rev: 0, n: 0 };
      row.rev += t.rev;
      row.n++;
      byFt.set(name, row);
    }
    return Array.from(byFt.values()).sort((a, b) => b.rev - a.rev);
  }, [trips]);

  return (
    <Pane deps={[trips]}>
      <div className="dz-row dz-2">
        <div className="dz-cc">
          <h4>แนวโน้มรายได้รายเดือน</h4>
          <div className="dz-box tall">
            <DualAxis data={monthly} xKey="mo"
              bar={{ key: "รายได้", label: "รายได้ (บาท)", color: D.amber }}
              line={{ key: "มูลค่าเฉลี่ย/เที่ยว", label: "เฉลี่ย/เที่ยว (บาท)", color: D.indigo }} />
          </div>
          <Note>
            คำนวณจากเที่ยววิ่งที่จับคู่ได้ใน Executive Dashboard — แท่งอ่านจากแกนซ้าย เส้นอ่านจากแกนขวา
          </Note>
        </div>

        <div className="dz-cc">
          <h4>สัดส่วนรายได้ตามกลุ่มบริการสินค้า</h4>
          <div className="dz-box tall">
            <DPie data={donut} colors={PALETTE} />
          </div>
          <Note>
            กลุ่มบริการอนุมานจากประเภทสินค้าที่มีมากที่สุดในบิลของเที่ยววิ่งนั้น
          </Note>
        </div>
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <div className="dz-cc">
          <h4>รายได้ตามกลุ่มบริการ</h4>
          <Tbl head={["กลุ่มบริการ", ["รายได้", "n"], ["สัดส่วน", "n"], ["จำนวนเที่ยว", "n"], ["กำไร", "n"]]}>
            {product.length === 0 ? <EmptyRow cols={5} text="ไม่มีข้อมูล" /> : product.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="n">{fmt(p.rev)} บาท</td>
                <td className="n">{pct(totalProductRev ? (p.rev / totalProductRev) * 100 : 0, 2)}</td>
                <td className="n">{fmt(p.n)}</td>
                <td className="n" style={{ color: p.profit < 0 ? "var(--red)" : "var(--green)" }}>
                  {fmt(p.profit)} บาท
                </td>
              </tr>
            ))}
          </Tbl>
        </div>

        <div className="dz-cc">
          <h4>รายได้ตามประเภทรถ</h4>
          <Tbl head={["ประเภทรถ", ["รายได้", "n"], ["สัดส่วน", "n"], ["จำนวนเที่ยว", "n"]]}>
            {byFleetType.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูล" /> : byFleetType.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td className="n">{fmt(f.rev)} บาท</td>
                <td className="n">{pct(totalProductRev ? (f.rev / totalProductRev) * 100 : 0, 2)}</td>
                <td className="n">{fmt(f.n)}</td>
              </tr>
            ))}
          </Tbl>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>ตัวเลขสรุปรายเดือน</h4>
        <Tbl head={["เดือน", ["รายได้", "n"], ["ต้นทุน", "n"], ["กำไร", "n"], ["จำนวนเที่ยว", "n"], ["เฉลี่ย/เที่ยว", "n"], ["เติบโต", "n"]]}>
          {monthly.length === 0 ? <EmptyRow cols={7} text="ไม่มีข้อมูล" /> : monthly.map((m) => (
            <tr key={m.key}>
              <td>{m.mo}</td>
              <td className="n">{fmt(m.รายได้)} บาท</td>
              <td className="n">{fmt(m.ต้นทุน)} บาท</td>
              <td className="n" style={{ color: m.กำไร < 0 ? "var(--red)" : "var(--green)" }}>
                {fmt(m.กำไร)} บาท
              </td>
              <td className="n">{fmt(m.เที่ยว)}</td>
              <td className="n">{fmt(m["มูลค่าเฉลี่ย/เที่ยว"])} บาท</td>
              <td className="n" style={{
                fontWeight: 700,
                color: m.growth == null ? undefined : m.growth < 0 ? "var(--red)" : "var(--green)",
              }}>
                {m.growth == null ? "–" : (m.growth > 0 ? "+" : "") + pct(m.growth)}
              </td>
            </tr>
          ))}
        </Tbl>
      </div>
    </Pane>
  );
}
