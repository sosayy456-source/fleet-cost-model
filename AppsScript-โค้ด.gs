/**
 * โมเดลต้นทุนการเดินรถ → บันทึกลง Google Sheet   (VERSION 7)
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
 *    → วาง URL → กดบันทึกลิงก์ → กดทดสอบการเชื่อมต่อ (ต้องขึ้นว่า "โค้ด v7")
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

var VERSION = 7;                        // ต้องตรงกับ GS_VERSION ในไฟล์ HTML

// ★ ชีตปลายทางที่จะเขียนข้อมูลลง
//   ปล่อยว่าง ''  = เขียนลงชีตที่สคริปต์นี้ผูกอยู่ (กรณีเปิดจาก ส่วนขยาย → Apps Script)  ← ค่าเริ่มต้น
//   ใส่ไอดี      = เขียนลงชีตนั้นเสมอ (กรณีสร้างโปรเจกต์ Apps Script แยกไม่ได้ผูกกับชีต)
//                  ไอดีคือตัวอักษรยาว ๆ ใน URL ของชีต ระหว่าง /d/ กับ /edit
//                  เช่น https://docs.google.com/spreadsheets/d/[ไอดีอยู่ตรงนี้]/edit
var SPREADSHEET_ID = '';

var SHEET_NAME = 'ค่าเดินทาง';
var DEBT_SHEET_NAME = 'ลูกหนี้';

// ── ข้อมูลเก่า ──────────────────────────────────────────────
// ทุกแท็บที่ "ชื่อขึ้นต้นด้วย" คำนี้ จะถูกอ่านเข้ามาแสดงในโมเดลเป็นข้อมูลเก่า (อ่านอย่างเดียว)
// เพิ่มแท็บใหม่ได้เรื่อย ๆ เช่น "ข้อมูลเก่า 2567", "ข้อมูลเก่า เชียงราย" — ไม่ต้องแก้โค้ด
var OLD_SHEET_PREFIX = 'ข้อมูลเก่า';        // แท็บเที่ยววิ่งเก่า
var OLD_DEBT_PREFIX  = 'ข้อมูลเก่าลูกหนี้';  // แท็บลูกหนี้เก่า (ขึ้นต้นเหมือนกัน — ต้องเช็คตัวนี้ก่อนเสมอ)
var MERGED_SHEET_NAME = 'รวมทั้งหมด';     // แท็บสำหรับ Dashboard (เก่า + ใหม่)

// ชื่อหัวคอลัมน์ที่สะกดต่างกัน → ชื่อมาตรฐานที่โค้ดใช้
// อ่านข้อมูลด้วย "ชื่อหัวคอลัมน์" ไม่ใช่ตำแหน่ง ข้อมูลเก่าชุดหน้าที่เรียงคอลัมน์ต่างไปจึงยังอ่านได้
var HEADER_ALIAS = {
  'Rev ค่าบรรทุกทั้งใบรายการ': 'รายได้',
  'รายได้ค่าบรรทุก': 'รายได้',
  'ค่าบรรทุก': 'รายได้',
  'วันที่ตัดจ่าย': 'วันที่',
  'ค่าน้ำมันแบบเหมา': 'ค่าน้ำมันเหมา',
  'ทะเบียน': 'ทะเบียนรถ',
  'เส้นทาง': 'จุดขึ้น-จุดลง'
};

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

// คอลัมน์ 1–13 ตรงรูปแบบแท็บ "ข้อมูลเก่าลูกหนี้" · 14+ เป็นข้อมูลเสริมของโมเดล
var DEBT_HEADERS = [
  "วันที่","เลขที่ใบรายการ","เลขที่บิล","ประเภทสินค้า","ต้นทาง","ปลายทาง","ผู้ส่ง","ผู้รับ",
  "ประเภทการชำระเงิน","สถานะการชำระเงิน","จำนวน","ราคารวม","จำนวนวันค้างชำระ",
  // ───── ส่วนเสริมของโมเดล ─────
  "BillID","ID ใบรายการ","สาขา","วันที่ชำระ","จำนวนวันชำระ"];

var SEQ_COL   = 1;                                  // คอลัมน์ "ลำดับ" — ระบบใส่ให้เอง
var ID_COL    = HEADERS.indexOf('ID') + 1;          // คีย์สำหรับ upsert
var OWNER_COL = DEBT_HEADERS.indexOf('ID ใบรายการ') + 1;

function doGet() {
  return json({ ok: true, version: VERSION, msg: 'โมเดลต้นทุนการเดินรถ API พร้อมใช้งาน (v' + VERSION + ')' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, version: VERSION, error: 'อ่านข้อมูลที่ส่งมาไม่ได้: ' + err });
  }

  // ปุ่ม "ทดสอบการเชื่อมต่อ" — แค่อ่านชื่อชีต ไม่ต้องรอล็อก
  if (body.ping) {
    try {
      var ssPing = getSpreadsheet_();
      return json({ ok: true, pong: true, version: VERSION, sheet: ssPing.getName(), url: ssPing.getUrl() });
    } catch (err) {
      return json({ ok: false, version: VERSION, error: String(err) });
    }
  }

  // โหลดข้อมูลเก่ามาแสดงในโมเดล (เที่ยววิ่ง + ลูกหนี้) — อ่านอย่างเดียว ไม่ต้องรอล็อก
  if (body.loadOld) {
    try {
      var oldRecs = readOldRecords_();
      var oldDebt = readOldDebtors_();
      return json({ ok: true, version: VERSION, records: oldRecs, debtors: oldDebt,
        count: oldRecs.length, debtCount: oldDebt.length });
    } catch (err) {
      return json({ ok: false, version: VERSION, error: String(err) });
    }
  }

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(30000);
    if (!locked) {
      return json({ ok: false, version: VERSION, error:
        'มีการบันทึกอื่นค้างอยู่ ยังแทรกไม่ได้ — รอสักครู่แล้วกดบันทึกใหม่อีกครั้ง ' +
        '(ถ้าเกิน 5 นาทีแล้วยังไม่หาย ให้เปิด Apps Script → บันทึกการดำเนินการ ' +
        'ดูว่ามีรายการสถานะ "กำลังทำงาน" ค้างอยู่หรือไม่)' });
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

    // อัปเดตแท็บรวมสำหรับ Dashboard — ถ้าพลาดก็ไม่ให้กระทบการบันทึก
    var merged = -1, mergeErr = '';
    try { merged = rebuildMerged_(); } catch (e2) { mergeErr = String(e2); }

    return json({ ok: true, version: VERSION, added: added, updated: updated,
      bills: billsWritten, merged: merged, mergeError: mergeErr });
  } catch (err) {
    return json({ ok: false, version: VERSION, error: String(err) });
  } finally {
    if (locked) lock.releaseLock();     // ปล่อยเฉพาะตอนที่จับล็อกได้จริง
  }
}

/**
 * เขียนแถวลูกหนี้ของใบรายการที่ส่งมา
 * อ่านทั้งชีตทีเดียว → คัดแถวของใบรายการเดิมออก → ต่อแถวใหม่ → เขียนกลับทีเดียว
 * (เร็วกว่าลบทีละแถวมาก จึงไม่ถือล็อกค้างนานจนคำสั่งอื่นรอไม่ไหว)
 */
