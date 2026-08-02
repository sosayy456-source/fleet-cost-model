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

var VERSION = 3;                        // ต้องตรงกับ GS_VERSION ในไฟล์ HTML
var SHEET_NAME = 'บันทึกเดินรถ';
var DEBT_SHEET_NAME = 'รายการลูกหนี้';

var HEADERS = ["ID","วันที่","เลขที่ใบรายการ","ประเภทเส้นทาง","ต้นทาง","ปลายทาง","ระยะทาง(กม.)","ประเภทรถ","ชนิดรถ",
  "ราคาน้ำมัน(บาท/ลิตร)","น้ำมัน(ลิตร)","ค่าแก๊ส","น้ำมันเดินทาง","ที่มาน้ำมันเดินทาง","น้ำมันไปเก็บสินค้า",
  "พนักงานขับ","พนักงานสำรอง","SND","ค่าเปิดปิดผ้าใบ","ค่าด่านตำรวจ","ค่าธรรมเนียมคืนตู้","ค่าเข้าท่าเรือ","ค่าส่งเอกสาร","ค่าทางด่วน",
  "ชนิดรถ(ค่าซ่อม)","ค่าซ่อมตามเวลา","ค่าซ่อมตามระยะทาง",
  "น้ำมันนอกเส้นทาง(สูญเปล่า)","ค่าแรงนอกเส้นทาง(สูญเปล่า)","ต้นทุนเดินทางรวม(ปกติ)","ต้นทุนสูญเปล่า","รายได้","กำไร/ขาดทุน",
  "สถานะชำระ","จำนวนลูกหนี้","ชำระแล้ว(ราย)","ยอดรวมบิล","วันที่ชำระครบ","จำนวนวันชำระ","รายการลูกหนี้"];

var DEBT_HEADERS = ["BillID","ID ใบรายการ","เลขที่ใบรายการ","วันที่","เส้นทาง",
  "เลขที่บิล","ผู้ส่ง","ผู้รับ","จำนวน","ราคารวม","ประเภทการชำระ","สถานะ","วันที่ชำระ","จำนวนวันชำระ"];

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
      var id = String(r[0]);
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
      var col = sh.getRange(2, 2, last - 1, 1).getValues();   // คอลัมน์ B = ID ใบรายการ
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
    var vals = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) map[String(vals[i][0])] = i + 2;
  }
  return map;
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
