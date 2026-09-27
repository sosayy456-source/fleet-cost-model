/**
 * ชนิดรถ → ทรงรถในรูป "สถานะการบรรทุก" ของหน้าจัดรถ (เจ้าของงานสั่ง 27 ก.ย. 2569 · วาดใน features/dispatch/LoadTruck.tsx)
 *
 *   จำนวนเพลาตามจริง (ภาพด้านข้างเห็น 1 ล้อต่อเพลา): ปิกอัพ 2 · 6 ล้อ 2 · 10 ล้อ 3 · 12 ล้อ 4 (หน้า 2 หลัง 2)
 *   รถเทรเลอร์ = หัวลาก + หางกึ่งพ่วงวางบนหัว · ความยาวตู้คงที่ต่อกลุ่ม (ไม่ได้คิดจากปริมาตร)
 *   รูปตู้ตามชื่อชนิด: ตู้เย็น = ตู้ปิด + เครื่องทำความเย็น · คอก = กระบะมีเสาคอก · ปิกอัพธรรมดา = กระบะเตี้ย · นอกนั้นตู้ปิด
 *   ยังไม่เลือกชนิดรถ = รถเทาทรง 10 ล้อ (ghost)
 * ★ จัดกลุ่มจากคำในชื่อชนิดรถ — ชนิดใหม่ที่ไม่มีคำเหล่านี้จะได้ทรง 10 ล้อตู้แห้ง
 */

export type HeadClass = "none" | "pickup" | "6" | "10" | "10long" | "12" | "tractor";
export type BodyKind = "dry" | "cold" | "stake" | "bed";
export interface HeadShape { cls: HeadClass; body: BodyKind }
export type TailClass = "full" | "semi";
export interface TailShape { cls: TailClass; body: BodyKind }

const bodyOf = (kind: string, pickup = false): BodyKind =>
  kind.includes("ตู้เย็น") ? "cold" : kind.includes("คอก") ? "stake" : pickup ? "bed" : "dry";

/** ทรงของรถหัว — ชื่อว่าง = ยังไม่เลือก */
export function headShape(kind: string): HeadShape {
  const k = kind.trim();
  if (!k) return { cls: "none", body: "dry" };
  if (/ปิ๊?กอัพ/.test(k)) return { cls: "pickup", body: bodyOf(k, true) };
  if (k.includes("เทรเลอร์") || k.includes("เทรเล่อร์")) return { cls: "tractor", body: bodyOf(k) };
  if (k.includes("12 ล้อ")) return { cls: "12", body: bodyOf(k) };
  if (k.includes("6 ล้อ")) return { cls: "6", body: bodyOf(k) };
  if (k.includes("10 ล้อ") && k.includes("ยาว")) return { cls: "10long", body: bodyOf(k) };
  return { cls: "10", body: bodyOf(k) };
}

/** ทรงของหาง — หางเทรเลอร์ = กึ่งพ่วง (วางบนหัวลากได้เมื่อหัวเป็นรถเทรเลอร์) · นอกนั้นพ่วงเต็ม */
export function tailShape(kind: string): TailShape {
  const k = kind.trim();
  return { cls: k.includes("เทรเลอร์") || k.includes("เทรเล่อร์") ? "semi" : "full", body: bodyOf(k) };
}
