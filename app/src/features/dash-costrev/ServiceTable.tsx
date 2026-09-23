/**
 * ตารางระดับกลุ่มบริการ — ท้ายแท็บ "กำไรรายเที่ยว" (สเปก "กำไรต่อเที่ยว" ส่วนระดับกลุ่มบริการ)
 *
 * แสดงเฉพาะเที่ยวที่จับคู่กับข้อมูลรายได้จริงได้ — svc.json มีเฉพาะใบเหล่านั้นอยู่แล้ว
 * 1 แถว = ต้นทาง-ปลายทาง × กลุ่มบริการ · กดที่กำไรเพื่อเปิดหน้าต่าง KPI + รายการเที่ยวของกลุ่มนั้น
 *
 * ★ ตัวเลขเป็นค่าที่ "ปันส่วน" จากเที่ยว ไม่ใช่ค่าจากไฟล์โดยตรง (etl/src/svcalloc.py)
 *   ต้นทุน = ต้นทุนเที่ยว × ภาระงานของกลุ่ม ÷ ภาระงานรวม (วิธี ค เดียวกับแท็บกำไรลูกค้า)
 *   รายได้ = รายได้เที่ยว × ยอดบิลของกลุ่ม ÷ ยอดบิลรวม · Σ ทุกกลุ่มของเที่ยว = ตัวเลขเที่ยวเสมอ
 * ★ "บิลเคลียร์" เป็นกลุ่มของตัวเอง เพราะยังรับต้นทุนตามภาระงานเหมือนกติกากำไรลูกค้า
 * ★ ตารางสรุป เส้นทาง × ชนิดรถ (SummaryTable) ยังอยู่ตามคำสั่งเจ้าของงาน 20 ก.ย. 2569 — ตารางนี้เพิ่มคู่กัน ไม่แทนที่
 */
import { useEffect, useMemo, useState } from "react";
import { thDateSafe } from "../../lib/record/date";
import { Note, TableHead } from "../dash-fleet/parts";
import { ListFF, SortTable, duniq, fmt, marginTone, pct, signed, useSort } from "./common";
import type { Col } from "./common";
import type { SvcAlloc, Trip } from "../../lib/data/useCostRev";

interface Part { id: string; d: string; pl: string; n: number; rev: number; cost: number; profit: number }
interface SRow {
  key: string; rt: string; g: string;
  n: number; rev: number; cost: number; profit: number; margin: number | null;
  parts: Part[];
}

const marginOf = (rev: number, profit: number): number | null => (rev ? profit / rev * 100 : null);

