import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

interface BybitOrderbookMessage {
  topic: string
  type: 'snapshot' | 'delta'
  data: {
    s: string
    b: [string, string][]  // bids [price, qty]
    a: [string, string][]  // asks [price, qty]
  }
}

interface BybitTickersResponse {
  retCode: number
  result: {
    list: {
      symbol: string
      lastPrice: string
    }[]
  }
}

interface BybitInstrumentsResponse {
  retCode: number
  result: {
    list: {
      symbol: string
      priceFilter: { tickSize: string }
    }[]
  }
}

export const bybitAdapter: OrderbookAdapter = {
  id: 'bybit',
  name: 'Bybit',
  supportedQuoteCurrencies: ['USDT', 'USDC'],

  getWebSocketUrl() {
    return 'wss://stream.bybit.com/v5/public/spot'
  },

  getSubscribeMessage(pair: NormalizedPair) {
    const symbol = `${pair.base}${pair.quote}`
    return { op: 'subscribe', args: [`orderbook.200.${symbol}`] }
  },

  getUnsubscribeMessage(pair: NormalizedPair) {
    const symbol = `${pair.base}${pair.quote}`
    return { op: 'unsubscribe', args: [`orderbook.200.${symbol}`] }
  },

  async parseMessage(data: string | Blob): Promise<OrderbookUpdate | null> {
    let text: string
    if (data instanceof Blob) {
      text = await data.text()
    } else {
      text = data
    }

    try {
      const parsed = JSON.parse(text) as BybitOrderbookMessage
      if (!parsed.topic || !parsed.topic.startsWith('orderbook.')) return null
      if (!parsed.data) return null

      return {
        type: parsed.type === 'snapshot' ? 'snapshot' : 'delta',
        bids: parsed.data.b,
        asks: parsed.data.a,
      }
    } catch {
      return null
    }
  },

  buildSymbol(base: string, quote: string) {
    return `${base}${quote}`
  },

  heartbeat: {
    message: '{"op":"ping"}',
    interval: 20000,
  },

  async fetchNativeTick(pair: NormalizedPair, signal?: AbortSignal) {
    const symbol = `${pair.base}${pair.quote}`
    const [instruments, tickers] = await Promise.all([
      fetchJson<BybitInstrumentsResponse>(`https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${symbol}`, signal),
      fetchJson<BybitTickersResponse>(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`, signal),
    ])
    const inst = instruments.retCode === 0 ? instruments.result.list[0] : null
    const tick = tickers.retCode === 0 ? tickers.result.list[0] : null
    return {
      nativeTick: inst ? Number(inst.priceFilter.tickSize) : 0,
      price: tick ? Number(tick.lastPrice) : 0,
    }
  },

  async fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]> {
    const data = await fetchJson<BybitTickersResponse>(
      'https://api.bybit.com/v5/market/tickers?category=spot',
      signal,
    )
    if (data.retCode !== 0) return []
    return data.result.list
      .filter(t => t.symbol.endsWith(quote))
      .map(t => t.symbol.slice(0, -quote.length))
  },
}
