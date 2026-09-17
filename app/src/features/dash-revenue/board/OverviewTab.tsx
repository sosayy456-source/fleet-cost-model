/**
 * แท็บย่อย "ภาพรวม" — หน้ารวม (TRANSPORTATION REVENUE DASHBOARD) ตามสเปกที่เพื่อนเจ้าของงานส่งมา
 *
 * เรียงตามรูป: แถว KPI 2 ชั้น · แนวโน้มรายได้ + สถานะการชำระเงิน · ลูกค้า Good/Bad · เส้นทาง
 *
 * ★ สิ่งที่ทำไม่ได้จากไฟล์บิล และเหตุผล
 *   - "Overdue" ในบล็อกสถานะการชำระเงิน — ไฟล์บิลมีแค่ชำระ/ยังไม่ชำระ **ไม่มีวันครบกำหนด**
 *     จึงแยกเกินกำหนดไม่ได้ ต้องดูที่แท็บ "Dashboard ลูกหนี้" ซึ่งอ่านไฟล์ใบวางบิลที่มีวันครบกำหนด
 *     (สองชุดนี้ join กันไม่ได้ — คนละเลขเอกสาร รหัสลูกค้าคนละความยาว)
 *   - "Revenue by Vehicle" — ไฟล์บิลไม่มีชนิดรถ ต้องใช้ไฟล์ต้นทุนรายเที่ยว (คนละแท็บ)
 *
 * ★ ตามที่เขียนกำกับไว้ในรูป
 *   - ช่อง Outstanding/Unpaid เปลี่ยนเป็น "บิลเคลียร์ จำนวน (%)"
 *   - Top 10 ลูกค้าแยก Good/Bad สองฝั่ง
 *   - เส้นทางมีจำนวนเที่ยวกำกับ
 */
import { useMemo } from "react";
import { DBar } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { ShortId } from "../../../lib/custmap/ShortId";
import { monthLabel } from "../../../lib/data/useDataset";
import { CC, Hero, KC, Note, Pane } from "../../dash-fleet/parts";
import { DualAxis, EmptyRow, fmt, pct, Tbl } from "./common";
import type { Dataset } from "../../../lib/data/useDataset";

