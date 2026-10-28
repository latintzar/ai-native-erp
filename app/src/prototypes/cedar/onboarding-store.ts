import * as React from 'react';
import { onboardingStorageKey, parseOnboarding, type OnboardingState } from './onboarding-model';

export const ONBOARDING_CHANGED='rocoto:cedar-onboarding-changed';

export function readOnboarding(fallback: OnboardingState): OnboardingState {
  try {
    const raw = localStorage.getItem(onboardingStorageKey(fallback.scope));
    return raw && raw.length < 20000 ? parseOnboarding(JSON.parse(raw), fallback) : fallback;
  } catch { return fallback; }
}
export function writeOnboarding(state: OnboardingState): boolean {
  try {
    localStorage.setItem(onboardingStorageKey(state.scope), JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(ONBOARDING_CHANGED,{detail:{scope:state.scope}}));
    return true;
  }
  catch { return false; }
}
export function useOnboarding(fallback: OnboardingState) {
  const [state, setState] = React.useState(() => readOnboarding(fallback));
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    setState(readOnboarding(fallback));
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === onboardingStorageKey(fallback.scope)) setState(readOnboarding(fallback));
    };
    const changedHere = (event: Event) => {
      if ((event as CustomEvent<{scope?:string}>).detail?.scope === fallback.scope) setState(readOnboarding(fallback));
    };
    window.addEventListener('storage', changed);
    window.addEventListener(ONBOARDING_CHANGED,changedHere);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener(ONBOARDING_CHANGED,changedHere); };
  }, [fallback.scope]);
  const save = (next: OnboardingState) => {
    if (!writeOnboarding(next)) { setError('Allow browser storage, then continue setup.'); return false; }
    setState(next); setError(''); return true;
  };
  return { state, save, error, setError };
}
