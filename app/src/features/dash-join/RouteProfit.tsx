/**
 * กำไรรายเส้นทาง — รวมรายได้ (จากไฟล์บิล) เข้ากับต้นทุน (จากโมเดลเดินรถ)
 *
 * เป็นสิ่งที่แอปเดิมทั้งสองตัวทำไม่ได้ เพราะข้อมูลอยู่คนละที่:
 * RevenueDashboard มีรายได้แต่ไม่มีต้นทุน ส่วนโมเดล v5 มีต้นทุนแต่ไม่มียอดบิลรวม
 *
 * ★ กุญแจที่ใช้ join ตรวจแล้วก่อนสร้างหน้านี้:
 *   "ต้นทาง → ปลายทาง"  ตรงกัน 208/247 เส้นทาง (84.2%) ครอบคลุมรายได้ 99.6%  ✔
 *   "สายกระจาย"          ตรงแค่ 0.8% ครอบคลุมรายได้ 0.4%                      ✘
 * สาเหตุที่สายกระจายใช้ไม่ได้: มันคือสายส่งย่อยในเมือง (ช้างเผือก 1, ต่างอำเภอ -
 * สันทราย) ซึ่งเป็นคนละระดับกับเส้นทางวิ่งไกลระหว่างจังหวัดที่โมเดลต้นทุนคิด
 */
import { useMemo, useState } from "react";
import { computeCost } from "../../lib/cost/computeCost";
import { recCost } from "../../lib/cost/recCost";
import { REF, distanceFor } from "../../lib/refdata";
import { Stat } from "../../lib/chart/primitives";
import { fmtBaht, fmtPct, useChartTheme } from "../../lib/chart/theme";
import { monthLabel, useDataset } from "../../lib/data/useDataset";
import RefreshBtn from "../../lib/ui/RefreshBtn";
import type { RecordsState } from "../../lib/store/useRecords";
import type { FleetType } from "../../lib/cost/types";
import type { TripRecord } from "../../types/record";

interface RouteRow {
  route: string;
  origin: string;
  dest: string;
  revenue: number;
  bills: number;
  distance: number | null;
  /** ต้นทุนจริงจากใบรายการที่บันทึกไว้ (ถ้ามี) */
  actualCost: number;
  actualTrips: number;
  /** ต้นทุนประมาณการจากโมเดล เมื่อยังไม่มีใบรายการของเส้นทางนั้น */
  estCostPerTrip: number | null;
}

