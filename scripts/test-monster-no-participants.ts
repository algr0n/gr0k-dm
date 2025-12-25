process.env.USE_MOCK_STORAGE = '1';
(async () => {
  const { parseDMResponseTags, executeGameActions } = await import('../server/routes') as any;
  const dmResponse = '[MONSTER_DEFEATED: Goblin | XP: 100]';
  console.log('DM Response:', dmResponse);
  const actions = parseDMResponseTags(dmResponse);
  console.log('Parsed actions:', actions);
  const broadcasts: any[] = [];
  const broadcastFn = (roomCode: string, message: any) => { broadcasts.push({ roomCode, message }); console.log('[Broadcast]', message); };
  await executeGameActions(actions, 'ROOM1', broadcastFn);
  const mock = (await import('../server/storage.mock')).storage;
  const chars = await mock.getCharactersByRoomCode('ROOM1');
  console.table(chars.map((c: any) => ({ id: c.id, name: c.characterName, xp: c.xp })))
})();