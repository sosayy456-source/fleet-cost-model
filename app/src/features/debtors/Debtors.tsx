/**
 * รายการลูกหนี้รายบิล — ตรงตาม v5:1021-1074
 * 1 แถว = 1 บิล (ไม่ใช่ 1 ใบรายการ) รวมบิลจากใบใหม่กับแท็บข้อมูลเก่าเข้าด้วยกัน
 *
 * ปุ่ม “ชำระ” เปิดหน้าต่างให้เลือกวันที่ชำระ เหมือน openPayModal() v5:2673
 * และตรวจว่าวันที่ชำระต้องไม่ก่อนวันที่บิล
 */
import { useEffect, useMemo, useState } from "react";
import { billIsPaid, billPayDate, recBills, recPayInfo } from "../../lib/record/payment";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import { put } from "../../lib/store/records";
import { pushRecords, getUrl } from "../../lib/sheet/client";
import { ShortId } from "../../lib/custmap/ShortId";
import ThaiDateInput from "../entry/ThaiDateInput";
import type { RecordsState, OldDebtor } from "../../lib/store/useRecords";
import type { TripRecord } from "../../types/record";

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

interface Row {
  key: string;
  src: "ใหม่" | "เก่า";
  date: string;
  docNo: string;
  no: string;
  goodsType: string;
  origin: string;
  dest: string;
  sender: string;
  receiver: string;
  payType: string;
  paid: boolean;
  payDate: string | null;
  qty: number;
  total: number;
  aging: number | null;
  /** มีเฉพาะบิลของใบใหม่ ใช้กดบันทึกการชำระ */
  recId?: string;
  billIndex?: number;
}

