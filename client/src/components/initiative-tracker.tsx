import React from 'react'

export interface InitiativeItem {
  id: string
  name: string
  controller: 'player' | 'monster' | 'dm'
  initiative: number
  currentHp?: number
  maxHp?: number
  held?: boolean
}

export interface InitiativeTrackerProps {
  items: InitiativeItem[]
  activeId?: string
  onHold?: (id: string) => void
  onPass?: (id: string) => void
}

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({ items, activeId, onHold, onPass }) => {
  return (
    <div className="rounded border bg-white p-2">
      <h3 className="text-sm font-semibold mb-2">Initiative</h3>
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.id} className={`flex items-center justify-between p-2 rounded ${it.id === activeId ? 'bg-blue-50' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500">{it.initiative}</div>
              <div className="font-medium">{it.name}</div>
              <div className="text-xs text-gray-500">{it.currentHp ?? 0}/{it.maxHp ?? 0}</div>
            </div>
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 bg-gray-100 rounded" onClick={() => onHold?.(it.id)}>Hold</button>
              <button className="text-xs px-2 py-1 bg-gray-100 rounded" onClick={() => onPass?.(it.id)}>Pass</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default InitiativeTracker
