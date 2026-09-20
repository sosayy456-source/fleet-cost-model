import type { Trip } from "../data/useCostRev";

export const UNKNOWN_SERVICE = "ไม่ระบุ / ยังแบ่งกลุ่มไม่ได้";
export type FleetSlice = Pick<Trip, "id" | "mo" | "ft" | "vk" | "pl" | "rt" | "rev" | "cost" | "profit"> & {
  service: string;
};

/** แบ่งยอดจากไฟล์ต้นทุนด้วยสัดส่วนรายได้รายกลุ่ม คงยอดรวมถึงระดับสตางค์ */
export function fleetSlices(trips: Trip[]): FleetSlice[] {
  return trips.flatMap((trip) => {
    const amounts = Object.entries(trip.serviceRevenue ?? {});
    const total = amounts.reduce((sum, [, amount]) => sum + amount, 0);
    // ไม่เดาสัดส่วนเมื่อไม่มีบิล ยอดรวมเป็นศูนย์ หรือมีกลุ่มติดลบ
    if (!amounts.length || !Number.isFinite(total) || total <= 0 || amounts.some(([, amount]) => !Number.isFinite(amount) || amount < 0)) {
      return [{ ...trip, service: UNKNOWN_SERVICE }];
    }
    const revenueTotal = Math.round(trip.rev * 100);
    const costTotal = Math.round(trip.cost * 100);
    let cumulative = 0, revenueUsed = 0, costUsed = 0;
    // ปัดยอดสะสมแล้วหาผลต่าง ป้องกันเศษหลายกลุ่มรวมกันเกินยอดและทำให้กลุ่มท้ายติดลบ
    amounts.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "th"));
    return amounts.map(([service, amount], index) => {
      const last = index === amounts.length - 1;
      cumulative += amount;
      const nextRevenue = last ? revenueTotal : Math.round(revenueTotal * cumulative / total);
      const nextCost = last ? costTotal : Math.round(costTotal * cumulative / total);
      const revenue = nextRevenue - revenueUsed, cost = nextCost - costUsed;
      revenueUsed = nextRevenue;
      costUsed = nextCost;
      return { id: trip.id, mo: trip.mo, ft: trip.ft, vk: trip.vk, pl: trip.pl, rt: trip.rt,
        service, rev: revenue / 100, cost: cost / 100, profit: (revenue - cost) / 100 };
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
