/**
 * โครงแอป — Phase 4
 * ตอนนี้มีหน้ากรอกข้อมูลที่ต่อ Google Sheet ได้จริงแล้ว
 * หน้ารายการ/ลูกหนี้/แดชบอร์ด จะตามมาใน Phase 5-7
 */
import { useEffect, useState } from "react";
import EntryForm from "./features/entry/EntryForm";
import SheetSettings from "./features/settings/SheetSettings";
import { ROLES, ROLE_ORDER } from "./lib/record/roles";
import { migrateFromLocalStorage } from "./lib/store/records";
import { DATASET, IS_SAMPLE } from "./lib/dataset";
import type { RoleKey } from "./types/record";

const LS_ROLE = "modelRole";

export default function App() {
  const [role, setRole] = useState<RoleKey | null>(
    () => (localStorage.getItem(LS_ROLE) as RoleKey | null) ?? null,
  );
  const [migrated, setMigrated] = useState<number | null>(null);

  useEffect(() => {
    // ย้ายใบที่เคยกรอกไว้ใน v5 เข้า IndexedDB ครั้งเดียว
    migrateFromLocalStorage()
      .then((r) => { if (!r.alreadyDone && r.migrated) setMigrated(r.migrated); })
      .catch(() => { /* เปิดใน private mode อาจใช้ IndexedDB ไม่ได้ ไม่ถือว่าพัง */ });
  }, []);

  const pick = (k: RoleKey) => { localStorage.setItem(LS_ROLE, k); setRole(k); };

  return (
    <div className="wrap">
      {IS_SAMPLE && (
        <div className="banner">
          ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท (dataset: {DATASET})
        </div>
      )}

      <h1>โมเดลต้นทุนการเดินรถ</h1>
      <p className="sub">
        {role
          ? <>กำลังกรอกในฐานะ <b>{ROLES[role].icon} {ROLES[role].label}</b> · {ROLES[role].desc}{" "}
              <button type="button" className="link" onClick={() => setRole(null)}>เปลี่ยนฝ่าย</button></>
          : "เลือกฝ่ายของคุณก่อนเริ่มกรอก"}
      </p>

      {migrated != null && (
        <div className="card" style={{ borderColor: "var(--green)" }}>
          ย้ายใบรายการจากเวอร์ชันเดิมเข้าระบบใหม่แล้ว {migrated} ใบ
          <span className="muted"> (ของเดิมใน localStorage ยังอยู่ ไม่ได้ลบ)</span>
        </div>
      )}

      {!role ? (
        <div className="card">
          <h2>คุณอยู่ฝ่ายไหน</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            แต่ละฝ่ายกรอกเฉพาะส่วนของตัวเอง ใบจะสมบูรณ์เมื่อครบทั้ง 3 ฝ่าย
            เปลี่ยนทีหลังได้ตลอด
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ROLE_ORDER.map((k) => (
              <button key={k} type="button" onClick={() => pick(k)} style={{ textAlign: "left" }}>
                <b>{ROLES[k].icon} {ROLES[k].label}</b>
                <br />
                <span className="muted" style={{ fontSize: 12 }}>{ROLES[k].desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <SheetSettings />
          <EntryForm role={role} />
        </>
      )}
    </div>
  );
}
