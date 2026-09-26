import type { ScenarioBill } from '../data/scenario';
import { CustomerServiceShell } from './AppWindow';
import { NumberRoll } from '../primitives/NumberRoll';
import styles from './theme.module.css';
export const fields = [
  ['sender','ผู้ส่ง','ชื่อหรือรหัสลูกค้า'], ['receiver','ผู้รับ','ชื่อหรือรหัสลูกค้า'],
  ['origin','ต้นทาง','เลือกต้นทาง'], ['dest','ปลายทาง','เลือกปลายทาง'],
  ['qty','จำนวน (หน่วย)','0'], ['weight','น้ำหนักรวม (กก.)','0'],
  ['width','กว้าง (ซม.)','0'], ['length','ยาว (ซม.)','0'], ['height','สูง (ซม.)','0'],
] as const;
function Field({ id, label, placeholder = '', value = '', options }: { id: string; label: string; placeholder?: string; value?: string; options?: string[] }) {
  return <div className={styles.field} data-target={`r1.${id}`}><label>{label}</label><div className={styles.input} data-placeholder={placeholder}><span data-value>{value}</span>{options && <i>⌄</i>}<span data-focus className="focus-ring"/></div>{options && <div data-dropdown className={styles.dropdown}>{options.map(x => <div className={styles.option} key={x}>{x}</div>)}</div>}</div>;
}
export function BillEntryMock({ bill, existingCount, filled = false }: { bill: ScenarioBill; existingCount: number; filled?: boolean }) {
  return <CustomerServiceShell><div className={styles.tabs}><span>กรอกบิลใหม่</span><span>บิลที่ยังไม่ได้จัดรถ <b data-pending>{existingCount}</b></span></div><div data-target="r1.form" className={styles.card}>
    <div className={styles.cardHeader}><span className={styles.step}>1</span><h2>บิลใหม่</h2><small>กรอกได้หลายบิลพร้อมกัน · เลขที่บิลระบบออกให้ตอนบันทึก</small></div>
    <div className={styles.bill}><div className={styles.billTitle}><b>บิลที่ 1</b></div><div className={styles.grid}>
      <Field id="date" label="วันที่รับสินค้า" value={bill.dateDisplay}/><Field id="branch" label="สาขา" value={bill.branch} options={[bill.branch]}/><Field id="serviceGroup" label="กลุ่มบริการ" value={bill.serviceGroup} options={[bill.serviceGroup]}/>
      {fields.map(([id,label,placeholder]) => <Field key={id} id={id} label={label} placeholder={placeholder} value={filled ? String(bill[id]) : ''} options={id === 'origin' ? ['เลือกต้นทาง',bill.origin] : id === 'dest' ? ['เลือกปลายทาง',bill.dest] : undefined}/>)}
      <Field id="payType" label="ประเภทการชำระเงิน" value={bill.payType} options={[bill.payType]}/><Field id="pricingType" label="เกณฑ์คิดราคา" value={filled ? bill.pricingType : 'คิดตามน้ำหนัก'} options={['คิดตามน้ำหนัก','คิดตามหน่วย']}/><Field id="unitPrice" label="ราคาต่อหน่วย (บาท)" placeholder="0" value={filled ? String(bill.unitPrice) : ''}/>
    </div><div className={styles.auto} data-target="r1.auto"><span>ปริมาตรรวม <b data-volume>{filled ? bill.volume.toFixed(3) : '0.000'}</b> ลบ.ม.<small> (กว้าง × ยาว × สูง ÷ 1,000,000 × จำนวน)</small></span><span>ราคารวม <b data-total>{filled ? bill.total.toLocaleString('th-TH') : '0'}</b> บาท<small> (จำนวน × ราคาต่อหน่วย)</small></span><span data-focus className="focus-ring"/></div><div data-warning className={styles.warning}>⚠ ยังไม่ได้กรอกผู้ส่ง/ผู้รับ</div></div>
    <button className={styles.add} tabIndex={-1}>+ เพิ่มบิล</button><div className={styles.actions}><button className={`${styles.button} ${styles.ghost}`} tabIndex={-1}>🎲 สุ่มข้อมูล</button><button className={styles.button} data-target="r1.review" tabIndex={-1}>ตรวจสอบและบันทึก →</button></div>
  </div><div className={`${styles.card} ${styles.summary}`} data-target="r1.summary"><div className={styles.cardHeader}><span className={styles.step}>✓</span><h2>ตรวจสอบก่อนบันทึก</h2><small>1 บิล · ระบบจะออกเลขที่บิลให้เมื่อกดยืนยัน</small></div><table className={styles.table}><thead><tr>{['#','วันที่','สาขา','ผู้ส่ง → ผู้รับ','เส้นทาง','กลุ่มบริการ','จำนวน','น้ำหนัก (กก.)','ปริมาตร (ลบ.ม.)','การชำระ','ราคารวม'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><tr>{[1,bill.date,bill.branch,`${bill.sender} → ${bill.receiver}`,`${bill.origin}–${bill.dest}`,bill.serviceGroup,bill.qty,bill.weight,bill.volume.toFixed(3),bill.payType,bill.total.toLocaleString('th-TH')].map((x,i)=><td key={i}>{x}</td>)}</tr></tbody><tfoot><tr><td colSpan={6}>รวม</td><td>{bill.qty}</td><td>{bill.weight}</td><td>{bill.volume.toFixed(3)}</td><td/><td><b>{bill.total.toLocaleString('th-TH')}</b></td></tr></tfoot></table><div className={styles.actions}><button className={`${styles.button} ${styles.ghost}`} tabIndex={-1}>← กลับไปแก้</button><button className={styles.button} data-target="r1.save" tabIndex={-1}>ยืนยันบันทึก</button></div></div>
    <div className={styles.receipt} data-target="r1.receipt"><p>เลขที่บิลที่ระบบออกให้</p><NumberRoll value={bill.no}/><p>{bill.sender} → {bill.receiver}　·　{bill.total.toLocaleString('th-TH')} บาท</p></div><div className={styles.toast} data-target="r1.toast">✓ บันทึกแล้ว · สถานะ รอจัดรถ</div>
  </CustomerServiceShell>;
}
