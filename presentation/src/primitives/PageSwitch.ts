import type gsap from 'gsap';
export function pageSwitch(tl: gsap.core.Timeline, outgoing: HTMLElement, incoming: HTMLElement, at: number, duration = .025, nav?: HTMLElement) {
  tl.to(outgoing, { autoAlpha: 0, duration }, at);
  tl.fromTo(incoming, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration, immediateRender: false }, at);
  if (nav) tl.to(nav, { autoAlpha: 1, duration }, at);
}
