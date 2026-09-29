/**
 * ผล Performance Index ของหน้า Executive Summary — ฟังก์ชันชุดเดียวกับกล่อง PI ของ Executive Dashboard
 * (PiIndex.tsx · custPiResults) ด้วยตัวกรองว่าง (DEMO_F0) → ตัวเลขเท่ากับ Executive Dashboard ตอนไม่กรอง
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
    // Reference Baseline + ช่วงประเมิน (ไม่เลือกปี = เดือนล่าสุดของไฟล์) — ตัวเดียวกับ Executive Dashboard ตอนไม่กรอง
    const refs = all ? tripRefOf(all, DEMO_F0) : null;
    const ev = all ? tripEvalOf(all, DEMO_F0) : null;
    return {
      [INDEXES.route.id]: routePiResults(ev?.trips ?? null, refs, ev?.label),
      [INDEXES.fleet.id]: [lfPiResult(lf.error ? null : lf.data, DEMO_F0), emptyPiResult(all, DEMO_F0)],
      [INDEXES.cost.id]: costPiResults(ev?.trips ?? null, refs, ev?.label),
      [INDEXES.cust.id]: custPiResults(alloc.data, debtors.data, asOf, DEMO_F0),
      [INDEXES.service.id]: servicePiResults(ev?.trips ?? null, serviceRef(refs), ev?.label),
    };
  }, [all, lf.data, lf.error, alloc.data, debtors.data]);
}
