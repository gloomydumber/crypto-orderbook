import { useTheme } from '@mui/material'

export function ColumnHeaders() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '2px 4px',
      fontSize: '0.65rem',
      fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 700,
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: isDark ? '#0d0d0d' : '#eeeeee',
      borderBottom: `1px solid ${theme.palette.divider}`,
      flexShrink: 0,
    }}>
      <span style={{ flex: 1, textAlign: 'left' }}>Price</span>
      <span style={{ flex: 1, textAlign: 'right' }}>Qty</span>
      <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
    </div>
  )
}