function writeBills_(bills, owners) {
  if (!owners.length && !bills.length) return 0;
  var sh = getSheet_(DEBT_SHEET_NAME, DEBT_HEADERS);
  var W = DEBT_HEADERS.length;
  var last = sh.getLastRow();
  var oldCount = Math.max(0, last - 1);

  var ownerSet = {};
  for (var i = 0; i < owners.length; i++) ownerSet[String(owners[i])] = true;

  var keep = [];
  if (oldCount > 0) {
    var all = sh.getRange(2, 1, oldCount, W).getValues();
    for (var r = 0; r < all.length; r++) {
      if (all[r].join('').toString().trim() === '') continue;          // ข้ามแถวว่าง
      if (ownerSet[String(all[r][OWNER_COL - 1])]) continue;           // ของใบรายการนี้ → เขียนใหม่
      keep.push(all[r]);
    }
  }
  for (var b = 0; b < bills.length; b++) keep.push(padRow_(bills[b], W));

  if (keep.length) sh.getRange(2, 1, keep.length, W).setValues(keep);
  var extra = oldCount - keep.length;
  if (extra > 0) sh.getRange(2 + keep.length, 1, extra, W).clearContent();
  return bills.length;
}

/* ═══════════════ อ่านข้อมูลเก่า + สร้างแท็บรวม ═══════════════ */

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** แปลงวันที่จากชีตเป็น YYYY-MM-DD (รับได้ทั้ง Date และข้อความ dd/mm/yyyy พ.ศ.) */
function toIsoDate_(v) {
  if (v instanceof Date) return v.getFullYear() + '-' + pad2_(v.getMonth() + 1) + '-' + pad2_(v.getDate());
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);          // dd/mm/yyyy
  if (m) {
    var y = +m[3];
    if (y > 2400) y -= 543;                                     // พ.ศ. → ค.ศ.
    return y + '-' + pad2_(+m[2]) + '-' + pad2_(+m[1]);
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);                 // ISO อยู่แล้ว
  if (m) return m[1] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[3]);
  return '';
}

