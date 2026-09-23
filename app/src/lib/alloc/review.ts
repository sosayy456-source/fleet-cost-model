/**
 * ลูกค้าที่ต้นทุนจัดสรร "ส่วนใหญ่ปันตามรายได้" — แท็บกำไรลูกค้าของ Demo ติดป้ายเล็กให้รู้ว่าคิดต่างจากรายอื่น
 *
 * ETL (etl/src/alloc.py data_flag) หารายการสินค้าที่น้ำหนัก/ขนาดเชื่อไม่ได้ 3 แบบ แล้ว**ปันต้นทุนตามรายได้แทนภาระงาน**
 * (เจ้าของงานสั่ง 23 ก.ย. 2569 · แบ่งต้นทุนเที่ยวสองก้อนตามสัดส่วนรายได้ ดู pool_of)
 *   ไม่มีน้ำหนัก/ขนาด  เดิมเงื่อนไข 4 นับ 1 ชิ้น = 1 ตัน → รับต้นทุนเกินจริงมาก (แป้ง 3 ถุง = 3 ตัน)
 *   ขนาดเกินจริง       ชิ้นเดียวเกิน 10 ลบ.ม. (ยางรถไถ 360×600×600 ซม.) → เดิมรับต้นทุนเกือบทั้งเที่ยว
 *   ขนาดเล็กผิดปกติ    ไม่มีน้ำหนัก + ขนาดหลอก 1×1×1 ซม. → เดิมต้นทุน ~0 กำไร 100%
 * ลูกค้าพวกนี้นับรวมในภาพรวม/Top 10 ตามปกติ (ตัวเลขสมเหตุสมผลแล้ว) แค่มีป้ายบอก
 *
 * ★ needsReview() ต้องตรงกับ needs_review() ใน etl/build_alloc.py (REVIEW_SHARE เดียวกัน)
 */
export const REVIEW_SHARE = 0.5;

/** รายได้จากรายการที่ปันตามรายได้ ≥ ครึ่งหนึ่งของรายได้ลูกค้า — รายใหญ่ที่มีบิลแบบนี้ไม่กี่ใบไม่ติดป้าย */
export const needsReview = (revenue: number, flagRev: number): boolean =>
  flagRev > 0 && (revenue <= 0 || flagRev / revenue >= REVIEW_SHARE);

export interface ReviewCounts { fNoSize: number; fBig: number; fTiny: number }

export const REVIEW_REASONS: { key: keyof ReviewCounts; label: string }[] = [
  { key: "fNoSize", label: "ไม่มีน้ำหนัก/ขนาด" },
  { key: "fBig", label: "ขนาดเกินจริง" },
  { key: "fTiny", label: "ขนาดเล็กผิดปกติ" },
];

/** ข้อความเหตุผลของป้าย — "ไม่มีน้ำหนัก/ขนาด 3 · ขนาดเกินจริง 1" (นับเป็นรายการสินค้า) */
export const reviewReasonText = (c: ReviewCounts): string =>
  REVIEW_REASONS.filter((r) => c[r.key] > 0).map((r) => `${r.label} ${c[r.key]} รายการ`).join(" · ");
