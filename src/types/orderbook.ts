export interface OrderbookEntry {
  price: string
  qty: string
  total: string  // cumulative qty
}

export interface OrderbookData {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  midPrice: string | null
  spread: string | null
  spreadPercent: string | null
}

export interface OrderbookUpdate {
  type: 'snapshot' | 'delta'
  bids: [string, string][]   // [price, qty][]
  asks: [string, string][]   // [price, qty][]
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
