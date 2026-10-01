/**
 * Recommendation ของ Executive Dashboard (เจ้าของงานสั่ง 1 ต.ค. 2569 — แทน PiRecommend ที่อ่านผล PI)
 * เนื้อหาตามรายงานสามหัวข้อ แต่ตัวเลขคิดสดจากข้อมูลตามตัวกรองของหน้า · ข้อเสนอแนะขึ้นเฉพาะเมื่อเข้าเงื่อนไข (THRESHOLDS)
 *   1. ต้นทุนบริการลูกค้า ความสามารถทำกำไร และโครงสร้างราคา — ไฟล์ต้นทุน (inProfitScope) · ไฟล์ปันส่วนลูกค้า · ตัน-กม.
 *   2. ประสิทธิภาพการใช้กองรถ — ไฟล์ Load Factor (lib/loadfactor/calc.ts) · เที่ยววิ่งเปล่าจากไฟล์ต้นทุน
 *   3. ความเสี่ยงการเงินและลูกหนี้ — ไฟล์ลูกหนี้ (ช่วง 1 ม.ค. ของปีถึงวันที่ข้อมูล หรือช่วงที่เลือก)
 * ทุกฟังก์ชันเป็นสูตรล้วน หน้าจอ (features/dash-demo/ExecRecommend.tsx) แค่ประกอบประโยค
 */
import type { Trip } from "../data/useCostRev";
import type { LfTrip } from "../data/useLoadFactor";
import type { DebtorRow } from "../data/useDebtors";
import { groupTrips, rankGroups, summarize, trend } from "../loadfactor/calc";
import type { TkOverview } from "../tonkm/calc";
import { isBelow, isJudged } from "../tonkm/calc";
import { dayNum } from "../debtors/aging";
import { fmtN } from "../chart/theme";

/**
 * เกณฑ์ที่ทำให้ข้อเสนอแนะขึ้น — แก้ที่นี่ที่เดียว
 * ★ ตั้งจากการวัดข้อมูลจริง 1 ต.ค. 2569 (เจ้าของงานอนุญาตให้อ่านไฟล์ที่แปลงแล้วครั้งเดียว · ช่วงทั้งหมด/รายปี/รายเดือน) —
 *   เดิมหลายข้อขึ้นทุกครั้งแม้ยอดเล็กมาก (ลูกค้าขาดทุนเล็กน้อย · ค้างเกินกำหนด) หรือไม่เคยขึ้นเลย (Top 10 ≥ 50%)
 */
