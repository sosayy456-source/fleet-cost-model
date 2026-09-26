import type gsap from 'gsap';
export function check(tl: gsap.core.Timeline, row: HTMLElement, at: number, checked = true) {
  // พื้นเน้นและเครื่องหมายแยกเลเยอร์ จึงเปลี่ยนเฉพาะ opacity
  tl.to(row.querySelectorAll('[data-check],[data-row-tint]'), { autoAlpha: checked ? 1 : 0, duration: .012 }, at);
  if (checked) tl.fromTo(row.querySelector('[data-check]'), { scale: .6 }, { scale: 1, duration: .014, ease: 'back.out(1.6)' }, at);
}
