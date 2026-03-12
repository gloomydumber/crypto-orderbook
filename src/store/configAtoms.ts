import { atomWithStorage } from 'jotai/utils'

// Sync hydration: read persisted value at module init to avoid flash-mount.
// Without this, atomWithStorage returns defaults on the first render frame
// (before async hydration), causing a phantom connection to the default
// exchange before the user's saved selection loads.
function hydrate<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored != null) return JSON.parse(stored) as T
  } catch { /* corrupted localStorage — use default */ }
  return fallback
}

export const exchangeIdAtom = atomWithStorage('cob-exchange', hydrate('cob-exchange', 'upbit'))
export const quoteAtom = atomWithStorage('cob-quote', hydrate('cob-quote', 'KRW'))
export const baseAtom = atomWithStorage('cob-base', hydrate('cob-base', 'BTC'))
export const tickSizeAtom = atomWithStorage('cob-tick', hydrate('cob-tick', 0))
