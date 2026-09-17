/**
 * แท็บย่อย "แนวโน้ม & สินค้า" — หน้าแรกของ Dashboard รายได้ในไฟล์ PDF
 *   ซ้าย  แนวโน้มรายได้รายเดือน  แท่ง = รายได้ (แกนซ้าย) · เส้น = มูลค่าเฉลี่ย/บิล (แกนขวา)
 *   ขวา   สัดส่วนประเภทสินค้า   โดนัท
 */
import { useMemo } from "react";
import { DPie } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { monthLabel } from "../../../lib/data/useDataset";
import { Note, Pane } from "../../dash-fleet/parts";
import { DualAxis, EmptyRow, fmt, PALETTE, pct, Tbl } from "./common";
import type { Dataset } from "../../../lib/data/useDataset";

export default function TrendTab({ data }: { data: Dataset }) {
  const monthly = useMemo(() => data.monthly.map((m) => ({
    mo: monthLabel(m.month),
    รายได้: Math.round(m.revenue),
    // ปัดทศนิยมทิ้งตั้งแต่ตรงนี้ ป้ายบนเส้นจะได้ไม่ยาวกว่าตัวแท่ง
    "มูลค่าเฉลี่ย/บิล": m.avg_bill_value == null ? null : Math.round(m.avg_bill_value),
  })), [data.monthly]);

  const product = useMemo(() => data.product.map((p) => ({
    name: String(p["ประเภทสินค้า"] ?? "(ไม่ระบุ)"),
    v: Math.round(p.revenue),
    lines: Number(p.lines ?? 0),
  })), [data.product]);
  const productTotal = product.reduce((s, p) => s + p.v, 0);

  return (
    <Pane deps={[data]}>
      <div className="dz-row dz-2">
        <div className="dz-cc">
          <h4>แนวโน้มรายได้รายเดือน</h4>
          <div className="dz-box tall">
            <DualAxis data={monthly} xKey="mo"
              bar={{ key: "รายได้", label: "รายได้", color: D.amber }}
              line={{ key: "มูลค่าเฉลี่ย/บิล", label: "มูลค่าเฉลี่ย/บิล", color: D.indigo }} />
          </div>
          <Note>
            สองเส้นคนละหน่วยกันจึงแยกแกน — แท่งอ่านจากแกนซ้าย (บาท) เส้นอ่านจากแกนขวา (บาท/บิล)
          </Note>
        </div>

        <div className="dz-cc">
          <h4>สัดส่วนประเภทสินค้า</h4>
          <div className="dz-box tall">
            <DPie data={product} colors={PALETTE} />
          </div>
          <Note>
            หมวดที่เล็กกว่า 1% แทบมองไม่เห็นในวง — ดูตัวเลขจริงได้ในตารางข้างล่าง
          </Note>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายได้ตามประเภทสินค้า</h4>
        <Tbl head={["ประเภทสินค้า", ["รายได้", "n"], ["สัดส่วน", "n"], ["จำนวนรายการ", "n"]]}>
          {product.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูล" /> : product.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td className="n">{fmt(p.v)} บาท</td>
              <td className="n">{pct(productTotal ? p.v / productTotal * 100 : 0, 3)}</td>
              <td className="n">{fmt(p.lines)}</td>
            </tr>
          ))}
        </Tbl>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>ตัวเลขรายเดือน</h4>
        <Tbl head={["เดือน", ["รายได้", "n"], ["จำนวนบิล", "n"], ["มูลค่าเฉลี่ย/บิล", "n"], ["เติบโต", "n"]]}>
          {data.monthly.length === 0 ? <EmptyRow cols={5} text="ไม่มีข้อมูล" /> : data.monthly.map((m) => (
            <tr key={m.month}>
              <td>{monthLabel(m.month)}</td>
              <td className="n">{fmt(m.revenue)} บาท</td>
              <td className="n">{fmt(m.bills)}</td>
              <td className="n">{m.avg_bill_value == null ? "–" : fmt(m.avg_bill_value)}</td>
              <td className="n" style={{
                fontWeight: 700,
                color: m.growth_pct == null ? undefined
                  : m.growth_pct < 0 ? "var(--red)" : "var(--green)",
              }}>
                {m.growth_pct == null ? "–" : (m.growth_pct > 0 ? "+" : "") + pct(m.growth_pct)}
              </td>
            </tr>
          ))}
        </Tbl>
      </div>
    </Pane>
  );
}
