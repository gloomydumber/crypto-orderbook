import { Autocomplete, TextField } from '@mui/material'
import { useAtom, useAtomValue } from 'jotai'
import { baseAtom } from '../../store/configAtoms'
import { availablePairsAtom } from '../../store/orderbookAtoms'

export function BaseSelector() {
  const [base, setBase] = useAtom(baseAtom)
  const availablePairs = useAtomValue(availablePairsAtom)

  const displayBase = availablePairs.includes(base) ? base : (availablePairs[0] ?? base)

  return (
    <Autocomplete
      value={displayBase}
      onChange={(_, v) => { if (v) setBase(v) }}
      options={availablePairs}
      size="small"
      disableClearable
      autoHighlight
      openOnFocus
      noOptionsText={<span style={{ fontSize: '0.7rem' }}>No options</span>}
      slotProps={{
        listbox: { style: { maxHeight: 300, fontSize: '0.75rem' } },
        popper: { style: { minWidth: 100 } },
      }}
      sx={{ width: 100 }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': { py: 0, px: 0.5, fontSize: '0.75rem' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
          }}
        />
      )}
    />
  )
}
