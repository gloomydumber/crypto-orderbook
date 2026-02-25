import { useCallback, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { useTheme } from '@mui/material'
import { orderbookAtom } from '../../store/orderbookAtoms'
import { quoteAtom } from '../../store/configAtoms'
import { CircularProgress } from '@mui/material'
import { ColumnHeaders } from './ColumnHeaders'
import { OrderbookRow } from './OrderbookRow'
import { SpreadRow } from './SpreadRow'

const ROW_HEIGHT = 26

/** Measure pixel height via callback ref + ResizeObserver. */
function useContainerHeight() {
  const [height, setHeight] = useState(0)
  const roRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (node) {
      setHeight(node.clientHeight)
      const ro = new ResizeObserver(([entry]) => {
        setHeight(Math.round(entry.contentRect.height))
      })
      ro.observe(node)
      roRef.current = ro
    } else {
      setHeight(0)
    }
  }, [])

  return { ref, height }
}

interface OrderbookDisplayProps {
  onCopy?: (label: string, value: string) => void
}

export function OrderbookDisplay({ onCopy }: OrderbookDisplayProps) {
  const orderbook = useAtomValue(orderbookAtom)
  const quote = useAtomValue(quoteAtom)
  const theme = useTheme()

  const primaryColor = theme.palette.primary.main
  const secondaryColor = theme.palette.text.secondary

  const { ref: asksRef, height: asksHeight } = useContainerHeight()
  const { ref: bidsRef, height: bidsHeight } = useContainerHeight()

  if (orderbook.bids.length === 0 && orderbook.asks.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        <ColumnHeaders />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </div>
      </div>
    )
  }

  // Max individual quantity across both sides — for gauge bar normalization.
  // Quantized to nearest power of 2 so maxQty only changes on magnitude shifts
  // (doubles/halves), not every tick. This lets React.memo on OrderbookRow skip
  // re-renders for rows whose entry hasn't changed.
  let rawMax = 0
  for (const e of orderbook.asks) {
    const q = parseFloat(e.qty)
    if (q > rawMax) rawMax = q
  }
  for (const e of orderbook.bids) {
    const q = parseFloat(e.qty)
    if (q > rawMax) rawMax = q
  }
  const maxQty = rawMax > 0 ? Math.pow(2, Math.ceil(Math.log2(rawMax))) : 0

  // Only render rows that fit — no scrolling, no Virtuoso.
  // asks sorted ascending (lowest first), bids sorted descending (highest first).
  // Slice to visible count so shrink removes DOM elements immediately.
  const askCount = Math.max(0, Math.floor(asksHeight / ROW_HEIGHT))
  const bidCount = Math.max(0, Math.floor(bidsHeight / ROW_HEIGHT))
  const visibleAsks = orderbook.asks.slice(0, askCount)
  const visibleBids = orderbook.bids.slice(0, bidCount)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <ColumnHeaders />

      {/* Asks — column-reverse puts lowest asks (index 0) near spread */}
      <div ref={asksRef} style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column-reverse',
        minHeight: 0,
      }}>
        {visibleAsks.map(entry => (
          <OrderbookRow
            key={entry.price}
            entry={entry}
            side="ask"
            maxQty={maxQty}
            quote={quote}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onCopy={onCopy}
          />
        ))}
      </div>

      <SpreadRow
        midPrice={orderbook.midPrice}
        spread={orderbook.spread}
        spreadPercent={orderbook.spreadPercent}
        quote={quote}
      />

      {/* Bids — top-down, highest bids near spread */}
      <div ref={bidsRef} style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {visibleBids.map(entry => (
          <OrderbookRow
            key={entry.price}
            entry={entry}
            side="bid"
            maxQty={maxQty}
            quote={quote}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onCopy={onCopy}
          />
        ))}
      </div>
    </div>
  )
}
