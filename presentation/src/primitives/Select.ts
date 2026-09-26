import type gsap from 'gsap';
export function select(tl: gsap.core.Timeline, field: HTMLElement, value: string, at: number, duration = .018) {
  const menu = field.querySelector('[data-dropdown]');
  const output = field.querySelector('[data-value]')!;
  const previous = output.textContent ?? '';
  tl.fromTo(menu, { scaleY: .8, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: duration * .25 }, at);
  tl.fromTo(menu?.lastElementChild ?? null, { opacity: .4 }, { opacity: 1, duration: duration * .3 }, at + duration * .25);
  const state = { progress: 0 };
  tl.fromTo(state, { progress: 0 }, { progress: 1, duration: duration * .1, onUpdate: () => { output.textContent = state.progress >= .5 ? value : previous; } }, at + duration * .7);
  tl.to(menu, { autoAlpha: 0, duration: duration * .2 }, at + duration * .8);
  tl.fromTo(output, { opacity: 0 }, { opacity: 1, duration: duration * .2, immediateRender: false }, at + duration * .8);
}
