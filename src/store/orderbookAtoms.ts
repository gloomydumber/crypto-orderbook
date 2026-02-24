import { atom } from 'jotai'
import type { OrderbookData, ConnectionStatus } from '../types'

export const orderbookAtom = atom<OrderbookData>({
  bids: [],
  asks: [],
  midPrice: null,
  spread: null,
  spreadPercent: null,
})

export const connectionStatusAtom = atom<ConnectionStatus>('disconnected')

export const availablePairsAtom = atom<string[]>([])

export const lastUpdateAtom = atom<number>(0)

export const tickOptionsAtom = atom<number[]>([])
