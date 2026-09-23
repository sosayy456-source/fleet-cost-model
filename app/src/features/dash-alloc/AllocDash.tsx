/**
 * แดชบอร์ด "กำไรลูกค้า (ปันส่วนต้นทุน)" — หน้าใหม่ แยกขาดจากแดชบอร์ดเดิมทุกหน้า
 *
 * ข้อมูลมาจาก etl/build_alloc.py ซึ่งปันต้นทุนเที่ยวรถเข้าบิลลูกค้าด้วยวิธี ค
 * (ภาระงาน = น้ำหนักที่ใช้คิด × ระยะทาง) ตามเอกสาร Cost Allocation Spec
 * แล้วยุบเป็นระดับลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · สด/เชื่อปลายทาง → ผู้รับ)
 *
 * ต่างจากแท็บ "กำไรลูกค้า" ในแดชบอร์ดเดิม (dash-fleet) ที่ปันตามสัดส่วนยอดบิลอย่างเดียว
 * ไม่สนน้ำหนักและระยะทาง — สองหน้านี้ตัวเลขไม่ตรงกันโดยตั้งใจ และไม่แชร์โค้ดคำนวณกัน
 *
 * กลุ่ม "ข้อมูลไม่เชื่อมกัน" กับ "ต้นทุนที่ไม่ปันเข้าลูกค้า" อยู่ล่างสุดของหน้าแบบเล็ก
 * ไม่ปนเข้าตัวเลขหลัก (ตามที่เจ้าของข้อมูลสั่ง)
 */
import { useMemo, useState } from "react";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { ShortId, custLabel } from "../../lib/custmap/ShortId";
import { useAlloc, useAllocTotals } from "../../lib/data/useAlloc";
import type { AllocCustomer, AllocData, PayerSide } from "../../lib/data/useAlloc";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import EtlBanner from "../../lib/ui/EtlBanner";
import RefreshBtn from "../../lib/ui/RefreshBtn";
import { CC, KC, Note, Pane, ResetBtn, TableHead, searchStyle, selectStyle } from "../dash-fleet/parts";
import { SortTable, fmt, marginTone, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import TruckLoader from "../../lib/ui/TruckLoader";

const TOP_N = 15;

/** ตัวกรองของหน้านี้ — ลูกค้ามีแค่ฝ่ายผู้จ่าย รหัส และขนาด ไม่มีมิติเที่ยววิ่ง */
interface Filter {
  side: "" | PayerSide;
  q: string;
  /** "" ทั้งหมด · "loss" เฉพาะที่ขาดทุน · "profit" เฉพาะที่มีกำไร */
  only: "" | "loss" | "profit";
  minBills: string;
}
const F0: Filter = { side: "", q: "", only: "", minBills: "" };

/**
 * @param embedded true = ถูกฝังเป็นแท็บใน Executive Dashboard — ไม่วาดแถบสรุปเป็นการ์ดซ้ำ
 *   เพราะหน้าแม่มีแถบของตัวเองอยู่แล้ว เหลือบรรทัดเดียวบอกที่มาของตัวเลขชุดนี้
 */
export default function AllocDash({ embedded }: { embedded?: boolean } = {}) {
  const { data, error, loading, reload } = useAlloc();
  // วางไฟล์ใน etl/data/travel/ แล้ว dev server ปันใหม่ให้เอง — ขึ้นแถบแล้วรีเฟรชเองตอนเสร็จ
  const etl = useEtlStatus("alloc");
  useAutoReloadOnEtl(etl, reload);
  const [f, setF] = useState<Filter>(F0);
  const set = <K extends keyof Filter>(k: K) => (v: Filter[K]) => setF((p) => ({ ...p, [k]: v }));

  const refresh = (
    <RefreshBtn className="dash-reload" onClick={reload} loading={loading}
      title="ดึงไฟล์ที่ ETL สร้างไว้ (alloc/) มาใหม่" />
  );

  if (error) {
    return (
      <div className="card">
        <h2>กำไรลูกค้า (ปันส่วนต้นทุน)</h2>
        <EtlBanner status={etl} />
        <div className="banner">{error}</div>
        <p className="muted">
          ต้องมีสองอย่างคู่กัน: รายงานค่าเดินทางใน <code>etl/data/travel/</code> และไฟล์บิลใน{" "}
          <code>etl/data/revenue/</code> แล้วระบบจะปันให้เอง (หรือรัน{" "}
          <code>python etl/build_alloc.py --dataset real</code> เอง)
        </p>
        <div style={{ marginTop: 12 }}>{refresh}</div>
      </div>
    );
  }
  if (!data) return <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>;

  return (
    <>
      <EtlBanner status={etl} />
      {embedded ? <SourceLine data={data} refresh={refresh} /> : <InfoBar data={data} refresh={refresh} />}
      <Body data={data} f={f} set={set} reset={() => setF(F0)} />
    </>
  );
}

/** บรรทัดเดียวสำหรับตอนฝังเป็นแท็บ — ที่มาของตัวเลข + ปุ่มรีเฟรชของชุด alloc เอง */
function SourceLine({ data, refresh }: { data: AllocData; refresh: React.ReactNode }) {
  const m = data.manifest;
  const months = m.months.length
    ? `${m.months[0]}${m.months.length > 1 ? ` → ${m.months[m.months.length - 1]}` : ""}`
    : "ไม่มีเดือน";
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "2px 0 12px" }}>
      <span className="muted" style={{ fontSize: 12.5 }}>
        ชุดข้อมูลปันส่วนต้นทุน: {fmt(m.trips.matched)} เที่ยว · {months} · ที่มา <b>{m.source ?? "ไม่ระบุ"}</b>
        {m.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
      </span>
      <span style={{ marginLeft: "auto" }}>{refresh}</span>
    </div>
  );
}

