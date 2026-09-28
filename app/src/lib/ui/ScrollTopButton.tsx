/**
 * ปุ่มย้อนขึ้นบนสุดของหน้า — มุมขวาล่างของจอ ทุกหน้า (เจ้าของงานสั่ง 28 ก.ย. 2569)
 * โผล่เมื่อเลื่อนลงเกิน 400px · เลื่อนแบบนุ่ม เว้นแต่ผู้ใช้ตั้งลดการเคลื่อนไหว
 */
import { useEffect, useState } from "react";

const SHOW_AT = 400;

export default function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > SHOW_AT);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const up = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <button type="button" className={"scroll-top" + (show ? " show" : "")} onClick={up}
      aria-label="ขึ้นบนสุดของหน้า" title="ขึ้นบนสุดของหน้า" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
