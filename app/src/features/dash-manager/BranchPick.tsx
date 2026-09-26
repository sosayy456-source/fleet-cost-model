/**
 * ช่องเลือกสาขาในหน้าต่างกลางหน้า Manager Dashboard
 * รายชื่อสาขา = สาขาที่มีในไฟล์ต้นทุน ∪ ไฟล์ลูกหนี้ (สองแท็บของ Manager Dashboard ใช้สองไฟล์นี้) · ไม่รวมแถวที่ไม่ระบุสาขา
 * โหลดไฟล์ผ่านตัวโหลดเดียวกับหน้า Dashboard (แคชไว้) เข้าหน้าแล้วจึงไม่โหลดซ้ำ
 */
import { useEffect, useMemo, useRef } from "react";
import { useCostRev } from "../../lib/data/useCostRev";
import { useDebtors } from "../../lib/data/useDebtors";

export default function BranchPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dropdown = useRef<HTMLDetailsElement>(null);
  const cr = useCostRev();
  const debt = useDebtors();
  const list = useMemo(() => {
    const s = new Set<string>();
    for (const t of cr.data?.trips ?? []) if (t.br) s.add(t.br);
    for (const r of debt.data?.rows ?? []) if (r.br) s.add(r.br);
    return [...s].sort((a, b) => a.localeCompare(b, "th"));
  }, [cr.data, debt.data]);
  const loading = !list.length && (cr.loading || debt.loading);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (dropdown.current && !dropdown.current.contains(e.target as Node)) dropdown.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div className="rs-branch">
      <span>สาขาของคุณ</span>
      <details ref={dropdown} onKeyDown={(e) => {
        if (e.key === "Escape") { dropdown.current!.open = false; dropdown.current!.querySelector("summary")?.focus(); }
      }}>
        <summary onClick={(e) => { if (loading || !list.length) e.preventDefault(); }}>
          {value || (loading ? "กำลังโหลดรายชื่อสาขา…" : "— เลือกสาขา —")}
        </summary>
        <div className="rs-branch-options">
          {list.map((b) => (
            <button key={b} type="button" aria-pressed={value === b}
              onClick={() => { onChange(b); dropdown.current!.open = false; dropdown.current!.querySelector("summary")?.focus(); }}>
              {b}
            </button>
          ))}
        </div>
      </details>
      <em>{!loading && !list.length ? "ยังไม่มีรายชื่อสาขาในชุดข้อมูล" : "แดชบอร์ดและรายการทั้งหมดจะแสดงเฉพาะข้อมูลของสาขานี้"}</em>
    </div>
  );
}
