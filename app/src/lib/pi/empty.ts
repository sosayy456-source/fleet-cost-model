/**
 * Empty Return ของ Performance Index — ใช้เกณฑ์ของแท็บ Empty Trips (lib/empty/routeScore.ts · เจ้าของงานสั่ง 25 ก.ย. 2569)
 *
 *   รายการ = เส้นทางตามทิศ · ค่า = % เที่ยววิ่งเปล่า (นับเที่ยว) · เกณฑ์ = P25/P75 ของทุกเส้นทาง
 *   ดี (≤ P25) = เขียว · ปานกลาง (P25–P75) = เหลือง · แย่มาก (> P75) = แดง → นับสีด้วยสูตรเดียวกับตัวชี้วัดอื่น
 *   (ไม่ใช้คะแนนต่อเนื่อง/ติดลบของแท็บ — PI ทุกตัวที่นับรายการใช้ เขียว + 0.5 × เหลือง ตามที่เจ้าของงานเลือก)
 * ★ ผู้เรียกแยกสองชุดให้: rated = เส้นทางที่ให้สี (ตัวกรองของหน้า ยกเว้นกลุ่มบริการ) · ref = ชุดคิด P25/P75
 *   (ช่วงเวลา + ประเภทรถ/ชนิดรถ ไม่ตามต้นทาง/ปลายทาง — กติกาเดียวกับแท็บ Empty Trips)
 */
import { emptyScore, emptyThresholds, routeRates } from "../empty/routeScore";
import type { EmptyGrade, RouteTrip } from "../empty/routeScore";
import { bandResult } from "./score";
import type { Band, MetricResult } from "./score";

const BAND: Record<EmptyGrade, Band> = { good: "g", mid: "y", bad: "r" };

const p = (v: number): string => `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

export function emptyResult(rated: RouteTrip[] | null, ref: RouteTrip[] | null): MetricResult {
  if (!rated || !ref) return bandResult("empty", null);
  const th = emptyThresholds(routeRates(ref));
  if (!th) return bandResult("empty", null);
  const basis = `P25 = ${p(th.p25)} · P75 = ${p(th.p75)} จาก ${th.routes.toLocaleString("en-US")} เส้นทาง`
    + (th.p25 === th.p75 ? " · P25 = P75 จึงไม่มีช่วงเหลือง (≤ P25 เขียว · เกินแดง)" : "");
  return bandResult("empty", routeRates(rated).map((r) => BAND[emptyScore(r.pct, th).grade]), { basis });
}
