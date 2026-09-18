/**
 * "Dashboard ลูกหนี้" — แท็บใน Executive Dashboard
 * แสดงข้อมูลลูกหนี้ค้างชำระแยกรายบิลจากไฟล์รายได้ (costrev/old_debtors.json)
 * ที่ผูกกับเที่ยววิ่งในไฟล์ต้นทุน
 */
import { useRef, useState } from "react";
import { useDashInk } from "../../../lib/chart/dashfx";
import { useDebtorCodes } from "../../../lib/custmap/debtorCodes";
import { AgingTab, ByDebtorTab, BillListTab } from "./DebtorTabs";
import type { CostRevManifest } from "../../../lib/data/useCostRev";
import type { RecordsState } from "../../../lib/store/useRecords";

const SUB = [
  { id: "aging", label: "ยอดคงค้าง & Aging" },
  { id: "debtor", label: "รายลูกหนี้" },
  { id: "bills", label: "รายการบิลค้างชำระ" },
] as const;
type SubId = (typeof SUB)[number]["id"];

export default function DebtorBoard({ state, manifest }: {
  state: RecordsState;
  manifest?: CostRevManifest;
}) {
  useDebtorCodes();
  const [sub, setSub] = useState<SubId>("aging");
  const barRef = useRef<HTMLDivElement>(null);
  useDashInk(barRef, sub);

  const tabs = (
    <div className="dash-tabs" ref={barRef}>
      <span className="dink" />
      {SUB.map((s) => (
        <button key={s.id} type="button" className={"dtab" + (sub === s.id ? " active" : "")}
          onClick={() => setSub(s.id)}>{s.label}</button>
      ))}
    </div>
  );

  return (
    <>
      {tabs}
      {sub === "aging" && <AgingTab state={state} manifest={manifest} />}
      {sub === "debtor" && <ByDebtorTab state={state} />}
      {sub === "bills" && <BillListTab state={state} />}
    </>
  );
}
