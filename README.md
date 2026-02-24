# crypto-orderbook

Real-time cryptocurrency orderbook widget for React. Connects to 6 exchanges via WebSocket, with live tick grouping, auto-pair discovery, and a dark terminal-style UI.

## Supported Exchanges

| Exchange | Quote Currencies | Grouping |
|----------|-----------------|----------|
| Upbit | KRW, BTC | Server-side |
| Bithumb | KRW, BTC | Server-side |
| Binance | USDT, USDC, BUSD, FDUSD, BTC | Client-side |
| Bybit | USDT, USDC | Client-side |
| OKX | USDT, USDC | Client-side |
| Coinbase | USD | Client-side |

## Installation

```bash
npm install @gloomydumber/crypto-orderbook
```

### Peer Dependencies

```bash
npm install react react-dom @mui/material @mui/icons-material @emotion/react @emotion/styled jotai
```

## Usage

```tsx
import { Orderbook } from '@gloomydumber/crypto-orderbook'
import '@gloomydumber/crypto-orderbook/style.css'

function App() {
  return <Orderbook height={900} />
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `string \| number` | `'100vh'` | Container height |
| `theme` | `Theme` | Dark green terminal | MUI Theme override |
| `showHeader` | `boolean` | `true` | Show "ORDERBOOK" title bar |
| `onCopy` | `(label: string, value: string) => void` | — | Callback when a price row is clicked |

### Embedding in another app (e.g., hiding the header)

```tsx
<Orderbook height="100%" showHeader={false} />
```

### Custom theme

```tsx
import { createTheme } from '@mui/material'

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    background: { default: '#ffffff', paper: '#f5f5f5' },
  },
})

<Orderbook theme={lightTheme} />
```

## Features

- **Live WebSocket data** — real-time bids/asks with RAF-throttled rendering (max 1 flush per animation frame)
- **Tick grouping** — server-side for Upbit/Bithumb, client-side for others. Tick options pre-loaded via REST APIs
- **Auto-pair discovery** — available trading pairs fetched per exchange/quote combination
- **Deep snapshots** — Binance fetches 1000-level REST snapshot on pair change
- **Edge padding** — outermost price levels show qty=0 instead of disappearing to prevent visual jitter
- **Persistent config** — exchange, quote, base, and tick size persisted to localStorage
- **Scrollable orderbook** — asks use `column-reverse` for natural scroll origin near spread; `scrollbar-gutter: stable` prevents layout shift

## Exports

### Component

```tsx
import { Orderbook } from '@gloomydumber/crypto-orderbook'
```

### Types

```tsx
import type {
  OrderbookProps,
  OrderbookAdapter,
  NormalizedPair,
  ExchangeInfo,
  OrderbookEntry,
  OrderbookData,
  OrderbookUpdate,
  ConnectionStatus,
} from '@gloomydumber/crypto-orderbook'
```

### Exchange Adapters & Registry

```tsx
import {
  EXCHANGES,
  getAdapterById,
  getAllAdapters,
  upbitAdapter,
  bithumbAdapter,
  binanceAdapter,
  bybitAdapter,
  okxAdapter,
  coinbaseAdapter,
} from '@gloomydumber/crypto-orderbook'
```

## Development

```bash
git clone https://github.com/gloomydumber/crypto-orderbook.git
cd crypto-orderbook
npm install
npm run dev
```

The dev server launches a 480x900 container at `localhost:5173` with the full orderbook widget.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript + Vite production build |
| `npm run build:lib` | Library build (for npm publish) |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

### Publishing

```bash
npm run build:lib
npm publish
```

Publishes to GitHub Packages (`npm.pkg.github.com`).

## Architecture

```
src/
├── components/
│   ├── Orderbook/          # Entry: Jotai Provider + MUI ThemeProvider
│   ├── OrderbookView/      # Layout: header + toolbar + display
│   ├── OrderbookDisplay/   # Bids/asks/spread rendering (memoized rows)
│   └── OrderbookToolbar/   # Exchange, quote, base, tick selectors
├── exchanges/
│   ├── types.ts            # OrderbookAdapter interface
│   ├── registry.ts         # Adapter lookup
│   └── adapters/           # Per-exchange WebSocket + REST implementations
├── hooks/
│   ├── useOrderbook.ts     # Core: WS lifecycle, REST fetches, tick options, edge padding
│   ├── useWebSocket.ts     # Raw WS: reconnect (10x), heartbeat, cleanup
│   └── useAvailablePairs.ts
├── store/                  # Jotai atoms (config persisted, orderbook in-memory)
├── types/                  # Shared TypeScript types
├── utils/
│   ├── orderbook-manager.ts # LocalBook model, tick grouping, sorting
│   └── format.ts           # Price/qty formatting (quote-dependent decimals)
└── lib.ts                  # Library entry point
```

### Data Flow

1. `useOrderbook` creates a WebSocket connection via the selected adapter
2. Each WS message is parsed by the adapter into `OrderbookUpdate` (snapshot or delta)
3. Updates are applied to an in-memory `LocalBook` (Map-based)
4. RAF throttle schedules a single flush per frame
5. `flushOrderbook` sorts, groups by tick, caps to 50 rows, pads edges, computes spread, and writes to Jotai atoms
6. React components re-render from atom updates

## License

MIT
