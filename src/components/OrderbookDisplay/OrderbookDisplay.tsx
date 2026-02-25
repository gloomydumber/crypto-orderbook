import { useMemo, forwardRef, useRef, useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useTheme } from '@mui/material'
import { Virtuoso } from 'react-virtuoso'

function useContainerHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height)
      setHeight(prev => (prev !== h ? h : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, height }
}

// Disable scrolling — rows are revealed only by widget resize
const NoScrollScroller = forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
  (props, ref) => <div {...props} ref={ref} style={{ ...props.style, overflow: 'hidden' }} />,
)
import { orderbookAtom } from '../../store/orderbookAtoms'
import { quoteAtom } from '../../store/configAtoms'
import { CircularProgress } from '@mui/material'
import { ColumnHeaders } from './ColumnHeaders'
import { OrderbookRow } from './OrderbookRow'
import { SpreadRow } from './SpreadRow'

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

  // Must be before early return to satisfy rules of hooks
  const reversedAsks = useMemo(
    () => [...orderbook.asks].reverse(),
    [orderbook.asks],
  )

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <ColumnHeaders />

      {/* Asks section — reversed so lowest asks render near spread */}
      <div ref={asksRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Virtuoso
        style={{ height: asksHeight || '100%' }}
        components={{ Scroller: NoScrollScroller }}
        data={reversedAsks}
        fixedItemHeight={26}
        overscan={10}
        initialTopMostItemIndex={reversedAsks.length - 1}
        followOutput="auto"
        computeItemKey={(_, entry) => entry.price}
        itemContent={(_, entry) => (
          <OrderbookRow
            entry={entry}
            side="ask"
            maxQty={maxQty}
            quote={quote}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onCopy={onCopy}
          />
        )}
      />
      </div>

      {/* Spread row */}
      <SpreadRow
        midPrice={orderbook.midPrice}
        spread={orderbook.spread}
        spreadPercent={orderbook.spreadPercent}
        quote={quote}
      />

      {/* Bids section — rows from top down */}
      <div ref={bidsRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Virtuoso
        style={{ height: bidsHeight || '100%' }}
        components={{ Scroller: NoScrollScroller }}
        data={orderbook.bids}
        fixedItemHeight={26}
        overscan={10}
        computeItemKey={(_, entry) => entry.price}
        itemContent={(_, entry) => (
          <OrderbookRow
            entry={entry}
            side="bid"
            maxQty={maxQty}
            quote={quote}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onCopy={onCopy}
          />
        )}
      />
      </div>
    </div>
  )
}
