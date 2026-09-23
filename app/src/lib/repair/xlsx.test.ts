/**
 * เทสต์ตัวอ่าน .xlsx ที่เขียนเอง
 *
 * สร้างไฟล์ ZIP แบบ "เก็บดิบไม่บีบอัด" (method 0) ขึ้นมาในเทสต์ เพราะสิ่งที่ต้อง
 * พิสูจน์คือการเดินสารบัญ ZIP กับการแปลง XML เป็นตาราง ส่วนการคลาย deflate
 * เป็นงานของเบราว์เซอร์ ไม่ใช่โค้ดเรา
 */
import { describe, expect, it } from "vitest";

import { isXlsx, readXlsx } from "./xlsx";
import { toBEYear } from "./parse";

const enc = new TextEncoder();

/** ประกอบไฟล์ ZIP จากรายการ {ชื่อ: เนื้อหา} โดยไม่บีบอัด */
function zip(files: Record<string, string>): ArrayBuffer {
  const entries = Object.entries(files).map(([name, text]) => ({
    name: enc.encode(name),
    data: enc.encode(text),
  }));

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const local = new Uint8Array(30 + e.name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 0, true);               // method 0 = เก็บดิบ
    lv.setUint32(18, e.data.length, true);  // compressed
    lv.setUint32(22, e.data.length, true);  // uncompressed
    lv.setUint16(26, e.name.length, true);
    local.set(e.name, 30);

    const cen = new Uint8Array(46 + e.name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, e.name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(e.name, 46);

    chunks.push(local, e.data);
    central.push(cen);
    offset += local.length + e.data.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, eocd];
  const total = all.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out.buffer;
}

const SHARED = `<?xml version="1.0"?><sst>
  <si><t>ชนิดรถ</t></si>
  <si><t>ประเภทรถ</t></si>
  <si><t>จำนวนเงิน</t></si>
  <si><r><rPr/><t>รถ 12 ล้อ</t></r><r><t>ตู้เย็น</t></r></si>
  <si><t>รถบริษัท</t></si>
  <si><t>ค่าซ่อม &amp; บำรุง</t></si>
</sst>`;

const SHEET = `<?xml version="1.0"?><worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
  <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>125.5</v></c></row>
  <row r="3"><c r="A3" t="inlineStr"><is><t>รถ 6 ล้อใหญ่</t></is></c><c r="C3"><v>250</v></c></row>
  <row r="4"><c r="A4" t="s"><v>5</v></c></row>
</sheetData></worksheet>`;

const book = () => zip({
  "[Content_Types].xml": "<Types/>",
  "xl/sharedStrings.xml": SHARED,
  "xl/worksheets/sheet1.xml": SHEET,
});

describe("readXlsx", () => {
  it("อ่านหัวตารางกับข้อมูลจาก sharedStrings ได้", async () => {
    const rows = await readXlsx(book());

    expect(rows[0]).toEqual(["ชนิดรถ", "ประเภทรถ", "จำนวนเงิน"]);
    expect(rows[1]).toEqual(["รถ 12 ล้อตู้เย็น", "รถบริษัท", "125.5"]);
  });

  it("เติมช่องว่างให้ตรงตำแหน่งคอลัมน์จริง เมื่อเซลล์กลางแถวหายไป", async () => {
    const rows = await readXlsx(book());
    // แถว 3 ไม่มีเซลล์ B — ถ้าไม่เติมช่องว่าง ยอดเงินจะเลื่อนไปอยู่คอลัมน์ประเภทรถ
    expect(rows[2]).toEqual(["รถ 6 ล้อใหญ่", "", "250"]);
  });

  it("ถอดเอนทิตีของ XML และต่อข้อความที่ถูกหั่นเป็นหลายท่อน", async () => {
    const rows = await readXlsx(book());
    expect(rows[3]![0]).toBe("ค่าซ่อม & บำรุง");
  });

  it("อ่านทุกชีตต่อกัน — รายงานจริงแยกชีตรายปี (6701 · 6801 · 6901)", async () => {
    const two = zip({
      "[Content_Types].xml": "<Types/>",
      "xl/sharedStrings.xml": SHARED,
      "xl/worksheets/sheet1.xml": SHEET,
      "xl/worksheets/sheet2.xml": SHEET,
    });
    const rows = await readXlsx(two);
    expect(rows).toHaveLength(8);
    expect(rows[4]).toEqual(["ชนิดรถ", "ประเภทรถ", "จำนวนเงิน"]);   // หัวตารางของชีตที่สอง — ตัวอ่านตารางข้ามเอง
  });

  it("บอกชัดเมื่อไฟล์ไม่ใช่ .xlsx", async () => {
    await expect(readXlsx(enc.encode("ไม่ใช่ zip").buffer as ArrayBuffer))
      .rejects.toThrow(/ไม่ใช่ไฟล์ \.xlsx/);
  });

  it("แยกนามสกุลไฟล์ได้", () => {
    expect(isXlsx("รายงานค่าซ่อม.xlsx")).toBe(true);
    expect(isXlsx("รายงานค่าซ่อม.XLSX")).toBe(true);
    expect(isXlsx("รายงานค่าซ่อม.csv")).toBe(false);
    expect(isXlsx("รายงานค่าซ่อม.xls")).toBe(false);
  });
});

describe("toBEYear กับวันที่แบบ Excel", () => {
  it("แปลงเลขลำดับวันของ Excel เป็นปี พ.ศ.", () => {
    // 45352 = 1 มี.ค. 2024 = พ.ศ. 2567 (นับจาก 30/12/1899)
    expect(toBEYear("45352")).toBe(2567);
    expect(toBEYear("45352.5")).toBe(2567);
  });

  it("ไม่สับสนกับปีสี่หลักที่ดักไปก่อนแล้ว", () => {
    expect(toBEYear("2567")).toBe(2567);
    expect(toBEYear("2024")).toBe(2567);
  });

  it("เลขที่ไม่ได้อยู่ในช่วงวันที่ ต้องไม่ถูกเดาว่าเป็นวันที่", () => {
    expect(toBEYear("125")).toBeNull();
    expect(toBEYear("999999")).toBeNull();
  });
});
