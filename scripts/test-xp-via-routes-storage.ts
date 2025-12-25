process.env.USE_MOCK_STORAGE = '1';

(async () => {
  const routes = await import('../server/routes') as any;
  const { parseDMResponseTags, executeGameActions, _test_getInternalStorage } = routes;

  const dmResponse = '[MONSTER_DEFEATED: Goblin | XP: 101 | participants: Alice,Bob]';
  const actions = parseDMResponseTags(dmResponse);

  const broadcasts: any[] = [];
  const broadcastFn = (roomCode: string, message: any) => {
    broadcasts.push({ roomCode, message });
    console.log('[Broadcast]', message);
  };

  // Use the same storage instance used by routes
  const storage = _test_getInternalStorage();
  console.log('Initial characters via internal storage:', (await storage.getCharactersByRoomCode('ROOM1')).map((c:any)=>({ name:c.characterName, xp:c.xp })));

  await executeGameActions(actions, 'ROOM1', broadcastFn);

  console.log('After via internal storage:', (await storage.getCharactersByRoomCode('ROOM1')).map((c:any)=>({ name:c.characterName, xp:c.xp })));
  console.log('Broadcasts:', broadcasts);
})();