import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

// SIMPLE format uses abbreviated field names
interface UpbitOrderbookUnit {
  ap: number  // ask_price
  as: number  // ask_size
  bp: number  // bid_price
  bs: number  // bid_size
}

interface UpbitOrderbookMessage {
  ty: string   // type
  cd: string   // code
  obu: UpbitOrderbookUnit[]  // orderbook_units
}

interface UpbitMarketItem {
  market: string
  korean_name: string
  english_name: string
}

interface UpbitInstrumentItem {
  market: string
  quote_currency: string
  tick_size: string
  supported_levels: string[]
}

export const upbitAdapter: OrderbookAdapter = {
  id: 'upbit',
  name: 'Upbit',
  supportedQuoteCurrencies: ['KRW', 'BTC'],

  getWebSocketUrl() {
    return 'wss://api.upbit.com/websocket/v1'
  },

  getSubscribeMessage(pair: NormalizedPair, level?: number) {
    const code = `${pair.quote}-${pair.base}.30`
    return [
      { ticket: 'crypto-orderbook' },
      { type: 'orderbook', codes: [code], level: level ?? 0 },
      { format: 'SIMPLE' },
    ]
  },

  getUnsubscribeMessage() {
    return null // Upbit doesn't support unsubscribe; close and reconnect
  },

  async parseMessage(data: string | Blob): Promise<OrderbookUpdate | null> {
    let text: string
    if (data instanceof Blob) {
      text = await data.text()
    } else {
      text = data
    }

    try {
      const parsed = JSON.parse(text) as UpbitOrderbookMessage
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
    const data = await fetchJson<UpbitMarketItem[]>(
      'https://api.upbit.com/v1/market/all',
      signal,
    )
    return data
      .filter(m => m.market.startsWith(`${quote}-`))
      .map(m => m.market.split('-')[1])
  },

  async fetchSupportedLevels(pair: NormalizedPair, signal?: AbortSignal) {
    const market = `${pair.quote}-${pair.base}`
    const data = await fetchJson<UpbitInstrumentItem[]>(
      `https://api.upbit.com/v1/orderbook/instruments?markets=${market}`,
      signal,
    )
    const item = data[0]
    if (!item) return { nativeTick: 0, levels: [] }
    return {
      nativeTick: Number(item.tick_size),
      levels: item.supported_levels.map(Number).filter(n => n > 0),
    }
  },
}
