/**
 * อ่านไฟล์ตารางที่ผู้ใช้เลือก — .xlsx ผ่าน xlsx.ts · .csv/.tsv/.txt ผ่านตัวแยกในไฟล์นี้
 *
 * ★ เดาตัวคั่นจาก "บรรทัดแรกที่มีข้อมูล" เท่านั้น ไม่ใช่ทั้งก้อน
 *   เพราะช่องรายละเอียดการซ่อมมักมีจุลภาคอยู่ข้างใน ถ้านับทั้งไฟล์จะเดาเป็น CSV ผิด ๆ
 */
import { isXlsx, readXlsx } from "./xlsx";

/** ช่องว่างที่มองไม่เห็นซึ่งติดมากับการคัดลอก — NBSP และ zero-width */
const INVISIBLE = /[ ​-‍﻿]/g;

export const clean = (s: string): string => s.replace(INVISIBLE, " ").trim();

/** แยกหนึ่งบรรทัดตามตัวคั่น โดยเคารพเครื่องหมายคำพูดแบบ CSV ("a,b" นับเป็นช่องเดียว) */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // "" ข้างในคือเครื่องหมายคำพูดจริง
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(clean);
}

/** แถวทั้งหมดของตาราง รวมบรรทัดหัวตาราง — บรรทัดว่างถูกตัดทิ้ง */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => clean(l) !== "");
  if (!lines.length) return [];

  const head = lines[0]!;
  const sep = (head.match(/\t/g)?.length ?? 0) >= (head.match(/,/g)?.length ?? 0) ? "\t" : ",";

  return lines.map((l) => splitLine(l, sep));
}

/**
 * อ่านไฟล์ที่ผู้ใช้เลือกมาเป็นข้อความ
 *
 * ★ Excel ภาษาไทยบันทึก CSV เป็น Windows-874 (TIS-620) ไม่ใช่ UTF-8
 *   ถ้าถอดเป็น UTF-8 ตรง ๆ ภาษาไทยจะกลายเป็นตัวขยะทั้งไฟล์โดยไม่มี error
 *   จึงลอง UTF-8 แบบเข้มงวดก่อน ถ้าไม่ผ่านค่อยถอยไป Windows-874
 */
export function decodeThai(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("windows-874").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf);
    }
  }
}

/** ชื่อคอลัมน์แบบเทียบง่าย — ตัดช่องว่าง วงเล็บ จุด และขีดออกให้หมด */
export const normHeader = (s: string): string =>
  clean(s).toLowerCase().replace(/[\s()（）.·_\-/]/g, "");

/**
 * หาดัชนีคอลัมน์จากรายชื่อที่ยอมรับได้ — เทียบแบบ "มีคำนี้อยู่ในหัวคอลัมน์"
 * เพราะหัวตารางจริงมักมีหน่วยต่อท้าย เช่น "จำนวนเงิน (บาท)" หรือ "ระยะทางรวม (กม.)"
 */
export function findCol(header: string[], aliases: string[]): number {
  const norm = header.map(normHeader);
  for (const a of aliases) {
    const key = normHeader(a);
    const exact = norm.indexOf(key);
    if (exact >= 0) return exact;
  }
  for (const a of aliases) {
    const key = normHeader(a);
    const partial = norm.findIndex((h) => h.includes(key));
    if (partial >= 0) return partial;
  }
  return -1;
}

/**
 * ตัวเลขจากเซลล์ Excel — ตัดจุลภาคคั่นหลัก สัญลักษณ์เงิน และช่องว่างออก
 * วงเล็บครอบหมายถึงค่าติดลบตามธรรมเนียมบัญชี เช่น (1,500) = -1500
 */
export function toNumber(v: string | undefined): number {
  const s = clean(v ?? "");
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s);
  const body = s.replace(/[()]/g, "").replace(/[,\s฿]/g, "").replace(/บาท$/, "");
  const n = Number(body);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

/**
 * น้ำหนักถ่วงรายปี — รับได้ทั้ง "20%", "0.2" และ "20"
 * ค่าที่มากกว่า 1 ถือว่าเป็นเปอร์เซ็นต์เสมอ เพราะน้ำหนักถ่วงที่รวมกันได้ 1
 * ไม่มีทางมีปีไหนเกิน 1 อยู่แล้ว
 */
export function toWeight(v: string | undefined): number {
  const s = clean(v ?? "");
  const pct = s.includes("%");
  const n = toNumber(s.replace("%", ""));
  if (!Number.isFinite(n)) return 0;
  return pct || n > 1 ? n / 100 : n;
}

/**
 * ปี พ.ศ. จากเซลล์ที่อาจเป็นปีเปล่า ๆ หรือวันที่
 *
 * รับ "2567", "2024", "24/09/2567", "24/09/2024", "2024-09-24", "2567-09-24"
 * ปีที่น้อยกว่า 2400 ถือว่าเป็น ค.ศ. แล้วบวก 543 — ไม่มีทางสับสนเพราะ
 * ค.ศ. 2400 ยังมาไม่ถึง และ พ.ศ. 2400 ผ่านไปนานแล้ว
 */
export function toBEYear(v: string | undefined): number | null {
  const s = clean(v ?? "");
  if (!s) return null;

  const asBE = (y: number): number | null => {
    if (!Number.isFinite(y) || y <= 0) return null;
    return y < 2400 ? y + 543 : y;
  };

  // yyyy-mm-dd
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return asBE(Number(iso[1]));

  // dd/mm/yyyy หรือ d-m-yyyy
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (slash) {
    const y = Number(slash[3]);
    // ปีสองหลักในไฟล์ไทยหมายถึง พ.ศ. ย่อ เช่น 67 = 2567
    return asBE(y < 100 ? 2500 + y : y);
  }

  const plain = /^(\d{4})$/.exec(s);
  if (plain) return asBE(Number(plain[1]));

  // ★ วันที่ใน Excel เก็บเป็น "เลขลำดับวัน" นับจาก 30/12/1899 ไม่ใช่ข้อความ
  //   ช่วง 20000-80000 คือ ค.ศ. 1954-2119 ซึ่งไม่ทับกับปีสี่หลัก (2567/2024)
  //   ที่ดักไปแล้วข้างบน จึงแยกจากกันได้แน่นอน
  const serial = /^(\d{5})(?:\.\d+)?$/.exec(s);
  if (serial) {
    const n = Number(serial[1]);
    if (n >= 20_000 && n <= 80_000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
      return asBE(d.getUTCFullYear());
    }
  }

  return null;
}

/**
 * อ่านไฟล์ที่ผู้ใช้เลือกเป็นตาราง — รับ .xlsx, .csv, .tsv, .txt
 * @throws Error พร้อมข้อความภาษาไทยเมื่อรูปแบบไฟล์ยังไม่รองรับ
 */
export async function readTable(file: File): Promise<string[][]> {
  const name = file.name;
  const buf = await file.arrayBuffer();

  if (isXlsx(name)) return readXlsx(buf);
  if (/\.pdf$/i.test(name)) {
    throw new Error(
      "ไฟล์ PDF ยังอ่านไม่ได้ — ข้อความไทยในชั้นข้อความของรายงานถูกสลับรูปสระ "
      + "ทำให้ชื่อชนิดรถเพี้ยน ส่งออกจากระบบเป็น .xlsx หรือ .csv แทน",
    );
  }
  if (/\.xls$/i.test(name)) {
    throw new Error("ไฟล์ .xls รุ่นเก่ายังอ่านไม่ได้ — เปิดใน Excel แล้ว Save As เป็น .xlsx");
  }
  return parseDelimited(decodeThai(buf));
}
