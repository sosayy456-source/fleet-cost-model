/**
 * ตัวกรองรายคอลัมน์ของตาราง Manager Dashboard (สเปก: "Filter แต่ละคอลัมน์") — วาดเป็นแถวใต้หัวตารางผ่าน
 * SortTable({ filterRow }) · สามแบบ: select = ค่าที่มีในคอลัมน์ (หรือชุดที่กำหนดเอง) · text = มีคำนี้ · min = ตัวเลข ≥ ค่านี้
 * กรองก่อนเรียง (ผู้เรียกส่งผลเข้า useSort) · คอลัมน์ที่ไม่ได้กำหนดไว้ = ไม่มีช่องกรอง
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { duniq } from "../dash-costrev/common";
import type { Col } from "../dash-costrev/common";

export type ColFilterDef<T> =
  | { kind: "select"; get: (r: T) => string; opts?: { v: string; label: string }[]; all?: string }
  | { kind: "text"; get: (r: T) => string; placeholder?: string }
  | { kind: "min"; get: (r: T) => number };

export function useColFilters<T>(rows: T[], defs: Record<string, ColFilterDef<T>>) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const filtered = useMemo(() => rows.filter((r) => Object.entries(vals).every(([k, v]) => {
    const d = defs[k];
    if (!d || v === "") return true;
    if (d.kind === "select") return d.get(r) === v;
    if (d.kind === "text") return d.get(r).toLowerCase().includes(v.trim().toLowerCase());
    const n = Number(v);
    return !Number.isFinite(n) || d.get(r) >= n;
    // defs เป็น object literal ใหม่ทุก render — กรองใหม่เมื่อข้อมูล/ค่าที่เลือกเปลี่ยนก็พอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [rows, vals]);

  /** ตัวเลือกของช่อง select = ค่าที่มีในข้อมูลก่อนกรอง */
  const optsOf = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const [k, d] of Object.entries(defs)) if (d.kind === "select" && !d.opts) m[k] = duniq(rows.map(d.get));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filterRow = (c: Col<T>): ReactNode => {
    const d = defs[c.key];
    if (!d) return null;
    const v = vals[c.key] ?? "";
    if (d.kind === "select") {
      return (
        <select className="cf" value={v} onChange={(e) => set(c.key, e.target.value)} aria-label={`กรอง${c.label}`}>
          <option value="">{d.all ?? "ทั้งหมด"}</option>
          {(d.opts ?? (optsOf[c.key] ?? []).map((x) => ({ v: x, label: x }))).map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input className="cf" value={v} onChange={(e) => set(c.key, e.target.value)} aria-label={`กรอง${c.label}`}
        type={d.kind === "min" ? "number" : "text"}
        placeholder={d.kind === "min" ? "≥" : d.placeholder ?? "ค้นหา"} />
    );
  };

  const active = Object.values(vals).some((v) => v !== "");
  return { filtered, filterRow, active, clear: () => setVals({}) };
}
