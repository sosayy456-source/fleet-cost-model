/**
 * ค้นรหัสลูกค้า — แปลงไปมาระหว่างรหัสต้นฉบับที่ anonymize แล้ว กับรหัสสั้น CUSxxxxxxx
 *
 * ของเดิมฝัง base64 4.6 MB ไว้ใน HTML ทำให้ทุกคนที่เปิดหน้าเว็บต้องโหลดและ parse
 * ทั้งก้อนแม้ไม่ได้ใช้ฟีเจอร์นี้ ที่นี่แยกเป็นไฟล์ .bin แล้วโหลดเฉพาะตอนเข้าหน้านี้
 *
 * ไฟล์มีสองรุ่น แยกจากขนาดที่หารลงตัว (32 กับ 6 หารลงตัวพร้อมกันไม่ได้ในไฟล์จริง):
 *
 *   รุ่น 2  32 ไบต์/ระเบียน = รหัสต้นฉบับเต็ม 64 ตัวอักษร  ← สร้างจาก แปลงรหัสลูกหนี้รวม.xlsx
 *   รุ่น 1   6 ไบต์/ระเบียน = 12 ตัวแรกของรหัสต้นฉบับ      ← ของเดิมที่ดึงออกจาก v5.html
 *
 * รุ่น 1 บอกรหัสต้นฉบับได้ไม่ครบและยืนยันแบบเป๊ะ ๆ ไม่ได้ จึงเหลือไว้แค่ให้เปิดของเก่าได้
 *
 * ★ การเทียบต้องเป๊ะทั้งสองทาง — รหัสสั้นต้องเป็น CUS ตามด้วยเลข 7 หลักพอดี
 *   (CUS001 ไม่ใช่ CUS0000001) และรหัสต้นฉบับต้องครบ 64 ตัวอักษร
 *   ของเดิมใช้ parseInt กับ "ขึ้นต้นด้วย" จึงจับคู่ผิดตัวได้เงียบ ๆ
 */
const FULL_BYTES = 32;
const PREFIX_BYTES = 6;
const CODE_PAD = 7;

/** รหัสสั้นต้องเป็น CUS + เลข 7 หลักพอดี ไม่ขาดไม่เกิน */
const CODE_RE = /^CUS(\d{7})$/i;
/** รหัสต้นฉบับคือ SHA-256 เต็ม 64 ตัวอักษร */
const HASH_RE = /^[0-9a-f]{64}$/i;

export interface CustMap {
  count: number;
  /** ไฟล์นี้เก็บรหัสต้นฉบับครบทุกตัวไหม (รุ่น 2) หรือแค่ 12 ตัวแรก (รุ่น 1) */
  full: boolean;
  /** จำนวนตัวอักษรของรหัสต้นฉบับที่ไฟล์นี้เก็บไว้ — 64 หรือ 12 */
  hashLength: number;
  /** รหัสต้นฉบับเต็ม -> รหัส CUS (ต้องครบ 64 ตัวและตรงทุกตัว) */
  codeFor(hash: string): string | null;
  /** รหัส CUS -> รหัสต้นฉบับ (เต็มถ้าเป็นรุ่น 2 · 12 ตัวแรกถ้าเป็นรุ่น 1) */
  hashFor(code: string): string | null;
}

export const custCode = (row1Based: number): string =>
  "CUS" + String(row1Based).padStart(CODE_PAD, "0");

/** รูปแบบถูกต้องไหม — ให้หน้าจอแยก "พิมพ์ผิดรูป" ออกจาก "ไม่มีในตาราง" ได้ */
export const isCustCode = (s: string): boolean => CODE_RE.test(s.trim());
export const isFullHash = (s: string): boolean => HASH_RE.test(s.trim());

let cache: Promise<CustMap> | null = null;

/** ที่อยู่ไฟล์ตาราง — วางไว้ใน public/ จึงเดินตาม base path ของ Vite */
export const CUSTMAP_URL = `${import.meta.env.BASE_URL}custmap.bin`;

/**
 * โหลดตารางถ้ายังไม่ได้โหลด — custEnsure() ของ main:2549
 * ต้องเรียกก่อนออกรหัสใหม่เสมอ ไม่งั้นไม่รู้ว่าไฟล์มีถึงเลขไหน แล้วจะออกเลขทับของเดิม
 */
export const ensureCustMap = (): Promise<CustMap> => loadCustMap(CUSTMAP_URL);

/** โหลดตารางครั้งเดียวแล้วใช้ซ้ำ — เรียกซ้ำได้ ไม่โหลดใหม่ */
export function loadCustMap(url: string): Promise<CustMap> {
  cache ??= build(url).then(rememberCustMap).catch((e) => { cache = null; throw e; });
  return cache;
}

