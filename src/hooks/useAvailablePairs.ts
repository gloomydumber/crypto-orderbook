import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { exchangeIdAtom, quoteAtom, baseAtom } from '../store/configAtoms'
import { availablePairsAtom } from '../store/orderbookAtoms'
import { getAdapterById } from '../exchanges/registry'

interface RawExchangeData {
  rawResponses: Record<string, unknown>
}

export function useAvailablePairs(rawExchangeData?: RawExchangeData) {
  const exchangeId = useAtomValue(exchangeIdAtom)
  const quote = useAtomValue(quoteAtom)
  const [, setAvailablePairs] = useAtom(availablePairsAtom)
  const [base, setBase] = useAtom(baseAtom)
  const didParseRef = useRef(false)

  // Apply parsed pairs and reset base if needed
  const applyPairs = (pairs: string[]) => {
    const sorted = pairs.sort()
    setAvailablePairs(sorted)
    if (sorted.length > 0 && !sorted.includes(base)) {
      const btc = sorted.find(p => p === 'BTC')
      setBase(btc ?? sorted[0])
    }
  }

  // Use host-provided raw data if available for the current exchange
  useEffect(() => {
    if (!rawExchangeData) return
    const raw = rawExchangeData.rawResponses[exchangeId]
    if (!raw) return

    const adapter = getAdapterById(exchangeId)
    if (!adapter?.parseRawAvailablePairs) return

    didParseRef.current = true
    const pairs = adapter.parseRawAvailablePairs(raw, quote)
    applyPairs(pairs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawExchangeData, exchangeId, quote])

  // Internal fetch — only when no raw data available for this exchange
  useEffect(() => {
    if (didParseRef.current) return
    if (rawExchangeData?.rawResponses[exchangeId]) return

    const adapter = getAdapterById(exchangeId)
    if (!adapter) return

    const controller = new AbortController()

    adapter.fetchAvailablePairs(quote, controller.signal)
      .then(pairs => {
        if (controller.signal.aborted) return
        applyPairs(pairs)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailablePairs([])
        }
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawExchangeData, exchangeId, quote])
}
