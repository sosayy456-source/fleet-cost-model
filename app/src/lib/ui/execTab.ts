/**
 * ส่งต่อไป lib/ui/dashJump.ts — รวมสองกลไกให้เหลือตัวเดียว (merge ทดสอบ-Anda-branch 24 ก.ย. 2569)
 *
 * โมเดล-Ong เขียนไฟล์นี้ (takeExecTab อ่านแล้วลบในที่เดียว) ส่วน ทดสอบ-Anda-branch เขียน dashJump.ts
 * (peek ใน initializer ของ useState + clear ใน useEffect) ทั้งคู่ใช้คีย์ sessionStorage เดียวกัน "execDashTab"
 * ใช้ dashJump เป็นหลักเพราะปลอดภัยกับ StrictMode (initializer ถูกเรียกสองรอบ รอบหลังจะได้ null) และรองรับ anchor
 * ไฟล์นี้คงไว้ให้โค้ดที่ import จากที่นี่ (TonKmDemoRow) ใช้ต่อได้โดยไม่ต้องแก้ — ของใหม่ให้ import จาก dashJump
 */
export { openExecTab } from "./dashJump";
