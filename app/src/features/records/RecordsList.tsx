/** รายการใบทั้งหมด — แทน view-records ของ v5 */
import { useMemo, useState } from "react";
import { recCost, recProfit } from "../../lib/cost/recCost";
import { recPayInfo } from "../../lib/record/payment";
import { thDateSafe } from "../../lib/record/date";
import { pushRecords } from "../../lib/sheet/client";
import { put } from "../../lib/store/records";
import { ST_PAID, ST_PARTIAL } from "../../types/record";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

type SourceFilter = "all" | "new" | "old";

export default function RecordsList({ state }: { state: RecordsState }) {
  const { records, oldRecords, loading, sheetError, connected, reload } = state;
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<SourceFilter>("all");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const news = records.map((r) => ({ ...r, _src: "ใหม่" as const }));
    const olds = (oldRecords as unknown as TripRecord[]).map((r) => ({ ...r, _src: "เก่า" as const }));
    const all = src === "new" ? news : src === "old" ? olds : [...news, ...olds];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      [r.docNo, r.branch, r.plate, r.origin, r.dest, r.vehicle]
        .some((v) => String(v ?? "").toLowerCase().includes(needle)),
    );
  }, [records, oldRecords, q, src]);

  const unsynced = records.filter((r) => r.synced === false);

  async function syncAll() {
    setBusy(true);
    setSyncMsg(`กำลังส่ง ${unsynced.length} ใบ...`);
    try {
      await pushRecords(unsynced);
      for (const r of unsynced) await put({ ...r, synced: true });
      setSyncMsg(`ส่งขึ้นชีตแล้ว ${unsynced.length} ใบ`);
      reload();
    } catch (e) {
      setSyncMsg("ส่งไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totals = rows.reduce(
    (a, r) => {
      const c = recCost(r);
      a.revenue += Number(r.revenue) || 0;
      a.cost += c.total;
      a.waste += c.waste;
      a.profit += recProfit(r);
      return a;
    },
    { revenue: 0, cost: 0, waste: 0, profit: 0 },
  );

  return (
    <div className="card">
      <h2>รายการทั้งหมด <span className="muted">· {rows.length} ใบ</span></h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นเลขที่ใบ / สาขา / ทะเบียน / เส้นทาง"
          style={{ flex: "1 1 260px", minWidth: 0 }}
        />
        <select value={src} onChange={(e) => setSrc(e.target.value as SourceFilter)}>
          <option value="all">ทุกแหล่ง</option>
          <option value="new">ข้อมูลใหม่</option>
          <option value="old">ข้อมูลเก่า</option>
        </select>
        <button type="button" onClick={reload} disabled={loading}>โหลดใหม่</button>
        {unsynced.length > 0 && connected && (
          <button type="button" onClick={syncAll} disabled={busy}>
            ส่งขึ้นชีต ({unsynced.length})
          </button>
        )}
      </div>

      {syncMsg && <p className="muted">{syncMsg}</p>}
      {loading && <p className="muted">กำลังโหลด...</p>}
      {sheetError && (
        <p style={{ color: "var(--red)" }}>
          โหลดจากชีตไม่สำเร็จ (ยังใช้ข้อมูลในเครื่องได้) · {sheetError}
        </p>
      )}
      {!connected && !loading && (
        <p className="muted">ยังไม่ได้เชื่อม Google Sheet — แสดงเฉพาะใบที่กรอกในเครื่องนี้</p>
      )}

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>แหล่ง</th><th>เลขที่ใบ</th><th>วันที่</th><th>สาขา</th>
              <th>เส้นทาง</th><th>ทะเบียน</th>
              <th className="n">รายได้</th><th className="n">ต้นทุน</th>
              <th className="n">สูญเปล่า</th><th className="n">กำไร</th><th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((r, i) => {
              const c = recCost(r);
              const profit = recProfit(r);
              const pay = recPayInfo(r);
              return (
                <tr key={`${r.id}-${i}`}>
                  <td><span className="muted">{r._src}</span></td>
                  <td>{r.docNo || "–"}{r.synced === false && <span className="muted"> ●</span>}</td>
                  <td>{thDateSafe(r.date)}</td>
                  <td>{r.branch || "–"}</td>
                  <td>{r.origin && r.dest ? `${r.origin} → ${r.dest}` : "–"}</td>
                  <td>{r.plate || "–"}</td>
                  <td className="n">{baht(Number(r.revenue) || 0)}</td>
                  <td className="n">{baht(c.total)}</td>
                  <td className="n" style={c.waste ? { color: "var(--red)" } : undefined}>
                    {baht(c.waste)}
                  </td>
                  <td className="n" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>
                    {baht(profit)}
                  </td>
                  <td>
                    <span className={"chip " + (
                      pay.status === ST_PAID ? "chip-done"
                        : pay.status === ST_PARTIAL ? "chip-warn" : ""
                    )}>{pay.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}><b>รวม {rows.length} ใบ</b></td>
              <td className="n"><b>{baht(totals.revenue)}</b></td>
              <td className="n"><b>{baht(totals.cost)}</b></td>
              <td className="n"><b>{baht(totals.waste)}</b></td>
              <td className="n" style={{ color: totals.profit >= 0 ? "var(--green)" : "var(--red)" }}>
                <b>{baht(totals.profit)}</b>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {rows.length > 300 && (
        <p className="muted">แสดง 300 แถวแรกจาก {rows.length} — ใช้ช่องค้นหาเพื่อกรองให้แคบลง</p>
      )}
      {rows.length === 0 && !loading && (
        <p className="muted">ยังไม่มีใบรายการ — ไปที่หน้า "กรอกข้อมูล" เพื่อเริ่มใบแรก</p>
      )}
    </div>
  );
}
