import type gsap from 'gsap';
function center(target: HTMLElement, camera: HTMLElement) {
  let x = target.offsetWidth / 2, y = target.offsetHeight / 2;
  let node: HTMLElement | null = target;
  while (node && node !== camera) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
  return { x, y };
}
export function camera(tl: gsap.core.Timeline, wrapper: HTMLElement, target: HTMLElement | null, scale: number, at: number, duration = .02) {
  tl.to(wrapper, { scale, x: () => {
    if (!target) return 0;
    const point = center(target, wrapper);
    // แถวกว้างกว่ากรอบให้เริ่มอ่านจากซ้าย ไม่ตัดตัวเลขตัวแรกออกนอกจอ
    const left = point.x - target.offsetWidth / 2;
    return target.offsetWidth * scale > 1440 ? 32 - left * scale : 720 - point.x * scale;
  }, y: () => target ? 450 - center(target, wrapper).y * scale : 0, duration, ease: 'power3.inOut' }, at);
}
