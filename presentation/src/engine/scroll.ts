import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };
export const lite = new URLSearchParams(location.search).has('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;
let lenis: Lenis | undefined;
export function startScroll() {
  if (lite) return () => {};
  lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  return () => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = undefined; };
}
export function scrollTo(y: number, immediate = false) {
  if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate, duration: 1.1, easing: t => 1 - Math.pow(1 - t, 3) }); }
  else window.scrollTo({ top: y, behavior: 'instant' });
}
