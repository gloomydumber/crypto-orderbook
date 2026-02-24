import type { OrderbookAdapter } from '../types'
import type { NormalizedPair, OrderbookUpdate } from '../../types'
import { fetchJson } from '../fetch-utils'

// Coinbase Advanced Trade WebSocket message structure
interface CoinbaseL2Message {
  channel: string
  events: {
    type: 'snapshot' | 'update'
    product_id: string
    updates: {
      side: 'bid' | 'offer'
      price_level: string
      new_quantity: string
    }[]
  }[]
}

interface CoinbaseProduct {
  id: string
  base_currency: string
  quote_currency: string
  quote_increment: string
  status: string
}

export const coinbaseAdapter: OrderbookAdapter = {
  id: 'coinbase',
  name: 'Coinbase',
  supportedQuoteCurrencies: ['USD'],

  getWebSocketUrl() {
    return 'wss://advanced-trade-ws.coinbase.com'
  },

  getSubscribeMessage(pair: NormalizedPair) {
    return {
      type: 'subscribe',
      product_ids: [`${pair.base}-${pair.quote}`],
      channel: 'level2',
    }
  },

  getUnsubscribeMessage(pair: NormalizedPair) {
    return {
      type: 'unsubscribe',
      product_ids: [`${pair.base}-${pair.quote}`],
      channel: 'level2',
    }
  },

  async parseMessage(data: string | Blob): Promise<OrderbookUpdate | null> {
    let text: string
    if (data instanceof Blob) {
      text = await data.text()
    } else {
      text = data
    }

    try {
      const parsed = JSON.parse(text) as CoinbaseL2Message
      // Coinbase Advanced Trade sends on channel "l2_data"
      if (parsed.channel !== 'l2_data') return null
      if (!parsed.events || !parsed.events[0]) return null

      const event = parsed.events[0]
      if (!event.updates) return null

      const bids: [string, string][] = []
      const asks: [string, string][] = []

      for (const u of event.updates) {
        if (u.side === 'bid') {
          bids.push([u.price_level, u.new_quantity])
        } else {
          asks.push([u.price_level, u.new_quantity])
        }
      }

      return {
        type: event.type === 'snapshot' ? 'snapshot' : 'delta',
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

  async fetchNativeTick(pair: NormalizedPair, signal?: AbortSignal) {
    const productId = `${pair.base}-${pair.quote}`
    const [product, ticker] = await Promise.all([
      fetchJson<CoinbaseProduct>(`https://api.exchange.coinbase.com/products/${productId}`, signal),
      fetchJson<{ price: string }>(`https://api.exchange.coinbase.com/products/${productId}/ticker`, signal),
    ])
    return {
      nativeTick: product.quote_increment ? Number(product.quote_increment) : 0,
      price: Number(ticker.price) || 0,
    }
  },

  async fetchAvailablePairs(quote: string, signal?: AbortSignal): Promise<string[]> {
    const data = await fetchJson<CoinbaseProduct[]>(
      'https://api.exchange.coinbase.com/products',
      signal,
    )
    return data
      .filter(p => p.quote_currency === quote && p.status !== 'delisted')
      .map(p => p.base_currency)
  },
}
