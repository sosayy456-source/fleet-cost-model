import { readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// ฝังสคริปต์แบบ IIFE และ CSS เพื่อเปิดด้วย file:// ได้โดยไม่ติดข้อจำกัด ES modules
const root = resolve('dist');
let html = await readFile(resolve(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for (const match of scripts) {
  const js = await readFile(resolve(root, match[1]), 'utf8');
  html = html.replace(match[0], () => `<script>${js.replaceAll('</script', '<\\/script')}</script>`);
}
const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)];
for (const match of styles) {
  const css = await readFile(resolve(root, match[1]), 'utf8');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
// สคริปต์ที่ฝังต้องทำงานหลัง root ปรากฏ
html = html.replace(/(<script>[\s\S]*?<\/script>)/g, '');
const js = await Promise.all(scripts.map(match => readFile(resolve(root, match[1]), 'utf8')));
// ฟอนต์แยกจาก JS ใน build ปกติ แต่ฝังในฉบับพกพาเพื่อให้ file:// ใช้ได้
for (const name of await readdir(resolve(root, 'assets'))) {
  if (!name.endsWith('.woff2')) continue;
  const uri = `data:font/woff2;base64,${(await readFile(resolve(root, 'assets', name))).toString('base64')}`;
  for (let i = 0; i < js.length; i++) js[i] = js[i].replaceAll(JSON.stringify(name), JSON.stringify(uri));
}
html = html.replace('</body>', () => `${js.map(code => `<script>${code.replaceAll('</script', '<\\/script')}</script>`).join('')}</body>`);
await writeFile(resolve(root, 'index.html'), html);
await copyFile('src/assets/fonts/OFL.txt', resolve(root, 'OFL.txt'));
for (const name of await readdir('src/assets/fonts')) if (name.endsWith('-OFL.txt')) await copyFile(`src/assets/fonts/${name}`, resolve(root, name));
console.log('สร้าง dist/index.html สำหรับเปิดออฟไลน์แล้ว');
