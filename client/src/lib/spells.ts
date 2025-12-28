export async function applySpell(roomCode: string, payload: any) {
  const res = await fetch(`/api/rooms/${roomCode}/spells/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to apply spell');
  }
  return res.json();
}
