import { Scene, type Build } from '../engine/Scene';
import { AppWindow } from '../mock/AppWindow';
import { RolePickerMock } from '../mock/RolePickerMock';
import { BillEntryMock } from '../mock/BillEntryMock';
import { Narration } from '../narration/Narration';
import { move, click, type, select, autoCalc, spotlight, camera, modal, toast, numberRoll, pageSwitch } from '../primitives';
import scenario from '../data/scenario.json';
import styles from './Walkthrough.module.css';
import theme from '../mock/theme.module.css';
const steps = [.14, .30, .63, .88, 1] as const;
const bill = scenario.bills[0];
// ตารางเป้าหมายรายขั้น ใช้ร่วมกับการทดสอบและระบุตำแหน่งเคอร์เซอร์/กล้อง
export const targetsByStep = [
  ['r1.cs','r1.continue'],
  ['r1.sender','r1.receiver','r1.origin','r1.dest','r1.qty','r1.weight','r1.width','r1.length','r1.height','r1.pricingType','r1.unitPrice'],
  ['r1.sender','r1.receiver','r1.origin','r1.dest','r1.qty','r1.weight','r1.width','r1.length','r1.height','r1.pricingType','r1.unitPrice','r1.auto'],
  ['r1.review','r1.summary','r1.save','r1.receipt','r1.toast'],
  ['handoff.cs','handoff.dispatch'],
] as const;
const build: Build = (tl, root) => {
  const get = (id: string) => root.querySelector<HTMLElement>(`[data-target="${id}"]`)!;
  const cam = root.querySelector<HTMLElement>('[data-camera]')!;
  const picker = root.querySelector<HTMLElement>('[data-page="picker"]')!;
  const form = root.querySelector<HTMLElement>('[data-page="bill"]')!;
  const handoff = root.querySelector<HTMLElement>('[data-page="handoff"]')!;
  const narrations = [...root.querySelectorAll<HTMLElement>('[data-narration]')];
  const cursor = document.getElementById('demo-cursor');
  [.15,.31,.64,.9].forEach((at,i) => {
    pageSwitch(tl,narrations[i],narrations[i+1],at,.018);
    tl.to(narrations[i],{ y:-24,duration:.018 },at);
  });
  tl.to(root.querySelector('[data-role-intro]'), { autoAlpha: 0, y: -20, duration: .035 }, .005);
  move(tl,get('r1.cs'),.015,.022); click(tl,get('r1.cs'),.038);
  tl.to(get('r1.cs').querySelector('[data-focus]'), { autoAlpha: 1, duration: .01 }, .04);
  tl.set(get('r1.continue'), { background: '#7A1F3D', color: '#F5F1EC' }, .04);
  const continueText = get('r1.continue').querySelector<HTMLElement>('[data-continue]')!;
  type(tl,continueText,'Continue as Customer Service',.04,.01);
  move(tl,get('r1.continue'),.055,.02); click(tl,get('r1.continue'),.077);
  pageSwitch(tl,picker,form,.086,.025);
  camera(tl,cam,get('r1.form'),1.05,.112,.02);
  if (cursor) tl.to(cursor, { autoAlpha: 0, duration: .008 }, .125);

  const allFields = [...get('r1.form').querySelectorAll<HTMLElement>('[data-target]')].filter(x => x.querySelector('[data-value]'));
  const groups = [['sender','receiver'],['origin','dest'],['qty','weight','width','length','height'],['pricingType','unitPrice']];
  groups.forEach((ids,i) => {
    const active = ids.map(id => get(`r1.${id}`));
    spotlight(tl,active,allFields.filter(x => !active.includes(x)),.16 + i * .032,.023);
    const caption = root.querySelector(`[data-caption="${i}"]`);
    tl.fromTo(caption, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .006 }, .16+i*.032).to(caption,{autoAlpha:0,duration:.005},.185+i*.032);
  });

  const order = ['sender','receiver','origin','dest','qty','weight','width','length','height','pricingType','unitPrice'] as const;
  order.forEach((id,i) => {
    const field = get(`r1.${id}`), at = .32 + i * .024;
    camera(tl,cam,field,1.65,at,.012); move(tl,field,at+.004,.009); click(tl,field,at+.012);
    if (['origin','dest','pricingType'].includes(id)) select(tl,field,String(bill[id]),at+.012,.01);
    else type(tl,field.querySelector<HTMLElement>('[data-value]')!,String(bill[id]),at+.012,.01,typeof bill[id] === 'number' ? Number(bill[id]).toLocaleString('th-TH') : String(bill[id]));
  });
  tl.to(root.querySelector('[data-warning]'), { autoAlpha: 0, duration: .006 }, .363);
  autoCalc(tl,root.querySelector<HTMLElement>('[data-volume]')!,0,bill.volume,.535,.016,3);
  autoCalc(tl,root.querySelector<HTMLElement>('[data-total]')!,0,bill.total,.577,.018);
  camera(tl,cam,get('r1.auto'),1.45,.598,.025);
  if (cursor) tl.to(cursor, { autoAlpha: 0, duration: .007 }, .617);

  camera(tl,cam,get('r1.form'),1.05,.643,.02);
  move(tl,get('r1.review'),.665,.015); click(tl,get('r1.review'),.681);
  pageSwitch(tl,get('r1.form'),get('r1.summary'),.69,.02);
  camera(tl,cam,get('r1.summary'),1.1,.697,.02);
  move(tl,get('r1.save'),.733,.015); click(tl,get('r1.save'),.749);
  pageSwitch(tl,get('r1.summary'),get('r1.form'),.759,.015);
  const savedState = { saved: 0 };
  tl.fromTo(savedState, { saved: 0 }, { saved: 1, duration: .001, immediateRender:false, onUpdate: () => {
    // ตอน refresh GSAP อาจย้อน tween นี้ก่อนถึงช่วงกรอก ห้ามทับข้อความที่ Type กำลังคืนค่า
    if (tl.time() < .63) return;
    const saved = savedState.saved >= .5;
    for (const id of order) {
      const value = saved ? (id === 'pricingType' ? 'คิดตามน้ำหนัก' : '') : (typeof bill[id] === 'number' ? Number(bill[id]).toLocaleString('th-TH') : String(bill[id]));
      get(`r1.${id}`).querySelector('[data-value]')!.textContent = value;
    }
    root.querySelector('[data-volume]')!.textContent = saved ? '0.000' : bill.volume.toFixed(3);
    root.querySelector('[data-total]')!.textContent = saved ? '0' : bill.total.toLocaleString('th-TH');
    root.querySelector('[data-pending]')!.textContent = String(saved ? scenario.bills.length : scenario.bills.filter(b=>b.existing).length);
  } }, .775);
  // ใบเสร็จลอยเป็นคำขยายของงานนำเสนอ; หน้าจริงกลับไปฟอร์มเมื่อบันทึกสำเร็จ
  modal(tl,get('r1.receipt'),true,.78,.015); numberRoll(tl,get('r1.receipt'),.795);
  camera(tl,cam,null,1,.77,.02); toast(tl,get('r1.toast'),.843);
  if (cursor) tl.to(cursor, { autoAlpha: 0, duration: .007 }, .86);
  pageSwitch(tl,form,handoff,.917,.035);
  tl.to(get('handoff.cs').querySelector('[data-order]'), { autoAlpha:1,duration:.015 },.95);
  tl.to(get('handoff.dispatch').querySelector('[data-focus]'), { autoAlpha:1,duration:.02 },.966);
};
export function R1CustomerService() {
  return <Scene id="r1" title="บันทึกบิล" steps={steps} pinVh={600} tone="work" build={build}><div className={styles.split}><Narration/><div className={styles.visual}><AppWindow name="หน้าจำลองฝ่ายบริการลูกค้า"><div data-page="picker" className={theme.page}><RolePickerMock prefix="r1"/></div><div data-page="bill" className={`${theme.page} ${styles.hidden}`}><BillEntryMock bill={bill} existingCount={scenario.bills.filter(b=>b.existing).length}/></div><div data-page="handoff" className={`${theme.page} ${styles.hidden}`}><RolePickerMock prefix="handoff" completed/></div></AppWindow><div className={styles.captions}>{['ใครส่ง — ใครรับ','ต้นทาง — ปลายทาง','จำนวน น้ำหนัก และขนาดต่อหน่วย','เกณฑ์คิดราคา และราคาต่อหน่วย'].map((s,i)=><p key={s} data-caption={i}>{s}</p>)}</div></div></div><div className={styles.roleIntro} data-role-intro><span>01 / CUSTOMER SERVICE</span><h2>ฝ่ายบริการลูกค้า</h2><p>จุดเริ่มต้นของทุกบิล</p></div></Scene>;
}
