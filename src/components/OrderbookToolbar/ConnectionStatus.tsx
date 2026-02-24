import { Tooltip } from '@mui/material'
import { useAtomValue } from 'jotai'
import { connectionStatusAtom } from '../../store/orderbookAtoms'

const STATUS_COLORS: Record<string, string> = {
  connected: '#00c853',
  connecting: '#ff9800',
  disconnected: '#f44336',
  error: '#f44336',
}

export function ConnectionStatus() {
  const status = useAtomValue(connectionStatusAtom)

  return (
    <Tooltip title={status} placement="bottom">
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status] ?? '#f44336',
        flexShrink: 0,
      }} />
    </Tooltip>
  )
}
