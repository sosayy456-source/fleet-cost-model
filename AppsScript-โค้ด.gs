/**
 * โมเดลต้นทุนการเดินรถ → บันทึกลง Google Sheet   (VERSION 5)
 * ใช้คู่กับไฟล์ โมเดลเดินรถ-gsheet.html
 *
 * ── วิธีติดตั้ง ──────────────────────────────────────────────
 * 1) วางโค้ดนี้ทับโค้ดเดิมทั้งหมดในไฟล์ รหัส.gs (Code.gs) → กดบันทึก 💾
 * 2) กด "การทำให้ใช้งานได้" (Deploy) มุมขวาบน → การทำให้ใช้งานได้ใหม่ (New deployment)
 *      - ประเภท (Select type)  : เว็บแอป (Web app)
 *      - ดำเนินการในฐานะ (Execute as)   : ฉัน (Me)
 *      - ผู้ที่มีสิทธิ์เข้าถึง (Who has access) : ทุกคน (Anyone)   ← ถ้าไม่ใช่ "ทุกคน" จะบันทึกไม่ได้
 *      - กด Deploy → กดอนุญาตสิทธิ์ (Authorize) ให้เรียบร้อย
 * 3) คัดลอก "URL ของเว็บแอป" ที่ลงท้ายด้วย /exec
 * 4) เปิดหน้าเว็บโมเดล → แท็บ "รายการทั้งหมด" → ⚙ ตั้งค่าการเชื่อม Google Sheet
 *    → วาง URL → กดบันทึกลิงก์ → กดทดสอบการเชื่อมต่อ (ต้องขึ้นว่า "โค้ด v5")
 *
 * ── แก้โค้ดภายหลัง ─────────────────────────────────────────
 * บันทึก → Deploy → จัดการการทำให้ใช้งานได้ (Manage deployments) → กดดินสอ ✏
 * → ช่อง Version เลือก "เวอร์ชันใหม่" (New version) → Deploy   (URL เดิมใช้ต่อได้)
 *
 * ── ระบบเขียนลง 2 ชีต (สร้างให้อัตโนมัติถ้ายังไม่มี) ──────────
 *   "ค่าเดินทาง" : 1 แถว = 1 ใบรายการ · คอลัมน์ 1–34 ตรงรูปแบบเดิม · 35+ เป็นข้อมูลเสริม
 *   "ลูกหนี้"    : 1 แถว = ลูกหนี้ 1 ราย · คอลัมน์ 1–9 ตรงรูปแบบเดิม · 10+ เป็นข้อมูลเสริม
 * เป็นระบบ upsert — ส่งใบรายการเดิมซ้ำจะทับแถวเดิม ไม่เพิ่มแถวใหม่
 */

var VERSION = 5;                        // ต้องตรงกับ GS_VERSION ในไฟล์ HTML

// ★ ชีตปลายทางที่จะเขียนข้อมูลลง
//   ปล่อยว่าง ''  = เขียนลงชีตที่สคริปต์นี้ผูกอยู่ (กรณีเปิดจาก ส่วนขยาย → Apps Script)  ← ค่าเริ่มต้น
//   ใส่ไอดี      = เขียนลงชีตนั้นเสมอ (กรณีสร้างโปรเจกต์ Apps Script แยกไม่ได้ผูกกับชีต)
//                  ไอดีคือตัวอักษรยาว ๆ ใน URL ของชีต ระหว่าง /d/ กับ /edit
//                  เช่น https://docs.google.com/spreadsheets/d/[ไอดีอยู่ตรงนี้]/edit
var SPREADSHEET_ID = '';

var SHEET_NAME = 'ค่าเดินทาง';
var DEBT_SHEET_NAME = 'ลูกหนี้';

