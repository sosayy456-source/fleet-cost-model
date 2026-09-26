import { useEffect, useState } from 'react';
import { allSteps } from '../../engine/steps';
import { usePresentation, setState } from '../../engine/store';
import styles from './PresenterPanel.module.css';
export function PresenterPanel({ notes }: { notes: Record<string, string> }) {
  const state = usePresentation();
  const [started] = useState(Date.now);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { if (!state.presenter) return; const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000); return () => clearInterval(timer); }, [started, state.presenter]);
  if (!state.presenter) return null;
  const steps = allSteps();
  const index = steps.findIndex(s => s.scene === state.scene && s.step === state.step);
  const next = steps[index + 1];
  return <aside className={styles.panel} aria-label="โน้ตผู้นำเสนอ"><header><span>{state.scene.toUpperCase()} · จังหวะ {state.step + 1}</span><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span><button aria-label="ปิดโน้ต" onClick={() => setState({ presenter: false })}>×</button></header><p>{notes[state.scene.toUpperCase()]}</p><footer>ถัดไป: {next ? `${next.title} · จังหวะ ${next.step + 1}` : 'จบต้นแบบ'}<br/>← → เปลี่ยนจังหวะ · P ซ่อนโน้ต · F เต็มจอ</footer></aside>;
}
