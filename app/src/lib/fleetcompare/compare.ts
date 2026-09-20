/**
 * ตารางสรุป เส้นทาง × ชนิดรถ + คำแนะนำเรื่องรถบริษัท/รถร่วม
 *
 * (เคยยุบรวมกลุ่มบริการด้วย เจ้าของงานให้เอาออก 20 ก.ย. 2569 เหลือเป็นตัวกรองของหน้าจอแทน — แถวลดลงราว 30%)
 *
 * คำแนะนำมาจากสองอย่างคู่กัน
 *   1. อัตรากำไรของกลุ่มนั้น (กำไร ÷ รายได้)
 *   2. ฝั่งไหน "ต้นทุนเฉลี่ยต่อเที่ยว" ถูกกว่า
 *
 *                        รถร่วมถูกกว่า          รถบริษัทถูกกว่า / พอ ๆ กัน
 *   margin < 0           เปลี่ยนเป็นรถร่วม      ทบทวน (ขาดทุน)
 *   margin < LOW (5%)    เปลี่ยนเป็นรถร่วม      ทบทวน (Margin ต่ำ)
 *   margin < GOOD (10%)  พิจารณาใช้รถร่วม       ทบทวน (Margin ต่ำ)
 *   margin ≥ GOOD        พิจารณาใช้รถร่วม       คงรถบริษัท
 *
 * ★ เทียบต้นทุน ไม่ใช่กำไร เพราะรายได้มาจากงาน ไม่ได้มาจากรถ — ในกลุ่มเดียวกันฝั่งหนึ่งอาจได้งาน
 *   มูลค่าสูงกว่า (ข้อมูลจริงเจอรายได้/เที่ยวต่างกัน ~25%) กำไรจะยกความดีให้ฝั่งที่ "ได้งานดีกว่า"
 *   ไม่ใช่ฝั่งที่ "วิ่งถูกกว่า" ส่วนอัตรากำไรใช้บอกว่ากลุ่มนี้ควรรื้อดูก่อนหรือไม่
 *
 * ★ กลุ่มที่มีรถวิ่งฝั่งเดียว (ส่วนใหญ่เป็นแบบนี้ — ข้อมูลจริง ม.ค. 2568 ชนิดรถ 14 ชนิด
 *   มีทั้งสองฝั่งแค่ 3) ยังให้คำแนะนำได้ โดยเอา **ค่าเฉลี่ยต้นทุนต่อเที่ยวของชนิดรถนั้นทั้งชุด**
 *   มาแทนฝั่งที่ไม่มี แล้วติดธง `compEst`/`partEst` ให้หน้าจอบอกผู้ใช้ว่าเป็นค่าประมาณ
 *   ถ้าชนิดรถนั้นไม่มีฝั่งนั้นเลยทั้งชุด ก็ไม่มีตัวเทียบ (`cheaper = null`) คำแนะนำจะดูแต่อัตรากำไร
 *
 * ไม่ใช้เที่ยววิ่งเปล่า (รายได้ 0 ตามนิยาม ไม่ใช่งานของเส้นนั้น)
 */
import type { Trip } from "../data/useCostRev";

export type Side = "comp" | "part";
/** รถร่วม + รถร่วมนอกพิเศษ = ฝั่งเดียวกัน (รถที่บริษัทไม่ได้เป็นเจ้าของ) */
export const sideOf = (t: Pick<Trip, "ft">): Side => (t.ft === "รถบริษัท" ? "comp" : "part");

/** ต้นทุน/เที่ยว ต่างกันไม่ถึงสัดส่วนนี้ = พอ ๆ กัน */
export const TIE_SHARE = 0.05;
/** เส้นแบ่งอัตรากำไร (%) */
export const MARGIN_LOW = 5;
export const MARGIN_GOOD = 10;

export type Advice = "keep-comp" | "consider-part" | "switch-part" | "review-low" | "review-loss";

export interface SummaryRow {
  key: string;
  /** เส้นทาง (จุดขึ้น-จุดลง) · ชนิดรถ */
  rt: string; vk: string;
  n: number; compN: number; partN: number;
  /** สัดส่วนเที่ยว 0..1 */
  compShare: number; partShare: number;
  rev: number; cost: number; profit: number;
  /** อัตรากำไร % — null ถ้าไม่มีรายได้ */
  margin: number | null;
  /** ต้นทุนเฉลี่ยต่อเที่ยวของแต่ละฝั่ง — null ถ้าไม่มีตัวเทียบเลย */
  compCost: number | null; partCost: number | null;
  /** ฝั่งนั้นไม่มีเที่ยวในกลุ่มนี้ ใช้ค่าเฉลี่ยของชนิดรถทั้งชุดแทน */
  compEst: boolean; partEst: boolean;
  /** ฝั่งที่ต้นทุน/เที่ยวถูกกว่า — null = ไม่มีตัวเทียบ */
  cheaper: Side | "tie" | null;
  advice: Advice;
}

