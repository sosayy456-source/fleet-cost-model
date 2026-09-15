/**
 * อ่านไฟล์ .xlsx โดยไม่ใช้ไลบรารีภายนอก
 *
 * ไฟล์ .xlsx คือ ZIP ที่ข้างในเป็น XML — เบราว์เซอร์สมัยใหม่มี DecompressionStream
 * ให้คลาย deflate ได้เองอยู่แล้ว จึงอ่านเองได้ด้วยโค้ดไม่กี่ร้อยบรรทัด
 * แทนที่จะลากไลบรารีอ่าน Excel ราว 400 KB เข้ามาใน bundle ที่ทุกคนต้องโหลด
 *
 * อ่าน "ชีตแรก" ของสมุดงานเท่านั้น — รายงานที่ export ออกมาจากระบบบัญชีมีชีตเดียว
 *
 * ★ วันที่ใน Excel เก็บเป็นตัวเลขลำดับวัน ไม่ใช่ข้อความ
 *   ตัวแปลงปี (toBEYear) จึงต้องรู้จักเลขลำดับวันด้วย ไม่งั้นคอลัมน์วันที่ตามงวด
 *   ที่เป็นวันที่จริงในไฟล์จะอ่านปีไม่ได้เลยสักบรรทัด
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

interface ZipEntry {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
}

/** อ่านสารบัญของ ZIP — เดินจากท้ายไฟล์ตามรูปแบบมาตรฐาน */
function readDirectory(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // ท้ายไฟล์มีคอมเมนต์ต่อได้ถึง 65535 ไบต์ จึงต้องไล่หาลายเซ็นถอยหลัง
  let eocd = -1;
  const from = Math.max(0, bytes.length - 65_557);
  for (let i = bytes.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ไม่ใช่ไฟล์ .xlsx (หาโครงสร้าง ZIP ไม่เจอ)");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  const out: ZipEntry[] = [];
  const dec = new TextDecoder("utf-8");
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== CEN_SIG) break;
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    out.push({ name, method, offset, compressedSize });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** คลายไฟล์หนึ่งรายการออกมาเป็นข้อความ */
async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // ข้ามหัวข้อมูลเฉพาะไฟล์ (ความยาวชื่อกับ extra ตรงนี้ต่างจากในสารบัญได้)
  const nameLen = view.getUint16(e.offset + 26, true);
  const extraLen = view.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const raw = bytes.subarray(start, start + e.compressedSize);

  if (e.method === 0) return new TextDecoder("utf-8").decode(raw);
  if (e.method !== 8) throw new Error(`ไฟล์ข้างในบีบอัดด้วยวิธีที่ยังไม่รองรับ (method ${e.method})`);

  if (typeof DecompressionStream === "undefined") {
    throw new Error("เบราว์เซอร์นี้ยังอ่านไฟล์ .xlsx ไม่ได้ — บันทึกเป็น .csv แทน");
  }
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** ถอดเอนทิตีของ XML — sharedStrings เก็บ & < > ไว้เป็นเอนทิตี */
const unescape = (s: string): string =>
  s.replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi, (m, dec: string, hex: string) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[m.toLowerCase()] ?? m;
  });

/** ข้อความทั้งหมดใน <si> หนึ่งก้อน — ข้อความที่จัดรูปแบบจะถูกหั่นเป็นหลาย <t> */
function textOf(block: string): string {
  let out = "";
  for (const m of block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += unescape(m[1] ?? "");
  return out;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) out.push(textOf(m[1] ?? ""));
  return out;
}

/** "BC12" -> 54 (นับจาก 0) */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** แปลงชีตหนึ่งใบเป็นตาราง โดยเติมช่องว่างให้ครบตามตำแหน่งจริงของเซลล์ */
function sheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];

  for (const rowM of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cM of (rowM[1] ?? "").matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cM[1] ?? "";
      const body = cM[2] ?? "";
      const ref = /r="([A-Z]+)/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";

      let value = "";
      if (type === "s") {
        const i = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "-1");
        value = shared[i] ?? "";
      } else if (type === "inlineStr") {
        value = textOf(body);
      } else {
        value = unescape(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }

      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push("");
      cells[at] = value;
    }
    rows.push(cells);
  }

  // แถวว่างล้วนที่ติดมาท้ายชีตไม่ต้องเอา
  while (rows.length && rows[rows.length - 1]!.every((c) => !c)) rows.pop();
  return rows;
}

/**
 * อ่าน .xlsx เป็นตาราง (แถว × ช่อง) — ใช้ชีตแรกของสมุดงาน
 * @throws Error พร้อมข้อความภาษาไทยเมื่อไฟล์ไม่ใช่ .xlsx หรือเบราว์เซอร์อ่านไม่ได้
 */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const dir = readDirectory(buf);

  const sheets = dir
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  if (!sheets.length) throw new Error("ไม่พบชีตในไฟล์ .xlsx");

  const ssEntry = dir.find((e) => e.name === "xl/sharedStrings.xml");
  const shared = ssEntry ? sharedStrings(await readEntry(buf, ssEntry)) : [];

  return sheetRows(await readEntry(buf, sheets[0]!), shared);
}

export const isXlsx = (name: string): boolean => /\.xlsx$/i.test(name.trim());