export const THRESHOLDS = {
  /** % เที่ยวขาดทุนที่ถือว่าต้องทบทวนราคารายเที่ยว */
  lossTripPct: 10,
  /** ขาดทุนจากลูกค้ารวม ÷ ต้นทุน ตั้งแต่เท่านี้ = เจรจาปรับราคากับลูกค้าที่ขาดทุนมากสุด */
  custLossCost: 0.01,
  /** ขาดทุนจากลูกค้า ÷ ต้นทุน ตั้งแต่เท่านี้ = เร่งด่วน (ต่ำกว่า = ควรทำ · ดูรายเดือนสัดส่วนสูงกว่าทั้งปี จึงเผื่อไว้) */
  custLossUrgent: 0.05,
  /** Top 10 ลูกค้าขาดทุนกินสัดส่วนขาดทุนทั้งหมดตั้งแต่เท่านี้ = เน้นเจรจา 10 รายแรก (ต่ำกว่า = ทบทวนราคาขั้นต่ำทั้งระบบ) */
  top10LossShare: 0.5,
  /** ช่วง %Margin ของลูกค้าที่ควรปรับรูปแบบบริการ (รวมเที่ยว) */
  thinLossBand: [-20, -10] as [number, number],
  /** ขาดทุนของลูกค้าช่วงนั้น ÷ ต้นทุน ตั้งแต่เท่านี้จึงเสนอ (ยอดเล็กกว่านี้ไม่มีนัยสำคัญ) */
  thinBandCost: 0.0025,
  /** กลุ่มบริการที่อัตรากำไรต่ำกว่าภาพรวมเกินกี่จุด = ปรับโครงสร้างราคากลุ่มนั้น */
  svcGapPP: 10,
  /** กลุ่มบริการที่อัตรากำไรต่ำกว่านี้ (%) = เร่งด่วน · สูงกว่า = ควรทำ (ยังกำไรอยู่) */
  svcUrgentMargin: 5,
  /** เกณฑ์ดีของกำไร: อัตรากำไรภาพรวมตั้งแต่เท่านี้ (%) */
  goodMargin: 10,
  /** ค้างเกินกำหนด ÷ ยอดวางบิล ตั้งแต่เท่านี้ = ติดตามหนี้ · ตั้งแต่ overdueUrgent = เร่งด่วน
   *  (ดูรายเดือนค่าสูงกว่าทั้งปีมาก เพราะบิลที่ครบกำหนดปลายเดือนยังไม่ทันเก็บ) */
  overdueShare: 0.01,
  overdueUrgent: 0.1,
  /** บิลชำระช้า (จำนวนบิล) ตั้งแต่สัดส่วนนี้ = ติดตามลูกค้าที่ชำระช้าเป็นประจำ */
  lateWatchShare: 0.2,
  /** LF เฉลี่ยต่ำกว่าเป้ากี่จุดขึ้นไปจึงเสนอรวมเที่ยว */
  lfGapPP: 2,
  /** เส้นทางต้องมีเที่ยวอย่างน้อยเท่านี้จึงนับเป็น "LF ต่ำสุด" (กันเส้นทางเที่ยวเดียว) */
  minRouteTrips: 10,
  /** ต้นทุนเที่ยวเปล่า ÷ ต้นทุนรวม ตั้งแต่เท่านี้ = เสนอวางแผนขากลับ */
  emptyCostShare: 0.03,
  /** สมมติฐานลดเที่ยวเปล่าที่หลีกเลี่ยงได้ */
  emptyCut: [0.1, 0.2] as [number, number],
  /** DSO เกินเครดิตเทอมเฉลี่ยกี่วัน = ปรับกระบวนการวางบิล */
  dsoLateDays: 5,
  /** สมมติฐานติดตามยอดค้างที่เกินกำหนดกลับมาได้ */
  collectShare: 0.5,
  /** ยอดล่าช้าอยู่ในช่วง 1–30 วันตั้งแต่สัดส่วนนี้ = ปัญหาชำระช้าเป็นประจำ ไม่ใช่หนี้เสีย */
  shortLateShare: 0.7,
  /** ผลกระทบตั้งแต่สัดส่วนนี้ของต้นทุนรวม = เร่งด่วน */
  urgentCostShare: 0.01,
} as const;

const sum = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((s, x) => s + f(x), 0);
const variableOf = (t: Trip): number => t.fuel + t.allow + t.fee;
/** จำนวนเดือนที่มีข้อมูล — ใช้แปลงยอดของช่วงเป็นต่อปี */
const monthsOf = (xs: { mo: string }[]): number => new Set(xs.map((x) => x.mo)).size;
/** จัดกลุ่มครั้งเดียว (push) — ข้อมูลจริงหลายหมื่นเที่ยว ห้ามสร้าง array ใหม่ทุกแถว */
function groupBy<T>(xs: T[], key: (x: T) => string, keep: (x: T) => boolean = () => true): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    if (!keep(x)) continue;
    const k = key(x), a = m.get(k);
    if (a) a.push(x); else m.set(k, [x]);
  }
  return m;
}
export const perYear = (v: number, months: number): number => (months ? v / months * 12 : 0);

/* ======================================================================= 1. กำไร */
export interface RouteBest { rt: string; n: number; profit: number; perTrip: number; margin: number; varShare: number; wasteShare: number }
export interface SvcMargin { sg: string; n: number; revenue: number; profit: number; margin: number }
export interface CustLite { profit: number; revenue: number; m: number }
export interface CustStats {
  n: number; gain: number; loss: number; lossN: number;
  /** Σขาดทุน ÷ Σกำไรของลูกค้าที่มีกำไร */
  lossOfGain: number | null;
  /** Σขาดทุนของ Top 10 ÷ Σขาดทุนทั้งหมด */
  top10Share: number | null;
  band: { n: number; loss: number };
}
export interface ProfitSection {
  n: number; bills: number; revenue: number; cost: number; profit: number; margin: number | null;
  perTrip: number; lossTripPct: number;
  /** จำนวนเดือนที่มีข้อมูล — แปลงต้นทุนเป็นต่อปีเมื่อเทียบกับยอดประหยัดต่อปี */
  months: number;
  /** Σขาดทุนของเที่ยวที่ขาดทุน (บาท ค่าบวก) */
  lossAmt: number;
  best: RouteBest | null;
  svc: SvcMargin[];
  cust: CustStats | null;
  tk: { best: { vk: string; rate: number; status: string } | null; worst: { vk: string; rate: number } | null; judged: number; ok: number; below: string[] } | null;
}

