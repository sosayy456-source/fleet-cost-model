/**
 * แบ่งของที่เลือกลงตู้หัวกับตู้หางพ่วง — ใช้วาดรูปรถในหน้าจัดรถเท่านั้น (Load Factor รวมยังคิดจากความจุหัว + หาง)
 *
 * ★ เติมตู้หัวก่อน ส่วนที่ล้นค่อยไปตู้หาง (เจ้าของงานเคาะ 24 ก.ย. 2569) — บิลไม่ได้ระบุว่าลงตู้ไหน
 *   ทำทีละมิติ (น้ำหนัก / ปริมาตร) แล้วแต่ละตู้ใช้ฝั่งที่เต็มกว่าเหมือน Load Factor หลัก
 * ความจุฝั่งไหนเป็น 0 (ไม่มีสเปก) = ไม่นับมิตินั้น · ไม่มีหาง = ของทั้งหมดอยู่ตู้หัว เกิน 100% ได้
 */
export interface Cap { kg: number; m3: number }

const ratio = (x: number, cap: number): number => (cap > 0 ? x / cap : 0);

export function splitLoad(
  load: { weight: number; volume: number },
  head: Cap,
  tail: Cap | null,
): { head: number; tail: number | null } {
  if (!tail) return { head: Math.max(ratio(load.weight, head.kg), ratio(load.volume, head.m3)) * 100, tail: null };
  const hw = Math.min(load.weight, head.kg);
  const hv = Math.min(load.volume, head.m3);
  return {
    head: Math.max(ratio(hw, head.kg), ratio(hv, head.m3)) * 100,
    tail: Math.max(ratio(load.weight - hw, tail.kg), ratio(load.volume - hv, tail.m3)) * 100,
  };
}
