import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

interface BinanceDepthDiff {
  e: string             // "depthUpdate"
  s: string             // symbol
  U: number             // first update ID
  u: number             // final update ID
  b: [string, string][] // bids
  a: [string, string][] // asks
}

interface BinanceDepthSnapshot {
  lastUpdateId: number
  bids: [string, string][]
  asks: [string, string][]
}

interface BinanceExchangeInfo {
  symbols: {
    symbol: string
    baseAsset: string
    quoteAsset: string
    status: string
    filters: { filterType: string; tickSize?: string }[]
  }[]
}

export const binanceAdapter: OrderbookAdapter = {
  id: 'binance',
  name: 'Binance',
  supportedQuoteCurrencies: ['USDT', 'USDC', 'BUSD', 'FDUSD', 'BTC'],

  getWebSocketUrl(pair: NormalizedPair) {
    const symbol = `${pair.base}${pair.quote}`.toLowerCase()
    // Diff depth stream — only sends changed levels per 100ms tick.
    // Lighter than @depth20 which sends all 40 entries every tick.
    return `wss://stream.binance.com:9443/ws/${symbol}@depth@100ms`
  },

  // No subscribe message needed — stream is in URL
  getSubscribeMessage() {
    return null
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
      const parsed = JSON.parse(text) as BinanceDepthDiff
      if (!parsed.b || !parsed.a) return null

      // Diff stream → delta (accumulates in local book)
      return {
        type: 'delta',
        bids: parsed.b,
        asks: parsed.a,
      }
    } catch {
      return null
    }
  },

  async fetchSnapshot(pair: NormalizedPair, signal?: AbortSignal): Promise<OrderbookUpdate | null> {
    const symbol = `${pair.base}${pair.quote}`.toUpperCase()
    const data = await fetchJson<BinanceDepthSnapshot>(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=1000`,
      signal,
    )
    return { type: 'snapshot', bids: data.bids, asks: data.asks }
  },

  buildSymbol(base: string, quote: string) {
    return `${base}${quote}`
  },

  async fetchNativeTick(pair: NormalizedPair, signal?: AbortSignal) {
    const symbol = `${pair.base}${pair.quote}`.toUpperCase()
    const [info, ticker] = await Promise.all([
      fetchJson<BinanceExchangeInfo>(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`, signal),
      fetchJson<{ price: string }>(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, signal),
    ])
    const sym = info.symbols[0]
    const pf = sym?.filters.find(f => f.filterType === 'PRICE_FILTER')
    return {
      nativeTick: pf?.tickSize ? Number(pf.tickSize) : 0,
      price: Number(ticker.price) || 0,
    }
  },

  async fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]> {
    const data = await fetchJson<BinanceExchangeInfo>(
      'https://api.binance.com/api/v3/exchangeInfo',
      signal,
    )
    return data.symbols
      .filter(s => s.quoteAsset === quote && s.status === 'TRADING')
      .map(s => s.baseAsset)
  },
}
