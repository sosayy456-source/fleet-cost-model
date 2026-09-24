/**
 * สูตรของแท็บ "รายละเอียด ข้อ 3" (Executive Dashboard · สเปก ข้อ3.pdf ที่เจ้าของงานส่ง 23 ก.ย. 2569)
 *
 *   ส่วนที่ 1  ต้นทุนขนส่งสำหรับผู้บริหาร — ภาพรวม · ต้นทุนแต่ละชนิดรถ (บริษัท vs ร่วม) ·
 *              เส้นทาง × ชนิดรถ (ต้นทุน/ตัน-กม.) · Top 5 ถูกสุด · เที่ยวที่ควร Flag · บริษัท vs ร่วม ตามชนิดรถ
 *   ส่วนที่ 2  คุ้มค่าเสื่อมหรือไม่ (เฉพาะรถบริษัท) — KPI · diverging bar · VC/FC · แยกเส้นทาง · คำแนะนำ
 *
 * หน่วยที่ใช้แยกชนิดรถ = **รายคัน** (`VRow` หนึ่งแถว = หนึ่งทะเบียนในหนึ่งใบ) ตามวิธีที่เจ้าของงานเคาะ 23 ก.ย. 2569
 * (docs/หลักข้อ3.md ข้อ 4.5): ต้นทุน/ค่าเสื่อมของคันตามที่ไฟล์ปันมา (`vs[].c` / `vs[].d`) ·
 * น้ำหนักกับระยะทาง **ทุกคันได้เต็มของใบ** · รายได้แบ่งตามสัดส่วนต้นทุน (เหมือนแท็บกองรถ)
 * ส่วน KPI ภาพรวม (ต้นทุนรวม · จำนวนเที่ยว) นับระดับใบ — COUNT(แถว) ในสเปกคือจำนวนใบรายการ
 *
 * ★ สเปกกำหนดวิธีรวมไว้ต่างกันในแต่ละส่วน ทำตามสเปกตรง ๆ:
 *     KPI และกราฟต้นทุนแต่ละชนิดรถ  = SUM(ต้นทุน) ÷ SUM(ตัวหาร)
 *     ตารางเส้นทาง × ชนิดรถ และการ Flag = AVG(ต้นทุน/ตัน-กม. รายเที่ยว)
 * ★ เที่ยวที่ไม่มีระยะทาง/น้ำหนักไม่นับทั้งตัวตั้งและตัวหารของค่าต่อกม./ต่อตัน-กม. (ไม่งั้นค่าสูงเกินจริง)
 */
import type { Trip, TripVehicle } from "../data/useCostRev";
import { sideOf, type Side } from "../fleetcompare/compare";

export interface VRow {
  id: string; d: string; y: number; rt: string;
  pl: string; vk: string; ft: string; side: Side;
  /** ต้นทุน · ค่าเสื่อม · รายได้ (ปันตามสัดส่วนต้นทุน) ของคันนี้ */
  cost: number; dep: number; rev: number;
  /** ระยะทาง/น้ำหนักเต็มของใบ — 0 = ไม่รู้ */
  km: number; wt: number; tkm: number;
  /** ต้นทุน ÷ ตัน-กม. ของคันนี้ — null ถ้าหารไม่ได้ หรือต้นทุนของคันเป็น 0
   *  (หางบางคันในไฟล์ไม่มีค่าเสื่อม/ค่าซ่อมเลย ถ้าปล่อยเป็น 0 จะกลายเป็น "ถูกสุด" ใน Top 5 ทั้งที่แค่ไม่มีข้อมูล) */
  perTkm: number | null;
}

const UNKNOWN_VK = "ไม่ระบุชนิดรถ";
const UNKNOWN_RT = "ไม่ระบุเส้นทาง";