export function profitSection(trips: Trip[], cust: CustLite[] | null, tk: TkOverview | null): ProfitSection {
  const revenue = sum(trips, (t) => t.rev), cost = sum(trips, (t) => t.cost), profit = revenue - cost;
  const n = trips.length;
  // เส้นทางกำไรรวมสูงสุด (ไม่นับเที่ยวเปล่า — ไม่มีรายได้)
  const byRt = groupBy(trips, (t) => t.rt, (t) => !t.empty);
  let best: RouteBest | null = null;
  // เส้นทางเที่ยวน้อย (เช่น 1 เที่ยว) ไม่ใช่ตัวแทนที่ดี — นับเฉพาะ ≥ minRouteTrips ถ้าไม่มีเส้นทางไหนถึงค่อยใช้ทุกเส้นทาง
  const enough = [...byRt].filter(([, ts]) => ts.length >= THRESHOLDS.minRouteTrips);
  for (const [rt, ts] of enough.length ? enough : [...byRt]) {
    const r = sum(ts, (t) => t.rev), c = sum(ts, (t) => t.cost), p = r - c;
    if (p > 0 && (!best || p > best.profit)) {
      best = { rt, n: ts.length, profit: p, perTrip: p / ts.length, margin: r ? p / r * 100 : 0,
        varShare: c ? sum(ts, variableOf) / c : 0, wasteShare: c ? sum(ts, (t) => t.waste) / c : 0 };
    }
  }
  // อัตรากำไรรายกลุ่มบริการ (ไม่นับเที่ยวเปล่า/ไม่ระบุ)
  const bySg = groupBy(trips, (t) => t.sg, (t) => !t.empty && !!t.sg);
  const svc = [...bySg].map(([sg, ts]) => {
    const r = sum(ts, (t) => t.rev), p = r - sum(ts, (t) => t.cost);
    return { sg, n: ts.length, revenue: r, profit: p, margin: r ? p / r * 100 : 0 };
  }).sort((a, b) => a.margin - b.margin);

  let cs: CustStats | null = null;
  if (cust && cust.length) {
    const gains = cust.filter((c) => c.profit > 0), losses = cust.filter((c) => c.profit < 0);
    const gain = sum(gains, (c) => c.profit), loss = -sum(losses, (c) => c.profit);
    const top10 = [...losses].sort((a, b) => a.profit - b.profit).slice(0, 10);
    const [lo, hi] = THRESHOLDS.thinLossBand;
    const band = cust.filter((c) => c.m >= lo && c.m < hi);
    cs = { n: cust.length, gain, loss, lossN: losses.length, lossOfGain: gain ? loss / gain : null,
      top10Share: loss ? -sum(top10, (c) => c.profit) / loss : null,
      band: { n: band.length, loss: -sum(band, (c) => Math.min(0, c.profit)) } };
  }

  let tkS: ProfitSection["tk"] = null;
  if (tk) {
    const rated = tk.rows.filter((r) => r.cur.rate != null).sort((a, b) => b.cur.rate! - a.cur.rate!);
    const judged = tk.rows.filter((r) => isJudged(r.status));
    tkS = {
      best: rated[0] ? { vk: rated[0].vk, rate: rated[0].cur.rate!, status: rated[0].status } : null,
      worst: rated.length > 1 ? { vk: rated[rated.length - 1]!.vk, rate: rated[rated.length - 1]!.cur.rate! } : null,
      judged: judged.length, ok: judged.filter((r) => !isBelow(r.status)).length,
      below: judged.filter((r) => isBelow(r.status)).map((r) => r.vk),
    };
  }
  return { n, months: monthsOf(trips), bills: sum(trips, (t) => t.bn || 0), revenue, cost, profit, margin: revenue ? profit / revenue * 100 : null,
    perTrip: n ? profit / n : 0, lossAmt: -sum(trips.filter((t) => t.profit < 0), (t) => t.profit), lossTripPct: n ? trips.filter((t) => t.profit < 0).length / n * 100 : 0,
    best, svc, cust: cs, tk: tkS };
}

/* ======================================================================= 2. กองรถ */
export interface LfSection {
  n: number; avgLf: number; avgTg: number; gapPP: number; idle: number; share: number; cost: number;
  /** เทียบช่วงเดือนเดียวกันสองปีล่าสุด (null = มีปีเดียว) */
  yoy: { months: number[]; from: { year: number; lf: number; idle: number }; to: { year: number; lf: number; idle: number } } | null;
  /** ชนิดรถที่รวมกันได้ ≥ 80% ของต้นทุนจม */
  kinds80: { k: number; of: number; share: number };
  topIdleRoute: { rt: string; idle: number; lf: number } | null;
  lowLfRoute: { rt: string; lf: number; n: number } | null;
  /** ปรับทุกเที่ยวที่ต่ำกว่าเป้าขึ้นถึงเป้า */
  lift: { lfAfter: number; saved: number; perYear: number; months: number };
}

