import { createTheme } from '@mui/material'

const MONO_FONT = "'JetBrains Mono', 'Fira Code', Consolas, monospace"

export const defaultTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00ff00' },
    background: { default: '#0a0a0a', paper: '#111111' },
    text: { primary: '#00ff00', secondary: 'rgba(0, 255, 0, 0.4)' },
    divider: 'rgba(0, 255, 0, 0.06)',
  },
  typography: {
    fontFamily: MONO_FONT,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'transparent transparent',
        },
        '*:hover': {
          scrollbarColor: 'rgba(0, 255, 0, 0.15) transparent',
        },
        '*::-webkit-scrollbar': {
          width: '6px',
          background: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          background: 'transparent',
          borderRadius: '3px',
        },
        '*:hover::-webkit-scrollbar-thumb': {
          background: 'rgba(0, 255, 0, 0.15)',
        },
        '*:hover::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(0, 255, 0, 0.3)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          fontFamily: MONO_FONT,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.7rem',
          fontFamily: MONO_FONT,
          backgroundColor: 'rgba(0, 0, 0, 0.92)',
          color: '#00ff00',
          border: '1px solid rgba(0, 255, 0, 0.3)',
        },
      },
    },
  },
})