/** แตกใบเป็นรายคัน · ไฟล์รุ่นเก่าที่ไม่มี vs หรือ d → ทั้งใบเป็นของคันแรก */
export function vehicleRows(trips: Trip[]): VRow[] {
  return trips.flatMap((t) => {
    const vs: TripVehicle[] = t.vs?.length ? t.vs : [{ pl: t.pl, vk: t.vk, ft: t.ft, c: t.cost, d: t.dep }];
    const cSum = vs.reduce((s, v) => s + v.c, 0);
    const hasD = vs.every((v) => v.d !== undefined);
    const km = t.km ?? 0, wt = t.wt ?? 0, tkm = km > 0 && wt > 0 ? km * wt : 0;
    return vs.map((v, i) => {
      const cost = cSum > 0 ? v.c : i === 0 ? t.cost : 0;
      const rev = cSum > 0 ? t.rev * v.c / cSum : i === 0 ? t.rev : 0;
      const dep = hasD ? v.d! : i === 0 ? t.dep : 0;
      return { id: t.id, d: t.d, y: t.y, rt: t.rt || UNKNOWN_RT, pl: v.pl, vk: v.vk || UNKNOWN_VK, ft: v.ft,
        side: sideOf(v), cost, dep, rev, km, wt, tkm, perTkm: tkm > 0 && cost > 0 ? cost / tkm : null };
    });
  });
}

const sum = <T>(rows: T[], f: (r: T) => number): number => rows.reduce((s, r) => s + f(r), 0);
const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
function bucket<T>(rows: T[], keyOf: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = keyOf(r); const l = m.get(k); if (l) l.push(r); else m.set(k, [r]); }
  return m;
}

/* ================================ ส่วนที่ 1 ================================ */

/** KPI ภาพรวม — ระดับใบรายการ */
export function overview(trips: Trip[]) {
  const cost = sum(trips, (t) => t.cost);
  const withKm = trips.filter((t) => (t.km ?? 0) > 0);
  const withTkm = withKm.filter((t) => (t.wt ?? 0) > 0);
  const km = sum(withKm, (t) => t.km!);
  const tkm = sum(withTkm, (t) => t.km! * t.wt!);
  return {
    cost, n: trips.length,
    perTrip: trips.length ? cost / trips.length : 0,
    perKm: km ? sum(withKm, (t) => t.cost) / km : 0,
    perTkm: tkm ? sum(withTkm, (t) => t.cost) / tkm : 0,
    noKm: trips.length - withKm.length, noTkm: trips.length - withTkm.length,
  };
}

export type Metric = "trip" | "km" | "tkm";
export interface SideStat { n: number; cost: number; perTrip: number; perKm: number | null; perTkm: number | null }

function sideStat(rows: VRow[]): SideStat | null {
  if (!rows.length) return null;
  const km = rows.filter((r) => r.km > 0), tk = rows.filter((r) => r.tkm > 0);
  const kmSum = sum(km, (r) => r.km), tkSum = sum(tk, (r) => r.tkm);
  return { n: rows.length, cost: sum(rows, (r) => r.cost), perTrip: sum(rows, (r) => r.cost) / rows.length,
    perKm: kmSum ? sum(km, (r) => r.cost) / kmSum : null, perTkm: tkSum ? sum(tk, (r) => r.cost) / tkSum : null };
}
export const metricOf = (s: SideStat | null, m: Metric): number | null =>
  !s ? null : m === "trip" ? s.perTrip : m === "km" ? s.perKm : s.perTkm;

/** ต้นทุนของรถแต่ละชนิด แยกบริษัท/ร่วม — GROUP BY ชนิดรถ, ประเภทรถ → SUM(ต้นทุน) ÷ SUM(ตัวหาร) */
export function kindSides(rows: VRow[]) {
  return [...bucket(rows, (r) => r.vk)].map(([vk, list]) => ({
    vk, n: list.length,
    comp: sideStat(list.filter((r) => r.side === "comp")),
    part: sideStat(list.filter((r) => r.side === "part")),
  }));
}

