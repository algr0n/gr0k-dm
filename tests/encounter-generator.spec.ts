import { describe, test, expect, vi } from 'vitest';
import * as stageGen from '../server/generators/stage';
import storage from '../server/storage.mock';

describe('Combat stage generator integration', () => {
  test('Generator returns parsed JSON and is persisted via storage', async () => {
    // Mock openai response by stubbing generateCombatStage
    const sample = { features: [{ type: 'cover', position: { x: 5, y: 5 }, radius: 2, properties: { coverBonus: 2 } }], spawns: [{ monster: 'Goblin', count: 3, position: { x: 4, y: 4 } }], summary: 'A small cave with fallen logs.' };
    const spy = vi.spyOn(stageGen, 'generateCombatStage').mockResolvedValue(sample as any);

    // Simulate endpoint logic: create encounter if not exists
    const encounter = await storage.createCombatEncounter({ locationId: 'loc-test', name: 'Test Cave', seed: 's1', generatedBy: 'AI', metadata: {} });
    const features = await storage.addEnvironmentFeatures(encounter.id, sample.features.map((f:any)=> ({ type: f.type, positionX: f.position.x, positionY: f.position.y, radius: f.radius, properties: f.properties })));
    const spawns = await storage.addCombatSpawns(encounter.id, sample.spawns.map((s:any)=> ({ monsterName: s.monster, count: s.count, positionX: s.position.x, positionY: s.position.y, metadata: s })));

    expect(encounter).toBeDefined();
    expect(features.length).toBe(1);
    expect(spawns.length).toBe(1);

    spy.mockRestore();
  });
});