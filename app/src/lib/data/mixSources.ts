/**
 * ผสม "ข้อมูลใหม่" (ใบที่บันทึกในโมเดล) เข้าชุดข้อมูลไฟล์ตามตัวกรองแหล่งข้อมูล — hook ข้อมูลทั้ง 4 ชุดเรียกตอนท้าย
 *   old = ไฟล์ล้วน (เหมือนก่อนมีตัวกรอง) · new = ใบใหม่ล้วน · all = ไฟล์ + ใบใหม่ (เลขซ้ำตัดไปแล้วใน Provider)
 *   ไม่มี Provider (ctx = null) = คืนข้อมูลไฟล์ตัวเดิม — หน้าอื่นไม่กระทบ
 * ★ คืนออบเจ็กต์เดิมเมื่อไม่ต้องผสม ไม่งั้น identity เปลี่ยนแล้วทุกส่วนคิดใหม่ทั้งหน้า
 */
import type { CostRevData, SvcAlloc, Trip } from "./useCostRev";
import type { LfData } from "./useLoadFactor";
import type { AllocBill, AllocData } from "./useAlloc";
import type { DebtorData } from "./useDebtors";
import type { DataSourceCtx } from "./dataSourceCtx";
import { recordAlloc, recordDebtors, recordLfTrips } from "./recordSources";
import { todayISO } from "../record/date";

const active = (ctx: DataSourceCtx | null): ctx is DataSourceCtx & { trips: Trip[] } =>
  !!ctx && ctx.src !== "old" && !!ctx.trips;

/** กลุ่มบริการของใบใหม่ — ปันต้นทุนเข้ากลุ่มตามสัดส่วนรายได้ (รูปเดียวกับ svc.json) */
function svcOf(trips: Trip[]): SvcAlloc {
  const s: SvcAlloc = { id: [], g: [], n: [], rev: [], cost: [] };
  for (const t of trips) {
    const sr = t.serviceRevenue ?? {};
    const tot = Object.values(sr).reduce((a, v) => a + v, 0);
    for (const [g, rev] of Object.entries(sr)) {
      s.id.push(t.id); s.g.push(g); s.n.push(1); s.rev.push(rev); s.cost.push(tot ? t.cost * rev / tot : 0);
    }
  }
  return s;
}

const catSvc = (a: SvcAlloc | null, b: SvcAlloc): SvcAlloc => (a ? {
  id: [...a.id, ...b.id], g: [...a.g, ...b.g], n: [...a.n, ...b.n], rev: [...a.rev, ...b.rev], cost: [...a.cost, ...b.cost],
} : b);

export function mixCostRev(data: CostRevData | null, ctx: DataSourceCtx | null): CostRevData | null {
  if (!data || !active(ctx)) return data;
  const fresh = ctx.trips;
  if (ctx.src === "new") return { ...data, trips: fresh, svc: svcOf(fresh) };
  if (!fresh.length) return data;
  return { ...data, trips: [...data.trips, ...fresh], svc: catSvc(data.svc, svcOf(fresh)) };
}

export function mixLoadFactor(data: LfData | null, ctx: DataSourceCtx | null): LfData | null {
  if (!data || !active(ctx)) return data;
  const fresh = recordLfTrips(ctx.trips, ctx.records, data.trips);
  if (ctx.src === "new") return { ...data, trips: fresh };
  return fresh.length ? { ...data, trips: [...data.trips, ...fresh] } : data;
}

/**
 * ลูกค้าใหม่ต่อท้ายตาราง customers (ดัชนีของไฟล์ไม่ขยับ) · ลูกค้า × วันของใบใหม่ต่อท้าย custMonths (แถวมี d)
 * Top 10 ของไฟล์ (top.json) ไม่รู้จักใบใหม่ → top = null + liveTop ให้หน้าจอจัดอันดับเองจากแถวที่ยุบแล้ว
 */
export function mixAlloc(data: AllocData | null, ctx: DataSourceCtx | null): AllocData | null {
  if (!data || !active(ctx)) return data;
  const ra = recordAlloc(ctx.records, ctx.trips, ctx.pending, data.customers);
  const customers = ra.added.length ? [...data.customers, ...ra.added] : data.customers;
  const custMonths = ctx.src === "new" ? ra.months : [...(data.custMonths ?? []), ...ra.months];
  return { ...data, customers, custMonths, top: null, liveTop: true, extraBills: ra.bills,
    onlyNew: ctx.src === "new", fileCustomers: data.customers.length };
}

/** บิลรายใบของลูกค้า — ใบใหม่อยู่ในหน่วยความจำ ไม่ต้องโหลดไฟล์ */
export const extraBillsOf = (data: AllocData, ci: number): AllocBill[] => data.extraBills?.get(ci) ?? [];

/** ลูกหนี้ของใบใหม่ · มีใบใหม่ = วันที่ตั้งต้นของส่วน DSO เป็นวันนี้ (liveAsOf) ไม่งั้นบิลหลังวันที่ตั้งต้นเดิมไม่ขึ้น */
export function mixDebtors(data: DebtorData | null, ctx: DataSourceCtx | null): DebtorData | null {
  if (!data || !active(ctx)) return data;
  const today = todayISO();
  const fresh = recordDebtors(ctx.records, data.rows, today);
  const manifest = fresh.length ? { ...data.manifest, liveAsOf: today } : data.manifest;
  if (ctx.src === "new") return { manifest: { ...manifest, liveAsOf: today }, rows: fresh };
  return fresh.length ? { manifest, rows: [...data.rows, ...fresh] } : data;
}