/**
 * ต้นทุนแต่ละชนิดรถของ "ปีล่าสุดในข้อมูล" เทียบปีก่อนหน้า (ค.ศ. − 1) — แท็บ "ข้อ 3" ของ Demo (ข้อ3ส่วนDEMO.pdf 23 ก.ย. 2569)
 *   บาท/เที่ยว · บาท/กม. · บาท/ตัน-กม. = SUM÷SUM ของรายคัน (รวมบริษัท + ร่วม · วิธีเดียวกับ kindSides)
 *   % เปลี่ยนแปลง = (บาท/ตัน-กม. ปีนี้ − ปีก่อน) ÷ ปีก่อน × 100 — ปีก่อนไม่มีชนิดนั้นหรือหารไม่ได้ = null
 * ★ ปีล่าสุดมักยังไม่ครบปี (ชุดตัวอย่างถึง พ.ค.) หน้าจอต้องบอกช่วงเดือน
 * pick = ปีที่ตัวกรองเลือก (Demo หน้ายาว 24 ก.ย. 2569) — ไม่ส่ง = ปีล่าสุด · rows ต้องมีปีก่อนหน้าติดมาด้วย
 *   ผู้เรียกจึงห้ามกรองปีออกก่อนส่งเข้ามา
 */
export function kindYearCost(rows: VRow[], pick?: number) {
  const year = pick ?? (rows.reduce((m, r) => (r.y > m ? r.y : m), 0) || null);
  const prev = year ? year - 1 : null;
  const prevBy = new Map([...bucket(rows.filter((r) => r.y === prev), (r) => r.vk)].map(([vk, l]) => [vk, sideStat(l)!]));
  const list = [...bucket(rows.filter((r) => r.y === year), (r) => r.vk)].map(([vk, l]) => {
    const s = sideStat(l)!, p = prevBy.get(vk)?.perTkm ?? null;
    return { vk, n: s.n, perTrip: s.perTrip, perKm: s.perKm, perTkm: s.perTkm, prevPerTkm: p,
      change: s.perTkm !== null && p ? (s.perTkm - p) / p * 100 : null };
  }).sort((a, b) => b.n - a.n || a.vk.localeCompare(b.vk, "th"));
  return { year, prev, list };
}

/** เกณฑ์ Flag — เกินกี่เท่าของค่าเฉลี่ยชนิดรถเดียวกัน (สเปก: 2 เท่า) */
export const FLAG_TIMES = 2;
/** Top 5 ถูกสุด นับเฉพาะเส้นทาง × ชนิดรถที่มีเที่ยวอย่างน้อยเท่านี้ — กลุ่มเที่ยวเดียวขึ้นอันดับเพราะบังเอิญ */
export const TOP_MIN_TRIPS = 3;

export interface Cell { n: number; avg: number; flag: boolean; times: number }
/**
 * ตารางเส้นทาง × ชนิดรถ = AVG(ต้นทุน/ตัน-กม. รายเที่ยว) · ค่าเฉลี่ยของชนิดรถ (kindAvg) ใช้เป็นเส้นแบ่ง Flag
 * ช่องที่ค่าเฉลี่ยเกิน FLAG_TIMES × ค่าเฉลี่ยชนิดรถ ติดธง · รายเที่ยวที่เกินเกณฑ์เดียวกันอยู่ใน `flagged`
 */
