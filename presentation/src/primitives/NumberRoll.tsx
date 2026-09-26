import type gsap from 'gsap';
export function NumberRoll({ value }: { value: string }) {
  return <div className="number-roll" aria-label={value}>{value.split('').map((digit,i) => <span className="number-slot" key={i} aria-hidden="true"><span data-digit={digit}>{Array.from({ length: 10 }, (_,n) => <span key={n}>{n}</span>)}</span></span>)}</div>;
}
export function numberRoll(tl: gsap.core.Timeline, root: HTMLElement, at: number) {
  tl.fromTo(root.querySelectorAll('[data-digit]'), { yPercent: 0 }, { yPercent: (_,el) => -Number((el as HTMLElement).dataset.digit) * 10, stagger: .0015, duration: .035, ease: 'power3.out' }, at);
}
