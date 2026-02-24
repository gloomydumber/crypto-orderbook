import type { OrderbookAdapter } from './types'
import { upbitAdapter } from './adapters/upbit'
import { bithumbAdapter } from './adapters/bithumb'
import { binanceAdapter } from './adapters/binance'
import { bybitAdapter } from './adapters/bybit'
import { okxAdapter } from './adapters/okx'
import { coinbaseAdapter } from './adapters/coinbase'

const ALL_ADAPTERS: OrderbookAdapter[] = [
  upbitAdapter,
  bithumbAdapter,
  binanceAdapter,
  bybitAdapter,
  okxAdapter,
  coinbaseAdapter,
]

const adapterMap = new Map<string, OrderbookAdapter>(
  ALL_ADAPTERS.map(a => [a.id, a])
)

export function getAdapterById(id: string): OrderbookAdapter | undefined {
  return adapterMap.get(id)
}

export function getAllAdapters(): OrderbookAdapter[] {
  return ALL_ADAPTERS
}
