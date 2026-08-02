/**
 * โมเดลต้นทุนการเดินรถ — Google Apps Script Web App
 * ────────────────────────────────────────────────────────────────────
 * ไฟล์ที่ต้องมีในโปรเจกต์ Apps Script (2 ไฟล์เท่านั้น):
 *   1) Code.gs     ← ไฟล์นี้
 *   2) Index.html  ← ไฟล์หน้าเว็บ (ชื่อไฟล์ต้องเป็น "Index" เป๊ะ ๆ ไม่ต้องพิมพ์ .html)
 *
 * วิธีติดตั้ง
 *   1. เปิด Google Sheet ที่จะใช้เก็บข้อมูล → เมนู ส่วนขยาย (Extensions) → Apps Script
 *   2. ลบโค้ดเดิมใน Code.gs ทิ้ง แล้ววางโค้ดนี้ลงไป
 *   3. กด + ข้าง "ไฟล์" → HTML → ตั้งชื่อว่า  Index  → ลบโค้ดตัวอย่างทิ้ง
 *      แล้ววางเนื้อหาทั้งหมดจากไฟล์ Index.html ลงไป
 *   4. กดบันทึก (ไอคอนแผ่นดิสก์)
 *   5. Deploy → New deployment → เลือกชนิด Web app
 *        - Execute as    : Me                    (รันด้วยบัญชีคุณ ทุกคนจึงเขียนชีตเดียวกันได้)
 *        - Who has access: Anyone with the link  (หรือ Anyone within <องค์กร> ถ้าอยากจำกัดวง)
 *      → Deploy → กดอนุญาตสิทธิ์ (Authorize) ให้เรียบร้อย
 *   6. คัดลอก Web app URL ที่ลงท้ายด้วย /exec → นั่นคือลิงก์ที่ส่งให้คนอื่นได้เลย
 *
 * แก้โค้ดภายหลัง: บันทึกแล้วกด Deploy → Manage deployments → ✏ → Version: New version → Deploy
 *
 * ────────────────────────────────────────────────────────────────────
 * ชีตที่ระบบสร้างให้อัตโนมัติ
 *   "บันทึกเดินรถ"   1 แถว = 1 ใบรายการ (คอลัมน์อ่านง่าย + คอลัมน์ _DATA เก็บข้อมูลดิบไว้ให้หน้าเว็บอ่านกลับ)
 *   "รายการลูกหนี้"  1 แถว = ลูกหนี้ 1 ราย (ระบบเขียนทับให้ใหม่ทุกครั้งที่บันทึกใบรายการนั้น)
 *
 * ⚠ คอลัมน์ _DATA คือหัวใจของระบบ — ห้ามลบหรือแก้ด้วยมือ
 *   ถ้าต้องการแก้ข้อมูล ให้แก้ผ่านหน้าเว็บ (ปุ่ม "แก้ไข") เท่านั้น
 *   คอลัมน์อื่น ๆ แก้ในชีตได้ แต่หน้าเว็บจะเขียนทับเมื่อบันทึกรายการนั้นครั้งถัดไป
 */

var SHEET_NAME = 'บันทึกเดินรถ';
var DEBT_SHEET_NAME = 'รายการลูกหนี้';
var DATA_COL_NAME = '_DATA';
var LOCK_WAIT_MS = 30000;

var HEADERS = ["ID","วันที่","เลขที่ใบรายการ","สาขา","ทะเบียนรถ","ประเภทเส้นทาง","ต้นทาง","ปลายทาง","ระยะทาง(กม.)","ประเภทรถ","ชนิดรถ",
  "ราคาน้ำมัน(บาท/ลิตร)","น้ำมัน(ลิตร)","ค่าแก๊ส","น้ำมันเดินทาง","ที่มาน้ำมันเดินทาง","น้ำมันไปเก็บสินค้า",
  "พนักงานขับ","พนักงานสำรอง","SND","ค่าเปิดปิดผ้าใบ","ค่าด่านตำรวจ","ค่าธรรมเนียมคืนตู้","ค่าเข้าท่าเรือ","ค่าส่งเอกสาร","ค่าทางด่วน",
  "ชนิดรถ(ค่าซ่อม)","ค่าซ่อมตามเวลา","ค่าซ่อมตามระยะทาง",
  "น้ำมันนอกเส้นทาง(สูญเปล่า)","ค่าแรงนอกเส้นทาง(สูญเปล่า)","ต้นทุนเดินทางรวม(ปกติ)","ต้นทุนสูญเปล่า","รายได้","กำไร/ขาดทุน",
  "สถานะชำระ","จำนวนลูกหนี้","ชำระแล้ว(ราย)","ยอดรวมบิล","วันที่ชำระครบ","จำนวนวันชำระ","รายการลูกหนี้",
  DATA_COL_NAME];

var DEBT_HEADERS = ["BillID","ID ใบรายการ","เลขที่ใบรายการ","วันที่","เส้นทาง",
  "เลขที่บิล","ผู้ส่ง","ผู้รับ","จำนวน","ราคารวม","ประเภทการชำระ","สถานะ","วันที่ชำระ","จำนวนวันชำระ"];

var DATA_COL = HEADERS.length;          // คอลัมน์สุดท้าย = _DATA
var ID_COL = 1;                         // คอลัมน์ A = ID


/* ═══════════════ เสิร์ฟหน้าเว็บ ═══════════════ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('โมเดลต้นทุนการเดินรถ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/* ═══════════════ ฟังก์ชันที่หน้าเว็บเรียก (google.script.run) ═══════════════ */

