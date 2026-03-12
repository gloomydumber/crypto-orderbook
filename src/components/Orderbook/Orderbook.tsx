import { Provider } from 'jotai'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import type { Theme } from '@mui/material'
import { OrderbookView } from '../OrderbookView'
import { defaultTheme } from './theme'

export interface RawExchangeData {
  /** Raw REST responses keyed by exchange ID. Each adapter parses its own format internally. */
  rawResponses: Record<string, unknown>
}

export interface OrderbookProps {
  height?: string | number
  theme?: Theme
  showHeader?: boolean
  onCopy?: (label: string, value: string) => void
  rawExchangeData?: RawExchangeData
}

export function Orderbook({ height = '100vh', theme, showHeader = true, onCopy, rawExchangeData }: OrderbookProps) {
  const resolvedTheme = theme ?? defaultTheme
  const isDark = resolvedTheme.palette.mode === 'dark'

  return (
    <Provider>
      <ThemeProvider theme={resolvedTheme}>
        <CssBaseline />
        <Box data-cob-theme={isDark ? 'dark' : 'light'} sx={{ width: '100%', height }}>
          <OrderbookView showHeader={showHeader} onCopy={onCopy} rawExchangeData={rawExchangeData} />
        </Box>
      </ThemeProvider>
    </Provider>
  )
}
