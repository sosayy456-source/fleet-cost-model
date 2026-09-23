/**
 * แถวการ์ดกำไรส่วนเกิน/ตัน-กม. ในเมนู Demo › กำไรรายเส้นทาง (ต่อจากแถว "กำไรเฉลี่ย/บิล" — เจ้าของงานสั่ง 23 ก.ย. 2569)
 *
 * ★ ไม่ขึ้นกับตัวกรองของแท็บนั้น — คนละชุดข้อมูล (loadfactor/ กับ costrev/) และไฟล์ Load Factor ไม่มีกลุ่มบริการ
 *   จึงตรึงที่เดือนล่าสุดของไฟล์เสมอ (การ์ดใบแรกบอกเดือนในวงเล็บ) · กดการ์ดใบไหนก็ไปแท็บรายละเอียดใน Executive Dashboard
 *   เดิมมีหัวบรรทัด "ข้อมูลล่าสุด … · ไม่ขึ้นกับตัวกรองด้านบน" + ปุ่ม "ดูรายละเอียด →" — เจ้าของงานให้เอาออก 23 ก.ย. 2569
 * ★ โหลดไม่ขึ้น/ไฟล์รุ่นเก่า = ซ่อนทั้งแถวพร้อมบรรทัดบอกเหตุ ไม่ให้ทั้งแท็บพังเพราะข้อมูลชุดนี้
 */
import { useMemo } from "react";
import { useLoadFactor } from "../../../lib/data/useLoadFactor";
import { hasTonKm, latestPeriod, overview } from "../../../lib/tonkm/calc";
import { readTargetPct } from "../../../lib/tonkm/prefs";
import { openExecTab } from "../../../lib/ui/execTab";
import TonKmCards, { periodStr } from "./TonKmCards";

export default function TonKmDemoRow() {
  const { data, error } = useLoadFactor();
  const x = readTargetPct();
  const ov = useMemo(() => {
    if (!data || !hasTonKm(data.trips)) return null;
    const p = latestPeriod(data.trips);
    return p ? overview(data.trips, p, x) : null;
  }, [data, x]);

  if (error || (data && !ov)) {
    return (
      <p className="dz-note tk-demo-note">
        กำไรส่วนเกิน/ตัน-กม.: {error ? "โหลดข้อมูล Load Factor ไม่ได้" : "ไฟล์ Load Factor รุ่นเก่า — รัน python etl/build_loadfactor.py ใหม่"}
      </p>
    );
  }
  if (!ov) return null;
  return (
    <div className="tk-demo" title={`ข้อมูลล่าสุด ${periodStr(ov.period)} · ไม่ขึ้นกับตัวกรองด้านบน`}>
      <TonKmCards ov={ov} x={x} onClick={() => openExecTab("tonkm")} />
    </div>
  );
}
