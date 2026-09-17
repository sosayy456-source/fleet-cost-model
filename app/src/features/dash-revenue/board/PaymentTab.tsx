/**
 * แท็บย่อย "การชำระเงิน" — หน้าที่สองของ PDF
 *   ซ้าย  สัดส่วนรายได้ตามวิธีชำระเงิน  โดนัท
 *   ขวา   แนวโน้มวิธีชำระเงินรายเดือน   แท่งซ้อน
 *   ล่าง  ตาราง วิธีชำระเงิน / รายได้ / จำนวนบิล
 */
import { useMemo } from "react";
import { DPie } from "../../../lib/chart/dcharts";
import { monthLabel } from "../../../lib/data/useDataset";
import { Note, Pane } from "../../dash-fleet/parts";
import { EmptyRow, fmt, PALETTE, pct, StackBar, Tbl } from "./common";
import type { Dataset } from "../../../lib/data/useDataset";

const COL = "ประเภทการชำระเงิน";

export default function PaymentTab({ data }: { data: Dataset }) {
  /** เรียงจากมากไปน้อยเพื่อให้สีในโดนัทกับในแท่งซ้อนเป็นสีเดียวกันทุกหมวด */
  const types = useMemo(() => data.payment
    .map((p) => String(p[COL] ?? "(ไม่ระบุ)")), [data.payment]);

  const donut = useMemo(() => data.payment.map((p) => ({
    name: String(p[COL] ?? "(ไม่ระบุ)"),
    v: Math.round(p.revenue),
  })), [data.payment]);
  const total = donut.reduce((s, p) => s + p.v, 0);

  /** payment_monthly.json เป็นแถวยาว (เดือน × วิธี) ต้องกางเป็นคอลัมน์ก่อนวาดแท่งซ้อน */
  const stacked = useMemo(() => {
    const by = new Map<string, Record<string, string | number | null>>();
    for (const r of data.paymentMonthly) {
      const row = by.get(r.month) ?? { mo: monthLabel(r.month), _k: r.month };
      row[String(r[COL] ?? "(ไม่ระบุ)")] = Math.round(Number(r["ราคารวม"]) || 0);
      by.set(r.month, row);
    }
    return [...by.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => {
        // เดือนที่ไม่มีวิธีนั้นเลยต้องเป็น 0 ไม่ใช่ undefined ไม่งั้นแท่งซ้อนขาดเป็นช่วง ๆ
        for (const t of types) if (v[t] == null) v[t] = 0;
        return v;
      });
  }, [data.paymentMonthly, types]);

  const series = types.map((t, i) => ({ key: t, label: t, color: PALETTE[i % PALETTE.length]! }));

  return (
    <Pane deps={[data]}>
      <div className="dz-row dz-11">
        <div className="dz-cc">
          <h4>สัดส่วนรายได้ตามวิธีชำระเงิน</h4>
          <div className="dz-box tall"><DPie data={donut} colors={PALETTE} /></div>
        </div>
        <div className="dz-cc">
          <h4>แนวโน้มวิธีชำระเงินรายเดือน</h4>
          <div className="dz-box tall">
            <StackBar data={stacked} xKey="mo" series={series} />
          </div>
          <Note>ความสูงรวมของแท่ง = รายได้ทั้งเดือน · แต่ละสีคือวิธีชำระเงินหนึ่งวิธี</Note>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายได้ตามวิธีชำระเงิน</h4>
        <Tbl head={["วิธีชำระเงิน", ["รายได้", "n"], ["สัดส่วน", "n"], ["จำนวนบิล", "n"]]}>
          {data.payment.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูล" /> : data.payment.map((p) => (
            <tr key={String(p[COL])}>
              <td>{String(p[COL] ?? "(ไม่ระบุ)")}</td>
              <td className="n">{fmt(p.revenue)} บาท</td>
              <td className="n">{pct(total ? p.revenue / total * 100 : 0)}</td>
              <td className="n">{fmt(Number(p.bills ?? 0))}</td>
            </tr>
          ))}
        </Tbl>
      </div>
    </Pane>
  );
}
