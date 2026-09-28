/**
 * Cost & Depreciation Coverage Index — รายการ = **คัน × เดือน** (เจ้าของงานเลือก 28 ก.ย. 2569 · เดิมรายคันในแต่ละใบ
 * ซึ่งทำให้ 12 เดือนมี "คัน" 3,388 รายการทั้งที่รถมี 899 คัน) · ทั้งชุดอ้างอิงและช่วงที่ประเมินใช้หน่วยเดียวกัน
 *
 *   Cost per Ton-km = Σต้นทุน ÷ Σตัน-กม. ของคันนั้นในเดือนนั้น (ตามสูตร "ต้นทุนขนส่งรวม ÷ Ton-km รวม")
 *                     นับเฉพาะเที่ยวที่มีตัน-กม. และต้นทุน > 0 (กติกาเดียวกับ VRow.perTkm)
 *   Depreciation Coverage = ΣContribution Margin ÷ Σค่าเสื่อม ของคันนั้นในเดือนนั้น · รถบริษัทที่มีค่าเสื่อม (กติกาเดียวกับ depreciation())
 */
import type { VRow } from "../detail3/calc";

const key = (r: VRow) => `${r.pl}|${r.d.slice(0, 7)}`;

export function tkmByVehicleMonth(rows: VRow[]): number[] {
  const m = new Map<string, { cost: number; tkm: number }>();
  for (const r of rows) {
    if (!(r.tkm > 0 && r.cost > 0)) continue;
    const a = m.get(key(r)) ?? { cost: 0, tkm: 0 };
    a.cost += r.cost; a.tkm += r.tkm;
    m.set(key(r), a);
  }
  return [...m.values()].map((a) => a.cost / a.tkm);
}

export function coverageByVehicleMonth(rows: VRow[]): number[] {
  const m = new Map<string, { cm: number; dep: number }>();
  for (const r of rows) {
    if (r.side !== "comp" || !(r.dep > 0)) continue;
    const a = m.get(key(r)) ?? { cm: 0, dep: 0 };
    a.cm += r.rev - (r.cost - r.dep); a.dep += r.dep;
    m.set(key(r), a);
  }
  return [...m.values()].map((a) => a.cm / a.dep);
}
