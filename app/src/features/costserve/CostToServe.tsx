/**
 * เมนู "Cost to Serve" ของผู้ดูแลระบบ (เจ้าของงานสั่ง 25 ก.ย. 2569) — เครื่องคำนวณตามไฟล์ HTML ที่เจ้าของงานส่งมา
 * **ไม่เชื่อมกับข้อมูลในโมเดล** (เจ้าของงานสั่ง) ตัวเลข/สูตรทั้งหมดอยู่ในหน้าเดี่ยว public/cost-to-serve/index.html
 * ★ ฝังผ่าน iframe ไม่แปลงเป็น React — หน้าต้นฉบับใช้ CSS ชื่อสามัญ (.card · table · input) ถ้าเอามาไว้ในแอปจะชนกับ index.css
 * ★ iframe อยู่ origin เดียวกัน จึงยืดความสูงตามเนื้อหาได้ (ResizeObserver ที่ body ของหน้าใน) — หน้าเว็บเลื่อนแถบเดียว
 */
import { useEffect, useRef, useState } from "react";

export default function CostToServe() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1600);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let ro: ResizeObserver | null = null;
    const hook = () => {
      const body = frame.contentDocument?.body;
      if (!body) return;
      const fit = () => setH(body.scrollHeight);
      ro?.disconnect();
      ro = new ResizeObserver(fit);
      ro.observe(body);
      fit();
    };
    frame.addEventListener("load", hook);
    hook();
    return () => { frame.removeEventListener("load", hook); ro?.disconnect(); };
  }, []);

  return (
    <iframe ref={ref} title="เครื่องคำนวณ Cost-to-Serve" src={`${import.meta.env.BASE_URL}cost-to-serve/index.html`}
      style={{ display: "block", width: "100%", height: h, border: 0, background: "transparent" }} />
  );
}