/** ts = กรองครบ · anyYear = กรองทุกตัวยกเว้นปี/เดือน (แนวโน้มเทียบปี) */
export function lfSection(ts: LfTrip[], anyYear: LfTrip[]): LfSection | null {
  if (!ts.length) return null;
  const s = summarize(ts);
  const tr = trend(anyYear);
  const ys = tr.years.filter((y) => y.ytd);
  const yoy = ys.length >= 2 ? {
    months: tr.months,
    from: { year: ys[0]!.year, lf: ys[0]!.ytd!.lf, idle: ys[0]!.ytd!.idle },
    to: { year: ys[ys.length - 1]!.year, lf: ys[ys.length - 1]!.ytd!.lf, idle: ys[ys.length - 1]!.ytd!.idle },
  } : null;
  const kr = rankGroups(groupTrips(ts, "vk"));
  const rr = rankGroups(groupTrips(ts, "rt"));
  const top = rr.rows[0];
  const low = rr.rows.filter((r) => r.n >= THRESHOLDS.minRouteTrips).sort((a, b) => a.lf - b.lf)[0];
  const lfAfter = sum(ts, (t) => Math.max(t.lf, t.tg)) / ts.length;
  const months = monthsOf(ts);
  return {
    n: s.n, avgLf: s.avgLf, avgTg: s.avgTg, gapPP: (s.avgTg - s.avgLf) * 100, idle: s.idle, share: s.share, cost: s.cost, yoy,
    kinds80: { k: kr.k80, of: kr.rows.length, share: kr.rows.slice(0, kr.k80).reduce((a, r) => a + r.share, 0) },
    topIdleRoute: top ? { rt: top.name, idle: top.idle, lf: top.lf } : null,
    lowLfRoute: low ? { rt: low.name, lf: low.lf, n: low.n } : null,
    lift: { lfAfter, saved: s.recov, perYear: perYear(s.recov, months), months },
  };
}

export interface EmptySection {
  n: number; cost: number; totalCost: number; share: number; months: number;
  top: { rt: string; n: number; cost: number; shareOfEmpty: number; perTrip: number; varShare: number } | null;
  /** ประหยัดต่อปีถ้าลดเที่ยวเปล่า THRESHOLDS.emptyCut */
  save: [number, number];
}

export function emptySection(trips: Trip[]): EmptySection | null {
  const empties = trips.filter((t) => t.empty);
  if (!empties.length) return null;
  const cost = sum(empties, (t) => t.cost), totalCost = sum(trips, (t) => t.cost);
  const byRt = groupBy(empties, (t) => t.rt);
  let top: EmptySection["top"] = null;
  for (const [rt, ts] of byRt) {
    const c = sum(ts, (t) => t.cost);
    if (!top || c > top.cost) top = { rt, n: ts.length, cost: c, shareOfEmpty: cost ? c / cost : 0, perTrip: c / ts.length, varShare: c ? sum(ts, variableOf) / c : 0 };
  }
  const months = monthsOf(trips);
  const yr = perYear(cost, months);
  return { n: empties.length, cost, totalCost, share: totalCost ? cost / totalCost : 0, months, top,
    save: [yr * THRESHOLDS.emptyCut[0], yr * THRESHOLDS.emptyCut[1]] };
}

/* ======================================================================= 3. ลูกหนี้ */
export interface DebtSection {
  from: string; asOf: string; bills: number; amount: number;
  /** วันเก็บเงินเฉลี่ยของบิลที่ชำระแล้ว (ชำระ − วางบิล) = เครดิตเทอมเฉลี่ย + ชำระช้าเฉลี่ย */
  dso: number | null; term: number | null; late: number | null;
  latePaid: { n: number; amount: number; nShare: number; amtShare: number; over60: number };
  overdue: { n: number; amount: number };
  /** สัดส่วนยอดล่าช้า (ชำระช้า + ค้างเกินกำหนด) ที่อยู่ในช่วง 1–30 วัน */
  short: number | null;
  /** เงินทุนหมุนเวียนที่ได้คืน: ลดส่วนที่ช้าลงครึ่งหนึ่ง / ลดจนเท่าเครดิตเทอม · เก็บยอดค้างกลับมาได้ */
  wc: { half: { dso: number; cash: number }; term: { dso: number; cash: number } } | null;
  collect: number;
}

