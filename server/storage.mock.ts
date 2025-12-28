// Minimal in-memory mock storage for integration testing

interface Room { id: string; code: string; gameSystem?: string }
interface Player { id: string; userId: string; name: string }
interface Character { 
  id: string; 
  userId: string; 
  characterName: string; 
  xp?: number; 
  level?: number; 
  maxHp?: number; 
  currentHp?: number; 
  class?: string; 
  stats?: any; 
  gold?: number; 
  currentRoomCode?: string;
  levelChoices?: any[];
  spellSlots?: any;
}

const rooms: Room[] = [ { id: 'room-1', code: 'ROOM1', gameSystem: 'dnd' } ];
const players: Player[] = [ { id: 'p1', userId: 'u1', name: 'Alice' }, { id: 'p2', userId: 'u2', name: 'Bob' } ];
const characters: Character[] = [
  { id: 'c1', userId: 'u1', characterName: 'Alice', xp: 0, level: 1, maxHp: 10, currentHp: 10, class: 'Fighter', stats: { constitution: 12 }, gold: 0, currentRoomCode: 'ROOM1' },
  { id: 'c2', userId: 'u2', characterName: 'Bob', xp: 0, level: 1, maxHp: 8, currentHp: 8, class: 'Wizard', stats: { constitution: 10 }, gold: 0, currentRoomCode: 'ROOM1' },
];

