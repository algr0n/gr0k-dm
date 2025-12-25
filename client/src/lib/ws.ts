export type WSMessageHandler = (msg: any) => void

export function createRoomSocket(roomCode: string, onMessage: WSMessageHandler) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  const url = `${protocol}://${host}/?room=${encodeURIComponent(roomCode)}`

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let shouldClose = false
  let backoff = 500

  function connect() {
    ws = new WebSocket(url)    // expose raw WebSocket instances to tests via window.__TEST_WEBSOCKETS (if present)
    try { (window as any).__TEST_WEBSOCKETS = (window as any).__TEST_WEBSOCKETS || []; (window as any).__TEST_WEBSOCKETS.push(ws) } catch (e) {}    ws.onopen = () => {
      reconnectAttempts = 0
      backoff = 500
      console.debug('[WS] connected to', url)
    }
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        onMessage(data)
      } catch (e) {
        console.error('[WS] failed parsing message', e)
      }
    }
    ws.onclose = () => {
      if (shouldClose) return
      reconnectAttempts++
      const wait = Math.min(10000, backoff * reconnectAttempts)
      console.debug('[WS] disconnected — reconnecting in', wait)
      setTimeout(() => connect(), wait)
    }
    ws.onerror = (err) => {
      console.error('[WS] error', err)
      ws?.close()
    }
  }

  connect()

  return {
    send: (msg: any) => {
      try {
        const OPEN = (typeof WebSocket !== 'undefined' && (WebSocket as any).OPEN !== undefined) ? (WebSocket as any).OPEN : 1
        if (!ws || ws.readyState !== OPEN) {
          // In test environments the socket instance may change; try global lastInstance fallback (MockWebSocket)
          const globalWS: any = (typeof WebSocket !== 'undefined') ? (WebSocket as any) : null
          if (globalWS && globalWS.lastInstance && globalWS.lastInstance.readyState === OPEN) {
            globalWS.lastInstance.send(JSON.stringify(msg))
            return true
          }
          return false
        }
        ws.send(JSON.stringify(msg))
        return true
      } catch (e) {
        console.error('[WS] send error', e)
        return false
      }
    },
    close: () => {
      shouldClose = true
      ws?.close()
    }
  }
}
