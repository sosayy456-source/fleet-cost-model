import { Scene, type Build } from '../engine/Scene';
import { AppWindow } from '../mock/AppWindow';
import { RolePickerMock } from '../mock/RolePickerMock';
import { spotlight } from '../primitives';
import styles from './Walkthrough.module.css';
const steps = [.15, 1] as const;
// เป้าหมาย: ขั้น 1 = การ์ดทั้งหมด; ขั้น 2 = cs → dispatch → driver → account → admin
const build: Build = (tl, root) => {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-target^="r0."]')].filter(x => !x.dataset.target?.endsWith('continue'));
  tl.from(cards, { y: 16, opacity: 0, duration: .055, stagger: .013 }, 0);
  ['cs','dispatch','driver','account','admin'].forEach((id,i) => {
    const target = root.querySelector<HTMLElement>(`[data-target="r0.${id}"]`)!;
    spotlight(tl, [target], cards.filter(x => x !== target), .2 + i * .145, .105);
    tl.to(target.querySelector('[data-order]'), { autoAlpha: 1, duration: .025 }, .23 + i * .145);
  });
};
export function R0Home() {
  return <Scene id="r0" title="เลือกหน้าที่" steps={steps} pinVh={240} tone="home" build={build}><div className={styles.home}><AppWindow name="หน้าจำลองเลือกหน้าที่"><RolePickerMock prefix="r0"/></AppWindow><p className={styles.caption}>ทุกคนเข้าโมเดลเดียวกัน — เห็นเมนูตามหน้าที่ของตัวเอง</p></div></Scene>;
}
