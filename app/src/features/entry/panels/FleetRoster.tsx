/**
 * ทะเบียนรถในกองรถ (Fleet Roster) — ยกจาก v5:780-800 (บล็อก details#fleetPanel)
 * ใช้คำนวณ %การใช้ประโยชน์ของแต่ละคันในแดชบอร์ด
 */
import { useMemo, useState } from "react";
import { ACTIVE_VEHICLES } from "../../../lib/refdata";
import { thDateSafe } from "../../../lib/record/date";
import { FLEET_STATUS, isBasePlate, kindsOf, useRoster } from "../../../lib/store/roster";
import type { FleetVehicle } from "../../../lib/store/roster";

const Chev = () => (
  <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
);

const blank: FleetVehicle = { plate: "", fleetType: "", vehicle: "", start: "", status: "ใช้งาน" };

export default function FleetRoster() {
  const [roster, setRoster] = useRoster();
  const [draft, setDraft] = useState<FleetVehicle>(blank);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (needle
      ? roster.filter((f) => f.plate.toLowerCase().includes(needle) || f.vehicle.toLowerCase().includes(needle))
      : roster
    ).slice().sort((a, b) => a.plate.localeCompare(b.plate, "th"));
  }, [roster, q]);
  const [msg, setMsg] = useState("");

  const add = () => {
    const plate = draft.plate.trim();
    if (!plate) { setMsg("กรอกทะเบียนรถก่อน"); return; }
    if (roster.some((f) => f.plate === plate)) { setMsg("ทะเบียนนี้มีอยู่แล้วในกองรถ"); return; }
    setRoster([...roster, { ...draft, plate }]);
    setDraft(blank);
    setMsg(`เพิ่ม ${plate} เข้ากองรถแล้ว`);
  };

  const del = (plate: string) => {
    if (!confirm(`ลบ ${plate} ออกจากกองรถ?`)) return;
    setRoster(roster.filter((f) => f.plate !== plate));
    setMsg(`ลบ ${plate} แล้ว`);
  };

  return (
    <div className="card">
      <details className="prices">
        <summary>
          🚚 ทะเบียนรถในกองรถ (Fleet Roster) · ใช้คำนวณการใช้ประโยชน์กองรถ (Utilization) · กดเพื่อดู/แก้ไข
          <Chev />
        </summary>

        <div className="price-note" style={{ marginTop: 12 }}>
          ฐานกลาง <b>{roster.filter((f) => isBasePlate(f.plate)).length} คัน</b> มาจากไฟล์ ทะเบียนในกองรถ.xlsx
          (วันที่เริ่มใช้งาน = วันที่ปล่อยรถครั้งแรก · คันที่วิ่งตั้งแต่ ม.ค. 2567 นับจาก 1 ม.ค. 2567) —
          ระบบใช้ <b>วันที่เริ่มใช้งาน</b> เทียบกับจำนวนวันที่มีเที่ยววิ่งจริง เพื่อคำนวณ % การใช้ประโยชน์ ·
          เพิ่มรถใหม่ที่ยังไม่อยู่ในไฟล์ได้ด้านล่าง ที่แก้/ลบเก็บในเครื่องนี้เท่านั้น
        </div>

        <div className="price-add">
          <input placeholder="ทะเบียนรถ" style={{ flex: 1, minWidth: 120 }}
            value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} />
          <select value={draft.fleetType} onChange={(e) => setDraft({ ...draft, fleetType: e.target.value })}>
            <option value="">ประเภทรถ</option><option>รถบริษัท</option><option>รถร่วม</option>
            {/* คิดต้นทุนแบบรถร่วม (costFleetType) แต่แยกประเภทไว้ในทะเบียน — 24 ก.ย. 2569 */}
            <option>รถร่วมนอกพิเศษ</option>
          </select>
          <select value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}>
            <option value="">ชนิดรถ</option>
            {ACTIVE_VEHICLES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          <input type="date" style={{ flex: "none", width: 150 }}
            value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            {FLEET_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn-add" type="button" onClick={add}>+ เพิ่มรถ</button>
        </div>
        <div className="msg" style={{ color: "var(--green)" }}>{msg}</div>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาทะเบียน / ชนิดรถ"
          style={{ margin: "4px 0 10px", maxWidth: 320 }} />

        <div className="scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
          <table>
            <thead><tr>
              <th>ทะเบียนรถ</th><th>ประเภทรถ</th><th>ชนิดรถ</th><th>เริ่มใช้งาน</th><th>สถานะ</th><th />
            </tr></thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 14 }}>
                  {roster.length ? "ไม่พบที่ค้นหา" : "ยังไม่มีรถในกองรถ — เพิ่มด้านบน"}
                </td></tr>
              ) : shown.map((f) => (
                <tr key={f.plate}>
                  <td style={{ fontWeight: 700 }}>{f.plate}</td>
                  <td>{f.fleetType || "–"}</td>
                  <td title={kindsOf(f).map((k) => `${k.fleetType} · ${k.vehicle} (${k.trips} เที่ยว)`).join(", ")}>
                    {f.vehicle || "–"}
                    {kindsOf(f).length > 1 && (
                      <span className="hint" style={{ marginLeft: 4 }}>+{kindsOf(f).length - 1} ชนิด</span>
                    )}
                  </td>
                  <td>{thDateSafe(f.start)}</td>
                  <td>{f.status || "–"}</td>
                  <td><button className="del-x" type="button" title="ลบ" onClick={() => del(f.plate)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
