/**
 * เปิด Executive Dashboard ตรงแท็บที่ต้องการจากหน้าอื่น (เช่นการ์ดกำไรส่วนเกิน/ตัน-กม. ในเมนู Demo)
 *
 * hash ของแอปเป็นชื่อเมนูล้วน (App.readHash เทียบทั้งสตริงกับ ROLE_VIEWS) จึงต่อ ?tab= ไม่ได้
 * ฝากชื่อแท็บไว้ใน sessionStorage แล้วให้ CostRevDash หยิบไปใช้ครั้งเดียวตอนเปิด (takeExecTab)
 */
const KEY = "execDashTab";

export function openExecTab(tab: string): void {
  try { sessionStorage.setItem(KEY, tab); } catch { /* ไม่ได้ก็เปิดแท็บแรกตามปกติ */ }
  location.hash = "#/exec-dash";
  scrollTo({ top: 0 });
}

/** อ่านแล้วลบทิ้ง — กลับมาที่เมนูนี้ครั้งหน้าต้องเริ่มแท็บแรกตามเดิม */
export function takeExecTab(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
