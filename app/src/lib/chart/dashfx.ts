/**
 * ลูกเล่นของแดชบอร์ด — ถอดจาก moveDashInk() ใน index.html บน main · ตัวเลขในการ์ด fade-down (แทน countUp() ของ main)
 *
 * ทั้งสองตัวทำงานกับ DOM ที่วาดเสร็จแล้ว (วัดตำแหน่งแท็บ / เขียนทับข้อความในการ์ด)
 * จึงเขียนเป็น hook ที่ยิงหลัง paint แทนที่จะยัดเข้าไปใน render
 */
import { useEffect } from "react";
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
    // ฟอนต์ไทยโหลดทีหลัง ความกว้างปุ่มจึงขยับได้อีกรอบ — วัดซ้ำทั้งตามเวลาและตอนฟอนต์โหลดเสร็จจริง
    const t = setTimeout(move, 250);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) move(); });
    window.addEventListener("resize", move);
    return () => { alive = false; clearTimeout(t); window.removeEventListener("resize", move); };
  }, [barRef, active]);
}

/**
 * ตัวเลขในการ์ดค่อย ๆ โผล่แบบ fade-down (นุ่ม) — ลอยลงจากข้างบนพร้อมจางเข้า ไล่เริ่มทีละใบ
 * (เจ้าของงานสั่ง 26 ก.ย. 2569 แทนการนับขึ้นจาก 0 ของ main · ท่าอยู่ที่ .num-fd ท้าย index.css)
 *
 * ยิงใหม่ทุกครั้งที่เปลี่ยนแท็บหรือตัวกรอง (deps เดียวกับของเดิม) · ไม่แตะ textContent แล้ว
 * ข้อความที่ React วาดจึงเป็นค่าจริงเสมอ ไม่มีจังหวะที่ตัวเลขผิด
 */
export function useNumFade(paneRef: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useEffect(() => {
    const box = paneRef.current;
    if (!box) return;
    const els = box.querySelectorAll<HTMLElement>(".dz-kc .v, .op-tile .op-val b, .op-passline b");
    els.forEach((el) => el.classList.remove("num-fd"));
    // อ่าน offsetWidth ครั้งเดียวให้เบราว์เซอร์ล้างท่าเดิม ถอด-ใส่คลาสแล้วท่าจึงเล่นซ้ำได้
    void box.offsetWidth;
    els.forEach((el, i) => {
      el.style.animationDelay = `${80 + i * 55}ms`;
      el.classList.add("num-fd");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
