/**
 * ช่องกรอกวันที่แบบ พ.ศ. — วัน / เดือน(ชื่อไทย) / ปี(พ.ศ.)
 *
 * ทำไมไม่ใช้ <input type="date">: เบราว์เซอร์บังคับรูปแบบตาม locale ของเครื่อง
 * เครื่องที่ตั้งเป็นอังกฤษจะขึ้น mm/dd/yyyy และปีเป็น ค.ศ. เสมอ แก้ไม่ได้
 * คนกรอกที่ชินกับ 2568 จะสับสน — v5 เดิมก็เลยใช้ dropdown 3 ช่องแบบนี้ (v5:1495)
 *
 * ข้างในยังเก็บเป็น ISO (yyyy-mm-dd) เหมือนเดิมทุกที่ แปลงเฉพาะตอนแสดงผล
 *
 * ★ สามช่องนี้ต้องเก็บสถานะของตัวเองไว้ในคอมโพเนนต์ ห้ามอ่านค่าที่จะแสดงจาก prop ตรง ๆ
 *   เพราะระหว่างกรอกจะมีจังหวะที่ยังไม่ครบสามช่อง ซึ่ง ISO ประกอบไม่ได้ → ส่งขึ้นไปเป็น ""
 *   ถ้าช่องอ่านค่าจาก prop ค่าที่เพิ่งเลือกจะถูกล้างทิ้งทันทีทุกครั้ง กรอกไม่เข้าเลยสักช่อง
 *   (v5 เดิมไม่เจอเพราะเป็น DOM ล้วน ค่าค้างอยู่ในช่องเอง ไม่มีใครเขียนทับ)
 */
import { useEffect, useId, useRef, useState } from "react";
import { TH_MONTHS } from "../../lib/record/date";

/** ช่วงปีที่เลือกได้ — กว้างพอสำหรับข้อมูลย้อนหลังและใบล่วงหน้า */
function yearRange(): number[] {
  const now = new Date().getFullYear();
  const out: number[] = [];
  for (let y = now - 3; y <= now + 2; y++) out.push(y);
  return out;
}

/** สามช่องที่ผู้ใช้เห็น — เก็บเป็นสตริงดิบ ยังไม่ต้องครบก็ได้ */
interface Parts { d: string; m: string; y: string }

const EMPTY: Parts = { d: "", m: "", y: "" };

/** ISO → สามช่อง (ตัดเลข 0 นำหน้าออกให้ตรงกับ value ของ <option>) */
function split(iso: string): Parts {
  if (!iso) return EMPTY;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return EMPTY;
  return { d: String(parseInt(d, 10)), m: String(parseInt(m, 10)), y };
}

/** สามช่อง → ISO ("" ถ้ายังกรอกไม่ครบหรือวันที่ไม่ถูกต้อง — เหมือน getDateStr เดิม) */
function join({ d, m, y }: Parts): string {
  const day = parseInt(d, 10);
  const mon = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!day || day < 1 || day > 31 || !mon || !year) return "";
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface ThaiDateInputProps {
  /** ISO yyyy-mm-dd หรือ "" ถ้ายังไม่เลือก */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}

export default function ThaiDateInput({ value, onChange, disabled }: ThaiDateInputProps) {
  const uid = useId();
  const [parts, setParts] = useState<Parts>(() => split(value));
  /** ค่าล่าสุดที่คอมโพเนนต์นี้ส่งออกไปเอง — ใช้แยกว่า prop เปลี่ยนเพราะเราหรือเพราะข้างนอก */
  const mine = useRef(value);

  // prop เปลี่ยนจากข้างนอก (เปิดใบเก่า / โหลดจากชีต / กดยกเลิกการแก้ไข) → ดึงมาแสดง
  // ถ้าเปลี่ยนเพราะเราเพิ่งส่งขึ้นไปเอง ต้องไม่แตะ ไม่งั้นจะไปล้างช่องที่กรอกค้างไว้
  useEffect(() => {
    if (value === mine.current) return;
    mine.current = value;
    setParts(split(value));
  }, [value]);

  const emit = (next: Parts) => {
    setParts(next);
    const iso = join(next);
    if (iso === mine.current) return;
    mine.current = iso;
    onChange(iso);
  };

  return (
    <div className="dmy">
      <input
        id={uid} type="number" min={1} max={31} placeholder="วัน"
        value={parts.d} disabled={disabled}
        onChange={(e) => emit({ ...parts, d: e.target.value })}
        aria-label="วัน"
      />
      <select
        value={parts.m} disabled={disabled}
        onChange={(e) => emit({ ...parts, m: e.target.value })}
        aria-label="เดือน"
      >
        <option value="">เดือน</option>
        {TH_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={parts.y} disabled={disabled}
        onChange={(e) => emit({ ...parts, y: e.target.value })}
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
