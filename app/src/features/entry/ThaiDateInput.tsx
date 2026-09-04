/**
 * ช่องกรอกวันที่แบบ พ.ศ. — วัน / เดือน(ชื่อไทย) / ปี(พ.ศ.)
 *
 * ทำไมไม่ใช้ <input type="date">: เบราว์เซอร์บังคับรูปแบบตาม locale ของเครื่อง
 * เครื่องที่ตั้งเป็นอังกฤษจะขึ้น mm/dd/yyyy และปีเป็น ค.ศ. เสมอ แก้ไม่ได้
 * คนกรอกที่ชินกับ 2568 จะสับสน — v5 เดิมก็เลยใช้ dropdown 3 ช่องแบบนี้ (v5:1495)
 *
 * ข้างในยังเก็บเป็น ISO (yyyy-mm-dd) เหมือนเดิมทุกที่ แปลงเฉพาะตอนแสดงผล
 */
import { useId } from "react";
import { TH_MONTHS } from "../../lib/record/date";

/** ช่วงปีที่เลือกได้ — กว้างพอสำหรับข้อมูลย้อนหลังและใบล่วงหน้า */
function yearRange(): number[] {
  const now = new Date().getFullYear();
  const out: number[] = [];
  for (let y = now - 3; y <= now + 2; y++) out.push(y);
  return out;
}

export interface ThaiDateInputProps {
  /** ISO yyyy-mm-dd หรือ "" ถ้ายังไม่เลือก */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}

export default function ThaiDateInput({ value, onChange, disabled }: ThaiDateInputProps) {
  const uid = useId();
  const [y, m, d] = value ? value.split("-") : ["", "", ""];

  const emit = (nd: string, nm: string, ny: string) => {
    const day = parseInt(nd, 10);
    const mon = parseInt(nm, 10);
    const year = parseInt(ny, 10);
    // ยังกรอกไม่ครบทั้งสามช่อง ถือว่ายังไม่มีค่า (เหมือน getDateStr เดิม)
    if (!day || day < 1 || day > 31 || !mon || !year) {
      onChange("");
      return;
    }
    onChange(`${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  const pad = (s: string) => (s ? String(parseInt(s, 10)) : "");

  return (
    <div className="thdate">
      <input
        id={uid} type="number" min={1} max={31} placeholder="วัน"
        value={pad(d ?? "")} disabled={disabled}
        onChange={(e) => emit(e.target.value, m ?? "", y ?? "")}
        aria-label="วัน"
      />
      <select
        value={pad(m ?? "")} disabled={disabled}
        onChange={(e) => emit(d ?? "", e.target.value, y ?? "")}
        aria-label="เดือน"
      >
        <option value="">เดือน</option>
        {TH_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={pad(y ?? "")} disabled={disabled}
        onChange={(e) => emit(d ?? "", m ?? "", e.target.value)}
        aria-label="ปี พ.ศ."
      >
        <option value="">ปี</option>
        {yearRange().map((ce) => (
          <option key={ce} value={ce}>{ce + 543}</option>
        ))}
      </select>
    </div>
  );
}
