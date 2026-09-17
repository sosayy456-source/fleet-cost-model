/**
 * กล่องตารางที่เลื่อนได้ในตัว และแสดง "ทุกแถว" โดยไม่ทำให้หน้ายาวเกิน
 *
 * ของเดิมทุกตารางตัดที่ 300 แถวแรก (`list.slice(0, 300)`) แล้วบอกให้ใช้ตัวกรอง —
 * เจ้าของข้อมูลต้องการเห็นทั้งหมด (16 ก.ย. 2569) แต่ข้อมูลจริงมีหลายหมื่นแถว
 * ถ้าวาง DOM ทีเดียวทั้งหมดเบราว์เซอร์จะค้าง จึงวาดทีละ `step` แถว แล้วเติมต่อ
 * เมื่อผู้ใช้เลื่อนถึงท้ายกล่อง — ผู้ใช้เห็นเป็นตารางเดียวที่เลื่อนไปได้จนสุด
 *
 * ใช้เป็น render-prop เพราะแต่ละหน้าวาดแถวไม่เหมือนกัน กล่องนี้จัดการแค่ "ช่วงที่วาด"
 * `rows` ต้องเป็นอาร์เรย์ที่ memo แล้ว — เปลี่ยน identity = ข้อมูลใหม่ → เริ่มนับใหม่จากบน
 */
import { useEffect, useState, type ReactNode, type UIEvent } from "react";

const STEP = 300;
const nf = new Intl.NumberFormat("th-TH");

export default function GrowBox<T>({ rows, render, step = STEP, maxHeight = "60vh" }: {
  rows: T[];
  render: (shown: T[]) => ReactNode;
  step?: number;
  maxHeight?: number | string;
}) {
  const [n, setN] = useState(step);
  useEffect(() => { setN(step); }, [rows, step]);

  const more = Math.max(0, rows.length - n);
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!more) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) setN((v) => Math.min(v + step, rows.length));
  };

  return (
    <div className="scroll scroll-y" style={{ maxHeight }} onScroll={onScroll}>
      {render(more ? rows.slice(0, n) : rows)}
      {more > 0 && (
        <div className="grow-more">เลื่อนลงเพื่อดูต่อ · เหลืออีก {nf.format(more)} รายการ จากทั้งหมด {nf.format(rows.length)}</div>
      )}
    </div>
  );
}
