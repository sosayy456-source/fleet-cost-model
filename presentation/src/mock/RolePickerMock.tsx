import styles from './theme.module.css';

// ชื่อ ลำดับ และคำอธิบายตรงกับ ROLE_PICK / ROLES ของแอป ณ 25 ก.ย. 2569
export const roles = [
  ['cs', 'Customer Service', 'รับงาน ติดต่อลูกค้า และบันทึกบิล', '①'],
  ['dispatch', 'Fleet Coordinator', 'จัดรถ จัดคนขับ และติดตามเส้นทาง', '②'],
  ['driver', 'Driver', 'ดูงานที่กำลังวิ่ง และกดจบงานเมื่อส่งของเสร็จ', '③'],
  ['account', 'Accounting Department', 'ต้นทุน บิลน้ำมัน และใบแจ้งหนี้', '④'],
  ['manager', 'Manager', 'ภาพรวมทั้งหมด รายงาน และการอนุมัติ', ''],
  ['admin', 'Admin', 'เข้าถึงได้ทุกหน้า และกรอกแทนได้ทุกฝ่าย', '⑤'],
] as const;
export function RolePickerMock({ prefix, completed = false }: { prefix: string; completed?: boolean }) {
  return <div className={styles.picker}><div className={styles.pickerBox}><h1>Select your role</h1><p>เลือกตำแหน่งของคุณเพื่อเข้าสู่หน้าจอการทำงานที่ตรงกับหน้าที่</p><div className={styles.roles}>{roles.map(([id, title, desc, order], i) => <div key={id} className={styles.role} data-target={`${prefix}.${id}`}><small>{String(i + 1).padStart(2, '0')}</small><span><strong>{title}</strong><em>{desc}</em></span><span data-focus className={styles.selected}/><b data-order>{completed && id === 'cs' ? '✓' : order}</b></div>)}</div><div className={styles.pickerFoot}><div className={styles.continue} data-target={`${prefix}.continue`}><span data-continue>Continue</span>　→</div></div></div></div>;
}
