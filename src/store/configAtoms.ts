import { atomWithStorage } from 'jotai/utils'

export const exchangeIdAtom = atomWithStorage('cob-exchange', 'upbit')
export const quoteAtom = atomWithStorage('cob-quote', 'KRW')
export const baseAtom = atomWithStorage('cob-base', 'BTC')
export const tickSizeAtom = atomWithStorage('cob-tick', 0)