export function debtSection(rows: DebtorRow[], from: string, asOf: string): DebtSection | null {
  const bills = rows.filter((r) => r.issue >= from && r.issue <= asOf);
  if (!bills.length) return null;
  const amount = sum(bills, (r) => r.amount);
  const paid = bills.filter((r) => r.close && r.close <= asOf);
  const dso = paid.length ? sum(paid, (r) => dayNum(r.close!) - dayNum(r.issue)) / paid.length : null;
  const term = paid.length ? sum(paid, (r) => r.term) / paid.length : null;
  const latePaid = paid.filter((r) => r.close! > r.due);
  const d0 = dayNum(asOf);
  const overdue = bills.filter((r) => !(r.close && r.close <= asOf) && r.due < asOf);
  const lateDays = [
    ...latePaid.map((r) => ({ a: r.amount, d: dayNum(r.close!) - dayNum(r.due) })),
    ...overdue.map((r) => ({ a: r.amount, d: d0 - dayNum(r.due) })),
  ];
  const lateAmt = sum(lateDays, (x) => x.a);
  const days = Math.max(1, d0 - dayNum(from) + 1);
  const daily = amount / days;
  const late = dso != null && term != null ? dso - term : null;
  return {
    from, asOf, bills: bills.length, amount, dso, term, late,
    latePaid: { n: latePaid.length, amount: sum(latePaid, (r) => r.amount), nShare: latePaid.length / bills.length,
      amtShare: amount ? sum(latePaid, (r) => r.amount) / amount : 0,
      over60: latePaid.filter((r) => dayNum(r.close!) - dayNum(r.due) > 60).length },
    overdue: { n: overdue.length, amount: sum(overdue, (r) => r.amount) },
    short: lateAmt ? sum(lateDays.filter((x) => x.d <= 30), (x) => x.a) / lateAmt : null,
    wc: dso != null && term != null && late != null && late > 0 ? {
      half: { dso: dso - late / 2, cash: daily * late / 2 },
      term: { dso: term, cash: daily * late },
    } : null,
    collect: sum(overdue, (r) => r.amount) * THRESHOLDS.collectShare,
  };
}

/* ======================================================================= ข้อเสนอแนะ (การ์ด) */
/** เร่งด่วน · ควรทำ · ติดตาม */
export type RecLevel = "urgent" | "do" | "watch";
export const REC_LEVEL: Record<RecLevel, string> = { urgent: "เร่งด่วน", do: "ควรทำ", watch: "ติดตาม" };
/** ผลที่คาดเป็นเงิน — เพิ่มกำไร/ปี · ลดต้นทุน/ปี · เงินสดกลับมา (ครั้งเดียว) */
export type RecGain = "profit" | "cost" | "cash";
export const REC_GAIN: Record<RecGain, string> = { profit: "เพิ่มกำไร", cost: "ลดต้นทุน", cash: "เงินสดกลับมา" };
/** หน่วยท้ายยอดเงิน — กำไร/ต้นทุนเป็นต่อปี · เงินสดครั้งเดียว */
export const REC_PER: Record<RecGain, string> = { profit: "/ปี", cost: "/ปี", cash: "" };
export const SEC_NAME: Record<1 | 2 | 3, string> = { 1: "กำไรและโครงสร้างราคา", 2: "ประสิทธิภาพกองรถ", 3: "ลูกหนี้การค้า" };
export interface Rec {
  sec: 1 | 2 | 3;
  level: RecLevel;
  /** ชื่อเรื่องสั้น (หัวการ์ด) */
  title: string;
  /** ควรทำ — ประโยคสั่งงาน */
  action: string;
  /** เพราะ — หลักฐานตัวเลขบรรทัดเดียว */
  why: string;
  /** เริ่มที่ (ถ้ามี) */
  start?: string;
  /** ผลที่คาดเป็นเงิน (ไม่มี = ไม่ประเมินเป็นเงิน) · ประมาณการสูงสุด */
  gain?: RecGain;
  /** ยอดเงินของผลที่คาด — ใช้จัดอันดับด้วย (0 = ไม่มี) */
  value: number;
  /** หมายเหตุสั้นใต้ยอดเงิน เช่น ช่วงประมาณการ / LF หลังปรับ */
  note?: string;
}

const baht = (n: number): string => (Math.abs(n) >= 1e6 ? `${fmtN(n / 1e6, 2)} ล้านบาท` : `${fmtN(Math.round(n))} บาท`);
const pc = (x: number, d = 1): string => `${fmtN(x * 100, d)}%`;

