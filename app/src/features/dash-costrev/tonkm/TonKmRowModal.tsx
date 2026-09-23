/**
 * ป็อบอัพรายละเอียดของหนึ่งแถวในตาราง "รายละเอียดรายปี × ชนิดรถ" (เจ้าของงานขอ 23 ก.ย. 2569)
 *
 *   หัว       ชนิดรถ · ปี · ป้ายสถานะ
 *   ตัวเลข    เที่ยว · Contribution · ตัน-กม. · อัตรา · Baseline · เป้าหมาย (% ของเป้า)
 *   ที่มา     Baseline = 0.4 × อัตราปี Y−2 + 0.6 × อัตราปี Y−1
 *   ตาราง     สลับ รายเดือน / รายเส้นทาง / รายเที่ยว — ยุบด้วยสูตรเดียวกับทั้งแท็บ (lib/tonkm/calc.ts detailOf)
 *
 * ★ วาดผ่าน portal ไป #view-dash (ไม่ใช่ body) — โทเคนสีของแดชบอร์ดประกาศใต้ #view-dash เท่านั้น
 *   กติกาเดียวกับ TripsModal/OverdueModal
 * ★ อัตรารายเที่ยวโชว์ประกอบเท่านั้น — ยอดของกลุ่มคือ ΣContribution ÷ Σตัน-กม. ไม่ใช่ค่าเฉลี่ยของคอลัมน์นี้
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { LfTrip } from "../../../lib/data/useLoadFactor";
import { BASE_W, detailOf } from "../../../lib/tonkm/calc";
import type { TkAgg, TkTripRow, YearRow } from "../../../lib/tonkm/calc";
import { SortTable, fmt, monthName, pct, useSort } from "../common";
import type { Col } from "../common";
import { BaseTag, StatusTag, rateStr } from "./TonKmCards";

type View = "month" | "route" | "trip";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "รายเดือน" },
  { id: "route", label: "รายเส้นทาง" },
  { id: "trip", label: "รายเที่ยว" },
];

interface GroupRow { key: string; label: string; agg: TkAgg }

const rateCell = (r: number | null) =>
  <b style={{ color: (r ?? 0) < 0 ? "var(--red)" : undefined }}>{rateStr(r)}</b>;

/** คอลัมน์ของมุมมองรายเดือน/รายเส้นทาง — ต่างกันแค่หัวคอลัมน์แรก */
const groupCols = (first: string): Col<GroupRow>[] => [
  { key: "label", label: first, get: (g) => g.key, render: (g) => g.label },
  { key: "n", label: "เที่ยว", get: (g) => g.agg.n, num: true },
  { key: "contrib", label: "Contribution", get: (g) => g.agg.contrib, num: true, render: (g) => fmt(Math.round(g.agg.contrib)) },
  { key: "tk", label: "ตัน-กม.", get: (g) => g.agg.tk, num: true, render: (g) => fmt(Math.round(g.agg.tk)) },
  { key: "rate", label: "บาท/ตัน-กม.", get: (g) => g.agg.rate ?? -Infinity, num: true, render: (g) => rateCell(g.agg.rate) },
];

const TRIP_COLS: Col<TkTripRow>[] = [
  { key: "id", label: "เลขที่ใบรายการ", get: (t) => t.id },
  { key: "mo", label: "เดือน", get: (t) => t.mo, render: (t) => monthName(t.mo.slice(5)) },
  { key: "rt", label: "เส้นทาง", get: (t) => t.rt },
  { key: "pl", label: "ทะเบียน", get: (t) => t.pl },
  { key: "wt", label: "ตัน", get: (t) => t.wt, num: true, render: (t) => fmt(t.wt, 2) },
  { key: "km", label: "กม.", get: (t) => t.km, num: true },
  { key: "tk", label: "ตัน-กม.", get: (t) => t.tk, num: true, render: (t) => fmt(Math.round(t.tk)) },
  { key: "rev", label: "รายได้", get: (t) => t.rev, num: true, render: (t) => fmt(Math.round(t.rev)) },
  { key: "vc", label: "VC", get: (t) => t.vc, num: true, render: (t) => fmt(Math.round(t.vc)) },
  { key: "contrib", label: "Contribution", get: (t) => t.contrib, num: true, render: (t) => fmt(Math.round(t.contrib)) },
  { key: "rate", label: "บาท/ตัน-กม.", get: (t) => t.rate, num: true, render: (t) => rateCell(t.rate) },
];

