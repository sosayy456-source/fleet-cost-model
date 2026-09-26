import type gsap from 'gsap';
export function toast(tl: gsap.core.Timeline, element: HTMLElement, at: number) {
  tl.fromTo(element, { x: 50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .02, ease: 'power3.out' }, at);
}
