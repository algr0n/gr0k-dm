import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApplySpellHandler } from '../../server/handlers/spells';
import storageMock, { storage as mockStorage } from '../../server/storage.mock';

function makeReq(params = {}, body = {}, user: any = { id: 'u1', username: 'Alice' }) {
  return {
    params,
    body,
    isAuthenticated: () => true,
    user,
  } as any;
}

function makeRes() {
  let statusCode = 200;
  let body: any = null;
  return {
    status(code: number) { statusCode = code; return this; },
    json(obj: any) { body = obj; return body; },
    get statusCode() { return statusCode; },
    get body() { return body; }
  } as any;
}

beforeEach(() => {
  // Reset in-memory mock state
  mockStorage.reset();
  (mockStorage as any)._roomStatusEffects = [];
});

describe('apply spell handler', () => {
  it('returns 400 when missing spellText', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    const req = makeReq({ code: 'ROOM1' }, {});
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing spellText' });
  });

  it('returns 404 when room not found', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    const req = makeReq({ code: 'UNKNOWN' }, { spellText: 'Light' });
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Room not found' });
  });

  it('returns 403 when caster not in room', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    const req = makeReq({ code: 'ROOM1' }, { casterId: 'unknown-caster', spellText: 'Light' });
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Caster not in room' });
  });

  it('applies status to character targets', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    // stub addStatusEffect to return created effect
    const spy = vi.spyOn(mockStorage, 'addStatusEffect').mockImplementation(async (effect: any) => ({ id: 'se1', ...effect }));

    const req = makeReq({ code: 'ROOM1' }, { spellText: 'Bless', targets: [{ type: 'character', ids: ['c1'] }] });
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(res.body.applied[0].targetType).toBe('character');
  });

  it('applies a room-level effect when no targets are provided and broadcasts', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    const addSpy = vi.spyOn(mockStorage, 'addRoomStatusEffect');

    const req = makeReq({ code: 'ROOM1' }, { spellText: 'Fog Cloud' });
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(addSpy).toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalledWith('ROOM1', expect.objectContaining({ type: 'spell_applied' }));
    expect(res.body.applied[0].targetType).toBe('room');
  });

  it('applies object/npc targets with metadata tags', async () => {
    const broadcast = vi.fn();
    const handler = createApplySpellHandler(mockStorage, broadcast);

    const addRoomSpy = vi.spyOn(mockStorage, 'addRoomStatusEffect');

    const req = makeReq({ code: 'ROOM1' }, { spellText: 'Hold Person', targets: [{ type: 'npc', id: 'npc-1', tags: ['debuff'], metadata: { kind: 'humanoid' } }] });
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(addRoomSpy).toHaveBeenCalled();
    const meta = res.body.applied[0].created.metadata;
    expect(meta.tags).toContain('debuff');
    expect(meta.targetType).toBe('npc');
    expect(meta.targetId).toBe('npc-1');
  });
});
