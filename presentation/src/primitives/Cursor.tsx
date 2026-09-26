import { gsap, lite } from '../engine/scroll';
export function Cursor() {
  return lite ? null : <div id="demo-cursor" aria-hidden="true"><span data-ripple/><svg width="29" height="35" viewBox="0 0 29 35"><path d="M2 2v27l7-7 6 11 5-3-6-10h11Z" fill="#6E1837" stroke="white" strokeWidth="2"/></svg></div>;
}
export function move(tl: gsap.core.Timeline, target: HTMLElement, at: number, duration = .012) {
  const cursor = document.getElementById('demo-cursor');
  if (!cursor) return;
  // ค่าพิกัดอ่านหลัง fit/camera ทุกเฟรม จึงตามเป้าที่กำลังซูมและเปลี่ยนขนาดหน้าต่างได้
  const state = { progress: 0, x: 0, y: 0 };
  tl.fromTo(state, { progress: 0, x: () => Number(gsap.getProperty(cursor, 'x')), y: () => Number(gsap.getProperty(cursor, 'y')) }, {
    progress: 1, duration, ease: 'power3.inOut', immediateRender: false,
    onUpdate: () => { const rect = target.getBoundingClientRect(); gsap.set(cursor, { x: state.x + (rect.left + rect.width * .55 - state.x) * state.progress, y: state.y + (rect.top + rect.height * .6 - state.y) * state.progress }); },
  }, at);
  tl.set(cursor, { autoAlpha: 1 }, at);
}
export function click(tl: gsap.core.Timeline, target: HTMLElement, at: number) {
  const ripple = document.querySelector('#demo-cursor [data-ripple]');
  if (ripple) tl.fromTo(ripple, { scale: .2, opacity: .7 }, { scale: 2.4, opacity: 0, duration: .009 }, at);
  tl.to(target, { scale: .98, duration: .004 }, at).to(target, { scale: 1, duration: .004 }, at + .004);
}
