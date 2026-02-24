import { Provider } from 'jotai'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import type { Theme } from '@mui/material'
import { OrderbookView } from '../OrderbookView'
import { defaultTheme } from './theme'

export interface OrderbookProps {
  height?: string | number
  theme?: Theme
  showHeader?: boolean
  onCopy?: (label: string, value: string) => void
}

export function Orderbook({ height = '100vh', theme, showHeader = true, onCopy }: OrderbookProps) {
  const resolvedTheme = theme ?? defaultTheme
  const isDark = resolvedTheme.palette.mode === 'dark'

  return (
    <Provider>
      <ThemeProvider theme={resolvedTheme}>
        <CssBaseline />
        <Box data-cob-theme={isDark ? 'dark' : 'light'} sx={{ width: '100%', height }}>
          <OrderbookView showHeader={showHeader} onCopy={onCopy} />
        </Box>
      </ThemeProvider>
    </Provider>
  )
}
