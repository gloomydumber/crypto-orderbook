import { useAtomValue } from 'jotai'
import { useTheme } from '@mui/material'
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
  // Per-row qty bars show meaningful differences even after a whale order.
  let maxQty = 0
  for (const e of orderbook.asks) {
    const q = parseFloat(e.qty)
    if (q > maxQty) maxQty = q
  }
  for (const e of orderbook.bids) {
    const q = parseFloat(e.qty)
    if (q > maxQty) maxQty = q
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <ColumnHeaders />

      {/* Asks section — column-reverse so scroll origin is at bottom (lowest asks near spread) */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse',
        minHeight: 0,
        scrollbarGutter: 'stable',
      }}>
        {orderbook.asks.map(entry => (
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

      {/* Spread row */}
      <SpreadRow
        midPrice={orderbook.midPrice}
        spread={orderbook.spread}
        spreadPercent={orderbook.spreadPercent}
        quote={quote}
      />

      {/* Bids section — scrollable, rows from top down */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
        scrollbarGutter: 'stable',
      }}>
        {orderbook.bids.map(entry => (
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
