/**
 * แท็บ "บิลที่ยังไม่ได้จัดรถ" ของฝ่ายบริการลูกค้า — สเปก 22 ก.ย. 2569
 * เห็นเฉพาะบิลสถานะ "รอจัดรถ" และยกเลิกได้ (บิลที่จัดรถแล้วยกเลิกไม่ได้ ต้องไปแก้ที่ใบรายการ)
 *
 * ยกเลิก = เปลี่ยนสถานะเป็น "ยกเลิก" ไม่ลบทิ้ง เพื่อให้เลขที่บิลไม่ถูกนำกลับมาใช้ซ้ำ
 * และยังตรวจย้อนหลังได้ว่าใครกรอกอะไรไว้
 */
import { useMemo, useState } from "react";
import type { BillsState } from "../../lib/store/bills";
import type { PendingBill } from "../../types/bill";
import { thDateSafe } from "../../lib/record/date";
import GrowBox from "../../lib/ui/GrowBox";

const baht = (v: number): string => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function PendingBillList({ state }: { state: BillsState }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.bills
      .filter((b) => b.status === "รอจัดรถ")
      .filter((b) => !needle
        || `${b.no} ${b.sender} ${b.receiver} ${b.origin} ${b.dest} ${b.serviceGroup}`.toLowerCase().includes(needle));
  }, [state.bills, q]);

  async function cancel(b: PendingBill) {
    if (!confirm(`ยกเลิกบิล ${b.no}?\n${b.origin}–${b.dest} · ${baht(b.total)} บาท`)) return;
    setBusy(b.id);
    try {
      await state.save([{ ...b, status: "ยกเลิก" }]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card-h">
        <span className="step">2</span><h2>บิลที่ยังไม่ได้จัดรถ</h2>
        <span className="hint">{rows.length} บิล · รอฝ่ายจัดรถรวมเข้าเที่ยว</span>
      </div>

      <input className="bill-search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาเลขที่บิล ลูกค้า หรือเส้นทาง" />

      {state.loading && <p className="muted">กำลังโหลดบิล…</p>}

      {rows.length === 0 && !state.loading ? (
        <p className="muted">ไม่มีบิลที่รอจัดรถ</p>
      ) : (
        <GrowBox rows={rows} render={(shown) => (
          <table className="tbl">
            <thead><tr>
              <th>เลขที่บิล</th><th>วันที่</th><th>สาขา</th><th>ผู้ส่ง → ผู้รับ</th><th>เส้นทาง</th>
              <th>กลุ่มบริการ</th><th className="n">จำนวน</th><th className="n">น้ำหนัก</th>
              <th className="n">ปริมาตร</th><th className="n">ราคารวม</th><th />
            </tr></thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.no}</b>{b.synced === false && <span className="tagnew"> ยังไม่ขึ้นชีต</span>}</td>
                  <td>{thDateSafe(b.date)}</td>
                  <td>{b.branch}</td>
                  <td>{b.sender} → {b.receiver}</td>
                  <td>{b.origin}–{b.dest}</td>
                  <td>{b.serviceGroup}</td>
                  <td className="n">{baht(b.qty)}</td>
                  <td className="n">{baht(b.weight)}</td>
                  <td className="n">{b.volume.toFixed(3)}</td>
                  <td className="n">{baht(b.total)}</td>
                  <td>
                    <button type="button" className="bill-x" title="ยกเลิกบิลนี้"
                      disabled={busy === b.id} onClick={() => cancel(b)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )} />
      )}

      <div className="price-note" style={{ marginTop: 12 }}>
        ยกเลิกแล้วบิลจะไม่หายไปจากชีต แต่เปลี่ยนสถานะเป็น "ยกเลิก" — เลขที่บิลเดิมจะไม่ถูกนำกลับมาใช้ซ้ำ ·
        บิลที่ฝ่ายจัดรถจัดเข้าเที่ยวแล้วจะหายจากรายการนี้และยกเลิกที่นี่ไม่ได้
      </div>
    </div>
  );
}
