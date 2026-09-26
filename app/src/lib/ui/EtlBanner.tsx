/**
 * แถบบอกสถานะ ETL บนหน้าที่ใช้ข้อมูลรายได้ — ขึ้นเฉพาะตอน dev และเฉพาะตอนมีอะไรให้บอก
 *
 * running → "กำลังแปลง…" พร้อมเวลาที่เริ่ม คนจะได้รู้ว่าต้องรอ ไม่กดรีเฟรชซ้ำ
 *           + % และหลอดความคืบหน้าเมื่อ python เริ่มแล้ว (ตอนรอคิวยังไม่มี %)
 * error   → บอกว่าพัง ให้ไปดู terminal
 * done / cleared → หน้ารีเฟรชเองไปแล้ว (useAutoReloadOnEtl) แค่แจ้งสั้น ๆ แล้วหายไป
 */
import { useEffect, useState } from "react";
import type { EtlStatus } from "../data/etlStatus";

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function EtlBanner({ status }: { status: EtlStatus | null }) {
  // done/cleared โชว์แค่ครู่เดียวพอ ไม่ต้องค้างไว้บังหน้า
  const [hideDone, setHideDone] = useState(false);
  useEffect(() => {
    setHideDone(false);
    if (status?.state === "done" || status?.state === "cleared") {
      const t = setTimeout(() => setHideDone(true), 6000);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!status || status.state === "idle") return null;
  if ((status.state === "done" || status.state === "cleared") && hideDone) return null;

  const running = status.state === "running";
  const pct = status.pct;
  const tone = status.state === "error"
    ? { background: "var(--red-soft, #FBE9E7)", color: "var(--red)", border: "var(--red)" }
    : status.state === "running"
      ? { background: "var(--orange-soft)", color: "var(--orange-dark)", border: "var(--orange-line)" }
      : { background: "var(--green-soft)", color: "var(--green)", border: "var(--green-line)" };

  return (
    <div className="banner" style={{ background: tone.background, color: tone.color, borderColor: tone.border }}>
      {status.state === "running" && "⏳ "}
      {status.state === "error" && "✗ "}
      {(status.state === "done" || status.state === "cleared") && "✓ "}
      {running && pct != null && <b style={{ marginRight: 6 }}>{pct}%</b>}
      {status.message}
      <span style={{ fontWeight: 400, marginLeft: 8, opacity: .75 }}>
        {running ? `เริ่ม ${fmtTime(status.at)} — หน้านี้จะรีเฟรชเองเมื่อเสร็จ` : fmtTime(status.at)}
      </span>
      {/* % มาจากจำนวนไฟล์ที่ทำเสร็จ (etl/src/progress.py) ไม่ใช่เวลาที่เหลือ — ไฟล์ใหญ่เล็กไม่เท่ากัน */}
      {running && pct != null && (
        <div style={{ marginTop: 8 }}>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            style={{ height: 8, borderRadius: 999, background: "rgba(0,0,0,.08)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "currentColor",
              transition: "width .4s ease" }} />
          </div>
          {status.step && <div style={{ fontWeight: 400, fontSize: 12.5, marginTop: 4, opacity: .8 }}>{status.step}</div>}
        </div>
      )}
    </div>
  );
}
