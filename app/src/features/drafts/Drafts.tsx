/**
 * ใบที่ยังกรอกไม่ครบทั้ง 3 ฝ่าย — ตรงตาม <section id="view-drafts"> และ renderDrafts()
 * ของ index.html บน main
 *
 * กดที่แถวเพื่อเปิดใบนั้นไปกรอกส่วนของฝ่ายตัวเองต่อ (main เรียก openDoc)
 * ส่วนแถบชิป “ใบที่ยังรอฝ่ายเรากรอก” อยู่ในหน้าบันทึกข้อมูล ไม่ใช่หน้านี้
 */
import { useMemo, useState } from "react";
import { ROLE_ORDER, roleAllDone, roleDone } from "../../lib/record/roles";
import RefreshBtn from "../../lib/ui/RefreshBtn";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

export default function Drafts({ state }: { state: RecordsState }) {
  const { records, loading, reload } = state;
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

  return (
    <>
      <div className="rec-bar">
        <div className="searchbox">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่ใบรายการ / สาขา / เส้นทาง..." />
        </div>
        {/* สองปุ่มนี้เรียก reload ตัวเดียวกัน (useRecords ดึงทั้งในเครื่องและบนชีตในรอบเดียว
            แยกดึงเฉพาะอย่างใดอย่างหนึ่งไม่ได้) แยกไว้เพราะปุ่มเดิมสื่อว่าดึงจากชีต
            ส่วนปุ่มรีเฟรชเป็นปุ่มเดียวกับหน้าอื่น คนใช้จะได้หาที่เดิมเจอทุกหน้า */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-green" type="button" onClick={reload} disabled={loading}>
            ↻ โหลดใบจากชีต
          </button>
          <RefreshBtn className="btn-ghost" onClick={reload} loading={loading}
            title="ดึงใบรายการล่าสุดมาตรวจความครบถ้วนใหม่" />
        </div>
      </div>

      <div className="rec-card">
        <div className="scroll">
          <table className="rec-table">
            <thead><tr>
              <th>เลขที่ใบรายการ</th><th>วันที่</th><th>สาขา</th><th>เส้นทาง</th>
              <th style={{ textAlign: "center" }}>👤 บริการลูกค้า</th>
              <th style={{ textAlign: "center" }}>🚚 จัดรถ</th>
              <th style={{ textAlign: "center" }}>🧾 บัญชี</th>
              <th className="num">ค้างมา (วัน)</th><th>สถานะ</th>
            </tr></thead>
            <tbody>
              {drafts.map((r) => {
                const age = r.date ? Math.max(0, daysBetween(r.date, todayISO()) ?? 0) : 0;
                return (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => open(r)}>
                    <td className="doc">{r.docNo || "–"}</td>
                    <td>{thDateSafe(r.date)}</td>
                    <td>{r.branch || "–"}</td>
                    <td>{r.origin && r.dest ? `${r.origin}→${r.dest}` : "–"}</td>
                    {ROLE_ORDER.map((k) => (
                      <td key={k} style={{ textAlign: "center" }}>
                        <span className={"badge " + (roleDone(r, k) ? "paid" : "unpaid")}>
                          {roleDone(r, k) ? "✓" : "–"}
                        </span>
                      </td>
                    ))}
                    <td className="num">{age}</td>
                    <td><span className="badge unpaid">ยังไม่ครบ</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {drafts.length === 0 && !loading && (
          <div className="rec-empty">ไม่มีใบที่กรอกค้างอยู่ 🎉</div>
        )}
        {loading && <div className="rec-empty">กำลังโหลด...</div>}
      </div>
    </>
  );
}
