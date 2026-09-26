import { useSyncExternalStore } from 'react';

type State = { scene: string; step: number; presenter: boolean; ready: boolean };
let state: State = { scene: 'r0', step: 0, presenter: false, ready: false };
const listeners = new Set<() => void>();
export const getState = () => state;
export function setState(patch: Partial<State>) {
  if (Object.entries(patch).every(([key, value]) => state[key as keyof State] === value)) return;
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}
export function usePresentation() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getState, getState);
}
