import type gsap from 'gsap';
export function spotlight(tl: gsap.core.Timeline, targets: HTMLElement[], others: HTMLElement[], at: number, duration: number) {
  const rings = targets.flatMap(target => [...target.querySelectorAll('[data-focus]')]);
  tl.to(others, { opacity: .35, duration: .006 }, at);
  tl.to(rings, { autoAlpha: 1, duration: .006 }, at);
  tl.to(others, { opacity: 1, duration: .006 }, at + duration);
  tl.to(rings, { autoAlpha: 0, duration: .006 }, at + duration);
}
