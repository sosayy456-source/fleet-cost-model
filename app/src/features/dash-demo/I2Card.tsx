import { useState, type ReactNode } from "react";
import { useFitText } from "../../lib/ui/useFitText";

/**
 * การ์ดของส่วน Inefficient Transportation Cost (ดีไซน์ที่เจ้าของงานส่ง 28 ก.ย. 2569 — แทน Hero): tone = dark (LF เฉลี่ย) · light (สองใบสีอ่อน) · red (เที่ยวเปล่า)
 * ชื่อ → ตัวเลขใหญ่ → บรรทัดรอง → ป้ายแคปซูล → หมายเหตุเล็ก · มี onClick = กดทั้งใบเปิดแท็บปลายทางของ Overall Dashboard
 * ใช้ร่วมกับการ์ดเที่ยวเปล่าของแท็บ Empty Trips ด้วย (EmptyCards ใน dash-costrev/EmptyHeroes.tsx)
 */
export default function I2Card({ tone, cls, l, unit, v, sub, pill, note, info, art, onClick }: {
  tone: "dark" | "light" | "red"; cls: string; l: string; unit?: string; v: string; art?: string;
  sub?: ReactNode; pill?: ReactNode; note?: ReactNode;
  /** รายละเอียดรองที่ย้ายเข้าปุ่ม i เล็กซ้ายล่างของการ์ด (เจ้าของงานสั่ง 29 ก.ย. 2569) */
  info?: ReactNode;
  onClick?: () => void;
}) {
  // ตัวเลขใหญ่ย่อเองให้พอดีการ์ดเสมอ (ข้อมูลจริงตัวเลขยาวกว่าชุดตัวอย่าง · เจ้าของงานขอ 29 ก.ย. 2569)
  const vRef = useFitText<HTMLDivElement>([v]);
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className={`i2c ${tone} ${cls}`} style={onClick ? undefined : { cursor: "default" }}
      {...(onClick && {
        role: "button", tabIndex: 0, onClick,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
      })}>
      <div className="i2c-h"><span className="i2c-l">{l}</span>{unit && <span className="i2c-u">{unit}</span>}</div>
      {/* รูปประกอบข้างตัวเลข (เจ้าของงานส่งรูป 29 ก.ย. 2569) — ตัวเลขย่อเองถ้าที่เหลือไม่พอ (useFitText) */}
      {art && <img className="i2c-art" src={art} alt="" aria-hidden="true" />}
      <div className="i2c-vrow">
        <div className="i2c-v num-fd" key={v} ref={vRef}>{v}</div>
      </div>
      {sub && <div className="i2c-sub">{sub}</div>}
      {pill && <div className="i2c-pill">{pill}</div>}
      {note && <div className="i2c-note">{note}</div>}
      {info && <>
        {/* ปุ่ม i ไม่เปิดแท็บปลายทาง (หยุด event ไม่ให้ถึงการ์ด) */}
        <button type="button" className={"i2c-i" + (showInfo ? " on" : "")} aria-expanded={showInfo} aria-label="รายละเอียดเพิ่มเติม"
          onClick={(e) => { e.stopPropagation(); setShowInfo((o) => !o); }}
          onKeyDown={(e) => e.stopPropagation()}>i</button>
        {showInfo && <div className="i2c-info" onClick={(e) => e.stopPropagation()}>{info}</div>}
      </>}
    </div>
  );
}