export default function OverviewTab({ data }: { data: Dataset }) {
  const o = data.overview;
  const months = data.monthly;
  /** เติบโตของเดือนล่าสุดที่มีค่า — สเปกเรียก "Revenue Growth" */
  const growth = useMemo(() => {
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i]?.growth_pct != null) return months[i]!.growth_pct!;
    }
    return null;
  }, [months]);

  const trend = useMemo(() => months.map((m) => ({
    mo: monthLabel(m.month),
    รายได้: Math.round(m.revenue),
    "มูลค่าเฉลี่ย/บิล": m.avg_bill_value == null ? null : Math.round(m.avg_bill_value),
  })), [months]);

  const payChart = [
    { label: "ชำระแล้ว", v: Math.round(o.paid_amount) },
    { label: "ยังไม่ได้ชำระ", v: Math.round(o.unpaid_amount) },
  ];

  const topCust = useMemo(() => data.customerTop.slice(0, 10), [data.customerTop]);
  const lowCust = data.customerLow;
  const routes = useMemo(() => data.routes.slice(0, 10).map((r) => ({
    name: String(r.route ?? "(ไม่ระบุ)"), v: Math.round(r.revenue),
  })), [data.routes]);

  return (
    <Pane deps={[data]}>
      <div className="dz-heroes">
        <Hero kind="rev" l="รายได้รวม" v={fmt(o.total_revenue)} s="บาท" />
        <Hero kind="profit" l="เก็บเงินได้แล้ว" v={fmt(o.paid_amount)}
          s={`บาท · อัตราเก็บเงิน ${pct(o.collection_rate)}`} />
        <Hero kind={o.unpaid_amount > 0 ? "loss" : "profit"} l="ยังไม่ได้ชำระ"
          v={fmt(o.unpaid_amount)} s={`บาท · ${fmt(o.unpaid_bills)} บิล`} />
      </div>

      <div className="dz-cards">
        <KC dot={D.indigo} l="จำนวนบิล" v={fmt(o.distinct_bills)} s="บิล" />
        <KC dot={D.violet} l="จำนวนเที่ยว" v={fmt(o.trips)} s="เที่ยว (เลขที่ใบรายการไม่ซ้ำ)" />
        <KC dot={D.teal} l="จำนวนลูกค้า" v={fmt(o.customers)} s="ราย (นับจากผู้รับ)" />
        <KC dot={D.amber} tone={growth != null && growth < 0 ? "bad" : "good"} l="เติบโตเดือนล่าสุด"
          v={growth == null ? "–" : (growth > 0 ? "+" : "") + pct(growth)} s="เทียบเดือนก่อนหน้า" />
      </div>

      <div className="dz-cards" style={{ marginTop: 14 }}>
        <KC dot={D.indigo} l="รายได้เฉลี่ย/บิล" v={fmt(o.avg_bill_value)} s="บาท" />
        <KC dot={D.violet} l="รายได้เฉลี่ย/เที่ยว" v={fmt(o.avg_trip_value)} s="บาท" />
        <KC dot={D.teal} l="รายได้เฉลี่ย/ลูกค้า" v={fmt(o.avg_customer_value)} s="บาท" />
        {/* ช่องนี้สเปกเดิมเป็น Outstanding/Unpaid แต่กาทิ้งแล้วเขียนว่าเอาบิลเคลียร์แทน */}
        <KC dot={D.orange} l="บิลเคลียร์" v={fmt(o.bill_clear_bills)}
          s={`บิล · ${pct(o.bill_clear_pct, 2)} ของบิลทั้งหมด · ${fmt(o.bill_clear_amount)} บาท`} />
      </div>

      <div className="dz-row dz-2" style={{ marginTop: 14 }}>
        <CC title="แนวโน้มรายได้รายเดือน" tall>
          <DualAxis data={trend} xKey="mo"
            bar={{ key: "รายได้", label: "รายได้", color: D.amber }}
            line={{ key: "มูลค่าเฉลี่ย/บิล", label: "มูลค่าเฉลี่ย/บิล", color: D.indigo }} />
        </CC>
        <div className="dz-cc">
          <h4>สถานะการชำระเงิน</h4>
          <div className="dz-box">
            <DBar data={payChart} xKey="label" colors={[D.emerald, D.rose]}
              series={[{ key: "v", label: "ยอด", color: D.emerald }]} />
          </div>
          <Tbl head={["สถานะ", ["ยอด", "n"], ["สัดส่วน", "n"], ["จำนวนบิล", "n"]]}>
            <tr>
              <td>ชำระแล้ว</td>
              <td className="n">{fmt(o.paid_amount)} บาท</td>
              <td className="n">{pct(o.collection_rate, 2)}</td>
              <td className="n">{fmt(o.paid_bills)}</td>
            </tr>
            <tr>
              <td>ยังไม่ได้ชำระ</td>
              <td className="n">{fmt(o.unpaid_amount)} บาท</td>
              <td className="n">
                {pct(o.total_revenue ? o.unpaid_amount / o.total_revenue * 100 : 0, 2)}
              </td>
              <td className="n">{fmt(o.unpaid_bills)}</td>
            </tr>
          </Tbl>
          <Note>
            ไฟล์บิล<b>ไม่มีวันครบกำหนด</b> จึงแยก "เกินกำหนด" ที่นี่ไม่ได้ —
            อายุหนี้กับอัตราเก็บเงินตามกำหนดอยู่ที่แท็บ <b>Dashboard ลูกหนี้</b> ซึ่งอ่านไฟล์ใบวางบิล
            (คนละชุดข้อมูล เอายอดมารวมกันไม่ได้)
          </Note>
        </div>
      </div>

      <div className="dz-row dz-11" style={{ marginTop: 14 }}>
        <div className="dz-cc">
          <h4>ลูกค้าที่ทำรายได้สูงสุด 10 ราย</h4>
          <Tbl head={[["#", "n"], "รหัสลูกค้า", ["รายได้", "n"], ["บิล", "n"]]}>
            {topCust.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูล" /> : topCust.map((c, i) => (
              <tr key={c["ผู้รับ_encoded"]}>
                <td className="n">{i + 1}</td>
                <td><ShortId v={c["ผู้รับ_encoded"]} n={c.n} /></td>
                <td className="n">{fmt(c.revenue)}</td>
                <td className="n">{fmt(c.bills)}</td>
              </tr>
            ))}
          </Tbl>
        </div>
        <div className="dz-cc">
          <h4>ลูกค้าที่ทำรายได้ต่ำสุด 10 ราย</h4>
          <Tbl head={[["#", "n"], "รหัสลูกค้า", ["รายได้", "n"], ["บิล", "n"]]}>
            {lowCust.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูล" /> : lowCust.map((c, i) => (
              <tr key={c["ผู้รับ_encoded"]}>
                <td className="n">{i + 1}</td>
                <td><ShortId v={c["ผู้รับ_encoded"]} n={c.n} /></td>
                <td className="n">{fmt(c.revenue)}</td>
                <td className="n">{fmt(c.bills)}</td>
              </tr>
            ))}
          </Tbl>
          <Note>ตัดรายที่รายได้เป็น 0 ออกแล้ว (บิลเคลียร์/ยกเลิก) ไม่งั้นตารางเต็มไปด้วยยอดศูนย์</Note>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายได้ตามเส้นทาง · 10 อันดับแรก</h4>
        <div className="dz-box tall">
          <DBar data={routes} xKey="name" horiz
            series={[{ key: "v", label: "รายได้", color: D.indigo }]} />
        </div>
        <Tbl head={["เส้นทาง", ["รายได้", "n"], ["จำนวนบิล", "n"], ["จำนวนเที่ยว", "n"], ["รายการ", "n"]]}>
          {data.routes.length === 0 ? <EmptyRow cols={5} text="ไม่มีข้อมูล" /> : data.routes.map((r) => (
            <tr key={String(r.route)}>
              <td>{String(r.route ?? "(ไม่ระบุ)")}</td>
              <td className="n">{fmt(r.revenue)} บาท</td>
              <td className="n">{fmt(Number(r.bills ?? 0))}</td>
              <td className="n">{fmt(Number(r.trips ?? 0))}</td>
              <td className="n">{fmt(Number(r.lines ?? 0))}</td>
            </tr>
          ))}
        </Tbl>
        <Note>
          จำนวนเที่ยวนับจากเลขที่ใบรายการที่ไม่ซ้ำ · บิลหลายใบขึ้นรถเที่ยวเดียวกันได้
          จำนวนบิลจึงมากกว่าจำนวนเที่ยวเสมอ
        </Note>
      </div>
    </Pane>
  );
}
