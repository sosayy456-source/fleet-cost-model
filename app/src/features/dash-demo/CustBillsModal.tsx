/**
 * ป็อบอัพรายการบิลของลูกค้าหนึ่งราย — แท็บ "กำไรลูกค้า" ของเมนู Demo
 * คอลัมน์ตามที่เจ้าของงานเคาะ 22 ก.ย. 2569: เลขที่บิล · วันที่ · เลขที่ใบรายการ · เส้นทาง · รายได้ · ต้นทุนจัดสรร · กำไร · %Margin
 * บิลให้ผู้เรียกกรองตามปี/เดือนมาแล้ว (ชุดเดียวกับตารางที่กด)
 *
 * ★ portal ไป #view-dash ด้วยเหตุผลเดียวกับ TripsModal — โทเคนสีของแดชบอร์ดอยู่ใต้ #view-dash เท่านั้น
 */
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { thDateSafe } from "../../lib/record/date";
import { ShortId } from "../../lib/custmap/ShortId";
import { SortTable, fmt, marginTone, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import type { AllocBill } from "../../lib/data/useAlloc";
import type { CustRow } from "./CustomerProfitTab";

export default function CustBillsModal({ row, bills, period, onClose }: {
  row: CustRow; bills: AllocBill[]; period: string; onClose: () => void;
}) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const cols = useMemo<Col<AllocBill>[]>(() => [
    { key: "bill", label: "เลขที่บิล", get: (b) => b.bill },
    { key: "date", label: "วันที่", get: (b) => b.date, render: (b) => thDateSafe(b.date) },
    { key: "doc", label: "เลขที่ใบรายการ", get: (b) => b.doc },
    { key: "route", label: "เส้นทาง", get: (b) => b.route },
    { key: "revenue", label: "รายได้", get: (b) => b.revenue, num: true },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (b) => b.cost, num: true },
    { key: "profit", label: "กำไร", get: (b) => b.revenue - b.cost, num: true,
      render: (b) => { const p = b.revenue - b.cost; return <span style={{ fontWeight: 700, color: p < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(p))}</span>; } },
    { key: "margin", label: "%Margin", get: (b) => (b.revenue ? (b.revenue - b.cost) / b.revenue * 100 : null), num: true,
      render: (b) => {
        const m = b.revenue ? (b.revenue - b.cost) / b.revenue * 100 : null;
        return <span style={{ fontWeight: 700, color: marginTone(m) }}>{m == null ? "–" : pct(m)}</span>;
      } },
  ], []);
  const { sorted, sort, toggle } = useSort(bills, cols, { key: "date", dir: -1 });

  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label="รายการบิลของลูกค้า">
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">ลูกค้า <ShortId v={row.code} n={row.n} /> <span>· {row.side}</span></div>
            <p>
              {period} · {fmt(bills.length)} บิล · รายได้ {fmt(Math.round(row.revenue))} · ต้นทุนจัดสรร {fmt(Math.round(row.cost))} ·
              กำไร <b style={{ color: row.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(row.profit))}</b> บาท
              {row.margin != null && <> · อัตรากำไร {pct(row.m)}</>}
            </p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(b, i) => `${b.bill}-${i}`}
            empty="ไม่มีบิลของลูกค้ารายนี้ในช่วงเวลาที่กรอง" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
