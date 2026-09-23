/**
 * ป็อบอัพรายการทุกเที่ยวของเส้นทางหนึ่ง — ใช้ร่วมกันในเมนู Demo และแท็บการใช้ประโยชน์ของกองรถ (Executive Dashboard)
 *   · ปุ่ม i ของแผงรายละเอียดเส้นทาง (RouteProfitTab)
 *   · กดแถวในตารางรายเส้นทางของแผงกลุ่มบริการ (ServicePanel)
 * ขอบเขตของเที่ยวให้ผู้เรียกกรองมาให้แล้ว (ตัวกรองใหญ่ของแท็บ + กลุ่มบริการถ้ามี)
 *
 * ★ ต้องวาดผ่าน portal ออกจากแผงที่กางอยู่ — .dm-panel มี transform จากแอนิเมชัน ซึ่งทำให้ position:fixed
 *   ข้างในอ้างอิงกล่องนั้นแทนทั้งจอ ป็อบอัพจะไปโผล่กลางหน้าเว็บแทนที่จะลอยทับ
 * ★ ปลายทางของ portal ต้องเป็น #view-dash **ห้ามเป็น body** — โทเคนสีของแดชบอร์ด (--d-row ที่เป็นเส้นคั่นแถว
 *   ฯลฯ) ประกาศไว้ใต้ #view-dash เท่านั้น ออกไปนอกนั้นแล้วตารางจะไม่มีเส้นคั่นและสีเพี้ยนโดยไม่มี error
 */
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { thDateSafe } from "../../lib/record/date";
import { SortTable, fmt, marginTone, pct, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import type { Trip } from "../../lib/data/useCostRev";

export default function TripsModal({ rt, trips, onClose, note, showRoute, initialSort }: {
  rt: string; trips: Trip[]; onClose: () => void; note?: string;
  /** เที่ยวมาจากหลายเส้นทาง (ป็อบอัพเที่ยวขาดทุน) — ใส่คอลัมน์เส้นทางต่อจากวันที่ */
  showRoute?: boolean;
  /** การเรียงตั้งต้น — ค่าเริ่มต้น กำไรมากไปน้อย */
  initialSort?: { key: string; dir: 1 | -1 };
}) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const cols = useMemo<Col<Trip>[]>(() => [
    { key: "d", label: "วันที่", get: (t) => t.d, render: (t) => thDateSafe(t.d) },
    ...(showRoute ? [{ key: "rt", label: "เส้นทาง", get: (t: Trip) => t.rt || "–" }] : []),
    { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
    { key: "br", label: "สาขา", get: (t) => t.br || "–" },
    { key: "pl", label: "ทะเบียนรถ", get: (t) => t.pl || "–" },
    { key: "ft", label: "ประเภทรถ", get: (t) => t.ft },
    { key: "vk", label: "ชนิดรถ", get: (t) => t.vk },
    { key: "sg", label: "กลุ่มบริการ", get: (t) => t.sg || "ไม่ระบุ" },
    { key: "bn", label: "บิล", get: (t) => t.bn, num: true },
    { key: "rev", label: "รายได้", get: (t) => t.rev, num: true },
    { key: "cost", label: "ต้นทุน", get: (t) => t.cost, num: true },
    { key: "profit", label: "กำไร", get: (t) => t.profit, num: true,
      render: (t) => <span style={{ fontWeight: 700, color: t.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(t.profit)}</span> },
    { key: "margin", label: "%Margin", get: (t) => (t.rev ? t.profit / t.rev * 100 : null), num: true,
      render: (t) => {
        const m = t.rev ? t.profit / t.rev * 100 : null;
        return <span style={{ fontWeight: 700, color: marginTone(m) }}>{m == null ? "–" : pct(m)}</span>;
      } },
  ], [showRoute]);
  const { sorted, sort, toggle } = useSort(trips, cols, initialSort ?? { key: "profit", dir: -1 });

  // #view-dash ไม่มี transform จึงยังได้ position:fixed เต็มจอ และยังอยู่ในขอบเขตโทเคนสีของแดชบอร์ด
  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`ทุกเที่ยวของ ${rt}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{rt}</div>
            <p>{note ?? "ทุกเที่ยวของเส้นทางนี้ตามตัวกรองที่เลือกอยู่"} · {fmt(trips.length)} เที่ยว</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(t, i) => `${t.id}-${i}`}
            empty="ไม่มีเที่ยวในเส้นทางนี้" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
