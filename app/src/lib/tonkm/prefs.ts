/**
 * ค่าที่ผู้ใช้ตั้งเองของกำไรส่วนเกิน/ตัน-กม. — X% ของเป้าหมาย
 * เก็บใน localStorage ให้การ์ดใน Demo กับแท็บของ Executive Dashboard ใช้ค่าเดียวกัน
 * (เป็นความสะดวกต่อเครื่อง ไม่ใช่ข้อมูลที่ต้องแชร์ — อ่าน/เขียนพังได้ ต้องไม่ทำให้หน้าพัง)
 */
import { useCallback, useState } from "react";
import { DEFAULT_X } from "./calc";

const KEY = "tonKmTargetPct";

export function readTargetPct(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return localStorage.getItem(KEY) != null && Number.isFinite(v) ? v : DEFAULT_X;
  } catch {
    return DEFAULT_X;
  }
}

export function useTargetPct(): [number, (x: number) => void] {
  const [x, setX] = useState(readTargetPct);
  const set = useCallback((v: number) => {
    setX(v);
    try { localStorage.setItem(KEY, String(v)); } catch { /* ไม่เก็บก็ใช้ค่าในหน้าต่อได้ */ }
  }, []);
  return [x, set];
}
