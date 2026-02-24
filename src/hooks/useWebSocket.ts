import { useRef, useCallback, useEffect } from 'react'

interface UseWebSocketOptions {
  url: string | null
  onMessage: (data: string | Blob) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: () => void
  subscribeMessage?: string | null
  unsubscribeMessage?: string | null
  heartbeat?: { message: string | (() => string); interval: number }
}

const MAX_RECONNECT = 10
const RECONNECT_INTERVAL = 3000

export function useWebSocket(options: UseWebSocketOptions) {
  // Store all options in refs so callbacks never go stale
  const optionsRef = useRef(options)
  optionsRef.current = options

  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)
  const closedIntentionallyRef = useRef(false)

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    closedIntentionallyRef.current = true
    clearHeartbeat()
    clearReconnect()
    const ws = wsRef.current
    if (ws) {
      // Remove handlers to prevent onclose from firing reconnect
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      const unsub = optionsRef.current.unsubscribeMessage
      if (unsub && ws.readyState === WebSocket.OPEN) {
        ws.send(unsub)
      }
      ws.close()
      wsRef.current = null
    }
  }, [clearHeartbeat, clearReconnect])

  const connect = useCallback(() => {
    const { url, subscribeMessage, heartbeat } = optionsRef.current
    if (!url) return

    // Clean up any existing connection
    cleanup()
    closedIntentionallyRef.current = false
    reconnectCountRef.current = 0

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectCountRef.current = 0
      optionsRef.current.onOpen?.()

      if (subscribeMessage) {
        ws.send(subscribeMessage)
      }

      if (heartbeat) {
        clearHeartbeat()
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const msg = typeof heartbeat.message === 'function' ? heartbeat.message() : heartbeat.message
            ws.send(msg)
          }
        }, heartbeat.interval)
      }
    }

    ws.onmessage = (event) => {
      optionsRef.current.onMessage(event.data as string | Blob)
    }

    ws.onclose = () => {
      clearHeartbeat()
      optionsRef.current.onClose?.()

      if (!closedIntentionallyRef.current && reconnectCountRef.current < MAX_RECONNECT) {
        reconnectCountRef.current++
        clearReconnect()
        reconnectRef.current = setTimeout(() => {
          // Re-read current options for reconnect
          const { url: currentUrl, subscribeMessage: currentSub, heartbeat: currentHb } = optionsRef.current
          if (!currentUrl) return

          closedIntentionallyRef.current = false
          const newWs = new WebSocket(currentUrl)
          wsRef.current = newWs

          newWs.onopen = () => {
            reconnectCountRef.current = 0
            optionsRef.current.onOpen?.()
            if (currentSub) newWs.send(currentSub)
            if (currentHb) {
              clearHeartbeat()
              heartbeatRef.current = setInterval(() => {
                if (newWs.readyState === WebSocket.OPEN) {
                  const msg = typeof currentHb.message === 'function' ? currentHb.message() : currentHb.message
                  newWs.send(msg)
                }
              }, currentHb.interval)
            }
          }
          newWs.onmessage = (event) => {
            optionsRef.current.onMessage(event.data as string | Blob)
          }
          newWs.onclose = ws.onclose
          newWs.onerror = () => { optionsRef.current.onError?.() }
        }, RECONNECT_INTERVAL)
      }
    }

    ws.onerror = () => {
      optionsRef.current.onError?.()
    }
  }, [cleanup, clearHeartbeat, clearReconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup() }
  }, [cleanup])

  return { connect, disconnect: cleanup }
}
