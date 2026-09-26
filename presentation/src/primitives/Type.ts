import type gsap from 'gsap';
export function type(tl: gsap.core.Timeline, element: HTMLElement, text: string, at: number, duration: number, formatted = text) {
  const state = { progress: 0 };
  tl.fromTo(state, { progress: 0 }, { progress: 1, duration, ease: 'none', onUpdate: () => {
    element.textContent = state.progress >= 1 ? formatted : text.slice(0, Math.round(state.progress * text.length));
    element.classList.toggle('typing', state.progress > 0 && state.progress < 1);
  } }, at);
}