const storage = {
  _dynamicAdventureContexts: [] as any[],
  _dynamicNpcs: [] as any[],
  _dynamicLocations: [] as any[],
  async getCharactersByRoomCode(roomCode: string) {
    // Return characters in this room
    return characters.filter(c => c.currentRoomCode === roomCode).map(c => ({ ...c }));
  },
  async getRoomByCode(code: string) {
    return rooms.find(r => r.code === code) || null;
  },
  async getPlayersByRoom(roomId: string) {
    // Return all players for mock
    return players.map(p => ({ ...p }));
  },
  async getRoom(roomId: string) {
    return rooms.find(r => r.id === roomId) || null;
  },
  async getSavedCharacter(characterId: string) {
    const c = characters.find(x => x.id === characterId);
    return c ? { ...c } : null;
  },
  async updateSavedCharacter(characterId: string, updates: any) {
    const idx = characters.findIndex(x => x.id === characterId);
    if (idx === -1) throw new Error('Character not found');
    characters[idx] = { ...characters[idx], ...updates };
    return { ...characters[idx] };
  },
  // Reset for testing
  reset() {
    characters[0] = { id: 'c1', userId: 'u1', characterName: 'Alice', xp: 0, level: 1, maxHp: 10, currentHp: 10, class: 'Fighter', stats: { constitution: 12 }, gold: 0, currentRoomCode: 'ROOM1' };
    characters[1] = { id: 'c2', userId: 'u2', characterName: 'Bob', xp: 0, level: 1, maxHp: 8, currentHp: 8, class: 'Wizard', stats: { constitution: 10 }, gold: 0, currentRoomCode: 'ROOM1' };
    (this as any)._roomStatusEffects = [];
    (this as any)._encounters = [];
    (this as any)._dynamicAdventureContexts = [];
    (this as any)._dynamicNpcs = [];
    (this as any)._dynamicLocations = [];
  },
  // Minimal stubs for functions used elsewhere to avoid runtime errors in the test harness
  async addStatusEffect(_: any) { return null },
  async getCharacterStatusEffects(_: any) { return [] },
  async removeStatusEffect(_: any) { return null },

  // Room status effects in-memory store for tests
  _roomStatusEffects: [] as any[],
  async addRoomStatusEffect(effect: any) {
    const id = `rse:${Math.random().toString(36).slice(2)}`;
    const e = { ...effect, id };
    (this as any)._roomStatusEffects.push(e);
    return e;
  },
  async createRoomStatusEffect(effect: any) {
    return this.addRoomStatusEffect(effect);
  },
  async getRoomStatusEffects(roomId: string) {
    return (this as any)._roomStatusEffects.filter((r: any) => r.roomId === roomId);
  },
  async deleteRoomStatusEffect(id: string) {
    const idx = (this as any)._roomStatusEffects.findIndex((r: any) => r.id === id);
    if (idx === -1) return false;
    (this as any)._roomStatusEffects.splice(idx, 1);
    return true;
  },
  async cleanupExpiredRoomStatusEffects() {
    const now = Date.now();
    const before = (this as any)._roomStatusEffects.length;
    (this as any)._roomStatusEffects = (this as any)._roomStatusEffects.filter((r: any) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
    return before - (this as any)._roomStatusEffects.length;
  },
  async createDynamicAdventureContext(ctx: any) {
    const id = ctx.id || `dac:${Math.random().toString(36).slice(2)}`;
    const row = { status: 'active', activeQuestIds: [], npcIds: [], locationIds: [], encounterIds: [], ...ctx, id };
    (this as any)._dynamicAdventureContexts.push(row);
    return { ...row };
  },
  async getActiveDynamicAdventureForRoom(roomId: string) {
    return (this as any)._dynamicAdventureContexts.find((c: any) => c.roomId === roomId && c.status === 'active');
  },
  async updateDynamicAdventureContext(id: string, updates: any) {
    const row = (this as any)._dynamicAdventureContexts.find((c: any) => c.id === id);
    if (!row) return undefined;
    Object.assign(row, updates);
    return { ...row };
  },
  async deleteDynamicAdventureContext(id: string) {
    (this as any)._dynamicNpcs = (this as any)._dynamicNpcs.filter((n: any) => n.adventureContextId !== id);
    (this as any)._dynamicLocations = (this as any)._dynamicLocations.filter((l: any) => l.adventureContextId !== id);
    (this as any)._encounters = (this as any)._encounters.filter((e: any) => e.adventureContextId !== id);
    const before = (this as any)._dynamicAdventureContexts.length;
    (this as any)._dynamicAdventureContexts = (this as any)._dynamicAdventureContexts.filter((c: any) => c.id !== id);
    return (this as any)._dynamicAdventureContexts.length < before;
  },
  async getAllItems() { return [] },
  async getItemByName(_: any) { return null },
  async getItem(_: any) { return null },
  async createItem(_: any) { return null },
  async getSavedInventoryWithDetails(_: any) { return [] },
  async updateSavedInventoryItem(_: any) { return null },
  async addToSavedInventory(_: any) { return null },
  async deleteSavedInventoryItem(_: any) { return null },
  async createDynamicNpc(npc: any) {
    const row = { id: npc.id || `npc:${Math.random().toString(36).slice(2)}`, name: npc.name || 'Mock NPC', ...npc };
    (this as any)._dynamicNpcs.push(row);
    return { ...row };
  },
  async createStoryEvent(_: any) { return { id: 'event-1', title: 'Mock Event' } },
  async createDynamicLocation(loc: any) {
    const row = { id: loc.id || `loc:${Math.random().toString(36).slice(2)}`, name: loc.name || 'Mock Location', ...loc };
    (this as any)._dynamicLocations.push(row);
    return { ...row };
  },
  async getDynamicNpcsByRoom(roomId: string) {
    return (this as any)._dynamicNpcs.filter((n: any) => n.roomId === roomId).map((n: any) => ({ ...n }));
  },
  async getDynamicLocationsByRoom(roomId: string) {
    return (this as any)._dynamicLocations.filter((l: any) => l.roomId === roomId).map((l: any) => ({ ...l }));
  },
  async getQuestObjectivesByRoom(_: any) { return [] },
  async getQuestsByRoom(_: any) { return [] },
  async getAvailableQuestsForRoom(_: any) { return [] },

  // In-memory encounter store for tests
  _encounters: [] as any[],
  async createCombatEncounter(encounter: any) {
    const id = `enc:${Math.random().toString(36).slice(2)}`;
    const e = { ...encounter, id };
    (this as any)._encounters.push(e);
    return e;
  },
  async getCombatEncounterByLocation(locationId: string) {
    return ((this as any)._encounters.find((e: any) => e.locationId === locationId) || null);
  },
  async addEnvironmentFeatures(encounterId: string, features: any[]) {
    const rows = features.map((f:any)=> ({ ...f, id: `ef:${Math.random().toString(36).slice(2)}`, encounterId }));
    return rows;
  },
  async addCombatSpawns(encounterId: string, spawns: any[]) {
    const rows = spawns.map((s:any)=> ({ ...s, id: `sp:${Math.random().toString(36).slice(2)}`, encounterId }));
    return rows;
  },
  async getEnvironmentFeaturesByEncounter(encounterId: string) { return []; },
  async getCombatSpawnsByEncounter(encounterId: string) { return []; },
  async updateCombatEncounter(encounterId: string, updates: any) {
    const e = (this as any)._encounters.find((x:any)=> x.id === encounterId);
    if (e) Object.assign(e, updates);
    return e;
  },
};

export { storage };
export default storage;
