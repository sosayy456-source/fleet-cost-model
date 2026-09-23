import type { Trip, TripVehicle } from "../data/useCostRev";
import { sideOf } from "./compare";

export const UNKNOWN_SERVICE = "ไม่ระบุ / ยังแบ่งกลุ่มไม่ได้";
export type FleetSlice = Pick<Trip, "id" | "mo" | "ft" | "vk" | "pl" | "rt" | "rev" | "cost" | "profit"> & {
  service: string;
};

/** ยอดหนึ่งก้อนที่จะแบ่ง — ตัวแบ่งเป็น "น้ำหนัก" ของส่วนนั้น (รายได้รายกลุ่ม หรือ ต้นทุนรายคัน) */
interface Part<T> { key: T; weight: number }

/**
 * แบ่งรายได้/ต้นทุนของใบเดียวตามน้ำหนักที่ให้มา คงยอดรวมถึงระดับสตางค์
 * ปัดยอดสะสมแล้วหาผลต่าง ป้องกันเศษหลายส่วนรวมกันเกินยอดและทำให้ส่วนท้ายติดลบ
 * คืน null เมื่อแบ่งไม่ได้ (ไม่มีส่วน ยอดรวมไม่เป็นบวก หรือมีน้ำหนักติดลบ) ให้ผู้เรียกตัดสินใจเอง
 */
function split<T>(rev: number, cost: number, parts: Part<T>[], order: (a: Part<T>, b: Part<T>) => number):
  { key: T; rev: number; cost: number }[] | null {
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  if (!parts.length || !Number.isFinite(total) || total <= 0 || parts.some((p) => !Number.isFinite(p.weight) || p.weight < 0)) return null;
  const revTotal = Math.round(rev * 100), costTotal = Math.round(cost * 100);
  let cumulative = 0, revUsed = 0, costUsed = 0;
  return [...parts].sort(order).map((p, i) => {
    const last = i === parts.length - 1;
    cumulative += p.weight;
    const nextRev = last ? revTotal : Math.round(revTotal * cumulative / total);
    const nextCost = last ? costTotal : Math.round(costTotal * cumulative / total);
    const r = nextRev - revUsed, c = nextCost - costUsed;
    revUsed = nextRev; costUsed = nextCost;
    return { key: p.key, rev: r / 100, cost: c / 100 };
  });
}

/**
 * แบ่งยอดของหนึ่งใบเป็น "รถ × กลุ่มบริการ"
 *
 *   ชั้นที่ 1 แบ่งตามรถในใบ (trip.vs) ด้วย**สัดส่วนต้นทุนของแต่ละคัน** — ไฟล์ต้นทุนรุ่น 22 ก.ย. 2569
 *            ปันต้นทุนมาให้แล้ว (ต้นทุนรถคันที่ 1/2/พ่วง) ส่วนรายได้มีก้อนเดียวทั้งใบ เจ้าของงานเคาะให้
 *            แบ่งตามสัดส่วนต้นทุนเช่นกัน → ทุกคันในใบได้อัตรากำไรเท่ากัน ยอดรวมทั้งใบไม่เปลี่ยน
 *   ชั้นที่ 2 แบ่งตามกลุ่มบริการ (trip.serviceRevenue) ด้วยสัดส่วนรายได้ของบิล เหมือนเดิม
 *
 * ไฟล์รุ่นเก่าไม่มี vs → ถือว่าทั้งใบเป็นของทะเบียนเดียว (pl/vk/ft ระดับใบ) ผลจึงเท่าของเดิมทุกบาท
 */
export function fleetSlices(trips: Trip[]): FleetSlice[] {
  return trips.flatMap((trip) => {
    const vehicles: TripVehicle[] = trip.vs?.length
      ? trip.vs
      : [{ pl: trip.pl, vk: trip.vk, ft: trip.ft, c: trip.cost }];
    const byVehicle = split(trip.rev, trip.cost, vehicles.map((v) => ({ key: v, weight: v.c })),
      // เรียงจากต้นทุนน้อยไปมาก เพื่อให้เศษสตางค์ตกที่คันที่ต้นทุนสูงสุด (เหมือนฝั่งกลุ่มบริการ)
      (a, b) => a.weight - b.weight || a.key.pl.localeCompare(b.key.pl, "th"))
      ?? [{ key: vehicles[0]!, rev: trip.rev, cost: trip.cost }];

    return byVehicle.flatMap(({ key: v, rev, cost }) => {
      const base = { id: trip.id, mo: trip.mo, ft: v.ft, vk: v.vk, pl: v.pl, rt: trip.rt };
      const amounts = Object.entries(trip.serviceRevenue ?? {});
      const byService = split(rev, cost, amounts.map(([service, amount]) => ({ key: service, weight: amount })),
        (a, b) => a.weight - b.weight || a.key.localeCompare(b.key, "th"));
      // ไม่เดาสัดส่วนเมื่อไม่มีบิล ยอดรวมเป็นศูนย์ หรือมีกลุ่มติดลบ
      if (!byService) return [{ ...base, service: UNKNOWN_SERVICE, rev, cost, profit: rev - cost }];
      return byService.map((s) => ({ ...base, service: s.key, rev: s.rev, cost: s.cost, profit: s.rev - s.cost }));
    });
  });
}

