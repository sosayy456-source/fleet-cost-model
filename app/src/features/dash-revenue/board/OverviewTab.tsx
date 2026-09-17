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
 *
 * ★ ตัวกรอง (board/filters.tsx) — ตัวเลขมาจากคนละที่ตามสถานะการกรอง
 *     ไม่ได้กรอง  overview.json ที่ ETL คำนวณจากแถวดิบ เป๊ะทุกช่อง
 *     กรองแล้ว   คำนวณใหม่จาก cube
 *
 *   วัดกับข้อมูลจริง (186,862 แถว) แล้วความเป๊ะไม่เท่ากันในแต่ละช่อง:
 *     รายได้ / รายการ  เป๊ะ (เป็น sum/count บวกข้ามเซลล์ได้ตรง)
 *     จำนวนบิล        นับเกิน 0 — ทุกรายการในบิลเดียวกันตกช่องเดียวกันหมด
 *                     แต่ไม่มีอะไรบังคับไว้ จึงติด ≈ กันเหนียว
 *     จำนวนเที่ยว      **นับเกิน 5 เท่า** (14,092 เทียบกับ 2,745 จริง) เพราะใบรายการเดียว
 *                     บรรทุกบิลหลายเส้นทางหลายประเภท เลยถูกนับซ้ำทุกช่องที่มันโผล่
 *                     ผิดขนาดนี้ติดป้าย ≈ ไม่พอ — **ตอนกรองต้องขึ้น "–" ไปเลย**
 *     จำนวนลูกค้า      กรองไม่ได้ ลูกค้าไม่ได้อยู่ใน cube (44,543 ราย ใส่แล้วก้อนระเบิด)
 */
import { useMemo } from "react";
import { DBar } from "../../../lib/chart/dcharts";
import { D } from "../../../lib/chart/theme";
import { ShortId } from "../../../lib/custmap/ShortId";
import { monthLabel } from "../../../lib/data/useDataset";
import { CC, Hero, KC, Note, Pane } from "../../dash-fleet/parts";
import { DualAxis, EmptyRow, fmt, pct, Tbl } from "./common";
import { groupBy, isFiltered, RevFilters, totalsOf, useCubeRows } from "./filters";
import type { RevFilter } from "./filters";
import type { Dataset } from "../../../lib/data/useDataset";

