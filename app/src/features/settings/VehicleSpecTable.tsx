/** ตารางปริมาตรและน้ำหนักบรรทุกสูงสุดของรถแต่ละชนิด */
import { useState } from "react";
import type { Vehicle } from "../../lib/cost/types";
import { ACTIVE_VEHICLES } from "../../lib/refdata";
import { vehicleSpec } from "../../lib/refdata/vehicleSpecs";
import { useOverrides } from "../../lib/store/overrides";

import SettingsTableCard from "../../lib/ui/SettingsTableCard";

type Field = "volumeM3" | "capacityKg";
type Drafts = Record<string, Partial<Record<Field, string>>>;

const baseValue = (vehicle: Vehicle, field: Field): number | null => {
  const value = vehicle[field];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
};
const same = (a: number | null, b: number | null) =>
  a === b || (a != null && b != null && Math.abs(a - b) < 1e-9);
const numberText = (value: number | null) => value == null ? "" : String(value);
const positive = (value: string): number | null => {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

export default function VehicleSpecTable() {
  const [ovr, setOvr] = useOverrides();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [msg, setMsg] = useState("");
  const overrides = ovr.vehicleSpecs ?? {};

  const shownValue = (vehicle: Vehicle, field: Field): string => {
    const draft = drafts[vehicle.name]?.[field];
    if (draft !== undefined) return draft;
    const spec = vehicleSpec(vehicle, overrides);
    return numberText(spec?.[field] ?? null);
  };

  const setDraft = (vehicle: string, field: Field, value: string) => {
    setDrafts((current) => ({
      ...current,
      [vehicle]: { ...current[vehicle], [field]: value },
    }));
  };

  const clearDraft = (vehicle: string, field: Field) => {
    setDrafts((current) => {
      const row = { ...current[vehicle] };
      delete row[field];
      const next = { ...current };
      if (Object.keys(row).length) next[vehicle] = row;
      else delete next[vehicle];
      return next;
    });
  };

  const commit = (vehicle: Vehicle, field: Field) => {
    const text = drafts[vehicle.name]?.[field];
    if (text === undefined) return;
    const value = positive(text);
    if (text.trim() && value == null) {
      setMsg(`${vehicle.name}: กรุณากรอกค่าที่มากกว่า 0`);
      clearDraft(vehicle.name, field);
      return;
    }

    const rows = structuredClone(overrides);
    const row = { ...rows[vehicle.name] };
    if (value == null || same(value, baseValue(vehicle, field))) delete row[field];
    else row[field] = value;
    if (Object.keys(row).length) rows[vehicle.name] = row;
    else delete rows[vehicle.name];

    setOvr({ ...ovr, vehicleSpecs: rows });
    clearDraft(vehicle.name, field);
    setMsg(value == null
      ? `ล้างค่าของ ${vehicle.name} แล้ว`
      : `บันทึกสเปก ${vehicle.name} แล้ว ✓`);
  };

  const resetAll = () => {
    const count = Object.keys(overrides).length;
    if (!count) { setMsg("ยังไม่มีสเปกรถที่แก้เอง"); return; }
    if (!confirm(`ย้อนสเปกรถที่แก้เอง ${count} ชนิดกลับไปใช้ค่าพื้นฐาน?`)) return;
    setOvr({ ...ovr, vehicleSpecs: {} });
    setDrafts({});
    setMsg("ย้อนสเปกรถทั้งหมดกลับไปใช้ค่าพื้นฐานแล้ว ✓");
  };

  const edited = (vehicle: Vehicle, field: Field) => overrides[vehicle.name]?.[field] != null;

  return (
    <SettingsTableCard className="vehicle-spec-card"
      title="🚛 ปริมาตรและน้ำหนักบรรทุกสูงสุดของรถแต่ละชนิด · กดเพื่อดู/แก้ไข">

        <div className="settings-table-lead">
          <div className="price-note vehicle-spec-intro">
            ค่าเริ่มต้นมีครบ <b>{ACTIVE_VEHICLES.length} ชนิดรถ</b> · ปริมาตรใช้หน่วย
            <b> ลูกบาศก์เมตร (ม³)</b> และน้ำหนักสูงสุดใช้หน่วย <b>กิโลกรัม (กก.)</b><br />
            แก้ตัวเลขได้โดยตรง ระบบบันทึกเมื่อออกจากช่องหรือกด Enter
          </div>
        </div>

        <div className="scroll settings-table-scroll vehicle-spec-scroll">
          <table className="vehicle-spec-table">
            <thead><tr>
              <th>ชนิดรถ</th>
              <th>ปริมาตร (ม³)</th>
              <th>น้ำหนักสูงสุด (กก.)</th>
            </tr></thead>
            <tbody>
              {ACTIVE_VEHICLES.map((vehicle) => (
                <tr key={vehicle.name}>
                  <td>
                    <b>{vehicle.name}</b>
                    {vehicle.approxFrom && <small>อัตราต้นทุนบางส่วนอ้างอิง {vehicle.approxFrom}</small>}
                  </td>
                  <td>
                    <input type="number" min="0" step="0.1" inputMode="decimal"
                      aria-label={`${vehicle.name} ปริมาตรบรรทุก`}
                      className={edited(vehicle, "volumeM3") ? "edited" : undefined}
                      value={shownValue(vehicle, "volumeM3")}
                      onChange={(e) => setDraft(vehicle.name, "volumeM3", e.target.value)}
                      onBlur={() => commit(vehicle, "volumeM3")}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                  </td>
                  <td>
                    <input type="number" min="0" step="100" inputMode="numeric"
                      aria-label={`${vehicle.name} น้ำหนักบรรทุกสูงสุด`}
                      className={edited(vehicle, "capacityKg") ? "edited" : undefined}
                      value={shownValue(vehicle, "capacityKg")}
                      onChange={(e) => setDraft(vehicle.name, "capacityKg", e.target.value)}
                      onBlur={() => commit(vehicle, "capacityKg")}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="vehicle-spec-foot">
          <div className="msg" role="status" aria-live="polite">{msg}</div>
          <button type="button" className="btn-ghost" onClick={resetAll}>↺ ย้อนกลับไปใช้ค่าพื้นฐานทั้งหมด</button>
        </div>
    </SettingsTableCard>
  );
}
