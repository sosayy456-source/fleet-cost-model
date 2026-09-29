/**
 * ป็อบอัพรายการบิลของเที่ยว — กดแถวในตาราง "เที่ยวรถที่กำลังวิ่ง" ของ Manager Dashboard (เจ้าของงานขอ 28 ก.ย. 2569)
 *
 *   เที่ยวจากไฟล์ของบริษัท = บิลทุกใบจาก alloc/trip_bills_XX.ndjson (build_alloc.py รอบสาม · loadTripBills)
 *     ต้นทุนจัดสรรรายบิลสูตรเดียวกับ Customer Performance (ปันตามการใช้ทรัพยากรรถ) · บิลเคลียร์/ไม่มีผู้จ่าย ขึ้นป้ายแทนลูกค้า
 *   ใบที่บันทึกใหม่ = บิลในใบ + allocateTrip() (lib/alloc/tripAlloc.ts) ปันต้นทุนของเที่ยวในตาราง (จริงหรือพยากรณ์)
 *   คอลัมน์ (เจ้าของงานเลือก): เลขที่บิล · วันที่ · ลูกค้า (ผู้จ่ายเงิน) · เส้นทาง · ประเภทสินค้า · น้ำหนัก · ปริมาตร ·
 *   รายได้ · ต้นทุนจัดสรร · กำไร
 *
 * ★ portal ไป #view-dash ด้วยเหตุผลเดียวกับ TripsModal — โทเคนสีของแดชบอร์ดอยู่ใต้ #view-dash เท่านั้น
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Note } from "../dash-fleet/parts";
import { SortTable, fmt, signed, useSort } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";
import { ShortId } from "../../lib/custmap/ShortId";
import { thDateSafe } from "../../lib/record/date";
import { loadTripBills, useAlloc } from "../../lib/data/useAlloc";
import { allocateTrip } from "../../lib/alloc/tripAlloc";
import { recordAllocItems, recordCapacity } from "../../lib/alloc/recordAlloc";
import { useBills } from "../../lib/store/bills";
import { useOverrides } from "../../lib/store/overrides";
import type { MgrTrip } from "../../lib/manager/manager";
import type { TripRecord } from "../../types/record";

interface Row {
  key: string; bill: string; date: string;
  /** ข้อความของลูกค้าไว้เรียง/ค้นหา · cust = สิ่งที่วาดในช่อง */
  custText: string; cust: ReactNode;
  route: string; goods: string; weight: number; cbm: number; revenue: number; cost: number;
}

/** ผู้จ่ายเงินของบิลใบใหม่ — ปลายทาง → ผู้รับ · อื่น ๆ → ผู้ส่ง (กติกาเดียวกับ payer_of ของ ETL) */
const payerOf = (b: { payType?: string; sender?: string; receiver?: string }): string =>
  (String(b.payType ?? "").includes("ปลายทาง") ? b.receiver : b.sender) || "–";

