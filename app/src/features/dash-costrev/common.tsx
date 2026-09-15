/**
 * ของใช้ร่วมของแดชบอร์ด Executive / รวม — ตัวกรอง ตัวช่วยรวมยอด ตารางเรียงได้
 *
 * แดชบอร์ดชุดนี้อ่านจาก trips.json ของ etl/build_costrev.py ไม่ได้ผ่าน recCost/computeCost
 * เพราะต้นทุนมาเป็นยอดสำเร็จรูปจากไฟล์บริษัท ไม่ใช่จากสูตรของโมเดล
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fmtN } from "../../lib/chart/theme";
import { FF } from "../dash-fleet/parts";
import type { Trip } from "../../lib/data/useCostRev";

export const fmt = (n: number, d = 0): string => fmtN(n, d);
export const pct = (n: number, d = 1): string => `${n.toFixed(d)}%`;
export const signed = (n: number): string => (n < 0 ? "−" : "") + fmt(Math.abs(n));

export const duniq = (a: (string | null | undefined)[]): string[] =>
  [...new Set(a.filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y, "th"));

/** ชื่อเดือนไทยสั้น + ปี พ.ศ. 2 หลัก จาก "YYYY-MM" — รูปเดียวกับแดชบอร์ดรายได้ */
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const monthLabel = (mo: string): string => {
  const [y, m] = mo.split("-");
  const mi = Number(m) - 1;
  return TH_MONTHS[mi] ? `${TH_MONTHS[mi]} ${Number(y) + 543 - 2500}` : mo;
};
export const monthName = (m: string): string => TH_MONTHS[Number(m) - 1] ?? m;

/** อัตรากำไร % ของเที่ยว — null ถ้าไม่มีรายได้ (เที่ยวเปล่า) หารไม่ได้ */
export const marginOf = (t: Trip): number | null => (t.rev ? t.profit / t.rev * 100 : null);

/* ---------------- ตัวกรองมาตรฐานของทั้งสามแท็บ ---------------- */
export function YearFF({ trips, value, onChange }: { trips: Trip[]; value: string; onChange: (v: string) => void }) {
  const years = [...new Set(trips.map((t) => String(t.y)))].sort();
  return (
    <FF label="ปี" value={value} onChange={onChange}>
      <option value="">ทุกปี</option>
      {years.map((y) => <option key={y} value={y}>พ.ศ. {+y + 543}</option>)}
    </FF>
  );
}

