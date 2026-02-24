import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

// SIMPLE format uses abbreviated field names
interface BithumbOrderbookUnit {
  ap: number  // ask_price
  as: number  // ask_size
  bp: number  // bid_price
  bs: number  // bid_size
}

interface BithumbOrderbookMessage {
  ty: string   // type
  cd: string   // code
  obu: BithumbOrderbookUnit[]  // orderbook_units
}

interface BithumbMarketItem {
  market: string
}

interface BithumbTickerItem {
  market: string
  trade_price: number
}

/**
 * Bithumb KRW tick size table (from official policy).
 * https://support.bithumb.com/hc/ko/articles/51036972377241
 */
function getKrwNativeTick(price: number): number {
  if (price >= 1_000_000) return 1000
  if (price >= 500_000) return 500
  if (price >= 100_000) return 100
  if (price >= 50_000) return 50
  if (price >= 10_000) return 10
  if (price >= 5_000) return 5
  if (price >= 1_000) return 1
  if (price >= 100) return 1
  if (price >= 1) return 0.01
  return 0.0001
}

// Cache native tick from fetchSupportedLevels so getSubscribeMessage can
// convert absolute level values to Bithumb's multiplier format.
// Bithumb WS `level` = multiplier of native tick (level=10 → 10× native tick).
let cachedNativeTick = 0

export const bithumbAdapter: OrderbookAdapter = {
  id: 'bithumb',
  name: 'Bithumb',
  supportedQuoteCurrencies: ['KRW', 'BTC'],

  getWebSocketUrl() {
    return 'wss://ws-api.bithumb.com/websocket/v1'
  },

  getSubscribeMessage(pair: NormalizedPair, level?: number) {
    const code = `${pair.quote}-${pair.base}`
    // Convert absolute level (e.g. 10000 KRW) to Bithumb multiplier (e.g. 10)
    const wsLevel = level != null && cachedNativeTick > 0
      ? Math.round(level / cachedNativeTick)
      : level ?? 1
    return [
      { ticket: 'crypto-orderbook' },
      { type: 'orderbook', codes: [code], level: wsLevel },
      { format: 'SIMPLE' },
    ]
  },

  getUnsubscribeMessage() {
    return null
  },

  async parseMessage(data: string | Blob): Promise<OrderbookUpdate | null> {
    let text: string
    if (data instanceof Blob) {
      text = await data.text()
    } else {
      text = data
    }

    try {
      const parsed = JSON.parse(text) as BithumbOrderbookMessage
      if (parsed.ty !== 'orderbook' || !parsed.obu) return null

      const bids: [string, string][] = parsed.obu.map(u => [
        u.bp.toString(),
        u.bs.toString(),
      ])
      const asks: [string, string][] = parsed.obu.map(u => [
        u.ap.toString(),
        u.as.toString(),
      ])

      return { type: 'snapshot', bids, asks }
    } catch {
      return null
    }
  },

  buildSymbol(base: string, quote: string) {
    return `${quote}-${base}`
  },

  async fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]> {
    const data = await fetchJson<BithumbMarketItem[]>(
      'https://api.bithumb.com/v1/market/all',
      signal,
    )
    return data
      .filter(m => m.market.startsWith(`${quote}-`))
      .map(m => m.market.split('-')[1])
  },

  async fetchSupportedLevels(pair: NormalizedPair, signal?: AbortSignal) {
    // Only KRW market has server-side grouping; BTC market tick is universally 0.00000001
    if (pair.quote !== 'KRW') return { nativeTick: 0, levels: [] }

    // Fetch current price to determine tick size bracket
    const market = `${pair.quote}-${pair.base}`
    const data = await fetchJson<BithumbTickerItem[]>(
      `https://api.bithumb.com/v1/ticker?markets=${market}`,
      signal,
    )
    const price = data[0]?.trade_price ?? 0
    if (price <= 0) return { nativeTick: 0, levels: [] }

    const nativeTick = getKrwNativeTick(price)
    cachedNativeTick = nativeTick
    // Bithumb WS supports level up to ~100× native tick
    const multipliers = [10, 100]
    const levels = multipliers.map(m => nativeTick * m)

    return { nativeTick, levels }
  },
}
