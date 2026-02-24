# crypto-orderbook — HANDOFF

## Overview

Real-time cryptocurrency orderbook widget, published as an npm library (`@gloomydumber/crypto-orderbook`) for embedding in other apps (e.g., `wts-frontend`). Supports 6 exchanges with live WebSocket data, client-side and server-side tick grouping, and a dark terminal-style UI.

## Build & Dev

- `npm run dev` — Vite dev server (App.tsx harness, 480x900 container)
- `npm run build` — TypeScript compile + Vite build (SPA)
- `npm run build:lib` — Library build (dts plugin, external peer deps)
- `npm run lint` — ESLint flat config
- `npm run preview` — Preview production build

## Architecture

```
src/
├── components/
│   ├── Orderbook/          # Entry point: Provider + ThemeProvider + CssBaseline
│   ├── OrderbookView/      # Layout: optional header + toolbar + display
│   ├── OrderbookDisplay/   # Bids/asks/spread rendering
│   └── OrderbookToolbar/   # Exchange, quote, base (Autocomplete), tick selectors
├── exchanges/
│   ├── types.ts            # OrderbookAdapter interface
│   ├── registry.ts         # getAdapterById, getAllAdapters
│   ├── fetch-utils.ts      # fetchJson helper
│   └── adapters/           # 6 exchange implementations
├── hooks/
│   ├── useOrderbook.ts     # Core orchestration (WS lifecycle, REST fetches, tick options)
│   ├── useWebSocket.ts     # Raw WS management (reconnect, heartbeat, cleanup)
│   └── useAvailablePairs.ts
├── store/
│   ├── configAtoms.ts      # atomWithStorage: exchangeId, quote, base, tickSize
│   └── orderbookAtoms.ts   # orderbook, connectionStatus, availablePairs, tickOptions
├── types/
│   ├── config.ts           # NormalizedPair, ExchangeInfo, EXCHANGES
│   └── orderbook.ts        # OrderbookEntry, OrderbookData, OrderbookUpdate
├── utils/
│   ├── orderbook-manager.ts # LocalBook, applyUpdate, getSortedLevels, getTickOptions
│   ├── format.ts           # formatPrice (quote-dependent), formatQty
│   └── clipboard.ts
├── lib.ts                  # Library exports
└── App.tsx                 # Dev harness
```

### State Management

Jotai atoms, config atoms persisted via `atomWithStorage`:

| Atom | Type | Storage |
|------|------|---------|
| `exchangeIdAtom` | `string` | localStorage |
| `quoteAtom` | `string` | localStorage |
| `baseAtom` | `string` | localStorage |
| `tickSizeAtom` | `number` | localStorage |
| `orderbookAtom` | `OrderbookData` | memory |
| `connectionStatusAtom` | `ConnectionStatus` | memory |
| `availablePairsAtom` | `string[]` | memory |
| `tickOptionsAtom` | `number[]` | memory |

### Exchange Adapters

| Exchange | Quotes | WS Type | Grouping | Heartbeat | Snapshot |
|----------|--------|---------|----------|-----------|----------|
| **Upbit** | KRW, BTC | Snapshot per msg | Server-side | No | No |
| **Bithumb** | KRW, BTC | Snapshot per msg | Server-side (KRW) | No | No |
| **Binance** | USDT, USDC, BUSD, FDUSD, BTC | Diff @100ms | Client-side | No | REST 1000 levels |
| **Bybit** | USDT, USDC | orderbook.200 | Client-side | `{"op":"ping"}` 20s | No |
| **OKX** | USDT, USDC | books channel | Client-side | `"ping"` 25s | No |
| **Coinbase** | USD | level2 channel | Client-side | No | No |

**Server-side grouping** (Upbit/Bithumb): `fetchSupportedLevels()` returns available tick levels from the exchange API. The WS `level` parameter controls grouping server-side. Reconnection required on tick change.

**Client-side grouping** (Binance/Bybit/OKX/Coinbase): `fetchNativeTick()` returns the exchange's native tick size + current price via REST APIs. Tick options computed from price magnitude, filtered to `>= nativeTick`. Grouping done in `getSortedLevels()` via `groupByTick()`.

### Adapter Interface

```typescript
interface OrderbookAdapter {
  id: string
  name: string
  supportedQuoteCurrencies: string[]
  getWebSocketUrl(pair): string
  getSubscribeMessage?(pair, level?): string | object | null
  getUnsubscribeMessage?(pair, level?): string | object | null
  parseMessage(data: string | Blob): Promise<OrderbookUpdate | null>
  buildSymbol(base, quote): string
  heartbeat?: { message: string | (() => string); interval: number }
  fetchSnapshot?(pair, signal?): Promise<OrderbookUpdate | null>
  fetchAvailablePairs(quote, signal?): Promise<string[]>
  fetchNativeTick?(pair, signal?): Promise<{ nativeTick: number; price: number }>
  fetchSupportedLevels?(pair, signal?): Promise<{ nativeTick: number; levels: number[] }>
}
```

