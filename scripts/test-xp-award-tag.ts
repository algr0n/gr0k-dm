// Test XP award via DM tag [XP: Player | Amount]
process.env.USE_MOCK_STORAGE = '1';

(async () => {
  const routes = await import('../server/routes');
  const { parseDMResponseTags, executeGameActions } = routes as any;
  const dmResponse = '[XP: Alice | 200]\nThe DM announces XP for a heroic action.';
  console.log('DM Response:', dmResponse);
  const actions = parseDMResponseTags(dmResponse);
  console.log('Parsed actions:', actions);

  const broadcasts: any[] = [];
  const broadcastFn = (roomCode: string, message: any) => {
    broadcasts.push({ roomCode, message });
    console.log('[Broadcast]', roomCode, message);
  };

  await executeGameActions(actions, 'ROOM1', broadcastFn);

  const mock = (await import('../server/storage.mock')).storage;
  const chars = await mock.getCharactersByRoomCode('ROOM1');
  console.table(chars.map((c: any) => ({ id: c.id, name: c.characterName, xp: c.xp, level: c.level })));
})();