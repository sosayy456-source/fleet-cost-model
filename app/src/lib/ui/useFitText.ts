/**
 * ย่อตัวอักษรของกล่องให้อยู่ในบรรทัดเดียวพอดีความกว้างเสมอ (เจ้าของงานขอ 29 ก.ย. 2569 — ตัวเลขข้อมูลจริงยาวกว่าชุดตัวอย่าง
 * เช่น 124,110,369 บาท จะล้นการ์ด)
 *
 * วิธี: ล้าง font-size ที่เคยตั้ง → ได้ขนาดเต็มจาก CSS → ถ้าข้อความกว้างเกินกล่อง ย่อตามสัดส่วน (ไม่ต่ำกว่า `min` px)
 * คิดใหม่เมื่อข้อความเปลี่ยน (deps) และเมื่อกล่องเปลี่ยนขนาด (ResizeObserver) · ข้อความสั้นพอ = ใช้ขนาดเต็มตาม CSS เหมือนเดิม
 * ★ กล่องต้องเป็น block กว้างเต็มพ่อ + `white-space:nowrap` (ไม่งั้นข้อความตัดบรรทัดแทนการล้น วัดไม่เจอ)
 */
import { useLayoutEffect, useRef, type DependencyList } from "react";

export function useFitText<T extends HTMLElement>(deps: DependencyList, min = 18) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      const full = parseFloat(getComputedStyle(el).fontSize);
      // วัดกับความกว้างของกล่องพ่อ ไม่ใช่ตัวเอง — กล่องที่เป็น inline-block (เช่น .num-fd) ยืดตามข้อความ ตัวเองจึงไม่เคย "ล้น"
      const box = el.parentElement ?? el;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), need = el.scrollWidth;
      if (avail > 0 && need > avail + 0.5) el.style.fontSize = `${Math.max(min, Math.floor(full * avail / need * 10) / 10)}px`;
    };
    fit();
    // ฟอนต์โหลดเสร็จทีหลังความกว้างตัวอักษรเปลี่ยน — วัดซ้ำอีกรอบ
    document.fonts?.ready.then(fit).catch(() => {});
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
