import React from 'react'

export interface LogEntry { id: string; actorId?: string; text: string; timestamp?: number }

export const CombatLog: React.FC<{ entries: LogEntry[] }> = ({ entries }) => {
  return (
    <div className="rounded border bg-white p-2 max-h-64 overflow-auto">
      <h3 className="text-sm font-semibold mb-2">Combat Log</h3>
      <ul className="space-y-2 text-sm">
        {entries.map(e => (
          <li key={e.id} className="text-gray-700">{new Date(e.timestamp ?? Date.now()).toLocaleTimeString()} — {e.text}</li>
        ))}
      </ul>
    </div>
  )
}

export default CombatLog
