/**
 * ใบที่บันทึกใหม่ในโมเดล (TripRecord) → รูปข้อมูลชุดเดียวกับไฟล์ที่ ETL แปลง — ตัวกรอง "แหล่งข้อมูล" ของ
 * Executive / Overall Dashboard (เจ้าของงานสั่ง 1 ต.ค. 2569 · ทั้งหมด / ข้อมูลเก่า / ข้อมูลใหม่)
 *
 *   ข้อมูลเก่า = ไฟล์ Excel ของบริษัทที่ ETL แปลง · ข้อมูลใหม่ = ใบรายการที่ฝ่ายจัดรถ/บัญชีบันทึกผ่านเว็บ (Google Sheet)
 *   ★ เลขที่ใบซ้ำกับไฟล์ = ใช้ไฟล์ (กติกาเดียวกับ Manager Dashboard · recordSrc ใน lib/manager/manager.ts)
 *   ต้นทุน: ฝ่ายบัญชีกรอกแล้ว = ต้นทุนจริง (normal + waste) · ยังไม่กรอก = ต้นทุนพยากรณ์ (forecastFor · เส้นทาง × ชนิดรถ)
 *   ลูกค้า = ผู้จ่ายเงิน (สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ) กติกาเดียวกับ ETL · บิลเคลียร์ไม่นับเป็นลูกค้า/ลูกหนี้
 *   น้ำหนัก/ปริมาตรรายบิลอยู่ในบิลที่ CS กรอก (PendingBill) — บิลในใบไม่ได้เก็บ จึงจับคู่ด้วยเลขที่บิล (recordAllocItems)
 */
import type { Trip } from "./useCostRev";
import { idleOf, recovOf, type LfTrip } from "./useLoadFactor";
import type { AllocCustMonth, AllocCustomer, AllocBill } from "./useAlloc";
import type { DebtorRow } from "./useDebtors";
import type { Bill, TripRecord } from "../../types/record";
import type { PendingBill } from "../../types/bill";
import { roleDone } from "../record/roles";
import { forecastFor, recordParts, type CostParts, type ForecastTable } from "../forecast/forecast";
import { distanceFor } from "../refdata";
import { allocateTrip } from "../alloc/tripAlloc";
import { recordAllocItems, recordCapacity } from "../alloc/recordAlloc";
import { addDaysISO, daysBetween } from "../record/date";

/** แหล่งข้อมูลที่ผู้ใช้เลือก */
export type DataSource = "all" | "old" | "new";

const CLEAR = "บิลเคลียร์";

/** ผู้จ่ายเงินของบิล — สด/เชื่อต้นทาง → ผู้ส่ง · ปลายทาง → ผู้รับ (ไม่ระบุ = ผู้ส่ง) */
export function payerOf(b: Pick<Bill, "payType" | "sender" | "receiver">): { code: string; side: "ผู้ส่ง" | "ผู้รับ" } {
  return String(b.payType ?? "").includes("ปลายทาง")
    ? { code: String(b.receiver ?? "").trim(), side: "ผู้รับ" }
    : { code: String(b.sender ?? "").trim(), side: "ผู้ส่ง" };
}

/** ใบที่นับเป็น "ข้อมูลใหม่" — มีเลขที่ใบ + วันที่ และไม่มีในไฟล์ */
export function freshRecords(records: TripRecord[], fileIds: ReadonlySet<string>): TripRecord[] {
  return records.filter((r) => {
    const id = String(r.docNo ?? "").trim();
    return !!id && !!(r.releaseDate || r.date) && !fileIds.has(id);
  });
}

/** ต้นทุนของใบ — จริงถ้าฝ่ายบัญชีกรอกแล้ว ไม่งั้นพยากรณ์ · est = ใช้ต้นทุนพยากรณ์ */
export function recordCost(r: TripRecord, fc: ForecastTable | null): { cost: number; parts: CostParts; est: boolean } {
  if (roleDone(r, "account") || !fc) {
    return { cost: (Number(r.normal) || 0) + (Number(r.waste) || 0), parts: recordParts(r), est: false };
  }
  const f = forecastFor(fc, r.origin, r.dest, r.vehicle);
  return { cost: f.cost, parts: f.parts, est: true };
}

