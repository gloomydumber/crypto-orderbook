/**
 * Format a price string with appropriate decimal places.
 * Korean exchanges (KRW) typically show 0 decimals for high-value coins.
 * USDT/USD exchanges show 2-8 decimals depending on price magnitude.
 */
export function formatPrice(price: string, quote: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return price

  // KRW decimal places match Upbit native tick precision:
  // >= 100: integer (tick 1+), >= 10: 1 dp (tick 0.1), >= 1: 2 dp (tick 0.01), < 1: 3 dp (tick 0.001)
  if (quote === 'KRW') {
    if (num >= 100) return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (num >= 10) return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    if (num >= 1) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return num.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  }

  // USD/USDT/USDC/BTC
  if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (num >= 1) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  if (num >= 0.01) return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
  return num.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 })
}

/**
 * Format quantity without scientific notation.
 */
export function formatQty(qty: string): string {
  const num = parseFloat(qty)
  if (isNaN(num)) return qty
  if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (num >= 1) return num.toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (num >= 0.001) return num.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return num.toLocaleString('en-US', { maximumFractionDigits: 8 })
}