/** ทำแผนที่ ชื่อหัวคอลัมน์ → เลขคอลัมน์ (ผ่านตารางชื่อพ้อง) */
function headerIndex_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var h = String(headerRow[i] || '').trim();
    if (!h) continue;
    var std = HEADER_ALIAS[h] || h;
    if (map[std] === undefined) map[std] = i;
  }
  return map;
}

/** แปลง 1 แถวในชีต → ออบเจ็กต์รายการ (คืน null ถ้าเป็นแถวที่ต้องตัดทิ้ง) */
function rowToRecord_(row, idx, source, sheetName, rowNo) {
  function g(k) { var i = idx[k]; return (i === undefined) ? '' : row[i]; }
  function n(k) {
    var v = g(k);
    if (typeof v === 'number') return v;
    var f = parseFloat(String(v || '').replace(/,/g, '').trim());
    return isNaN(f) ? 0 : f;
  }

  var docNo = String(g('เลขที่ใบรายการ') || '').trim();
  var revenue = n('รายได้');

  // ★ ตัดทิ้งเฉพาะแถวที่ขาด "ทั้ง" เลขที่ใบรายการ และ รายได้
  //   (อยากตัดแถวที่ขาดอย่างใดอย่างหนึ่งด้วย ให้เปลี่ยน && เป็น ||)
  if (!docNo && !revenue) return null;

  var route = String(g('จุดขึ้น-จุดลง') || '').trim();
  var origin = '', dest = '';
  if (route && route !== '-') {
    var p = route.split('-');
    if (p.length >= 2) { origin = p[0].trim(); dest = p.slice(1).join('-').trim(); }
    else origin = route;
  }

  var waste = n('ค่าน้ำมันรถวิ่งอ้อม') + n('ค่าน้ำมันนอกเส้นทาง(Fleet Card)')
            + n('เบี้ยเลี้ยงนอกเส้นทาง') + n('น้ำมันนอกเส้นทาง');
  var total  = n('รวมค่าใช้จ่าย');       // ชีตคำนวณไว้แล้ว = คอลัมน์ 9–28 (รวมสูญเปล่า ไม่รวมค่าซ่อม)
  var repair = n('ค่าซ่อมแซม');
  var fuel   = n('ค่าน้ำมันเหมา');       // ★ ค่าน้ำมันที่เป็นต้นทุนจริง (ไม่ใช่สูญเปล่า)

  return {
    id: (source === 'เก่า') ? ('OLD:' + sheetName + ':' + rowNo) : String(g('ID') || ''),
    source: source,
    sheetName: sheetName,
    date: toIsoDate_(g('วันที่')),
    docNo: docNo,
    branch: String(g('สาขา') || ''),
    docType: String(g('ประเภทใบรายการ') || ''),
    fleetType: String(g('ประเภทรถ') || ''),
    vehicle: String(g('ชนิดรถ') || ''),
    plate: String(g('ทะเบียนรถ') || ''),
    origin: origin,
    dest: dest,
    revenue: revenue,
    fuelSum: fuel,
    sheetTotal: total,
    waste: waste,
    normal: total - waste + repair,      // ต้นทุนปกติ = รวมทั้งหมด − สูญเปล่า + ค่าซ่อม
    repTotal: repair,
    profit: revenue - total - repair,
    bills: []                            // ข้อมูลเก่าไม่มีรายละเอียดลูกหนี้
  };
}