export interface FleetGroup {
  key: string; n: number; vehicles: number; rev: number; cost: number; profit: number;
  perTrip: number; perVehicle: number;
}

/** รวมยอดเงินทุกส่วน แต่เที่ยวและรถนับไม่ซ้ำ แม้หนึ่งเที่ยวมีหลายกลุ่มบริการ */
export function fleetGroups(rows: FleetSlice[], keyOf: (row: FleetSlice) => string): FleetGroup[] {
  const groups = new Map<string, { docs: Set<string>; plates: Set<string>; rev: number; cost: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? { docs: new Set<string>(), plates: new Set<string>(), rev: 0, cost: 0 };
    group.docs.add(row.id);
    if (row.pl) group.plates.add(row.pl);
    group.rev += Math.round(row.rev * 100);
    group.cost += Math.round(row.cost * 100);
    groups.set(key, group);
  }
  return [...groups].map(([key, g]) => {
    const profit = (g.rev - g.cost) / 100;
    return { key, n: g.docs.size, vehicles: g.plates.size, rev: g.rev / 100, cost: g.cost / 100, profit,
      perTrip: g.docs.size ? profit / g.docs.size : 0,
      perVehicle: g.plates.size ? profit / g.plates.size : 0 };
  });
}

export function fleetKpis(rows: FleetSlice[]) {
  const total = fleetGroups(rows, () => "ทั้งหมด")[0];
  const docs = fleetGroups(rows, (r) => r.id);
  const monthly = fleetGroups(rows.filter((r) => !!r.pl), (r) => JSON.stringify([r.pl, r.mo]));
  // เมื่อเลือกหลายเดือน ให้นับรถที่มีเดือนขาดทุนอย่างน้อยหนึ่งเดือน โดยรถหนึ่งคันนับครั้งเดียว
  const lossVehicles = new Set(monthly.filter((r) => r.profit < 0).map((r) => JSON.parse(r.key)[0] as string)).size;
  const n = total?.n ?? 0;
  const vehicles = total?.vehicles ?? 0;
  return { n, vehicles, turnover: vehicles ? n / vehicles : 0,
    profitPerVehicle: total?.perVehicle ?? 0, lossVehicles,
    lossPct: n ? docs.filter((r) => r.profit < 0).length / n * 100 : 0 };
}

/* ------------------------------------------------------------------------------------------------
 * ดีไซน์ "การใช้ประโยชน์ของกองรถ" (เจ้าของงานส่งภาพ 23 ก.ย. 2569) — แทนอันดับความคุ้มค่า/ชนิดรถ 10 อันดับเดิม
 *
 * ★ หน่วยนับของส่วนสัดส่วนคือ "เที่ยวของประเภท/ชนิดนั้น" = ใบไม่ซ้ำต่อคีย์ ใบที่มีหัวรถบริษัท + หางรถร่วม
 *   นับทั้งสองฝั่ง ผลรวมของทุกส่วนจึงเกินจำนวนใบได้ (ชุดตัวอย่างมีใบหลายคันราว 15%) — ร้อยละคิดจากผลรวมนั้น
 *   ให้แถบ/โดนัทครบ 100% เสมอ หน้าจอต้องบอกผู้ใช้
 * ------------------------------------------------------------------------------------------------ */

export interface Share { key: string; n: number; share: number }

/** นับใบไม่ซ้ำต่อคีย์ แล้วคิดร้อยละจากผลรวมของทุกคีย์ เรียงมากไปน้อย */
function shares(rows: FleetSlice[], keyOf: (row: FleetSlice) => string): Share[] {
  const docs = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = keyOf(row);
    const set = docs.get(key) ?? new Set<string>();
    set.add(row.id);
    docs.set(key, set);
  }
  const counted = [...docs].map(([key, set]) => ({ key, n: set.size }));
  const total = counted.reduce((sum, r) => sum + r.n, 0);
  return counted.map((r) => ({ ...r, share: total ? r.n / total * 100 : 0 }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, "th"));
}

const ftOf = (row: FleetSlice): string => row.ft || "ไม่ระบุประเภทรถ";
function bucket(rows: FleetSlice[], keyOf: (row: FleetSlice) => string): Map<string, FleetSlice[]> {
  const m = new Map<string, FleetSlice[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = m.get(key);
    if (list) list.push(row); else m.set(key, [row]);
  }
  return m;
}
const docCount = (rows: FleetSlice[]): number => new Set(rows.map((r) => r.id)).size;

/** สัดส่วนการใช้รถแต่ละประเภท (โดนัท) */
export function fleetTypeShare(rows: FleetSlice[]): Share[] {
  return shares(rows, ftOf);
}

