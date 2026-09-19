/**
 * รถบริษัท vs รถร่วม — ฝั่งไหนต้นทุนต่อเที่ยวถูกกว่า เทียบเฉพาะ "เส้นทางเดียวกัน × ชนิดรถเดียวกัน"
 *
 * ทำไมต้องจับคู่: สองฝั่งวิ่งคนละงานกันเกือบหมด (ข้อมูลจริง ม.ค. 2568 มี 14 ชนิดรถ มีทั้งสองฝั่งแค่ 3)
 * ค่าเฉลี่ยรวมทั้งกองจึงบอกแค่ว่าแต่ละฝั่งได้งานแบบไหน ไม่ได้บอกว่าฝั่งไหนคุ้มกว่า
 *
 * ทำไมเทียบต้นทุน ไม่ใช่กำไร (ตกลงกับเจ้าของงาน 20 ก.ย. 2569): รายได้มาจากงาน ไม่ได้มาจากรถ
 * ในเส้นเดียวกันฝั่งหนึ่งอาจได้งานมูลค่าสูงกว่า (ข้อมูลจริงเจอรายได้/เที่ยวต่างกัน ~25%) กำไรจะยกความดีให้ฝั่งที่
 * "ได้งานดีกว่า" ไม่ใช่ฝั่งที่ "วิ่งถูกกว่า" · ส่วนต่างต้นทุน × เที่ยว = เงินที่ประหยัดได้ถ้าย้ายงาน ซึ่งกำไรบอกไม่ได้
 * กำไรยังคำนวณไว้ให้แสดงประกอบ
 *
 *   ฝั่ง        รถบริษัท = ประเภทรถ "รถบริษัท" · รถร่วม = ที่เหลือ (รถร่วม + รถร่วมนอกพิเศษ)
 *   เทียบได้    ทั้งสองฝั่งมีอย่างน้อย `minSide` เที่ยว
 *   พอ ๆ กัน    ต้นทุน/เที่ยว ต่างกันไม่ถึง TIE_SHARE ของต้นทุนเฉลี่ยต่อเที่ยวของคู่นั้น
 *
 * ไม่ใช้เที่ยววิ่งเปล่า (รายได้ 0 ตามนิยาม ไม่ใช่งานของเส้นนั้น)
 */
import type { Trip } from "../data/useCostRev";

export type Side = "comp" | "part";
export const sideOf = (t: Pick<Trip, "ft">): Side => (t.ft === "รถบริษัท" ? "comp" : "part");

/** ส่วนต่างที่เล็กกว่านี้ (สัดส่วนของต้นทุน/เที่ยว) นับว่าพอ ๆ กัน */
export const TIE_SHARE = 0.05;

export interface SideStat {
  n: number; rev: number; cost: number; profit: number;
  /** ต่อเที่ยว */
  perTrip: number; revPerTrip: number; costPerTrip: number;
  /** อัตรากำไร % — null ถ้ารายได้รวมเป็น 0 */
  margin: number | null;
}

export interface PairRow {
  key: string; rt: string; vk: string;
  comp: SideStat; part: SideStat;
  /** ต้นทุน/เที่ยว รถบริษัท − รถร่วม (บวก = รถบริษัทแพงกว่า → รถร่วมถูกกว่า) */
  diff: number;
  /** ฝั่งที่ต้นทุนต่อเที่ยวถูกกว่า */
  cheaper: Side | "tie";
  /** ถ้าเที่ยวของฝั่งที่แพงกว่าวิ่งด้วยต้นทุนต่อเที่ยวเท่าอีกฝั่ง จะประหยัดเท่านี้ (0 ถ้าพอ ๆ กัน) */
  gap: number;
  /** สัดส่วนเที่ยวของรถบริษัทในเส้นนี้ 0..1 (รถร่วม = 1 − ค่านี้) */
  compShare: number;
  /** เที่ยวของเส้นนี้ ÷ เที่ยวทั้งหมดที่ใช้ (ไม่รวมเที่ยวเปล่า) 0..1 */
  tripShare: number;
}

