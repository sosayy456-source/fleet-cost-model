/**
 * แท็บ "รายละเอียด ข้อ 3" ของ Executive Dashboard — สเปก ข้อ3.pdf (เจ้าของงานส่ง 23 ก.ย. 2569)
 *
 *   ส่วนที่ 1  ภาพรวมต้นทุนขนส่งสำหรับผู้บริหาร (Part1.tsx)
 *   ส่วนที่ 2  คุ้มค่าเสื่อมหรือไม่ — เฉพาะรถบริษัท (Part2.tsx)
 *
 * ดีไซน์ตามโมเดลหลัก (เจ้าของงานสั่ง 23 ก.ย. 2569): ตัวกรองบนแถบหัว → การ์ดไล่สี Hero → การ์ด KC →
 * หัวข้อคั่น ZT → กรอบกราฟ dz-cc + DBar → ตาราง SortTable · ห้ามกลับไปใช้สไตล์เฉพาะแบบรุ่นแรก
 *
 * ตัวกรองปี (สเปก: "ใช้ WHERE ปี = ... กรองก่อนคำนวณทุกส่วน") ใช้กับทั้งสองส่วน
 * ใช้เฉพาะเที่ยวที่จับคู่รายได้ได้ (trips ของโหมด exec) · สูตรทั้งหมดอยู่ใน lib/detail3/calc.ts
 * วิธีคิดและข้อตกลงอยู่ใน docs/หลักข้อ3.md
 */
import { useEffect, useMemo, useState } from "react";
import { clearExecAnchor, peekExecAnchor } from "../../../lib/ui/dashJump";
import type { Trip } from "../../../lib/data/useCostRev";
import { vehicleRows } from "../../../lib/detail3/calc";
import FilterBar, { ClearFiltersBtn } from "../../../lib/ui/FilterBar";
import { Pane, ZT } from "../../dash-fleet/parts";
import { YearFF } from "../common";
import Part1 from "./Part1";
import Part2 from "./Part2";

export default function Detail3Tab({ trips }: { trips: Trip[] }) {
  const [year, setYear] = useState("");
  const scope = useMemo(() => (year ? trips.filter((t) => String(t.y) === year) : trips), [trips, year]);
  const rows = useMemo(() => vehicleRows(scope), [scope]);
  // มาจากการ์ดแท็บ "ข้อ 3" ของ Demo → เลื่อนไปส่วนที่ 1/2 (รอกราฟวาดก่อนนิดหนึ่ง ไม่งั้นตำแหน่งยังเลื่อน)
  const [anchor] = useState(() => { const a = peekExecAnchor(); return a?.startsWith("d3-") ? a : null; });
  useEffect(() => {
    clearExecAnchor();
    if (!anchor) return;
    const id = window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => window.clearTimeout(id);
  }, [anchor]);

  return <>
    <FilterBar>
      <YearFF trips={trips} value={year} onChange={setYear} />
      <ClearFiltersBtn active={!!year} onClick={() => setYear("")} />
    </FilterBar>
    <Pane deps={[scope]}>
      <div id="d3-part1" className="d3-anchor" />
      <ZT>ภาพรวมต้นทุนขนส่ง — สำหรับผู้บริหาร</ZT>
      <Part1 trips={scope} rows={rows} />
      <div id="d3-part2" className="d3-anchor" />
      <ZT>คุ้มค่าเสื่อมหรือไม่ (เฉพาะรถบริษัท)</ZT>
      <Part2 rows={rows} />
    </Pane>
  </>;
}