function InfoBar({ data, refresh }: { data: AllocData; refresh: React.ReactNode }) {
  const m = data.manifest;
  const months = m.months.length
    ? `${m.months[0]}${m.months.length > 1 ? ` → ${m.months[m.months.length - 1]}` : ""}`
    : "ไม่มีเดือน";
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          ปันต้นทุน {fmt(m.trips.matched)} เที่ยว จาก {fmt(m.trips.inBills)} เที่ยวในไฟล์บิล
          {" · "}{m.costFiles.length} ไฟล์ · {months}
          {" · ที่มา: "}<b>{m.source ?? "ไม่ระบุ"}</b>
          {m.isSample && <> · <b style={{ color: "var(--red)" }}>ข้อมูลตัวอย่าง</b></>}
        </span>
        <span style={{ marginLeft: "auto" }}>{refresh}</span>
      </div>
    </div>
  );
}

function Body({ data, f, set, reset }: {
  data: AllocData;
  f: Filter;
  set: <K extends keyof Filter>(k: K) => (v: Filter[K]) => void;
  reset: () => void;
}) {
  const { manifest: m, customers, unlinked } = data;

  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const min = Number(f.minBills) || 0;
    return customers.filter((c) =>
      (!f.side || c.side === f.side)
      && (!needle || c.code.toLowerCase().includes(needle))
      && (f.only !== "loss" || c.profit < 0)
      && (f.only !== "profit" || c.profit > 0)
      && c.bills >= min);
  }, [customers, f]);

  const t = useAllocTotals(rows);

  /**
   * แยกกราฟสองใบ กำไรสูงสุด / ขาดทุนมากสุด ข้างละ 15 ราย
   *
   * ★ เดิมรวมไว้ในกราฟเดียว 30 แถบ ซึ่งอ่านยากเพราะสองฝั่งต่างกันคนละสเกล
   *   ฝั่งกำไรยาวถึง 4 แสน ฝั่งขาดทุนสั้นแค่หลักหมื่น พอใช้แกนร่วมกันแถบขาดทุนเลยจิ๋ว
   *   จนเทียบกันเองไม่ได้ · แยกใบแล้วแต่ละใบมีแกนของตัวเอง เห็นลำดับในฝั่งตัวเองชัด
   *
   * ★ ฝั่งขาดทุนส่งค่าสัมบูรณ์เข้ากราฟ (ไม่ใช่ค่าติดลบ) แถบจะได้ยาวไปทางขวาเหมือนกัน
   *   แล้วบอกหน่วยใน tooltip ว่า "ขาดทุน" แทน — ถ้าปล่อยติดลบ แกนจะวิ่งจากซ้ายมาศูนย์
   *   แล้วป้ายชื่อลูกค้าไปกองอยู่กลางกราฟ
   *
   * custLabel ให้รหัส CUS ถ้าตารางรหัสถูกโหลดแล้ว ไม่งั้นย่อ hash ให้ — เหมือนกราฟหน้าอื่น
   */
  const [topChart, lossChart] = useMemo(() => {
    const byProfit = [...rows].sort((a, b) => b.profit - a.profit);
    const gain = byProfit.filter((c) => c.profit > 0).slice(0, TOP_N)
      .map((c) => ({ name: custLabel(c.code, c.n), v: Math.round(c.profit) }));
    const loss = byProfit.filter((c) => c.profit < 0)
      .sort((a, b) => a.profit - b.profit).slice(0, TOP_N)
      .map((c) => ({ name: custLabel(c.code, c.n), v: Math.round(-c.profit) }));
    return [gain, loss];
  }, [rows]);

  const cols: Col<AllocCustomer>[] = useMemo(() => [
    { key: "code", label: "ลูกค้า", get: (r) => r.code, render: (r) => <ShortId v={r.code} n={r.n} /> },
    { key: "side", label: "ผู้จ่าย", get: (r) => r.side },
    { key: "bills", label: "บิล", get: (r) => r.bills, num: true },
    { key: "revenue", label: "รายได้", get: (r) => r.revenue, num: true },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (r) => r.cost, num: true },
    {
      key: "profit", label: "กำไร/ขาดทุน", get: (r) => r.profit, num: true,
      render: (r) => (
        <b style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(r.profit)}</b>
      ),
    },
    {
      key: "margin", label: "อัตรากำไร", get: (r) => r.margin, num: true,
      render: (r) => (
        <span style={{ color: marginTone(r.margin) }}>{r.margin == null ? "–" : pct(r.margin, 0)}</span>
      ),
    },
    { key: "lossBills", label: "บิลที่ขาดทุน", get: (r) => r.lossBills, num: true },
  ], []);

  const { sorted, sort, toggle } = useSort(rows, cols, { key: "profit", dir: -1 });

  return (
    <>
      <div className="dz-filters">
        <div className="ff">
          <label htmlFor="al-side">ผู้จ่ายเงิน</label>
          <select id="al-side" style={selectStyle} value={f.side}
            onChange={(e) => set("side")(e.target.value as Filter["side"])}>
            <option value="">ทั้งสองฝ่าย</option>
            <option value="ผู้ส่ง">ผู้ส่ง (สด/เชื่อต้นทาง)</option>
            <option value="ผู้รับ">ผู้รับ (สด/เชื่อปลายทาง)</option>
          </select>
        </div>
        <div className="ff">
          <label htmlFor="al-only">ผลประกอบการ</label>
          <select id="al-only" style={selectStyle} value={f.only}
            onChange={(e) => set("only")(e.target.value as Filter["only"])}>
            <option value="">ทั้งหมด</option>
            <option value="loss">เฉพาะที่ขาดทุน</option>
            <option value="profit">เฉพาะที่มีกำไร</option>
          </select>
        </div>
        <div className="ff">
          <label htmlFor="al-min">บิลอย่างน้อย</label>
          <select id="al-min" style={selectStyle} value={f.minBills}
            onChange={(e) => set("minBills")(e.target.value)}>
            <option value="">ไม่จำกัด</option>
            <option value="2">2 บิล</option>
            <option value="5">5 บิล</option>
            <option value="10">10 บิล</option>
          </select>
        </div>
        <ResetBtn onClick={reset} />
      </div>

      <Pane deps={[rows, sort]}>
        <div className="dz-cards">
          <KC dot={D.indigo} l="ลูกค้า" v={fmt(t.customers)} s={`ราย · ${fmt(t.bills)} บิล`} />
          <KC dot={D.teal} l="รายได้" v={fmt(t.revenue)} s="บาท · ผลรวมราคารวมของบิล" />
          <KC dot={D.orange} l="ต้นทุนจัดสรร" v={fmt(t.cost)} s="บาท · ปันตามภาระงาน × ระยะทาง" />
          <KC dot={t.profit < 0 ? D.rose : D.emerald} tone={t.profit < 0 ? "bad" : "good"}
            l="กำไร/ขาดทุน" v={signed(t.profit)}
            s={t.margin == null ? "บาท" : `บาท · อัตรากำไร ${pct(t.margin)}`} />
          <KC dot={D.rose} tone={t.lossCust ? "bad" : undefined} l="ลูกค้าที่ขาดทุน"
            v={fmt(t.lossCust)}
            s={t.customers ? `ราย · ${pct(t.lossCust / t.customers * 100)} ของลูกค้าที่แสดง` : "ราย"} />
          <KC dot={D.amber} l="บิลที่ขาดทุน" v={fmt(t.lossBills)}
            s={t.lossShare == null ? "บิล" : `บิล · ${pct(t.lossShare)} ของบิลทั้งหมด`} />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          <CC title={`ลูกค้าที่ทำกำไรสูงสุด (${TOP_N} อันดับ)`} tall>
            {topChart.length ? (
              <DBar data={topChart} xKey="name" horiz
                series={[{ key: "v", label: "กำไร", color: D.emerald }]} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            height: "100%", color: "var(--ink-faint)" }}>
                ไม่มีลูกค้าที่กำไรตามเงื่อนไขที่กรองอยู่
              </div>
            )}
          </CC>
          <CC title={`ลูกค้าที่ขาดทุนมากสุด (${TOP_N} อันดับ)`} tall>
            {lossChart.length ? (
              <DBar data={lossChart} xKey="name" horiz suffix=" บาท (ขาดทุน)"
                series={[{ key: "v", label: "ขาดทุน", color: D.rose }]} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                            height: "100%", color: "var(--ink-faint)" }}>
                ไม่มีลูกค้าที่ขาดทุนตามเงื่อนไขที่กรองอยู่
              </div>
            )}
          </CC>
        </div>
        <Note>
          แยกสองใบเพราะสองฝั่งคนละสเกลกัน · ใบขวาวาดเป็นค่าบวกเพื่อให้เทียบความยาวกันได้
          ตัวเลขจริงติดลบ ดูได้ในตารางข้างล่าง
        </Note>

        <div className="dz-cc" style={{ marginTop: 14 }}>
          <TableHead title={`กำไรรายลูกค้า (${fmt(rows.length)} ราย)`}>
            <input style={{ ...searchStyle, minWidth: 220 }} value={f.q}
              onChange={(e) => set("q")(e.target.value)}
              placeholder="🔍 ค้นหารหัสลูกค้า (รหัสต้นฉบับ)" />
          </TableHead>
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle}
            rowKey={(r) => r.side + r.code} empty="ไม่พบลูกค้าตามเงื่อนไขนี้" />
          <Note>
            ต้นทุนจัดสรร = ต้นทุนของเที่ยวที่บิลนั้นอยู่ กระจายตามภาระงาน (น้ำหนักที่ใช้คิด ×
            ระยะทาง) ของแต่ละรายการสินค้า · น้ำหนักที่ใช้คิดเลือกจาก น้ำหนักจริง เทียบกับ
            ปริมาตร × 0.167 ตัน/ลบ.ม. แล้วเอาค่าที่มากกว่า · ผู้จ่ายเงินมาจากประเภทการชำระเงินของบิล
          </Note>
        </div>

        <Bottom data={{ manifest: m, unlinked }} />
      </Pane>
    </>
  );
}