export default function TripBillsModal({ trip, records, onClose }: {
  trip: MgrTrip; records: TripRecord[]; onClose: () => void;
}) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  /* ---------- ใบที่บันทึกใหม่: บิลในใบ + ปันต้นทุนในเครื่อง ---------- */
  const pending = useBills();
  const [ovr] = useOverrides();
  const rec = useMemo(() => (trip.src === "new" ? records.find((r) => String(r.docNo ?? "").trim() === trip.id) ?? null : null),
    [trip, records]);
  const newRows = useMemo<Row[] | null>(() => {
    if (!rec) return null;
    const cap = recordCapacity(rec, ovr.vehicleSpecs);
    const res = allocateTrip(recordAllocItems(rec, pending.bills).items, trip.cost, cap.cf);
    const bills = rec.bills ?? [];
    return bills.map((b, i) => {
      const r = res.rows[i];
      const payer = payerOf(b);
      return { key: `${b.no}-${i}`, bill: b.no || "–", date: rec.releaseDate || rec.date || "", custText: payer, cust: payer,
        route: `${b.origin || "–"}→${b.dest || "–"}`, goods: b.goodsType || "–",
        weight: r?.weightKg ?? 0, cbm: r?.volumeM3 ?? 0, revenue: Number(b.total) || 0, cost: r?.cost ?? 0 };
    });
  }, [rec, pending.bills, ovr.vehicleSpecs, trip.cost]);

  /* ---------- เที่ยวจากไฟล์: บิลจากไฟล์ปันส่วน ---------- */
  const alloc = useAlloc();
  const [fileRows, setFileRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "old" | "error">("loading");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (trip.src === "new") return;
    const data = alloc.data;
    if (!data) { if (alloc.error) { setState("error"); setErr(alloc.error); } return; }
    let dead = false;
    setState("loading");
    loadTripBills(data, trip.id).then((bills) => {
      if (dead) return;
      if (!bills) { setState("old"); return; }
      setFileRows(bills.map((b, i) => {
        const c = b.ci >= 0 ? data.customers[b.ci] : undefined;
        return { key: `${b.bill}-${i}`, bill: b.bill, date: b.date,
          custText: c ? `${c.n} ${c.code}` : b.tag || "–",
          cust: c ? <ShortId v={c.code} n={c.n} /> : <span className="mg-tb-tag">{b.tag || "–"}</span>,
          route: b.route, goods: b.goods || "–", weight: b.weight, cbm: b.cbm, revenue: b.revenue, cost: b.cost };
      }));
      setState("ok");
    }).catch((e: unknown) => { if (!dead) { setState("error"); setErr(e instanceof Error ? e.message : String(e)); } });
    return () => { dead = true; };
  }, [trip, alloc.data, alloc.error]);

  const rows = trip.src === "new" ? newRows ?? [] : fileRows ?? [];
  const cols = useMemo<Col<Row>[]>(() => [
    { key: "bill", label: "เลขที่บิล", get: (r) => r.bill },
    { key: "date", label: "วันที่", get: (r) => r.date, render: (r) => thDateSafe(r.date) },
    { key: "cust", label: "ลูกค้า (ผู้จ่ายเงิน)", get: (r) => r.custText, render: (r) => r.cust },
    { key: "route", label: "เส้นทาง", get: (r) => r.route },
    { key: "goods", label: "ประเภทสินค้า", get: (r) => r.goods },
    { key: "weight", label: "น้ำหนัก (กก.)", get: (r) => r.weight, num: true, render: (r) => fmt(Math.round(r.weight)) },
    { key: "cbm", label: "ปริมาตร (ลบ.ม.)", get: (r) => r.cbm, num: true, render: (r) => fmt(r.cbm, 3) },
    { key: "revenue", label: "รายได้", get: (r) => r.revenue, num: true, render: (r) => fmt(Math.round(r.revenue)) },
    { key: "cost", label: "ต้นทุนจัดสรร", get: (r) => r.cost, num: true, render: (r) => fmt(Math.round(r.cost)) },
    { key: "profit", label: "กำไร", get: (r) => r.revenue - r.cost, num: true,
      render: (r) => { const p = r.revenue - r.cost; return <b style={{ color: p < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(p))}</b>; } },
  ], []);
  const { sorted, sort, toggle } = useSort(rows, cols, { key: "profit", dir: 1 });
  const sum = rows.reduce((a, r) => ({ rev: a.rev + r.revenue, cost: a.cost + r.cost }), { rev: 0, cost: 0 });

  const empty = trip.src === "new"
    ? rec ? "ใบนี้ยังไม่มีบิล" : "ไม่พบใบนี้ในรายการที่บันทึกในเครื่อง"
    : state === "loading" ? "กำลังโหลดรายการบิล..."
      : state === "old" ? "ไฟล์ปันส่วนรุ่นนี้ยังไม่มีบิลรายเที่ยว — รัน python etl/build_alloc.py ใหม่"
        : state === "error" ? `โหลดรายการบิลไม่สำเร็จ: ${err}`
          : "ไม่พบบิลของใบนี้ในไฟล์ปันส่วน (ไฟล์บิลอาจเป็นคนละชุดกับไฟล์ต้นทุน)";

  const host = document.getElementById("view-dash") ?? document.body;
  return createPortal(
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal mg-tb-modal" role="dialog" aria-modal="true" aria-label="รายการบิลของเที่ยว">
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">ใบรายการ {trip.id}{trip.src === "new" && <span className="mg-new">ใหม่</span>}</div>
            <p>
              {thDateSafe(trip.d)} · {trip.o} → {trip.de} · {trip.vk || "ไม่ระบุชนิดรถ"} · รายได้ {fmt(Math.round(trip.rev))} ·
              ต้นทุน{trip.costEst ? "พยากรณ์" : ""} {fmt(Math.round(trip.cost))} · กำไร{" "}
              <b style={{ color: trip.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(trip.profit))}</b> บาท
            </p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key} empty={empty} className="mg-tbl mg-tb-tbl" />
          {rows.length > 0 && (
            <p className="dz-note" style={{ marginTop: 8 }}>
              {fmt(rows.length)} บิล · รายได้รวม {fmt(Math.round(sum.rev))} · ต้นทุนจัดสรรรวม {fmt(Math.round(sum.cost))} ·
              กำไรรวม <b style={{ color: sum.rev - sum.cost < 0 ? "var(--red)" : "var(--green)" }}>{signed(Math.round(sum.rev - sum.cost))}</b> บาท
            </p>
          )}
          <Note>
            ต้นทุนจัดสรร = ต้นทุนของเที่ยวปันเข้าบิลตามการใช้ทรัพยากรรถ (น้ำหนักเทียบเท่า × ระยะทาง · สูตรเดียวกับ Customer Performance) ·
            บิลที่น้ำหนัก/ขนาดเชื่อไม่ได้ปันตามรายได้ · ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง = ผู้ส่ง · ปลายทาง = ผู้รับ) ·
            บิลเคลียร์และบิลที่ไม่มีผู้จ่ายไม่นับเป็นลูกค้า แต่ยังรับต้นทุนของตัวเอง ·
            {trip.src === "new"
              ? " ใบที่บันทึกใหม่: น้ำหนัก/ปริมาตรจากบิลที่ฝ่ายบริการลูกค้ากรอก · ต้นทุนเที่ยวเป็นยอดเดียวกับตาราง (ฝ่ายบัญชียังไม่กรอก = ต้นทุนพยากรณ์)"
              : " เที่ยวจากไฟล์: รายได้ของเที่ยวในตารางมาจากไฟล์ต้นทุน อาจไม่เท่ารายได้รวมของบิลเล็กน้อย"}
          </Note>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>,
    host,
  );
}
