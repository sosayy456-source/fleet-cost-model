/**
 * ตารางค่าซ่อมแซม — ยกจาก v5:932-960 (details.prices#repairPanel)
 *
 * ค่าซ่อม = Σ(อัตรารายปี × น้ำหนักถ่วงของปีนั้น) โดยแยกเป็น
 *   ตามเวลา (บาท/เที่ยว)  แยกตาม ประเภทรถ → ชนิดรถ
 *   ตามระยะทาง (บาท/กม.)  รถบริษัทกับรถร่วมใช้อัตราเดียวกัน
 * ช่องที่แก้เองจะขึ้นกรอบส้ม (input.edited) และเก็บทับฐานกลาง
 */
import { useState } from "react";
import { REF } from "../../../lib/refdata";
import { useOverrides } from "../../../lib/store/overrides";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const FLEETS = Object.keys(REF.repair.time);
const YEARS = REF.repair.years;

export default function RepairTable() {
  const [ovr, setOvr] = useOverrides();
  const [tab, setTab] = useState<string>(FLEETS[0] ?? "รถบริษัท");
  const [msg, setMsg] = useState("");

  const rep = ovr.repair ?? {};
  const weights = YEARS.map((_, i) => rep.weights?.[i] ?? REF.repair.weights[i] ?? 0);

  const timeBase = REF.repair.time[tab] ?? {};
  const vehKeys = Object.keys(timeBase);

  const timeVal = (veh: string, i: number) =>
    rep.time?.[tab]?.[veh]?.[i] ?? REF.repair.time[tab]?.[veh]?.[i] ?? 0;
  const timeEdited = (veh: string, i: number) => rep.time?.[tab]?.[veh]?.[i] != null;
  const distVal = (veh: string, i: number) =>
    rep.dist?.[veh]?.[i] ?? REF.repair.dist[veh]?.[i] ?? 0;
  const distEdited = (veh: string, i: number) => rep.dist?.[veh]?.[i] != null;

  const weighted = (get: (i: number) => number) =>
    YEARS.reduce((s, _, i) => s + get(i) * (weights[i] ?? 0), 0);

  const setWeight = (i: number, v: string) => {
    const next = YEARS.map((_, j) => (j === i ? (parseFloat(v) || 0) : weights[j] ?? 0));
    setOvr({ ...ovr, repair: { ...rep, weights: next } });
    setMsg("แก้น้ำหนักถ่วงแล้ว — ค่าซ่อมทุกใบจะคิดใหม่ทันที");
  };

  const setTime = (veh: string, i: number, v: string) => {
    const cur = rep.time?.[tab]?.[veh] ?? YEARS.map(() => null);
    const arr = YEARS.map((_, j) => (j === i ? (v === "" ? null : parseFloat(v) || 0) : cur[j] ?? null));
    setOvr({ ...ovr, repair: { ...rep, time: { ...rep.time, [tab]: { ...rep.time?.[tab], [veh]: arr } } } });
    setMsg(`แก้อัตราตามเวลาของ ${veh} แล้ว`);
  };

  const setDist = (veh: string, i: number, v: string) => {
    const cur = rep.dist?.[veh] ?? YEARS.map(() => null);
    const arr = YEARS.map((_, j) => (j === i ? (v === "" ? null : parseFloat(v) || 0) : cur[j] ?? null));
    setOvr({ ...ovr, repair: { ...rep, dist: { ...rep.dist, [veh]: arr } } });
    setMsg(`แก้อัตราตามระยะทางของ ${veh} แล้ว`);
  };

  const reset = () => {
    if (!confirm("คืนค่าตารางค่าซ่อมกลับเป็นค่าฐานกลางทั้งหมด?")) return;
    setOvr({ ...ovr, repair: {} });
    setMsg("คืนค่าฐานกลางแล้ว");
  };

  return (
    <div className="card">
      {/* main เปิดกางไว้ตั้งแต่แรก (มี attribute open) */}
      <details className="prices" open>
        <summary>
          🔧 การคำนวณค่าซ่อมแซม (แก้อัตราและน้ำหนักรายปีได้) · กดเพื่อดู/แก้ไข
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          ค่าซ่อมของใบหนึ่ง = <b>ตามเวลา</b> (บาท/เที่ยว) + <b>ตามระยะทาง</b> (บาท/กม. × ระยะทาง)
          โดยแต่ละส่วนคิดจากอัตรารายปีถ่วงน้ำหนักตามช่องด้านล่าง · ชนิดรถที่ไม่มีในตารางคิดเป็น 0
        </div>

        <div className="rep-weights">
          <span className="wlab">น้ำหนักถ่วงรายปี (พ.ศ.)</span>
          {YEARS.map((yy, i) => (
            <label key={yy} style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <span className="wlab">25{yy}</span>
              <input type="number" step="0.05" value={weights[i] ?? 0}
                onChange={(e) => setWeight(i, e.target.value)} />
            </label>
          ))}
          <span className="wlab">รวม {weights.reduce((s, w) => s + w, 0).toFixed(2)}</span>
          <button className="btn-ghost" type="button" onClick={reset} style={{ marginLeft: "auto" }}>
            ↺ คืนค่าฐานกลาง
          </button>
        </div>
        <div className="msg" style={{ color: "var(--green)" }}>{msg}</div>

        <div className="rep-tabs">
          {FLEETS.map((k) => (
            <button key={k} type="button" className={"rtab" + (tab === k ? " on" : "")}
              onClick={() => setTab(k)}>{k}</button>
          ))}
        </div>

        <h3 className="grp"><span className="dot" />ค่าซ่อมตามเวลา · บาท/เที่ยว · {tab}</h3>
        <div className="scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="rep-tbl">
            <thead><tr>
              <th>ชนิดรถ</th>
              {YEARS.map((yy) => <th key={yy}>25{yy}</th>)}
              <th>ถ่วงน้ำหนักแล้ว</th>
            </tr></thead>
            <tbody>
              {vehKeys.map((veh) => (
                <tr key={veh}>
                  <td>{veh}</td>
                  {YEARS.map((_, i) => (
                    <td key={i}>
                      <input type="number" step="0.01"
                        className={timeEdited(veh, i) ? "edited" : undefined}
                        value={timeVal(veh, i)}
                        onChange={(e) => setTime(veh, i, e.target.value)} />
                    </td>
                  ))}
                  <td className="rep-total">
                    {weighted((i) => timeVal(veh, i)).toLocaleString("th-TH", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="grp"><span className="dot" />ค่าซ่อมตามระยะทาง · บาท/กม. · ใช้ร่วมกันทุกประเภทรถ</h3>
        <div className="scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="rep-tbl">
            <thead><tr>
              <th>ชนิดรถ</th>
              {YEARS.map((yy) => <th key={yy}>25{yy}</th>)}
              <th>ถ่วงน้ำหนักแล้ว</th>
            </tr></thead>
            <tbody>
              {Object.keys(REF.repair.dist).map((veh) => (
                <tr key={veh}>
                  <td>{veh}</td>
                  {YEARS.map((_, i) => (
                    <td key={i}>
                      <input type="number" step="0.0001"
                        className={distEdited(veh, i) ? "edited" : undefined}
                        value={distVal(veh, i)}
                        onChange={(e) => setDist(veh, i, e.target.value)} />
                    </td>
                  ))}
                  <td className="rep-total">
                    {weighted((i) => distVal(veh, i)).toLocaleString("th-TH", { maximumFractionDigits: 4 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dz-note">
          ช่องกรอบส้มคือค่าที่แก้เอง เก็บในเครื่องนี้เท่านั้น — ถ้าอยากให้ทุกฝ่ายคิดเหมือนกัน
          ต้องแก้ที่ไฟล์ <code>refdata/repair.json</code>
        </div>
      </details>
    </div>
  );
}
