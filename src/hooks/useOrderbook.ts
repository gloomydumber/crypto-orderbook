import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { exchangeIdAtom, quoteAtom, baseAtom, tickSizeAtom } from '../store/configAtoms'
import { orderbookAtom, connectionStatusAtom, lastUpdateAtom, tickOptionsAtom } from '../store/orderbookAtoms'
import { getAdapterById } from '../exchanges/registry'
import { useWebSocket } from './useWebSocket'
import { useAvailablePairs } from './useAvailablePairs'
import { createLocalBook, applyUpdate, getSortedLevels, getTickOptions } from '../utils/orderbook-manager'
import type { OrderbookData, OrderbookUpdate } from '../types'

const EMPTY_BOOK: OrderbookData = { bids: [], asks: [], midPrice: null, spread: null, spreadPercent: null }

// Module-level pause flag — skips RAF flushes during grid drag/resize.
// WS messages still write to localBook (O(1), no React). On resume, one catch-up flush applies all.
let paused = false
let pendingFlush: (() => void) | null = null

/**
 * Pause/resume React state flushes.
 * While paused, WS data still accumulates in the local book.
 * On resume, a single catch-up flush applies all pending changes.
 */
export function setUpdatesPaused(value: boolean) {
  paused = value
  if (!value && pendingFlush) {
    pendingFlush()
    pendingFlush = null
  }
}

