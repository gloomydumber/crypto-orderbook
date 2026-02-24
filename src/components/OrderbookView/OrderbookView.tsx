import { Box, Typography, useTheme } from '@mui/material'
import { OrderbookToolbar } from '../OrderbookToolbar'
import { OrderbookDisplay } from '../OrderbookDisplay'
import { useOrderbook } from '../../hooks/useOrderbook'

interface OrderbookViewProps {
  showHeader?: boolean
  onCopy?: (label: string, value: string) => void
}

export function OrderbookView({ showHeader = true, onCopy }: OrderbookViewProps) {
  const theme = useTheme()

  // Initialize the orderbook WebSocket lifecycle
  useOrderbook()

  return (
    <Box style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      background: theme.palette.background.default,
      borderRadius: 4,
    }}>
      {showHeader && (
        <Box style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}>
          <Typography
            variant="caption"
            style={{
              fontWeight: 700,
              fontSize: '0.75rem',
              color: theme.palette.text.primary,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Orderbook
          </Typography>
        </Box>
      )}

      <OrderbookToolbar />

      <Box style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <OrderbookDisplay onCopy={onCopy} />
      </Box>
    </Box>
  )
}