export default function RouteProfit({ state }: { state: RecordsState }) {
  const t = useChartTheme();
  const { data, error, loading, reload } = useDataset();
  const [vehicle, setVehicle] = useState("รถเทรเลอร์");
  const [fleetType, setFleetType] = useState<FleetType>("รถบริษัท");
  const [month, setMonth] = useState("all");

  const records = useMemo(
    () => [...state.records, ...(state.oldRecords as unknown as TripRecord[])],
    [state.records, state.oldRecords],
  );

  const rows = useMemo<RouteRow[]>(() => {
    const src = data?.route_month ?? [];

    // รวมรายได้รายเส้นทาง (กรองเดือนถ้าเลือก)
    const byRoute = new Map<string, { revenue: number; bills: number }>();
    for (const r of src) {
      if (month !== "all" && r.month !== month) continue;
      const cur = byRoute.get(r.route) ?? { revenue: 0, bills: 0 };
      cur.revenue += r.revenue;
      cur.bills += r.bills;
      byRoute.set(r.route, cur);
    }

    // ต้นทุนจริงจากใบรายการ จัดกลุ่มด้วยคีย์เดียวกัน
    const costByRoute = new Map<string, { cost: number; trips: number }>();
    for (const rec of records) {
      if (!rec.origin || !rec.dest) continue;
      if (month !== "all" && String(rec.date ?? "").slice(0, 7) !== month) continue;
      const key = `${rec.origin} → ${rec.dest}`;
      const cur = costByRoute.get(key) ?? { cost: 0, trips: 0 };
      cur.cost += recCost(rec).total;
      cur.trips += 1;
      costByRoute.set(key, cur);
    }

    return [...byRoute.entries()].map(([route, v]) => {
      const [origin = "", dest = ""] = route.split(" → ").map((s) => s.trim());
      const distance = distanceFor(origin, dest);
      const actual = costByRoute.get(route);

      // ประมาณต้นทุนต่อเที่ยวจากโมเดล เมื่อรู้ระยะทาง — ใช้เฉพาะค่าที่ขึ้นกับระยะทาง
      // (น้ำมันคำนวณอัตโนมัติ + ค่าซ่อม) ส่วนเบี้ยเลี้ยง/ค่าธรรมเนียมไม่รู้จึงไม่ใส่
      const est = distance == null ? null : computeCost(
        {
          date: "", vehicle, fleetType, distance, revenue: 0,
          gas: 0, fuelCash: 0, fuelDownBill: 0, fuelFleet: 0, fuelPickup: 0,
          fuelUpBill: 0, fuelCallTruck: 0, fuelAutoOn: true,
          fuelOff: 0, fuelDetour: 0, fuelOffFleet: 0,
          drv: 0, spare: 0, snd: 0, laborOff: 0,
          feeTarp: 0, feePolice: 0, feeCont: 0, feePort: 0, feeDoc: 0, feeToll: 0,
        },
        REF,
      ).normal;

      return {
        route, origin, dest, revenue: v.revenue, bills: v.bills, distance,
        actualCost: actual?.cost ?? 0, actualTrips: actual?.trips ?? 0,
        estCostPerTrip: est,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [data, records, month, vehicle, fleetType]);

  /* หน้านี้ join ข้อมูลสองทาง — ไฟล์รายได้จาก ETL กับใบรายการจากชีต/เครื่อง
     ปุ่มเดียวจึงต้องสั่งดึงใหม่ทั้งคู่ ไม่งั้นตัวเลขสองฝั่งจะคนละรุ่นกัน */
  const refreshBoth = () => { reload(); state.reload(); };
  const refresh = (
    <RefreshBtn className="dash-reload" onClick={refreshBoth} loading={loading || state.loading}
      title="ดึงไฟล์รายได้จาก ETL และใบรายการล่าสุดมาคำนวณใหม่ทั้งคู่" />
  );

  if (error) {
    return (
      <div className="card">
        <h2>กำไรรายเส้นทาง</h2>
        <div className="banner">{error}</div>
        <div style={{ marginTop: 12 }}>{refresh}</div>
      </div>
    );
  }
  if (!data) return <div className="card"><p className="muted">กำลังโหลด...</p></div>;

  const matched = rows.filter((r) => r.distance != null);
  const revTotal = rows.reduce((s, r) => s + r.revenue, 0);
  const revMatched = matched.reduce((s, r) => s + r.revenue, 0);
  const withActual = rows.filter((r) => r.actualTrips > 0);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <h2 style={{ marginRight: "auto" }}>กำไรรายเส้นทาง</h2>
          {refresh}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          รวมรายได้จากไฟล์บิล เข้ากับต้นทุนจากโมเดลเดินรถ โดยใช้ "ต้นทาง → ปลายทาง" เป็นตัวเชื่อม
        </p>
        <div className="grid">
          <Stat label="เส้นทางทั้งหมด" value={String(rows.length)} />
          <Stat label="เส้นทางที่รู้ระยะทาง" value={`${matched.length}`}
            sub={fmtPct(rows.length ? matched.length / rows.length * 100 : 0) + " ของเส้นทาง"} />
          <Stat label="รายได้ที่เชื่อมได้" value={fmtPct(revTotal ? revMatched / revTotal * 100 : 0)}
            tone={t.status.good} sub="ของรายได้ทั้งหมด" />
          <Stat label="เส้นทางที่มีใบรายการจริง" value={String(withActual.length)}
            sub={withActual.length ? "ใช้ต้นทุนจริง" : "ยังไม่มี ใช้ประมาณการ"} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">ทุกเดือน</option>
            {data.monthly.map((m) => (
              <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>
            ))}
          </select>
          <label className="muted" style={{ fontSize: 12 }}>สมมติใช้รถ</label>
          <select value={fleetType} onChange={(e) => setFleetType(e.target.value as FleetType)}>
            <option value="รถบริษัท">รถบริษัท</option>
            <option value="รถร่วม">รถร่วม</option>
          </select>
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            {REF.vehicles.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 10 }}>
          ต้นทุนประมาณการคิดเฉพาะส่วนที่ผูกกับระยะทาง (ค่าน้ำมันตามอัตราสิ้นเปลือง +
          ค่าซ่อมตามเวลาและระยะทาง) <b>ยังไม่รวมเบี้ยเลี้ยงและค่าธรรมเนียม</b>
          เพราะสองอย่างนั้นไม่ได้ขึ้นกับเส้นทาง ต้องดูจากใบรายการจริง
          — ตัวเลขนี้จึงเป็น <b>ขอบล่าง</b>ของต้นทุน ไม่ใช่ต้นทุนเต็ม
        </p>
      </div>

      <div className="card">
        <h2>เส้นทางเรียงตามรายได้ <span className="muted">· 40 อันดับแรก</span></h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>เส้นทาง</th>
                <th className="n">ระยะทาง</th>
                <th className="n">รายได้</th>
                <th className="n">บิล</th>
                <th className="n">ต้นทุน/เที่ยว</th>
                <th>ที่มาของต้นทุน</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((r) => {
                const hasActual = r.actualTrips > 0;
                const costPerTrip = hasActual ? r.actualCost / r.actualTrips : r.estCostPerTrip;
                return (
                  <tr key={r.route}>
                    <td>{r.route}</td>
                    <td className="n">{r.distance != null ? `${r.distance} กม.` : "–"}</td>
                    <td className="n">{fmtBaht(r.revenue)}</td>
                    <td className="n">{r.bills.toLocaleString("th-TH")}</td>
                    <td className="n">{costPerTrip != null ? fmtBaht(costPerTrip) : "–"}</td>
                    <td>
                      {hasActual ? (
                        <span className="chip chip-done">จริง {r.actualTrips} เที่ยว</span>
                      ) : r.estCostPerTrip != null ? (
                        <span className="chip chip-warn">ประมาณการ</span>
                      ) : (
                        <span className="muted">ไม่รู้ระยะทาง</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length > matched.length && (
        <div className="card">
          <h2>เส้นทางที่ยังเชื่อมไม่ได้ <span className="muted">· {rows.length - matched.length} เส้นทาง</span></h2>
          <p className="muted" style={{ marginTop: 0 }}>
            ไม่มีในตารางระยะทางของโมเดล จึงคำนวณต้นทุนไม่ได้ — คิดเป็นรายได้แค่{" "}
            {fmtPct(revTotal ? (revTotal - revMatched) / revTotal * 100 : 0)} ของทั้งหมด
            ถ้าอยากให้ครบต้องเพิ่มคู่เส้นทางเหล่านี้ลง <code>refdata/routes.json</code>
          </p>
          <div className="scroll-x">
            <table>
              <thead><tr><th>เส้นทาง</th><th className="n">รายได้</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.distance == null).slice(0, 25).map((r) => (
                  <tr key={r.route}>
                    <td>{r.route}</td>
                    <td className="n">{fmtBaht(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
