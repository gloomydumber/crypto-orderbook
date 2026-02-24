import type { OrderbookUpdate, OrderbookEntry } from '../types'

export interface LocalBook {
  bids: Map<string, string>  // price → qty
  asks: Map<string, string>
}

export function createLocalBook(): LocalBook {
  return { bids: new Map(), asks: new Map() }
}

const PRUNE_TARGET = 2000
const PRUNE_THRESHOLD = PRUNE_TARGET * 2

/** Keep only the best N levels per side (highest bids, lowest asks). */
function pruneSide(side: Map<string, string>, keepBest: 'highest' | 'lowest'): void {
  if (side.size <= PRUNE_THRESHOLD) return
  const sorted = [...side.entries()]
    .sort((a, b) => {
      const diff = parseFloat(a[0]) - parseFloat(b[0])
      return keepBest === 'highest' ? -diff : diff
    })
  side.clear()
  for (let i = 0; i < PRUNE_TARGET; i++) {
    side.set(sorted[i][0], sorted[i][1])
  }
}

export function applyUpdate(book: LocalBook, update: OrderbookUpdate): void {
  if (update.type === 'snapshot') {
    book.bids.clear()
    book.asks.clear()
  }

  for (const [price, qty] of update.bids) {
    if (qty === '0' || qty === '0.0' || qty === '0.00000000' || parseFloat(qty) === 0) {
      book.bids.delete(price)
    } else {
      book.bids.set(price, qty)
    }
  }

  for (const [price, qty] of update.asks) {
    if (qty === '0' || qty === '0.0' || qty === '0.00000000' || parseFloat(qty) === 0) {
      book.asks.delete(price)
    } else {
      book.asks.set(price, qty)
    }
  }

  // Prune to prevent unbounded growth from diff streams
  pruneSide(book.bids, 'highest')
  pruneSide(book.asks, 'lowest')
}

/**
 * Get available tick options based on price magnitude and quote currency.
 * KRW has fewer decimals (Upbit native ticks: 1000 for >= 2M, 0.01 for >= 1, etc.)
 * USDT/USD have finer precision.
 */
export function getTickOptions(price: number, quote: string): number[] {
  if (quote === 'KRW') {
    if (price >= 10_000_000) return [1000, 5000, 10000, 50000, 100000, 500000, 1000000]
    if (price >= 1_000_000) return [500, 1000, 5000, 10000, 50000, 100000]
    if (price >= 100_000) return [50, 100, 500, 1000, 5000, 10000]
    if (price >= 10_000) return [10, 50, 100, 500, 1000, 5000]
    if (price >= 1_000) return [5, 10, 50, 100, 500, 1000]
    if (price >= 100) return [1, 5, 10, 50, 100, 500]
    if (price >= 10) return [0.1, 1, 5, 10, 50, 100]
    if (price >= 1) return [0.01, 0.1, 1, 5, 10]
    return [0.001, 0.01, 0.1, 1]
  }

  // USDT / USD / USDC / BTC
  if (price >= 10_000) return [0.01, 0.1, 1, 10, 50, 100, 1000]
  if (price >= 1_000) return [0.01, 0.1, 1, 10, 50, 100]
  if (price >= 100) return [0.001, 0.01, 0.1, 1, 10, 50]
  if (price >= 10) return [0.0001, 0.001, 0.01, 0.1, 1, 10]
  if (price >= 1) return [0.00001, 0.0001, 0.001, 0.01, 0.1, 1]
  return [0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1]
}

/**
 * Group price levels by tick size.
 * Bids: floor(price/tick)*tick, Asks: ceil(price/tick)*tick.
 * Quantities are summed per grouped price.
 */
function groupByTick(
  entries: [string, string][],
  tick: number,
  side: 'bid' | 'ask',
): [string, string][] {
  const decimals = tick < 1 ? Math.ceil(-Math.log10(tick)) : 0
  const map = new Map<string, number>()

  for (const [priceStr, qtyStr] of entries) {
    const price = parseFloat(priceStr)
    const qty = parseFloat(qtyStr)
    const raw = side === 'bid'
      ? Math.floor(price / tick) * tick
      : Math.ceil(price / tick) * tick
    const grouped = raw.toFixed(decimals)
    map.set(grouped, (map.get(grouped) ?? 0) + qty)
  }

  const result: [string, string][] = [...map.entries()].map(([p, q]) => [p, q.toString()])
  result.sort((a, b) => {
    const diff = parseFloat(a[0]) - parseFloat(b[0])
    return side === 'bid' ? -diff : diff
  })
  return result
}

function mapToSorted(
  map: Map<string, string>,
  descending: boolean,
): [string, string][] {
  const entries = Array.from(map.entries())
  entries.sort((a, b) => {
    const diff = parseFloat(a[0]) - parseFloat(b[0])
    return descending ? -diff : diff
  })
  return entries
}

export function getSortedLevels(
  book: LocalBook,
  depth: number,
  tickSize: number = 0,
): { bids: OrderbookEntry[]; asks: OrderbookEntry[] } {
  let bidsRaw: [string, string][]
  let asksRaw: [string, string][]

  if (tickSize > 0) {
    // Group all levels by tick first (sorts internally), then slice to depth
    bidsRaw = groupByTick(Array.from(book.bids.entries()), tickSize, 'bid').slice(0, depth)
    asksRaw = groupByTick(Array.from(book.asks.entries()), tickSize, 'ask').slice(0, depth)
  } else {
    bidsRaw = mapToSorted(book.bids, true).slice(0, depth)
    asksRaw = mapToSorted(book.asks, false).slice(0, depth)
  }

  let cumBid = 0
  const bids: OrderbookEntry[] = bidsRaw.map(([price, qty]) => {
    cumBid += parseFloat(qty)
    return { price, qty, total: cumBid.toString() }
  })

  let cumAsk = 0
  const asks: OrderbookEntry[] = asksRaw.map(([price, qty]) => {
    cumAsk += parseFloat(qty)
    return { price, qty, total: cumAsk.toString() }
  })

  return { bids, asks }
}
