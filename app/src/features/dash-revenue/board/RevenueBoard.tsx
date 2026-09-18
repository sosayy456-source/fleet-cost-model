/**
 * "Dashboard รายได้" — แท็บใน Executive Dashboard
 * แสดงข้อมูลรายได้ที่คำนวณจากเที่ยววิ่งในไฟล์ต้นทุน (trips ที่ m = true)
 * เพื่อให้ยอดรายได้รวมตรงกับแท็บ "กำไรรายเที่ยว" และสอดคล้องกับหลักการของ Executive Dashboard
 */
import { useRef, useState } from "react";
import { useDashInk } from "../../../lib/chart/dashfx";
import AllocDash from "../../dash-alloc/AllocDash";
import OverviewTab from "./OverviewTab";
import TrendTab from "./TrendTab";
import type { Trip, CostRevManifest } from "../../../lib/data/useCostRev";

const SUB = [
  { id: "overview", label: "ภาพรวม" },
  { id: "trend", label: "แนวโน้ม & สินค้า" },
  // อ่านชุด alloc/ ของตัวเอง (ปันส่วนต้นทุนเข้าบิลลูกค้า)
  { id: "cust", label: "กำไรลูกค้า (ปันส่วนต้นทุน)" },
] as const;
type SubId = (typeof SUB)[number]["id"];

export default function RevenueBoard({ trips, manifest }: {
  trips: Trip[];
  manifest?: CostRevManifest;
}) {
  const [sub, setSub] = useState<SubId>("overview");
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
      {sub === "overview" && <OverviewTab trips={trips} manifest={manifest} />}
      {sub === "trend" && <TrendTab trips={trips} />}
      {sub === "cust" && <AllocDash embedded />}
    </>
  );
}
