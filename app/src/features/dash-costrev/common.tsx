/**
 * ของใช้ร่วมของแดชบอร์ด Executive / รวม — ตัวกรอง ตัวช่วยรวมยอด ตารางเรียงได้
 *
 * แดชบอร์ดชุดนี้อ่านจาก trips.json ของ etl/build_costrev.py ไม่ได้ผ่าน recCost/computeCost
 * เพราะต้นทุนมาเป็นยอดสำเร็จรูปจากไฟล์บริษัท ไม่ใช่จากสูตรของโมเดล
 */
import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { fmtN } from "../../lib/chart/theme";
import { FF } from "../dash-fleet/parts";
import GrowBox from "../../lib/ui/GrowBox";
import { MONTHS, dayFrom, dayTo, daysIn, inDays, inMonths, withD1, withD2, withFrom, withTo, withYear } from "../../lib/filter/period";
import type { Period } from "../../lib/filter/period";
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
export function YearFF({ trips, value, onChange, isLocked, allLabel = "ทุกปี" }: {
  trips: { y: number }[]; value: string; onChange: (v: string) => void;
  /** ข้อความของตัวเลือกปีว่าง — ช่วงประเมิน PI ใช้ "เดือนล่าสุดของไฟล์" (ปีว่าง = ประเมินเดือนล่าสุด ไม่ใช่ทุกปี) */
  allLabel?: string;
  /** ปีที่เลือกไม่ได้ (ช่วงประเมินที่ Baseline ไม่ครบ — PeriodFF minStart) */
  isLocked?: (y: string) => boolean;
}) {
  const years = [...new Set(trips.map((t) => String(t.y)))].sort();
  return (
    <FF label="ปี" value={value} onChange={onChange}>
      <option value="">{allLabel}</option>
      {years.map((y) => <option key={y} value={y} disabled={isLocked?.(y)}>พ.ศ. {+y + 543}{isLocked?.(y) ? " (Baseline ไม่ครบ)" : ""}</option>)}
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

/**
 * ปี + ช่วงเดือน ตั้งแต่–ถึง — แบบเดียวกับแท็บ Damage Rate (เจ้าของงานสั่ง 24 ก.ย. 2569)
 * เดือนเลือกได้เมื่อเลือกปีแล้ว · ล้างปี = ช่วงเดือนกลับเป็นทั้งปี · "ถึงเดือน" มีเฉพาะเดือนที่ไม่ก่อนเดือนเริ่ม
 */
export function PeriodFF<T extends Period>({ trips, value, onChange, days, minStart, allLabel }: {
  trips: { y: number }[]; value: T; onChange: (p: T) => void;
  /** เลือกถึงรายวันได้ (ปี → เดือน → วัน · Executive Dashboard เจ้าของงานสั่ง 29 ก.ย. 2569) */
  days?: boolean;
  /**
   * วันแรกที่เริ่มช่วงได้ "YYYY-MM-DD" — ก่อนหน้านี้ Baseline 12 เดือนก่อนเดือนที่ประเมินไม่ครบ (lib/pi/baseline.ts)
   * ปี/เดือน/วันที่ทำให้วันเริ่มก่อนวันนี้เลือกไม่ได้ · เลือกปีแล้ววันเริ่มยังก่อน = ขยับวันเริ่มมาที่วันนี้ให้เอง
   */
  minStart?: string;
  /** ส่งต่อให้ YearFF */
  allLabel?: string;
}) {
  const lockY = minStart ? (y: string) => `${y}-12-31` < minStart : undefined;
  // วันเริ่มก่อน minStart → ขยับเดือน/วันเริ่มมาที่ minStart (เฉพาะปีเดียวกัน · ปีก่อนหน้าถูกล็อกไว้แล้ว)
  const clamp = (p: T): T => {
    if (!minStart || !p.year || p.year !== minStart.slice(0, 4)) return p;
    const start = `${p.year}-${p.from}-${dayFrom(p)}`;
    if (start >= minStart) return p;
    const mm = minStart.slice(5, 7), d = minStart.slice(8, 10);
    const moved = p.from < mm ? withFrom(p, mm) : p;
    return days ? withD1(moved, d) : moved;
  };
  const set = (p: T) => onChange(clamp(p));
  const lockM = (m: string) => !!minStart && `${value.year}-${m}-${String(daysIn(value.year, m)).padStart(2, "0")}` < minStart;
  const dayOpts = (mm: string) => Array.from({ length: daysIn(value.year, mm) }, (_, i) => String(i + 1).padStart(2, "0"));
  return <>
    <YearFF trips={trips} value={value.year} onChange={(y) => set(withYear(value, y))} isLocked={lockY} allLabel={allLabel} />
    <FF label="ตั้งแต่เดือน" value={value.from} disabled={!value.year} onChange={(m) => set(withFrom(value, m))}>
      {MONTHS.map((m) => <option key={m} value={m} disabled={lockM(m)}>{monthName(m)}</option>)}
    </FF>
    {days && (
      <FF label="วันที่" value={dayFrom(value)} disabled={!value.year} onChange={(d) => set(withD1(value, d))}>
        {dayOpts(value.from).map((d) => <option key={d} value={d}
          disabled={!!minStart && `${value.year}-${value.from}-${d}` < minStart}>{Number(d)}</option>)}
      </FF>
    )}
    <FF label="ถึงเดือน" value={value.to} disabled={!value.year} onChange={(m) => set(withTo(value, m))}>
      {MONTHS.filter((m) => m >= value.from).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
    </FF>
    {days && (
      <FF label="วันที่" value={dayTo(value)} disabled={!value.year} onChange={(d) => set(withD2(value, d))}>
        {dayOpts(value.to).filter((d) => value.from !== value.to || d >= dayFrom(value))
          .map((d) => <option key={d} value={d}>{Number(d)}</option>)}
      </FF>
    )}
  </>;
}

export function ListFF({ label, all, value, onChange, opts, labelOf }: {
  label: string; all: string; value: string; onChange: (v: string) => void; opts: string[];
  /** ข้อความที่แสดงของแต่ละตัวเลือก — ไม่ส่งก็ใช้ค่าตัวเลือกเอง */
  labelOf?: (o: string) => string;
}) {
  return (
    <FF label={label} value={value} onChange={onChange}>
      <option value="">{all}</option>
      {opts.map((o) => <option key={o} value={o}>{labelOf ? labelOf(o) : o}</option>)}
    </FF>
  );
}

/**
 * เงื่อนไขที่ทุกแท็บใช้ร่วม — เดือนใช้ 2 หลัก "01".."12" · ค่าว่าง = ไม่กรองมิตินั้น
 * เวลามีสองแบบ: `month` เดือนเดียว (MonthFF — แท็บกำไรรายเที่ยว · ต้นทุน) กับ `from`–`to` ช่วงเดือน (PeriodFF — แท็บอื่น)
 * แท็บหนึ่งใช้แบบเดียว อีกแบบคงค่าตั้งต้นไว้ (month "" · ช่วง 01–12) จึงไม่กรองซ้อนกัน
 */
export interface BaseFilter extends Period { month: string; o: string; de: string; ft: string; vk: string }
export const BASE_F0: BaseFilter = { year: "", month: "", from: "01", to: "12", o: "", de: "", ft: "", vk: "" };

/** เลือกตัวกรองอะไรไว้ไหม (เทียบกับค่าเริ่มต้นของแท็บนั้น) — ใช้ซ่อนปุ่ม "ล้างตัวกรอง" ตอนไม่มีอะไรให้ล้าง */
export const isFiltered = <T extends object>(f: T, f0: T): boolean =>
  (Object.keys(f0) as (keyof T)[]).some((k) => f[k] !== f0[k]);

export const passBase = (
  t: Trip, f: BaseFilter,
  /** ignoreVehicle = ไม่กรองประเภท/ชนิดรถที่ระดับใบ — แท็บกองรถกรองที่ระดับรถแต่ละคันแทน
   *  (ใบหนึ่งมีได้ถึง 3 ทะเบียนคนละชนิด ถ้ากรองจากคันที่ 1 หางจะหายทั้งที่เลือกชนิดของหาง) */
  opts: { ignoreYear?: boolean; ignoreMonth?: boolean; ignoreVehicle?: boolean } = {},
): boolean =>
  (opts.ignoreYear || !f.year || String(t.y) === f.year)
  && (opts.ignoreMonth || !f.month || t.mo.slice(5) === f.month)
  // ignoreYear ยังกรองช่วงเดือน — ชุดที่เทียบหลายปีต้องได้ช่วงเดือนเดียวกันทุกปี
  && (opts.ignoreMonth || inMonths(t.mo, f))
  // ช่วงวัน (ปี → เดือน → วัน · Executive Dashboard) — เทียบเดือน-วัน จึงใช้กับ ignoreYear ได้เหมือนช่วงเดือน
  && (opts.ignoreMonth || !f.year || inDays(t.d, f))
  && (!f.o || t.o === f.o)
  && (!f.de || t.de === f.de)
  && (opts.ignoreVehicle || ((!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk)));

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
  /** คอลัมน์แสดงสถานะอย่างเดียว ไม่มีการเรียง */
  sortable?: boolean;
}

/**
 * เรียงตารางได้ทุกคอลัมน์ — **กดหัวคอลัมน์วนสามจังหวะ** (เจ้าของงานสั่ง 22 ก.ย. 2569)
 *
 *   กดครั้งแรก  มากไปน้อย ▼  (ทุกคอลัมน์เริ่มทางนี้เสมอ ทั้งตัวเลขและข้อความ)
 *   กดซ้ำ       น้อยไปมาก ▲
 *   กดอีกครั้ง  ล้าง — กลับไปใช้การเรียงตั้งต้นของตารางนั้น
 *
 * `initial` อ่านครั้งเดียวผ่าน ref เพราะทุกหน้าส่งมาเป็น object literal ที่สร้างใหม่ทุก render
 * ถ้าอ้างตรง ๆ การเทียบว่า "กลับไปค่าเริ่มต้นแล้วหรือยัง" จะไม่มีวันจริง
 */
export function useSort<T>(rows: T[], cols: Col<T>[], initial: { key: string; dir: 1 | -1 }) {
  const base = useRef(initial);
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
  const toggle = (key: string) => setSort((s) =>
    s.key !== key ? { key, dir: -1 }
      : s.dir === -1 ? { key, dir: 1 }
        : base.current);
  /** ตอนนี้เรียงตามค่าตั้งต้นอยู่ไหม — ใช้บอกผู้ใช้ว่ากดอีกครั้งแล้วจะล้าง */
  const isDefault = sort.key === base.current.key && sort.dir === base.current.dir;
  return { sorted, sort, toggle, isDefault };
}

export function SortTable<T>({ rows, cols, sort, onSort, rowKey, empty, className, rowProps, maxHeight, filterRow }: {
  rows: T[]; cols: Col<T>[]; sort: { key: string; dir: 1 | -1 };
  onSort: (key: string) => void; rowKey: (r: T, i: number) => string; empty: string;
  /** คลาสเพิ่มให้ตัวตาราง — ใช้ตกแต่งเฉพาะหน้า */
  className?: string;
  /** props ของแต่ละแถว — ใช้ทำแถวที่กดได้ทั้งแถว (หน้า Demo) */
  rowProps?: (r: T, i: number) => React.HTMLAttributes<HTMLTableRowElement>;
  /** ความสูงสูงสุดของกล่องเลื่อน — ไม่ส่ง = ค่าตั้งต้นของ GrowBox (60vh) */
  maxHeight?: number | string;
  /**
   * แถวตัวกรองรายคอลัมน์ **เหนือ** หัวตาราง (Manager Dashboard · ย้ายขึ้นบน 27 ก.ย. 2569 เจ้าของงานสั่ง) — คืนช่องกรองของคอลัมน์นั้น ·
   * ไม่ส่ง = ไม่มีแถวนี้ · มีแถวนี้ = ติดบนทั้ง thead (สองแถว) ตอนเลื่อน ไม่ใช่รายช่อง ไม่งั้นแถวกรองทับชื่อคอลัมน์
   */
  filterRow?: (c: Col<T>) => ReactNode;
}) {
  return (
    <GrowBox rows={rows} maxHeight={maxHeight} render={(shown) => (
      <table className={"dz-tbl" + (className ? ` ${className}` : "")}>
        <thead className={filterRow ? "dz-sticky2" : undefined}>
        {filterRow && <tr className="dz-frow">{cols.map((c) => <th key={c.key}>{filterRow(c)}</th>)}</tr>}
        <tr>
          {cols.map((c) => (
            <th key={c.key} className={c.num ? "n" : undefined}
              onClick={c.sortable === false ? undefined : () => onSort(c.key)}
              style={{ cursor: c.sortable === false ? undefined : "pointer", userSelect: "none" }}
              title={c.sortable === false ? undefined : "กดเพื่อเรียงมากไปน้อย · กดซ้ำเป็นน้อยไปมาก · กดอีกครั้งเพื่อล้างกลับค่าเริ่มต้น"}>
              {c.label}
              {c.sortable !== false && <span style={{ marginLeft: 4, opacity: sort.key === c.key ? 1 : .3, fontSize: 11.5 }}>
                {sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "▲▼"}
              </span>}
            </th>
          ))}
        </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--ink-faint)", padding: 16 }}>{empty}</td></tr>
          ) : (
            shown.map((r, i) => (
              <tr key={rowKey(r, i)} {...(rowProps ? rowProps(r, i) : {})}>
                {cols.map((c) => (
                  <td key={c.key} className={c.num ? "n" : undefined}>
                    {c.render ? c.render(r) : (() => { const v = c.get(r); return typeof v === "number" ? fmt(v) : (v ?? "–"); })()}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    )} />
  );
}

/** สีตามอัตรากำไร — ตรงกับตารางใน mockup (เขียว ≥15 · เหลือง 0–15 · แดง < 0) */
export const marginTone = (m: number | null): string =>
  m == null ? "var(--ink-faint)" : m >= 15 ? "var(--green)" : m >= 0 ? "var(--orange-dark)" : "var(--red)";

/** ป้ายเส้นทางแบบมีลูกศร — ให้ตรงกับที่แดชบอร์ดเดิมใช้ */
export const routeArrow = (t: { o: string; de: string }): string =>
  t.o && t.de ? `${t.o}→${t.de}` : t.o || t.de || "(ไม่ระบุ)";

/**
 * การ์ดตัวเลขรอง + แถบสัดส่วน (ดีไซน์ 1A) — รูปเดียวกับ KC แต่แถบยาวตามค่าจริง (KC วาดแถบเต็มเสมอ)
 * ลำดับ: ป้าย → ตัวเลข → แถบ → คำอธิบาย · แถบใช้สี `bar` (ไม่ส่ง = สีเดียวกับจุด) บนรางสีเดียวกันจาง ๆ
 */
export function Meter({ l, v, s, dot, bar, tone, fill, onClick }: {
  l: string; v: string; s: string; dot: string; bar?: string;
  tone?: "good" | "warn" | "bad"; fill: number;
  /** การ์ดกดได้ (Demo: %เที่ยวที่ขาดทุน → ป็อบอัพรายการเที่ยว) — ไม่ส่ง = การ์ดธรรมดา */
  onClick?: () => void;
}) {
  const w = Math.max(0, Math.min(100, fill));
  const c = bar ?? dot;
  const press = onClick ? {
    role: "button", tabIndex: 0, onClick,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
  } : {};
  return (
    <div className={"dz-kc meter" + (tone ? ` t-${tone}` : "") + (onClick ? " clickable" : "")}
      style={{ "--dot": dot, "--bar": c } as CSSProperties} {...press}>
      <div className="l"><i className="d" />{l}</div>
      {/* key = ค่าเปลี่ยนแล้วได้กล่องใหม่ ท่า fade-down เล่นใหม่ (useNumFade) */}
      <div className="v" key={v} data-real={v}>{v}</div>
      <div className="kbar"><i style={{ width: `${w}%` }} /></div>
      <div className="s">{s}</div>
    </div>
  );
}
