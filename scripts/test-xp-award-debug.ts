// Debug XP award path
process.env.USE_MOCK_STORAGE = '1';

(async () => {
  const routes = await import('../server/routes');
  const { parseDMResponseTags, executeGameActions } = routes as any;
  const mock = (await import('../server/storage.mock')).storage;

  const players = await mock.getPlayersByRoom('room-1');
  const chars = await mock.getCharactersByRoomCode('ROOM1');
  console.log('Players:', players);
  console.log('Characters:', chars);

  const dmResponse = '[XP: Alice | 200]';
  const actions = parseDMResponseTags(dmResponse);
  console.log('Actions:', actions);

  await executeGameActions(actions, 'ROOM1', (roomCode:string, msg:any) => console.log('[Broadcast]', msg));

  const chars2 = await mock.getCharactersByRoomCode('ROOM1');
  console.log('After:', chars2);
})();