/** อ่านแท็บเที่ยววิ่งเก่า — ทุกแท็บที่ขึ้นต้นด้วย "ข้อมูลเก่า" แต่ไม่ใช่แท็บลูกหนี้เก่า */
function readOldRecords_() {
  var ss = getSpreadsheet_();
  var sheets = ss.getSheets();
  var out = [];
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], name = sh.getName();
    if (name.indexOf(OLD_SHEET_PREFIX) !== 0) continue;
    if (name.indexOf(OLD_DEBT_PREFIX) === 0) continue;      // แท็บลูกหนี้เก่า — อ่านที่อื่น
    var last = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (last < 2 || lastCol < 1) continue;
    var vals = sh.getRange(1, 1, last, lastCol).getValues();
    var idx = headerIndex_(vals[0]);
    for (var r = 1; r < vals.length; r++) {
      if (vals[r].join('').toString().trim() === '') continue;
      var rec = rowToRecord_(vals[r], idx, 'เก่า', name, r + 1);
      if (rec) out.push(rec);
    }
  }
  return out;
}

/** อ่านแท็บลูกหนี้เก่า — ทุกแท็บที่ขึ้นต้นด้วย "ข้อมูลเก่าลูกหนี้" */
function readOldDebtors_() {
  var ss = getSpreadsheet_();
  var sheets = ss.getSheets();
  var out = [];
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s], name = sh.getName();
    if (name.indexOf(OLD_DEBT_PREFIX) !== 0) continue;
    var last = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (last < 2 || lastCol < 1) continue;
    var vals = sh.getRange(1, 1, last, lastCol).getValues();
    var idx = headerIndex_(vals[0]);

    for (var r = 1; r < vals.length; r++) {
      var row = vals[r];
      if (row.join('').toString().trim() === '') continue;

      var g = (function (rr) {
        return function (k) { var i = idx[k]; return (i === undefined) ? '' : rr[i]; };
      })(row);
      var n = (function (gg) {
        return function (k) {
          var v = gg(k);
          if (typeof v === 'number') return v;
          var f = parseFloat(String(v || '').replace(/,/g, '').trim());
          return isNaN(f) ? 0 : f;
        };
      })(g);

      var billNo = String(g('เลขที่บิล') || '').trim();
      var docNo  = String(g('เลขที่ใบรายการ') || '').trim();
      if (!billNo && !docNo) continue;                       // แถวว่างจริง ๆ

      var status = String(g('สถานะการชำระเงิน') || '').trim() || 'ยังไม่ได้ชำระ';
      out.push({
        id: 'OLDB:' + name + ':' + (r + 1),
        source: 'เก่า',
        sheetName: name,
        date: toIsoDate_(g('วันที่')),
        docNo: docNo,
        billNo: billNo,
        goodsType: String(g('ประเภทสินค้า') || ''),
        origin: String(g('ต้นทาง') || ''),
        dest: String(g('ปลายทาง') || ''),
        sender: String(g('ผู้ส่ง') || ''),
        receiver: String(g('ผู้รับ') || ''),
        payType: String(g('ประเภทการชำระเงิน') || ''),
        status: status,
        paid: (status === 'ชำระแล้ว'),
        qty: n('จำนวน'),
        total: n('ราคารวม'),
        agingDays: n('จำนวนวันค้างชำระ'),
        payDate: toIsoDate_(g('วันที่ชำระ')),
        daysToPay: n('จำนวนวันชำระ')
      });
    }
  }
  return out;
}

