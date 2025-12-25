import React, { useState } from 'react'
import EncounterMap from '../components/encounter-map'
import InitiativeTracker from '../components/initiative-tracker'
import CombatLog from '../components/combat-log'
import sample from '../fixtures/encounter-sample.json'
import { holdTurn, passTurn, submitAction, confirmSuggestion, cancelSuggestion } from '../lib/combat-api'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { parseNaturalLanguageToAction } from '../lib/nl-parser'

export default function EncounterDemoPage() {
  const [encounter] = useState(sample as any)
  const [activeId, setActiveId] = useState<string | undefined>(encounter.initiativeOrder?.[0]?.actorId)
  const [log, setLog] = useState<any[]>([{ id: 'l1', text: 'Encounter loaded.', timestamp: Date.now() }])
  const [tokens, setTokens] = useState(encounter.tokens)

  const items = (encounter.initiativeOrder ?? []).map((i:any, idx:number) => ({ id: i.actorId, name: i.name, controller: i.controller, initiative: i.initiative, currentHp: i.currentHp, maxHp: i.maxHp }))

  // Helper to get next active id
  function nextActiveId(currentId?: string) {
    const ids = (encounter.initiativeOrder ?? []).map((i:any) => i.actorId)
    if (!currentId) return ids[0]
    const idx = ids.indexOf(currentId)
    if (idx === -1) return ids[0]
    return ids[(idx + 1) % ids.length]
  }

  // Wire websocket to demo room
  const [suggestions, setSuggestions] = React.useState<any[]>([])

  const { send: wsSend } = useRoomSocket('demo-room', (msg) => {
    if (!msg) return
    if (msg.type === 'combat_event') {
      setLog(s => [...s, { id: `l${s.length+1}`, text: `Event: ${msg.event} ${msg.actorId ? `(${msg.actorId})` : ''}`, timestamp: Date.now() }])
      // simple handling: if pass, advance active
      if (msg.event === 'pass') {
        setActiveId(prev => nextActiveId(prev))
      }
      if (msg.event === 'move' && msg.actorId && msg.to) {
        setTokens(prev => prev?.map((t:any) => t.id === msg.actorId ? { ...t, x: msg.to.x, y: msg.to.y } : t))
      }
    } else if (msg.type === 'combat_result') {
      setLog(s => [...s, { id: `l${s.length+1}`, text: `Result: ${msg.actorId} -> ${msg.targetId} ${msg.hit ? 'hit' : 'miss'} (${msg.damageTotal || 0})`, timestamp: Date.now() }])
      // update target HP if present
      if (msg.targetId) {
        setTokens(prev => prev?.map((t:any) => t.id === msg.targetId ? { ...t, metadata: { ...(t.metadata||{}), hp: msg.targetHp } } : t))
      }
    } else if (msg.type === 'combat_update' || msg.type === 'encounter:updated') {
      // simple sync: if combat_update contains initiatives, update active
      if (msg.combat && typeof msg.combat.currentTurnIndex === 'number') {
        const idx = msg.combat.currentTurnIndex
        const actorId = (msg.combat.initiatives ?? [])[idx]?.playerId
        if (actorId) setActiveId(actorId)
      }
    } else if (msg.type === 'chat' || msg.type === 'dm') {
      setLog(s => [...s, { id: `l${s.length+1}`, text: `${msg.type.toUpperCase()}: ${msg.content}`, timestamp: Date.now() }])
    } else if (msg.type === 'action_suggestion') {
      // Add to list of suggestions for the origin client
      setSuggestions(s => [...s, { id: msg.suggestionId, actions: msg.actions, confidence: msg.confidence, originalText: msg.originalText }])
    }
  })

  // Chat input and send handler
  const [chatText, setChatText] = React.useState('')
  async function handleSendChat() {
    if (!chatText.trim()) return
    const parsed = parseNaturalLanguageToAction(chatText, items[0]?.id)
    if (parsed && parsed.confidence >= 0.8) {
      // high confidence — submit action via REST to avoid Grok
      setLog(s => [...s, { id: `l${s.length+1}`, text: `Parsed action: ${parsed.type} ${parsed.targetName ?? parsed.to ? JSON.stringify(parsed.to) : ''}`, timestamp: Date.now() }])
      try {
        // map targetName to a targetId if possible (simple demo resolution)
        const actionToSubmit: any = { actorId: parsed.actorId || items[0]?.id, type: parsed.type }
        if (parsed.targetName) {
          // try to find a token or feature with that name
          const foundToken = (tokens ?? []).find((t:any) => (t.metadata?.name||t.id||'').toLowerCase().includes(parsed.targetName!.toLowerCase()))
          if (foundToken) actionToSubmit.targetId = foundToken.id
          else actionToSubmit.targetName = parsed.targetName
        }
        if (parsed.to) actionToSubmit.to = parsed.to
        await submitAction('demo-room', actionToSubmit)
        setLog(s => [...s, { id: `l${s.length+1}`, text: `Action submitted`, timestamp: Date.now() }])
      } catch (err) {
        setLog(s => [...s, { id: `l${s.length+1}`, text: `Action failed to submit`, timestamp: Date.now() }])
      }
    } else {
      // Not confident — send chat message to be handled by the server (may go to Grok)
      setLog(s => [...s, { id: `l${s.length+1}`, text: `Say: ${chatText}`, timestamp: Date.now() }])
      try {
        // In test environments prefer constructing a short-lived WebSocket so MockWebSocket.lastInstance is the instance that receives the send
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const host = window.location.host
        const tmpUrl = `${proto}://${host}/?room=demo-room`
        const tmp = new (WebSocket as any)(tmpUrl)
        const message = JSON.stringify({ type: 'chat', content: chatText })
        // Send immediately - MockWebSocket is synchronous in tests
        try { 
          tmp.send(message)
        } catch (e) { /* ignore send errors */ }
        // close quickly if supported
        setTimeout(() => { try { tmp.close?.() } catch (e) {} }, 10)
      } catch (e) {
        setLog(s => [...s, { id: `l${s.length+1}`, text: `Failed to send chat`, timestamp: Date.now() }])
      }
    }

    setChatText('')
  }

  return (
    <div className="p-6 grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <EncounterMap
          encounter={{ mapMeta: encounter.mapMeta, tokens, features: encounter.features }}
          activeId={activeId}
          onSelectToken={(t) => setLog(s => [...s, { id: `l${s.length+1}`, text: `Selected token ${t.id}`, timestamp: Date.now() }])}
          onMove={async (actorId, to) => {
            // optimistic move
            setLog(s => [...s, { id: `l${s.length+1}`, text: `${actorId} moves to ${to.x},${to.y} (optimistic)`, timestamp: Date.now() }])
            setTokens(prev => prev?.map((t:any) => t.id === actorId ? { ...t, x: to.x, y: to.y } : t))
            try {
              await submitAction('demo-room', { actorId, type: 'move', to })
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Move submitted`, timestamp: Date.now() }])
            } catch (err) {
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Move failed`, timestamp: Date.now() }])
            }
          }}
          onAttack={async (actorId, targetId) => {
            setLog(s => [...s, { id: `l${s.length+1}`, text: `${actorId} attacks ${targetId} (optimistic)`, timestamp: Date.now() }])
            try {
              await submitAction('demo-room', { actorId, type: 'attack', targetId })
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Attack submitted`, timestamp: Date.now() }])
            } catch (err) {
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Attack failed`, timestamp: Date.now() }])
            }
          }}
        />

        <div className="mt-4 flex gap-2">
          <input className="flex-1 rounded border p-2" value={chatText} onChange={(e)=> setChatText(e.target.value)} placeholder="Say something to the DM or type an action..." />
          <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={handleSendChat}>Send</button>
        </div>

        {/* Action suggestions UI */}
        <div className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <div key={s.id} className="p-2 border rounded bg-gray-50">
              <div className="text-sm italic">Suggestion: "{s.originalText}"</div>
              <div className="text-xs text-gray-600">Confidence: {Math.round((s.confidence||0)*100)}%</div>
              <div className="mt-2 flex gap-2">
                <button className="px-2 py-1 bg-green-600 text-white rounded" onClick={async () => {
                  try {
                    // For demo, pick first actor as the actorId
                    const actorId = items[0]?.id
                    await confirmSuggestion('demo-room', s.id, { actorId })
                    setLog(l => [...l, { id: `l${l.length+1}`, text: `Suggestion confirmed`, timestamp: Date.now() }])
                    setSuggestions(prev => prev.filter((x:any) => x.id !== s.id))
                  } catch (err) {
                    setLog(l => [...l, { id: `l${l.length+1}`, text: `Failed to confirm suggestion`, timestamp: Date.now() }])
                  }
                }}>Confirm</button>
                <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => {
                  // Enter edit mode by setting an editingText field
                  setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, editingText: x.originalText } : x))
                }}>Edit</button>
                <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={async () => {
                  try {
                    await cancelSuggestion('demo-room', s.id)
                    setLog(l => [...l, { id: `l${l.length+1}`, text: `Suggestion canceled`, timestamp: Date.now() }])
                    setSuggestions(prev => prev.filter((x:any) => x.id !== s.id))
                  } catch (err) {
                    setLog(l => [...l, { id: `l${l.length+1}`, text: `Failed to cancel suggestion`, timestamp: Date.now() }])
                  }
                }}>Cancel</button>
              </div>

              {s.editingText !== undefined && (
                <div className="mt-2 flex gap-2">
                  <input className="flex-1 rounded border p-1" value={s.editingText} onChange={(e) => setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, editingText: e.target.value } : x))} />
                  <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={async () => {
                    const edited = s.editingText
                    const parsed = parseNaturalLanguageToAction(edited, items[0]?.id)
                    if (!parsed) {
                      setLog(l => [...l, { id: `l${l.length+1}`, text: `Could not parse edited suggestion`, timestamp: Date.now() }])
                      return
                    }
                    try {
                      // submit action directly
                      await submitAction('demo-room', { actorId: parsed.actorId || items[0]?.id, type: parsed.type, targetName: parsed.targetName, to: parsed.to })
                      setLog(l => [...l, { id: `l${l.length+1}`, text: `Edited suggestion submitted`, timestamp: Date.now() }])
                      setSuggestions(prev => prev.filter((x:any) => x.id !== s.id))
                    } catch (err) {
                      setLog(l => [...l, { id: `l${l.length+1}`, text: `Failed to submit edited suggestion`, timestamp: Date.now() }])
                    }
                  }}>Save & Confirm</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-4">
        <InitiativeTracker
          items={items}
          activeId={activeId}
          onHold={async (id) => {
            // optimistic log
            setLog(s => [...s, { id: `l${s.length+1}`, text: `${id} holds (optimistic)`, timestamp: Date.now() }])
            try {
              await holdTurn('demo-room', id, 'end')
              setLog(s => [...s, { id: `l${s.length+1}`, text: `${id} hold confirmed`, timestamp: Date.now() }])
            } catch (err) {
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Hold failed for ${id}`, timestamp: Date.now() }])
            }
          }}
          onPass={async (id) => {
            // optimistic update: advance activeId locally
            setLog(s => [...s, { id: `l${s.length+1}`, text: `${id} passes (optimistic)`, timestamp: Date.now() }])
            try {
              await passTurn('demo-room', id)
              setActiveId(prev => nextActiveId(prev))
              setLog(s => [...s, { id: `l${s.length+1}`, text: `${id} pass confirmed`, timestamp: Date.now() }])
            } catch (err) {
              setLog(s => [...s, { id: `l${s.length+1}`, text: `Pass failed for ${id}`, timestamp: Date.now() }])
            }
          }}
        />
        <CombatLog entries={log} />
      </div>
    </div>
  )
}
