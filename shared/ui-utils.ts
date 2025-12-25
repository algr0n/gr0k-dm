export interface EncounterSpawn { id: string; monsterName?: string; positionX?: number; positionY?: number; metadata?: any }
export interface EncounterFeature { id?: string; type: string; positionX: number; positionY: number; radius?: number; properties?: any }

export function extractTokensFromEncounter(encounter: any) {
  const tokens = (encounter?.spawns ?? []).map((s: EncounterSpawn) => ({
    id: s.id || `${s.monsterName}:${s.positionX}:${s.positionY}`,
    x: s.positionX,
    y: s.positionY,
    metadata: s.metadata ?? {},
  }));

  const features = (encounter?.features ?? []).map((f: EncounterFeature) => ({
    id: f.id || `${f.type}:${f.positionX}:${f.positionY}`,
    type: f.type,
    x: f.positionX,
    y: f.positionY,
    radius: f.radius ?? 0,
    properties: f.properties ?? {},
  }));

  return { tokens, features };
}
