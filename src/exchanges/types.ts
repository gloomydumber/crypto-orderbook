import type { NormalizedPair, OrderbookUpdate } from '../types'

export interface OrderbookAdapter {
  id: string
  name: string
  supportedQuoteCurrencies: string[]

  getWebSocketUrl(pair: NormalizedPair): string
  getSubscribeMessage?(pair: NormalizedPair, level?: number): string | object | null
  getUnsubscribeMessage?(pair: NormalizedPair, level?: number): string | object | null
  parseMessage(data: string | Blob): Promise<OrderbookUpdate | null>
  buildSymbol(base: string, quote: string): string
  heartbeat?: { message: string | (() => string); interval: number }

  /** Optional REST snapshot for deep orderbook initialization (e.g. Binance limit=1000). */
  fetchSnapshot?(pair: NormalizedPair, signal?: AbortSignal): Promise<OrderbookUpdate | null>
  fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]>

  /** Native tick size + current price from exchange REST API. Used to pre-compute tick options before WS data arrives. */
  fetchNativeTick?(pair: NormalizedPair, signal?: AbortSignal): Promise<{ nativeTick: number; price: number }>

  /** Server-side orderbook aggregation (Upbit/Bithumb KRW market). */
  fetchSupportedLevels?(pair: NormalizedPair, signal?: AbortSignal): Promise<{ nativeTick: number; levels: number[] }>
}
