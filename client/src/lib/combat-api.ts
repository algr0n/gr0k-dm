export async function holdTurn(roomCode: string, actorId: string, holdType: 'until' | 'end' = 'until', triggerActorId?: string) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/combat/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, holdType, triggerActorId }),
  });
  if (!res.ok) throw new Error('Failed to set hold');
  return res.json();
}

export async function passTurn(roomCode: string, actorId: string) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/combat/pass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId }),
  });
  if (!res.ok) throw new Error('Failed to pass turn');
  return res.json();
}

export async function submitAction(roomCode: string, action: any) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/combat/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error('Failed to submit action');
  return res.json();
}

export async function confirmSuggestion(roomCode: string, suggestionId: string, body?: any) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/suggestions/${encodeURIComponent(suggestionId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error('Failed to confirm suggestion');
  return res.json();
}

export async function cancelSuggestion(roomCode: string, suggestionId: string) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/suggestions/${encodeURIComponent(suggestionId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to cancel suggestion');
  return res.json();
}