/** ใบที่บันทึกใหม่ → Trip (รูปเดียวกับ costrev/trips.json) */
export function recordTrip(r: TripRecord, fc: ForecastTable | null): Trip {
  const d = r.releaseDate || r.date;
  const bills = r.bills ?? [];
  const rev = Number(r.revenue) || 0;
  const { cost, parts } = recordCost(r, fc);
  const empty = !!r.emptyLeg || (!bills.length && rev === 0);
  let clrAmt = 0, clrN = 0;
  const serviceRevenue: Record<string, number> = {};
  const cus = new Set<string>();
  for (const b of bills) {
    const total = Number(b.total) || 0;
    if (b.goodsType === CLEAR) { clrAmt += total; clrN++; continue; }
    if (b.goodsType) serviceRevenue[b.goodsType] = (serviceRevenue[b.goodsType] ?? 0) + total;
    const p = payerOf(b).code;
    if (p) cus.add(p);
  }
  // กลุ่มบริการของเที่ยว = กลุ่มที่รายได้มากสุด (ETL ใช้ประเภทสินค้าที่พบมากสุดในบิลของใบ)
  const sg = Object.entries(serviceRevenue).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const km = Number(r.dist) || distanceFor(r.origin, r.dest);
  const vs = [{ pl: String(r.plate ?? ""), vk: r.vehicle, ft: String(r.fleetType ?? ""), c: cost, d: parts.dep }];
  if (r.trailerPlate) vs.push({ pl: r.trailerPlate, vk: r.trailerVehicle ?? "", ft: r.trailerFleetType ?? "", c: 0, d: 0 });
  return {
    id: String(r.docNo).trim(), d, mo: d.slice(0, 7), y: Number(d.slice(0, 4)), br: r.branch ?? "",
    t: "ใหม่", ft: String(r.fleetType ?? ""), vk: r.vehicle, pl: String(r.plate ?? ""),
    o: r.origin, de: r.dest, rt: `${r.origin}-${r.dest}`, dir: "",
    km: km || null, rev, cost, profit: rev - cost, empty,
    clear: clrN > 0, clrAmt, clrN,
    // m = จับคู่บิลได้ — ใบใหม่มีบิลในตัวเสมอ (เที่ยวเปล่าเข้าชุดกำไรผ่าน empty)
    m: !empty && bills.length > 0,
    bn: bills.length, cus: [...cus],
    wt: (Number(r.loadActual) || 0) / 1000,
    waste: parts.waste, fuel: parts.fuel, allow: parts.allow, fee: parts.fee, repair: parts.repair, dep: parts.dep, rent: parts.rent,
    f_cash: 0, f_down: 0, f_up: 0, f_pickup: 0, f_call: 0, a_drv: 0, a_spare: 0, a_off: 0,
    sg, serviceRevenue, vs,
    fe_tarp: 0, fe_police: 0, fe_insure: 0, fe_cont: 0, fe_port: 0, fe_doc: 0, fe_toll: 0,
  };
}

/**
 * ใบใหม่ → แถว Load Factor (รูปเดียวกับ loadfactor/trips.json) — LF = น้ำหนักบรรทุก ÷ ความจุ (กก.) ที่หน้าจัดรถบันทึก
 * (ใบไม่ได้เก็บปริมาตร จึงเป็นด้านน้ำหนักอย่างเดียว — เหมือน Manager Dashboard) · เที่ยวเปล่า = 0 · ไม่มีความจุ = ไม่นับ
 * เป้าของกลุ่ม = เป้าเฉลี่ยของชนิดรถเดียวกันในไฟล์ LF (ไม่มี = เป้าเฉลี่ยทั้งไฟล์)
 */
