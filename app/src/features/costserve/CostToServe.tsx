/**
 * เมนู "Cost to Serve" ของผู้ดูแลระบบ (เจ้าของงานสั่ง 25 ก.ย. 2569) — เครื่องคำนวณตามไฟล์ HTML ที่เจ้าของงานส่งมา
 * **ไม่เชื่อมกับข้อมูลในโมเดล** (เจ้าของงานสั่ง) ตัวเลข/สูตรทั้งหมดอยู่ในหน้าเดี่ยว public/cost-to-serve/index.html
 * ★ ฝังผ่าน iframe ไม่แปลงเป็น React — หน้าต้นฉบับใช้ CSS ชื่อสามัญ (.card · table · input) ถ้าเอามาไว้ในแอปจะชนกับ index.css
 * ★ หน้าในใช้ธีมของโมเดล (สีคัดมาไว้ในหน้าเอง · ฟอนต์ส่งให้ด้วย addFonts) — เนื้อหา/สูตรยังเป็นของต้นฉบับ
 * ★ iframe อยู่ origin เดียวกัน จึงยืดความสูงตามเนื้อหาได้ (ResizeObserver ที่ body ของหน้าใน) — หน้าเว็บเลื่อนแถบเดียว
 */
import { useEffect, useRef, useState } from "react";

/**
 * คัด @font-face ของ LINE Seed จากแอปไปใส่ในหน้าใน — ไฟล์ฟอนต์อยู่ใน src/assets (Vite ใส่ hash ให้ชื่อ)
 * หน้าใน public/ จึงอ้างเองไม่ได้ · url ใน cssText เป็น path เต็มจาก Vite อยู่แล้ว iframe origin เดียวกันจึงโหลดได้
 */
function addFonts(doc: Document): void {
  if (doc.getElementById("app-fonts")) return;
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { continue; } // ชีตข้าม origin (Google Fonts) อ่าน cssRules ไม่ได้
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule && r.style.getPropertyValue("font-family").includes("LINE Seed")) rules.push(r.cssText);
    }
  }
  const el = doc.createElement("style");
  el.id = "app-fonts";
  el.textContent = rules.join("\n");
  doc.head.appendChild(el);
}

export default function CostToServe() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1600);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let ro: ResizeObserver | null = null;
    const hook = () => {
      const doc = frame.contentDocument;
      const body = doc?.body;
      if (!doc || !body) return;
      addFonts(doc);
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
