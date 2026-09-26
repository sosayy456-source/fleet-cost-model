/**
 * สาขาของผู้จัดการ — เลือกในหน้าต่างหลังเข้าหน้า Manager Dashboard
 * จำระดับ "แท็บ" แบบเดียวกับตำแหน่ง (sessionStorage — ดูเหตุผลใน sessionRole.ts) · กด "เปลี่ยนหน้าที่" ต้องล้างด้วย
 * โมเดลไม่มีระบบล็อกอิน การล็อกสาขาจึงเป็นกติกาของหน้าจอ ไม่ใช่สิทธิ์การเข้าถึงจริง
 */
const KEY = "sessionBranch";

export function loadSessionBranch(): string | null {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/** null = ลืมสาขา (เปลี่ยนหน้าที่) */
export function saveSessionBranch(branch: string | null): void {
  try {
    if (branch) sessionStorage.setItem(KEY, branch);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* เขียนไม่ได้ก็แค่ไม่จำ */
  }
}
