/**
 * โมเดลต้นทุนการเดินรถ → บันทึกลง Google Sheet   (VERSION 3)
 *
 * วิธีใช้ครั้งแรก:
 *   1) เปิด Google Sheet ของคุณ → เมนู "ส่วนขยาย" (Extensions) → Apps Script
 *   2) ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ → กดบันทึก (ไอคอนแผ่นดิสก์)
 *   3) กด "Deploy" (มุมขวาบน) → New deployment
 *        - Select type: Web app
 *        - Execute as: Me (บัญชีคุณ)
 *        - Who has access: Anyone          ← สำคัญมาก ถ้าไม่ใช่ Anyone จะบันทึกไม่ได้
 *        - กด Deploy → อนุญาตสิทธิ์ (Authorize) ให้เรียบร้อย
 *   4) คัดลอก "Web app URL" (ลงท้ายด้วย /exec) → เอาไปวางในหน้าเว็บโมเดล
 *
 * ★ ถ้าเคย Deploy เวอร์ชันเก่าไว้แล้ว (หน้าเว็บขึ้นว่า "โค้ดเป็นเวอร์ชันเก่า"):
 *   วางโค้ดนี้ทับ → บันทึก → Deploy → Manage deployments → กดดินสอ ✏ ที่ deployment เดิม
 *   → ช่อง Version เลือก "New version" → Deploy       (URL เดิมใช้ได้ต่อ ไม่ต้องเปลี่ยน)
 *
 * ระบบเป็นแบบ upsert:
 *   - ชีต "บันทึกเดินรถ"  : 1 แถว = 1 ใบรายการ (คีย์ = ID คอลัมน์ A)
 *   - ชีต "รายการลูกหนี้" : 1 แถว = ลูกหนี้ 1 ราย (คีย์ = BillID คอลัมน์ A, อ้างใบรายการที่คอลัมน์ B)
 *     ทุกครั้งที่ส่งใบรายการขึ้นมา จะลบแถวลูกหนี้เดิมของใบนั้นทิ้งแล้วเขียนใหม่ทั้งชุด
 */

var VERSION = 5;                        // ต้องตรงกับ GS_VERSION ในไฟล์ HTML
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
    if (body.ping) return json({ ok: true, pong: true, version: VERSION });

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

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
