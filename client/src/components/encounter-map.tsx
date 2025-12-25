import React from 'react'

export interface Token { id: string; x: number; y: number; metadata?: any }
export interface Feature { id: string; type: string; x: number; y: number; radius?: number; properties?: any }

export type Encounter = {
  id?: string
  mapMeta?: { width: number; height: number; gridSize?: number }
  tokens?: Token[]
  features?: Feature[]
}

export interface EncounterMapProps {
  encounter: Encounter
  onSelectToken?: (token: Token) => void
  activeId?: string
  /** Called when user clicks one token (actor) then clicks another token (target) */
  onAttack?: (actorId: string, targetId: string) => void
  /** Called when user drags a token to a destination */
  onMove?: (actorId: string, to: { x: number; y: number }) => void
}

export const EncounterMap: React.FC<EncounterMapProps> = ({ encounter, onSelectToken, activeId, onAttack, onMove }) => {
  const width = encounter.mapMeta?.width ?? 20
  const height = encounter.mapMeta?.height ?? 12
  const gridSize = encounter.mapMeta?.gridSize ?? 40

  const viewWidth = width * gridSize
  const viewHeight = height * gridSize

  const [selectedActor, setSelectedActor] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState<{ id: string; startX: number; startY: number } | null>(null)
  const [ghost, setGhost] = React.useState<{ x: number; y: number } | null>(null)

  // convert pixel coords into grid coords
  function pixelToGrid(px: number, py: number) {
    return { x: Math.max(0, Math.min(width - 1, Math.round(px / gridSize))), y: Math.max(0, Math.min(height - 1, Math.round(py / gridSize))) }
  }

  // handlers for drag
  function handleMouseDownToken(e: React.MouseEvent, token: Token) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedActor(token.id)
    setDragging({ id: token.id, startX: e.clientX, startY: e.clientY })
    setGhost({ x: token.x, y: token.y })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    // compute mouse position relative to svg
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const grid = pixelToGrid(px, py)
    setGhost(grid)
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!dragging) return
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const grid = pixelToGrid(px, py)
    const actorId = dragging.id
    setDragging(null)
    setGhost(null)
    if (onMove) onMove(actorId, grid)
  }

  function handleClickToken(t: Token, e?: React.MouseEvent) {
    // if there is already a selected actor and it's different, interpret as attack
    const actor = selectedActor ?? activeId ?? null
    if (actor && actor !== t.id) {
      // attack
      onAttack?.(actor, t.id)
      setSelectedActor(null)
      return
    }

    // otherwise, select this token
    setSelectedActor(t.id)
    onSelectToken?.(t)
  }

  return (
    <div className="rounded border bg-gray-50 p-2">
      <svg width={viewWidth} height={viewHeight} role="img" aria-label="Encounter map" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        {/* grid */}
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#eee" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={viewWidth} height={viewHeight} fill="url(#grid)" />

        {/* features */}
        {encounter.features?.map(f => (
          <g key={f.id} transform={`translate(${f.x * gridSize}, ${f.y * gridSize})`}>
            <circle r={(f.radius ?? 0) * gridSize} cx={0} cy={0} fill="rgba(64, 120, 58, 0.25)" stroke="#2f855a" />
            <text x={4} y={-6} fontSize={12} fill="#2f855a">{f.type}</text>
          </g>
        ))}

        {/* tokens */}
        {encounter.tokens?.map(t => {
          const isSelected = selectedActor === t.id || (!selectedActor && activeId === t.id)
          return (
            <g key={t.id} transform={`translate(${t.x * gridSize}, ${t.y * gridSize})`}>
              <circle r={gridSize * 0.4} cx={0} cy={0} fill="#f6ad55" stroke={isSelected ? '#2b6cb0' : '#dd6b20'} onMouseDown={(e)=> handleMouseDownToken(e, t)} onClick={(e)=> handleClickToken(t, e)} style={{ cursor: 'pointer' }} />
              <text x={-gridSize * 0.35} y={gridSize * 0.6} fontSize={12} fill="#222">{t.metadata?.name ?? t.id}</text>
            </g>
          )
        })}

        {/* ghost preview when dragging */}
        {ghost && (
          <g transform={`translate(${ghost.x * gridSize}, ${ghost.y * gridSize})`} pointerEvents="none">
            <rect x={-gridSize/2} y={-gridSize/2} width={gridSize} height={gridSize} fill="rgba(66,153,225,0.15)" stroke="#4299e1" />
          </g>
        )}
      </svg>
    </div>
  )
}

export default EncounterMap