async function build(url: string): Promise<CustMap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดตารางรหัสลูกค้าไม่ได้ (HTTP ${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const full = bytes.length % FULL_BYTES === 0;
  const size = full ? FULL_BYTES : PREFIX_BYTES;
  if (!full && bytes.length % PREFIX_BYTES !== 0) {
    throw new Error("ไฟล์ตารางรหัสลูกค้าเสียหาย ขนาดไม่ลงตัวกับระเบียนละ 32 หรือ 6 ไบต์");
  }

  const count = bytes.length / size;

  /** hex ของระเบียนที่ n (1-based) — คืน null ถ้าระเบียนเป็นศูนย์ทั้งก้อน (ไม่มีรหัสนั้น) */
  const hexAt = (row: number): string | null => {
    const o = (row - 1) * size;
    let hex = "";
    let zero = true;
    for (let k = 0; k < size; k++) {
      const b = bytes[o + k]!;
      if (b !== 0) zero = false;
      hex += b.toString(16).padStart(2, "0");
    }
    return zero ? null : hex;
  };

  // ดัชนีย้อนกลับใช้ 48 บิตแรกเป็นกุญแจ แล้วค่อยเทียบไบต์ที่เหลือตอนค้น
  // (48 บิตอยู่ในช่วงที่ Number เก็บได้พอดี และสร้าง Map เร็วกว่า sort + binary search มาก
  //  ส่วนการเก็บสตริง 64 ตัวทั้ง 584k ตัวเป็นกุญแจกินหน่วยความจำหลายสิบ MB)
  //
  // ★ ชุดข้อมูลนี้ 12 ตัวแรกไม่ชนกัน แต่ถ้าวันหนึ่งชน ของเดิมจะ "เก็บตัวแรก ทิ้งที่เหลือ"
  //   แล้วค้นรหัสตัวหลังไม่เจอโดยไม่มีอะไรบอก จึงเก็บทุกตัวที่ชนไว้แล้วไปเทียบเต็มตอนค้น
  const index = new Map<number, number | number[]>();
  for (let i = 0; i < count; i++) {
    const o = i * size;
    const v = bytes[o]! * 2 ** 40 + bytes[o + 1]! * 2 ** 32 + bytes[o + 2]! * 2 ** 24
      + (bytes[o + 3]! << 16 | bytes[o + 4]! << 8 | bytes[o + 5]!);
    if (v === 0) continue;
    const had = index.get(v);
    if (had === undefined) index.set(v, i + 1);
    else if (Array.isArray(had)) had.push(i + 1);
    else index.set(v, [had, i + 1]);
  }

  return {
    count,
    full,
    hashLength: size * 2,
    codeFor(hash: string) {
      const h = hash.trim().toLowerCase();
      if (!HASH_RE.test(h)) return null;
      const hit = index.get(parseInt(h.slice(0, PREFIX_BYTES * 2), 16));
      if (hit === undefined) return null;
      const rows = Array.isArray(hit) ? hit : [hit];
      // รุ่น 2 เก็บครบ จึงเทียบได้ทั้ง 64 ตัว — 48 บิตแรกตรงกันเฉย ๆ ยังไม่พอ
      if (!full) return custCode(rows[0]!);
      const row = rows.find((r) => hexAt(r) === h);
      return row ? custCode(row) : null;
    },
    hashFor(code: string) {
      const m = CODE_RE.exec(code.trim());
      if (!m) return null;
      const row = parseInt(m[1]!, 10);
      if (!row || row > count) return null;
      return hexAt(row);
    },
  };
}

/**
 * ตารางที่โหลดเสร็จแล้ว (ถ้ามี) — ให้หน้าอื่นเรียกแบบ synchronous ตอน render ได้
 * โดยไม่บังคับให้โหลดไฟล์ใหญ่ถ้าผู้ใช้ยังไม่ได้เข้าหน้าค้นรหัส
 */
let resolved: CustMap | null = null;
export const peekCustMap = (): CustMap | null => resolved;

/** เรียกจาก loadCustMap เมื่อสร้างเสร็จ — แยกเป็นฟังก์ชันเพื่อไม่ให้ build() รู้จัก state ภายนอก */
export function rememberCustMap(m: CustMap): CustMap { resolved = m; return m; }

/** ดูเหมือนรหัสต้นฉบับ (hex ยาว ๆ) ไหม — v5:isHashLike */
export const isHashLike = (s: string): boolean => /^[0-9a-f]{16,}$/i.test(s.trim());
