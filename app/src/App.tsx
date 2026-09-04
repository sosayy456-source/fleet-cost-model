/**
 * หน้าเริ่มต้น — ยังเป็นโครง (Phase 1)
 * ตอนนี้ทำหน้าที่เป็น smoke test ว่าข้อมูลอ้างอิงกับโมเดลต้นทุนต่อกันติดจริง
 * หน้าจอกรอกข้อมูล/แดชบอร์ดจะมาใน Phase 4 เป็นต้นไป
 */
import { computeCost } from "./lib/cost/computeCost";
import { BRANCHES, DOC_TYPES, ORIGINS, REF, distanceFor } from "./lib/refdata";
import type { CostInput } from "./lib/cost/types";
import { DATASET, IS_SAMPLE } from "./lib/dataset";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// เที่ยววิ่งตัวอย่างไว้พิสูจน์ว่าโมเดลคำนวณได้จริง
const demo: CostInput = {
  date: "2026-06-04",
  vehicle: "รถเทรเลอร์",
  fleetType: "รถบริษัท",
  distance: distanceFor("เชียงใหม่", "ตลาดไท") ?? 720,
  revenue: 60000,
  gas: 0,
  fuelCash: 3000, fuelDownBill: 0, fuelFleet: 5000, fuelPickup: 0,
  fuelUpBill: 0, fuelCallTruck: 0, fuelAutoOn: true,
  fuelOff: 0, fuelDetour: 1200, fuelOffFleet: 0,
  drv: 1500, spare: 0, snd: 0, laborOff: 300,
  feeTarp: 200, feePolice: 0, feeCont: 0, feePort: 0, feeDoc: 100, feeToll: 450,
};

export default function App() {
  const r = computeCost(demo, REF);
  const noRepairData = REF.vehicles.filter(
    (v) => !REF.repair.dist[v.repairKey] &&
      !Object.values(REF.repair.time).some((t) => t[v.repairKey]),
  );

  return (
    <div className="wrap">
      {IS_SAMPLE && (
        <div className="banner">
          ⚠️ ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท (dataset: {DATASET})
        </div>
      )}

      <h1>โมเดลต้นทุนการเดินรถ</h1>
      <p className="sub">กำลังย้ายจากไฟล์ HTML เดี่ยวมาเป็นเว็บแอป · ตอนนี้เสร็จ Phase 1–2</p>

      <div className="card">
        <h2>ข้อมูลอ้างอิงที่ดึงมาจากโมเดลเดิม</h2>
        <div className="grid">
          <div className="stat"><div className="label">ราคาน้ำมัน</div><div className="value">{REF.prices.length} เรท</div></div>
          <div className="stat"><div className="label">ชนิดรถ</div><div className="value">{REF.vehicles.length}</div></div>
          <div className="stat"><div className="label">ต้นทางในตารางระยะทาง</div><div className="value">{ORIGINS.length}</div></div>
          <div className="stat"><div className="label">สาขา</div><div className="value">{BRANCHES.length}</div></div>
          <div className="stat"><div className="label">ประเภทใบรายการ</div><div className="value">{DOC_TYPES.length}</div></div>
        </div>
      </div>

      <div className="card">
        <h2>ตัวอย่างการคำนวณ · เชียงใหม่ → ตลาดไท · {demo.vehicle}</h2>
        <table>
          <tbody>
            <tr><td>ระยะทาง</td><td className="n">{baht(demo.distance)} กม.</td></tr>
            <tr>
              <td>ค่าน้ำมันเหมา <span className="muted">(กรอกเอง + อัตโนมัติ {baht(r.auto.cost)})</span></td>
              <td className="n">{baht(r.fuelSum)}</td>
            </tr>
            <tr><td>ค่าแรง</td><td className="n">{baht(r.labor)}</td></tr>
            <tr><td>ค่าธรรมเนียม</td><td className="n">{baht(r.fees)}</td></tr>
            <tr>
              <td>ค่าซ่อมแซม <span className="muted">(ตามเวลา {baht(r.repair.fixed)} + ตามระยะทาง {baht(r.repair.varCost)})</span></td>
              <td className="n">{baht(r.repair.total)}</td>
            </tr>
            <tr><td><b>ต้นทุนปกติ</b></td><td className="n"><b>{baht(r.normal)}</b></td></tr>
            <tr><td>ต้นทุนสูญเปล่า</td><td className="n">{baht(r.waste)}</td></tr>
            <tr><td>รายได้</td><td className="n">{baht(demo.revenue)}</td></tr>
            <tr>
              <td><b>กำไร/ขาดทุน</b></td>
              <td className="n" style={{ color: r.profit >= 0 ? "var(--green)" : "var(--red)" }}>
                <b>{baht(r.profit)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {noRepairData.length > 0 && (
        <div className="card">
          <h2>ชนิดรถที่ไม่มีอัตราค่าซ่อมในตาราง</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            โมเดลจะคิดค่าซ่อมเป็น 0 ให้รถเหล่านี้ (เป็นพฤติกรรมเดิมของ v5 ที่ยกมาทั้งดุ้น)
            — ถ้าได้อัตราจริงมาเมื่อไหร่ ควรเติมลง refdata/repair.json
          </p>
          <ul className="muted" style={{ margin: 0 }}>
            {noRepairData.map((v) => <li key={v.name}>{v.name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
