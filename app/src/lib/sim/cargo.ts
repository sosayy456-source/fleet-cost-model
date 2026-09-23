/**
 * สุ่มสินค้าที่ "สมเหตุสมผล" สำหรับปุ่ม 🎲 สุ่มข้อมูล ทุกหน้าที่กรอก (บันทึกบิล · ใบรายการ)
 *
 * เจ้าของงานสั่ง 24 ก.ย. 2569 — ของเดิมสุ่มน้ำหนัก ขนาด และราคาแยกกันอิสระ ได้บิลแบบ 2 ชิ้น 46 กก. แต่ 2 ลบ.ม.
 * (หนาแน่น 22 กก./ลบ.ม.) หรือ 18 ชิ้น 126 กก. 10 ลบ.ม. ฝ่ายจัดรถเอาไปรวมใบแล้วปริมาตรทะลุรถทันที ใช้ทดสอบจริงไม่ได้
 *
 * ตอนนี้สุ่มจาก "แบบสินค้า" ที่มีขนาดต่อชิ้นและน้ำหนักต่อชิ้นของจริง (กล่อง · กระสอบ · ตะกร้าผัก · กล่องโฟม ฯลฯ)
 * แล้วคิดทุกอย่างต่อจากนั้น:
 *   น้ำหนักรวม   = น้ำหนักต่อชิ้น × จำนวน
 *   ปริมาตรรวม   = กว้าง × ยาว × สูง ÷ 1,000,000 × จำนวน (สูตรเดียวกับ volumeOf ใน types/bill.ts)
 *   ค่าขนส่ง/กก. = 2 + 0.006 × ระยะทาง (±15%) ช่วง 2.5–9 บาท — ใกล้กับบิลจริง (ของทั่วไป 4–9 บาท/กก. ที่ 800 กม.)
 *   ราคาต่อชิ้น  = น้ำหนักต่อชิ้น × ค่าขนส่ง/กก. ปัดเป็นเลขลงท้าย 0/5
 * บิลหนึ่งใบไม่เกิน ~2 ตัน / ~5 ลบ.ม. ฝ่ายจัดรถจึงรวมได้หลายใบต่อคัน (รถ 10 ล้อ 12 ตัน · 45 ลบ.ม.)
 */

export interface CargoKind {
  name: string;
  /** กว้าง × ยาว × สูง ต่อชิ้น (ซม.) */
  dims: [number, number, number];
  /** น้ำหนักต่อชิ้น (กก.) ต่ำสุด–สูงสุด */
  kg: [number, number];
  /** จำนวนชิ้นต่อบิล ต่ำสุด–สูงสุด */
  qty: [number, number];
}

/** ของทั่วไป — แบบที่เจอบ่อยในบิลจริง */
export const GENERAL: CargoKind[] = [
  { name: "กล่องกระดาษเล็ก", dims: [30, 40, 30], kg: [5, 12], qty: [10, 80] },
  { name: "กล่องกระดาษใหญ่", dims: [45, 60, 45], kg: [12, 25], qty: [5, 40] },
  { name: "กระสอบ", dims: [50, 80, 20], kg: [25, 50], qty: [5, 40] },
  { name: "ตะกร้าผักสด", dims: [36, 54, 33], kg: [15, 25], qty: [10, 60] },
  { name: "เครื่องใช้ไฟฟ้า", dims: [60, 70, 90], kg: [30, 70], qty: [1, 10] },
  { name: "เครื่องจักร/ชิ้นใหญ่", dims: [80, 120, 100], kg: [120, 350], qty: [1, 3] },
];

/** แช่เย็น/แช่แข็ง — กล่องโฟมและถัง */
export const COLD: CargoKind[] = [
  { name: "กล่องโฟมใหญ่", dims: [60, 46, 30], kg: [15, 25], qty: [5, 50] },
  { name: "กล่องโฟมเล็ก", dims: [38, 53, 19], kg: [8, 15], qty: [5, 60] },
  { name: "ถังแช่", dims: [50, 50, 60], kg: [30, 60], qty: [2, 12] },
];

/** กันบิลเดียวใหญ่เกินจนฝ่ายจัดรถรวมกับบิลอื่นไม่ได้ */
const MAX_BILL_KG = 2000;
const MAX_BILL_M3 = 5;

type Rand = () => number;

export const pickOf = <T,>(arr: readonly T[], rnd: Rand = Math.random): T => arr[Math.floor(rnd() * arr.length)]!;
export const intIn = (min: number, max: number, rnd: Rand = Math.random): number => Math.floor(min + rnd() * (max - min + 1));

/** ค่าขนส่งต่อ กก. ตามระยะทาง (บาท) */
export function ratePerKg(distKm: number, rnd: Rand = Math.random): number {
  const base = 2 + 0.006 * Math.max(0, distKm);
  return Math.min(9, Math.max(2.5, base * (0.85 + rnd() * 0.3)));
}

/** ปัดราคาเป็นเลขลงท้าย 0/5 (ราคาต่อชิ้นแบบที่คนตั้งจริง) */
const round5 = (n: number): number => Math.max(5, Math.round(n / 5) * 5);

export interface Cargo {
  kind: string;
  qty: number;
  /** น้ำหนักต่อชิ้น · น้ำหนักรวม (กก.) */
  kgEach: number; weight: number;
  /** ขนาดต่อชิ้น (ซม.) · ปริมาตรรวม (ลบ.ม.) */
  width: number; length: number; height: number; volume: number;
  /** บาท/กก. (คิดตามน้ำหนัก) · บาท/ชิ้น (คิดตามหน่วย) — ราคารวมสองแบบออกมาใกล้กัน */
  perKg: number; perUnit: number;
}

/**
 * สุ่มสินค้าหนึ่งบิล
 * @param cold กลุ่มแช่เย็น/แช่แข็ง → สุ่มจากกล่องโฟม/ถัง
 * @param targetKg ถ้าระบุ พยายามให้น้ำหนักรวมใกล้ค่านี้ (ใช้ตอนเติมรถให้ได้ Load Factor ที่ต้องการ)
 */
export function randomCargo(opts: { cold?: boolean; distKm?: number; targetKg?: number } = {}, rnd: Rand = Math.random): Cargo {
  const kind = pickOf(opts.cold ? COLD : GENERAL, rnd);
  const kgEach = intIn(kind.kg[0], kind.kg[1], rnd);
  // ขนาดต่อชิ้นแกว่ง ±10% ให้ไม่ซ้ำกันทุกบิล
  const jitter = (x: number) => Math.round(x * (0.9 + rnd() * 0.2));
  const [width, length, height] = kind.dims.map(jitter) as [number, number, number];
  const m3Each = (width * length * height) / 1_000_000;
  const cap = Math.max(1, Math.min(Math.floor(MAX_BILL_KG / kgEach), Math.floor(MAX_BILL_M3 / m3Each)));
  let qty = opts.targetKg != null
    ? Math.round(opts.targetKg / kgEach)
    : intIn(kind.qty[0], kind.qty[1], rnd);
  qty = Math.max(1, Math.min(qty, opts.targetKg != null ? Math.max(cap, 1) * 3 : cap));
  const perKg = Math.round(ratePerKg(opts.distKm ?? 500, rnd) * 2) / 2;       // ปัดครึ่งบาท
  return {
    kind: kind.name, qty, kgEach, weight: kgEach * qty,
    width, length, height, volume: Math.round(m3Each * qty * 10_000) / 10_000,
    perKg, perUnit: round5(kgEach * perKg),
  };
}