/** สัดส่วนประเภทรถในแต่ละกลุ่มบริการ — เรียงกลุ่มที่มีเที่ยวน้อยไว้ซ้ายตามภาพ · กลุ่มที่แบ่งไม่ได้อยู่ท้ายเสมอ */
export function serviceFleetMix(rows: FleetSlice[]) {
  return [...bucket(rows, (r) => r.service)].map(([service, list]) => {
    const types = shares(list, ftOf);
    return { service, n: docCount(list), types, main: types[0]?.key ?? "" };
  }).sort((a, b) => Number(a.service === UNKNOWN_SERVICE) - Number(b.service === UNKNOWN_SERVICE)
    || a.n - b.n || a.service.localeCompare(b.service, "th"));
}

/** เส้นทางที่มีเที่ยวมากที่สุด พร้อมสัดส่วนชนิดรถ — คืนทุกเส้นทาง ผู้เรียกตัดเอง
 *  `ids` = เลขที่ใบรายการของเส้นทางนั้น (ป็อปอัปรายการเที่ยวใช้ชุดนี้ จำนวนแถวจึงเท่ากับ n เสมอ) */
export function routeUsage(rows: FleetSlice[]) {
  return [...bucket(rows, (r) => r.rt || "ไม่ระบุเส้นทาง")].map(([rt, list]) => {
    const ids = [...new Set(list.map((r) => r.id))];
    return { rt, n: ids.length, ids, kinds: shares(list, (r) => r.vk || "ไม่ระบุชนิดรถ") };
  })
    .sort((a, b) => b.n - a.n || a.rt.localeCompare(b.rt, "th"));
}

/**
 * คำแนะนำของตารางสรุป — ดีไซน์เทียบด้วย **Margin** ของสองฝั่ง (ต่างจาก SummaryTable แท็บกำไรรายเที่ยว
 * ที่เทียบต้นทุน/เที่ยว เพราะที่นั่นรายได้ของสองฝั่งต่างกันได้) ที่นี่รายได้ถูกแบ่งเข้ารถตามสัดส่วนต้นทุน
 * Margin ของแต่ละคันจึงเท่ากับ Margin ของใบ — เทียบ Margin คือเทียบว่าใบที่ใช้รถฝั่งไหนทำกำไรดีกว่า
 * ฝั่งเดียว = ไม่มีตัวเทียบ ไม่เดาค่าแทน
 */
export type UseAdvice = "comp" | "part" | "only-comp" | "only-part";
export const USE_ADVICE_LABEL: Record<UseAdvice, string> = {
  comp: "ใช้รถบริษัท", part: "ใช้รถร่วม", "only-comp": "มีแต่รถบริษัท", "only-part": "มีแต่รถร่วม",
};

export interface UseRow {
  key: string; rt: string; service: string; vk: string;
  n: number; compN: number; partN: number;
  /** สัดส่วนเที่ยว 0..100 ของสองฝั่งรวมกัน */
  compShare: number; partShare: number;
  /** Margin % — null ถ้าฝั่งนั้นไม่มีเที่ยวหรือไม่มีรายได้ */
  compMargin: number | null; partMargin: number | null;
  advice: UseAdvice;
}

const marginPct = (rev: number, profit: number): number | null => (rev ? profit / rev * 100 : null);

/** ตารางสรุป เส้นทาง × กลุ่มบริการ × ชนิดรถ — รถร่วม + รถร่วมนอกพิเศษ = ฝั่งเดียวกัน */
export function routeServiceKindTable(rows: FleetSlice[]): UseRow[] {
  type Acc = { docs: Set<string>; rev: number; profit: number };
  const acc = () => ({ docs: new Set<string>(), rev: 0, profit: 0 });
  const groups = new Map<string, { rt: string; service: string; vk: string; all: Set<string>; comp: Acc; part: Acc }>();
  for (const row of rows) {
    const rt = row.rt || "ไม่ระบุเส้นทาง", vk = row.vk || "ไม่ระบุชนิดรถ";
    const key = JSON.stringify([rt, row.service, vk]);
    const g = groups.get(key) ?? { rt, service: row.service, vk, all: new Set<string>(), comp: acc(), part: acc() };
    const side = sideOf(row) === "comp" ? g.comp : g.part;
    g.all.add(row.id);
    side.docs.add(row.id);
    side.rev += row.rev;
    side.profit += row.profit;
    groups.set(key, g);
  }
  return [...groups].map(([key, g]) => {
    const compN = g.comp.docs.size, partN = g.part.docs.size, both = compN + partN;
    const compMargin = compN ? marginPct(g.comp.rev, g.comp.profit) : null;
    const partMargin = partN ? marginPct(g.part.rev, g.part.profit) : null;
    const advice: UseAdvice = !partN ? "only-comp" : !compN ? "only-part"
      : (compMargin ?? -Infinity) >= (partMargin ?? -Infinity) ? "comp" : "part";
    return { key, rt: g.rt, service: g.service, vk: g.vk, n: g.all.size, compN, partN,
      compShare: both ? compN / both * 100 : 0, partShare: both ? partN / both * 100 : 0,
      compMargin, partMargin, advice };
  });
}
