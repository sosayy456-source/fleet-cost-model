import { allSteps, goTo, moveStep, registry, toggleFullscreen } from '../../engine/steps';
import { usePresentation, setState } from '../../engine/store';
import { lite } from '../../engine/scroll';
import styles from './ProgressRail.module.css';
export function ProgressRail({ sample }: { sample: boolean }) {
  const state = usePresentation();
  const list = allSteps();
  const index = Math.max(0, list.findIndex(s => s.scene === state.scene && s.step === state.step));
  const scenes = [...registry.values()];
  return <>
    <div className={styles.top}><a href="#r0-1" className={styles.brand}>โมเดลต้นทุนการเดินรถ</a><div className={styles.badges}>{lite && <span>โหมดภาพนิ่ง</span>}{sample && <span className={styles.sample}>ข้อมูลสมมติ · เดินชมการทำงาน</span>}</div></div>
    <nav className={styles.dock} aria-label="ควบคุมการนำเสนอ">
      <div className={styles.scenes}>{scenes.map((scene, i) => <button key={scene.id} aria-current={state.scene === scene.id ? 'step' : undefined} onClick={() => goTo(list.findIndex(s => s.scene === scene.id))}><span>{String(i + 1).padStart(2, '0')}</span>{scene.title}</button>)}</div>
      <div className={styles.controls}><span className={styles.position}>{index + 1} / {list.length || '—'}</span><button aria-label="จังหวะก่อนหน้า" disabled={index === 0} onClick={() => moveStep(-1)}>←</button><button aria-label="จังหวะถัดไป" disabled={index === list.length - 1} onClick={() => moveStep(1)}>→</button><button title="โน้ตผู้นำเสนอ (P)" aria-label="เปิดหรือปิดโน้ตผู้นำเสนอ" aria-pressed={state.presenter} onClick={() => setState({ presenter: !state.presenter })}>P</button><button title="เต็มจอ (F)" aria-label="เต็มจอ" onClick={toggleFullscreen}>⛶</button></div>
      <div className={styles.track}><div style={{ transform: `scaleX(${list.length > 1 ? index / (list.length - 1) : 0})` }}/></div>
    </nav>
  </>;
}