export function recordLfTrips(trips: Trip[], records: TripRecord[], fileLf: LfTrip[]): LfTrip[] {
  const tg = new Map<string, { s: number; n: number }>();
  let all = 0, allN = 0;
  for (const t of fileLf) {
    const a = tg.get(t.vk) ?? { s: 0, n: 0 };
    a.s += t.tg; a.n++; tg.set(t.vk, a);
    all += t.tg; allN++;
  }
  const byId = new Map(records.map((r) => [String(r.docNo).trim(), r]));
  const out: LfTrip[] = [];
  for (const t of trips) {
    const r = byId.get(t.id);
    if (!r) continue;
    const cap = Number(r.capacity) || 0, load = Number(r.loadActual) || 0;
    if (!t.empty && !(cap > 0)) continue;
    const g = tg.get(t.vk);
    const lf = t.empty ? 0 : load / cap;
    const target = g ? g.s / g.n : allN ? all / allN : 0.8;
    out.push({
      id: t.id, y: t.y, mo: t.mo, d: t.d, ft: t.ft, pl: t.pl, vk: t.vk, rt: t.rt, st: "ปกติ",
      lf, tg: target, bind: "น้ำหนัก",
      cost: t.cost, rev: t.rev, km: t.km, wt: t.wt ?? null, vc: t.fuel + t.allow + t.fee,
      // สูตรเดียวกับตอนโหลดไฟล์ LF (useLoadFactor.ts)
      idle: idleOf(t.cost, lf), recov: recovOf(t.cost, lf, target), profit: t.rev - t.cost,
    });
  }
  return out;
}

/** ลูกค้าในไฟล์ปันส่วน หาได้ทั้งรหัสเต็ม และเลขในรหัส CUS (CUS0000123 = n 123) */
export function customerIndex(customers: AllocCustomer[]) {
  const byCode = new Map<string, number>(), byN = new Map<number, number>();
  customers.forEach((c, i) => { byCode.set(c.code, i); if (c.n) byN.set(c.n, i); });
  return (code: string): number | undefined => {
    const hit = byCode.get(code);
    if (hit != null) return hit;
    const m = /^CUS(\d{7})$/.exec(code);
    return m ? byN.get(Number(m[1])) : undefined;
  };
}

export interface RecordAlloc {
  /** ลูกค้าที่ไม่มีในไฟล์ — ต่อท้ายตาราง customers ดัชนีเริ่มที่ base */
  added: AllocCustomer[];
  /** ลูกค้า × วัน ของใบใหม่ (มี d) — รวมเข้า custMonths ได้ตรง ๆ */
  months: (AllocCustMonth & { d: string })[];
  /** บิลรายใบของใบใหม่ แยกตามลูกค้า (ป็อบอัพรายบิลของ Customer Performance) */
  bills: Map<number, AllocBill[]>;
}

/**
 * ปันต้นทุนของใบใหม่เข้าบิลด้วยสูตรเดียวกับ ETL (allocateTrip) แล้วยุบเป็นลูกค้า × วัน
 * ความจุ/CF จากรถในใบ · ปันไม่ได้ (ไม่มีความจุ/บิล) = แบ่งตามรายได้ · บิลเคลียร์และบิลที่ไม่มีผู้จ่ายไม่เข้าลูกค้า
 */
