/**
 * แท็บ "Executive Summary" ของหน้า Executive Summary (ภาพที่เจ้าของงานส่ง 28 ก.ย. 2569)
 *
 *   การ์ด 4 ใบ · คะแนน Performance Index รวม · แถบประเด็นสำคัญ · กราฟน้ำตก รายได้ → ต้นทุน → กำไร
 *   สูตรอยู่ที่ lib/summary/execSummary.ts · คะแนน PI ใช้ฟังก์ชันชุดเดียวกับกล่อง PI ของ Executive Dashboard
 *   (PiIndex.tsx · custPiResults) ด้วยตัวกรองว่าง (DEMO_F0) — ตัวเลขเท่ากับคะแนนรวมของ Executive Dashboard ตอนไม่กรอง
 * ★ ทุกชุดเลือกข้อมูลจริง/ตัวอย่างเองตามหลักของโมเดล (costrev · loadfactor · alloc · debtors แยกกัน)
 *   และรีเฟรชเองเมื่อ ETL ของชุดนั้นเสร็จ — วางไฟล์จริงแล้วหน้านี้เปลี่ยนเป็นข้อมูลจริงเอง
 * ★ ชุดเที่ยว = inProfitScope() ทุกเที่ยว ไม่กรอง (ตัวกรองหัวหน้ายังปิดไว้)
 */
import { useMemo } from "react";
import { inProfitScope, useCostRev } from "../../lib/data/useCostRev";
import { useAlloc } from "../../lib/data/useAlloc";
import { useAutoReloadOnEtl, useEtlStatus } from "../../lib/data/etlStatus";
import { costSteps, customerLoss, emptyCostPerYear, execTotals } from "../../lib/summary/execSummary";
import { DWaterfall } from "../../lib/chart/dcharts";
import { D } from "../../lib/chart/theme";
import TruckLoader from "../../lib/ui/TruckLoader";
import { DEMO_F0 } from "../dash-demo/filter";
import { Hero, Note, Pane } from "../dash-fleet/parts";
import { fmt, pct } from "../dash-costrev/common";
import { rollupCustomers } from "../dash-demo/CustomerProfitTab";

/** ล้านบาท ทศนิยม 1 ตำแหน่ง — 55,912,345 → "55.9" */
const mb = (v: number): string => (v / 1e6).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function SummaryTab({ onRecommend }: { onRecommend: () => void }) {
  const cr = useCostRev();
  const alloc = useAlloc();
  useAutoReloadOnEtl(useEtlStatus("costrev"), cr.reload);
  useAutoReloadOnEtl(useEtlStatus("alloc"), alloc.reload);

  const all = useMemo(() => (cr.data ? cr.data.trips.filter(inProfitScope) : null), [cr.data]);
  const tot = useMemo(() => (all ? execTotals(all) : null), [all]);
  const steps = useMemo(() => (all ? costSteps(all) : null), [all]);
  const empty = useMemo(() => (all ? emptyCostPerYear(all) : null), [all]);
  const custRows = useMemo(() => (alloc.data?.custMonths ? rollupCustomers(alloc.data, DEMO_F0) : null), [alloc.data]);
  const loss = useMemo(() => (custRows ? customerLoss(custRows) : null), [custRows]);

  if (cr.error) return <div className="card"><div className="banner">{cr.error}</div></div>;
  if (!all || !tot || !steps) return <div className="card"><p className="muted">กำลังโหลดข้อมูล... <TruckLoader label={null} /></p></div>;

  const water = [
    { label: "รายได้", value: tot.rev, total: true, color: D.indigo },
    { label: "น้ำมัน", value: steps.fuel, color: D.rose },
    { label: "คนขับ", value: steps.driver, color: D.rose },
    { label: "ค่าเสื่อม+ซ่อม", value: steps.depRepair, color: D.rose },
    { label: "อื่นๆ", value: steps.other, color: D.rose },
    { label: tot.profit < 0 ? "ขาดทุน" : "กำไร", value: tot.profit, total: true, color: tot.profit < 0 ? D.rose : D.emeraldLight },
  ];
  const insight = [
    empty && empty.perYear > 0 && `เที่ยววิ่งเปล่ากินกำไร ${mb(empty.perYear)} ลบ./ปี`,
    loss && loss.n > 0 && `ลูกค้า ${Math.round(loss.share)}% ขาดทุนสะสมรวม ${mb(loss.loss)} ลบ.`,
  ].filter(Boolean).join(" · ");

  return (
    <Pane deps={[all]}>
      {/* การ์ดเด่นชุดเดียวกับ Profit Per Route · กล่องคะแนนรวม PI ย้ายไปบนสุดของแท็บ Performance Index (เจ้าของงานสั่ง 1 ต.ค. 2569) */}
      <div className="dz-heroes">
        <Hero kind={tot.profit < 0 ? "loss" : "profit"} l={tot.profit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ"}
          v={mb(Math.abs(tot.profit))} unit="ล้านบาท" s="รายได้ – ต้นทุน" />
        <Hero kind="rev" l="รายได้รวม" v={mb(tot.rev)} unit="ล้านบาท" s={`${fmt(tot.n)} เที่ยว`} />
        <Hero kind="cost" l="ต้นทุนรวม" v={mb(tot.cost)} unit="ล้านบาท" />
        <Hero kind="svc" l="%Margin" v={tot.margin == null ? "–" : pct(tot.margin)} s="กำไร ÷ รายได้" />
      </div>

      {insight && <div className="dmg-alert es-block" role="note">
        <b><span aria-hidden="true">⚠ </span>{insight}</b>
        <button type="button" className="es-link" onClick={onRecommend}>ดูข้อเสนอแนะ</button>
      </div>}

      <div className="dz-cc es-block">
        <h4>รายได้ → ต้นทุน → กำไร (ล้านบาท)</h4>
        <div className="dz-box"><DWaterfall steps={water} fmtValue={mb} /></div>
        <Note>
          {cr.data!.manifest.isSample ? "ข้อมูลตัวอย่าง" : "ข้อมูลจริง"} · ทุกเที่ยวที่จับคู่รายได้ได้ + เที่ยววิ่งเปล่า
          {empty && ` · ${empty.months} เดือน`} · อื่นๆ = ค่าธรรมเนียม · ค่าเช่า · ต้นทุนสูญเปล่า · อื่น ๆ ·
          เที่ยววิ่งเปล่า/ปี = ต้นทุนเที่ยวเปล่า × 12 ÷ จำนวนเดือนที่มีข้อมูล
        </Note>
      </div>
    </Pane>
  );
}
