import type gsap from 'gsap';
export function modal(tl: gsap.core.Timeline, element: HTMLElement, open: boolean, at: number, duration = .018) {
  if (open) tl.fromTo(element, { scale: .96, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration, ease: 'power3.out', immediateRender: false }, at);
  else tl.to(element, { scale: .96, autoAlpha: 0, duration }, at);
}
