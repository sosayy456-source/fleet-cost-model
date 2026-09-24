/**
 * กรอบตารางของแท็บ "รายละเอียด ข้อ 3" ใช้กับ**ทุกตาราง**ในแท็บนี้ — หน้าตาเดียวกับตารางอื่นของ Executive Dashboard
 *   (แบบ "รายละเอียดรายปี × ชนิดรถ" ของแท็บตัน-กม. · เจ้าของงานสั่ง 24 ก.ย. 2569 แทนกรอบดำหัวชมพูของ 23 ก.ย.)
 *   หัวเรื่อง + บรรทัดรอง "แสดง x จาก y" + ป้ายสี · ช่องค้นหาด้านขวา · ตารางไม่มีกรอบ ไม่มีแถวสลับสี
 * ข้างในยังเป็น SortTable/useSort/GrowBox ชุดเดียวกับทั้งระบบ (เรียงสามจังหวะ · แสดงครบทุกแถว)
 * คลาสช่วยวาดเซลล์ (d3-tt-kind · d3-tt-id · d3-tt-neg/pos · d3-tt-cov) อยู่ในส่วนที่ 2 ของ index.css
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { fmt, SortTable, useSort, type Col } from "../common";

export default function D3Table<T>({ title, unit, rows, cols, initial, rowKey, empty, search, placeholder, note, legend, children }: {
  title: ReactNode;
  /** หน่วยนับแถว เช่น "คัน-เที่ยว" · "เส้นทาง" · "ชนิด" */
  unit: string;
  rows: T[]; cols: Col<T>[]; initial: { key: string; dir: 1 | -1 };
  rowKey: (r: T, i: number) => string; empty: string;
  /** ข้อความที่ค้นหาได้ของแต่ละแถว — ไม่ส่ง = ไม่มีช่องค้นหา */
  search?: (r: T) => (string | null | undefined)[];
  placeholder?: string;
  /** คำอธิบายใต้หัวเรื่อง */
  note?: ReactNode;
  /** ป้ายสีที่มุมขวาของแถบท้าย — [สีจุด, ข้อความ] */
  legend?: [string, string][];
  /** ของที่วางใต้กรอบตาราง เช่น หมายเหตุ */
  children?: ReactNode;
}) {
  const [q, setQ] = useState("");
  // search มักส่งมาเป็นฟังก์ชันใหม่ทุก render — เก็บใน ref ไม่ให้ shown เปลี่ยน identity แล้ว GrowBox เด้งกลับบน
  const searchRef = useRef(search);
  searchRef.current = search;
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase(), f = searchRef.current;
    return k && f ? rows.filter((r) => f(r).some((x) => (x || "").toLowerCase().includes(k))) : rows;
  }, [rows, q]);
  const { sorted, sort, toggle } = useSort(shown, cols, initial);
  return <div className="dz-cc d3-tt" style={{ marginTop: 14 }}>
    <div className="tk-th d3-tt-head">
      <div>
        <h4>{title}</h4>
        <p>
          แสดง {fmt(sorted.length)} จาก {fmt(rows.length)} {unit}
          {legend && <span className="d3-tt-legend">{legend.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</span>}
        </p>
      </div>
      {search && <input type="search" className="d3-tt-search" placeholder={placeholder ?? "ค้นหา…"} value={q}
        onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาในตาราง" />}
    </div>
    {note && <p className="dz-note d3-tt-note">{note}</p>}
    <SortTable rows={sorted} cols={cols} sort={sort} onSort={toggle} rowKey={rowKey}
      empty={q ? "ไม่พบรายการที่ค้นหา" : empty} className="d3-nowrap d3-tt-tbl" />
    {children}
  </div>;
}

/** สีป้ายท้ายตารางชุดเดียวกับเซลล์ d3-tt-neg/pos */
export const NEG = "#E11D48", POS = "#0F7A4F", WARN = "#D97706";