// คอลัมน์ 1–34 ตรงรูปแบบชีต "Model หลัก" · 35+ เป็นข้อมูลเสริมของโมเดล
var HEADERS = [
  "ลำดับ","สาขา","วันที่ตัดจ่าย","เลขที่ใบรายการ","ประเภทใบรายการ","ประเภทรถ","ชนิดรถ","ทะเบียนรถ",
  "ค่าแก๊สเดินทาง","ค่าน้ำมันเดินทาง(เงินสด)","ค่าน้ำมันเดินทางขาล่อง(บิลน้ำมัน)","ค่าน้ำมัน(Fleet Card)",
  "ค่าน้ำมันไปเก็บสินค้า","ค่าน้ำมันเดินทางขาขึ้น (บิลน้ำมัน)","ค่าเรียกรถไปขึ้นของ (บิลน้ำมัน)",
  "ค่าเบี้ยเลี้ยงพขร.","ค่าเบี้ยเลี้ยงพขร.สำรอง","เบี้ยเลี้ยง SND",
  "ค่าน้ำมันรถวิ่งอ้อม","ค่าน้ำมันนอกเส้นทาง(Fleet Card)","เบี้ยเลี้ยงนอกเส้นทาง","น้ำมันนอกเส้นทาง",
  "ค่าธรรมเนียมคืนตู้","ค่าเข้าท่าเรือ","ค่าส่งเอกสาร","ค่าทางด่วน","ค่าปิดเปิดผ้าใบรถเทเลอร์","ค่าตำรวจ",
  "Rev ค่าบรรทุกทั้งใบรายการ","จุดขึ้น-จุดลง","ปี","รวมค่าใช้จ่าย","ค่าน้ำมันเหมา","ค่าซ่อมแซม",
  // ───── ส่วนเสริมของโมเดล ─────
  "ID","ประเภทเส้นทาง","ระยะทาง(กม.)","ราคาน้ำมัน(บาท/ลิตร)","น้ำมัน(ลิตร)","น้ำมันเดินทาง(คำนวณอัตโนมัติ)",
  "ค่าซ่อมตามเวลา","ค่าซ่อมตามระยะทาง","ต้นทุนปกติรวม","ต้นทุนสูญเปล่า","กำไร/ขาดทุน",
  "สถานะชำระ","จำนวนลูกหนี้","ชำระแล้ว(ราย)","ยอดรวมบิล","วันที่ชำระครบ","จำนวนวันชำระ","รายการลูกหนี้"];

// คอลัมน์ 1–9 ตรงรูปแบบชีต · 10+ เป็นข้อมูลเสริม
var DEBT_HEADERS = [
  "วันที่","เลขที่ใบรายการ","เลขที่บิล","ผู้ส่ง","ผู้รับ","ประเภทการชำระเงิน","สถานะการชำระเงิน","จำนวน","ราคารวม",
  "BillID","ID ใบรายการ","สาขา","เส้นทาง","วันที่ชำระ","จำนวนวันชำระ"];

var SEQ_COL   = 1;                                  // คอลัมน์ "ลำดับ" — ระบบใส่ให้เอง
var ID_COL    = HEADERS.indexOf('ID') + 1;          // คีย์สำหรับ upsert
var OWNER_COL = DEBT_HEADERS.indexOf('ID ใบรายการ') + 1;

