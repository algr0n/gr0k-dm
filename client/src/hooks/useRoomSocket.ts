import { useEffect, useRef, useState } from 'react'
import { createRoomSocket, WSMessageHandler } from '../lib/ws'

export function useRoomSocket(roomCode: string | null, onMessage?: WSMessageHandler) {
  const socketRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const h: WSMessageHandler = (m) => {
      onMessage?.(m)
    }
    const client = createRoomSocket(roomCode, h)
    socketRef.current = client
    // We don't have an explicit connected callback in createRoomSocket; assume connection will be attempted
    setConnected(true)

    return () => {
      try { client.close() } catch (e) {}
      socketRef.current = null
      setConnected(false)
    }
  }, [roomCode, onMessage])

  return {
    send: (m: any) => socketRef.current?.send(m),
    connected
  }
}
