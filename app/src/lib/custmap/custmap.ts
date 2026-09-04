/**
 * ค้นรหัสลูกค้า — แปลงไปมาระหว่าง hash ที่ anonymize แล้ว กับรหัสสั้น CUSxxxxxxx
 *
 * ของเดิมฝัง base64 4.6 MB ไว้ใน HTML ทำให้ทุกคนที่เปิดหน้าเว็บต้องโหลดและ parse
 * ทั้งก้อนแม้ไม่ได้ใช้ฟีเจอร์นี้ ที่นี่แยกเป็นไฟล์ .bin แล้วโหลดเฉพาะตอนเข้าหน้านี้
 *
 * ไฟล์เก็บ 12 hex แรกของ hash เท่านั้น (ยาวพอที่ยืนยันแล้วว่าไม่ชนกัน)
 * จึงค้นกลับได้แค่ "ขึ้นต้นด้วย" ไม่ได้ hash เต็ม
 */
const PREFIX_HEX = 12;
const BYTES_PER_RECORD = 6;
const CODE_PAD = 7;

export interface CustMap {
  count: number;
  /** hash เต็มหรือ 12 hex แรก -> รหัส CUS */
  codeFor(hash: string): string | null;
  /** รหัส CUS -> 12 hex แรกของ hash (ไม่ใช่ hash เต็ม) */
  prefixFor(code: string): string | null;
}

export const custCode = (row1Based: number): string =>
  "CUS" + String(row1Based).padStart(CODE_PAD, "0");

let cache: Promise<CustMap> | null = null;

/** โหลดตารางครั้งเดียวแล้วใช้ซ้ำ — เรียกซ้ำได้ ไม่โหลดใหม่ */
export function loadCustMap(url: string): Promise<CustMap> {
  cache ??= build(url).catch((e) => { cache = null; throw e; });
  return cache;
}

async function build(url: string): Promise<CustMap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดตารางรหัสลูกค้าไม่ได้ (HTTP ${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length % BYTES_PER_RECORD !== 0) {
    throw new Error("ไฟล์ตารางรหัสลูกค้าเสียหาย ขนาดไม่ลงตัวกับระเบียนละ 6 ไบต์");
  }

  const count = bytes.length / BYTES_PER_RECORD;

  // ใช้ Map แทนการ sort + binary search แบบเดิม เพราะสร้างเร็วกว่ามาก
  // (การ sort permutation 584k ตัวด้วย comparator ใน JS ใช้เวลาเป็นวินาที)
  const index = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const o = i * BYTES_PER_RECORD;
    // 48 บิต — อยู่ในช่วงที่ Number เก็บได้แบบไม่เสียความละเอียด
    const v = bytes[o]! * 2 ** 40 + bytes[o + 1]! * 2 ** 32 + bytes[o + 2]! * 2 ** 24
      + (bytes[o + 3]! << 16 | bytes[o + 4]! << 8 | bytes[o + 5]!);
    if (!index.has(v)) index.set(v, i + 1);
  }

  return {
    count,
    codeFor(hash: string) {
      const h = hash.trim().toLowerCase();
      if (!/^[0-9a-f]+$/.test(h) || h.length < PREFIX_HEX) return null;
      const row = index.get(parseInt(h.slice(0, PREFIX_HEX), 16));
      return row ? custCode(row) : null;
    },
    prefixFor(code: string) {
      const m = /^CUS(\d{1,9})$/i.exec(code.trim());
      if (!m) return null;
      const row = parseInt(m[1]!, 10);
      if (!row || row > count) return null;
      const o = (row - 1) * BYTES_PER_RECORD;
      let hex = "";
      for (let k = 0; k < BYTES_PER_RECORD; k++) hex += bytes[o + k]!.toString(16).padStart(2, "0");
      return hex;
    },
  };
}
