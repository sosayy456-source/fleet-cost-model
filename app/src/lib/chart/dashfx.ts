/**
 * ลูกเล่นของแดชบอร์ด — ถอดจาก moveDashInk() และ countUp() ใน index.html บน main
 *
 * ทั้งสองตัวทำงานกับ DOM ที่วาดเสร็จแล้ว (วัดตำแหน่งแท็บ / เขียนทับข้อความในการ์ด)
 * จึงเขียนเป็น hook ที่ยิงหลัง paint แทนที่จะยัดเข้าไปใน render
 */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * เส้นใต้แท็บที่เลื่อนตามปุ่มที่เลือกอยู่
 * main วัด offsetWidth/offsetLeft ของ .dtab.active แล้วสั่ง .dink ตามนั้น
 */
export function useDashInk(barRef: RefObject<HTMLElement | null>, active: string): void {
  useEffect(() => {
    const move = () => {
      const bar = barRef.current;
      if (!bar) return;
      const ink = bar.querySelector<HTMLElement>(".dink");
      const on = bar.querySelector<HTMLElement>(".dtab.active");
      if (!ink || !on) return;
      ink.style.width = on.offsetWidth + "px";
      ink.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    move();
    // ฟอนต์ไทยโหลดทีหลัง ความกว้างปุ่มจึงขยับได้อีกรอบ
    const t = setTimeout(move, 250);
    window.addEventListener("resize", move);
    return () => { clearTimeout(t); window.removeEventListener("resize", move); };
  }, [barRef, active]);
}

/**
 * นับตัวเลขจาก 0 ขึ้นไปหาค่าจริง แล้วคืนข้อความเดิมเป๊ะ ๆ
 * (คงรูปแบบคอมมา ทศนิยม เครื่องหมายลบ และหน่วยที่ต่อท้าย)
 *
 * main เรียกทุกครั้งที่เปลี่ยนแท็บหรือตัวกรอง — ที่นี่ผูกกับ deps เดียวกัน
 * ข้อความล้วน (เช่น ชื่อลูกค้า) ไม่มีตัวเลขจับได้ ก็ปล่อยผ่านไป
 */
export function useCountUp(paneRef: RefObject<HTMLElement | null>, deps: unknown[]): void {
  const runId = useRef(0);
  useEffect(() => {
    const box = paneRef.current;
    if (!box) return;
    const run = String(++runId.current);
    const timers: number[] = [];

    box.querySelectorAll<HTMLElement>(".dz-kc .v").forEach((el, i) => {
      const txt = el.dataset.real !== undefined ? el.dataset.real : (el.textContent ?? "");
      el.dataset.real = txt;
      const m = txt.match(/-?[\d,]*\.?\d+/);
      if (!m) return;
      const target = parseFloat(m[0].replace(/,/g, ""));
      if (!Number.isFinite(target) || target === 0) return;
      const dec = (m[0].split(".")[1] ?? "").length;
      const dur = 900, delay = 120 + i * 55;
      let t0: number | null = null;
      const finish = () => { if (runId.current === +run) el.textContent = txt; };
      const step = (now: number) => {
        if (runId.current !== +run) return;
        if (t0 === null) { t0 = now; el.textContent = txt.replace(m[0], (0).toFixed(dec)); }
        const p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
        if (p >= 1) { finish(); return; }
        const v = target * (1 - Math.pow(1 - p, 3));
        el.textContent = txt.replace(m[0],
          v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // กันตัวเลขค้าง ถ้าเฟรมไม่ทำงาน (แท็บถูกซ่อน / prefers-reduced-motion)
      timers.push(window.setTimeout(finish, delay + dur + 400));
    });

    return () => { runId.current++; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
