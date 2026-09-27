/**
 * ป็อบอัพรายการบิลของลูกค้าหนึ่งราย — แท็บ "กำไรลูกค้า" ของเมนู Demo
 * คอลัมน์ตามที่เจ้าของงานเคาะ 22 ก.ย. 2569: เลขที่บิล · วันที่ · เลขที่ใบรายการ · เส้นทาง · รายได้ · ต้นทุนจัดสรร · กำไร · %Margin
 * + ที่มาของต้นทุน (27 ก.ย. 2569 · ไฟล์ bills.json รุ่นใหม่เท่านั้น): น้ำหนัก · ปริมาตร · ระยะทาง · CF · น้ำหนักเทียบเท่า · Metric ·
 *   % ของต้นทุนเที่ยว — ให้ตรวจได้ว่าต้นทุนบิลคิดมาจากอะไร (สูตรใน etl/src/alloc.py)
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

  const hasBreakdown = bills.some((b) => b.cf != null);
  const cols = useMemo<Col<AllocBill>[]>(() => [
    { key: "bill", label: "เลขที่บิล", get: (b) => b.bill },
    { key: "date", label: "วันที่", get: (b) => b.date, render: (b) => thDateSafe(b.date) },
    { key: "doc", label: "เลขที่ใบรายการ", get: (b) => b.doc },
    { key: "route", label: "เส้นทาง", get: (b) => b.route },
    ...(hasBreakdown ? [
      { key: "weight", label: "น้ำหนัก (กก.)", get: (b: AllocBill) => b.weight, num: true },
      { key: "cbm", label: "ปริมาตร (ลบ.ม.)", get: (b: AllocBill) => b.cbm, num: true, render: (b: AllocBill) => fmt(b.cbm ?? 0, 3) },
      { key: "km", label: "ระยะทาง (กม.)", get: (b: AllocBill) => b.km, num: true },
      { key: "cf", label: "CF (กก./ลบ.ม.)", get: (b: AllocBill) => b.cf, num: true, render: (b: AllocBill) => fmt(b.cf ?? 0, 2) },
      { key: "eqKg", label: "น้ำหนักเทียบเท่า (กก.)", get: (b: AllocBill) => b.eqKg, num: true,
        render: (b: AllocBill) => (b.byRevenue && b.byRevenue >= b.cost - 0.005 ? <span title="น้ำหนัก/ขนาดเชื่อไม่ได้ ปันตามรายได้">ตามรายได้</span> : fmt(b.eqKg ?? 0, 1)) },
      { key: "metric", label: "Metric (กก.-กม.)", get: (b: AllocBill) => b.metric, num: true },
      { key: "share", label: "% ของเที่ยว", get: (b: AllocBill) => b.share, num: true, render: (b: AllocBill) => pct(b.share ?? 0, 2) },
    ] as Col<AllocBill>[] : []),
    { key: "revenue", label: "รายได้", get: (b) => b.revenue, num: true },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (b) => b.cost, num: true },
    { key: "profit", label: "กำไร", get: (b) => b.revenue - b.cost, num: true,
      render: (b) => { const p = b.revenue - b.cost; return <span style={{ fontWeight: 700, color: p < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(p))}</span>; } },
    { key: "margin", label: "%Margin", get: (b) => (b.revenue ? (b.revenue - b.cost) / b.revenue * 100 : null), num: true,
      render: (b) => {
        const m = b.revenue ? (b.revenue - b.cost) / b.revenue * 100 : null;
        return <span style={{ fontWeight: 700, color: marginTone(m) }}>{m == null ? "–" : pct(m)}</span>;
      } },
  ], [hasBreakdown]);
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
            empty="ไม่มีบิลของลูกค้ารายนี้ในช่วงเวลาที่กรอง" className={hasBreakdown ? "ta-tbl" : undefined} />
          <p className="dz-note" style={{ marginTop: 8 }}>
            {hasBreakdown
              ? <>ต้นทุนจัดสรร = ต้นทุนเที่ยว × Metric ของบิล ÷ Metric รวมของทุกบิลในเที่ยว · CF = ความจุน้ำหนัก ÷ ความจุปริมาตร
                  ของรถทุกคันในใบ · น้ำหนักเทียบเท่า = MAX(น้ำหนัก, ปริมาตร × CF) · Metric = น้ำหนักเทียบเท่า × ระยะทาง ·
                  บิลที่น้ำหนัก/ขนาดเชื่อไม่ได้ปันตามรายได้</>
              : "ไฟล์ปันส่วนรุ่นนี้ยังไม่มีที่มาของต้นทุนรายบิล — รัน python etl/build_alloc.py ใหม่"}
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
