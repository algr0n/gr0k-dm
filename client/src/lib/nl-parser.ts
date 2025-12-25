export interface ParsedAction {
  actorId?: string
  type: 'move' | 'attack' | 'loot' | 'open' | 'search' | 'pass' | 'hold' | 'unknown'
  targetName?: string
  to?: { x: number; y: number }
  confidence: number
}

const moveRegex = /\b(?:walk|go|run|move)\b(?: to)?\s*(?:the )?([a-z0-9\- ]+)?/i
const lootRegex = /\b(?:loot|take|grab|pick up|steal)\b(?: the )?([a-z0-9\- ]+)?/i
const attackRegex = /\b(?:attack|hit|strike|stab|shoot)\b(?: the )?([a-z0-9\- ]+)?/i
const passRegex = /\b(?:wait|pass|end my turn|skip)\b/i
const openRegex = /\b(?:open|unlock)\b(?: the )?([a-z0-9\- ]+)?/i
const searchRegex = /\b(?:search|look|inspect|examine)\b(?: the )?([a-z0-9\- ]+)?/i
const holdRegex = /\b(?:hold|delay|ready)\b(?: until)?\s*(?:after|until)?\s*(?:([a-z0-9\- ]+))?/i

export function parseNaturalLanguageToAction(text: string, actorId?: string): ParsedAction | null {
  const normalized = text.trim()
  if (!normalized) return null

  // Pass
  if (passRegex.test(normalized)) {
    return { type: 'pass', confidence: 0.95, actorId }
  }

  // Attack
  const attackMatch = normalized.match(attackRegex)
  if (attackMatch) {
    const targetName = attackMatch[1] ? attackMatch[1].trim() : undefined
    return { type: 'attack', targetName, confidence: 0.85, actorId }
  }

  // Loot / Take
  const lootMatch = normalized.match(lootRegex)
  if (lootMatch) {
    const targetName = lootMatch[1] ? lootMatch[1].trim() : undefined
    return { type: 'loot', targetName, confidence: 0.9, actorId }
  }

  // Open
  const openMatch = normalized.match(openRegex)
  if (openMatch) {
    const targetName = openMatch[1] ? openMatch[1].trim() : undefined
    return { type: 'open', targetName, confidence: 0.9, actorId }
  }

  // Search / Examine
  const searchMatch = normalized.match(searchRegex)
  if (searchMatch) {
    const targetName = searchMatch[1] ? searchMatch[1].trim() : undefined
    return { type: 'search', targetName, confidence: 0.8, actorId }
  }

  // Move (look for "to <target>" or coordinates like x,y)
  const moveMatch = normalized.match(moveRegex)
  if (moveMatch) {
    const target = moveMatch[1] ? moveMatch[1].trim() : undefined
    // try to parse coordinates: "to 3,4" or "to (3,4)"
    const coordMatch = normalized.match(/(?:to)\s*\(?\s*(\d+)\s*,\s*(\d+)\s*\)?/i)
    if (coordMatch) {
      const x = Number(coordMatch[1])
      const y = Number(coordMatch[2])
      return { type: 'move', to: { x, y }, confidence: 0.9, actorId }
    }
    // else move to named object
    if (target) return { type: 'move', targetName: target, confidence: 0.75, actorId }
  }

  // Hold
  const holdMatch = normalized.match(holdRegex)
  if (holdMatch) {
    return { type: 'hold', targetName: holdMatch[1] ? holdMatch[1].trim() : undefined, confidence: 0.8, actorId }
  }

  // if nothing matches, return null
  return null
}
