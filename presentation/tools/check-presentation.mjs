import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ executablePath:process.argv[3], headless:true });
const url = pathToFileURL(resolve('dist/index.html')).href;
const hashes=['#r0-1','#r0-2','#r1-1','#r1-2','#r1-3','#r1-4','#r1-5'];
await mkdir('qa/v3',{recursive:true});
const report=[];
async function state(page) {
  return page.evaluate(() => {
    const visible = node => { for(let n=node;n;n=n.parentElement) { const s=getComputedStyle(n); if(s.visibility==='hidden'||Number(s.opacity)<.9)return false; } return true; };
    const rect=node=>node.getBoundingClientRect().toJSON();
    return {hash:location.hash, sender:document.querySelector('[data-target="r1.sender"] [data-value]').textContent,
      total:document.querySelector('[data-total]').textContent, volume:document.querySelector('[data-volume]').textContent,
      pages:[...document.querySelectorAll('#r1 [data-page]')].filter(visible).map(n=>n.dataset.page),
      narration:[...document.querySelectorAll('[data-narration]')].filter(visible).map(n=>Number(n.dataset.narration)),
      summary:visible(document.querySelector('[data-target="r1.summary"]')),
      receipt:visible(document.querySelector('[data-target="r1.receipt"]')),
      toast:visible(document.querySelector('[data-target="r1.toast"]')),
      pending:document.querySelector('[data-pending]').textContent,
      cursor:document.querySelectorAll('#demo-cursor').length,
      window:rect(document.querySelector('#r1 [data-window]')),
      totalRect:rect(document.querySelector('[data-total]')),
      volumeRect:rect(document.querySelector('[data-volume]')),
      nodes:document.querySelectorAll('*').length,
      typing:document.querySelectorAll('.typing').length,
      viewport:{width:innerWidth,height:innerHeight},
    };
  });
}
function verify(s,i) {
  assert.equal(s.hash,hashes[i]); assert(s.nodes<3000); assert.equal(s.typing,0);
  if(i>=2){ assert.deepEqual(s.narration,[i-2]); assert.deepEqual(s.pages,[i===6?'handoff':'bill']); assert(!s.summary); }
  if(i===2||i===3){ assert.equal(s.sender,''); assert(!s.receipt); assert(!s.toast); }
  if(i===4){
    assert.equal(s.sender,'ร้านตัวอย่าง ก'); assert.equal(s.volume,'4.800'); assert.equal(s.total,'3,400'); assert(!s.receipt);
    for(const rect of [s.volumeRect,s.totalRect]) { assert(rect.x>=s.window.x); assert(rect.x+rect.width<=s.window.x+s.window.width); assert(rect.y>=s.window.y); assert(rect.y+rect.height<=s.window.y+s.window.height); }
  }
  if(i===5){ assert(s.receipt); assert(s.toast); assert.equal(s.pending,'3'); assert.equal(s.sender,''); }
}
for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
  const page=await browser.newPage({viewport}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='warning')errors.push(m.text());});
  await page.context().setOffline(true);
  await page.goto(url); await page.waitForTimeout(1200);
  for(let i=0;i<7;i++){
    if(i)await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1750);
    const s=await state(page); verify(s,i);
    await page.screenshot({path:`qa/v3/${viewport.width}-${i+1}.png`});
    report.push({mode:'ปกติ',width:viewport.width,step:i+1,...s});
  }
  for(let i=5;i>=0;i--){await page.keyboard.press('ArrowLeft');await page.waitForTimeout(1750);verify(await state(page),i);}
  await page.goto(url+'#r1-3'); await page.waitForTimeout(1500); verify(await state(page),4);
  await page.reload(); await page.waitForTimeout(1500); verify(await state(page),4);
  await page.setViewportSize(viewport.width===1280?{width:1920,height:1080}:{width:1280,height:720});await page.waitForTimeout(1700);verify(await state(page),4);
  await page.keyboard.press('p');assert(await page.getByRole('complementary',{name:'โน้ตผู้นำเสนอ'}).isVisible());await page.keyboard.press('p');
  // เลื่อนด้วยล้อผ่านช่วงพิมพ์โดยปิด snap ชั่วคราวผ่านการเคลื่อนต่อเนื่อง
  await page.goto(url+'#r1-2');await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 350);await page.waitForTimeout(180);
  const partial=await page.locator('[data-target="r1.sender"] [data-value]').textContent();
  await page.keyboard.press('ArrowLeft');await page.waitForTimeout(1750);
  assert.equal(await page.locator('[data-target="r1.sender"] [data-value]').textContent(),'');
  assert.equal(errors.length,0,errors.join('\n'));
  report.push({width:viewport.width,reverse:true,reload:true,resize:true,partial});
  await page.close();
}
for(const mode of ['lite','reduced-motion']) {
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.context().setOffline(true);await page.goto(url+(mode==='lite'?'?lite':''));await page.waitForTimeout(1000);
  for(let i=0;i<7;i++){
    if(i)await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);
    const s=await state(page);verify(s,i);assert.equal(s.cursor,0);report.push({mode,step:i+1,...s});
  }
  await page.screenshot({path:`qa/v3/${mode}.png`});
  await page.goto(url+(mode==='lite'?'?lite':'')+'#r1-3');await page.waitForTimeout(700);verify(await state(page),4);
  for(let i=3;i>=0;i--){await page.keyboard.press('ArrowLeft');await page.waitForTimeout(150);verify(await state(page),i);}
  assert.equal(errors.length,0,errors.join('\n'));await page.close();
}
await writeFile('qa/v3/report.json',JSON.stringify(report,null,2));
await browser.close();
console.log('ผ่าน: 7 ขั้น สองขนาดจอ ย้อนกลับ hash reload resize โน้ต โหมด lite/reduced-motion และออฟไลน์');
