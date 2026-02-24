# Crypto Orderbook

Live orderbook component for 6 crypto exchanges. Standalone npm package `@gloomydumber/crypto-orderbook`.

## Build & Dev

- `npm run dev` — Vite dev server (standalone harness)
- `npm run build` — TypeScript compile + Vite build
- `npm run build:lib` — Library build (dist/index.js, dist/index.d.ts, dist/index.css)
- `npm run lint` — ESLint flat config
- `npm run preview` — Preview production build

## Architecture

- React + TypeScript + Vite + MUI 7 + Jotai
- Raw WebSocket API (no react-use-websocket dependency)
- 6 exchanges: Upbit, Bithumb, Binance, Bybit, OKX, Coinbase
- Adapter pattern: each exchange implements `OrderbookAdapter` interface
- Unified local orderbook: `Map<string, string>` (price → qty) for bids/asks
- Snapshot exchanges (Upbit, Bithumb, Binance): replace map on each message
- Delta exchanges (Bybit, OKX, Coinbase): merge deltas, remove qty="0"

## Performance

- OrderbookRow uses inline `style={}` (no Emotion in hot render path)
- Rows are memoized with `React.memo`

## Versioning

- Conventional Commits: `feat:` → MINOR, `fix:`/`perf:`/`refactor:` → PATCH
