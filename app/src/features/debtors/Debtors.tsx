/**
 * รายการลูกหนี้รายบิล — แทน view-debtors ของ v5
 * 1 แถว = 1 บิล (ไม่ใช่ 1 ใบรายการ) รวมบิลจากใบใหม่กับแท็บข้อมูลเก่าเข้าด้วยกัน
 */
import { useMemo, useState } from "react";
import { billIsPaid, billPayDate, recBills } from "../../lib/record/payment";
import { daysBetween, thDateSafe, todayISO } from "../../lib/record/date";
import { put } from "../../lib/store/records";
import { pushRecords, getUrl } from "../../lib/sheet/client";
import { CASH_ORIGIN } from "../../types/record";
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

/** ย่อรหัสลูกค้าที่เป็น hash ยาว 64 ตัวให้พออ่านได้ (เทียบเท่า shortId ใน v5:2549) */
const shortId = (s: string): string =>
  /^[0-9a-f]{40,}$/i.test(s) ? s.slice(0, 10) + "…" : s;

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
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = buildRows(records, oldDebtors);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      [r.no, r.docNo, r.sender, r.receiver, r.origin, r.dest, r.goodsType]
        .some((v) => String(v ?? "").toLowerCase().includes(needle)));
  }, [records, oldDebtors, q]);

  const outstanding = rows.filter((r) => !r.paid);
  const paidRows = rows.filter((r) => r.paid);
  const owed = outstanding.reduce((s, r) => s + r.total, 0);

  async function markPaid(row: Row) {
    if (!row.recId || row.billIndex == null) return;
    setBusy(row.key);
    setMsg(null);
    try {
      const rec = records.find((r) => r.id === row.recId);
      if (!rec) throw new Error("ไม่พบใบรายการนี้");
      const bills = rec.bills.map((b, i) =>
        i === row.billIndex ? { ...b, paid: true, payDate: todayISO() } : b);
      const updated: TripRecord = { ...rec, bills, synced: false };
      await put(updated);
      if (getUrl()) {
        await pushRecords([updated]);
        await put({ ...updated, synced: true });
      }
      setMsg(`บันทึกการชำระบิล ${row.no || row.key} แล้ว`);
      reload();
    } catch (e) {
      setMsg("บันทึกไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const table = (list: Row[], showPayButton: boolean) => (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>แหล่ง</th><th>วันที่</th><th>เลขที่บิล</th><th>ประเภทสินค้า</th>
            <th>เส้นทาง</th><th>ผู้ส่ง</th><th>ผู้รับ</th><th>การชำระ</th>
            <th className="n">จำนวน</th><th className="n">ราคารวม</th>
            <th className="n">{showPayButton ? "ค้างมา" : "วันที่ชำระ"}</th>
            {showPayButton && <th />}
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 300).map((r) => (
            <tr key={r.key}>
              <td><span className="muted">{r.src}</span></td>
              <td>{thDateSafe(r.date)}</td>
              <td>{r.no || "–"}</td>
              <td>{r.goodsType || "–"}</td>
              <td>{r.origin && r.dest ? `${r.origin} → ${r.dest}` : "–"}</td>
              <td>{shortId(r.sender)}</td>
              <td>{shortId(r.receiver)}</td>
              <td>{r.payType || "–"}</td>
              <td className="n">{baht(r.qty)}</td>
              <td className="n">{baht(r.total)}</td>
              <td className="n" style={showPayButton && r.aging != null && r.aging > 30
                ? { color: "var(--red)" } : undefined}>
                {showPayButton ? (r.aging != null ? `${r.aging} วัน` : "–") : thDateSafe(r.payDate)}
              </td>
              {showPayButton && (
                <td>
                  {r.recId ? (
                    <button type="button" onClick={() => markPaid(r)} disabled={busy === r.key}>
                      ชำระ
                    </button>
                  ) : <span className="muted">แก้ในชีต</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="card">
        <h2>ลูกหนี้คงค้าง <span className="muted">· {outstanding.length} บิล</span></h2>
        <div className="grid" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="label">ยอดค้างรวม</div>
            <div className="value" style={{ color: "var(--red)" }}>{baht(owed)}</div>
          </div>
          <div className="stat">
            <div className="label">บิลค้าง</div><div className="value">{outstanding.length}</div>
          </div>
          <div className="stat">
            <div className="label">บิลที่ชำระแล้ว</div><div className="value">{paidRows.length}</div>
          </div>
        </div>

        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นเลขที่บิล / ผู้ส่ง / ผู้รับ / เส้นทาง"
          style={{ width: "100%", marginBottom: 12 }}
        />
        {msg && <p className="muted">{msg}</p>}
        {loading && <p className="muted">กำลังโหลด...</p>}

        <p className="muted" style={{ fontSize: 12 }}>
          บิลประเภท "{CASH_ORIGIN}" ถือว่าชำระแล้วตั้งแต่เปิดบิล จึงไม่อยู่ในรายการค้าง
        </p>
        {table(outstanding, true)}
      </div>

      <div className="card">
        <h2>ชำระแล้ว <span className="muted">· {paidRows.length} บิล</span></h2>
        {table(paidRows, false)}
      </div>
    </>
  );
}
