/**
 * แถบบอกสถานะ ETL บนหน้าที่ใช้ข้อมูลรายได้ — ขึ้นเฉพาะตอน dev และเฉพาะตอนมีอะไรให้บอก
 *
 * running → "กำลังแปลง…" พร้อมเวลาที่เริ่ม คนจะได้รู้ว่าต้องรอ ไม่กดรีเฟรชซ้ำ
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
      {status.message}
      <span style={{ fontWeight: 400, marginLeft: 8, opacity: .75 }}>
        {status.state === "running" ? `เริ่ม ${fmtTime(status.at)} — หน้านี้จะรีเฟรชเองเมื่อเสร็จ` : fmtTime(status.at)}
      </span>
    </div>
  );
}
