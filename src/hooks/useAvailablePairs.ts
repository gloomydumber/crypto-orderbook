import { useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { exchangeIdAtom, quoteAtom, baseAtom } from '../store/configAtoms'
import { availablePairsAtom } from '../store/orderbookAtoms'
import { getAdapterById } from '../exchanges/registry'

export function useAvailablePairs() {
  const exchangeId = useAtomValue(exchangeIdAtom)
  const quote = useAtomValue(quoteAtom)
  const [, setAvailablePairs] = useAtom(availablePairsAtom)
  const [base, setBase] = useAtom(baseAtom)

  useEffect(() => {
    const adapter = getAdapterById(exchangeId)
    if (!adapter) return

    const controller = new AbortController()

    adapter.fetchAvailablePairs(quote, controller.signal)
      .then(pairs => {
        if (controller.signal.aborted) return
        const sorted = pairs.sort()
        setAvailablePairs(sorted)

        // If current base not in available pairs, reset to first (typically BTC)
        if (sorted.length > 0 && !sorted.includes(base)) {
          // Prefer BTC if available
          const btc = sorted.find(p => p === 'BTC')
          setBase(btc ?? sorted[0])
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailablePairs([])
        }
      })

    return () => controller.abort()
  }, [exchangeId, quote, base, setAvailablePairs, setBase])
}
