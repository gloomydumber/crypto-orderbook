export interface NormalizedPair {
  base: string   // 'BTC'
  quote: string  // 'KRW', 'USDT', 'USD'
}

export interface ExchangeInfo {
  id: string
  name: string
  quoteCurrencies: string[]
}

export const EXCHANGES: ExchangeInfo[] = [
  { id: 'upbit', name: 'Upbit', quoteCurrencies: ['KRW', 'BTC'] },
  { id: 'bithumb', name: 'Bithumb', quoteCurrencies: ['KRW', 'BTC'] },
  { id: 'binance', name: 'Binance', quoteCurrencies: ['USDT', 'USDC', 'BUSD', 'FDUSD', 'BTC'] },
  { id: 'bybit', name: 'Bybit', quoteCurrencies: ['USDT', 'USDC'] },
  { id: 'okx', name: 'OKX', quoteCurrencies: ['USDT', 'USDC'] },
  { id: 'coinbase', name: 'Coinbase', quoteCurrencies: ['USD'] },
]