export default function OverviewTab({ data, f, set, reset }: {
  data: Dataset;
  f: RevFilter;
  set: (k: keyof RevFilter) => (v: string) => void;
  reset: () => void;
}) {
  const on = isFiltered(f);
  const rows = useCubeRows(data, f);
  const t = useMemo(() => totalsOf(rows), [rows]);
  const raw = data.overview;

  /** ตัวเลขที่เอาไปโชว์ — สลับแหล่งตามว่ากำลังกรองอยู่ไหม (ดูหัวไฟล์) */
  const o = useMemo(() => on ? {
    ...raw,
    total_revenue: t.revenue,
    total_line_items: t.lines,
    distinct_bills: t.bills,
    avg_bill_value: t.bills ? t.revenue / t.bills : 0,
  } : raw, [on, raw, t]);
  /** ≈ ต่อท้ายค่าที่เป็นขอบบนตอนกรอง */
  const approx = (v: string) => on ? `≈ ${v}` : v;

  const months = data.monthly;
  /** เติบโตของเดือนล่าสุดที่มีค่า — สเปกเรียก "Revenue Growth" */
  const growth = useMemo(() => {
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i]?.growth_pct != null) return months[i]!.growth_pct!;
    }
    return null;
  }, [months]);

  /** กรองแล้วต้องยุบรายเดือนจาก cube ใหม่ ไม่ใช่โชว์ monthly.json ที่เป็นยอดทั้งชุด */
  const trend = useMemo(() => {
    if (!on) {
      return months.map((m) => ({
        mo: monthLabel(m.month),
        รายได้: Math.round(m.revenue),
        "มูลค่าเฉลี่ย/บิล": m.avg_bill_value == null ? null : Math.round(m.avg_bill_value),
      }));
    }
    return groupBy(rows, "month")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        mo: monthLabel(m.name),
        รายได้: Math.round(m.revenue),
        "มูลค่าเฉลี่ย/บิล": m.bills ? Math.round(m.revenue / m.bills) : null,
      }));
  }, [on, months, rows]);

  /** สถานะการชำระเงินยุบจาก cube เสมอ — มิตินี้อยู่ใน cube อยู่แล้ว จึงตรงทั้งกรองและไม่กรอง */
  const payRows = useMemo(() => groupBy(rows, "สถานะการชำระเงิน"), [rows]);
  const payTotal = payRows.reduce((s, x) => s + x.revenue, 0);
  const payChart = payRows.map((x) => ({ label: x.name, v: Math.round(x.revenue) }));

  const paidRow = payRows.find((x) => x.name !== "ยังไม่ได้ชำระ");
  const unpaidRow = payRows.find((x) => x.name === "ยังไม่ได้ชำระ");
  const paidAmt = paidRow?.revenue ?? 0;
  const unpaidAmt = unpaidRow?.revenue ?? 0;
  const collRate = payTotal ? paidAmt / payTotal * 100 : null;

  /** บิลเคลียร์เป็นค่าหนึ่งของ "ประเภทสินค้า" จึงยุบจาก cube ได้ตรง ๆ เหมือนกัน */
  const clear = useMemo(() => {
    const hit = groupBy(rows, "ประเภทสินค้า").find((x) => x.name === "บิลเคลียร์");
    return { bills: hit?.bills ?? 0, revenue: hit?.revenue ?? 0 };
  }, [rows]);
  const clearPct = t.bills ? clear.bills / t.bills * 100 : null;

  const topCust = useMemo(() => data.customerTop.slice(0, 10), [data.customerTop]);
  const lowCust = data.customerLow;
  /** เส้นทางก็ยุบจาก cube — routes.json เป็นยอดทั้งชุด ใช้ตอนกรองไม่ได้ */
  const routeRows = useMemo(() => groupBy(rows, "route"), [rows]);
  const routes = useMemo(() => routeRows.slice(0, 10)
    .map((r) => ({ name: r.name, v: Math.round(r.revenue) })), [routeRows]);

  return (
    <Pane deps={[data, f]}>
      <RevFilters data={data} f={f} set={set} reset={reset} />
      <Note>
        สเปกขอตัวกรอง 6 ช่อง ทำได้ 4 · <b>ลูกค้า</b> กรองไม่ได้เพราะมี{" "}
        {fmt(data.overview.customers)} ราย ใส่เป็นมิติใน cube แล้วก้อนระเบิด ·{" "}
        <b>ชนิดรถ</b> ไม่มีในไฟล์บิลเลย ต้องใช้ไฟล์ต้นทุนรายเที่ยว
        {on && <>
          {" "}· ค่าที่มี <b>≈</b> คือขอบบน ·{" "}
          <b>จำนวนเที่ยว</b> กับ <b>ค่าเฉลี่ยต่อเที่ยว</b> ขึ้น "–" ตอนกรอง เพราะใบรายการเดียว
          บรรทุกบิลหลายเส้นทาง ถ้านับจากที่กรองจะเกินจริงราว 5 เท่า
        </>}
      </Note>

      <div className="dz-heroes">
        <Hero kind="rev" l="รายได้รวม" v={fmt(o.total_revenue)} s="บาท" />
        <Hero kind="profit" l="เก็บเงินได้แล้ว" v={fmt(paidAmt)}
          s={`บาท · อัตราเก็บเงิน ${pct(collRate)}`} />
        <Hero kind={unpaidAmt > 0 ? "loss" : "profit"} l="ยังไม่ได้ชำระ"
          v={fmt(unpaidAmt)} s={`บาท · ${approx(fmt(unpaidRow?.bills ?? 0))} บิล`} />
      </div>

      <div className="dz-cards">
        <KC dot={D.indigo} l="จำนวนบิล" v={approx(fmt(o.distinct_bills))}
          s={on ? "บิล · ค่าประมาณขอบบน" : "บิล"} />
        {/* ★ กรองแล้วนับเกิน 5 เท่า (ดูหัวไฟล์) — ขึ้น "–" ดีกว่าโชว์เลขที่ผิดเป็นเท่าตัว */}
        <KC dot={D.violet} l="จำนวนเที่ยว" v={on ? "–" : fmt(o.trips)}
          s={on ? "กรองแล้วนับไม่ได้ (ใบรายการเดียวอยู่หลายเส้นทาง)" : "เที่ยว (เลขที่ใบรายการไม่ซ้ำ)"} />
        {/* ลูกค้าไม่ได้อยู่ใน cube — กรองแล้วนับใหม่ไม่ได้ ขึ้น "–" ดีกว่าโชว์ยอดทั้งชุดให้เข้าใจผิด */}
        <KC dot={D.teal} l="จำนวนลูกค้า" v={on ? "–" : fmt(o.customers)}
          s={on ? "กรองแล้วนับไม่ได้ (ดูหมายเหตุใต้ตัวกรอง)" : "ราย (นับจากผู้รับ)"} />
        <KC dot={D.amber} tone={growth != null && growth < 0 ? "bad" : "good"} l="เติบโตเดือนล่าสุด"
          v={growth == null ? "–" : (growth > 0 ? "+" : "") + pct(growth)} s="เทียบเดือนก่อนหน้า" />
      </div>

      <div className="dz-cards" style={{ marginTop: 14 }}>
        <KC dot={D.indigo} l="รายได้เฉลี่ย/บิล" v={approx(fmt(o.avg_bill_value))} s="บาท" />
        <KC dot={D.violet} l="รายได้เฉลี่ย/เที่ยว" v={on ? "–" : fmt(o.avg_trip_value)}
          s={on ? "กรองแล้วคิดไม่ได้" : "บาท"} />
        <KC dot={D.teal} l="รายได้เฉลี่ย/ลูกค้า" v={on ? "–" : fmt(o.avg_customer_value)}
          s={on ? "กรองแล้วคิดไม่ได้" : "บาท"} />
        <KC dot={D.emerald} l="อัตราเก็บเงิน" v={pct(collRate, 2)}
          s={`เก็บได้ ${fmt(paidAmt)} จาก ${fmt(payTotal)} บาท`} />
      </div>

      <div className="dz-cards" style={{ marginTop: 14 }}>
        {/* ช่องนี้สเปกเดิมเป็น Outstanding/Unpaid แต่กาทิ้งแล้วเขียนว่าเอา "bill clear จำนวน (%)" แทน */}
        <KC dot={D.orange} l="บิลเคลียร์ — จำนวน (%)"
          v={`${approx(fmt(clear.bills))} (${pct(clearPct, 2)})`}
          s={`บิล · ${fmt(clear.revenue)} บาท`} />
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
            {payRows.length === 0 ? <EmptyRow cols={4} text="ไม่มีข้อมูลตามตัวกรอง" /> : payRows.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td>
                <td className="n">{fmt(x.revenue)} บาท</td>
                <td className="n">{pct(payTotal ? x.revenue / payTotal * 100 : 0, 2)}</td>
                <td className="n">{approx(fmt(x.bills))}</td>
              </tr>
            ))}
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
          <Note>
            ตัดรายที่รายได้เป็น 0 ออกแล้ว (บิลเคลียร์/ยกเลิก) ไม่งั้นตารางเต็มไปด้วยยอดศูนย์ ·
            <b>สองตารางนี้ไม่ตอบตัวกรอง</b> เป็นอันดับของทั้งชุดข้อมูลเสมอ
            เพราะลูกค้าไม่ได้อยู่ใน cube ที่ใช้กรอง
          </Note>
        </div>
      </div>

      <div className="dz-cc" style={{ marginTop: 14 }}>
        <h4>รายได้ตามเส้นทาง · 10 อันดับแรก{on ? " (ตามตัวกรอง)" : ""}</h4>
        <div className="dz-box tall">
          <DBar data={routes} xKey="name" horiz
            series={[{ key: "v", label: "รายได้", color: D.indigo }]} />
        </div>
        <Tbl head={["เส้นทาง", ["รายได้", "n"], ["จำนวนบิล", "n"], ["รายการ", "n"], ["สัดส่วน", "n"]]}>
          {routeRows.length === 0 ? <EmptyRow cols={5} text="ไม่มีเส้นทางตามตัวกรอง" />
            : routeRows.slice(0, 40).map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="n">{fmt(r.revenue)} บาท</td>
                <td className="n">{approx(fmt(r.bills))}</td>
                <td className="n">{fmt(r.lines)}</td>
                <td className="n">{pct(t.revenue ? r.revenue / t.revenue * 100 : 0, 2)}</td>
              </tr>
            ))}
        </Tbl>
        <Note>
          จำนวนเที่ยวรายเส้นทางดูได้ที่ <code>routes.json</code> (ยอดทั้งชุด ไม่ตอบตัวกรอง) ·
          บิลหลายใบขึ้นรถเที่ยวเดียวกันได้ จำนวนบิลจึงมากกว่าจำนวนเที่ยวเสมอ ·
          แสดง 40 เส้นทางแรกจาก {fmt(routeRows.length)} เส้นทางที่ผ่านตัวกรอง
        </Note>
      </div>
    </Pane>
  );
}
