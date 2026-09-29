/**
 * ผล Performance Index ของหน้า Executive Summary — ฟังก์ชันชุดเดียวกับกล่อง PI ของ Executive Dashboard
 * (PiIndex.tsx · custPiResults) ด้วยตัวกรองของ Executive Dashboard ตอนเปิดหน้า (PI_F = ตัวกรองว่าง + ไม่เทียบ Baseline · ทุกปี)
 * → คะแนนเท่ากับ Executive Dashboard ตอนไม่กรองทุกตัว (เจ้าของงานสั่ง 30 ก.ย. 2569 — เดิมประเมินเดือนล่าสุด + Baseline ซึ่งไม่ใช่ค่าตั้งต้นของหน้านั้นแล้ว)
 * ใช้ร่วม 3 แท็บ: Summary (คะแนนรวม) · Performance Index (กล่องทุกหมวด) · Recommendations (29 ก.ย. 2569)
 * ★ ชุดที่ยังโหลดไม่เสร็จ/ไม่มีไฟล์ ไม่นับเข้าฐาน ("คิดได้ x จาก 100") · ข้อมูลโหลดครั้งเดียว (hook ของแต่ละชุดมีแคช)
 */
import { useMemo } from "react";
import { inProfitScope, useCostRev } from "../../lib/data/useCostRev";
import { useLoadFactor } from "../../lib/data/useLoadFactor";
import { useAlloc } from "../../lib/data/useAlloc";
import { useDebtors } from "../../lib/data/useDebtors";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { INDEXES } from "../../lib/pi/score";
import type { MetricResult } from "../../lib/pi/score";
import { DEMO_F0 } from "../dash-demo/filter";
import { costPiResults, emptyPiResult, lfPiResult, routePiResults, servicePiResults, serviceRef, tripEvalOf, tripRefOf } from "../dash-demo/PiIndex";
import { custPiResults } from "../dash-demo/CustomerProfitTab";
import { defaultAsOf } from "../dash-demo/OverdueSection";

/** ตัวกรองของกล่อง PI ใน Executive Dashboard ตอนตัวกรองรวมว่าง (DemoDash piF) */
const PI_F = { ...DEMO_F0, noBase: true };

export function useSummaryPiReports(): Record<string, MetricResult[]> {
  const cr = useCostRev();
  const lf = useLoadFactor();
  const alloc = useAlloc();
  const debtors = useDebtors();
  useAutoReloadOnEtl(useEtlStatus("costrev"), cr.reload);
  useAutoReloadOnEtl(useEtlStatus("loadfactor"), lf.reload);
  useAutoReloadOnEtl(useEtlStatus("alloc"), alloc.reload);
  useAutoReloadOnEtl(useEtlStatus("debtors"), debtors.reload);
  const all = useMemo(() => (cr.data ? cr.data.trips.filter(inProfitScope) : null), [cr.data]);
  return useMemo(() => {
    const asOf = debtors.data ? defaultAsOf(debtors.data.manifest.dateRange.min, debtors.data.manifest) : null;
    // ไม่เทียบ Baseline · ประเมินทุกปี เกณฑ์จากรายการชุดเดียวกัน — ตัวเดียวกับ Executive Dashboard ตอนไม่กรอง
    const refs = all ? tripRefOf(all, PI_F) : null;
    const ev = all ? tripEvalOf(all, PI_F) : null;
    return {
      [INDEXES.route.id]: routePiResults(ev?.trips ?? null, refs, ev?.label),
      [INDEXES.fleet.id]: [lfPiResult(lf.error ? null : lf.data, PI_F), emptyPiResult(all, PI_F)],
      [INDEXES.cost.id]: costPiResults(ev?.trips ?? null, refs, ev?.label),
      [INDEXES.cust.id]: custPiResults(alloc.data, debtors.data, asOf, PI_F),
      [INDEXES.service.id]: servicePiResults(ev?.trips ?? null, serviceRef(refs), ev?.label),
    };
  }, [all, lf.data, lf.error, alloc.data, debtors.data]);
}
