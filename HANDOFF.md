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
  availablePairs?: string[]   // Host-provided pairs — skips internal REST fetch when set
}
```

## Session: 2026-03-11 — Add `availablePairs` Prop for Host-Provided Pair Data

### What Was Done

Added an optional `availablePairs?: string[]` prop to the `Orderbook` component. When provided, the package skips its internal REST fetch for available trading pairs and uses the host-supplied data directly. When omitted, the package fetches internally as before (fully backwards compatible).

**Motivation:** Host apps like `wts-frontend` may already have pair data fetched (e.g., from a shared data layer or Rust/Tauri backend). Passing pre-fetched pairs avoids redundant REST calls and potential rate-limit issues.

**How it works:**
- `Orderbook` → `OrderbookView` → `useOrderbook(availablePairs)` → `useAvailablePairs(externalPairs)`
- `useAvailablePairs` now has two `useEffect` blocks: one for external pairs (sort + set atom), one for internal fetch (skipped when external pairs provided)
- Both paths share the same base-reset logic (prefer BTC if current base not in list)

### Files Changed

| File | Change |
|------|--------|
| `src/components/Orderbook/Orderbook.tsx` | Added `availablePairs?: string[]` to `OrderbookProps`, pass through to `OrderbookView` |
| `src/components/OrderbookView/OrderbookView.tsx` | Added `availablePairs?: string[]` to `OrderbookViewProps`, pass to `useOrderbook()` |
| `src/hooks/useOrderbook.ts` | Accept `availablePairs` param, pass to `useAvailablePairs()` |
| `src/hooks/useAvailablePairs.ts` | Accept `externalPairs` param; split into two effects (external vs internal fetch) |

---

## Session: 2026-02-25 — Fix Virtuoso Shrink Detection (v0.3.0)

### What Was Done

Fixed react-virtuoso not detecting container shrink when react-grid-layout widgets are resized smaller. Rows remained in the DOM and continued processing WebSocket updates, degrading performance.

**Root cause:** Both Virtuoso instances used `style={{ flex: 1, minHeight: 0 }}` — CSS-relative sizing. When the parent container shrank, Virtuoso's internal ResizeObserver didn't correctly recalculate the visible range. Additionally, `overscan={150}` with only 50 items per side meant all items were always rendered, completely defeating virtualization.

**Fix:**
1. Added `useContainerHeight()` hook — local `ResizeObserver` measures the container's actual pixel height
2. Each Virtuoso wrapped in `<div ref={...Ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>` and receives `style={{ height: measuredHeight || '100%' }}` instead of flex sizing
3. Reduced `overscan` from `150` to `10` — the old value rendered all 50 items regardless of container size
4. Added `flexShrink: 0` to both SpreadRow container divs to prevent the spread row from being squeezed during flex layout reflow

### Files Changed

| File | Change |
|------|--------|
| `src/components/OrderbookDisplay/OrderbookDisplay.tsx` | Added `useContainerHeight()` hook (2 instances), wrapper divs, pixel-based height, overscan 150→10 |
| `src/components/OrderbookDisplay/SpreadRow.tsx` | Added `flexShrink: 0` to both container divs |
| `package.json` | Version bump 0.2.1 → 0.3.0 |

---

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

**Solution**: Changed asks container to `flexDirection: 'column-reverse'`. Asks array (sorted ascending) renders with the first items (lowest prices) at the bottom near spread, which is the scroll origin. `overflow: hidden` clips higher asks that don't fit.

*Note: v0.2.0–v0.3.0 used react-virtuoso with a reversed array approach, but Virtuoso couldn't detect container shrink with `overflow: hidden`. Reverted to column-reverse in v0.3.1.*

### 8. Row Height Increased

**Problem**: Rows at 18px line-height were too dense for comfortable reading.

**Solution**: Increased to `lineHeight: '22px'`, `padding: '2px 4px'`, `fontSize: '0.75rem'`. Dev container height increased from 700px to 900px to fit 15 rows per side without scrolling.

### 9. Settings Icon Removed

Removed the cogwheel `IconButton` and `SettingsIcon` import from `OrderbookView.tsx`. The `showHeader` prop still controls the "ORDERBOOK" title bar visibility. For `wts-frontend` integration, pass `showHeader={false}`.

### 10. Loading State

When `bids.length === 0 && asks.length === 0`, renders `<CircularProgress size={28} />` centered below the column headers.

## Performance Notes

1. **OrderbookRow** — `React.memo` prevents re-renders; inline `style={}` avoids Emotion style injection in hot path
2. **maxQty quantization** (v0.2.0) — `maxQty` quantized to nearest power of 2 via `Math.pow(2, Math.ceil(Math.log2(rawMax)))`. Only changes when the largest order magnitude doubles or halves, so `React.memo` on `OrderbookRow` actually skips re-renders for unchanged rows. Reduces per-tick re-renders from ~100 to ~1-5.
3. **overflow: hidden clipping** (v0.3.1) — Both asks (`column-reverse`) and bids containers use `overflow: hidden` to show only rows that fit. No scrollbar, no scrolling. Widget resize reveals more/fewer rows. *(react-virtuoso was tried in v0.2.0–v0.3.0 but couldn't handle container shrink with overflow:hidden — reverted in v0.3.1)*
4. **RAF throttle** — max 1 atom flush per animation frame regardless of WS message rate
5. **50-row cap** — prevents 1000+ DOM nodes for deep books (Binance/Coinbase)
6. **Pruning** — `applyUpdate` auto-prunes to 2000 levels per side when exceeding 4000 (prevents unbounded Map growth from diff streams)
7. **AbortController** — all async fetches abort on cleanup/pair change to prevent race conditions
8. **scrollbar-gutter: stable** — prevents layout shift from scrollbar appearing/disappearing
9. **Edge padding** — qty=0 placeholder at outermost levels prevents visual jitter

## Known Issues / Future Work

- ~~`atomWithStorage` hydration can race with initial API calls~~ — **Fixed in v0.4.1**: sync localStorage hydration at module init prevents flash-mount (same pattern as wts-frontend's atoms.ts)
- Bithumb caches native tick in module-level variable for synchronous `getSubscribeMessage()` — works but fragile if multiple instances exist
- Coinbase Advanced Trade WS is unauthenticated — may have rate limits or reduced data depth
- Consider adding `formatPrice` locale support (KRW comma formatting, etc.)
- Phase 2: integrate into `wts-frontend` as OrderbookWidget with `showHeader={false}`

## v0.5.0: `rawExchangeData` Prop (Breaking — replaces `availablePairs`)

**Purpose:** Allow host apps to pass raw REST responses directly. Adapters handle parsing internally via `parseRawAvailablePairs()`. Same pattern as `@gloomydumber/premium-table` v0.7.0's `rawResponses`.

**Interface (breaking change from v0.4.x):**
```typescript
interface RawExchangeData {
  rawResponses: Record<string, unknown>  // keyed by exchange ID
}
interface OrderbookProps {
  rawExchangeData?: RawExchangeData  // replaces availablePairs
}
```

**Behavior:**
- When `rawExchangeData.rawResponses[currentExchangeId]` exists: adapter's `parseRawAvailablePairs()` parses raw JSON locally. No REST call for that exchange.
- When the current exchange has no data in `rawResponses`: falls back to internal `fetchAvailablePairs()`.
- When `rawExchangeData` is omitted: fully standalone mode, no change from before.

**New adapter method — `parseRawAvailablePairs(data, quote): string[]`:**
Extracts parse logic from `fetchAvailablePairs`. Added to all 6 adapters. `fetchAvailablePairs` now delegates to `parseRawAvailablePairs` after fetch. Binance adapter handles both `exchangeInfo` and `ticker/price` formats.

**Files changed:**
- `src/exchanges/types.ts` — Added `parseRawAvailablePairs?` to `OrderbookAdapter` interface
- `src/exchanges/adapters/{upbit,bithumb,binance,bybit,okx,coinbase}.ts` — Added `parseRawAvailablePairs()`, refactored `fetchAvailablePairs` to delegate
- `src/components/Orderbook/Orderbook.tsx` — Replaced `availablePairs` with `rawExchangeData` prop, added `RawExchangeData` interface
- `src/components/Orderbook/index.ts` — Re-export `RawExchangeData` type
- `src/components/OrderbookView/OrderbookView.tsx` — Pass `rawExchangeData` through
- `src/hooks/useOrderbook.ts` — Accept `rawExchangeData` instead of `availablePairs`
- `src/hooks/useAvailablePairs.ts` — Rewritten: check `rawExchangeData` for current exchange first, fall back to internal fetch
- `src/lib.ts` — Export `RawExchangeData` type

---

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

---

## Session: 2026-02-25 — Virtualization + maxQty Fix (v0.2.0)

### What Was Done

Two performance optimizations to reduce per-tick work in the orderbook:

1. **maxQty power-of-2 quantization** — `maxQty` (used for depth bar normalization) now quantized to nearest power of 2 via `Math.pow(2, Math.ceil(Math.log2(rawMax)))`. Previously recalculated from raw values every render, changing on every WS tick and defeating `React.memo` on all 100 `OrderbookRow` components. Now only changes when the largest order magnitude doubles or halves (~every few seconds). Re-renders drop from ~100 to ~1-5 per tick.

2. **react-virtuoso** — Replaced manual `.map()` containers for asks and bids with `Virtuoso` instances. Only visible rows (~15-20) are rendered in DOM instead of all 100. Configuration: `fixedItemHeight={26}` (22px line + 4px padding), `overscan={150}`, `computeItemKey` by price. Asks use reversed array + `initialTopMostItemIndex` + `followOutput="auto"` (replaces CSS `column-reverse` which Virtuoso doesn't support).

**BREAKING:** `react-virtuoso` is now a required peer dependency.

### Files Changed

| File | Change |
|------|--------|
| `src/components/OrderbookDisplay/OrderbookDisplay.tsx` | maxQty quantization, Virtuoso for asks+bids, `useMemo` for reversed asks |
| `package.json` | react-virtuoso peer+dev dep, version 0.1.4 → 0.2.0 |
| `vite.config.ts` | react-virtuoso in rollup externals |
| `HANDOFF.md` | Updated design decisions, performance notes, session log |

---

## Session: 2026-02-25 — Drop Virtuoso, Fix Shrink Issue (v0.3.1)

### What Was Done

**Problem:** Virtuoso with `overflow: hidden` on the Scroller cannot detect when the container shrinks. DOM elements rendered during widget expand persist after shrink. The asks (sell) side worked by accident because `followOutput="auto"` forced recalculation, but the bids (buy) side retained stale DOM nodes.

**Root cause:** Virtuoso relies on its Scroller's scroll events and ResizeObserver for viewport detection. `overflow: hidden` on the Scroller prevents this. The `useContainerHeight` + explicit pixel height workaround from v0.3.0 also didn't fix it.

**Fix:** Dropped Virtuoso entirely. Reverted to simple `.map()` + `overflow: hidden` containers (the pre-v0.2.0 approach). The CSS `overflow: hidden` clips rows that don't fit naturally — no library needed.
- Asks: `column-reverse` container clips higher asks at the top, lowest asks near spread always visible
- Bids: normal container clips lower bids at the bottom, highest bids near spread always visible
- **maxQty power-of-2 quantization retained** — this was the highest-impact optimization (re-renders ~100/tick → ~1-5/tick)

**Why not fix Virtuoso instead?** For a non-scrollable list where the user explicitly doesn't want scroll interaction, Virtuoso is the wrong tool. Simple `.map()` + CSS clipping is simpler, more reliable, and has zero library overhead. The 100 DOM nodes (50 per side) are negligible since `React.memo` + quantized `maxQty` prevents most re-renders.

### Files Changed

| File | Change |
|------|--------|
| `src/components/OrderbookDisplay/OrderbookDisplay.tsx` | Reverted to `.map()` + `overflow: hidden`, removed Virtuoso/hooks |
| `package.json` | Removed react-virtuoso peer+dev dep, version 0.3.0 → 0.3.1 |
| `vite.config.ts` | Removed react-virtuoso from rollup externals |

---

## Session: 2026-02-25 — Fix Virtuoso Properly (v0.3.2)

### What Was Done

**Problem:** v0.3.1 dropped Virtuoso, so all 100 rows render in DOM even initially — no virtualization at all.

**Root cause of all previous failures:** The Scroller component had `overflow: hidden`. Virtuoso REQUIRES `overflow: auto` on its Scroller to detect viewport size changes. The `useContainerHeight` approach was correct but didn't help because `overflow: hidden` still killed viewport detection.

**Fix (v0.3.2):** Three-part approach that works:
1. **Scroller keeps `overflow: auto`** — Virtuoso's internal ResizeObserver/scroll detection works
2. **Scrollbar hidden via CSS** — `scrollbar-width: none` (Firefox), `::-webkit-scrollbar { display: none }` (Chrome/Safari), `msOverflowStyle: none` (Edge)
3. **Wheel events blocked** — `addEventListener('wheel', preventDefault, { passive: false })` on the Scroller DOM node
4. **Explicit pixel height** — `useContainerHeight` measures each section via ResizeObserver, passes exact pixel value to Virtuoso (not percentage)
5. **Conditional render** — `{height > 0 && <Virtuoso ...>}` prevents mounting before measurement

Asks side: reversed array + `initialTopMostItemIndex` + `followOutput` + `scrollToIndex` on height change to keep lowest asks near spread.

### Files Changed

| File | Change |
|------|--------|
| `OrderbookDisplay.tsx` | Full rewrite: `useContainerHeight`, `NoScrollScroller` (overflow:auto + hidden scrollbar + blocked wheel), conditional Virtuoso render |
| `lib-styles.css` | Added `.cob-no-scroll::-webkit-scrollbar { display: none }` |
| `package.json` | Re-added react-virtuoso peer+dev dep, version 0.3.1 → 0.3.2 |
| `vite.config.ts` | Re-added react-virtuoso to rollup externals |

---

## Session: 2026-02-26 — Binance Snapshot/Diff Sync + Crossed-Book Detection (v0.3.6)

### What Was Done

**Problem:** The lowest ask (sell-side) became stale after running for a while, producing a crossed orderbook (negative spread). Root cause: Binance adapter fetches a REST snapshot and receives WS diffs independently with no synchronization. Diffs that remove a level arrive before the snapshot is applied, so the stale level from the snapshot persists forever.

**Fix — three parts:**

1. **Binance snapshot/diff sequencing** — WS diffs are buffered (`snapshotSeqRef = null`) until the REST snapshot resolves. On resolution, the buffer is drained per Binance's official protocol: diffs with `lastUpdateId <= snapshot.lastUpdateId` are dropped, the first valid diff must have `firstUpdateId <= snapshot.lastUpdateId + 1`, and subsequent diffs are applied in order. `OrderbookUpdate` gained optional `firstUpdateId`/`lastUpdateId` fields. On REST failure, buffering exits gracefully so WS diffs still work.

2. **Crossed-book detection (universal safety net)** — In `flushOrderbook`, if `bestAsk < bestBid`, the side with fewer crossed entries is identified as the outlier side (stale levels) and pruned from the underlying Map, then `getSortedLevels` re-runs. Handles both stale asks (the known Binance bug) and hypothetical stale bids on any exchange.

3. **Edge padding self-perpetuation fix** — `prevTopAskRef`/`prevBottomBidRef` were updated AFTER padding, so the padded qty=0 entry became the tracked edge and was re-padded every flush forever. Fix: capture actual data edges BEFORE padding, then pad, then store actual edges for next frame. Padded entries are now single-frame placeholders that naturally expire.

4. **Reconnection re-sync** — `onOpen` detects reconnection (book has data + adapter has `fetchSnapshot`) and resets sync state (enters buffering mode, clears stale book, re-fetches snapshot via shared `fetchAndSyncSnapshot` function).

### Files Changed

| File | Change |
|------|--------|
| `src/types/orderbook.ts` | Added `firstUpdateId?`, `lastUpdateId?` to `OrderbookUpdate` |
| `src/exchanges/adapters/binance.ts` | Return `U`/`u` as sequence IDs from `parseMessage`, `lastUpdateId` from `fetchSnapshot` |
| `src/hooks/useOrderbook.ts` | Buffer/drain sync logic, crossed-book detection, edge padding fix, reconnection re-sync |
| `package.json` | Version bump 0.3.3 → 0.3.6 |

---

## Session: 2026-02-26 — Upbit/Bithumb Heartbeat (v0.3.7)

### What Was Done

**Problem:** Upbit and Bithumb WebSocket connections had no heartbeat/ping-pong. Both exchanges have a 120-second idle timeout — long-idle connections (e.g., waiting for a new listing) would be dropped silently.

**Fix:** Added `heartbeat: { message: 'PING', interval: 60_000 }` to both adapters. The existing `useWebSocket` hook already supports the `heartbeat` field — sends the message via `ws.send()` at the configured interval. Both exchanges accept a `"PING"` text message and respond with `{"status":"UP"}` every 10 seconds while connected.

Also added `{"status":"UP"}` filtering in `parseMessage` for both adapters to prevent heartbeat responses from being processed as orderbook data.

### Files Changed

| File | Change |
|------|--------|
| `src/exchanges/adapters/upbit.ts` | Added `heartbeat` config, filter `{"status":"UP"}` in `parseMessage` |
| `src/exchanges/adapters/bithumb.ts` | Added `heartbeat` config, filter `{"status":"UP"}` in `parseMessage` |
| `package.json` | Version 0.3.6 → 0.3.7 |

## Session: 2026-02-26 — Binance Sequence Gap Detection (v0.3.8)

### What Was Done

**Problem:** After 30+ minutes of continuous operation, the lowest ask (sell-side) price on Binance became stale again — the same symptom as the v0.3.6 fix, but a different root cause. The v0.3.6 snapshot/diff sync handled initial synchronization correctly, but **never validated sequence continuity on subsequent diffs**.

**Root cause:** Per Binance docs (steps 6-7), each diff's `U` (firstUpdateId) must equal the previous diff's `u` (lastUpdateId) + 1. If a sequence gap occurs (e.g., due to brief network glitch, browser throttling, or server-side consolidation), a missed diff that removes a price level means that level persists in the Map forever. The `lastSeqRef` existed but was never updated after initial sync, so gap detection was impossible.

**Fix:** Added sequence gap detection in `onMessage`:
- After initial sync, every incoming diff's `firstUpdateId` is compared against `lastSeqRef.current + 1`
- If `firstUpdateId > lastSeqRef.current + 1`, a gap is detected — re-enter buffering mode and re-fetch snapshot via `reconnectFetchRef`
- `lastSeqRef.current` is now updated on every applied diff (was previously only set during buffer drain)
- The current diff that triggered gap detection is pushed to the sync buffer so it's not lost

This implements Binance's official protocol steps 6-7, which were missing from the v0.3.6 fix.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useOrderbook.ts` | Added sequence gap detection in `onMessage`, track `lastSeqRef` on every diff |
| `package.json` | Version 0.3.7 → 0.3.8 |

---

## Session: 2026-02-27 — Widen Base Selector (v0.3.10)

### What Was Done

**Problem:** Long ticker names (e.g., "SAHARA") were truncated to "SAHA..." in the base asset Autocomplete dropdown due to `width: 100` being too narrow.

**Fix:** Increased `BaseSelector` Autocomplete width from 100 to 120.

### Files Changed

| File | Change |
|------|--------|
| `src/components/OrderbookToolbar/BaseSelector.tsx` | `width: 100` → `width: 120` |
| `package.json` | Version 0.3.9 → 0.3.10 |

---

## Session: 2026-02-25 — Drop Virtuoso, Array Slicing (v0.3.3)

### What Was Done

**Problem:** v0.3.2 rendered nothing — only headers and spread row visible. The `useContainerHeight` hook used `useRef` + `useEffect([], [])` which runs once on mount. On first render, the early return (loading state with `CircularProgress`) means the asks/bids container divs aren't in the DOM, so `ref.current` is `null` when the effect runs. Height stays 0 → `{height > 0 && <Virtuoso>}` never renders. When data loads and the early return is skipped, the effect doesn't re-run because deps are `[]`.

**Fix:** Two changes:
1. **Callback ref pattern** for `useContainerHeight` — `useCallback((node) => { if (node) observe(node); else cleanup(); }, [])`. Fires when the DOM element attaches/detaches, regardless of when that happens. No timing issues.
2. **Drop Virtuoso entirely, use array slicing** — `Math.floor(containerHeight / ROW_HEIGHT)` gives the exact number of visible rows. `orderbook.asks.slice(0, askCount)` and `.bids.slice(0, bidCount)` render only what fits. Simple `.map()` rendering. No scroll, no library overhead.
   - Asks: `column-reverse` container puts lowest asks (index 0) near spread
   - Bids: normal top-down, highest bids near spread
   - Widget resize immediately changes visible count (ResizeObserver fires → height updates → slice count changes)

**Why array slicing works well for now:** For a non-scrollable orderbook (rows revealed only by widget resize), array slicing gives exact DOM count control, zero library overhead, and correct shrink behavior by construction. The 50-row cap + `React.memo` + quantized `maxQty` already keep per-tick work minimal.

### Virtualization — Future Consideration

Array slicing is the current approach, but react-virtuoso remains an option if requirements change:

- **When to reconsider:** If depth increases beyond 50 per side (e.g., 200+ levels for deep-book analysis) and scrollable orderbook is desired, Virtuoso would avoid rendering all rows in DOM.
- **Known issue to handle:** Virtuoso v4's `visibleRange` directional filter doesn't detect container shrink (only expansion). This was solved in `premium-table` v0.5.12 with a two-part fix: (1) consumer-side ResizeObserver passing pixel height, (2) library-side debounced React key remount on shrink. The same approach would apply here. See `../wts-frontend-rgl-bench/results/VIRTUOSO_SHRINK_REPORT.md` for full details.
- **Asks display:** Virtuoso doesn't support `column-reverse`. Previous implementation (v0.2.0–v0.3.0) used reversed array + `initialTopMostItemIndex` + `followOutput="auto"`. This worked for expansion but not shrink.
- **Trade-off:** Orderbook WS ticks arrive every ~100ms — scrolling a fast-updating list is poor UX. But if scroll is needed (e.g., for analysis mode with paused updates), Virtuoso is the right tool.

### Files Changed

| File | Change |
|------|--------|
| `OrderbookDisplay.tsx` | Callback ref `useContainerHeight`, array slicing, `.map()` rendering, removed Virtuoso |
| `package.json` | Removed react-virtuoso peer+dev dep, version 0.3.2 → 0.3.3 |
| `vite.config.ts` | Removed react-virtuoso from rollup externals |

