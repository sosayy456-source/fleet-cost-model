/**
 * รายการใบทั้งหมด — โครงและคอลัมน์ตรงตาม v5:958-1020 และ renderRecords() v5:2264
 *
 * แสดงเฉพาะใบที่กรอกครบทั้ง 3 ฝ่าย (ใบร่างอยู่หน้า “ใบที่ยังไม่ครบ”) เหมือน v5
 * กดที่ป้ายสถานะ = กางแถวรายละเอียดลูกหนี้ของใบนั้น
 */
import { useMemo, useState } from "react";
import { billIsPaid, billPayDate, recBills, recStatus } from "../../lib/record/payment";
import { thDateSafe, todayISO } from "../../lib/record/date";
import { roleAllDone } from "../../lib/record/roles";
import { pushRecords } from "../../lib/sheet/client";
import { put, remove } from "../../lib/store/records";
import { ShortId } from "../../lib/custmap/ShortId";
import SheetSettings from "../settings/SheetSettings";
import { CASH_ORIGIN, ST_PAID, ST_PARTIAL } from "../../types/record";
import type { RecordsState } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const baht = (n: unknown) => (Number(n) || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });

const STATUS_CLASS: Record<string, string> = {
  [ST_PAID]: "paid", [ST_PARTIAL]: "partial",
};

type Src = "all" | "new" | "old";

/** locked = แถวอ่านอย่างเดียวจากชีตโดยตรง (ข้อมูลเก่า หรือข้อมูลใหม่ที่พิมพ์ตรงในชีตเอง) แก้ในแอปไม่ได้ */
interface Row { r: TripRecord; locked: boolean }

