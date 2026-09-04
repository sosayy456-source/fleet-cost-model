/** ใบที่ยังกรอกไม่ครบทั้ง 3 ฝ่าย — แทน view-drafts ของ v5 */
import { useMemo, useState } from "react";
import { ROLES, ROLE_ORDER, roleAllDone, roleDone } from "../../lib/record/roles";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import type { RecordsState } from "../../lib/store/useRecords";

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

  return (
    <div className="card">
      <h2>ใบที่ยังไม่ครบ <span className="muted">· {drafts.length} ใบ</span></h2>
      <p className="muted" style={{ marginTop: 0 }}>
        ใบจะสมบูรณ์เมื่อครบทั้ง 3 ฝ่าย — ช่องว่างข้างล่างบอกว่ายังรอฝ่ายไหนอยู่
      </p>

      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นเลขที่ใบ / สาขา / เส้นทาง"
        style={{ width: "100%", marginBottom: 12 }}
      />

      {loading && <p className="muted">กำลังโหลด...</p>}

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>เลขที่ใบ</th><th>วันที่</th><th>สาขา</th><th>เส้นทาง</th>
              <th className="n">ค้างมา</th><th>รอฝ่าย</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((r) => {
              const waiting = ROLE_ORDER.filter((k) => !roleDone(r, k));
              const age = daysBetween(r.date, todayISO());
              return (
                <tr key={r.id}>
                  <td>{r.docNo || "(ยังไม่ใส่เลข)"}</td>
                  <td>{thDateSafe(r.date)}</td>
                  <td>{r.branch || "–"}</td>
                  <td>{r.origin && r.dest ? `${r.origin} → ${r.dest}` : "–"}</td>
                  <td className="n" style={age != null && age > 7 ? { color: "var(--red)" } : undefined}>
                    {age != null ? `${age} วัน` : "–"}
                  </td>
                  <td>
                    {ROLE_ORDER.map((k) => (
                      <span key={k} className={"chip" + (roleDone(r, k) ? " chip-done" : "")}
                            style={{ marginRight: 4 }}>
                        {ROLES[k].icon}
                      </span>
                    ))}
                    <span className="muted" style={{ marginLeft: 6 }}>
                      {waiting.map((k) => ROLES[k].label).join(", ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drafts.length === 0 && !loading && (
        <p className="muted">ไม่มีใบค้าง — ทุกใบกรอกครบทั้ง 3 ฝ่ายแล้ว</p>
      )}
    </div>
  );
}
