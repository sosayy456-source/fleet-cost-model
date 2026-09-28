/**
 * บิลที่รับวันนี้ — กล่องข้างกล่อง "ต้องจัดการ" ของ Manager Dashboard (เจ้าของงานขอ 28 ก.ย. 2569)
 *
 *   บิล = บิลที่ฝ่ายบริการลูกค้าบันทึกในโมเดล (lib/store/bills.ts · ชีต "บิลรอจัดรถ") ที่ createdAt เป็นวันนี้ (todayISO)
 *   ไม่นับบิลที่ยกเลิก · ตามสาขาของหน้า (ทุกสาขา = ทุกบิล) · "วันนี้" ไม่ขึ้นกับช่วงเวลาที่เลือกในตัวกรอง
 *   กล่อง: จำนวนบิล · รอจัดรถ / จัดรถแล้ว · น้ำหนัก · ปริมาตร · รายได้ · ปุ่มเปิดป็อบอัพรายการบิล
 *
 * ★ ป็อบอัพ portal ไป #view-dash เหตุผลเดียวกับ TripsModal — โทเคนสีของแดชบอร์ดอยู่ใต้ #view-dash เท่านั้น
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SortTable, fmt, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { ShortId } from "../../lib/custmap/ShortId";
import { thDateSafe, todayISO } from "../../lib/record/date";
import type { PendingBill } from "../../types/bill";

/** บิลที่บันทึกวันนี้ (ไม่รวมที่ยกเลิก) ของสาขาที่ผ่าน inBranch */
export function todayBills(bills: PendingBill[], inBranch: (br: string) => boolean, today = todayISO()): PendingBill[] {
  return bills.filter((b) => b.status !== "ยกเลิก" && String(b.createdAt ?? "").startsWith(today) && inBranch(b.branch));
}

export default function TodayBills({ bills, loading, error }: { bills: PendingBill[]; loading: boolean; error: string | null }) {
  const [open, setOpen] = useState(false);
  const s = useMemo(() => bills.reduce((a, b) => ({
    n: a.n + 1, wait: a.wait + (b.status === "รอจัดรถ" ? 1 : 0), done: a.done + (b.status === "จัดรถแล้ว" ? 1 : 0),
    kg: a.kg + (Number(b.weight) || 0), cbm: a.cbm + (Number(b.volume) || 0), rev: a.rev + (Number(b.total) || 0),
  }), { n: 0, wait: 0, done: 0, kg: 0, cbm: 0, rev: 0 }), [bills]);

  return (
    <div className="dz-cc mo-today">
      <h4>บิลที่รับวันนี้ ({thDateSafe(todayISO())})</h4>
      {loading && !bills.length ? <p className="dz-note">กำลังโหลดบิล…</p>
        : error && !bills.length ? <p className="dz-note">โหลดบิลไม่ได้: {error}</p>
        : !s.n ? <p className="mg-todo-ok">ยังไม่มีบิลที่บันทึกวันนี้</p>
        : <>
          <div className="mo-today-n"><b>{fmt(s.n)}</b> บิล</div>
          <div className="mo-cost mo-today-kv">
            <div>รอจัดรถ<b className={s.wait ? "warn" : ""}>{fmt(s.wait)} บิล</b></div>
            <div>จัดรถแล้ว<b>{fmt(s.done)} บิล</b></div>
            <div>น้ำหนักรวม<b>{fmt(Math.round(s.kg))} กก.</b></div>
            <div>ปริมาตรรวม<b>{fmt(s.cbm, 2)} ลบ.ม.</b></div>
            <div>รายได้รวม<b>{fmt(Math.round(s.rev))} บาท</b></div>
          </div>
          <button type="button" className="btn-ghost mo-today-btn" onClick={() => setOpen(true)}>ดูรายการบิล →</button>
        </>}
      {open && <TodayBillsModal bills={bills} onClose={() => setOpen(false)} />}
    </div>
  );
}

function TodayBillsModal({ bills, onClose }: { bills: PendingBill[]; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  const cols = useMemo<Col<PendingBill>[]>(() => [
    { key: "no", label: "เลขที่บิล", get: (b) => b.no },
    { key: "time", label: "เวลาบันทึก", get: (b) => b.createdAt, render: (b) => String(b.createdAt ?? "").slice(11, 16) || "–" },
    { key: "branch", label: "สาขา", get: (b) => b.branch },
    { key: "sender", label: "ผู้ส่ง", get: (b) => b.sender, render: (b) => <ShortId v={b.sender} /> },
    { key: "route", label: "เส้นทาง", get: (b) => `${b.origin} → ${b.dest}` },
    { key: "group", label: "กลุ่มบริการ", get: (b) => b.serviceGroup },
    { key: "qty", label: "จำนวน", get: (b) => Number(b.qty) || 0, num: true },
    { key: "weight", label: "น้ำหนัก (กก.)", get: (b) => Number(b.weight) || 0, num: true, render: (b) => fmt(Math.round(Number(b.weight) || 0)) },
    { key: "volume", label: "ปริมาตร (ลบ.ม.)", get: (b) => Number(b.volume) || 0, num: true, render: (b) => fmt(Number(b.volume) || 0, 3) },
    { key: "total", label: "ราคารวม", get: (b) => Number(b.total) || 0, num: true, render: (b) => fmt(Math.round(Number(b.total) || 0)) },
    { key: "status", label: "สถานะ", get: (b) => b.status,
      render: (b) => <span className={`mg-band ${b.status === "รอจัดรถ" ? "y" : "g"}`}>{b.status}{b.docNo ? ` · ${b.docNo}` : ""}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(bills, cols, { key: "time", dir: -1 });
  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal mg-tb-modal" role="dialog" aria-modal="true" aria-label="บิลที่รับวันนี้">
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">บิลที่รับวันนี้ ({thDateSafe(todayISO())})</div>
            <p>บิลที่ฝ่ายบริการลูกค้าบันทึกในโมเดลวันนี้ ไม่รวมบิลที่ยกเลิก · {fmt(bills.length)} บิล</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(b) => b.id} empty="ไม่มีบิล" className="mg-tbl" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