/**
 * แปลงผลสามหัวข้อเป็นข้อเสนอแนะ — ขึ้นเฉพาะข้อที่เข้าเงื่อนไข THRESHOLDS
 * ★ ผลที่คาดเป็นเงิน: เรื่องกำไร/ต้นทุน = ต่อปี (ยอดของช่วง ÷ เดือน × 12) · เรื่องลูกหนี้ = เงินสดกลับมาครั้งเดียว · ทุกตัวเป็นค่าสูงสุดภายใต้สมมติฐาน
 *   เรื่องราคาสองข้อ (ลูกค้าขาดทุน · เที่ยวขาดทุน) มองขาดทุนก้อนเดียวกันคนละมุม — ห้ามบวกรวมกัน
 * ระดับ: ผลกระทบ ≥ urgentCostShare ของต้นทุน = เร่งด่วน · เข้าเงื่อนไขแต่น้อยกว่า = ควรทำ · ไม่มีตัวเลขเป็นเงิน = ติดตาม
 *   ★ ยอดต่อปีเทียบต้นทุนต่อปี (เลือกเดือนเดียวแล้วต้นทุนเดือนเดียวทำให้เร่งด่วนเกินจริง)
 *   ★ กลุ่มบริการ = เร่งด่วนเฉพาะเมื่ออัตรากำไรของกลุ่มต่ำกว่า svcUrgentMargin · ลูกค้าขาดทุน/ค้างเกินกำหนดมีเกณฑ์เร่งด่วนของตัวเอง
 * เรียงตามระดับแล้วตามยอดเงิน
 */
