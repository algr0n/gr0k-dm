import { storage } from "./server/storage";

async function testCombatInit() {
  const roomCode = "TARU73"; // From the screenshot
  
  console.log("Testing combat initialization for room:", roomCode);
  
  try {
    const room = await storage.getRoomByCode(roomCode);
    if (!room) {
      console.log("Room not found!");
      return;
    }
    
    console.log("Room found:", { id: room.id, name: room.name, code: room.code });
    
    const players = await storage.getPlayersByRoom(room.id);
    console.log("Players in room:", players.map(p => ({ id: p.id, userId: p.userId, name: p.name })));
    
    const chars = await storage.getCharactersByRoomCode(roomCode);
    console.log("Characters in room:", chars.map(c => ({ 
      id: c.id, 
      userId: c.userId, 
      characterName: c.characterName,
      initiativeModifier: c.initiativeModifier,
      currentHp: c.currentHp,
      maxHp: c.maxHp,
      ac: c.ac
    })));
    
    const monsters = await storage.getDynamicNpcsByRoom(room.id) || [];
    console.log("Monsters/NPCs in room:", monsters.length);
    
  } catch (err) {
    console.error("Error testing combat init:", err);
  }
  
  process.exit(0);
}

testCombatInit();