### Public API (Props)

```typescript
interface OrderbookProps {
  height?: string | number    // default: '100vh'
  theme?: Theme               // MUI Theme override
  showHeader?: boolean        // default: true — "ORDERBOOK" title bar
  onCopy?: (label: string, value: string) => void
}
```

## Key Design Decisions & Session Changes

### 1. Tick Options Pre-loaded via REST APIs

**Problem**: Tick options were initially computed from live WS data inside `flushOrderbook`, causing a visible "options changing after render" UX issue.

**Solution**: Moved all tick option computation into the connection effect. Each adapter now has a `fetchNativeTick()` method that calls the exchange's REST API for instrument info + current price. Tick options are resolved before any WS data arrives. `flushOrderbook` no longer touches tick options.

- **Binance**: `GET /api/v3/exchangeInfo` (PRICE_FILTER.tickSize) + `GET /api/v3/ticker/price`
- **Bybit**: `GET /v5/market/instruments-info` (priceFilter.tickSize) + `GET /v5/market/tickers`
- **OKX**: `GET /api/v5/public/instruments` (tickSz) + `GET /api/v5/market/ticker`
- **Coinbase**: `GET /products/{id}` (quote_increment) + `GET /products/{id}/ticker`

### 2. StrictMode Double-Mount Fix

**Problem**: React 18 StrictMode double-mounts effects. The first mount sets `prevFetchKeyRef`, cleanup aborts in-flight `fetchSupportedLevels`, but the second mount sees the same key — `isPairChange=false` — and skips the fetch entirely. Tick options never load on page refresh for Upbit/Bithumb.

**Solution**: Instead of relying solely on `isPairChange`, added `needsLevelFetch` check: `serverLevelsRef.current !== null && serverLevelsRef.current.length === 0`. The `[]` (pending) state signals that a fetch is needed regardless of `isPairChange`. Also added retry logic (1 retry, 2s delay) with fallback to `serverLevelsRef.current = null` (client-side tick options) on final failure.

### 3. Depth Selector Removed

**Problem**: Depth options (5, 10, 15, 20) were too narrow for the widget and there was no performance reason to limit depth.

**Solution**: Removed `DepthSelector` component, `depthAtom`, `DEPTH_OPTIONS`, and `DepthLevel` type. Render depth capped at 50 rows in `flushOrderbook` to prevent DOM overload with deep books (Binance 1000+ levels).

### 4. Edge Padding (Prevent Visual Shrinking)

**Problem**: When the outermost price level vanishes (qty goes to 0), the orderbook visually shrinks by one row, causing jitter.

**Solution**: In `flushOrderbook`, track `prevTopAskRef` (highest ask) and `prevBottomBidRef` (lowest bid). If either vanishes and no new level appeared beyond it, pad it back as `{ price, qty: '0', total: lastTotal }`. Refs reset on pair/exchange change.

### 5. BaseSelector Changed to Autocomplete

**Problem**: MUI `Select` dropdown was impractical for 100+ trading pairs.

**Solution**: Replaced with MUI `Autocomplete` component with:
- `disableClearable`, `autoHighlight`, `openOnFocus`
- Small font (0.75rem) matching the terminal style
- Custom `noOptionsText` with 0.7rem font to match
- 300px max dropdown height

### 6. Scrollbar Styling

**Problem**: Default browser scrollbars didn't match the dark terminal aesthetic.

**Solution**: Added scrollbar styles to `MuiCssBaseline` overrides in `theme.ts`:
- Thin scrollbar, transparent by default
- Green thumb (`rgba(0, 255, 0, 0.15)`) visible only on hover
- `scrollbar-gutter: stable` on both bid/ask containers to prevent layout shift when scrollbar appears/disappears

### 7. Asks Section Column-Reverse

**Problem**: With `overflow: auto`, the asks section scroll started at the top (highest prices), hiding the most relevant data (lowest asks near spread).

**Solution**: Changed asks container to `flexDirection: 'column-reverse'`. Asks array (sorted ascending) renders with the first items (lowest prices) at the bottom near spread, which is the scroll origin. Scrolling up reveals higher asks.

### 8. Row Height Increased

**Problem**: Rows at 18px line-height were too dense for comfortable reading.

**Solution**: Increased to `lineHeight: '22px'`, `padding: '2px 4px'`, `fontSize: '0.75rem'`. Dev container height increased from 700px to 900px to fit 15 rows per side without scrolling.

### 9. Settings Icon Removed

