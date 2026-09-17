/**
 * แท็บย่อย "ลูกค้า (Pareto)" — หน้าที่สี่ของ PDF
 *   การ์ด 3 ใบ · เส้นโค้ง Pareto · ตาราง Top 10 ลูกค้า
 *
 * รหัสลูกค้าในไฟล์เป็น hash ของรหัสต้นฉบับ — แสดงผ่าน <ShortId> เหมือนหน้าลูกหนี้
 * ถ้าโหลดตารางรหัสไว้แล้วจะขึ้นเป็น CUSxxxxxxx ถ้ายังไม่โหลดจะย่อ hash ให้แทน
 */
import { useMemo } from "react";
import {
  Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { anim, axisProps, dFade, gridProps, tooltipProps } from "../../../lib/chart/primitives";
import { D, useChartTheme } from "../../../lib/chart/theme";
import { ShortId } from "../../../lib/custmap/ShortId";
import { KC, Note, Pane } from "../../dash-fleet/parts";
import { EmptyRow, fmt, pct, Tbl } from "./common";
import type { Dataset } from "../../../lib/data/useDataset";

function ParetoCurve({ curve }: { curve: { cust_pct: number; cum_pct: number }[] }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={curve} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis {...axisProps(t)} dataKey="cust_pct" type="number" domain={[0, 100]}
          tickFormatter={(v: number) => `${Math.round(v)}%`} />
        <YAxis {...axisProps(t)} domain={[0, 100]} width={52}
          tickFormatter={(v: number) => `${v}%`} />
        <Tooltip {...tooltipProps(t, "")}
          labelFormatter={(v: number) => `ลูกค้า ${Number(v).toFixed(1)}% แรก`}
          formatter={(v: number) => [pct(v), "รายได้สะสม"] as [string, string]} />
        <ReferenceLine y={80} stroke={t.status.serious} strokeDasharray="4 4"
          label={{ value: "80% ของรายได้", fill: t.inkMuted, fontSize: 11, position: "insideTopRight" }} />
        <Area type="monotone" dataKey="cum_pct" name="รายได้สะสม" stroke={D.amber}
          strokeWidth={2.2} fill={dFade(D.amber)} fillOpacity={1} dot={false}
          activeDot={{ r: 4 }} {...anim} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function ParetoTab({ data }: { data: Dataset }) {
  const p = data.pareto;
  const top10 = useMemo(() => data.customerTop.slice(0, 10), [data.customerTop]);

  return (
    <Pane deps={[data]}>
      <div className="dz-cards">
        <KC dot={D.indigo} l="จำนวนลูกค้าทั้งหมด" v={fmt(p.total_customers)} s="ราย" />
        <KC dot={D.amber} l="ลูกค้าที่สร้าง 80% ของรายได้"
          v={pct(p.pct_customers_for_80pct)} s={`${fmt(p.n_for_80pct)} ราย`} />
        <KC dot={D.teal} l="Top 1% ของลูกค้า"
          v={pct(p.concentration.top_1pct ?? 0)} s="ของรายได้ทั้งหมด" />
        <KC dot={D.violet} l="Top 10% ของลูกค้า"
          v={pct(p.concentration.top_10pct ?? 0)} s="ของรายได้ทั้งหมด" />
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <div className="dz-cc">
          <h4>Pareto Curve</h4>
          <div className="dz-box tall"><ParetoCurve curve={p.curve} /></div>
          <Note>
            แกนนอน = สัดส่วนลูกค้าเรียงจากรายได้มากไปน้อย · แกนตั้ง = รายได้สะสม
            — เส้นประคือระดับ 80% ของรายได้
          </Note>
        </div>

        <div className="dz-cc">
          <h4>Top 10 ลูกค้า</h4>
          <Tbl head={[["อันดับ", "n"], "รหัสลูกค้า", ["รายได้", "n"], ["จำนวนบิล", "n"]]}>
            {top10.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูลลูกค้า" /> : top10.map((c, i) => (
              <tr key={c["ผู้รับ_encoded"]}>
                <td className="n">{i + 1}</td>
                <td><ShortId v={c["ผู้รับ_encoded"]} n={c.n} /></td>
                <td className="n">{fmt(c.revenue)} บาท</td>
                <td className="n">{fmt(c.bills)}</td>
              </tr>
            ))}
          </Tbl>
          <Note>
            จัดอันดับตาม "ผู้รับ" ของบิล · รหัสถูก hash ไว้ตั้งแต่ต้นทาง กดค้างที่รหัสเพื่อดูค่าเต็ม
          </Note>
        </div>
      </div>
    </Pane>
  );
}
