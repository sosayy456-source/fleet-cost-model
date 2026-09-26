import styles from './Narration.module.css';
export const narration = [
  ['รับงานจากลูกค้า แล้วบันทึกเป็นบิล', 'ยังไม่ต้องเลือกรถ ระบบออกเลขที่บิลให้ตอนบันทึก'],
  ['กรอกเท่าที่ลูกค้าบอก', 'ส่วนที่คำนวณได้ ระบบคิดให้ ทั้งปริมาตรและราคารวม'],
  ['หนึ่งบิล พร้อมส่งต่อ', 'กรอกงานร้านตัวอย่าง ก จากเชียงใหม่ไปตลาดไท'],
  ['บิลขึ้นระบบกลาง ฝ่ายจัดรถเห็นทันที', 'ตรวจสอบก่อนยืนยัน แล้วส่งบิลไปสถานะ “รอจัดรถ”'],
  ['จากรับงาน สู่การจัดรถ', 'ฝ่ายบริการลูกค้าทำครบแล้ว ฝ่ายจัดรถจะรวมบิลที่ไปด้วยกัน'],
];
export function Narration() {
  return <aside className={styles.panel} aria-label="คำอธิบายขั้นตอน">{narration.map(([title,body], i) => <div className={styles.beat} data-narration={i} key={title}><span className={styles.role}>01　ฝ่ายบริการลูกค้า</span><p className={styles.position}>ขั้น {i + 1} / 5</p><h2>{title}</h2><p className={styles.body}>{body}</p>{i >= 3 && <DocumentTrail/>}</div>)}</aside>;
}
export function DocumentTrail() { return <div className={styles.trail}><span>บิล ✓</span><i>→</i><strong>รอจัดรถ ●</strong></div>; }
