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
  async getRoomStatusEffects(roomId: string) {
    return (this as any)._roomStatusEffects.filter((r: any) => r.roomId === roomId);
  },
  async deleteRoomStatusEffect(id: string) {
    const idx = (this as any)._roomStatusEffects.findIndex((r: any) => r.id === id);
    if (idx === -1) return false;
    (this as any)._roomStatusEffects.splice(idx, 1);
    return true;
  },
  async getAllItems() { return [] },
  async getItemByName(_: any) { return null },
  async getItem(_: any) { return null },
  async createItem(_: any) { return null },
  async getSavedInventoryWithDetails(_: any) { return [] },
  async updateSavedInventoryItem(_: any) { return null },
  async addToSavedInventory(_: any) { return null },
  async deleteSavedInventoryItem(_: any) { return null },
  async createDynamicNpc(_: any) { return { id: 'npc-1', name: 'Mock NPC' } },
  async createStoryEvent(_: any) { return { id: 'event-1', title: 'Mock Event' } },
  async createDynamicLocation(_: any) { return { id: 'loc-1', name: 'Mock Location' } },
  async getQuestObjectivesByRoom(_: any) { return [] },
  async getQuestsByRoom(_: any) { return [] },

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