Removed the cogwheel `IconButton` and `SettingsIcon` import from `OrderbookView.tsx`. The `showHeader` prop still controls the "ORDERBOOK" title bar visibility. For `wts-frontend` integration, pass `showHeader={false}`.

### 10. Loading State

When `bids.length === 0 && asks.length === 0`, renders `<CircularProgress size={28} />` centered below the column headers.

## Performance Notes

1. **OrderbookRow** — `React.memo` prevents re-renders; inline `style={}` avoids Emotion style injection in hot path
2. **RAF throttle** — max 1 atom flush per animation frame regardless of WS message rate
3. **50-row cap** — prevents 1000+ DOM nodes for deep books (Binance/Coinbase)
4. **Pruning** — `applyUpdate` auto-prunes to 2000 levels per side when exceeding 4000 (prevents unbounded Map growth from diff streams)
5. **AbortController** — all async fetches abort on cleanup/pair change to prevent race conditions
6. **scrollbar-gutter: stable** — prevents layout shift from scrollbar appearing/disappearing
7. **Edge padding** — qty=0 placeholder at outermost levels prevents visual jitter

## Known Issues / Future Work

- `atomWithStorage` hydration can race with initial API calls — mitigated by `needsLevelFetch` pattern but worth monitoring
- Bithumb caches native tick in module-level variable for synchronous `getSubscribeMessage()` — works but fragile if multiple instances exist
- Coinbase Advanced Trade WS is unauthenticated — may have rate limits or reduced data depth
- Consider adding `formatPrice` locale support (KRW comma formatting, etc.)
- Phase 2: integrate into `wts-frontend` as OrderbookWidget with `showHeader={false}`

## Files Changed This Session

### Modified
- `src/hooks/useOrderbook.ts` — Major refactor: REST-based tick options, StrictMode fix, edge padding, 50-row cap
- `src/utils/orderbook-manager.ts` — Removed unused functions (getBookSpread, filterTickOptions, detectNativeTick, etc.)
- `src/exchanges/types.ts` — Added `fetchNativeTick` to adapter interface
- `src/exchanges/adapters/binance.ts` — Added `fetchNativeTick`
- `src/exchanges/adapters/bybit.ts` — Added `fetchNativeTick`
- `src/exchanges/adapters/okx.ts` — Added `fetchNativeTick`
- `src/exchanges/adapters/coinbase.ts` — Added `fetchNativeTick`
- `src/components/OrderbookDisplay/OrderbookDisplay.tsx` — CircularProgress loading, column-reverse asks, scrollbar-gutter
- `src/components/OrderbookDisplay/OrderbookRow.tsx` — Increased row height (22px line-height, 0.75rem font)
- `src/components/OrderbookView/OrderbookView.tsx` — Removed settings icon
- `src/components/OrderbookToolbar/BaseSelector.tsx` — Changed from Select to Autocomplete
- `src/components/OrderbookToolbar/OrderbookToolbar.tsx` — Removed DepthSelector
- `src/components/OrderbookToolbar/TickSelector.tsx` — Returns null when no options
- `src/components/Orderbook/theme.ts` — Added scrollbar styles to MuiCssBaseline
- `src/store/configAtoms.ts` — Removed depthAtom
- `src/types/config.ts` — Removed DEPTH_OPTIONS, DepthLevel
- `src/types/index.ts` — Removed deleted type exports
- `src/lib.ts` — Removed deleted exports
- `src/App.tsx` — Dev container height 700→900

### Deleted
- `src/components/OrderbookDisplay/OrderbookSkeleton.tsx`
- `src/components/OrderbookToolbar/DepthSelector.tsx`

---

## Session: 2026-02-24 — setUpdatesPaused API (v0.1.4)

### What Was Done

Added `setUpdatesPaused(value: boolean)` API — a module-level pause flag that skips RAF flushes to Jotai atoms during grid drag/resize in the host app (wts-frontend). Follows the same pattern as `@gloomydumber/premium-table`'s `setUpdatesPaused`.

**How it works:**
- Module-level `paused` boolean in `useOrderbook.ts`
- When paused: WebSocket messages still write to the local book (`applyUpdate` — O(1), no React), but `flushOrderbook` returns early and no new RAFs are scheduled
- On resume: a single catch-up flush applies all accumulated changes in one frame
- Exported from `src/lib.ts` as `setUpdatesPaused`

**Why:** The orderbook's per-frame RAF flushes compete with react-grid-layout's layout calculations during drag/resize, causing visible lag. Pausing atom flushes gives the grid the main thread during interaction.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useOrderbook.ts` | Added `paused` flag, `pendingFlush`, `setUpdatesPaused()` export; skip RAF when paused |
| `src/lib.ts` | Added `setUpdatesPaused` export |
| `package.json` | Version bump 0.1.3 → 0.1.4 |