export function recordAlloc(records: TripRecord[], trips: Trip[], pending: PendingBill[], customers: AllocCustomer[]): RecordAlloc {
  const find = customerIndex(customers);
  const added: AllocCustomer[] = [];
  const addedIdx = new Map<string, number>();
  const ciOf = (code: string, side: "ผู้ส่ง" | "ผู้รับ"): number => {
    const hit = find(code) ?? addedIdx.get(code);
    if (hit != null) return hit;
    const ci = customers.length + added.length;
    const n = /^CUS(\d{7})$/.exec(code);
    added.push({ side, code, n: n ? Number(n[1]) : 0, bills: 0, revenue: 0, cost: 0, profit: 0, lossBills: 0, margin: null });
    addedIdx.set(code, ci);
    return ci;
  };
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const acc = new Map<string, AllocCustMonth & { d: string }>();
  const bills = new Map<number, AllocBill[]>();
  for (const r of records) {
    const t = tripById.get(String(r.docNo).trim());
    if (!t || !r.bills?.length) continue;
    const { items } = recordAllocItems(r, pending);
    const res = allocateTrip(items, t.cost, recordCapacity(r).cf);
    const revAll = r.bills.reduce((s, b) => s + (Number(b.total) || 0), 0);
    r.bills.forEach((b, i) => {
      if (b.goodsType === CLEAR) return;
      const p = payerOf(b);
      if (!p.code) return;
      const revenue = Number(b.total) || 0;
      const cost = res.error ? (revAll ? t.cost * revenue / revAll : t.cost / r.bills.length) : res.rows[i]?.cost ?? 0;
      const ci = ciOf(p.code, p.side);
      const k = `${ci}|${t.d}`;
      const a = acc.get(k) ?? { ci, mo: t.mo, d: t.d, bills: 0, revenue: 0, cost: 0, profit: 0, lossBills: 0,
        flagRev: 0, fNoSize: 0, fBig: 0, fTiny: 0 };
      a.bills++; a.revenue += revenue; a.cost += cost; a.profit += revenue - cost;
      if (revenue - cost < 0) a.lossBills++;
      acc.set(k, a);
      const list = bills.get(ci) ?? [];
      const row = res.rows[i];
      list.push({ ci, bill: b.no, date: t.d, doc: t.id, route: `${b.origin || r.origin}-${b.dest || r.dest}`, revenue, cost,
        weight: row ? row.weightKg : null, cbm: row ? row.volumeM3 : null, km: row ? row.dist : null, cf: row ? row.cf : null,
        eqKg: row ? row.eqKg : null, metric: row ? row.metric : null, share: row ? row.share : null,
        byRevenue: row?.byRevenue ? cost : 0 } as AllocBill);
      bills.set(ci, list);
    });
  }
  return { added, months: [...acc.values()], bills };
}

/** ค่าที่พบบ่อยสุด (เท่ากัน = ค่าน้อยกว่า) · ว่าง = null */
function modeOf(xs: number[]): number | null {
  const n = new Map<number, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  let best: number | null = null, bc = 0;
  for (const [x, c] of n) if (c > bc || (c === bc && best != null && x < best)) { best = x; bc = c; }
  return best;
}

/**
 * บิลของใบใหม่ → แถวลูกหนี้ (รูปเดียวกับ debtors/rows) — วันวางบิล = วันที่ของใบ · ปิด = วันที่ชำระที่บันทึกในหน้ารายการลูกหนี้
 * เงินสด (สด*) ไม่มีวันที่ชำระ = ปิดวันเดียวกับวันวางบิล · บิลเคลียร์ไม่ใช่ลูกหนี้
 * เครดิต (วัน) = ช่องเครดิตที่ CS กรอก (term) · ไม่มี = เครดิตที่พบบ่อยสุดของลูกค้ารายนั้นในไฟล์ → ของทั้งไฟล์ → 30
 */
export function recordDebtors(records: TripRecord[], fileRows: DebtorRow[], today: string): DebtorRow[] {
  const byCust = new Map<string, number[]>();
  for (const r of fileRows) { const l = byCust.get(r.cust) ?? []; l.push(r.term); byCust.set(r.cust, l); }
  const fallAll = modeOf(fileRows.map((r) => r.term)) ?? 30;
  const termOf = (b: Bill, cust: string): number => {
    const own = Number(b.term);
    if (Number.isFinite(own) && own >= 0 && b.term != null && String(b.term) !== "") return own;
    return modeOf(byCust.get(cust) ?? []) ?? fallAll;
  };
  const out: DebtorRow[] = [];
  for (const r of records) {
    const issue = r.date || r.releaseDate;
    if (!issue) continue;
    for (const b of r.bills ?? []) {
      if (b.goodsType === CLEAR) continue;
      const cust = payerOf(b).code;
      if (!cust) continue;
      const cash = String(b.payType ?? "").startsWith("สด");
      const term = cash ? 0 : termOf(b, cust);
      const due = addDaysISO(issue, term);
      const close = b.paid && b.payDate ? b.payDate : cash ? issue : null;
      out.push({
        doc: b.no || `${r.docNo}-${out.length}`, cust, br: r.branch ?? "", term,
        issue, mo: issue.slice(0, 7), y: Number(issue.slice(0, 4)), due, close,
        amount: Number(b.total) || 0,
        days: close ? daysBetween(issue, close) : null,
        over: close ? null : daysBetween(due, today),
      });
    }
  }
  return out;
}
