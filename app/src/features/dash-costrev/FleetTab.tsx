/**
 * แท็บ "กองรถ" — สเปกส่วนที่ 1 การใช้ประโยชน์ของกองรถ (การใช้ประโยชน์กองรถและกำไรระดับเที่ยววิ่ง.md)
 *
 *   1.1 ตัวกรอง  ปี เดือน · จุดขึ้น–จุดลง · ประเภทรถ/ชนิดรถ   (กลุ่มบริการตัดออก — ไฟล์ไม่มีคอลัมน์)
 *   1.2 KPI 9 ใบ
 *   1.3 VISUAL-02 อันดับความคุ้มค่าของชนิดรถ (กำไรเฉลี่ย/เที่ยว)
 *       VISUAL-03 ตัดออก (ต้องใช้กลุ่มบริการ)
 *       VISUAL-04 รถที่ถูกใช้งานมากที่สุด (จำนวนเที่ยว)
 */
import { useMemo, useState } from "react";
import { DBar } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import { CC, KC, Note, Pane, ResetBtn } from "../dash-fleet/parts";
import { BASE_F0, ListFF, MonthFF, YearFF, duniq, fmt, groupBy, passBase, pct } from "./common";
import type { BaseFilter } from "./common";
import type { Trip } from "../../lib/data/useCostRev";

const TOP_PLATES = 10;

export default function FleetTab({ trips }: { trips: Trip[] }) {
  const [f, setF] = useState<BaseFilter>(BASE_F0);
  const set = (k: keyof BaseFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const rows = useMemo(() => trips.filter((t) => passBase(t, f)), [trips, f]);

  const kpi = useMemo(() => {
    const plates = groupBy(rows, (t) => t.pl);
    const n = rows.length;
    const vehicles = plates.length;
    const profit = rows.reduce((s, t) => s + t.profit, 0);
    const empty = rows.filter((t) => t.empty);
    const loss = rows.filter((t) => t.profit < 0).length;
    return {
      vehicles, n,
      turnover: vehicles ? n / vehicles : 0,
      profitPerVehicle: vehicles ? profit / vehicles : 0,
      lossVehicles: plates.filter((p) => p.profit < 0).length,
      emptyTrips: empty.length,
      emptyCost: empty.reduce((s, t) => s + t.cost, 0),
      repair: rows.reduce((s, t) => s + t.repair, 0),
      lossPct: n ? loss / n * 100 : 0,
    };
  }, [rows]);

  /** VISUAL-02 — กำไรเฉลี่ยต่อเที่ยว ตามชนิดรถ เรียงมาก → น้อย */
  const byKind = useMemo(() => groupBy(rows, (t) => t.vk)
    .map((a) => ({ name: a.key, v: Math.round(a.profit / a.n), n: a.n }))
    .sort((a, b) => b.v - a.v), [rows]);

  /** VISUAL-04 — จำนวนเที่ยวต่อทะเบียน Top 10 */
  const byPlate = useMemo(() => groupBy(rows, (t) => t.pl)
    .map((a) => ({ name: a.key, v: a.n }))
    .sort((a, b) => b.v - a.v).slice(0, TOP_PLATES), [rows]);

  return (
    <>
      <div className="dz-filters">
        <YearFF trips={trips} value={f.year} onChange={set("year")} />
        <MonthFF value={f.month} onChange={set("month")} />
        <ListFF label="จุดขึ้น" all="ทุกจุดขึ้น" value={f.o} onChange={set("o")} opts={duniq(trips.map((t) => t.o))} />
        <ListFF label="จุดลง" all="ทุกจุดลง" value={f.de} onChange={set("de")} opts={duniq(trips.map((t) => t.de))} />
        <ListFF label="ประเภทรถ" all="ทุกประเภทรถ" value={f.ft} onChange={set("ft")} opts={duniq(trips.map((t) => t.ft))} />
        <ListFF label="ชนิดรถ" all="ทุกชนิดรถ" value={f.vk} onChange={set("vk")} opts={duniq(trips.map((t) => t.vk))} />
        <ResetBtn onClick={() => setF(BASE_F0)} />
      </div>

      <Pane deps={[rows]}>
        {/* [VISUAL-01] การ์ด KPI ภาพรวม */}
        <div className="dz-cards">
          <KC dot={D.indigo} l="จำนวนรถที่ใช้งานจริง" v={fmt(kpi.vehicles)} s="คัน · นับทะเบียนไม่ซ้ำ" />
          <KC dot={D.violet} l="จำนวนเที่ยววิ่งรวม" v={fmt(kpi.n)} s="เที่ยว" />
          <KC dot={D.teal} l="อัตราหมุนรอบรถเฉลี่ย" v={fmt(kpi.turnover, 1)} s="เที่ยว/คัน" />
          <KC dot={D.emeraldLight} tone={kpi.profitPerVehicle < 0 ? "bad" : "good"} l="กำไรเฉลี่ยต่อคัน"
            v={fmt(kpi.profitPerVehicle)} s="บาท/คัน · กำไรรวม ÷ รถที่ใช้งานจริง" />
          <KC dot={D.rose} tone={kpi.lossVehicles ? "bad" : undefined} l="รถที่ขาดทุนสะสม" v={fmt(kpi.lossVehicles)} s="คัน · กำไรสะสม < 0" />
          <KC dot={D.amber} l="เที่ยววิ่งตีเปล่า" v={fmt(kpi.emptyTrips)} s="เที่ยว · ของเหมาตีเปล่า + รถว่างไปสาขา" />
          <KC dot={D.orange} tone={kpi.emptyCost ? "warn" : undefined} l="ต้นทุนสูญเปล่า" v={fmt(kpi.emptyCost)} s="บาท · ต้นทุนของเที่ยวตีเปล่า" />
          <KC dot={D.slateDeep} l="ค่าซ่อมบำรุงรวม" v={fmt(kpi.repair)} s="บาท" />
          <KC dot={D.rose} tone={kpi.lossPct > 0 ? "warn" : undefined} l="สัดส่วนเที่ยวที่ขาดทุน" v={pct(kpi.lossPct)} s="เที่ยวขาดทุน ÷ เที่ยวทั้งหมด" />
        </div>

        <div className="dz-row dz-11" style={{ marginTop: 14 }}>
          {/* [VISUAL-02] */}
          <CC title="อันดับความคุ้มค่าของรถแต่ละชนิด · กำไรเฉลี่ยต่อเที่ยว" tall>
            <DBar data={byKind} xKey="name" horiz
              series={[{ key: "v", label: "กำไรเฉลี่ย/เที่ยว", color: D.indigo }]} />
          </CC>
          {/* [VISUAL-04] */}
          <CC title={`รถที่ถูกใช้งานมากที่สุด · ${TOP_PLATES} อันดับแรก`} tall>
            <DBar data={byPlate} xKey="name" horiz suffix=" เที่ยว"
              series={[{ key: "v", label: "จำนวนเที่ยว", color: D.teal }]} />
          </CC>
        </div>
        <Note>
          กราฟสัดส่วนการใช้รถในแต่ละกลุ่มบริการ (VISUAL-03) ยังไม่แสดง — ไฟล์ต้นทุนไม่มีคอลัมน์กลุ่มบริการ
          (แช่แข็ง/แช่เย็น/ทั่วไป) จะเพิ่มเมื่อมีข้อมูล
        </Note>
      </Pane>
    </>
  );
}