/**
 * บล็อกล่างสุด — ค่าใช้จ่ายที่ไม่เข้าลูกค้า + ของที่ตรวจไม่ผ่าน เก็บไว้ให้ตรวจแต่ไม่เด่น
 *
 * ต้นทุนที่ตกกับบิลเคลียร์และเที่ยวตีเปล่า "ไม่เข้าใครเลย" ตามที่เจ้าของข้อมูลกับผู้ทำ
 * เรื่องบิลเคลียร์สรุปกันมา — เป็นค่าใช้จ่ายของบริษัทต่างหาก (คชจ.บิลเคลียร์)
 * ไม่ใช่ยอดค้างที่รอปันเข้าลูกค้าในภายหลัง จึงเขียนเป็น "ค่าใช้จ่าย" ให้อ่านตรงตามนั้น
 */
function Bottom({ data }: { data: Pick<AllocData, "manifest" | "unlinked"> }) {
  const { manifest: m, unlinked: u } = data;
  const nl = u.notLinked;
  const excluded = Object.entries(u.excludedCost);
  const excludedTotal = excluded.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="dz-cc" style={{ marginTop: 14, opacity: .92 }}>
      <h4 style={{ fontSize: 14 }}>ค่าใช้จ่ายที่ไม่เข้าลูกค้า และรายการที่ควรตรวจ</h4>
      <p className="dz-sub" style={{ fontSize: 12 }}>
        ส่วนนี้แยกไว้ไม่ให้ปนกับตัวเลขข้างบน — ไม่มีลูกค้ารายไหนถูกคิดต้นทุนก้อนนี้
      </p>
      <ul className="dq" style={{ fontSize: 12.5 }}>
        {excluded.map(([reason, cost]) => (
          <li key={reason}>
            <span className="n">{fmt(cost)}</span>
            <span>
              บาท = <b>คชจ.{reason}</b> ({fmt(u.excludedItems[reason] ?? 0)} รายการ) —
              รับต้นทุนตามภาระงานของตัวเองปกติ แต่ไม่เข้าลูกค้ารายไหน
              ถือเป็นค่าใช้จ่ายของบริษัทต่างหาก
            </span>
          </li>
        ))}
        {excluded.length > 1 && (
          <li>
            <span className="n">{fmt(excludedTotal)}</span>
            <span>บาท รวมค่าใช้จ่ายที่ไม่เข้าลูกค้าทั้งหมด</span>
          </li>
        )}
        <li>
          <span className="n">{fmt(nl.items)}</span>
          <span>
            รายการสินค้าใน {fmt(nl.trips)} เที่ยว ({fmt(nl.bills)} บิล) ที่หาต้นทุนไม่ได้ —
            เลขที่ใบรายการไม่มีในรายงานค่าเดินทาง จึงมีรายได้ {fmt(nl.revenue)} บาท
            แต่ไม่มีต้นทุน ถ้านับรวมลูกค้ากลุ่มนี้จะดูกำไรเกินจริง
          </span>
        </li>
        {u.noPayer.items > 0 && (
          <li>
            <span className="n">{fmt(u.noPayer.items)}</span>
            <span>
              รายการที่ระบุผู้จ่ายเงินไม่ได้ (ประเภทการชำระเงินไม่ใช่สด/เชื่อ ต้นทาง-ปลายทาง)
              รายได้ {fmt(u.noPayer.revenue)} บาท
            </span>
          </li>
        )}
        <li>
          <span className="n">{fmt(u.distanceSource["ค่ากลางของเที่ยว"] ?? 0)}</span>
          <span>
            รายการที่หาระยะทางจากตารางไม่เจอ ใช้ค่ากลางของเที่ยวแทน
            (ตรงตัว {fmt(u.distanceSource["ตรงตัว"] ?? 0)} · สลับทิศ {fmt(u.distanceSource["สลับทิศ"] ?? 0)}
            {u.distanceSource["ไม่มีในตาราง"]
              ? ` · ทั้งเที่ยวหาไม่เจอเลยใช้ 1 กม. ${fmt(u.distanceSource["ไม่มีในตาราง"])}` : ""})
          </span>
        </li>
      </ul>
      <Note>
        ต้นทุนในรายงานค่าเดินทางทั้งหมด {fmt(m.cost.inCostReport)} บาท · ปันได้เฉพาะเที่ยวที่จับคู่กับบิลได้{" "}
        {fmt(m.cost.allocatable)} บาท = เข้าลูกค้า {fmt(m.cost.toCustomers)} + ไม่เข้าลูกค้า{" "}
        {fmt(m.cost.notToCustomers)} · สร้างไฟล์เมื่อ {m.generatedAt.replace("T", " ")}
      </Note>
    </div>
  );
}