export default function RecordsList({ state }: { state: RecordsState }) {
  const { records, oldRecords, loading, sheetError, connected, reload } = state;
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<Src>("all");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // แถวจากชีต ("locked") ติดป้าย source เอง — อาจเป็น "เก่า" หรือ "ใหม่" (พิมพ์ตรงในชีต) ก็ได้
  const isOld = (r: TripRecord) => r.source === "เก่า";

  const list = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const editableDocNos = new Set<string>();
    for (const r of records) if (roleAllDone(r)) {
      out.push({ r, locked: false });
      if (r.docNo) editableDocNos.add(r.docNo);
    }
    for (const r of oldRecords as unknown as TripRecord[]) {
      // กันโชว์ซ้ำ: ใบที่เพิ่งบันทึกผ่านแอปมีทั้งฉบับแก้ไขได้ (records, ยึดอันนี้) กับฉบับที่
      // อ่านตรงจากชีต (ยังไม่มี _DATA ตอนเพิ่งบันทึกเสร็จใหม่ ๆ) — ใบเก่าจริงไม่กันชนแบบนี้
      if (!isOld(r) && r.docNo && editableDocNos.has(r.docNo)) continue;
      out.push({ r, locked: true });
    }
    const bySrc = src === "all" ? out : out.filter(({ r }) => isOld(r) === (src === "old"));
    bySrc.sort((a, b) => String(b.r.date ?? "").localeCompare(String(a.r.date ?? "")));
    const needle = q.trim().toLowerCase();
    if (!needle) return bySrc;
    return bySrc.filter(({ r }) => {
      const route = r.origin && r.dest ? `${r.origin}→${r.dest}` : "";
      return [r.docNo, route, r.branch, r.plate]
        .some((v) => String(v ?? "").toLowerCase().includes(needle));
    });
  }, [records, oldRecords, q, src]);

  const newCount = records.filter(roleAllDone).length
    + (oldRecords as unknown as TripRecord[]).filter((r) => !isOld(r)).length;
  const oldCount = (oldRecords as unknown as TripRecord[]).filter(isOld).length;

  const unsynced = records.filter((r) => r.synced === false && roleAllDone(r));

  async function syncAll() {
    if (!unsynced.length) { setMsg("ไม่มีใบที่ยังไม่ได้ซิงก์"); return; }
    setBusy(true);
    setMsg(`กำลังส่ง ${unsynced.length} ใบ...`);
    try {
      await pushRecords(unsynced);
      for (const r of unsynced) await put({ ...r, synced: true });
      setMsg(`ซิงก์ขึ้น Google Sheet แล้ว ${unsynced.length} ใบ`);
      reload();
    } catch (e) {
      setMsg("ส่งไม่สำเร็จ: " + (e as Error).message);
    } finally { setBusy(false); }
  }

  function edit(r: TripRecord) {
    sessionStorage.setItem("editRecordId", r.id);
    location.hash = "#/entry";
  }

  async function del(r: TripRecord) {
    if (!confirm("ลบรายการนี้? (ลบเฉพาะในเครื่อง — แถวใน Google Sheet ต้องลบเองในชีต)")) return;
    await remove(r.id);
    setMsg(`ลบใบ ${r.docNo || "–"} ออกจากเครื่องแล้ว`);
    reload();
  }

  async function setPaid(r: TripRecord, bi: number, paid: boolean) {
    const bills = recBills(r).map((b, j) =>
      j === bi ? { ...b, paid, payDate: paid ? todayISO() : null } : b);
    const next = { ...r, bills, synced: false };
    await put(next);
    reload();
    try { await pushRecords([next]); await put({ ...next, synced: true }); reload(); } catch { /* ออฟไลน์ก็ยังบันทึกในเครื่องแล้ว */ }
  }

  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  /** ล้างใบในเครื่องทั้งหมด — main:2692 ไม่แตะข้อมูลบน Google Sheet */
  async function clearAll() {
    if (!records.length) return;
    if (!confirm("ล้างรายการในเครื่องทั้งหมด? (ไม่ลบข้อมูลใน Google Sheet)")) return;
    setBusy(true);
    try {
      for (const r of records) await remove(r.id);
      setMsg("ล้างรายการในเครื่องแล้ว");
      reload();
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* main วางแผงตั้งค่าการเชื่อมชีตไว้หน้านี้ (index.html:1073) ไม่ใช่หน้าการตั้งค่า */}
      <SheetSettings />

      <div className="rec-bar">
        <div className="searchbox">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขที่ใบรายการ / เส้นทาง..." />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="srcfilter">
            {([["all", "ทั้งหมด"], ["new", "ข้อมูลใหม่"], ["old", "ข้อมูลเก่า"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={src === k ? "on" : ""} onClick={() => setSrc(k)}>{l}</button>
            ))}
          </div>
          <button className="btn-ghost" type="button" onClick={reload} disabled={loading}>↻ รีเฟรช</button>
          <button className="btn btn-green" type="button" onClick={syncAll} disabled={busy || !connected}>
            ⬆ ซิงก์ขึ้น Google Sheet{unsynced.length ? ` (${unsynced.length})` : ""}
          </button>
          <button className="btn-ghost" type="button" onClick={clearAll} disabled={busy}>ล้างทั้งหมด</button>
        </div>
      </div>

      {sheetError && (
        <div className="banner">โหลดจากชีตไม่สำเร็จ (ยังใช้ข้อมูลในเครื่องได้) · {sheetError}</div>
      )}
      <div className="rec-card">
        <div className="scroll">
          <table className="rec-table">
            <thead><tr>
              <th>แหล่งข้อมูล</th><th>เลขที่ใบรายการ</th><th>สาขา</th><th>ทะเบียนรถ</th>
              <th>วันที่</th><th>เส้นทาง</th><th>ประเภทรถ</th><th>ชนิดรถ</th>
              <th className="num">รายได้</th><th className="num">ต้นทุนรวม</th>
              <th className="num">สูญเปล่า</th><th className="num">กำไร/ขาดทุน</th>
              <th>สถานะ</th><th>แก้ไข</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 300).map(({ r, locked }, i) => {
                // main อ่านค่าที่บันทึกไว้ในใบตรง ๆ (normal / waste / profit) ไม่คำนวณใหม่
                // "ต้นทุนรวม" ในตารางนี้จึงเป็นต้นทุนปกติ ยังไม่รวมสูญเปล่า ซึ่งแยกอยู่คอลัมน์ถัดไป
                const cost = Number(r.normal) || 0;
                const waste = Number(r.waste) || 0;
                const profit = Number(r.profit) || 0;
                const route = r.origin && r.dest ? `${r.origin}→${r.dest}` : "–";
                const st = recStatus(r);
                const old = isOld(r);
                return (
                  <>
                    <tr key={`${r.id}-${i}`} className={locked ? "oldrow" : undefined}>
                      <td>
                        <span className={"badge " + (old ? "src-old" : "src-new")}>
                          {old ? "ข้อมูลเก่า" : "ข้อมูลใหม่"}
                        </span>
                      </td>
                      <td className="doc">
                        {!locked && <span className={"sdot" + (r.synced ? " on" : "")}
                          title={r.synced ? "ซิงก์ขึ้น Google Sheet แล้ว" : "ยังไม่ได้ซิงก์"} />}
                        {r.docNo || "–"}
                      </td>
                      <td>{r.branch || "–"}</td>
                      <td>{r.plate || "–"}</td>
                      <td>{thDateSafe(r.date)}</td>
                      <td>
                        {route}
                        {r.routeType && <span style={{ color: "var(--ink-faint)", fontSize: 11 }}> ({r.routeType})</span>}
                      </td>
                      <td>
                        {r.fleetType
                          ? <span className={"badge " + (r.fleetType === "รถบริษัท" ? "b1" : "b2")}>{r.fleetType}</span>
                          : "–"}
                      </td>
                      <td>{r.vehicle || "–"}</td>
                      <td className="num">{baht(r.revenue)}</td>
                      <td className="num">{baht(cost)}</td>
                      <td className="num">{baht(waste)}</td>
                      <td className={"num " + (profit >= 0 ? "profit-pos" : "profit-neg")}>{baht(profit)}</td>
                      <td>
                        {locked
                          ? <span className="locknote">–</span>
                          : <span className={"badge clk " + (STATUS_CLASS[st] ?? "unpaid")}
                              title="กดเพื่อดูรายละเอียดลูกหนี้"
                              onClick={() => toggle(r.id)}>{st}</span>}
                      </td>
                      <td>
                        {locked ? <span className="locknote">แก้ในชีต</span> : (
                          <span className="act">
                            <button className="btn-edit" type="button" title="แก้ไข" onClick={() => edit(r)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button className="btn-del" type="button" title="ลบ" onClick={() => del(r)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                    {!locked && open.has(r.id) && (
                      <tr className="detail-row" key={`${r.id}-d`}>
                        <td colSpan={14}><DetailBills r={r} onPay={setPaid} /></td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <div className="rec-empty">
            {records.length + oldRecords.length === 0
              ? "ยังไม่มีรายการ — ไปที่ “บันทึกข้อมูล” เพื่อเพิ่มรายการ (ข้อมูลเก่ากด “รีเฟรช”)"
              : "ไม่พบรายการที่ตรงกับเงื่อนไข"}
          </div>
        )}
      </div>

      <div className="locknote" style={{ marginTop: 8 }}>
        แสดง {Math.min(list.length, 300)} รายการ · ใหม่ {newCount} · เก่า {oldCount}
        {list.length > 300 && " · จำกัด 300 แถวแรก ใช้ช่องค้นหาเพื่อกรองให้แคบลง"}
      </div>
      {msg && <div className="msg" style={{ color: "var(--green)", marginTop: 6 }}>{msg}</div>}
    </>
  );
}

/** แถวรายละเอียดลูกหนี้ของใบ — ตรงตาม buildDetailRow() v5:2497 */
function DetailBills({ r, onPay }: {
  r: TripRecord;
  onPay: (r: TripRecord, bi: number, paid: boolean) => void;
}) {
  const bs = recBills(r);
  if (!bs.length) {
    return (
      <>
        <div className="detail-title">รายละเอียดลูกหนี้ (ใบ {r.docNo || "–"})</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          ยังไม่มีข้อมูลลูกหนี้ — กด “แก้ไข” เพื่อเพิ่มรายการลูกหนี้
        </div>
      </>
    );
  }
  return (
    <>
      <div className="detail-title">รายละเอียดลูกหนี้ (ใบ {r.docNo || "–"})</div>
      <div className="scroll">
        <table className="subtable">
          <thead><tr>
            <th>เลขที่บิล</th><th>ผู้ส่ง</th><th>ผู้รับ</th><th>ต้นทาง</th><th>ปลายทาง</th>
            <th className="num">จำนวน</th><th className="num">ราคารวม</th>
            <th>ประเภทการชำระ</th><th>สถานะ / บันทึกการจ่าย</th>
          </tr></thead>
          <tbody>
            {bs.map((b, bi) => {
              const auto = b.payType === CASH_ORIGIN;
              return (
                <tr key={bi}>
                  <td style={{ fontWeight: 700 }}>{b.no || "–"}</td>
                  <td><ShortId v={b.sender} /></td>
                  <td><ShortId v={b.receiver} /></td>
                  <td>{b.origin || r.origin || "–"}</td>
                  <td>{b.dest || r.dest || "–"}</td>
                  <td className="num">{b.qty ? baht(b.qty) : "–"}</td>
                  <td className="num">{b.total ? baht(b.total) : "–"}</td>
                  <td>{b.payType || "–"}</td>
                  <td>
                    {billIsPaid(b) ? (
                      <>
                        <span className="chip-ok">จ่ายแล้ว {thDateSafe(billPayDate(b, r))}</span>
                        {auto
                          ? <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 6 }}>อัตโนมัติ (สดต้นทาง)</span>
                          : <button className="btn-undo" type="button" onClick={() => onPay(r, bi, false)}>ยกเลิก</button>}
                      </>
                    ) : (
                      <button className="btn-mini" type="button" onClick={() => onPay(r, bi, true)}>บันทึกจ่าย</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
