import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

interface OkxOrderbookMessage {
  arg?: { channel: string; instId: string }
  action?: 'snapshot' | 'update'
  data?: {
    bids: [string, string, string, string][]  // [price, size, liquidatedOrders, numOrders]
    asks: [string, string, string, string][]
  }[]
}

interface OkxTickersResponse {
  code: string
  data: {
    instId: string
  }[]
}

interface OkxInstrumentsResponse {
  code: string
  data: {
    instId: string
    tickSz: string
  }[]
}

export const okxAdapter: OrderbookAdapter = {
  id: 'okx',
  name: 'OKX',
  supportedQuoteCurrencies: ['USDT', 'USDC'],

  getWebSocketUrl() {
    return 'wss://ws.okx.com:8443/ws/v5/public'
  },

  getSubscribeMessage(pair: NormalizedPair) {
    return {
      op: 'subscribe',
      args: [{ channel: 'books', instId: `${pair.base}-${pair.quote}` }],
    }
  },

  getUnsubscribeMessage(pair: NormalizedPair) {
    return {
      op: 'unsubscribe',
      args: [{ channel: 'books', instId: `${pair.base}-${pair.quote}` }],
    }
  },

  async parseMessage(data: string | Blob): Promise<OrderbookUpdate | null> {
    let text: string
    if (data instanceof Blob) {
      text = await data.text()
    } else {
      text = data
    }

    // OKX sends "pong" as response to "ping"
    if (text === 'pong') return null

    try {
      const parsed = JSON.parse(text) as OkxOrderbookMessage
      if (!parsed.arg || parsed.arg.channel !== 'books') return null
      if (!parsed.data || !parsed.data[0]) return null

      const bookData = parsed.data[0]
      const bids: [string, string][] = bookData.bids.map(b => [b[0], b[1]])
      const asks: [string, string][] = bookData.asks.map(a => [a[0], a[1]])

      return {
        type: parsed.action === 'snapshot' ? 'snapshot' : 'delta',
        bids,
        asks,
      }
    } catch {
      return null
    }
  },

  buildSymbol(base: string, quote: string) {
    return `${base}-${quote}`
  },

  heartbeat: {
    message: 'ping',
    interval: 25000,
  },

  async fetchNativeTick(pair: NormalizedPair, signal?: AbortSignal) {
    const instId = `${pair.base}-${pair.quote}`
    const [instruments, ticker] = await Promise.all([
      fetchJson<OkxInstrumentsResponse>(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${instId}`, signal),
      fetchJson<{ code: string; data: { last: string }[] }>(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`, signal),
    ])
    const inst = instruments.code === '0' ? instruments.data[0] : null
    const tick = ticker.code === '0' ? ticker.data[0] : null
    return {
      nativeTick: inst ? Number(inst.tickSz) : 0,
      price: tick ? Number(tick.last) : 0,
    }
  },

  async fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]> {
    const data = await fetchJson<OkxTickersResponse>(
      'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
      signal,
    )
    if (data.code !== '0') return []
    return data.data
      .filter(t => t.instId.endsWith(`-${quote}`))
      .map(t => t.instId.split('-')[0])
  },
}
