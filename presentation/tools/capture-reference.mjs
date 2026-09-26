import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ executablePath: process.argv[3], headless:true });
const context = await browser.newContext({ viewport:{width:1440,height:900} });
// ไม่อนุญาตคำขอเขียนและไม่ติดต่อบริการภายนอกระหว่างเปิดแอปอ้างอิง
await context.route('**/*', route => {
  const req=route.request(), url=new URL(req.url());
  if (!['GET','HEAD'].includes(req.method()) || !['127.0.0.1','localhost'].includes(url.hostname)) return route.abort();
  return route.continue();
});
const page = await context.newPage();
await mkdir('qa/v3',{recursive:true});
await page.goto('http://127.0.0.1:5174/fleet-cost-model/');
await page.getByRole('heading',{name:'Select your role'}).waitFor();
await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(1200);
await page.screenshot({path:'qa/v3/reference-role.png'});
await page.getByRole('radio').filter({hasText:'Customer Service'}).click();
await page.getByRole('button',{name:'Continue as Customer Service'}).click();
await page.getByRole('heading',{name:'บิลใหม่',exact:true}).waitFor();
await page.waitForTimeout(1000);
await page.screenshot({path:'qa/v3/reference-bill.png'});
await writeFile('qa/v3/reference-fields.json',JSON.stringify(await page.locator('.bill-grid .f').evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('label')?.textContent,rect:n.getBoundingClientRect().toJSON()}))),null,2));
await browser.close();
console.log('เก็บภาพแอปจริงสองหน้าแล้ว ไม่มีการกดบันทึกหรือส่งคำขอเขียน');
