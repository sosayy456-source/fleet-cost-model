/**
 * ข้อเสนอแนะจากผล Performance Index — ส่วน "Recommendation" ของ Executive Dashboard (เจ้าของงานสั่งเพิ่มแท็บ 28 ก.ย. 2569)
 *
 * ★ ไม่คิดคะแนนเอง อ่านผลที่กล่อง PI แจ้งขึ้นมา (usePiReports) แล้วจัดลำดับ + ติดข้อความแนวทาง
 * ★ ข้อความใน ACTIONS เป็นร่างแรก — เจ้าของงานยังไม่ได้ส่งเนื้อหา แก้ที่นี่ที่เดียว
 * ระดับ: คะแนน < 5 = เร่งแก้ไข · 5 ถึง < 7.5 = ควรปรับปรุง · ≥ 7.5 = รักษาระดับ · ไม่มีคะแนน = ไม่แสดง
 */
import { INDEXES, METRICS, type MetricKey, type MetricResult } from "./score";

export type RecLevel = "urgent" | "improve" | "keep";

export const REC_LEVEL_LABEL: Record<RecLevel, string> = {
  urgent: "เร่งแก้ไข",
  improve: "ควรปรับปรุง",
  keep: "รักษาระดับ",
};

/** แนวทางต่อตัวชี้วัด (ร่างแรก) */
export const ACTIONS: Record<MetricKey, string> = {
  route: "ทบทวนราคาค่าขนส่งของเส้นทางที่ขาดทุน และรวมเที่ยว/ปรับชนิดรถให้เหมาะกับปริมาณงานของเส้นทางนั้น",
  service: "ตรวจต้นทุนต่อเที่ยวของกลุ่มบริการที่ Margin ต่ำ (เช่น ค่าความเย็น/น้ำมัน) แล้วปรับอัตราค่าบริการให้สะท้อนต้นทุน",
  lf: "รวมบิลเส้นทางเดียวกัน/ระหว่างทางก่อนปล่อยรถ และเลือกชนิดรถให้พอดีกับน้ำหนัก-ปริมาตรจริง เพื่อลดที่ว่างในตู้",
  empty: "หางานขากลับให้เส้นทางที่วิ่งเปล่าบ่อย หรือจับคู่เส้นทางไป-กลับกับสาขาปลายทาง",
  tkm: "ตรวจคันที่ต้นทุนต่อตัน-กม. สูงกว่าชนิดเดียวกันมาก (ค่าน้ำมัน/ค่าซ่อม/บรรทุกเบา) และพิจารณาปรับเส้นทางหรือชนิดรถ",
  coverage: "เพิ่มการใช้งานรถบริษัทที่ไม่คุ้มค่าเสื่อม (วิ่งให้มากขึ้นหรือย้ายไปเส้นทางที่กำไรดีกว่า) หรือพิจารณาใช้รถร่วมแทน",
  custProfit: "ทบทวนราคา/เงื่อนไขของลูกค้าที่ขาดทุน โดยเฉพาะรายที่ปริมาณสินค้าน้อยแต่ใช้พื้นที่รถมาก",
  dso: "ติดตามลูกหนี้ที่เกินกำหนด เร่งวางบิลให้ตรงรอบ และทบทวนระยะเวลาเครดิตของลูกค้าที่ชำระช้าเป็นประจำ",
  dr: "ตรวจสาเหตุของบิลเคลียร์มูลค่าสูง (การบรรจุ/การขนถ่าย) และกำหนดมาตรฐานการจัดเรียงสินค้า",
  dir: "ลดความถี่ความเสียหายในเส้นทาง/ชนิดรถที่เกิดบ่อย ด้วยการตรวจรถและอบรมพนักงานขนถ่าย",
};

export interface Recommendation {
  key: MetricKey;
  label: string;
  /** หมวดของตัวชี้วัด (id ของ INDEXES) — ใช้กระโดดไปกล่อง PI */
  indexId: string;
  indexTitle: string;
  score: number;
  level: RecLevel;
  /** จำนวนรายการแดง / ทั้งหมด (ไม่มี tally = null) */
  red: number | null;
  n: number | null;
  unit: string;
  action: string;
}

export const levelOf = (score: number): RecLevel => (score < 5 ? "urgent" : score < 7.5 ? "improve" : "keep");

/** ผลทุกหมวด → ข้อเสนอแนะเรียงคะแนนน้อยไปมาก · ตัวชี้วัดที่ยังไม่มีคะแนนไม่แสดง */
export function recommendations(reports: Record<string, MetricResult[]>): Recommendation[] {
  const out: Recommendation[] = [];
  for (const ix of Object.values(INDEXES)) {
    for (const r of reports[ix.id] ?? []) {
      if (r.score == null) continue;
      const def = METRICS[r.key];
      out.push({
        key: r.key, label: def.label, indexId: ix.id, indexTitle: ix.title,
        score: r.score, level: levelOf(r.score),
        red: r.tally ? r.tally.r : null, n: r.tally ? r.tally.n : null,
        unit: def.unit, action: ACTIONS[r.key],
      });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}