export interface SummaryResult {
  rows: SummaryRow[];
  summary: {
    /** กลุ่มที่มีรถวิ่งทั้งสองฝั่งจริง · กลุ่มทั้งหมด */
    bothSides: number; groups: number;
    /** เที่ยวในกลุ่มที่มีทั้งสองฝั่ง ÷ เที่ยวทั้งหมด (0..1) */
    bothSidesTripShare: number;
    /** ชนิดรถทั้งหมด · ชนิดที่มีรถทั้งสองฝั่ง */
    kinds: number; sharedKinds: number;
    /** จำนวนกลุ่มตามคำแนะนำ */
    byAdvice: Record<Advice, number>;
  };
}

/** คำแนะนำจากอัตรากำไร + ฝั่งที่ถูกกว่า (ตารางในหัวไฟล์) */
export function adviceOf(margin: number | null, cheaper: Side | "tie" | null): Advice {
  const partCheaper = cheaper === "part";
  if (margin == null) return partCheaper ? "consider-part" : "review-low";
  if (margin < 0) return partCheaper ? "switch-part" : "review-loss";
  if (margin < MARGIN_LOW) return partCheaper ? "switch-part" : "review-low";
  if (margin < MARGIN_GOOD) return partCheaper ? "consider-part" : "review-low";
  return partCheaper ? "consider-part" : "keep-comp";
}

const avg = (sum: number, n: number): number | null => (n ? sum / n : null);

export function summarize(all: Trip[]): SummaryResult {
  const loaded = all.filter((t) => !t.empty && t.rt && t.vk);

  /* ต้นทุนเฉลี่ยต่อเที่ยวของแต่ละ (ชนิดรถ, ฝั่ง) ทั้งชุด — ใช้แทนฝั่งที่กลุ่มนั้นไม่มีรถวิ่ง */
  const kindCost = new Map<string, { cost: number; n: number }>();
  const kindSides = new Map<string, Set<Side>>();
  for (const t of loaded) {
    const k = `${t.vk}|${sideOf(t)}`;
    const a = kindCost.get(k) ?? { cost: 0, n: 0 };
    a.cost += t.cost; a.n++;
    kindCost.set(k, a);
    (kindSides.get(t.vk) ?? kindSides.set(t.vk, new Set()).get(t.vk)!).add(sideOf(t));
  }
  const kindAvg = (vk: string, side: Side): number | null => {
    const a = kindCost.get(`${vk}|${side}`);
    return a ? avg(a.cost, a.n) : null;
  };

  interface Acc { rt: string; vk: string; n: number; rev: number; cost: number;
                  compN: number; compCost: number; partN: number; partCost: number }
  const groups = new Map<string, Acc>();
  for (const t of loaded) {
    const key = `${t.rt}|${t.vk}`;
    const a = groups.get(key)
      ?? { rt: t.rt, vk: t.vk, n: 0, rev: 0, cost: 0, compN: 0, compCost: 0, partN: 0, partCost: 0 };
    a.n++; a.rev += t.rev; a.cost += t.cost;
    if (sideOf(t) === "comp") { a.compN++; a.compCost += t.cost; } else { a.partN++; a.partCost += t.cost; }
    groups.set(key, a);
  }

  const rows: SummaryRow[] = [];
  for (const [key, a] of groups) {
    const compReal = avg(a.compCost, a.compN);
    const partReal = avg(a.partCost, a.partN);
    const compCost = compReal ?? kindAvg(a.vk, "comp");
    const partCost = partReal ?? kindAvg(a.vk, "part");
    let cheaper: SummaryRow["cheaper"] = null;
    if (compCost != null && partCost != null) {
      const diff = compCost - partCost;
      const base = (compCost + partCost) / 2;
      cheaper = Math.abs(diff) < base * TIE_SHARE ? "tie" : diff > 0 ? "part" : "comp";
    }
    const profit = a.rev - a.cost;
    const margin = a.rev ? profit / a.rev * 100 : null;
    rows.push({
      key, rt: a.rt, vk: a.vk,
      n: a.n, compN: a.compN, partN: a.partN,
      compShare: a.compN / a.n, partShare: a.partN / a.n,
      rev: a.rev, cost: a.cost, profit, margin,
      compCost, partCost, compEst: compReal == null, partEst: partReal == null,
      cheaper, advice: adviceOf(margin, cheaper),
    });
  }

  const both = rows.filter((r) => r.compN > 0 && r.partN > 0);
  const byAdvice = { "keep-comp": 0, "consider-part": 0, "switch-part": 0, "review-low": 0, "review-loss": 0 } as Record<Advice, number>;
  for (const r of rows) byAdvice[r.advice]++;
  return {
    rows,
    summary: {
      bothSides: both.length, groups: rows.length,
      bothSidesTripShare: loaded.length ? both.reduce((s, r) => s + r.n, 0) / loaded.length : 0,
      kinds: kindSides.size,
      sharedKinds: [...kindSides.values()].filter((s) => s.size === 2).length,
      byAdvice,
    },
  };
}