/** อ่านแท็บข้อมูลใหม่ (ค่าเดินทาง) ด้วยวิธีเดียวกัน — ใช้ตอนสร้างแท็บรวม */
function readNewRecords_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) return [];
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2 || lastCol < 1) return [];
  var vals = sh.getRange(1, 1, last, lastCol).getValues();
  var idx = headerIndex_(vals[0]);
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    if (vals[r].join('').toString().trim() === '') continue;
    var rec = rowToRecord_(vals[r], idx, 'ใหม่', SHEET_NAME, r + 1);
    if (rec) {
      rec.payStatus = String(vals[r][idx['สถานะชำระ']] || '');
      out.push(rec);
    }
  }
  return out;
}

// หัวตารางของแท็บรวม — จัดให้พร้อมทำ Dashboard (มีคอลัมน์ ปี/เดือน ไว้ทำกราฟตามเวลา)
var MERGED_HEADERS = ['แหล่งข้อมูล','วันที่','ปี','เดือน','สาขา','เลขที่ใบรายการ','ประเภทใบรายการ',
  'ประเภทรถ','ชนิดรถ','ทะเบียนรถ','ต้นทาง','ปลายทาง','จุดขึ้น-จุดลง',
  'รายได้','ค่าน้ำมันเหมา','รวมค่าใช้จ่าย','ต้นทุนปกติ','ต้นทุนสูญเปล่า','ค่าซ่อมแซม','กำไร/ขาดทุน',
  'สถานะชำระ','ID'];

function recToMergedRow_(r) {
  var y = r.date ? +r.date.slice(0, 4) : '';
  var m = r.date ? +r.date.slice(5, 7) : '';
  return [ r.source, r.date, y ? y + 543 : '', m, r.branch, r.docNo, r.docType,
    r.fleetType, r.vehicle, r.plate, r.origin, r.dest,
    (r.origin && r.dest) ? (r.origin + '-' + r.dest) : '',
    r.revenue, r.fuelSum, r.sheetTotal, r.normal, r.waste, r.repTotal, r.profit,
    r.payStatus || '', r.id ];
}

/** สร้าง/อัปเดตแท็บ "รวมทั้งหมด" — ข้อมูลใหม่ + ข้อมูลเก่า เรียงตามวันที่ */
function rebuildMerged_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(MERGED_SHEET_NAME) || ss.insertSheet(MERGED_SHEET_NAME);
  var W = MERGED_HEADERS.length;

  if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
  sh.getRange(1, 1, 1, W).setValues([MERGED_HEADERS]).setFontWeight('bold');
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);

  var all = readNewRecords_().concat(readOldRecords_());
  all.sort(function (a, b) { return (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0; });

  var rows = [];
  for (var i = 0; i < all.length; i++) rows.push(recToMergedRow_(all[i]));

  var oldCount = Math.max(0, sh.getLastRow() - 1);
  if (rows.length) sh.getRange(2, 1, rows.length, W).setValues(rows);
  var extra = oldCount - rows.length;
  if (extra > 0) sh.getRange(2 + rows.length, 1, extra, W).clearContent();
  return rows.length;
}

/** ★ กดจากเมนูเพื่ออัปเดตแท็บรวมเอง (ปกติระบบอัปเดตให้ทุกครั้งที่บันทึกอยู่แล้ว) */
function อัปเดตแท็บรวมทั้งหมด() {
  var n = rebuildMerged_();
  var msg = 'อัปเดตแท็บ "' + MERGED_SHEET_NAME + '" แล้ว ' + n + ' แถว';
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'เสร็จแล้ว', 5); } catch (e) {}
  return msg;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('โมเดลเดินรถ')
      .addItem('อัปเดตแท็บรวมทั้งหมด', 'อัปเดตแท็บรวมทั้งหมด')
      .addItem('ตรวจสอบชีตปลายทาง', 'ตรวจสอบชีตปลายทาง')
      .addToUi();
  } catch (e) {}
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