export function routeKindMatrix(rows: VRow[]) {
  const ok = rows.filter((r) => r.perTkm !== null);
  const kindAvg = new Map<string, number>();
  for (const [vk, list] of bucket(ok, (r) => r.vk)) kindAvg.set(vk, avg(list.map((r) => r.perTkm!))!);
  const kinds = [...bucket(ok, (r) => r.vk)].sort((a, b) => b[1].length - a[1].length).map(([vk]) => vk);
  const routes = [...bucket(ok, (r) => r.rt)].map(([rt, list]) => {
    const cells: Record<string, Cell> = {};
    for (const [vk, l] of bucket(list, (r) => r.vk)) {
      const a = avg(l.map((r) => r.perTkm!))!, k = kindAvg.get(vk)!;
      const times = k > 0 ? a / k : 0;
      cells[vk] = { n: l.length, avg: a, flag: times > FLAG_TIMES, times };
    }
    return { rt, n: list.length, cells };
  });
  const flagged = ok.map((r) => ({ row: r, kindAvg: kindAvg.get(r.vk)!, times: r.perTkm! / kindAvg.get(r.vk)! }))
    .filter((f) => f.kindAvg > 0 && f.times > FLAG_TIMES)
    .sort((a, b) => b.times - a.times);
  const cheapest = routes.flatMap((r) => Object.entries(r.cells).map(([vk, c]) => ({ rt: r.rt, vk, ...c })))
    .filter((c) => c.n >= TOP_MIN_TRIPS).sort((a, b) => a.avg - b.avg);
  return { kinds, kindAvg, routes, flagged, cheapest, excluded: rows.length - ok.length };
}

/** ส่วนต่างที่ถือว่าใกล้เคียงกัน (%) — ภาพตัวอย่างแนะนำใช้รถร่วมตั้งแต่ ~15% ขึ้นไป และเรียก 2–6% ว่าใกล้เคียง */
export const CVP_TIE_PCT = 10;
export type CvpAdvice = "part" | "comp" | "tie" | "only-comp" | "only-part";
export const CVP_LABEL: Record<CvpAdvice, string> = {
  part: "แนะนำใช้รถร่วม", comp: "แนะนำใช้รถบริษัท", tie: "ใกล้เคียงกัน เลือกตามความพร้อมของรถ",
  "only-comp": "ใช้รถบริษัท (ยังไม่มีรถร่วมเทียบ)", "only-part": "มีแต่รถร่วม (ยังไม่มีรถบริษัทเทียบ)",
};

/**
 * บริษัท vs ร่วม ตามชนิดรถ — ต้นทุน/กม. แต่ละฝั่ง = รวมต้นทุนทุกเที่ยวในกลุ่ม ÷ รวมระยะทางทุกเที่ยว
 * (ไม่เฉลี่ยค่ารายเที่ยว เพื่อไม่ให้เที่ยวสั้น ๆ ดึงค่าเฉลี่ยผิดเพี้ยน — ตามคำอธิบายในสเปก)
 * ส่วนต่าง = (บริษัท − ร่วม) ÷ ร่วม · บวก = รถบริษัทแพงกว่า
 */
export function companyVsPartner(rows: VRow[]) {
  return kindSides(rows).map((k) => {
    const c = k.comp?.perKm ?? null, p = k.part?.perKm ?? null;
    const diff = c !== null && p !== null && p > 0 ? (c - p) / p * 100 : null;
    const advice: CvpAdvice = c === null ? "only-part" : p === null ? "only-comp"
      : diff! > CVP_TIE_PCT ? "part" : diff! < -CVP_TIE_PCT ? "comp" : "tie";
    return { ...k, compKm: c, partKm: p, diff, advice };
  });
}

/* ================================ ส่วนที่ 2 · คุ้มค่าเสื่อม ================================ */

/** สถานะรายเที่ยวเทียบ coverage เฉลี่ยรวม — ต่ำกว่าเกณฑ์นี้ (%) = ต่ำกว่าเฉลี่ยมาก */
export const DEP_LOW_PCT = -20;
export type DepStatus = "low" | "watch" | "ok";
export const DEP_STATUS_LABEL: Record<DepStatus, string> = { low: "ต่ำกว่าเฉลี่ยมาก", watch: "เฝ้าระวัง", ok: "ปกติ" };

export interface DepRow extends VRow {
  /** ต้นทุนผันแปร = ต้นทุนของคัน − ค่าเสื่อม (VC) · ต้นทุนคงที่ = ค่าเสื่อม (FC) */
  vc: number;
  /** Contribution = รายได้ − VC (เงินที่เหลือไว้จ่ายค่าเสื่อม) */
  contribution: number;
  /** coverage = Contribution ÷ ค่าเสื่อม (เท่า) */
  coverage: number;
  /** ต่างจาก coverage เฉลี่ยรวม (%) */
  vsAvg: number;
  status: DepStatus;
}

