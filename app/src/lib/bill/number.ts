/**
 * ออกเลขที่บิล และเลขที่ใบรายการ 13 หลัก — ออกในเครื่องตอนกดบันทึก (เจ้าของงานเลือก 22 ก.ย. 2569)
 *
 * รูปแบบเดียวกับข้อมูลจริง 13 หลัก:
 *   เลขที่บิล        5 + YYMM + ลำดับ 4 หลัก   เช่น 5690100001  →  รวม 13 หลัก "5" + "6901" + "00001" + …
 *   เลขที่ใบรายการ   6 + YYMM + ลำดับ 4 หลัก
 * โดย YY = ปี พ.ศ. สองหลัก (ไฟล์จริงใช้ พ.ศ. เช่น 5240111503501 ของเดือน ม.ค. 2567)
 *
 * ★ ไม่ซ้ำได้แค่ "เท่าที่เครื่องนี้มองเห็น" — ตรวจกับบิล/ใบทั้งหมดที่โหลดมาแล้ว (เครื่อง + ชีต)
 *   สองเครื่องกดบันทึกพร้อมกันในวินาทีเดียวยังมีโอกาสได้เลขเดียวกัน (ปัญหาเดียวกับ custNewCodes
 *   ที่เขียนไว้ใน CLAUDE.md) — แก้ถาวรต้องย้ายการแจกเลขไปฝั่ง Apps Script
 *   จึงใส่ท้ายด้วยตัวสุ่ม 2 หลักเพื่อลดโอกาสชนเมื่อเลขลำดับตรงกันพอดี
 */

const pad = (n: number, w: number): string => String(n).padStart(w, "0");

/** ปี พ.ศ. สองหลัก + เดือนสองหลัก จากวันที่ ISO ("2026-09-22" → "6909") */
export function yymm(iso: string): string {
  const [y, m] = iso.split("-");
  const be = (Number(y) || new Date().getFullYear()) + 543;
  return pad(be % 100, 2) + (m ?? "01");
}

/**
 * เลขถัดไปของกลุ่ม prefix+yymm — นับต่อจากเลขที่มีอยู่แล้วในชุดที่ส่งมา
 * เลขที่อ่านไม่ออก/คนละรูปแบบถูกข้าม ไม่ทำให้เลขเพี้ยน
 */
function nextSeq(existing: readonly string[], head: string): number {
  let max = 0;
  for (const s of existing) {
    if (!s.startsWith(head) || s.length !== 13) continue;
    const seq = Number(s.slice(head.length, head.length + 5));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max + 1;
}

/** สร้างเลข 13 หลัก: prefix(1) + yymm(4) + ลำดับ(5) + สุ่ม(3) */
function make(prefix: string, iso: string, existing: readonly string[], offset: number): string {
  const head = prefix + yymm(iso);
  const seq = nextSeq(existing, head) + offset;
  const rnd = pad(Math.floor(Math.random() * 1000), 3);
  return head + pad(seq % 100_000, 5) + rnd;
}

/**
 * เลขที่บิลชุดใหม่ n ใบ — ส่งเลขที่บิลที่มีอยู่แล้วทั้งหมดมาด้วยเพื่อกันซ้ำ
 * คืนเรียงตามลำดับที่ขอ (ใบแรกได้เลขน้อยสุด)
 */
export function newBillNos(n: number, iso: string, existing: readonly string[]): string[] {
  const out: string[] = [];
  const seen = [...existing];
  for (let i = 0; i < n; i++) {
    let no = make("5", iso, seen, 0);
    // กันซ้ำกับเลขที่เพิ่งออกในรอบเดียวกัน (ตัวสุ่มท้ายอาจชนกันเอง)
    while (seen.includes(no)) no = make("5", iso, seen, 1);
    seen.push(no);
    out.push(no);
  }
  return out;
}

/** เลขที่ใบรายการ 13 หลัก — ฝ่ายจัดรถกด "ยืนยันการจัดรถ" แล้วออกให้หนึ่งเลขต่อหนึ่งเที่ยว */
export function newDocNo(iso: string, existing: readonly string[]): string {
  let no = make("6", iso, existing, 0);
  while (existing.includes(no)) no = make("6", iso, existing, 1);
  return no;
}
