/**
 * กระโดดจากหน้าอื่นไปแท็บที่ระบุของ Executive Dashboard (เช่นการ์ดในแท็บ "ข้อ 2" ของ Demo)
 *
 * ★ ส่งแท็บผ่าน sessionStorage ไม่ใช่ใส่ใน hash — `readHash()` ใน App.tsx เทียบ hash ทั้งก้อนกับรายชื่อเมนู
 *   ถ้าต่อ `/lf` ท้าย hash จะหาเมนูไม่เจอแล้วเด้งไปหน้าแรกของตำแหน่ง
 * ★ ไฟล์นี้แยกจาก CostRevDash เพราะหน้านั้นเป็น lazyPage — import ตรงจะดึงทั้งก้อนเข้ามาในหน้าที่เรียก
 * ★ อ่าน (`peekExecTab`) กับลบ (`clearExecTab`) แยกกัน — ผู้รับอ่านใน initializer ของ useState แล้วลบใน useEffect
 *   ถ้าอ่านแล้วลบในที่เดียว StrictMode เรียก initializer สองรอบ รอบหลังได้ null แล้วเปิดแท็บแรกแทน
 *   ต้องลบทิ้งเสมอ ไม่งั้นเข้าเมนูเองครั้งถัดไปจะค้างแท็บเดิม
 */
const KEY = "execDashTab";
/** id ของส่วนในแท็บที่ต้องเลื่อนไปหา (เช่น "d3-part2") — แท็บปลายทางอ่านเองด้วย peekExecAnchor() */
const ANCHOR = "execDashAnchor";

export function openExecTab(tab: string, anchor?: string): void {
  try {
    sessionStorage.setItem(KEY, tab);
    if (anchor) sessionStorage.setItem(ANCHOR, anchor); else sessionStorage.removeItem(ANCHOR);
  } catch { /* ไม่มีที่เก็บก็เปิดแท็บแรกไป */ }
  location.hash = "#/exec-dash";
  scrollTo({ top: 0 });   // กดจากการ์ดล่าง ๆ ของหน้าอื่น ต้องเริ่มดูแท็บปลายทางจากบนสุด (พฤติกรรมเดิมของ execTab.ts)
}

export function peekExecAnchor(): string | null {
  try { return sessionStorage.getItem(ANCHOR); } catch { return null; }
}

export function peekExecTab(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function clearExecTab(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ไม่มีอะไรให้ลบ */ }
}

/** anchor ลบโดยแท็บปลายทางเอง ไม่ใช่ CostRevDash — แท็บที่ใช้ trips วาดหลังโหลดไฟล์เสร็จ
 *  ถ้า CostRevDash ลบตอน mount ตัวเองจะหายก่อนแท็บปลายทางได้อ่าน · openExecTab() ไม่ส่ง anchor = ล้างของค้างให้ */
export function clearExecAnchor(): void {
  try { sessionStorage.removeItem(ANCHOR); } catch { /* ไม่มีอะไรให้ลบ */ }
}
