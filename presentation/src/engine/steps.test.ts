import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const motion = vi.hoisted(() => ({ lite: false, scrollTo: vi.fn(), refresh: vi.fn() }));
vi.mock('./scroll', () => ({ get lite() { return motion.lite; }, scrollTo: motion.scrollTo, ScrollTrigger: { refresh: motion.refresh, addEventListener: vi.fn(), removeEventListener: vi.fn() } }));
import { allSteps, goTo, moveStep, registry, startSteps } from './steps';
import { getState, setState } from './store';

describe('ตำแหน่งพรีเซนเตอร์และการกลับจาก hash', () => {
  let cleanup: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    motion.lite = false;
    motion.scrollTo.mockClear();
    vi.stubGlobal('location', { hash: '#s05-3' });
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve() } });
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback());
    vi.stubGlobal('window', { scrollY: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    registry.clear();
    setState({ scene: 's00', step: 0, ready: false });
    const element = { getBoundingClientRect: () => ({ top: 4000 }) } as HTMLElement;
    registry.set('s00', { id: 's00', title: 'ปก', steps: [0, .95], element, trigger: { start: 0, end: 1000 } as never });
    registry.set('s05', { id: 's05', title: 'ต้นทุน', steps: [.18, .36, .54, .72, .95], element, trigger: { start: 2000, end: 5000 } as never });
  });
  afterEach(() => { cleanup?.(); cleanup = undefined; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('แปลง p เป็นระยะจริงและกดข้ามฉากได้', () => {
    expect(allSteps()[4].y).toBe(3620);
    goTo(1);
    moveStep(1);
    expect(motion.scrollTo).toHaveBeenLastCalledWith(2540, false);
    expect(getState().scene).toBe('s05');
  });
  it('กดเร็วหลายครั้งไม่ข้ามย้อน และหยุดที่ขอบ', () => {
    goTo(2);
    moveStep(1);
    moveStep(1);
    expect(motion.scrollTo).toHaveBeenLastCalledWith(3620, false);
    goTo(999);
    expect(motion.scrollTo).toHaveBeenLastCalledWith(4850, false);
    goTo(-1);
    expect(motion.scrollTo).toHaveBeenLastCalledWith(0, false);
  });
  it('รอฟอนต์และ refresh ก่อนคืนจังหวะจาก hash', async () => {
    cleanup = startSteps();
    await Promise.resolve();
    expect(motion.refresh).toHaveBeenCalled();
    expect(motion.scrollTo).toHaveBeenLastCalledWith(3620, true);
    expect(getState()).toMatchObject({ scene: 's05', step: 2, ready: true });
  });
  it('โหมด lite คงทุกจังหวะและคืน hash ตรงขั้นเดิม', async () => {
    motion.lite = true;
    expect(allSteps()).toHaveLength(7);
    cleanup = startSteps();
    await Promise.resolve();
    expect(getState()).toMatchObject({ scene: 's05', step: 2 });
    expect(motion.scrollTo).toHaveBeenLastCalledWith(3620, true);
  });
});
