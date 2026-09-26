import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const html = await readFile('dist/index.html', 'utf8');
assert(!/<script\b[^>]*\bsrc=/.test(html), 'ยังมีสคริปต์ที่ต้องโหลดแยก');
assert(!/<link\b[^>]*\bhref=/.test(html), 'ยังมีสไตล์ที่ต้องโหลดแยก');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(scripts.length > 0, 'ไม่พบสคริปต์');
for (const [, js] of scripts) new Script(js);
assert(html.indexOf('id="root"') < html.indexOf('<script>'), 'สคริปต์ทำงานก่อนมี root');
assert((html.match(/data:font\/woff2;base64,/g) ?? []).length >= 3, 'ฟอนต์ LINE Seed ไม่ได้ฝังครบ');
assert(!/new URL\("[^\"]+\.woff2"/.test(html), 'ยังมีฟอนต์ที่ต้องโหลดแยก');
await readFile('dist/OFL.txt');
console.log('ตรวจไฟล์ออฟไลน์ผ่าน: สคริปต์อ่านได้ ฟอนต์ฝังครบ และแนบสัญญาอนุญาตแล้ว (ยังไม่ใช่การทดสอบเบราว์เซอร์)');
