import { Select, MenuItem } from '@mui/material'
import { useAtom, useAtomValue } from 'jotai'
import { tickSizeAtom } from '../../store/configAtoms'
import { tickOptionsAtom } from '../../store/orderbookAtoms'

export function TickSelector() {
  const [tick, setTick] = useAtom(tickSizeAtom)
  const options = useAtomValue(tickOptionsAtom)

  if (options.length === 0) return null

  return (
    <Select
      value={options.includes(tick) ? tick : options[0]}
      onChange={(e) => setTick(Number(e.target.value))}
      size="small"
      variant="outlined"
      sx={{
        minWidth: 70,
        '& .MuiSelect-select': { py: '2px', px: 1 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
      }}
    >
      {options.map(v => (
        <MenuItem key={v} value={v}>{v}</MenuItem>
      ))}
    </Select>
  )
}