export function useOrderbook() {
  const exchangeId = useAtomValue(exchangeIdAtom)
  const quote = useAtomValue(quoteAtom)
  const base = useAtomValue(baseAtom)
  const tickSize = useAtomValue(tickSizeAtom)

  const setOrderbook = useSetAtom(orderbookAtom)
  const setConnectionStatus = useSetAtom(connectionStatusAtom)
  const setLastUpdate = useSetAtom(lastUpdateAtom)
  const setTickOptions = useSetAtom(tickOptionsAtom)
  const setTickSize = useSetAtom(tickSizeAtom)

  // Fetch available pairs when exchange/quote changes
  useAvailablePairs()

  const adapter = useMemo(() => getAdapterById(exchangeId), [exchangeId])
  const localBookRef = useRef(createLocalBook())
  const tickSizeRef = useRef(tickSize)
  tickSizeRef.current = tickSize

  // Store setters in refs to avoid dependency chains
  const setOrderbookRef = useRef(setOrderbook)
  setOrderbookRef.current = setOrderbook
  const setLastUpdateRef = useRef(setLastUpdate)
  setLastUpdateRef.current = setLastUpdate
  const setConnectionStatusRef = useRef(setConnectionStatus)
  setConnectionStatusRef.current = setConnectionStatus
  const adapterRef = useRef(adapter)
  adapterRef.current = adapter
  const setTickOptionsRef = useRef(setTickOptions)
  setTickOptionsRef.current = setTickOptions
  const setTickSizeRef = useRef(setTickSize)
  setTickSizeRef.current = setTickSize

  // Server-side grouping state (Upbit/Bithumb)
  const serverLevelsRef = useRef<number[] | null>(null)
  const nativeTickRef = useRef(0)
  const prevFetchKeyRef = useRef('')

  // Compute server level: only non-zero when API has resolved (levels populated) and user picked a non-native level.
  // Using length > 0 prevents atomWithStorage hydration from changing serverLevel before the API resolves,
  // which would abort the in-flight fetchSupportedLevels call.
  const hasServerGrouping = serverLevelsRef.current !== null && serverLevelsRef.current.length > 0
  const serverLevel = hasServerGrouping
    ? (tickSize === 0 || tickSize === nativeTickRef.current ? 0 : tickSize)
    : 0

  // RAF-based throttle: only flush to atoms once per animation frame
  const rafRef = useRef<number | null>(null)
  const pendingUpdateRef = useRef(false)

  // Track outermost edge prices to show qty=0 placeholders when they vanish
  const prevTopAskRef = useRef<string | null>(null)   // highest ask price
  const prevBottomBidRef = useRef<string | null>(null) // lowest bid price

  // Binance snapshot/diff sequencing refs
  // snapshotSeqRef: null = sync pending (buffer diffs), number = synced (last applied snapshot seq)
  const snapshotSeqRef = useRef<number | null>(0)
  const syncBufferRef = useRef<OrderbookUpdate[]>([])
  const lastSeqRef = useRef<number>(0)
  const reconnectFetchRef = useRef<(() => void) | null>(null)

  const flushOrderbook = useCallback(() => {
    rafRef.current = null
    if (!pendingUpdateRef.current) return
    if (paused) {
      // Store reference to this flush so it runs on resume
      pendingFlush = flushOrderbook
      return
    }
    pendingUpdateRef.current = false

    // For server-grouped exchanges, data arrives pre-grouped — skip client-side grouping
    const clientTick = serverLevelsRef.current !== null ? 0 : tickSizeRef.current
    // Cap rendered rows — the flex container clips overflow anyway.
    // Prevents sorting+rendering 1000+ DOM nodes for deep books (Binance/Coinbase).
    let { bids, asks } = getSortedLevels(localBookRef.current, 50, clientTick)

    // --- Crossed-book detection (universal safety net) ---
    // If bestAsk < bestBid, the book is corrupted — prune outlier side from the Map.
    if (bids.length > 0 && asks.length > 0) {
      const bestBidPrice = parseFloat(bids[0].price)
      const bestAskPrice = parseFloat(asks[0].price)
      if (bestAskPrice < bestBidPrice) {
        // Count which side has fewer crossed entries (those are the outliers)
        const staleAsks = asks.filter(a => parseFloat(a.price) < bestBidPrice).length
        const staleBids = bids.filter(b => parseFloat(b.price) > bestAskPrice).length

        if (staleAsks <= staleBids) {
          // Fewer stale asks → remove ask entries below bestBid from the Map
          for (const a of asks) {
            if (parseFloat(a.price) < bestBidPrice) {
              localBookRef.current.asks.delete(a.price)
            }
          }
        } else {
          // Fewer stale bids → remove bid entries above bestAsk from the Map
          for (const b of bids) {
            if (parseFloat(b.price) > bestAskPrice) {
              localBookRef.current.bids.delete(b.price)
            }
          }
        }
        // Re-sort after pruning
        ;({ bids, asks } = getSortedLevels(localBookRef.current, 50, clientTick))
      }
    }

    // Update tracked edges BEFORE padding — capture actual data edges so padded
    // entries don't self-perpetuate (padded entries are single-frame placeholders).
    const actualTopAsk = asks.length > 0 ? asks[asks.length - 1].price : null
    const actualBottomBid = bids.length > 0 ? bids[bids.length - 1].price : null

    // Pad vanished edge levels with qty=0 to prevent visual shrinking.
    // Asks are sorted ascending — last element is the highest (outermost) ask.
    if (asks.length > 0 && prevTopAskRef.current) {
      const prevPrice = parseFloat(prevTopAskRef.current)
      const currentTop = parseFloat(asks[asks.length - 1].price)
      if (prevPrice > currentTop && !asks.some(a => a.price === prevTopAskRef.current)) {
        asks.push({ price: prevTopAskRef.current, qty: '0', total: asks[asks.length - 1].total })
      }
    }
    // Bids are sorted descending — last element is the lowest (outermost) bid.
    if (bids.length > 0 && prevBottomBidRef.current) {
      const prevPrice = parseFloat(prevBottomBidRef.current)
      const currentBottom = parseFloat(bids[bids.length - 1].price)
      if (prevPrice < currentBottom && !bids.some(b => b.price === prevBottomBidRef.current)) {
        bids.push({ price: prevBottomBidRef.current, qty: '0', total: bids[bids.length - 1].total })
      }
    }

    // Store actual data edges (not padded) for next frame's comparison
    prevTopAskRef.current = actualTopAsk
    prevBottomBidRef.current = actualBottomBid

    let midPrice: string | null = null
    let spread: string | null = null
    let spreadPercent: string | null = null

    if (bids.length > 0 && asks.length > 0) {
      const bestBid = parseFloat(bids[0].price)
      const bestAsk = parseFloat(asks[0].price)
      const mid = (bestBid + bestAsk) / 2
      const sp = bestAsk - bestBid

      midPrice = mid.toString()
      spread = sp.toString()
      spreadPercent = bestBid > 0 ? ((sp / mid) * 100).toFixed(4) : null
    }

    const orderbookData: OrderbookData = { bids, asks, midPrice, spread, spreadPercent }
    setOrderbookRef.current(orderbookData)
    setLastUpdateRef.current(Date.now())
  }, [])

  const onMessage = useCallback(async (data: string | Blob) => {
    const currentAdapter = adapterRef.current
    if (!currentAdapter) return

    const update = await currentAdapter.parseMessage(data)
    if (!update) return

    // Binance snapshot/diff sync: buffer diffs until snapshot is applied
    if (snapshotSeqRef.current === null && update.type === 'delta') {
      syncBufferRef.current.push(update)
      return
    }

    // Sequence gap detection (Binance docs steps 6-7):
    // Each diff's U must equal the previous diff's u + 1.
    // If a gap is found, diffs were lost — re-sync from a fresh snapshot.
    if (
      update.type === 'delta' &&
      update.firstUpdateId != null &&
      lastSeqRef.current > 0 &&
      update.firstUpdateId > lastSeqRef.current + 1
    ) {
      snapshotSeqRef.current = null
      syncBufferRef.current = [update]
      reconnectFetchRef.current?.()
      return
    }

    // Track last applied sequence for gap detection
    if (update.lastUpdateId != null) {
      lastSeqRef.current = update.lastUpdateId
    }

    applyUpdate(localBookRef.current, update)

    // Throttle: schedule one flush per animation frame
    pendingUpdateRef.current = true
    if (!paused && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushOrderbook)
    }
  }, [flushOrderbook])

  const onOpen = useCallback(() => {
    setConnectionStatusRef.current('connected')
    // Detect reconnection: if localBook has data and adapter uses fetchSnapshot,
    // the book may be stale — reset sync state and re-fetch snapshot.
    const currentAdapter = adapterRef.current
    const book = localBookRef.current
    const isReconnect = (book.bids.size > 0 || book.asks.size > 0) && currentAdapter?.fetchSnapshot
    if (isReconnect) {
      // Enter buffering mode, clear stale book
      snapshotSeqRef.current = null
      syncBufferRef.current = []
      localBookRef.current = createLocalBook()
      prevTopAskRef.current = null
      prevBottomBidRef.current = null
      // Re-fetch snapshot (uses reconnectFetchRef set up in effect)
      reconnectFetchRef.current?.()
    }
  }, [])

  const onClose = useCallback(() => {
    setConnectionStatusRef.current('disconnected')
  }, [])

  const onError = useCallback(() => {
    setConnectionStatusRef.current('error')
  }, [])

  const pair = useMemo(() => ({ base, quote }), [base, quote])

  const url = useMemo(() => {
    if (!adapter) return null
    return adapter.getWebSocketUrl(pair)
  }, [adapter, pair])

  const subscribeMessage = useMemo(() => {
    if (!adapter?.getSubscribeMessage) return null
    const level = serverLevel > 0 ? serverLevel : undefined
    const msg = adapter.getSubscribeMessage(pair, level)
    if (msg == null) return null
    return typeof msg === 'string' ? msg : JSON.stringify(msg)
  }, [adapter, pair, serverLevel])

  const unsubscribeMessage = useMemo(() => {
    if (!adapter?.getUnsubscribeMessage) return null
    const level = serverLevel > 0 ? serverLevel : undefined
    const msg = adapter.getUnsubscribeMessage(pair, level)
    if (msg == null) return null
    return typeof msg === 'string' ? msg : JSON.stringify(msg)
  }, [adapter, pair, serverLevel])

  const heartbeat = adapter?.heartbeat

  const { connect, disconnect } = useWebSocket({
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    subscribeMessage,
    unsubscribeMessage,
    heartbeat,
  })

  // Helper: set tick options and auto-select native tick if current selection is invalid
  const applyTickOptions = useCallback((options: number[], nativeTick: number) => {
    const deduped = [...new Set(options)]
    setTickOptionsRef.current(deduped)
    if (!deduped.includes(tickSizeRef.current) || tickSizeRef.current === 0) {
      setTickSizeRef.current(nativeTick)
    }
  }, [])

  // Connect/disconnect when adapter/pair changes OR when server level changes (reconnection needed)
  useEffect(() => {
    if (!adapter || !base || !quote) return

    const abortController = new AbortController()

    // Detect pair/exchange change vs level-only change
    const fetchKey = `${adapter.id}:${base}:${quote}`
    const isPairChange = fetchKey !== prevFetchKeyRef.current
    prevFetchKeyRef.current = fetchKey

    if (isPairChange) {
      // Full reset: clear server grouping state, tick options, etc.
      // For adapters with server-side grouping, use [] (not null) to block
      // client-side tick options until the API resolves.
      serverLevelsRef.current = adapter.fetchSupportedLevels ? [] : null
      nativeTickRef.current = 0
      setTickSizeRef.current(0)
    }

    // Always reset book on any reconnection
    localBookRef.current = createLocalBook()
    prevTopAskRef.current = null
    prevBottomBidRef.current = null
    setOrderbookRef.current(EMPTY_BOOK)
    setConnectionStatusRef.current('connecting')

    connect()

    // Fetch server-side grouping levels when needed:
    // - isPairChange: new pair selected
    // - serverLevelsRef is [] (pending): previous fetch was aborted (e.g. StrictMode remount)
    const needsLevelFetch = adapter.fetchSupportedLevels &&
      serverLevelsRef.current !== null && serverLevelsRef.current.length === 0

    if (needsLevelFetch) {
      const fetchWithRetry = async () => {
        const attempt = () => adapter.fetchSupportedLevels!({ base, quote }, abortController.signal)
        try {
          return await attempt()
        } catch {
          if (abortController.signal.aborted) return null
          // Retry once after 2s delay
          await new Promise(r => setTimeout(r, 2000))
          if (abortController.signal.aborted) return null
          return attempt()
        }
      }
      fetchWithRetry()
        .then(result => {
          if (!result || abortController.signal.aborted) return
          const { nativeTick, levels } = result
          serverLevelsRef.current = levels
          nativeTickRef.current = nativeTick
          applyTickOptions([nativeTick, ...levels], nativeTick)
        })
        .catch(() => {
          if (abortController.signal.aborted) return
          // Final failure: fall back to client-side tick options
          serverLevelsRef.current = null
        })
    }

    // Fetch native tick + price for client-side grouped exchanges (Binance, Bybit, OKX, Coinbase)
    if (isPairChange && !adapter.fetchSupportedLevels && adapter.fetchNativeTick) {
      adapter.fetchNativeTick({ base, quote }, abortController.signal)
        .then(({ nativeTick, price }) => {
          if (abortController.signal.aborted) return
          nativeTickRef.current = nativeTick
          // Compute tick options from price magnitude, filtered by native tick
          const candidates = getTickOptions(price, quote)
          const options = nativeTick > 0
            ? candidates.filter(t => t >= nativeTick)
            : candidates
          if (options.length > 0) {
            applyTickOptions(options, options[0])
          }
        })
        .catch(() => { /* ignore — tick selector stays hidden until resolved */ })
    }

    // Shared snapshot fetch + drain logic for initial connect and reconnection
    const fetchAndSyncSnapshot = () => {
      if (!adapter.fetchSnapshot) return
      adapter.fetchSnapshot({ base, quote }, abortController.signal)
        .then(snapshot => {
          if (!snapshot || abortController.signal.aborted) return
          const snapshotLastId = snapshot.lastUpdateId ?? 0

          // Apply snapshot to local book
          applyUpdate(localBookRef.current, snapshot)

          // Drain buffered diffs
          const buffer = syncBufferRef.current
          syncBufferRef.current = []
          let lastAppliedSeq = 0

          if (snapshotLastId > 0) {
            for (const diff of buffer) {
              // Drop events fully before snapshot
              if (diff.lastUpdateId != null && diff.lastUpdateId <= snapshotLastId) continue
              // First valid event must overlap snapshot seq
              if (diff.firstUpdateId != null && diff.firstUpdateId > snapshotLastId + 1) {
                // Gap detected — diffs missed, but snapshot is still better than nothing
                break
              }
              applyUpdate(localBookRef.current, diff)
              if (diff.lastUpdateId != null) lastAppliedSeq = diff.lastUpdateId
            }
          } else {
            // Non-sequenced snapshot (other exchanges) — apply all buffered
            for (const diff of buffer) {
              applyUpdate(localBookRef.current, diff)
            }
          }

          // Mark as synced — future diffs apply directly
          snapshotSeqRef.current = snapshotLastId
          lastSeqRef.current = lastAppliedSeq || snapshotLastId

          pendingUpdateRef.current = true
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flushOrderbook)
          }
        })
        .catch(() => {
          // REST failed — exit buffering so WS diffs can still work
          snapshotSeqRef.current = 0
          const buffer = syncBufferRef.current
          syncBufferRef.current = []
          for (const diff of buffer) {
            applyUpdate(localBookRef.current, diff)
          }
          pendingUpdateRef.current = true
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flushOrderbook)
          }
        })
    }

    // Store ref for reconnection re-fetch
    reconnectFetchRef.current = fetchAndSyncSnapshot

    // Fetch deep REST snapshot on pair change (e.g. Binance limit=1000)
    if (isPairChange && adapter.fetchSnapshot) {
      // Enter buffering mode: diffs are held until snapshot resolves
      snapshotSeqRef.current = null
      syncBufferRef.current = []
      fetchAndSyncSnapshot()
    }

    return () => {
      abortController.abort()
      disconnect()
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, base, quote, serverLevel])
}
