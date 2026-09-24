/**
 * แถวการ์ดกำไรส่วนเกิน/ตัน-กม. ในเมนู Demo › กำไรรายเส้นทาง (ต่อจากแถว "กำไรเฉลี่ย/บิล" — เจ้าของงานสั่ง 23 ก.ย. 2569)
 *
 * ★ ตามตัวกรองของหน้า Demo (24 ก.ย. 2569 — รวมเป็นหน้ายาว ตัวกรองชุดเดียวคุมทั้งหน้า · เดิมตรึงเดือนล่าสุดเสมอ)
 *   ปี + ช่วงเดือน → ช่วงที่แสดง (periodFor ใน lib/tonkm/calc.ts · ไม่เลือกปี = เดือนล่าสุดเหมือนเดิม)
 *   ประเภทรถ/ชนิดรถ → กรองเที่ยวในไฟล์ Load Factor ก่อนคิด (ฐานปีก่อนหน้าจึงเป็นของชุดที่กรองเดียวกัน)
 *   ต้นทาง/ปลายทาง/กลุ่มบริการ → ไฟล์ LF ไม่มีให้กรอง ขึ้นบรรทัดบอก (FilterScope)
 *   เดิมมีหัวบรรทัด "ข้อมูลล่าสุด … · ไม่ขึ้นกับตัวกรองด้านบน" + ปุ่ม "ดูรายละเอียด →" — เจ้าของงานให้เอาออก 23 ก.ย. 2569
 * ★ โหลดไม่ขึ้น/ไฟล์รุ่นเก่า = ซ่อนทั้งแถวพร้อมบรรทัดบอกเหตุ ไม่ให้ทั้งแท็บพังเพราะข้อมูลชุดนี้
 */
import { useMemo } from "react";
import { useLoadFactor } from "../../../lib/data/useLoadFactor";
import { hasTonKm, overview, periodFor } from "../../../lib/tonkm/calc";
import { readTargetPct } from "../../../lib/tonkm/prefs";
import { openExecTab } from "../../../lib/ui/execTab";
import TonKmCards, { periodStr } from "./TonKmCards";
import SourceTag from "../../../lib/ui/SourceTag";
import { FilterScope } from "../../dash-demo/filter";
import type { DemoFilter } from "../../dash-demo/filter";

export default function TonKmDemoRow({ f }: { f: DemoFilter }) {
  const { data, error } = useLoadFactor();
  const x = readTargetPct();
  const trips = useMemo(
    () => (data ? data.trips.filter((t) => (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk)) : []),
    [data, f.ft, f.vk]);
  const p = useMemo(() => periodFor(trips, f.year, f.from, f.to), [trips, f.year, f.from, f.to]);
  const ov = useMemo(() => (p && hasTonKm(trips) ? overview(trips, p, x) : null), [trips, p, x]);

  if (error || (data && !hasTonKm(data.trips))) {
    return (
      <p className="dz-note tk-demo-note">
        กำไรส่วนเกิน/ตัน-กม.: {error ? "โหลดข้อมูล Load Factor ไม่ได้" : "ไฟล์ Load Factor รุ่นเก่า — รัน python etl/build_loadfactor.py ใหม่"}
      </p>
    );
  }
  if (!data) return null;
  const scope = <FilterScope f={f} uses={["year", "month", "ft", "vk"]} why="ไฟล์ Load Factor ไม่มีต้นทาง/ปลายทางแยกและไม่มีกลุ่มบริการ" />;
  if (!ov) {
    return (
      <div className="tk-demo-note">
        <p className="dz-note">กำไรส่วนเกิน/ตัน-กม.: ไม่มีเที่ยวในไฟล์ Load Factor ตามตัวกรองที่เลือก</p>
        {scope}
      </div>
    );
  }
  return (
    <div className="tk-demo" title={`ช่วงที่แสดง ${periodStr(ov.period)}`}>
      {/* คนละชุดกับหัวหน้า (costrev/) — ป้ายขึ้นเฉพาะตอนชุดไม่ตรงกัน ไม่ใช่หัวบรรทัดที่เจ้าของงานให้เอาออก */}
      <SourceTag block sample={data.manifest.isSample} what="การ์ดตัน-กม. (ไฟล์ Load Factor)" />
      <TonKmCards ov={ov} x={x} onClick={() => openExecTab("tonkm")} />
      {scope}
    </div>
  );
}