function doGet() {
  return json({ ok: true, version: VERSION, msg: 'โมเดลต้นทุนการเดินรถ API พร้อมใช้งาน (v' + VERSION + ')' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = JSON.parse(e.postData.contents);
    if (body.ping) {
      var ss = getSpreadsheet_();
      return json({ ok: true, pong: true, version: VERSION, sheet: ss.getName(), url: ss.getUrl() });
    }

    var sh = getSheet_(SHEET_NAME, HEADERS);
    var rows = body.rows || [];
    var idMap = buildIdMap_(sh);
    var added = 0, updated = 0;

    for (var i = 0; i < rows.length; i++) {
      var r = padRow_(rows[i], HEADERS.length);
      var id = String(r[ID_COL - 1]);
      if (idMap[id]) {
        sh.getRange(idMap[id], 1, 1, r.length).setValues([r]);
        updated++;
      } else {
        sh.appendRow(r);
        idMap[id] = sh.getLastRow();
        added++;
      }
    }

    var billsWritten = writeBills_(body.bills || [], body.billOwners || []);
    renumber_(sh);

    return json({ ok: true, version: VERSION, added: added, updated: updated, bills: billsWritten });
  } catch (err) {
    return json({ ok: false, version: VERSION, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** เขียนแถวลูกหนี้: ลบของใบรายการที่ส่งมาทั้งหมดก่อน แล้ว append ชุดใหม่ */
function writeBills_(bills, owners) {
  if (!owners.length && !bills.length) return 0;
  var sh = getSheet_(DEBT_SHEET_NAME, DEBT_HEADERS);

  if (owners.length) {
    var ownerSet = {};
    for (var i = 0; i < owners.length; i++) ownerSet[String(owners[i])] = true;
    var last = sh.getLastRow();
    if (last > 1) {
      var col = sh.getRange(2, OWNER_COL, last - 1, 1).getValues();
      for (var rIdx = col.length - 1; rIdx >= 0; rIdx--) {
        if (ownerSet[String(col[rIdx][0])]) sh.deleteRow(rIdx + 2);
      }
    }
  }

  if (bills.length) {
    var out = [];
    for (var b = 0; b < bills.length; b++) out.push(padRow_(bills[b], DEBT_HEADERS.length));
    sh.getRange(sh.getLastRow() + 1, 1, out.length, DEBT_HEADERS.length).setValues(out);
  }
  return bills.length;
}

/** เอาสเปรดชีตปลายทาง — ตามไอดีที่ตั้งไว้ ถ้าไม่ได้ตั้งก็ใช้ชีตที่สคริปต์ผูกอยู่ */
function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error(
    'สคริปต์นี้ไม่ได้ผูกกับสเปรดชีต จึงไม่รู้ว่าจะเขียนลงที่ไหน — ' +
    'ให้เปิดชีตที่ต้องการ คัดลอกไอดีจาก URL (ส่วนระหว่าง /d/ กับ /edit) ' +
    'มาใส่ในตัวแปร SPREADSHEET_ID ด้านบนของโค้ด แล้ว Deploy เวอร์ชันใหม่');
  return ss;
}

/**
 * ★ ตรวจก่อน Deploy — เลือกฟังก์ชันนี้ในช่องข้าง ▶ เรียกใช้ แล้วกดเรียกใช้
 *   จะบอกในบันทึกการดำเนินการว่ากำลังจะเขียนลงชีตชื่ออะไร ลิงก์ไหน
 */
function ตรวจสอบชีตปลายทาง() {
  var ss = getSpreadsheet_();
  var msg = 'จะเขียนลงชีต: "' + ss.getName() + '"\n' + ss.getUrl()
    + '\nแท็บที่ใช้: "' + SHEET_NAME + '" และ "' + DEBT_SHEET_NAME + '"';
  Logger.log(msg);
  return msg;
}

function getSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    // หัวตารางเก่า/สั้นกว่า → เขียนทับให้ตรงเวอร์ชันปัจจุบัน
    var width = Math.max(sh.getLastColumn(), headers.length);
    if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }
  return sh;
}

function buildIdMap_(sh) {
  var map = {};
  var last = sh.getLastRow();
  if (last > 1) {
    var vals = sh.getRange(2, ID_COL, last - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) map[String(vals[i][0])] = i + 2;
  }
  return map;
}

/** ใส่เลข "ลำดับ" ใหม่ให้ทุกแถวตามตำแหน่ง (1, 2, 3, ...) */
function renumber_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var seq = [];
  for (var i = 2; i <= last; i++) seq.push([i - 1]);
  sh.getRange(2, SEQ_COL, seq.length, 1).setValues(seq);
}

function padRow_(row, len) {
  var out = row.slice(0, len);
  while (out.length < len) out.push('');
  return out;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
