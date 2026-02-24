import { Select, MenuItem } from '@mui/material'
import { useAtom, useSetAtom } from 'jotai'
import { exchangeIdAtom, quoteAtom, baseAtom } from '../../store/configAtoms'
import { EXCHANGES } from '../../types'

export function ExchangeSelector() {
  const [exchangeId, setExchangeId] = useAtom(exchangeIdAtom)
  const setQuote = useSetAtom(quoteAtom)
  const setBase = useSetAtom(baseAtom)

  return (
    <Select
      value={exchangeId}
      onChange={(e) => {
        const newId = e.target.value
        setExchangeId(newId)
        // Reset quote to first available for new exchange
        const exchange = EXCHANGES.find(ex => ex.id === newId)
        if (exchange) {
          setQuote(exchange.quoteCurrencies[0])
          setBase('BTC')
        }
      }}
      size="small"
      variant="outlined"
      sx={{
        minWidth: 90,
        fontSize: '0.75rem',
        '& .MuiSelect-select': { py: '2px', px: 1 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
      }}
    >
      {EXCHANGES.map(ex => (
        <MenuItem key={ex.id} value={ex.id} sx={{ fontSize: '0.75rem' }}>{ex.name}</MenuItem>
      ))}
    </Select>
  )
}
