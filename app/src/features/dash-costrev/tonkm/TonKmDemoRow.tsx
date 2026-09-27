/**
 * ★ 28 ก.ย. 2569 (ปรับปรุงโมเดล2.pdf) แถวการ์ด 4 ใบเหลือการ์ดเด่นใบเดียว (TonKmHero) ในแถวบนของ Profit Per Route
 *   ชนิดรถกำไรสูงสุด/ต่ำสุด/ต่ำกว่าเป้าตัดออกจากหน้านี้ (ยังอยู่ใน TonKmCards ของแท็บ Contribution Margin) — ข้อความข้างล่างเป็นประวัติ
 *
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
import { periodStr, rateStr } from "./TonKmCards";
import { Hero } from "../../dash-fleet/parts";
import { fmt } from "../common";
import SourceTag from "../../../lib/ui/SourceTag";
import { FilterScope } from "../../dash-demo/filter";
import type { DemoFilter } from "../../dash-demo/filter";

/** ชุด LF ที่กรองแล้ว + ภาพรวมของช่วง — ใช้ทั้งแถวการ์ดเดิมและการ์ดเด่นของ Executive Dashboard */
function useTonKmDemo(f: DemoFilter) {
  const { data, error } = useLoadFactor();
  const x = readTargetPct();
  const trips = useMemo(
    () => (data ? data.trips.filter((t) => (!f.ft || t.ft === f.ft) && (!f.vk || t.vk === f.vk)) : []),
    [data, f.ft, f.vk]);
  const p = useMemo(() => periodFor(trips, f.year, f.from, f.to), [trips, f.year, f.from, f.to]);
  const ov = useMemo(() => (p && hasTonKm(trips) ? overview(trips, p, x) : null), [trips, p, x]);
  return { data, error, ov };
}

/**
 * การ์ดเด่นกำไรส่วนเกิน/ตัน-กม. (กล่องที่ 2 ของแถวบน · ปรับปรุงโมเดล2.pdf 28 ก.ย. 2569 = การ์ดแรกของ TonKmCards เดิม)
 * กดแล้วเปิด Overall Dashboard › Contribution Margin เหมือนเดิม · ไฟล์ LF หาย/รุ่นเก่า/ไม่มีเที่ยว = ตัวเลข "–" พร้อมเหตุ
 */
export function TonKmHero({ f }: { f: DemoFilter }) {
  const { data, error, ov } = useTonKmDemo(f);
  const why = error ? "โหลดข้อมูล Load Factor ไม่ได้"
    : data && !hasTonKm(data.trips) ? "ไฟล์ Load Factor รุ่นเก่า — รัน build_loadfactor.py ใหม่"
      : data && !ov ? "ไม่มีเที่ยวในไฟล์ Load Factor ตามตัวกรอง" : null;
  const up = ov?.change != null && ov.change >= 0;
  return (
    <Hero kind="cust" l="กำไรส่วนเกิน/ตัน-กม. เฉลี่ยรวม" unit="บาท/ตัน-กม." v={ov ? rateStr(ov.all.rate) : "–"}
      onClick={() => openExecTab("tonkm")}
      s={why ?? (!ov ? "กำลังโหลด…" : ov.change == null ? `ไม่มีข้อมูล${periodStr(ov.prev)}ให้เทียบ`
        : `${up ? "▲" : "▼"} ${fmt(Math.abs(ov.change), 1)}% เทียบ ${periodStr(ov.prev)}`)}
      title={ov ? `ช่วง ${periodStr(ov.period)} · กดเพื่อดูรายละเอียดใน Overall Dashboard` : undefined} />
  );
}

/** บรรทัดบอกขอบเขตตัวกรอง + ป้ายชุดข้อมูลของการ์ดตัน-กม. (วางใต้แถวการ์ด) */
export function TonKmScope({ f }: { f: DemoFilter }) {
  const { data } = useTonKmDemo(f);
  if (!data) return null;
  return <>
    <SourceTag block sample={data.manifest.isSample} what="การ์ดตัน-กม. (ไฟล์ Load Factor)" />
    <FilterScope f={f} uses={["year", "month", "ft", "vk"]} why="การ์ดกำไรส่วนเกิน/ตัน-กม.: ไฟล์ Load Factor ไม่มีต้นทาง/ปลายทางแยกและไม่มีกลุ่มบริการ" />
  </>;
}
