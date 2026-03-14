import { atomWithStorage } from 'jotai/utils'

// ── Key convention ────────────────────────────────────────────────
// All wts-frontend localStorage keys follow: wts:<widget>:<key>
// This enables the host app to read persisted selections directly
// without importing package internals.

// getOnInit: true makes atomWithStorage read localStorage synchronously
// on first use, preventing flash-mount (phantom WS from wrong defaults).
const SYNC = { getOnInit: true } as const

export const exchangeIdAtom = atomWithStorage('wts:orderbook:exchange', 'upbit', undefined, SYNC)
export const quoteAtom = atomWithStorage('wts:orderbook:quote', 'KRW', undefined, SYNC)
export const baseAtom = atomWithStorage('wts:orderbook:base', 'BTC', undefined, SYNC)
export const tickSizeAtom = atomWithStorage('wts:orderbook:tick', 0, undefined, SYNC)
