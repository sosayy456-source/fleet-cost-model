// รวม dist-real/ + ตัวเปิดเว็บ (tools/pack/) เป็นโฟลเดอร์ส่งงาน pack-real/ — zip เดียวเปิดได้ทั้ง Windows และ Mac
// Windows: พิมพ์ run-model ใน cmd (PowerShell ที่มากับ Windows) · Mac: sh run-model.sh ใน Terminal (python3 หรือ ruby ที่มากับเครื่อง)
// ★ ไม่อ่านเนื้อหาไฟล์ข้อมูล แค่คัดลอกทั้งโฟลเดอร์ · pack-real/ มีข้อมูลจริง ติด .gitignore
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "dist-real";
const OUT = "pack-real";
const BOM = "﻿";

if (!existsSync(`${SRC}/index.html`)) {
  console.error("✗ ไม่พบ dist-real/ — รัน npm run build:real ก่อน");
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
// site/fleet-cost-model/ = path เดียวกับ base ของ Vite — ตัวเสิร์ฟพื้นฐานบน Mac (python3 -m http.server · ruby httpd) ตั้ง base ไม่ได้
cpSync(SRC, `${OUT}/site/fleet-cost-model`, { recursive: true });

// PowerShell 5.1 อ่าน .ps1 ที่ไม่มี BOM เป็น ANSI ภาษาไทยจะเพี้ยน · cmd/txt ใช้ CRLF ให้ Notepad/cmd รุ่นเก่าอ่านถูก
// .sh ต้องเป็น LF ล้วน ไม่มี BOM ไม่งั้น sh บน Mac อ่านบรรทัดแรกไม่ออก
const read = (f) => readFileSync(`tools/pack/${f}`, "utf8").replace(/^﻿/, "");
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
const lf = (s) => s.replace(/\r\n/g, "\n");
writeFileSync(`${OUT}/server.ps1`, BOM + crlf(read("server.ps1")), "utf8");
writeFileSync(`${OUT}/run-model.cmd`, crlf(read("run-model.cmd")), "utf8");
writeFileSync(`${OUT}/run-model.sh`, lf(read("run-model.sh")), { encoding: "utf8", mode: 0o755 });
writeFileSync(`${OUT}/อ่านก่อน.txt`, BOM + crlf(read("อ่านก่อน.txt")), "utf8");

const built = statSync(`${SRC}/index.html`).mtime.toLocaleString("th-TH");
console.log(`✓ สร้าง ${OUT}/ แล้ว (เว็บจาก build:real เมื่อ ${built})`);
console.log(`  บีบเป็น zip ทั้งโฟลเดอร์ ${OUT}/ แล้วส่ง · Windows: run-model ใน cmd · Mac: sh run-model.sh ใน Terminal`);
