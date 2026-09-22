import type { Trip, TripVehicle } from "../data/useCostRev";

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

/** ชนิดรถที่วิ่งมากที่สุด ไม่จำกัดจำนวนไว้ที่ชั้นคำนวณ เพื่อให้ป็อปอัปแสดงได้ครบ */
export function fleetKinds(rows: FleetSlice[]) {
  return fleetGroups(rows, (r) => r.vk || "ไม่ระบุชนิดรถ")
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, "th"));
}

export function fleetRanking(rows: FleetSlice[], mode: "trip" | "vehicle") {
  return fleetGroups(rows, (r) => JSON.stringify([r.ft || "ไม่ระบุประเภทรถ", r.service, r.rt || "ไม่ระบุเส้นทาง"]))
    .map((r) => ({ ...r, label: (JSON.parse(r.key) as string[]).join(" · "),
      value: mode === "trip" ? r.perTrip : r.perVehicle }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key, "th"));
}

/** ภายในกลุ่มบริการเดียวกันนับใบไม่ซ้ำ; ใบที่ขนหลายบริการนับในแต่ละบริการได้ */
export function fleetDistribution(rows: FleetSlice[]) {
  const services = new Map<string, FleetSlice[]>();
  for (const row of rows) {
    const list = services.get(row.service) ?? [];
    list.push(row);
    services.set(row.service, list);
  }
  return [...services].map(([service, list]) => ({ service,
    n: new Set(list.map((r) => r.id)).size, kinds: fleetKinds(list) }))
    .sort((a, b) => a.service.localeCompare(b.service, "th"));
}
