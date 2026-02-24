import { memo, useCallback } from 'react'
import type { OrderbookEntry } from '../../types'
import { formatPrice, formatQty } from '../../utils/format'

interface OrderbookRowProps {
  entry: OrderbookEntry
  side: 'bid' | 'ask'
  maxQty: number
  quote: string
  /** theme.palette.primary.main — for qty text */
  primaryColor: string
  /** theme.palette.text.secondary — for total text */
  secondaryColor: string
  onCopy?: (label: string, value: string) => void
}

export const OrderbookRow = memo(function OrderbookRow({
  entry,
  side,
  maxQty,
  quote,
  primaryColor,
  secondaryColor,
  onCopy,
}: OrderbookRowProps) {
  // Gauge bar based on individual quantity — not cumulative total.
  // Cumulative bars make rows after a whale order all look ~98-100% identical.
  const qtyNum = parseFloat(entry.qty)
  const barWidth = maxQty > 0 ? (qtyNum / maxQty) * 100 : 0
  const isBid = side === 'bid'

  // Match mock: asks = #ff0000, bids = #0000ff
  const priceColor = isBid ? '#0000ff' : '#ff0000'
  const barColor = isBid ? 'rgba(0, 0, 255, 0.12)' : 'rgba(255, 0, 0, 0.12)'

  const handleClick = useCallback(() => {
    if (onCopy) {
      onCopy('Price', entry.price)
    }
  }, [onCopy, entry.price])

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px 4px',
        fontSize: '0.75rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        cursor: onCopy ? 'pointer' : 'default',
        position: 'relative',
        lineHeight: '22px',
      }}
    >
      {/* Volume bar background */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: `${barWidth}%`,
        background: barColor,
        pointerEvents: 'none',
      }} />

      {/* Price */}
      <span style={{
        flex: 1,
        textAlign: 'left',
        color: priceColor,
        fontWeight: 500,
        position: 'relative',
        zIndex: 1,
      }}>
        {formatPrice(entry.price, quote)}
      </span>

      {/* Qty — uses theme primary color */}
      <span style={{
        flex: 1,
        textAlign: 'right',
        color: primaryColor,
        position: 'relative',
        zIndex: 1,
      }}>
        {formatQty(entry.qty)}
      </span>

      {/* Total — uses theme text.secondary */}
      <span style={{
        flex: 1,
        textAlign: 'right',
        color: secondaryColor,
        position: 'relative',
        zIndex: 1,
      }}>
        {formatQty(entry.total)}
      </span>
    </div>
  )
})
