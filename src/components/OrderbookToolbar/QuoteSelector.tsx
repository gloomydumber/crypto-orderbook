import { Select, MenuItem } from '@mui/material'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { exchangeIdAtom, quoteAtom, baseAtom } from '../../store/configAtoms'
import { EXCHANGES } from '../../types'

export function QuoteSelector() {
  const exchangeId = useAtomValue(exchangeIdAtom)
  const [quote, setQuote] = useAtom(quoteAtom)
  const setBase = useSetAtom(baseAtom)

  const exchange = EXCHANGES.find(ex => ex.id === exchangeId)
  const quoteCurrencies = exchange?.quoteCurrencies ?? []

  // If current quote not in available list, it will be reset by ExchangeSelector
  const displayQuote = quoteCurrencies.includes(quote) ? quote : (quoteCurrencies[0] ?? '')

  return (
    <Select
      value={displayQuote}
      onChange={(e) => {
        setQuote(e.target.value)
        setBase('BTC')
      }}
      size="small"
      variant="outlined"
      sx={{
        minWidth: 70,
        '& .MuiSelect-select': { py: '2px', px: 1 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
      }}
    >
      {quoteCurrencies.map(q => (
        <MenuItem key={q} value={q}>{q}</MenuItem>
      ))}
    </Select>
  )
}