export interface CompareResult {
  rows: PairRow[];
  summary: {
    compCheaper: number; partCheaper: number; tie: number;
    /** เที่ยวในคู่ที่เทียบได้ · เที่ยวทั้งหมดที่ใช้ (ไม่รวมเที่ยวเปล่า) */
    coveredTrips: number; totalTrips: number;
    /** คู่ เส้นทาง × ชนิดรถ ที่มีรถวิ่งฝั่งเดียว (เทียบไม่ได้โดยธรรมชาติ ไม่ใช่เพราะเที่ยวน้อย) */
    oneSided: number;
    /** คู่ที่มีทั้งสองฝั่งแต่ฝั่งใดฝั่งหนึ่งเที่ยวไม่ถึงเกณฑ์ */
    tooFew: number;
    /** ชนิดรถทั้งหมด · ชนิดที่มีรถทั้งสองฝั่ง */
    kinds: number; sharedKinds: number;
    gap: number;
  };
}

const stat = (ts: Trip[]): SideStat => {
  const rev = ts.reduce((s, t) => s + t.rev, 0);
  const cost = ts.reduce((s, t) => s + t.cost, 0);
  const n = ts.length;
  return { n, rev, cost, profit: rev - cost, perTrip: (rev - cost) / n, revPerTrip: rev / n, costPerTrip: cost / n,
           margin: rev ? (rev - cost) / rev * 100 : null };
};

export function compareSides(all: Trip[], minSide = 3): CompareResult {
  const loaded = all.filter((t) => !t.empty && t.rt && t.vk);
  const groups = new Map<string, { comp: Trip[]; part: Trip[] }>();
  const kindSides = new Map<string, Set<Side>>();
  for (const t of loaded) {
    const k = `${t.rt}|${t.vk}`;
    const g = groups.get(k) ?? { comp: [], part: [] };
    g[sideOf(t)].push(t);
    groups.set(k, g);
    (kindSides.get(t.vk) ?? kindSides.set(t.vk, new Set()).get(t.vk)!).add(sideOf(t));
  }

  const rows: PairRow[] = [];
  let oneSided = 0, tooFew = 0;
  for (const [key, g] of groups) {
    if (!g.comp.length || !g.part.length) { oneSided++; continue; }
    if (g.comp.length < minSide || g.part.length < minSide) { tooFew++; continue; }
    const comp = stat(g.comp), part = stat(g.part);
    const diff = comp.costPerTrip - part.costPerTrip;
    const costPerTrip = (comp.cost + part.cost) / (comp.n + part.n);
    const cheaper: PairRow["cheaper"] = Math.abs(diff) < Math.abs(costPerTrip) * TIE_SHARE ? "tie" : diff > 0 ? "part" : "comp";
    // เที่ยวของฝั่งที่แพงกว่า
    const pricierN = cheaper === "comp" ? part.n : cheaper === "part" ? comp.n : 0;
    const t0 = g.comp[0]!;
    rows.push({ key, rt: t0.rt, vk: t0.vk, comp, part, diff, cheaper, gap: Math.abs(diff) * pricierN,
                compShare: comp.n / (comp.n + part.n), tripShare: (comp.n + part.n) / loaded.length });
  }

  const coveredTrips = rows.reduce((s, r) => s + r.comp.n + r.part.n, 0);
  return {
    rows,
    summary: {
      compCheaper: rows.filter((r) => r.cheaper === "comp").length,
      partCheaper: rows.filter((r) => r.cheaper === "part").length,
      tie: rows.filter((r) => r.cheaper === "tie").length,
      coveredTrips, totalTrips: loaded.length,
      oneSided, tooFew,
      kinds: kindSides.size,
      sharedKinds: [...kindSides.values()].filter((s) => s.size === 2).length,
      gap: rows.reduce((s, r) => s + r.gap, 0),
    },
  };
}
