import { useTheme } from '@mui/material'
import { formatPrice } from '../../utils/format'

interface SpreadRowProps {
  midPrice: string | null
  spread: string | null
  spreadPercent: string | null
  quote: string
}

export function SpreadRow({ midPrice, spread, spreadPercent, quote }: SpreadRowProps) {
  const theme = useTheme()

  if (!midPrice) {
    return (
      <div style={{
        flexShrink: 0,
        padding: '3px 8px',
        fontSize: '0.65rem',
        fontFamily: "'JetBrains Mono', monospace",
        color: theme.palette.text.secondary,
        textAlign: 'center',
        borderTop: `1px solid ${theme.palette.divider}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        ---
      </div>
    )
  }

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '3px 8px',
      fontSize: '0.65rem',
      fontFamily: "'JetBrains Mono', monospace",
      borderTop: `1px solid ${theme.palette.divider}`,
      borderBottom: `1px solid ${theme.palette.divider}`,
    }}>
      <span style={{ color: theme.palette.text.primary, fontWeight: 600 }}>
        {formatPrice(midPrice, quote)}
      </span>
      {spread && (
        <span style={{ color: theme.palette.text.secondary }}>
          Spread: {formatPrice(spread, quote)}
        </span>
      )}
      {spreadPercent && (
        <span style={{ color: theme.palette.text.secondary }}>
          ({spreadPercent}%)
        </span>
      )}
    </div>
  )
}