export function buildRecs(ps: ProfitSection | null, ls: LfSection | null, es: EmptySection | null, ds: DebtSection | null): Rec[] {
  const out: Rec[] = [];
  const cost = ps?.cost ?? ls?.cost ?? 0;
  const months = ps?.months || ls?.lift.months || 12;
  const costYr = cost / months * 12;
  const yr = (v: number): number => perYear(v, months);
  const lv = (value: number, base: number, force = false): RecLevel =>
    force || (base > 0 && value >= base * THRESHOLDS.urgentCostShare) ? "urgent" : "do";

  if (ps) {
    const loss = ps.profit < 0;
    const c = ps.cust;
    if (c && c.lossN > 0 && c.top10Share != null && ps.cost > 0 && c.loss / ps.cost >= THRESHOLDS.custLossCost) {
      const conc = c.top10Share >= THRESHOLDS.top10LossShare;
      const v = yr(conc ? c.loss * c.top10Share : c.loss);
      out.push({ sec: 1, level: loss || c.loss / ps.cost >= THRESHOLDS.custLossUrgent ? "urgent" : "do", value: v, gain: "profit",
        title: "ลูกค้าที่ขาดทุน",
        action: conc ? "เจรจาปรับค่าบริการกับลูกค้าขาดทุน 10 อันดับแรก โดยใช้ต้นทุนจาก Cost-to-Serve เป็นฐาน ไม่ยอมปรับให้ทบทวนสัญญา"
          : "ทบทวนอัตราค่าบริการขั้นต่ำ และเจรจาปรับราคากับลูกค้าที่ขาดทุนมากที่สุด โดยใช้ต้นทุนจาก Cost-to-Serve เป็นฐาน",
        why: `${fmtN(c.lossN)} ราย ขาดทุนรวม ${baht(c.loss)} · 10 อันดับแรก ${pc(c.top10Share)} ของยอดขาดทุน` });
    }
    if (c && c.band.n > 0 && ps.cost > 0 && c.band.loss / ps.cost >= THRESHOLDS.thinBandCost) {
      out.push({ sec: 1, level: lv(c.band.loss, ps.cost), value: yr(c.band.loss), gain: "profit",
        title: "ลูกค้าใกล้จุดคุ้มทุน",
        action: "รวมสินค้าเป็นเที่ยวเดียวกันเพื่อลดต้นทุนต่อหน่วยของลูกค้ากลุ่มนี้",
        why: `${fmtN(c.band.n)} รายมีอัตรากำไร ${THRESHOLDS.thinLossBand[0]}% ถึง ${THRESHOLDS.thinLossBand[1]}%` });
    }
    if (ps.margin != null) {
      const overall = ps.margin;
      for (const g of ps.svc.filter((g) => g.margin < overall - THRESHOLDS.svcGapPP)) {
        const gap = overall - g.margin;
        const cold = /แช่เย็น|แช่แข็ง/.test(g.sg);
        out.push({ sec: 1, level: g.margin < THRESHOLDS.svcUrgentMargin ? "urgent" : "do", value: yr(g.revenue * gap / 100), gain: "profit",
          title: `ราคากลุ่ม${g.sg}`,
          action: `ปรับราคาให้สะท้อนต้นทุน${cold ? "พลังงานความเย็นและค่าเสื่อมรถห้องเย็น" : "จริงของการให้บริการ"}`,
          why: `อัตรากำไร ${fmtN(g.margin, 1)}% ต่ำกว่าภาพรวม ${fmtN(gap, 1)} จุด`, note: "ถ้าอัตรากำไรเท่าภาพรวม" });
      }
    }
    if (ps.lossTripPct >= THRESHOLDS.lossTripPct) {
      out.push({ sec: 1, level: lv(ps.lossAmt, ps.cost, loss), value: yr(ps.lossAmt), gain: "profit",
        title: "เที่ยวที่ขาดทุน",
        action: "กำหนดราคาขั้นต่ำต่อเที่ยวไม่ให้ต่ำกว่าต้นทุนผันแปร และตรวจเส้นทาง/ลูกค้าที่ขาดทุนซ้ำ",
        why: `เที่ยวขาดทุน ${fmtN(ps.lossTripPct, 1)}% ของเที่ยวทั้งหมด`, note: "ขาดทุนก้อนเดียวกับลูกค้าขาดทุน ไม่บวกรวม" });
    }
    if (ps.tk && ps.tk.below.length) {
      out.push({ sec: 1, level: "watch", value: 0, title: "กำไร/ตัน-กม. รายชนิดรถ",
        action: "ทบทวนอัตราค่าขนส่งหรือการเลือกชนิดรถให้เหมาะกับงาน",
        why: `ต่ำกว่าเป้า: ${ps.tk.below.join(" · ")}` });
    }
  }

  if (ls && ls.gapPP >= THRESHOLDS.lfGapPP) {
    const start = [ls.topIdleRoute?.rt, ls.lowLfRoute && ls.lowLfRoute.rt !== ls.topIdleRoute?.rt ? ls.lowLfRoute.rt : null].filter(Boolean).join(" · ");
    const trendTxt = ls.yoy && ls.yoy.to.lf < ls.yoy.from.lf ? ` · แย่ลงจากปี ${ls.yoy.from.year + 543}` : "";
    out.push({ sec: 2, level: lv(ls.lift.perYear, costYr), value: ls.lift.perYear, gain: "cost",
      title: "อัตราการบรรทุก (Load Factor)",
      action: "รวมสินค้าจากหลายเที่ยวเข้ารถคันเดียวกันและจัดรอบรับสินค้าใหม่",
      why: `LF ${pc(ls.avgLf)} ต่ำกว่าเป้า ${fmtN(ls.gapPP, 1)} จุด${trendTxt}`,
      start: start || undefined, note: `ถ้า LF ถึงเป้ารายชนิดรถ (~${pc(ls.lift.lfAfter)})` });
  }
  if (es && es.share >= THRESHOLDS.emptyCostShare) {
    out.push({ sec: 2, level: lv(es.save[1], costYr), value: es.save[1], gain: "cost",
      title: "เที่ยววิ่งเปล่า",
      action: "วางแผนงานขากลับและรับงานล่วงหน้า ตั้งราคางานขากลับไม่ต่ำกว่าต้นทุนส่วนเพิ่ม",
      why: `ต้นทุนเที่ยวเปล่า ${pc(es.share)} ของต้นทุน${es.top ? ` · ${es.top.rt} กิน ${pc(es.top.shareOfEmpty)}` : ""}`,
      start: es.top?.rt, note: `ลดเที่ยวเปล่า ${THRESHOLDS.emptyCut[0] * 100}–${THRESHOLDS.emptyCut[1] * 100}% · ต่ำสุด ${baht(es.save[0])}` });
  }

  if (ds) {
    const odShare = ds.amount ? ds.overdue.amount / ds.amount : 0;
    if (odShare >= THRESHOLDS.overdueShare) {
      out.push({ sec: 3, level: odShare >= THRESHOLDS.overdueUrgent ? "urgent" : "do", value: ds.collect, gain: "cash",
        title: "หนี้ค้างเกินกำหนด",
        action: "เร่งติดตามลูกหนี้ที่เกินกำหนดและยังไม่ชำระ",
        why: `ค้าง ${baht(ds.overdue.amount)} (${fmtN(ds.overdue.n)} บิล · ${pc(odShare)} ของยอดวางบิล)`,
        note: `ถ้าเก็บได้ ${THRESHOLDS.collectShare * 100}%` });
    }
    if (ds.wc && ds.late != null && ds.late >= THRESHOLDS.dsoLateDays) {
      out.push({ sec: 3, level: lv(ds.wc.half.cash, cost), value: ds.wc.half.cash, gain: "cash",
        title: "ระยะเวลาเก็บหนี้ (DSO)",
        action: "ปรับกระบวนการวางบิลและติดตามเอกสารให้ลูกค้าชำระตรงเครดิตเทอม",
        why: `DSO ${fmtN(ds.dso!, 0)} วัน เกินเครดิตเทอม ${fmtN(ds.late, 0)} วัน`,
        note: `ลด DSO เหลือ ${fmtN(ds.wc.half.dso, 0)} วัน · ถ้าเท่าเครดิตเทอมได้ ${baht(ds.wc.term.cash)}` });
    } else if (ds.latePaid.nShare >= THRESHOLDS.lateWatchShare) {
      out.push({ sec: 3, level: "watch", value: 0, title: "ลูกค้าชำระช้า",
        action: "ติดตามลูกค้าที่ชำระช้าเป็นประจำ และแจ้งเตือนก่อนครบกำหนด",
        why: `บิลชำระช้า ${pc(ds.latePaid.nShare)}${ds.short != null ? ` · ${pc(ds.short)} ของยอดที่ช้าอยู่ใน 1–30 วัน` : ""}` });
    }
  }
  const rank: Record<RecLevel, number> = { urgent: 0, do: 1, watch: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || b.value - a.value);
}

