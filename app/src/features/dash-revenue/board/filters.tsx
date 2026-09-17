/**
 * แถบตัวกรองของ Dashboard รายได้ — ตามแถบ Period/Customer/Route/Vehicle/Product/Payment Status
 * ในสเปกที่เจ้าของงานส่งมา (17 ก.ย. 2569)
 *
 * ★ กรองได้ 4 จาก 6 ช่องที่สเปกขอ และนี่คือข้อจำกัดของข้อมูล ไม่ใช่ของที่ยังไม่ได้ทำ
 *     ✔ Period          = month          ใน cube
 *     ✔ Route           = route          ใน cube
 *     ✔ Product         = ประเภทสินค้า    ใน cube
 *     ✔ Payment Status  = สถานะการชำระเงิน ใน cube
 *     ✗ Customer   ข้อมูลจริงมีลูกค้า 44,543 ราย ใส่เป็นมิติใน cube ไม่ได้ ก้อนจะระเบิด
 *     ✗ Vehicle    ไฟล์บิลไม่มีคอลัมน์ชนิดรถเลย ต้องใช้ไฟล์ต้นทุนรายเที่ยวซึ่งเป็นคนละแท็บ
 *   แถมช่อง "วิธีชำระเงิน" ให้ด้วยเพราะมีอยู่ใน cube แล้วและหน้าจอมีแท็บของมันอยู่
 *
 * ★ ความเป๊ะของตัวเลข — กติกาเดียวกับที่เขียนไว้ใน etl/src/cube.py
 *     ไม่ได้กรอง  อ่าน overview.json ที่คำนวณจากแถวดิบ ตัวเลขเป๊ะทุกช่อง
 *     กรองแล้ว   คำนวณใหม่จาก cube — revenue/lines เป๊ะ (เป็น sum/count)
 *                แต่ bills/trips เป็น nunique บวกข้ามเซลล์แล้ว "นับเกิน" เป็นขอบบน
 *                ทุกที่ที่โชว์สองค่านี้ตอนกรองต้องติดป้ายว่าเป็นค่าประมาณ
 */
import { useMemo, useState } from "react";
import { ListFF, ResetBtn } from "../../dash-fleet/parts";
import { monthLabel } from "../../../lib/data/useDataset";
import type { CubeRow, Dataset } from "../../../lib/data/useDataset";

export interface RevFilter {
  month: string;
  route: string;
  product: string;
  payStatus: string;
  payType: string;
}

export const REV_F0: RevFilter = { month: "", route: "", product: "", payStatus: "", payType: "" };

const DIM = {
  route: "route",
  product: "ประเภทสินค้า",
  payStatus: "สถานะการชำระเงิน",
  payType: "ประเภทการชำระเงิน",
} as const;

export const isFiltered = (f: RevFilter): boolean =>
  Object.values(f).some((v) => v !== "");

/** ยอดรวมของแถวที่ผ่านตัวกรอง — revenue/lines เป๊ะ · bills/trips เป็นขอบบน */
export interface CubeTotals {
  revenue: number;
  lines: number;
  bills: number;
  trips: number;
  rows: number;
}

export function passFilter(r: CubeRow, f: RevFilter): boolean {
  if (f.month && r.month !== f.month) return false;
  if (f.route && String(r[DIM.route] ?? "") !== f.route) return false;
  if (f.product && String(r[DIM.product] ?? "") !== f.product) return false;
  if (f.payStatus && String(r[DIM.payStatus] ?? "") !== f.payStatus) return false;
  if (f.payType && String(r[DIM.payType] ?? "") !== f.payType) return false;
  return true;
}

export function useCubeRows(data: Dataset, f: RevFilter): CubeRow[] {
  return useMemo(() => data.cube.filter((r) => passFilter(r, f)), [data.cube, f]);
}

export function totalsOf(rows: CubeRow[]): CubeTotals {
  const t: CubeTotals = { revenue: 0, lines: 0, bills: 0, trips: 0, rows: rows.length };
  for (const r of rows) {
    t.revenue += r.revenue;
    t.lines += r.lines;
    t.bills += r.bills;
    t.trips += Number(r.trips ?? 0);
  }
  return t;
}

/** รวมยอดตามมิติหนึ่ง แล้วเรียงจากมากไปน้อย — ใช้กับทุกกราฟที่ตอบตัวกรอง */
export function groupBy(rows: CubeRow[], dim: string): { name: string; revenue: number; lines: number; bills: number }[] {
  const acc = new Map<string, { revenue: number; lines: number; bills: number }>();
  for (const r of rows) {
    const k = String(r[dim] ?? "(ไม่ระบุ)");
    const cur = acc.get(k) ?? { revenue: 0, lines: 0, bills: 0 };
    cur.revenue += r.revenue;
    cur.lines += r.lines;
    cur.bills += r.bills;
    acc.set(k, cur);
  }
  return [...acc.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function useRevFilter(): [RevFilter, (k: keyof RevFilter) => (v: string) => void, () => void] {
  const [f, setF] = useState<RevFilter>(REV_F0);
  const set = (k: keyof RevFilter) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  return [f, set, () => setF(REV_F0)];
}

export function RevFilters({ data, f, set, reset }: {
  data: Dataset;
  f: RevFilter;
  set: (k: keyof RevFilter) => (v: string) => void;
  reset: () => void;
}) {
  const d = data.dimensions ?? {};
  const months = d.month ?? [];
  return (
    <div className="dz-filters">
      {/* เดือนแสดงเป็นชื่อไทย แต่ค่าที่เก็บยังเป็น YYYY-MM ตามที่ cube ใช้ */}
      <div className="ff">
        <label>ช่วงเวลา</label>
        <select value={f.month} onChange={(e) => set("month")(e.target.value)}>
          <option value="">ทุกเดือน</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <ListFF label="เส้นทาง" all="ทุกเส้นทาง" value={f.route}
        onChange={set("route")} opts={d[DIM.route] ?? []} />
      <ListFF label="ประเภทสินค้า" all="ทุกประเภท" value={f.product}
        onChange={set("product")} opts={d[DIM.product] ?? []} />
      <ListFF label="สถานะการชำระเงิน" all="ทุกสถานะ" value={f.payStatus}
        onChange={set("payStatus")} opts={d[DIM.payStatus] ?? []} />
      <ListFF label="วิธีชำระเงิน" all="ทุกวิธี" value={f.payType}
        onChange={set("payType")} opts={d[DIM.payType] ?? []} />
      <ResetBtn onClick={reset} />
    </div>
  );
}
