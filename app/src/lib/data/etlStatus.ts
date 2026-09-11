/**
 * สถานะของ ETL ที่ dev server รันให้ (plugin autoEtl ใน vite.config.ts)
 *
 * รับผ่าน HMR websocket ของ Vite — มีเฉพาะตอน dev (`import.meta.hot` เป็น undefined ตอน build)
 * บน GitHub Pages hook นี้จึงคืน null ตลอด ไม่มีผลอะไร
 *
 * ทำไมต้องมี: ETL ใช้เวลาไฟล์ละ 10-20 วินาที ถ้าเบราว์เซอร์ไม่บอกอะไร คนจะกดรีเฟรชก่อนเสร็จ
 * แล้วเข้าใจว่าไม่ทำงาน (เกิดขึ้นจริงมาแล้ว) — แดชบอร์ดจึงขึ้น "กำลังแปลง…" และรีเฟรชเองตอนเสร็จ
 */
import { useEffect, useRef, useState } from "react";

export interface EtlStatus {
  state: "idle" | "running" | "done" | "error" | "cleared";
  message: string;
  /** เวลาที่สถานะนี้เกิด (ms) — ใช้แยกเหตุการณ์ใหม่ออกจากอันเดิม */
  at: number;
}

export function useEtlStatus(): EtlStatus | null {
  const [status, setStatus] = useState<EtlStatus | null>(null);
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const on = (s: EtlStatus) => setStatus(s);
    hot.on("etl:status", on);
    // ขอสถานะล่าสุดตอนเปิดหน้า เผื่อกำลังแปลงอยู่ตั้งแต่ก่อนเราเข้ามา
    hot.send("etl:hello", {});
    return () => { hot.off("etl:status", on); };
  }, []);
  return status;
}

/**
 * รีเฟรชข้อมูลให้เองเมื่อ ETL เสร็จหรือข้อมูลถูกล้าง — เรียกจากหน้าที่ใช้ useDataset
 * ยิง reload ครั้งเดียวต่อเหตุการณ์ (เทียบด้วย at) ไม่งั้น re-render แต่ละรอบจะโหลดซ้ำ
 */
export function useAutoReloadOnEtl(status: EtlStatus | null, reload: () => void): void {
  const seen = useRef<number>(0);
  useEffect(() => {
    if (!status || status.at === seen.current) return;
    if (status.state === "done" || status.state === "cleared") {
      seen.current = status.at;
      reload();
    }
  }, [status, reload]);
}
