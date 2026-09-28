/**
 * โน้ตอธิบายที่ซ่อนไว้หลังปุ่ม i — กดแล้วกางข้อความลงมา กดซ้ำเพื่อซ่อน (เจ้าของงานสั่ง 28 ก.ย. 2569 "ยุบคำอธิบายเป็นตัว i")
 * ใช้แทน <Note> ที่วางบนพื้นหลังหน้า · ข้อความข้างในเป็น .dz-note เหมือนเดิม สีจึงตามธีม (--th-pageMuted)
 * กล่อง Performance Index ใช้ PiNote ของตัวเอง (ปุ่มขาวบนกล่องสีเข้ม)
 */
import { useState, type ReactNode } from "react";

export default function InfoNote({ children, label = "ดูคำอธิบาย" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="info-note">
      <button type="button" className={"info-note-b" + (open ? " on" : "")} aria-expanded={open}
        aria-label={open ? "ซ่อนคำอธิบาย" : label} title={open ? "ซ่อนคำอธิบาย" : label}
        onClick={() => setOpen((o) => !o)}>i</button>
      {open && <div className="dz-note info-note-t">{children}</div>}
    </div>
  );
}
