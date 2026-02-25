import { useMemo, useRef, useState, useEffect, useCallback, forwardRef } from 'react'
import { useAtomValue } from 'jotai'
import { useTheme } from '@mui/material'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { orderbookAtom } from '../../store/orderbookAtoms'
import { quoteAtom } from '../../store/configAtoms'
import { CircularProgress } from '@mui/material'
import { ColumnHeaders } from './ColumnHeaders'
import { OrderbookRow } from './OrderbookRow'
import { SpreadRow } from './SpreadRow'

/** Measure a container's pixel height via ResizeObserver. */
function useContainerHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setHeight(Math.round(entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, height }
}

/**
 * Scroller that keeps overflow:auto (Virtuoso needs it for viewport detection)
 * but hides the scrollbar and blocks wheel/touch scroll.
 * Rows are revealed only by widget resize, not user scrolling.
 */
const NoScrollScroller = forwardRef<HTMLDivElement, React.ComponentPropsWithRef<'div'>>(
  function NoScrollScroller(props, ref) {
    const localRef = useRef<HTMLDivElement | null>(null)

    // Combine forwarded ref + local ref
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node
        if (typeof ref === 'function') ref(node)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (ref) (ref as any).current = node
      },
      [ref],
    )

    // Prevent wheel scroll — must be non-passive to call preventDefault
    useEffect(() => {
      const el = localRef.current
      if (!el) return
      const block = (e: WheelEvent) => e.preventDefault()
      el.addEventListener('wheel', block, { passive: false })
      return () => el.removeEventListener('wheel', block)
    }, [])

    return (
      <div
        {...props}
        ref={setRefs}
        style={{
          ...props.style,
          // overflow:auto is required — Virtuoso uses it for viewport detection.
          // Scrollbar is hidden via CSS below; wheel events are blocked above.
          overflowY: 'auto',
          scrollbarWidth: 'none',       // Firefox
          msOverflowStyle: 'none',      // IE/Edge
        }}
        className="cob-no-scroll"
      />
    )
  },
)

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
  const asksVirtuosoRef = useRef<VirtuosoHandle>(null)

  const reversedAsks = useMemo(
    () => [...orderbook.asks].reverse(),
    [orderbook.asks],
  )

  // When asks container height changes, scroll Virtuoso to the bottom
  // so lowest asks stay near the spread row.
  useEffect(() => {
    if (asksHeight > 0 && reversedAsks.length > 0) {
      asksVirtuosoRef.current?.scrollToIndex({
        index: reversedAsks.length - 1,
        align: 'end',
      })
    }
  }, [asksHeight, reversedAsks.length])

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

      {/* Asks — measure container, pass explicit pixel height to Virtuoso */}
      <div ref={asksRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {asksHeight > 0 && (
          <Virtuoso
            ref={asksVirtuosoRef}
            style={{ height: asksHeight }}
            components={{ Scroller: NoScrollScroller }}
            data={reversedAsks}
            fixedItemHeight={26}
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
        )}
      </div>

      <SpreadRow
        midPrice={orderbook.midPrice}
        spread={orderbook.spread}
        spreadPercent={orderbook.spreadPercent}
        quote={quote}
      />

      {/* Bids — measure container, pass explicit pixel height to Virtuoso */}
      <div ref={bidsRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {bidsHeight > 0 && (
          <Virtuoso
            style={{ height: bidsHeight }}
            components={{ Scroller: NoScrollScroller }}
            data={orderbook.bids}
            fixedItemHeight={26}
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
        )}
      </div>
    </div>
  )
}
