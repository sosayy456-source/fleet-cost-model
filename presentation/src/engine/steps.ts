import { getState, setState } from './store';
import { scrollTo, ScrollTrigger } from './scroll';

export interface StepScene { id: string; title: string; steps: readonly number[]; element: HTMLElement; trigger?: ScrollTrigger }
export const registry = new Map<string, StepScene>();
let restoring = true;
let viewportWidth = globalThis.innerWidth;
let viewportHeight = globalThis.innerHeight;
let requested = -1;
let release: ReturnType<typeof setTimeout>;
export function allSteps() {
  return [...registry.values()].flatMap(scene => scene.steps.map((p, index) => ({
    scene: scene.id, step: index, title: scene.title,
    y: scene.trigger ? scene.trigger.start + (scene.trigger.end - scene.trigger.start) * p : scene.element.getBoundingClientRect().top + window.scrollY,
  })));
}
export function updatePosition(scene: string, step: number) {
  if (globalThis.innerWidth !== viewportWidth || globalThis.innerHeight !== viewportHeight) return;
  setState({ scene, step });
  const hash = `#${scene}-${step + 1}`;
  if (!restoring && location.hash !== hash) history.replaceState(null, '', hash);
}
export function goTo(index: number, immediate = false) {
  const list = allSteps();
  const bounded = Math.max(0, Math.min(index, list.length - 1));
  const target = list[bounded];
  if (!target) return;
  requested = bounded;
  clearTimeout(release);
  release = setTimeout(() => { requested = -1; }, 1300);
  scrollTo(target.y, immediate);
  updatePosition(target.scene, target.step);
}
export function moveStep(direction: number) {
  const list = allSteps();
  const current = requested >= 0 ? requested : list.findIndex(s => s.scene === getState().scene && s.step === getState().step);
  goTo(current + direction);
}
export function startSteps() {
  restoring = true;
  const initialHash = location.hash;
  const restore = (hash: string) => {
    const index = allSteps().findIndex(s => `#${s.scene}-${s.step + 1}` === hash);
    if (index >= 0) goTo(index, true);
  };
  const ready = () => { if (cancelled) return; ScrollTrigger.refresh(); viewportWidth = globalThis.innerWidth; viewportHeight = globalThis.innerHeight; restoring = false; setState({ ready: true }); if (initialHash) restore(initialHash); else goTo(0, true); };
  let cancelled = false;
  document.fonts.ready.then(() => { if (!cancelled) requestAnimationFrame(ready); });
  const hashChange = () => restore(location.hash);
  // รักษาจังหวะเดิมเมื่อเข้าเต็มจอหรือขนาดหน้าต่างเปลี่ยน
  let refreshHash: string | null = null;
  const beforeRefresh = () => { if (!restoring) { refreshHash = location.hash; restoring = true; } };
  const afterRefresh = () => { viewportWidth = globalThis.innerWidth; viewportHeight = globalThis.innerHeight; if (refreshHash !== null) { const hash = refreshHash; refreshHash = null; restoring = false; restore(hash); } };
  ScrollTrigger.addEventListener('refreshInit', beforeRefresh);
  ScrollTrigger.addEventListener('refresh', afterRefresh);
  const keyboard = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
    if (event.key === ' ' && event.target instanceof HTMLElement && event.target.closest('button,a')) return;
    const key = event.key.toLowerCase();
    if (['arrowright', 'arrowdown', ' ', 'pagedown'].includes(key)) { event.preventDefault(); moveStep(1); }
    else if (['arrowleft', 'arrowup', 'pageup'].includes(key)) { event.preventDefault(); moveStep(-1); }
    else if (key === 'home' || key === 'end') { event.preventDefault(); goTo(key === 'home' ? 0 : allSteps().length - 1); }
    else if (/^[1-9]$/.test(key)) { const scene = [...registry.keys()][Number(key) - 1]; if (scene) goTo(allSteps().findIndex(s => s.scene === scene)); }
    else if (key === 'p') setState({ presenter: !getState().presenter });
    else if (key === 'f') toggleFullscreen();
  };
  window.addEventListener('keydown', keyboard);
  window.addEventListener('hashchange', hashChange);
  return () => { cancelled = true; clearTimeout(release); ScrollTrigger.removeEventListener('refreshInit', beforeRefresh); ScrollTrigger.removeEventListener('refresh', afterRefresh); window.removeEventListener('keydown', keyboard); window.removeEventListener('hashchange', hashChange); };
}
export async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { setState({ presenter: true }); }
}
