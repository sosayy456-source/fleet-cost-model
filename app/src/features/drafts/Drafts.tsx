/**
 * ใบที่ยังกรอกไม่ครบทั้ง 3 ฝ่าย — ตรงตาม v5:932-957
 * กดที่แถวเพื่อเปิดใบนั้นมากรอกส่วนของคุณ (v5 เรียก loadRecordToForm)
 */
import { useMemo, useState } from "react";
import { ROLES, ROLE_ORDER, roleAllDone, roleDone } from "../../lib/record/roles";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

export default function Drafts({ state }: { state: RecordsState }) {
  const { records, loading } = state;
  const [q, setQ] = useState("");

  const drafts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records
      .filter((r) => !roleAllDone(r))
      .filter((r) => !needle || [r.docNo, r.branch, r.origin, r.dest]
        .some((v) => String(v ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }, [records, q]);

  const open = (r: TripRecord) => {
    sessionStorage.setItem("editRecordId", r.id);
    location.hash = "#/entry";
  };

  /* แถบใบค้างแบบชิป — เหมือน draftbar ของ v5 ที่โผล่เหนือฟอร์ม */
  const urgent = drafts.filter((r) => (daysBetween(r.date, todayISO()) ?? 0) > 7);

  return (
    <>
      {urgent.length > 0 && (
        <div className="draftbar">
          <div className="dt">⚠ ใบที่ค้างเกิน 7 วัน · {urgent.length} ใบ — กดเพื่อเปิดมากรอกต่อ</div>
          <div className="draftlist">
            {urgent.slice(0, 12).map((r) => (
              <button key={r.id} type="button" className="dchip" onClick={() => open(r)}>
                {r.docNo || "(ยังไม่ใส่เลข)"}
                <span className="age">{daysBetween(r.date, todayISO())} วัน</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rec-bar">
        <div className="searchbox">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นเลขที่ใบ / สาขา / เส้นทาง" />
        </div>
        <span className="locknote">ใบที่ยังไม่ครบ {drafts.length} ใบ · ทั้งหมด {records.length} ใบ</span>
      </div>

      <div className="rec-card">
        <div className="scroll">
          <table className="rec-table">
            <thead><tr>
              <th>เลขที่ใบรายการ</th><th>วันที่</th><th>สาขา</th><th>เส้นทาง</th>
              <th className="num">ค้างมา</th><th>ความคืบหน้า</th><th>รอฝ่าย</th><th />
            </tr></thead>
            <tbody>
              {drafts.map((r) => {
                const waiting = ROLE_ORDER.filter((k) => !roleDone(r, k));
                const age = daysBetween(r.date, todayISO());
                return (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => open(r)}>
                    <td className="doc">{r.docNo || "(ยังไม่ใส่เลข)"}</td>
                    <td>{thDateSafe(r.date)}</td>
                    <td>{r.branch || "–"}</td>
                    <td>{r.origin && r.dest ? `${r.origin} → ${r.dest}` : "–"}</td>
                    <td className="num" style={age != null && age > 7 ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                      {age != null ? `${age} วัน` : "–"}
                    </td>
                    <td>
                      {ROLE_ORDER.map((k) => (
                        <span key={k} className={roleDone(r, k) ? "chip-ok" : "chip-wait"}
                          style={{ marginRight: 4 }} title={ROLES[k].label}>
                          {ROLES[k].icon}
                        </span>
                      ))}
                    </td>
                    <td className="locknote">{waiting.map((k) => ROLES[k].label).join(", ")}</td>
                    <td>
                      <button className="btn-edit" type="button" onClick={(e) => { e.stopPropagation(); open(r); }}>
                        กรอกต่อ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {drafts.length === 0 && !loading && (
          <div className="rec-empty">ไม่มีใบค้าง — ทุกใบกรอกครบทั้ง 3 ฝ่ายแล้ว 🎉</div>
        )}
        {loading && <div className="rec-empty">กำลังโหลด...</div>}
      </div>
    </>
  );
}