/**
 * เกณฑ์ดีของแต่ละหัวข้อ — คืนรายการตรวจ (ผ่าน/ไม่ผ่าน + ข้อความ)
 *   1 กำไร: อัตรากำไร ≥ goodMargin · เที่ยวขาดทุน < lossTripPct
 *   2 กองรถ: LF ต่ำกว่าเป้าไม่ถึง lfGapPP · ต้นทุนเที่ยวเปล่า < emptyCostShare
 *   3 ลูกหนี้: DSO เกินเครดิตเทอมไม่ถึง dsoLateDays · ค้างเกินกำหนด < overdueShare ของยอดวางบิล
 */
export interface GoodCheck { ok: boolean; text: string }
export function goodChecks(sec: 1 | 2 | 3, ps: ProfitSection | null, ls: LfSection | null, es: EmptySection | null, ds: DebtSection | null): GoodCheck[] {
  const out: GoodCheck[] = [];
  if (sec === 1 && ps) {
    if (ps.margin != null) out.push({ ok: ps.margin >= THRESHOLDS.goodMargin, text: `อัตรากำไร ${fmtN(ps.margin, 1)}%` });
    out.push({ ok: ps.lossTripPct < THRESHOLDS.lossTripPct, text: `เที่ยวขาดทุน ${fmtN(ps.lossTripPct, 1)}%` });
  }
  if (sec === 2) {
    if (ls) out.push({ ok: ls.gapPP < THRESHOLDS.lfGapPP, text: `LF ${pc(ls.avgLf)} (เป้า ${pc(ls.avgTg)})` });
    if (es) out.push({ ok: es.share < THRESHOLDS.emptyCostShare, text: `เที่ยวเปล่า ${pc(es.share)} ของต้นทุน` });
  }
  if (sec === 3 && ds) {
    if (ds.dso != null && ds.late != null) out.push({ ok: ds.late < THRESHOLDS.dsoLateDays, text: `DSO ${fmtN(ds.dso, 0)} วัน (เครดิต ${fmtN(ds.term!, 0)} วัน)` });
    out.push({ ok: ds.amount > 0 && ds.overdue.amount / ds.amount < THRESHOLDS.overdueShare,
      text: `ค้างเกินกำหนด ${pc(ds.amount ? ds.overdue.amount / ds.amount : 0)} ของยอดวางบิล` });
  }
  return out;
}

/**
 * สถานะของหัวข้อ — มีข้อเร่งด่วน = ต้องแก้ · ผ่านเกณฑ์ดีครบและไม่มีข้อ "ควรทำ" = ดีแล้ว · ที่เหลือ = เฝ้าระวัง
 * (ข้อ "ติดตาม" ไม่ทำให้หลุดจากดีแล้ว)
 */
export const secStatus = (recs: Rec[], checks: GoodCheck[]): "bad" | "warn" | "good" =>
  recs.some((r) => r.level === "urgent") ? "bad"
    : checks.length && checks.every((c) => c.ok) && !recs.some((r) => r.level === "do") ? "good" : "warn";
