import type gsap from 'gsap';
export function autoCalc(tl: gsap.core.Timeline, element: HTMLElement, from: number, to: number, at: number, duration: number, decimals = 0) {
  const state = { value: from };
  element.style.display = 'inline-block';
  element.style.minWidth = `${to.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).length * .6}em`;
  tl.fromTo(state, { value: from }, { value: to, duration, ease: 'none', onUpdate: () => {
    element.textContent = state.value.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } }, at);
  const underline = document.createElement('i'); underline.className = 'calc-line';
  // เส้นอยู่ข้างผลลัพธ์เพื่อไม่ถูก textContent ลบออกระหว่างนับ
  element.after(underline);
  tl.fromTo(underline, { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: duration / 2 }, at)
    .to(underline, { opacity: 0, duration: duration / 2 }, at + duration / 2);
}
