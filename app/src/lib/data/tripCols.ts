/**
 * แปลง costrev/trips.json แบบคอลัมน์ (etl/src/tripcols.py) กลับเป็นแถว — ผลต้องเท่ากับไฟล์แบบแถวเดิมทุกฟิลด์
 *
 * ★ เปลี่ยนแค่วิธีเก็บ (26 ก.ย. 2569 · docs/แผนแก้-ข้อมูลจริงช้า.md ข้อ 1) หน้าจอไม่ต้องรู้เรื่องนี้
 *   ข้อความที่ซ้ำกัน (สาขา ชนิดรถ รหัสลูกค้า hash 64 ตัว) ชี้ไปที่สตริงตัวเดียวกันในตาราง หน่วยความจำจึงลดตาม
 * ★ ไฟล์นี้ต้องไม่ import อะไรและใช้แค่ไวยากรณ์ที่ลบ type ทิ้งได้ — `app/tools/verify-trips.mjs` เรียกผ่าน node ตรง ๆ
 */

export const TRIP_COLS_FORMAT = "cols-1";

type Col =
  | { t: "n" | "r"; v: unknown[] }
  | { t: "b"; v: number[] }
  | { t: "s"; v: number[] }
  | { t: "ls"; v: number[][] }
  | { t: "do"; v: number[][] }
  | { t: "lo"; k: string[]; kt: ("s" | "n")[]; v: unknown[][][] };

export interface TripColumns {
  format: string;
  n: number;
  str: string[];
  cols: Record<string, Col>;
}

/** แบบคอลัมน์หรือไม่ — ไฟล์ที่สร้างก่อน 26 ก.ย. 2569 เป็น array ของแถว */
export const isTripColumns = (x: unknown): x is TripColumns =>
  !!x && !Array.isArray(x) && typeof x === "object" && (x as TripColumns).format === TRIP_COLS_FORMAT;

/**
 * ★ สร้างทุกแถวด้วยฟังก์ชันที่ประกอบจากชื่อคอลัมน์ (`new Function`) ให้ทุก object มีรูปเดียวกันตั้งแต่เกิด
 *   วัดกับข้อมูลสังเคราะห์ 108k เที่ยว: ~80 ms · วิธีเติมทีละคอลัมน์ ~570 ms (V8 ต้องเปลี่ยนรูป object ทุกคีย์)
 *   ถ้าเบราว์เซอร์ห้าม new Function (CSP) ถอยไปวิธีเติมทีละคอลัมน์ ผลเท่ากัน
 */
export function decodeTripColumns(obj: TripColumns): Record<string, unknown>[] {
  let make: (i: number) => Record<string, unknown>;
  try {
    make = rowMaker(obj);
  } catch (e) {
    if (e instanceof EvalError) return decodeTripColumnsSlow(obj);
    throw e;
  }
  const out: Record<string, unknown>[] = new Array(obj.n);
  for (let i = 0; i < obj.n; i++) out[i] = make(i);
  return out;
}

/** แบบเดียวกันแต่พักให้เบราว์เซอร์ทุก `chunk` แถว — หน้าเว็บไม่ค้างเป็นก้อนเดียวตอนโหลดข้อมูลจริงหลายแสนเที่ยว */
export async function decodeTripColumnsAsync(obj: TripColumns, chunk = 20000): Promise<Record<string, unknown>[]> {
  let make: (i: number) => Record<string, unknown>;
  try {
    make = rowMaker(obj);
  } catch (e) {
    if (e instanceof EvalError) return decodeTripColumnsSlow(obj);
    throw e;
  }
  const out: Record<string, unknown>[] = new Array(obj.n);
  for (let i = 0; i < obj.n; i++) {
    out[i] = make(i);
    if (i % chunk === chunk - 1) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

function rowMaker(obj: TripColumns): (i: number) => Record<string, unknown> {
  const s = obj.str;
  const cols = Object.entries(obj.cols);
  const str = (j: number): string => s[j]!;
  const dictOf = (a: number[]): Record<string, number> => {
    const o: Record<string, number> = {};
    for (let j = 0; j < a.length; j += 2) o[str(a[j]!)] = a[j + 1]!;
    return o;
  };
  const listOf = (c: Extract<Col, { t: "lo" }>, rows: unknown[][]): Record<string, unknown>[] => rows.map((arr) => {
    const o: Record<string, unknown> = {};
    for (let j = 0; j < c.k.length; j++) o[c.k[j]!] = c.kt[j] === "s" ? str(arr[j] as number) : arr[j];
    return o;
  });
  const body = cols.map(([k, c], j) => {
    const v = `V[${j}][i]`;
    const e = c.t === "n" || c.t === "r" ? v
      : c.t === "b" ? `${v} === 1`
      : c.t === "s" ? `S[${v}]`
      : c.t === "ls" ? `${v}.map(st)`
      : c.t === "do" ? `dO(${v})`
      : c.t === "lo" ? `lO(C[${j}], ${v})`
      : null;
    if (e === null) throw new Error(`trips.json: ไม่รู้จักคอลัมน์ชนิด "${(c as { t: string }).t}" ของ ${k} — ETL ใหม่กว่าแอป`);
    return `${JSON.stringify(k)}: ${e}`;
  }).join(",");
  return new Function("V", "C", "S", "st", "dO", "lO", `return (i) => ({${body}});`)(
    cols.map(([, c]) => c.v), cols.map(([, c]) => c), s, str, dictOf, listOf,
  ) as (i: number) => Record<string, unknown>;
}

/** วิธีเติมทีละคอลัมน์ — ใช้เมื่อ new Function ถูกห้าม และในเทสต์เทียบผล */
export function decodeTripColumnsSlow(obj: TripColumns): Record<string, unknown>[] {
  const s = obj.str;
  const n = obj.n;
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) out.push({});
  // ETL เขียนทุกคอลัมน์ยาว n เท่ากัน — ! ข้างล่างอาศัยข้อนั้น
  const str = (j: number): string => s[j]!;
  for (const [k, c] of Object.entries(obj.cols)) {
    for (let i = 0; i < n; i++) {
      const row = out[i]!;
      switch (c.t) {
        case "n": case "r":
          row[k] = c.v[i];
          break;
        case "b":
          row[k] = c.v[i] === 1;
          break;
        case "s":
          row[k] = str(c.v[i]!);
          break;
        case "ls":
          row[k] = c.v[i]!.map(str);
          break;
        case "do": {
          const a = c.v[i]!;
          const o: Record<string, number> = {};
          for (let j = 0; j < a.length; j += 2) o[str(a[j]!)] = a[j + 1]!;
          row[k] = o;
          break;
        }
        case "lo":
          row[k] = c.v[i]!.map((arr) => {
            const o: Record<string, unknown> = {};
            for (let j = 0; j < c.k.length; j++) o[c.k[j]!] = c.kt[j] === "s" ? str(arr[j] as number) : arr[j];
            return o;
          });
          break;
        default:
          throw new Error(`trips.json: ไม่รู้จักคอลัมน์ชนิด "${(c as { t: string }).t}" ของ ${k} — ETL ใหม่กว่าแอป`);
      }
    }
  }
  return out;
}
