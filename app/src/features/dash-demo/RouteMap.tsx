/**
 * แผนที่เส้นทาง — การ์ดซ้ายของแท็บ "กำไรรายเส้นทาง" (Demo)
 *
 * ตัวแผนที่เป็นแอปแยก (`map/` ที่ราก repo · d3 + topojson) build ด้วย `npm run build:map` ลง `public/map/`
 * แล้วฝังผ่าน iframe ตามหลักของโฟลเดอร์แผนที่ต้นฉบับ — ไม่ลาก d3 เข้า bundle ของแอปหลัก
 *
 * หลักการที่เจ้าของงานกำหนด 24 ก.ย. 2569: เปิดมา = แผนที่มีแต่จุดขึ้นลงทั้งหมด ไม่มีเส้นทางเลย · กดเส้นทางในตารางด้านขวา =
 * เส้นนั้นโผล่พร้อมรถวิ่งตามหนึ่งคัน · มุมมองแผนที่คงที่ ไม่ซูมตามเส้นที่กด ·
 * `#dark` = พื้นเข้มมีตาราง + เส้นเรืองแสงไล่สีเขียว→ฟ้าที่ลากตามรถ (ดีไซน์ "Route 1c" 24 ก.ย. 2569) ·
 * `#thai` = เฉพาะประเทศไทย 2 มิติ (ไม่มีทะเล/ประเทศเพื่อนบ้าน) พื้นหลังโปร่งเห็นพื้นการ์ด · แผนที่มีโหมด `#3d` ด้วย
 * (ผนัง + เงา + เอียง) แต่เจ้าของงานลองแล้วให้กลับเป็น 2 มิติ 24 ก.ย. 2569 — อย่าเปิดคืนโดยไม่ถาม
 *
 * คุยกันด้วย postMessage (ดูหัวข้อ "รับเส้นทางจากหน้าที่ฝังแผนที่ไว้" ท้าย map/src/map.js):
 *   แผนที่ → หน้านี้   map:ready (วาดพื้นเสร็จ) · map:drawn { keys } (เส้นที่วาดได้จริง)
 *   หน้านี้ → แผนที่   map:routes { routes } — ส่งเส้นเดียวที่กดอยู่ หรืออาร์เรย์ว่าง = ล้างแผนที่
 *
 * ★ ข้อความที่ส่งก่อน map:ready หายไปเฉย ๆ (แผนที่ยังโหลดขอบเขตจังหวัดจาก CDN อยู่) จึงต้องรอสัญญาณก่อนส่ง
 * ★ ต้นทาง/ปลายทางต้องตรงกับชื่อจุดใน map/src/network.js — ชื่อที่ไม่มีวาดไม่ได้ แผนที่แจ้งกลับผ่าน map:drawn
 */
import { useEffect, useRef, useState } from "react";

export interface MapRoute { key: string; from: string; to: string; profit: number; color: string }

/**
 * ?v= ต่อเวลาที่โหลดหน้า — ไม่งั้นแท็บที่เปิดค้างไว้ (หรือแคช index.html ของ Pages max-age=600) ยังใช้แผนที่รุ่นก่อน
 * build:map (เคยเกิดจริง 24 ก.ย. 2569: แก้ให้เหลือรถคันเดียวแล้วเจ้าของงานยังเห็นหลายคัน) · ไฟล์ js/css ในแผนที่มี hash
 * ในชื่ออยู่แล้ว โหลดซ้ำแค่ index.html 4–5 KB
 */
const srcOf = (dark: boolean) =>
  `${import.meta.env.BASE_URL}map/index.html?v=${Date.now()}#embed&bare&thai${dark ? "&dark" : ""}&tab=top`;

export default function RouteMap({ routes, onMissing, dark }: {
  /** โหมดดำ (#dark) / ขาว — ปุ่มในหน้า Demo สลับได้ ส่งผ่าน map:theme ไม่ต้องโหลด iframe ใหม่ */
  dark: boolean;
  /** เส้นที่จะแสดง — หน้า Demo ส่งเฉพาะเส้นที่ผู้ใช้กด (memo ไว้ ไม่งั้นแผนที่วาดใหม่ทุก render) */
  routes: MapRoute[];
  /** เส้นที่ส่งไปแต่แผนที่วาดไม่ได้ (ชื่อจุดไม่มีพิกัด หรือต้นทาง = ปลายทาง) — คิดจากชุดที่ส่งไปล่าสุด */
  onMissing: (keys: string[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // โหมดตอนเปิดครั้งแรกอยู่ใน # ของ src (ไม่เห็นพื้นผิดสีแวบก่อน map:ready) · เปลี่ยนทีหลังส่งเป็นข้อความ
  const [src] = useState(() => srcOf(dark));
  const [ready, setReady] = useState(false);
  // เก็บ callback ล่าสุดใน ref — ตัวฟังข้อความผูกครั้งเดียว ไม่ต้องถอด/ผูกใหม่ทุก render
  const missing = useRef(onMissing);
  missing.current = onMissing;
  /** key ของชุดที่ส่งไปล่าสุด — map:drawn ตอบกลับมาเฉพาะที่วาดได้ ส่วนต่างคือที่วาดไม่ได้ */
  const sent = useRef<string[]>([]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data) return;
      if (e.data.type === "map:ready") setReady(true);
      if (e.data.type === "map:drawn") {
        const ok: string[] = e.data.keys ?? [];
        missing.current(sent.current.filter((k) => !ok.includes(k)));
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  useEffect(() => {
    if (!ready) return;
    sent.current = routes.map((r) => r.key);
    frame.current?.contentWindow?.postMessage({ type: "map:routes", routes }, "*");
  }, [ready, routes]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "map:theme", dark }, "*");
  }, [ready, dark]);

  return (
    <div className="rp-map">
      <iframe ref={frame} src={src} title="แผนที่เส้นทาง" loading="lazy" />
      {!ready && <div className="rp-map-wait">กำลังโหลดแผนที่…</div>}
    </div>
  );
}