export default function TonKmRowModal({ row, trips, x, onClose }: {
  row: YearRow; trips: LfTrip[]; x: number; onClose: () => void;
}) {
  const [view, setView] = useState<View>("month");
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const d = useMemo(() => detailOf(trips, row.year, row.vk), [trips, row.year, row.vk]);
  const months = useMemo<GroupRow[]>(() => d.months.map((m) => ({ key: m.mo, label: monthName(m.mo.slice(5)), agg: m.agg })), [d]);
  const routes = useMemo<GroupRow[]>(() => d.routes.map((r) => ({ key: r.rt, label: r.rt, agg: r.agg })), [d]);

  const mCols = useMemo(() => groupCols("เดือน"), []);
  const rCols = useMemo(() => groupCols("เส้นทาง"), []);
  const mSort = useSort(months, mCols, { key: "label", dir: 1 });
  const rSort = useSort(routes, rCols, { key: "tk", dir: -1 });
  const tSort = useSort(d.trips, TRIP_COLS, { key: "rate", dir: 1 });

  const y = row.year + 543;
  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`${row.vk} ปี ${y}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{row.vk} <span>· ปี {y}</span> <StatusTag s={row.status} /> <BaseTag n={row.baseN} /></div>
            <p>กำไรส่วนเกินต่อตัน-กม. ทั้งปี · Contribution = รายได้ − ต้นทุนผันแปร · อัตรา = ΣContribution ÷ Σตัน-กม.
              {d.skipped > 0 && ` · ไม่นับ ${fmt(d.skipped)} เที่ยวที่ไม่มีน้ำหนักหรือระยะทาง`}</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="sm-nums">
          <div><span>เที่ยว</span><b>{fmt(row.agg.n)}</b></div>
          <div><span>Contribution</span><b>{fmt(Math.round(row.agg.contrib))}</b></div>
          <div><span>ตัน-กม.</span><b>{fmt(Math.round(row.agg.tk))}</b></div>
          <div><span>บาท/ตัน-กม.</span><b style={{ color: (row.agg.rate ?? 0) < 0 ? "var(--red)" : undefined }}>{rateStr(row.agg.rate)}</b></div>
          <div><span>เป้าหมาย</span><b>{rateStr(row.target)}</b></div>
          <div><span>% ของเป้า</span><b>{row.pctOfTarget == null ? "–" : pct(row.pctOfTarget, 0)}</b></div>
        </div>

        <div className="sm-parts">
          <b>ที่มาของเป้า</b>
          <span>ปี {y - 2}: <b>{rateStr(row.rY2)}</b></span>
          <span>ปี {y - 1}: <b>{rateStr(row.rY1)}</b></span>
          {row.baseN === 2
            ? <span>Baseline = {BASE_W[0]} × {rateStr(row.rY2)} + {BASE_W[1]} × {rateStr(row.rY1)} = <b>{rateStr(row.base)}</b></span>
            : row.baseN === 1 && <span>Baseline = ปี {row.rY1 != null ? y - 1 : y - 2} ปีเดียว = <b>{rateStr(row.base)}</b> (มีข้อมูลปีก่อนหน้าปีเดียว)</span>}
          <span>เป้าหมาย = Baseline × (1 + {fmt(x, x % 1 ? 1 : 0)}%) = <b>{rateStr(row.target)}</b></span>
          {row.status === "nobase" && <span>ไม่มีข้อมูลของสองปีก่อนหน้าเลย จึงยังตั้งเป้าไม่ได้</span>}
          {row.status === "vcloss" && <span>Baseline ≤ 0 — ไม่คิดเป้า +X% เพราะเป้าของค่าติดลบจะกลายเป็นขาดทุนมากขึ้น</span>}
        </div>

        <div className="cp-seg" role="group" aria-label="มุมมอง">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className={view === v.id ? "on" : ""} onClick={() => setView(v.id)}>
              {v.label} ({fmt(v.id === "month" ? months.length : v.id === "route" ? routes.length : d.trips.length)})
            </button>
          ))}
        </div>

        <div className="sm-list">
          {view === "month" && <SortTable rows={mSort.sorted} cols={mCols} sort={mSort.sort} onSort={mSort.toggle}
            rowKey={(g) => g.key} empty="ไม่มีข้อมูล" />}
          {view === "route" && <SortTable rows={rSort.sorted} cols={rCols} sort={rSort.sort} onSort={rSort.toggle}
            rowKey={(g) => g.key} empty="ไม่มีข้อมูล" />}
          {view === "trip" && <SortTable rows={tSort.sorted} cols={TRIP_COLS} sort={tSort.sort} onSort={tSort.toggle}
            rowKey={(t) => t.id} empty="ไม่มีข้อมูล" />}
        </div>
        {view === "trip" && (
          <p className="dz-note" style={{ margin: 0 }}>
            อัตรารายเที่ยวดูประกอบเท่านั้น — เที่ยวที่ขนน้อยได้อัตราสูงผิดปกติ ยอดของทั้งกลุ่มจึงคิดจาก ΣContribution ÷ Σตัน-กม.
            ไม่ใช่ค่าเฉลี่ยของคอลัมน์นี้ · ตั้งต้นเรียงจากอัตราต่ำสุด
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