/** โหลดรายการทั้งหมด — ใหม่สุดอยู่บนสุด */
function apiLoad() {
  try {
    var sh = getSheet_(SHEET_NAME, HEADERS);
    var last = sh.getLastRow();
    if (last < 2) return { ok: true, records: [] };

    var raw = sh.getRange(2, DATA_COL, last - 1, 1).getValues();
    var ids = sh.getRange(2, ID_COL, last - 1, 1).getValues();
    var records = [];
    for (var i = 0; i < raw.length; i++) {
      var txt = String(raw[i][0] || '').trim();
      if (!txt) continue;
      try {
        var rec = JSON.parse(txt);
        if (!rec.id) rec.id = String(ids[i][0] || '');
        records.push(rec);
      } catch (e) { /* แถวเสีย → ข้ามไป ไม่ให้ทั้งหน้าพัง */ }
    }
    records.reverse();                                   // แถวล่างสุด = ใหม่สุด
    return { ok: true, records: records };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * บันทึก 1 ใบรายการ (เพิ่มใหม่ หรือทับของเดิมตาม id)
 * payload = { record: {...}, row: [...], bills: [[...], ...] }
 */
function apiSave(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);

    if (!payload || !payload.record || !payload.record.id) {
      return { ok: false, error: 'ข้อมูลที่ส่งมาไม่ครบ (ไม่มี id)' };
    }
    var id = String(payload.record.id);
    var sh = getSheet_(SHEET_NAME, HEADERS);

    var row = padRow_(payload.row || [], HEADERS.length);
    row[0] = id;
    row[DATA_COL - 1] = JSON.stringify(payload.record);

    var at = findRow_(sh, id);
    if (at) {
      sh.getRange(at, 1, 1, HEADERS.length).setValues([row]);
    } else {
      at = sh.getLastRow() + 1;
      sh.getRange(at, 1, 1, HEADERS.length).setValues([row]);
    }

    writeBills_(id, payload.bills || []);
    return { ok: true, id: id, row: at };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/** ลบ 1 ใบรายการ พร้อมแถวลูกหนี้ของใบนั้น */
function apiDelete(id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
    var sh = getSheet_(SHEET_NAME, HEADERS);
    var at = findRow_(sh, String(id));
    if (at) sh.deleteRow(at);
    writeBills_(String(id), []);
    return { ok: true, deleted: at ? 1 : 0 };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/** ล้างข้อมูลทั้งหมด (เก็บหัวตารางไว้) */
function apiClearAll() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
    clearBody_(getSheet_(SHEET_NAME, HEADERS));
    clearBody_(getSheet_(DEBT_SHEET_NAME, DEBT_HEADERS));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/** ใช้ทดสอบว่าสคริปต์ทำงานอยู่ */
function apiPing() {
  return { ok: true, pong: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
}


/* ═══════════════ ตัวช่วยภายใน ═══════════════ */

/** เขียนแถวลูกหนี้ของใบรายการหนึ่ง: ลบของเดิมทิ้งก่อน แล้วเขียนชุดใหม่ */
function writeBills_(recordId, bills) {
  var sh = getSheet_(DEBT_SHEET_NAME, DEBT_HEADERS);
  var last = sh.getLastRow();

  if (last > 1) {
    var owners = sh.getRange(2, 2, last - 1, 1).getValues();   // คอลัมน์ B = ID ใบรายการ
    for (var i = owners.length - 1; i >= 0; i--) {
      if (String(owners[i][0]) === recordId) sh.deleteRow(i + 2);
    }
  }

  if (bills && bills.length) {
    var out = [];
    for (var b = 0; b < bills.length; b++) out.push(padRow_(bills[b], DEBT_HEADERS.length));
    sh.getRange(sh.getLastRow() + 1, 1, out.length, DEBT_HEADERS.length).setValues(out);
  }
}

/** หาแถวจาก ID (คอลัมน์ A) — คืน 0 ถ้าไม่เจอ */
function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, ID_COL, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === id) return i + 2;
  }
  return 0;
}

/** เอาชีตมาใช้ (สร้างให้ถ้ายังไม่มี) + ทำหัวตารางให้ตรงเวอร์ชันปัจจุบันเสมอ */
function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);

  // ซ่อนคอลัมน์ _DATA ไว้ไม่ให้เกะกะ (ยังอยู่ครบ แค่ไม่แสดง)
  if (headers[headers.length - 1] === DATA_COL_NAME) {
    sh.hideColumns(headers.length);
  }
  return sh;
}

function clearBody_(sh) {
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}

function padRow_(row, len) {
  var out = row.slice(0, len);
  while (out.length < len) out.push('');
  return out;
}


/* ═══════════════ เมนูช่วยเหลือในสเปรดชีต ═══════════════ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('โมเดลเดินรถ')
    .addItem('เปิดหน้าโมเดล', 'showSidebarLink')
    .addToUi();
}

function showSidebarLink() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p style="font:14px sans-serif">เปิดหน้าโมเดลได้ที่ลิงก์นี้:</p>' +
      '<p><a href="' + url + '" target="_blank" style="font:14px sans-serif">' + url + '</a></p>'
    : '<p style="font:14px sans-serif">ยังไม่ได้ Deploy เป็น Web app — ไปที่ Deploy → New deployment ก่อน</p>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(460).setHeight(140), 'โมเดลต้นทุนการเดินรถ');
}
