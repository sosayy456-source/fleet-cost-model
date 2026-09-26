import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, lite } from './scroll';
import { registry, updatePosition } from './steps';
import styles from './Scene.module.css';

export type Build = (tl: gsap.core.Timeline, root: HTMLElement) => void;
export function Scene({ id, title, pinVh, steps, tone, build, children }: {
  id: string; title: string; pinVh: number; steps: readonly number[]; tone: string; build: Build; children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = ref.current!;
    const context = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tl.to({}, { duration: 1 });
      build(tl, root);
      const trigger = ScrollTrigger.create({
        trigger: root, animation: lite ? undefined : tl, pin: true, start: 'top top', end: `+=${pinVh}%`, scrub: lite ? false : 0.6, invalidateOnRefresh: true,
        snap: lite ? undefined : { snapTo: [...steps], duration: { min: 0.15, max: 0.4 }, delay: 0.35, inertia: false },
        onUpdate: self => {
          let nearest = 0;
          steps.forEach((p, index) => { if (Math.abs(p - self.progress) < Math.abs(steps[nearest] - self.progress)) nearest = index; });
          if (lite) tl.progress(steps[nearest]);
          if (self.isActive) updatePosition(id, nearest);
        },
        onToggle: self => { root.style.willChange = self.isActive ? 'transform' : 'auto'; },
      });
      registry.set(id, { id, title, steps, element: root, trigger });
      if (lite) tl.progress(steps[0]);
      // ช่วงส่งต่อฉากเก่าย่อและจาง ขณะที่เนื้อหาถัดไปเลื่อนเข้ามา
      if (!lite) gsap.to(root.querySelector('[data-stage]'), { scale: 0.96, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: root.parentElement, start: () => trigger.end, end: () => trigger.end + innerHeight * 0.65, scrub: true } });
    }, root);
    return () => { registry.delete(id); context.revert(); };
  }, [id, title, pinVh, steps, build]);
  return <section ref={ref} id={id} aria-label={title} className={`${styles.scene} ${styles[tone]} ${lite ? styles.lite : ''}`}><div data-stage className={styles.stage}>{children}</div></section>;
}
