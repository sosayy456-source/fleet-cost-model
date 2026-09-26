/**
 * ช่องเลือกสาขาในหน้าเลือกตำแหน่ง — ขึ้นเมื่อเลือก "ผู้จัดการ" (เจ้าของงานสั่ง 26 ก.ย. 2569 · Manager Dashboard)
 * รายชื่อสาขา = สาขาที่มีในไฟล์ต้นทุน ∪ ไฟล์ลูกหนี้ (สองแท็บของ Manager Dashboard ใช้สองไฟล์นี้) · ไม่รวมแถวที่ไม่ระบุสาขา
 * โหลดไฟล์ผ่านตัวโหลดเดียวกับหน้า Dashboard (แคชไว้) เข้าหน้าแล้วจึงไม่โหลดซ้ำ
 */
import { useMemo } from "react";
import { useCostRev } from "../../lib/data/useCostRev";
import { useDebtors } from "../../lib/data/useDebtors";

export default function BranchPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cr = useCostRev();
  const debt = useDebtors();
  const list = useMemo(() => {
    const s = new Set<string>();
    for (const t of cr.data?.trips ?? []) if (t.br) s.add(t.br);
    for (const r of debt.data?.rows ?? []) if (r.br) s.add(r.br);
    return [...s].sort((a, b) => a.localeCompare(b, "th"));
  }, [cr.data, debt.data]);
  const loading = !list.length && (cr.loading || debt.loading);

  return (
    <label className="rs-branch">
      <span>สาขาของคุณ</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        <option value="">{loading ? "กำลังโหลดรายชื่อสาขา…" : "— เลือกสาขา —"}</option>
        {list.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <em>Manager Dashboard จะแสดงเฉพาะข้อมูลของสาขานี้</em>
    </label>
  );
}
