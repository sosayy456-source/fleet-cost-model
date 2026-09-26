import type gsap from 'gsap';
import styles from './CountUp.module.css';
export const formatNumber = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(value);
export function CountUp({ to, className = '' }: { to: number; className?: string }) {
  return <span className={`${styles.number} ${className}`} style={{ minWidth: `${formatNumber(to).length * .6}em` }} aria-label={formatNumber(to)}><span aria-hidden="true" data-count={to}>{formatNumber(to)}</span></span>;
}
export function animateCount(tl: gsap.core.Timeline, element: HTMLElement | null, at: number, duration: number) {
  if (!element) return;
  const target = Number(element.dataset.count);
  const counter = { value: 0 };
  tl.fromTo(counter, { value: 0 }, { value: target, duration, ease: 'none', onUpdate: () => { element.textContent = formatNumber(Math.round(counter.value * 10) / 10); } }, at);
}
