import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './theme.module.css';

export function AppWindow({ children, name }: { children: ReactNode; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current!;
    const resize = () => { (node.firstElementChild as HTMLElement).style.transform = `scale(${node.clientWidth / 1440})`; };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.viewport} ${styles.theme}`} aria-label={name} data-window><div className={styles.fit}><div className={styles.camera} data-camera>{children}</div></div></div>;
}

export function CustomerServiceShell({ children }: { children: ReactNode }) {
  return <><aside className={styles.sidebar} aria-label="เมนูฝ่ายบริการลูกค้า"><div className={styles.nav} title="บันทึกบิล"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v16M4 12h16"/></svg></div></aside><div className={styles.content}><div className={styles.rolebar}><span>Customer Service <button tabIndex={-1}>เปลี่ยนหน้าที่</button></span></div><div className={styles.banner}>ข้อมูลตัวอย่าง — ไม่ใช่ยอดจริงของบริษัท</div><h1 className={styles.heading}>บันทึกบิล</h1>{children}</div></>;
}
