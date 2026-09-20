/**
 * "6) ค่าใช้จ่ายอื่นๆ" — ผู้กรอกพิมพ์เองว่าเป็นค่าอะไร เท่าไหร่ และเป็นต้นทุนทางตรงหรือทางอ้อม
 * ตรรกะอยู่ใน lib/cost/otherCosts.ts — ที่นี่วาดอย่างเดียว
 */
import { emptyOtherCost, otherCostTotals } from "../../../lib/cost/otherCosts";
import { OTHER_COST_LABEL } from "../../../types/record";
import type { OtherCost, OtherCostKind } from "../../../types/record";

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OtherCostTable({ items, disabled, onChange }: {
  items: OtherCost[];
  disabled: boolean;
  onChange: (items: OtherCost[]) => void;
}) {
  const set = (id: string, patch: Partial<OtherCost>) =>
    onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const t = otherCostTotals(items);

  return (
    <div className="oc-wrap">
      {items.map((c) => (
        <div key={c.id} className="oc-row">
          <input aria-label="ค่าใช้จ่ายอะไร" value={c.label} disabled={disabled}
            placeholder="ค่าใช้จ่ายอะไร เช่น ค่าปรับ, ค่าเช่าอุปกรณ์"
            onChange={(e) => set(c.id, { label: e.target.value })} />
          <select aria-label="ประเภทต้นทุน" value={c.kind} disabled={disabled}
            onChange={(e) => set(c.id, { kind: e.target.value as OtherCostKind })}>
            {(Object.keys(OTHER_COST_LABEL) as OtherCostKind[]).map((k) =>
              <option key={k} value={k}>{OTHER_COST_LABEL[k]}</option>)}
          </select>
          <div className="input-suffix">
            <input aria-label="จำนวนเงิน" type="number" min={0} placeholder="0" disabled={disabled}
              value={c.amount || ""}
              onChange={(e) => set(c.id, { amount: parseFloat(e.target.value) || 0 })} />
            <span className="unit">บาท</span>
          </div>
          <button type="button" className="fuel-x" disabled={disabled} title="ลบรายการนี้"
            onClick={() => onChange(items.filter((x) => x.id !== c.id))}>✕</button>
        </div>
      ))}
      <div className="fuel-foot">
        <button type="button" className="btn-add" disabled={disabled}
          onClick={() => onChange([...items, emptyOtherCost()])}>+ เพิ่มรายการ</button>
        <span className="fuel-hint">
          {items.length
            ? <>ทางตรง <b>{baht(t.direct)}</b> · ทางอ้อม <b>{baht(t.indirect)}</b> · รวม <b>{baht(t.total)}</b> บาท (นับเป็นต้นทุนปกติ)</>
            : "ยังไม่มีรายการ — กด “เพิ่มรายการ” ถ้ามีค่าใช้จ่ายที่ไม่อยู่ในหมวดด้านบน"}
        </span>
      </div>
    </div>
  );
}