/**
 * ตารางค่าเสื่อมรายเที่ยว — เฉพาะรถบริษัทที่มีค่าเสื่อม > 0 (หารด้วยศูนย์ไม่ได้)
 * coverage เฉลี่ยรวม (N) = ΣContribution ÷ Σค่าเสื่อม ไม่ใช่เฉลี่ยค่ารายเที่ยว — กันเที่ยวค่าเสื่อมน้อยมากดันค่าขึ้น
 */
export function depreciation(rows: VRow[]) {
  const company = rows.filter((r) => r.side === "comp");
  const base = company.filter((r) => r.dep > 0);
  const totalDep = sum(base, (r) => r.dep);
  const totalContribution = sum(base, (r) => r.rev - (r.cost - r.dep));
  const avgCoverage = totalDep ? totalContribution / totalDep : 0;
  const list: DepRow[] = base.map((r) => {
    const vc = r.cost - r.dep, contribution = r.rev - vc, coverage = contribution / r.dep;
    const vsAvg = avgCoverage > 0 ? (coverage - avgCoverage) / avgCoverage * 100 : 0;
    const status: DepStatus = vsAvg < DEP_LOW_PCT ? "low" : vsAvg < 0 ? "watch" : "ok";
    return { ...r, vc, contribution, coverage, vsAvg, status };
  });
  return { list, avgCoverage, totalDep, noDep: company.length - base.length,
    avgContribution: avg(list.map((r) => r.contribution)) ?? 0,
    below: list.filter((r) => r.status !== "ok").length };
}

/** ชนิดรถไหนคุ้มค่าเสื่อม — เฉลี่ย % ต่างจากเส้นเฉลี่ยรวม (diverging bar) + VC/FC เฉลี่ยต่อเที่ยว */
export function depByKind(list: DepRow[]) {
  return [...bucket(list, (r) => r.vk)].map(([vk, l]) => {
    const vc = avg(l.map((r) => r.vc))!, fc = avg(l.map((r) => r.dep))!;
    return { vk, n: l.length, vsAvg: avg(l.map((r) => r.vsAvg))!, vc, fc, total: vc + fc,
      vcShare: vc + fc > 0 ? vc / (vc + fc) * 100 : 0 };
  }).sort((a, b) => b.vsAvg - a.vsAvg);
}

/** แยกตามเส้นทาง (ทุกชนิดรถ) — coverage เฉลี่ยของเส้นทางเทียบ coverage เฉลี่ยรวม */
export function depByRoute(list: DepRow[], avgCoverage: number) {
  return [...bucket(list, (r) => r.rt)].map(([rt, l]) => {
    const cov = avg(l.map((r) => r.coverage))!;
    return { rt, n: l.length, kinds: [...new Set(l.map((r) => r.vk))], coverage: cov, below: cov < avgCoverage };
  });
}

/** เกณฑ์กล่องคำแนะนำ (สเปก 5.7): ≥ 0% ดี · < −10% เตือน · ระหว่างนั้นเฝ้าระวัง */
export const DEP_WARN_PCT = -10;
export type DepAdviceTone = "good" | "watch" | "warn";
export function depAdvice(list: DepRow[]) {
  const routesOf = bucket(list, (r) => r.vk);
  return depByKind(list).map((k) => {
    const byRoute = [...bucket(routesOf.get(k.vk)!, (r) => r.rt)]
      .map(([rt, l]) => ({ rt, n: l.length, coverage: avg(l.map((r) => r.coverage))! }))
      .sort((a, b) => b.coverage - a.coverage);
    const tone: DepAdviceTone = k.vsAvg >= 0 ? "good" : k.vsAvg < DEP_WARN_PCT ? "warn" : "watch";
    return { ...k, tone, best: byRoute[0] ?? null, worst: byRoute.length > 1 ? byRoute[byRoute.length - 1]! : null };
  });
}
