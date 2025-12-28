import type { Request, Response } from 'express';

export function createApplySpellHandler(storage: any, broadcastToRoom: (roomCode: string, payload: any) => void) {
  return async function applySpellHandler(req: Request, res: Response) {
    try {
      const { code } = req.params as any;
      const { casterId, spellText, targets, duration, isLoud } = req.body as any;
      if (!spellText) return res.status(400).json({ error: 'Missing spellText' });

      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      // Basic permission check: if casterId provided, ensure character is in the room
      if (casterId) {
        const caster = await storage.getSavedCharacter(casterId);
        if (!caster || caster.currentRoomCode !== code) return res.status(403).json({ error: 'Caster not in room' });
      }

      // Parse spell text for inferred effects
      // Note: import of inferSpellEffects kept in routes originally; reuse if available from shared
      // To avoid circular deps, try to import dynamically
      let effects: any = {};
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { inferSpellEffects } = require('../shared/spell-text');
        effects = inferSpellEffects({ name: '', description: spellText }) || {};
      } catch (err) {
        effects = {};
      }

      const applied: any[] = [];

      // If targets specified, apply to each target depending on type
      if (Array.isArray(targets) && targets.length > 0) {
        for (const t of targets) {
          if (t.type === 'character') {
            for (const id of (t.ids || [])) {
              // Apply as character status effect
              const created = await storage.addStatusEffect({
                characterId: id,
                name: `Spell: ${spellText.substring(0, 40)}`,
                description: effects.onSuccess || spellText,
                duration: duration || null,
                appliedByDm: false,
                createdAt: Date.now(),
              });
              applied.push({ targetType: 'character', targetId: id, created });
            }
          } else if (t.type === 'object' || t.type === 'room' || t.type === 'npc') {
            const mergedTags = Array.from(new Set([...(effects.tags || []), ...((t.tags as string[] | undefined) || [])]));
            const metadata = {
              ...(t.metadata || {}),
              tags: mergedTags,
              inferred: effects,
              targetType: t.type,
              targetId: t.id || null,
            };
            const created = await storage.addRoomStatusEffect({
              roomId: room.id,
              name: `Spell: ${spellText.substring(0, 40)}`,
              description: effects.onSuccess || spellText,
              appliedBy: 'player',
              sourceId: t.id || null,
              duration: duration || null,
              metadata,
              createdAt: Date.now(),
            });
            applied.push({ targetType: t.type, targetId: t.id || null, created });
          } else {
            // Unknown target type - skip
            applied.push({ targetType: t.type, skipped: true });
          }
        }
      } else {
        // Default: apply to room-level effect
        const created = await storage.addRoomStatusEffect({
          roomId: room.id,
          name: `Spell: ${spellText.substring(0, 40)}`,
          description: effects.onSuccess || spellText,
          appliedBy: 'player',
          duration: duration || null,
          metadata: { tags: effects.tags || [], inferred: effects, targetType: 'room' },
          createdAt: Date.now(),
        });
        applied.push({ targetType: 'room', created });
      }

      // Broadcast to room so clients can update UI
      broadcastToRoom(code, { type: 'spell_applied', casterId, spellText, effects, applied, isLoud: !!isLoud });

      // Optional loudness policy: nudge DM/players that combat might start
      if (isLoud) {
        broadcastToRoom(code, {
          type: 'combat_prompt',
          reason: 'Loud spell or effect',
          spellText,
          applied,
        });
      }

      res.json({ success: true, applied, effects });
    } catch (error) {
      console.error('Apply spell error:', error);
      res.status(500).json({ error: 'Failed to apply spell effects' });
    }
  };
}
