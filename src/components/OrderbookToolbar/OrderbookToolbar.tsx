import { Box, useTheme } from '@mui/material'
import { ExchangeSelector } from './ExchangeSelector'
import { QuoteSelector } from './QuoteSelector'
import { BaseSelector } from './BaseSelector'
import { TickSelector } from './TickSelector'
import { ConnectionStatus } from './ConnectionStatus'

export function OrderbookToolbar() {
  const theme = useTheme()

  return (
    <Box style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 8px',
      borderBottom: `1px solid ${theme.palette.divider}`,
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      <ExchangeSelector />
      <QuoteSelector />
      <BaseSelector />
      <TickSelector />
      <Box style={{ marginLeft: 'auto' }}>
        <ConnectionStatus />
      </Box>
    </Box>
  )
}