function buildRows(records: TripRecord[], oldDebtors: OldDebtor[]): Row[] {
  const today = todayISO();
  const out: Row[] = [];

  for (const r of records) {
    recBills(r).forEach((b, i) => {
      const paid = billIsPaid(b);
      const pd = billPayDate(b, r);
      out.push({
        key: `${r.id}#${i}`, src: "ใหม่", date: r.date, docNo: r.docNo,
        no: b.no, goodsType: b.goodsType,
        origin: b.origin || r.origin, dest: b.dest || r.dest,
        sender: b.sender, receiver: b.receiver, payType: b.payType || "",
        paid, payDate: pd, qty: Number(b.qty) || 0, total: Number(b.total) || 0,
        aging: paid ? null : daysBetween(r.date, today),
        recId: r.id, billIndex: i,
      });
    });
  }

  oldDebtors.forEach((d, i) => {
    const paid = d.paid === true || d.status === "ชำระแล้ว";
    out.push({
      key: `old-${i}`, src: "เก่า", date: String(d.date ?? ""), docNo: String(d.docNo ?? ""),
      no: String(d.no ?? ""), goodsType: String(d.goodsType ?? ""),
      origin: String(d.origin ?? ""), dest: String(d.dest ?? ""),
      sender: String(d.sender ?? ""), receiver: String(d.receiver ?? ""),
      payType: String(d.payType ?? ""), paid, payDate: null,
      qty: Number(d.qty) || 0, total: Number(d.total) || 0,
      aging: paid ? null : (Number(d.agingDays) || daysBetween(String(d.date ?? ""), today)),
    });
  });

  return out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export default function Debtors({ state }: { state: RecordsState }) {
  const { records, oldDebtors, loading, reload } = state;
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<"all" | "new" | "old">("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [target, setTarget] = useState<Row | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [modalMsg, setModalMsg] = useState("");

  const rows = useMemo(() => {
    const everything = buildRows(records, oldDebtors);
    const all = src === "all" ? everything
      : everything.filter((r) => (src === "old" ? r.src === "เก่า" : r.src === "ใหม่"));
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      [r.no, r.docNo, r.sender, r.receiver, r.origin, r.dest, r.goodsType]
        .some((v) => String(v ?? "").toLowerCase().includes(needle)));
  }, [records, oldDebtors, q, src]);

  const outstanding = rows.filter((r) => !r.paid);
  const paidRows = rows.filter((r) => r.paid);

  const openPay = (row: Row) => {
    setTarget(row); setPayDate(todayISO()); setModalMsg("");
  };

  /* มาจากปุ่ม "บันทึกจ่าย" ในแท็บลูกหนี้ของแดชบอร์ด — เปิดหน้าต่างให้ทันทีที่เข้าหน้านี้ */
  useEffect(() => {
    const key = sessionStorage.getItem("payBillKey");
    if (!key) return;
    sessionStorage.removeItem("payBillKey");
    const row = rows.find((r) => r.key === key);
    if (row && !row.paid) openPay(row);
  }, [rows]);

  async function confirmPay() {
    if (!target?.recId || target.billIndex == null) return;
    if (!payDate) { setModalMsg("กรุณากรอกวันที่ชำระให้ครบ"); return; }
    const days = daysBetween(target.date, payDate);
    if (days != null && days < 0) { setModalMsg("วันที่ชำระต้องไม่ก่อนวันที่บิล"); return; }

    setBusy(true);
    try {
      const rec = records.find((r) => r.id === target.recId);
      if (!rec) throw new Error("ไม่พบใบรายการนี้");
      const bills = rec.bills.map((b, i) =>
        i === target.billIndex ? { ...b, paid: true, payDate } : b);
      const updated: TripRecord = { ...rec, bills, synced: false };
      await put(updated);
      if (getUrl()) {
        try { await pushRecords([updated]); await put({ ...updated, synced: true }); }
        catch { /* ออฟไลน์ก็ยังบันทึกในเครื่องแล้ว รอซิงก์ทีหลัง */ }
      }
      const p = recPayInfo(updated);
      setMsg(`บันทึกการชำระบิล ${target.no || "–"} แล้ว ✓`
        + (days != null ? ` (ใช้เวลา ${days} วัน)` : "")
        + ` · สถานะใบ ${updated.docNo || "–"}: ${p.status} (${p.paidCount}/${p.count})`);
      setTarget(null);
      reload();
    } catch (e) {
      setModalMsg("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally { setBusy(false); }
  }

  const table = (list: Row[], pending: boolean) => (
    <div className="rec-card" style={pending ? { marginBottom: 18 } : undefined}>
      <div style={{ padding: "14px 16px 6px", fontWeight: 700, fontSize: 15 }}>
        {pending ? "🔴 ค้างชำระ" : "🟢 ประวัติการชำระ"} ({list.length})
      </div>
      <div className="scroll">
        <table className="rec-table">
          <thead><tr>
            <th>แหล่งข้อมูล</th><th>วันที่</th><th>เลขที่ใบรายการ</th><th>เลขที่บิล</th><th>ประเภทสินค้า</th>
            <th>ต้นทาง</th><th>ปลายทาง</th><th>ผู้ส่ง</th><th>ผู้รับ</th><th>ประเภทการชำระเงิน</th>
            <th>สถานะการชำระเงิน</th><th className="num">จำนวน</th><th className="num">ราคารวม</th>
            <th className={pending ? "num" : undefined}>{pending ? "จำนวนวันค้างชำระ" : "วันที่ชำระ"}</th>
            <th className={pending ? undefined : "num"}>{pending ? "ชำระ" : "ใช้เวลา (วัน)"}</th>
          </tr></thead>
          <tbody>
            {list.slice(0, 300).map((r) => (
              <tr key={r.key} className={r.src === "เก่า" ? "oldrow" : undefined}>
                <td><span className={"badge " + (r.src === "เก่า" ? "src-old" : "src-new")}>
                  {r.src === "เก่า" ? "ข้อมูลเก่า" : "ข้อมูลใหม่"}</span></td>
                <td>{thDateSafe(r.date)}</td>
                <td className="doc">{r.docNo || "–"}</td>
                <td style={{ fontWeight: 600 }}>{r.no || "–"}</td>
                <td>{r.goodsType || "–"}</td>
                <td>{r.origin || "–"}</td>
                <td>{r.dest || "–"}</td>
                <td><ShortId v={r.sender} /></td>
                <td><ShortId v={r.receiver} /></td>
                <td>{r.payType || "–"}</td>
                <td>
                  <span className={"badge " + (r.paid ? "paid" : "unpaid")}>
                    {r.paid ? "ชำระแล้ว" : "ยังไม่ได้ชำระ"}
                  </span>
                </td>
                <td className="num">{baht(r.qty)}</td>
                <td className="num">{baht(r.total)}</td>
                {pending ? (
                  <>
                    <td className="num" style={r.aging != null && r.aging > 30
                      ? { color: "var(--red)", fontWeight: 700 } : undefined}>
                      {r.aging != null ? r.aging : "–"}
                    </td>
                    <td>
                      {r.recId
                        ? <button className="btn-pay" type="button" onClick={() => openPay(r)}>ชำระ</button>
                        : <span className="locknote">แก้ในชีต</span>}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{thDateSafe(r.payDate)}</td>
                    <td className="num" style={{ fontWeight: 700, color: "var(--blue)" }}>
                      {r.payDate ? (daysBetween(r.date, r.payDate) ?? "–") : "–"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="rec-empty">{pending ? "ไม่มีบิลค้างชำระ 🎉" : "ยังไม่มีบิลที่ชำระแล้ว"}</div>
      )}
    </div>
  );

  return (
    <>
      <div className="rec-bar">
        <div className="searchbox">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา ผู้ส่ง / ผู้รับ / เลขที่บิล / ใบรายการ / ต้นทาง / ปลายทาง" />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="srcfilter">
            {([["all", "ทั้งหมด"], ["new", "ข้อมูลใหม่"], ["old", "ข้อมูลเก่า"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={src === k ? "on" : ""} onClick={() => setSrc(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-green" type="button" onClick={reload} disabled={loading}>
            ↻ อัปเดตข้อมูลลูกหนี้เก่า
          </button>
        </div>
      </div>

      {msg && <div className="msg" style={{ color: "var(--green)", marginBottom: 10 }}>{msg}</div>}
      {loading && <p className="muted">กำลังโหลด...</p>}

      {table(outstanding, true)}
      {table(paidRows, false)}

      <div className="locknote" style={{ marginTop: 8 }}>
        ค้างชำระ {outstanding.length} · ชำระแล้ว {paidRows.length} · ลูกหนี้เก่าจากชีต {oldDebtors.length} ราย
        {q ? ` · กรองด้วยคำค้น “${q}”` : ""}
      </div>

      {target && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setTarget(null); }}>
          <div className="modal">
            <div className="modal-h">บันทึกการชำระ</div>
            <div className="modal-info">
              เลขที่ใบรายการ <b>{target.docNo || "–"}</b> · วันที่บิล {thDateSafe(target.date)}<br />
              บิล <b>{target.no || "–"}</b> · <ShortId v={target.sender} /> → <ShortId v={target.receiver} />
              {" "}· ยอด <b>{baht(target.total)}</b> บาท
              {target.payType && ` · ${target.payType}`}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>วันที่ชำระ · วัน / เดือน / ปี (พ.ศ.)</label>
              <ThaiDateInput value={payDate} onChange={setPayDate} />
            </div>
            {modalMsg && <div className="msg" style={{ color: "var(--red)" }}>{modalMsg}</div>}
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={() => setTarget(null)}>ยกเลิก</button>
              <button className="btn btn-green" type="button" onClick={confirmPay} disabled={busy}>
                ยืนยันการชำระ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
