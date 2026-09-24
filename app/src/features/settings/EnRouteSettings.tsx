/**
 * ตั้งค่า "จุดระหว่างทาง" ของหน้าจัดรถ (เจ้าของงานสั่ง 24 ก.ย. 2569)
 * เลือกคู่ ต้นทาง → ปลายทาง แล้วติ๊กปลายทางอื่นของต้นทางนั้นที่อยู่ระหว่างทาง
 * — ติ๊กบิลแรกในหน้าจัดรถแล้ว ตารางเหลือบิลต้นทางเดียวกันที่ไปปลายทางเดียวกันหรือจุดที่ติ๊กไว้ที่นี่
 *
 * ค่าเริ่มต้นร่างจากถนนสายหลัก (lib/route/enRoute.ts) · ที่แก้เก็บ localStorage ของเครื่องนั้น
 * (เจ้าของงานเลือกแบบเดียวกับราคาน้ำมัน/สเปกรถ — เครื่องฝ่ายจัดรถต้องแก้ที่เครื่องตัวเองถ้าใช้คนละเครื่อง)
 */
import { useState } from "react";
import { destsFor } from "../../lib/refdata";
import { ROUTE_ORIGINS, defaultStops, pairKey, stopsFor, useEnRoute } from "../../lib/route/enRoute";

export default function EnRouteSettings() {
  const [ovr, setPair, resetAll] = useEnRoute();
  const [origin, setOrigin] = useState(ROUTE_ORIGINS[0] ?? "");
  const dests = destsFor(origin);
  const [dest, setDest] = useState(dests[0] ?? "");
  const d = dests.includes(dest) ? dest : dests[0] ?? "";

  const stops = d ? stopsFor(origin, d, ovr) : [];
  const edited = !!d && pairKey(origin, d) in ovr;
  const nEdited = Object.keys(ovr).length;
  const toggle = (s: string) => {
    const next = stops.includes(s) ? stops.filter((x) => x !== s) : [...stops, s];
    // เรียงตามลำดับปลายทางในตาราง ให้หน้าจัดรถแสดงเป็นระเบียบเดียวกันทุกครั้ง
    setPair(origin, d, dests.filter((x) => next.includes(x)));
  };

  return (
    <div className="card">
      <div className="card-h"><span className="step">⇢</span><h2>จุดระหว่างทาง (หน้าจัดรถ)</h2>
        <span className="hint">ติ๊กบิลแรกแล้ว ตารางบิลเหลือเฉพาะต้นทางเดียวกัน ที่ไปปลายทางเดียวกันหรือจุดที่ติ๊กไว้ที่นี่</span></div>

      <div className="price-add">
        <label style={{ alignSelf: "center" }}>ต้นทาง</label>
        <select value={origin} onChange={(e) => { setOrigin(e.target.value); setDest(destsFor(e.target.value)[0] ?? ""); }}>
          {ROUTE_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <label style={{ alignSelf: "center" }}>ปลายทาง</label>
        <select value={d} onChange={(e) => setDest(e.target.value)}>
          {dests.map((x) => <option key={x} value={x}>{x}{pairKey(origin, x) in ovr ? " (แก้แล้ว)" : ""}</option>)}
        </select>
      </div>

      {d && (
        <>
          <div className="enroute-grid">
            {dests.filter((x) => x !== d).map((x) => (
              <label key={x} className="chk">
                <input type="checkbox" checked={stops.includes(x)} onChange={() => toggle(x)} />
                {x}
              </label>
            ))}
          </div>
          <div className="price-note" style={{ marginTop: 12 }}>
            {origin} → {d} · ระหว่างทาง {stops.length ? stops.join(" · ") : "ไม่มี"}
            {edited ? " · แก้จากค่าเริ่มต้นแล้ว" : " · ค่าเริ่มต้น"}
            {edited && <> (ค่าเริ่มต้น: {defaultStops(origin, d).join(" · ") || "ไม่มี"})</>}
          </div>
        </>
      )}

      <div className="bill-actions">
        <span className="muted">แก้แล้ว {nEdited} คู่ · เก็บในเครื่องนี้เท่านั้น</span>
        <button type="button" className="btn-mini" disabled={!edited} onClick={() => setPair(origin, d, null)}>
          ย้อนกลับค่าเริ่มต้นของคู่นี้
        </button>
        <button type="button" className="btn-mini" disabled={!nEdited}
          onClick={() => { if (confirm(`ย้อนกลับค่าเริ่มต้นทั้งตาราง (${nEdited} คู่ที่แก้ไว้จะหาย)?`)) resetAll(); }}>
          ย้อนกลับค่าเริ่มต้นทั้งหมด
        </button>
      </div>
    </div>
  );
}