export function MonthFF({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <FF label="เดือน" value={value} onChange={onChange}>
      <option value="">ทุกเดือน</option>
      {TH_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
    </FF>
  );
}

export function ListFF({ label, all, value, onChange, opts }: {
  label: string; all: string; value: string; onChange: (v: string) => void; opts: string[];
}) {
  return (
    <FF label={label} value={value} onChange={onChange}>
      <option value="">{all}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </FF>
  );
}

/** เงื่อนไขที่ทุกแท็บใช้ร่วม — เดือนใช้ 2 หลัก "01".."12" · ค่าว่าง = ไม่กรองมิตินั้น */
export interface BaseFilter { year: string; month: string; o: string; de: string; ft: string; vk: string }
export const BASE_F0: BaseFilter = { year: "", month: "", o: "", de: "", ft: "", vk: "" };

export const passBase = (t: Trip, f: BaseFilter, opts: { ignoreYear?: boolean; ignoreMonth?: boolean } = {}): boolean =>
  (opts.ignoreYear || !f.year || String(t.y) === f.year)
  && (opts.ignoreMonth || !f.month || t.mo.slice(5) === f.month)
  && (!f.o || t.o === f.o)
  && (!f.de || t.de === f.de)
  && (!f.ft || t.ft === f.ft)
  && (!f.vk || t.vk === f.vk);

/* ---------------- รวมยอดตามกลุ่ม ---------------- */
export interface Agg { key: string; n: number; rev: number; cost: number; profit: number; km: number; kmTrips: number }

export function groupBy(trips: Trip[], keyOf: (t: Trip) => string): Agg[] {
  const m = new Map<string, Agg>();
  for (const t of trips) {
    const k = keyOf(t);
    if (!k) continue;
    const a = m.get(k) ?? { key: k, n: 0, rev: 0, cost: 0, profit: 0, km: 0, kmTrips: 0 };
    a.n++; a.rev += t.rev; a.cost += t.cost; a.profit += t.profit;
    if (t.km != null) { a.km += t.km; a.kmTrips++; }
    m.set(k, a);
  }
  return [...m.values()];
}

/** รวมยอดคอลัมน์เดียวตามกลุ่ม — ใช้กับ drill-down ของแท็บต้นทุน */
export function sumBy(trips: Trip[], keyOf: (t: Trip) => string, valOf: (t: Trip) => number): { key: string; n: number; v: number }[] {
  const m = new Map<string, { key: string; n: number; v: number }>();
  for (const t of trips) {
    const k = keyOf(t);
    if (!k) continue;
    const a = m.get(k) ?? { key: k, n: 0, v: 0 };
    a.n++; a.v += valOf(t);
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}

/* ---------------- ตารางที่เรียงได้ทุกคอลัมน์ตัวเลข ---------------- */
export interface Col<T> {
  key: string; label: string;
  /** ค่าที่ใช้เรียง — ถ้าเป็นตัวเลขจะเรียงแบบตัวเลข */
  get: (r: T) => string | number | null;
  render?: (r: T) => ReactNode;
  num?: boolean;
}

export function useSort<T>(rows: T[], cols: Col<T>[], initial: { key: string; dir: 1 | -1 }) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort.key);
    if (!c) return rows;
    return [...rows].sort((a, b) => {
      const x = c.get(a), y = c.get(b);
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
      if (x == null) return 1;
      if (y == null) return -1;
      return String(x).localeCompare(String(y), "th") * sort.dir;
    });
  }, [rows, cols, sort]);
  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  return { sorted, sort, toggle };
}

export function SortTable<T>({ rows, cols, sort, onSort, rowKey, empty, limit = 300 }: {
  rows: T[]; cols: Col<T>[]; sort: { key: string; dir: 1 | -1 };
  onSort: (key: string) => void; rowKey: (r: T, i: number) => string; empty: string; limit?: number;
}) {
  return (
    <div className="scroll">
      <table className="dz-tbl">
        <thead><tr>
          {cols.map((c) => (
            <th key={c.key} className={c.num ? "n" : undefined} onClick={() => onSort(c.key)}
              style={{ cursor: "pointer", userSelect: "none" }} title="คลิกเพื่อเรียง">
              {c.label}
              <span style={{ marginLeft: 4, opacity: sort.key === c.key ? 1 : .3, fontSize: 10 }}>
                {sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "▲▼"}
              </span>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>{empty}</td></tr>
          ) : (
            <>
              {rows.slice(0, limit).map((r, i) => (
                <tr key={rowKey(r, i)}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.num ? "n" : undefined}>
                      {c.render ? c.render(r) : (() => { const v = c.get(r); return typeof v === "number" ? fmt(v) : (v ?? "–"); })()}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length > limit && (
                <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 10 }}>
                  …แสดง {fmt(limit)} รายการแรกจากทั้งหมด {fmt(rows.length)} รายการ · ใช้ตัวกรองเพื่อดูรายการอื่น
                </td></tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** สีตามอัตรากำไร — ตรงกับตารางใน mockup (เขียว ≥15 · เหลือง 0–15 · แดง < 0) */
export const marginTone = (m: number | null): string =>
  m == null ? "var(--ink-faint)" : m >= 15 ? "var(--green)" : m >= 0 ? "var(--orange-dark)" : "var(--red)";

/** ป้ายเส้นทางแบบมีลูกศร — ให้ตรงกับที่แดชบอร์ดเดิมใช้ */
export const routeArrow = (t: { o: string; de: string }): string =>
  t.o && t.de ? `${t.o}→${t.de}` : t.o || t.de || "(ไม่ระบุ)";
