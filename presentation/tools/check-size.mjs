import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
async function files(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat(); }
// วิดีโอสาธิต (dist/clips/) เป็นไฟล์ในเครื่องที่โหลดทีละไฟล์ตอนเล่น ไม่นับรวมงบหน้าเว็บ — รายงานแยก
const all = await files('dist');
const output = all.filter(file => !/[\\/]clips[\\/]/.test(file));
const clips = all.filter(file => /[\\/]clips[\\/]/.test(file));
for (const file of clips) console.log(`วิดีโอ ${file}: ${((await stat(file)).size / 1024 ** 2).toFixed(1)} MB (ไม่นับในงบ)`);
const fontFiles = (await files('src/assets/fonts')).filter(file => file.endsWith('.woff2'));
const fontBytes = (await Promise.all(fontFiles.map(file => stat(file)))).reduce((sum, item) => sum + item.size, 0);
if (fontBytes > 400 * 1024) throw new Error('ฟอนต์รวมเกิน 400 KB');
console.log(`ฟอนต์รวม ${(fontBytes / 1024).toFixed(1)} KB`);
let total = 0, js = 0, images = 0;
for (const file of output) {
  const size = (await stat(file)).size;
  total += size;
  if (file.endsWith('.js')) js += gzipSync(await readFile(file)).length;
  if (/\.(webp|png|jpe?g)$/.test(file)) { images += size; if (size > (file.includes('exec-long') ? 600 : 300) * 1024) throw new Error(`รูปเกินงบ: ${file}`); }
}
if (js > 300 * 1024 || images > 2.5 * 1024 ** 2 || total > 6 * 1024 ** 2) throw new Error('ขนาด build เกินงบ');
console.log(`ผ่านงบขนาด: JS gzip ${(js / 1024).toFixed(1)} KB · dist ${(total / 1024 ** 2).toFixed(2)} MB`);
