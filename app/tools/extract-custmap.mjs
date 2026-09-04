/**
 * ดึงตารางรหัสลูกค้าออกจาก โมเดลเดินรถ-gsheet-v5.html เป็นไฟล์ไบนารี
 *
 * ของเดิมฝัง base64 4.6 MB ไว้ในบรรทัดเดียวของ HTML (CUSTMAP_B64) ทำให้เบราว์เซอร์
 * ต้อง parse JS 4.9 MB ทุกครั้งที่เปิดหน้า แม้จะไม่ได้ใช้ฟีเจอร์นี้เลย
 * แยกออกมาเป็นไฟล์ .bin แล้ว fetch เฉพาะตอนเข้าหน้าค้นรหัสลูกค้าแทน
 *
 * โครงสร้าง: 584,941 ระเบียน × 6 ไบต์ big-endian = 12 hex แรกของ hash ลูกค้า
 * เรียงตามลำดับแถวเดิม รหัสคือเลขแถว: แถวที่ 1 = CUS0000001
 *
 *   node tools/extract-custmap.mjs ../โมเดลเดินรถ-gsheet-v5.html public/custmap.bin
 */
import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const [, , HTML, OUT] = process.argv;

const rl = createInterface({ input: createReadStream(HTML, "utf8"), crlfDelay: Infinity });
let b64 = null;
for await (const line of rl) {
  const m = /^const CUSTMAP_B64\s*=\s*"([^"]+)"/.exec(line);
  if (m) { b64 = m[1]; break; }
}
rl.close();

if (!b64) {
  console.error("ไม่พบ CUSTMAP_B64 ในไฟล์ — ตรวจว่าใช้ v5.html ตัวที่ถูกต้อง");
  process.exit(1);
}

const buf = Buffer.from(b64, "base64");
if (buf.length % 6 !== 0) {
  console.error(`ขนาดไม่ลงตัวกับระเบียนละ 6 ไบต์ (${buf.length})`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);

const n = buf.length / 6;
console.log(`เขียน ${OUT}`);
console.log(`  ${n.toLocaleString()} ระเบียน · ${(buf.length / 1048576).toFixed(2)} MB`);
console.log(`  base64 เดิม ${(b64.length / 1048576).toFixed(2)} MB → ประหยัด ${((1 - buf.length / b64.length) * 100).toFixed(0)}%`);
console.log(`  ระเบียนแรก = CUS0000001 = ${buf.subarray(0, 6).toString("hex")}…`);