export default function ServiceTable({ trips, svc }: { trips: Trip[]; svc: SvcAlloc }) {
  const [g, setG] = useState("");
  const [open, setOpen] = useState<SRow | null>(null);

  const rows = useMemo(() => {
    const byId = new Map<string, Trip>();
    for (const t of trips) if (!byId.has(t.id)) byId.set(t.id, t);
    const m = new Map<string, SRow>();
    for (let i = 0; i < svc.id.length; i++) {
      const t = byId.get(svc.id[i]!);
      if (!t) continue;
      const grp = svc.g[i]!;
      const rt = t.rt || "(ไม่ระบุ)";
      const key = `${rt}\u0000${grp}`;
      const r = m.get(key) ?? { key, rt, g: grp, n: 0, rev: 0, cost: 0, profit: 0, margin: null, parts: [] };
      const rev = svc.rev[i]!, cost = svc.cost[i]!;
      r.n++; r.rev += rev; r.cost += cost; r.profit += rev - cost;
      r.parts.push({ id: t.id, d: t.d, pl: t.pl, n: svc.n[i]!, rev, cost, profit: rev - cost });
      m.set(key, r);
    }
    return [...m.values()].map((r) => ({ ...r, margin: marginOf(r.rev, r.profit) }));
  }, [trips, svc]);

  const groups = useMemo(() => duniq(rows.map((r) => r.g)), [rows]);
  const shown = useMemo(() => rows.filter((r) => !g || r.g === g), [rows, g]);

  const cols = useMemo<Col<SRow>[]>(() => [
    { key: "rt", label: "ต้นทาง-ปลายทาง", get: (r) => r.rt, render: (r) => <span className="sm-rt" title={r.rt}>{r.rt}</span> },
    { key: "g", label: "กลุ่มบริการ", get: (r) => r.g },
    { key: "n", label: "จำนวนเที่ยว", get: (r) => r.n, num: true },
    { key: "rev", label: "รายได้", get: (r) => r.rev, num: true },
    { key: "cost", label: "ต้นทุน", get: (r) => r.cost, num: true },
    { key: "profit", label: "กำไร", get: (r) => r.profit, num: true,
      render: (r) => (
        <button type="button" className="sm-profit" onClick={() => setOpen(r)}
          title="กดเพื่อดู KPI และรายการเที่ยวของกลุ่มนี้"
          style={{ color: r.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(r.profit)}</button>
      ) },
    { key: "margin", label: "%margin", get: (r) => r.margin, num: true,
      render: (r) => <span style={{ fontWeight: 700, color: marginTone(r.margin) }}>
        {r.margin == null ? "–" : (r.margin > 0 ? "+" : "") + pct(r.margin)}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(shown, cols, { key: "profit", dir: 1 });

  return (
    <div className="dz-cc" style={{ marginTop: 14 }}>
      <TableHead title={`ตารางระดับกลุ่มบริการ · ${fmt(shown.length)} กลุ่ม`}>
        <ListFF label="กลุ่มบริการ" all="ทุกกลุ่ม" value={g} onChange={setG} opts={groups} />
      </TableHead>
      <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(r) => r.key}
        empty="ไม่พบข้อมูลที่จับคู่กับรายได้จริงได้ตามเงื่อนไข" />
      <Note>
        เฉพาะเที่ยวที่จับคู่กับข้อมูลรายได้จริงได้ · กลุ่มบริการ = ประเภทสินค้าของบิล ·
        <b> ตัวเลขเป็นค่าปันส่วน</b>: ต้นทุนของเที่ยวแบ่งตามภาระงาน (น้ำหนักที่ใช้คิด × ระยะทาง) ของแต่ละกลุ่ม
        แบบเดียวกับแท็บ "กำไรลูกค้า" ส่วนรายได้แบ่งตามยอดบิล — ผลรวมทุกกลุ่มของเที่ยวจึงเท่ากับรายได้/ต้นทุนของเที่ยวนั้นเสมอ ·
        "บิลเคลียร์" แสดงเป็นกลุ่มหนึ่งเพราะยังรับต้นทุนตามภาระงาน ·
        กดที่ตัวเลขกำไรเพื่อดู KPI และรายการเที่ยว · คลิกหัวคอลัมน์เพื่อเรียง
      </Note>
      {open && <Detail row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ row, onClose }: { row: SRow; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);

  const cols = useMemo<Col<Part>[]>(() => [
    { key: "d", label: "วัน/เดือน/ปี", get: (p) => p.d, render: (p) => thDateSafe(p.d) },
    { key: "id", label: "เลขที่ใบรายการ", get: (p) => p.id },
    { key: "pl", label: "ทะเบียนรถ", get: (p) => p.pl || "–" },
    { key: "n", label: "รายการบิล", get: (p) => p.n, num: true },
    { key: "rev", label: "รายได้ (ปันส่วน)", get: (p) => p.rev, num: true },
    { key: "cost", label: "ต้นทุน (ปันส่วน)", get: (p) => p.cost, num: true },
    { key: "profit", label: "กำไร (ปันส่วน)", get: (p) => p.profit, num: true,
      render: (p) => <span style={{ fontWeight: 700, color: p.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(p.profit)}</span> },
  ], []);
  const { sorted, sort, toggle } = useSort(row.parts, cols, { key: "profit", dir: 1 });

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal wide sm-modal" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${row.rt} ${row.g}`}>
        <div className="sm-mh">
          <div className="sm-mt">
            <div className="modal-h">{row.rt} <span>· {row.g}</span></div>
            <p>{fmt(row.n)} เที่ยว · ตัวเลขเป็นค่าปันส่วนตามกลุ่มบริการ</p>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="sm-nums">
          <div><span>รายได้</span><b>{fmt(row.rev)}</b></div>
          <div><span>ต้นทุน</span><b>{fmt(row.cost)}</b></div>
          <div><span>กำไร</span>
            <b style={{ color: row.profit < 0 ? "var(--red)" : "var(--green)" }}>{signed(row.profit)}</b></div>
          <div><span>%margin</span>
            <b style={{ color: marginTone(row.margin) }}>{row.margin == null ? "–" : pct(row.margin)}</b></div>
        </div>
        <div className="sm-list">
          <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={(p, i) => `${p.id}-${i}`}
            empty="ไม่มีเที่ยวในกลุ่มนี้" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
