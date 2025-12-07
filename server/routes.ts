import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { generateDMResponse, generateBatchedDMResponse, generateStartingScene, generateCombatDMTurn, type CharacterInfo, type BatchedMessage, getTokenUsage } from "./grok";
import { insertRoomSchema, insertCharacterSchema, insertInventoryItemSchema, type Message, type Character, type InventoryItem } from "@shared/schema";

const roomConnections = new Map<string, Set<WebSocket>>();

// Message batching queue per room
interface QueuedMessage {
  playerName: string;
  content: string;
  type: "chat" | "action";
  diceResult?: { expression: string; total: number; rolls: number[] };
  timestamp: number;
}

const messageQueue = new Map<string, QueuedMessage[]>();
const batchTimers = new Map<string, NodeJS.Timeout>();
const BATCH_DELAY_MS = 1500; // 1.5 second debounce window
const MAX_BATCH_SIZE = 5;

interface InitiativeEntry {
  playerId: string;
  playerName: string;
  characterName: string;
  roll: number;
  modifier: number;
  total: number;
}

interface CombatState {
  isActive: boolean;
  currentTurnIndex: number;
  initiatives: InitiativeEntry[];
}

const roomCombatState = new Map<string, CombatState>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const roomCode = url.searchParams.get("room");
    const playerName = url.searchParams.get("player") || "Anonymous";

    if (!roomCode) {
      ws.close(1008, "Room code required");
      return;
    }

    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode)!.add(ws);

    console.log(`Player ${playerName} joined room ${roomCode}`);

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, roomCode, playerName, message);
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      const connections = roomConnections.get(roomCode);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          roomConnections.delete(roomCode);
        }
      }
      console.log(`Player ${playerName} left room ${roomCode}`);
    });
  });

  async function handleWebSocketMessage(
    ws: WebSocket,
    roomCode: string,
    playerName: string,
    message: any
  ) {
    const room = await storage.getRoomByCode(roomCode);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", content: "Room not found" }));
      return;
    }

    if (!room.isActive) {
      ws.send(JSON.stringify({ type: "error", content: "This game has ended" }));
      return;
    }

    if (message.type === "chat" || message.type === "action") {
      // Combat turn lockout: only the current turn player (or host) can send messages during combat
      const combatState = roomCombatState.get(roomCode);
      if (combatState?.isActive) {
        const currentTurnEntry = combatState.initiatives[combatState.currentTurnIndex];
        const isHost = room.hostName === playerName;
        const isCurrentTurn = currentTurnEntry?.playerName === playerName;
        
        // Allow host to always chat, but enforce turn order for other players
        if (!isHost && !isCurrentTurn && currentTurnEntry?.playerId !== "DM") {
          ws.send(JSON.stringify({ 
            type: "error", 
            content: `It's ${currentTurnEntry?.characterName || "another player"}'s turn. Wait for your turn to act.` 
          }));
          return;
        }
      }
      
      // Handle /give command: /give @PlayerName ItemName x Quantity
      // Uses a greedy match for item name, with optional "x N" at the end for quantity
      const giveMatch = message.content.match(/^\/give\s+@?(\S+)\s+(.+?)(?:\s+x\s*(\d+))?$/i);
      if (giveMatch && room.hostName === playerName) {
        const targetPlayerName = giveMatch[1];
        const itemName = giveMatch[2].trim();
        const quantity = parseInt(giveMatch[3]) || 1;

        // Find the target player
        const players = await storage.getPlayersByRoom(room.id);
        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (!targetPlayer) {
          ws.send(JSON.stringify({ type: "error", content: `Player "${targetPlayerName}" not found.` }));
          return;
        }

        // Get or create character for target player
        let character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
        if (!character) {
          // Create a basic character for the player
          character = await storage.createCharacter({
            playerId: targetPlayer.id,
            roomId: room.id,
            name: targetPlayer.name,
            gameSystem: room.gameSystem,
            stats: {},
            notes: null,
          });
        }

        // Add item to inventory
        await storage.createInventoryItem({
          characterId: character.id,
          name: itemName,
          description: null,
          quantity,
          grantedBy: playerName,
        });

        // Broadcast system message about the item grant
        const grantMessage: Message = {
          id: randomUUID(),
          roomId: room.id,
          playerName: "System",
          content: `${playerName} granted ${targetPlayer.name} "${itemName}"${quantity > 1 ? ` x${quantity}` : ""}.`,
          type: "system",
          timestamp: new Date().toISOString(),
        };

        const updatedHistory = [...(room.messageHistory || []), grantMessage].slice(-100);
        await storage.updateRoom(room.id, { messageHistory: updatedHistory });

        broadcastToRoom(roomCode, { type: "message", message: grantMessage });
        broadcastToRoom(roomCode, { type: "inventory_update", playerId: targetPlayer.id });
        return;
      }

      // Handle non-host trying to use /give
      if (message.content.startsWith("/give") && room.hostName !== playerName) {
        ws.send(JSON.stringify({ type: "error", content: "Only the host can grant items." }));
        return;
      }

      const chatMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName,
        content: message.content,
        type: message.type,
        timestamp: new Date().toISOString(),
      };

      let diceResult = undefined;
      const diceMatch = message.content.match(/\/roll?\s+(.+)/i);
      if (diceMatch) {
        const result = parseDiceExpression(diceMatch[1]);
        if (result) {
          diceResult = result;
          chatMessage.type = "roll";
          chatMessage.diceResult = {
            expression: result.expression,
            rolls: result.rolls,
            modifier: result.modifier,
            total: result.total,
          };
          
          await storage.createDiceRoll({
            roomId: room.id,
            expression: result.expression,
            rolls: result.rolls,
            modifier: result.modifier,
            total: result.total,
          });
        }
      }

      const updatedHistory = [...(room.messageHistory || []), chatMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(roomCode, { type: "message", message: chatMessage });

      // Check if this is a pure dice roll (just "/roll XdY" with no other content)
      const isPureDiceRoll = diceMatch && message.content.trim().toLowerCase().startsWith("/roll");
      
      if (isPureDiceRoll && !message.content.includes(" ") || (diceMatch && message.content.replace(diceMatch[0], "").trim() === "")) {
        // Pure dice roll - skip AI response, just show the roll result
        console.log(`[Token Saving] Skipping AI for pure dice roll: ${message.content}`);
        return;
      }

      if (!message.content.startsWith("/") || diceMatch) {
        // Queue message for batching instead of immediate AI response
        const queuedMsg: QueuedMessage = {
          playerName,
          content: message.content,
          type: message.type as "chat" | "action",
          diceResult: diceResult ? {
            expression: diceResult.expression,
            total: diceResult.total,
            rolls: diceResult.rolls
          } : undefined,
          timestamp: Date.now()
        };
        
        if (!messageQueue.has(roomCode)) {
          messageQueue.set(roomCode, []);
        }
        messageQueue.get(roomCode)!.push(queuedMsg);
        
        // Clear existing timer and set new one
        const existingTimer = batchTimers.get(roomCode);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        
        const queue = messageQueue.get(roomCode)!;
        
        // Process immediately if batch is full, otherwise wait
        if (queue.length >= MAX_BATCH_SIZE) {
          console.log(`[Batching] Batch full (${queue.length} messages), processing immediately`);
          await processBatch(roomCode, { ...room, messageHistory: updatedHistory });
        } else {
          // Set timer to process after delay
          const timer = setTimeout(async () => {
            const currentRoom = await storage.getRoomByCode(roomCode);
            if (currentRoom) {
              await processBatch(roomCode, currentRoom);
            }
          }, BATCH_DELAY_MS);
          batchTimers.set(roomCode, timer);
        }
      }
    }

    // Combat/Initiative handlers
    if (message.type === "start_combat") {
      if (room.hostName !== playerName) {
        ws.send(JSON.stringify({ type: "error", content: "Only the host can start combat." }));
        return;
      }

      const players = await storage.getPlayersByRoom(room.id);
      const characters = await storage.getCharactersByRoom(room.id);
      
      const initiatives: InitiativeEntry[] = [];
      
      for (const player of players) {
        const character = characters.find(c => c.playerId === player.id);
        const characterName = character?.name || player.name;
        const stats = character?.stats || {};
        
        const dexMod = typeof stats.dexterity === "number" 
          ? Math.floor((stats.dexterity - 10) / 2) 
          : 0;
        
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + dexMod;
        
        initiatives.push({
          playerId: player.id,
          playerName: player.name,
          characterName,
          roll,
          modifier: dexMod,
          total,
        });
      }
      
      // Add DM (enemies) to initiative order
      const dmRoll = Math.floor(Math.random() * 20) + 1;
      const dmModifier = 2; // Standard enemy dex modifier
      initiatives.push({
        playerId: "DM",
        playerName: "Grok DM",
        characterName: "Enemies",
        roll: dmRoll,
        modifier: dmModifier,
        total: dmRoll + dmModifier,
      });
      
      initiatives.sort((a, b) => b.total - a.total || b.roll - a.roll);
      
      const combatState: CombatState = {
        isActive: true,
        currentTurnIndex: 0,
        initiatives,
      };
      
      roomCombatState.set(roomCode, combatState);
      
      const combatMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `Combat has begun! Initiative order: ${initiatives.map((i, idx) => `${idx + 1}. ${i.characterName} (${i.total})`).join(", ")}`,
        type: "system",
        timestamp: new Date().toISOString(),
      };
      
      const updatedHistory = [...(room.messageHistory || []), combatMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });
      
      broadcastToRoom(roomCode, { type: "message", message: combatMessage });
      broadcastToRoom(roomCode, { type: "combat_update", combat: combatState });
    }

    if (message.type === "next_turn") {
      if (room.hostName !== playerName) {
        ws.send(JSON.stringify({ type: "error", content: "Only the host can advance turns." }));
        return;
      }
      
      const combatState = roomCombatState.get(roomCode);
      if (!combatState || !combatState.isActive) {
        ws.send(JSON.stringify({ type: "error", content: "No active combat." }));
        return;
      }
      
      combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.initiatives.length;
      
      let currentPlayer = combatState.initiatives[combatState.currentTurnIndex];
      let updatedHistory = room.messageHistory || [];
      
      // If it's the DM's turn, process DM actions BEFORE broadcasting
      // This ensures clients never get stuck waiting for the DM
      if (currentPlayer.playerId === "DM") {
        try {
          const players = await storage.getPlayersByRoom(room.id);
          const allCharacters = await storage.getCharactersByRoom(room.id);
          const partyCharacters: CharacterInfo[] = allCharacters.map(char => {
            const player = players.find(p => p.id === char.playerId);
            return {
              playerName: player?.name || "Unknown",
              characterName: char.name,
              stats: char.stats || {},
              notes: char.notes
            };
          });
          
          const freshRoom = await storage.getRoomByCode(roomCode);
          if (freshRoom) {
            const dmResponse = await generateCombatDMTurn(freshRoom, partyCharacters);
            
            const dmMessage: Message = {
              id: randomUUID(),
              roomId: room.id,
              playerName: "Grok DM",
              content: dmResponse,
              type: "dm",
              timestamp: new Date().toISOString(),
            };
            
            updatedHistory = [...(freshRoom.messageHistory || []), dmMessage].slice(-100);
            await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });
            
            broadcastToRoom(roomCode, { type: "message", message: dmMessage });
            
            // Advance past DM to next player
            combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.initiatives.length;
            currentPlayer = combatState.initiatives[combatState.currentTurnIndex];
          }
        } catch (error) {
          console.error("DM combat turn error:", error);
          // On error, still advance past DM to prevent lockout
          combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.initiatives.length;
          currentPlayer = combatState.initiatives[combatState.currentTurnIndex];
        }
      }
      
      // Now broadcast the turn message for the actual player (not DM)
      const turnMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `It's ${currentPlayer.characterName}'s turn!`,
        type: "system",
        timestamp: new Date().toISOString(),
      };
      
      const finalHistory = [...updatedHistory, turnMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: finalHistory, lastActivityAt: new Date() });
      
      broadcastToRoom(roomCode, { type: "message", message: turnMessage });
      broadcastToRoom(roomCode, { type: "combat_update", combat: combatState });
    }

    if (message.type === "end_combat") {
      if (room.hostName !== playerName) {
        ws.send(JSON.stringify({ type: "error", content: "Only the host can end combat." }));
        return;
      }
      
      roomCombatState.delete(roomCode);
      
      const endMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: "Combat has ended.",
        type: "system",
        timestamp: new Date().toISOString(),
      };
      
      const updatedHistory = [...(room.messageHistory || []), endMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });
      
      broadcastToRoom(roomCode, { type: "message", message: endMessage });
      broadcastToRoom(roomCode, { type: "combat_update", combat: null });
    }

    if (message.type === "get_combat_state") {
      const combatState = roomCombatState.get(roomCode) || null;
      ws.send(JSON.stringify({ type: "combat_update", combat: combatState }));
    }

    if (message.type === "drop_item") {
      const itemName = message.itemName;
      const quantity = message.quantity || 1;
      
      if (!itemName || typeof itemName !== "string") {
        ws.send(JSON.stringify({ type: "error", content: "Invalid drop item request" }));
        return;
      }
      
      const players = await storage.getPlayersByRoom(room.id);
      const player = players.find(p => p.name === playerName);
      
      const dropMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `${playerName} drops ${itemName}${quantity > 1 ? ` x${quantity}` : ""}.`,
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), dropMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(roomCode, { type: "message", message: dropMessage });
      if (player) {
        broadcastToRoom(roomCode, { type: "inventory_update", playerId: player.id });
      }
      return;
    }
  }

  // Process queued messages as a batch
  async function processBatch(roomCode: string, room: any) {
    const queue = messageQueue.get(roomCode);
    if (!queue || queue.length === 0) return;
    
    // Clear the queue and timer
    messageQueue.set(roomCode, []);
    const timer = batchTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      batchTimers.delete(roomCode);
    }
    
    try {
      const players = await storage.getPlayersByRoom(room.id);
      const playerCount = players.length;
      
      const allCharacters = await storage.getCharactersByRoom(room.id);
      const partyCharacters: CharacterInfo[] = allCharacters.map(char => {
        const player = players.find(p => p.id === char.playerId);
        return {
          playerName: player?.name || "Unknown",
          characterName: char.name,
          stats: char.stats || {},
          notes: char.notes
        };
      });
      
      let dmResponse: string;
      
      if (queue.length === 1) {
        // Single message - use original function for better context
        const msg = queue[0];
        const currentPlayer = players.find(p => p.name === msg.playerName);
        let playerInventory: { name: string; quantity: number }[] = [];
        if (currentPlayer) {
          const character = await storage.getCharacterByPlayer(currentPlayer.id, room.id);
          if (character) {
            const items = await storage.getInventoryByCharacter(character.id);
            playerInventory = items.map(item => ({ name: item.name, quantity: item.quantity }));
          }
        }
        
        dmResponse = await generateDMResponse(
          msg.content,
          room,
          msg.playerName,
          msg.diceResult,
          playerCount,
          playerInventory,
          partyCharacters
        );
      } else {
        // Multiple messages - use batched response
        console.log(`[Batching] Processing ${queue.length} messages in one API call`);
        const batchedMessages: BatchedMessage[] = queue.map(q => ({
          playerName: q.playerName,
          content: q.content,
          type: q.type,
          diceResult: q.diceResult
        }));
        
        dmResponse = await generateBatchedDMResponse(
          batchedMessages,
          room,
          playerCount,
          partyCharacters
        );
      }

      // Parse and handle [ITEM: PlayerName | ItemName | Quantity] tags
      const itemRegex = /\[ITEM:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(\d+)\s*\]/gi;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(dmResponse)) !== null) {
        const targetPlayerName = itemMatch[1].trim();
        const itemName = itemMatch[2].trim();
        const quantity = parseInt(itemMatch[3]) || 1;

        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (targetPlayer) {
          let character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
          if (!character) {
            character = await storage.createCharacter({
              playerId: targetPlayer.id,
              roomId: room.id,
              name: targetPlayer.name,
              gameSystem: room.gameSystem,
              stats: {},
              notes: null,
            });
          }

          await storage.createInventoryItem({
            characterId: character.id,
            name: itemName,
            description: null,
            quantity,
            grantedBy: "Grok DM",
          });

          broadcastToRoom(roomCode, { type: "inventory_update", playerId: targetPlayer.id });
        }
      }

      // Parse and handle [REMOVE_ITEM: PlayerName | ItemName | Quantity] tags
      const removeItemRegex = /\[REMOVE_ITEM:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(\d+)\s*\]/gi;
      let removeMatch;
      while ((removeMatch = removeItemRegex.exec(dmResponse)) !== null) {
        const targetPlayerName = removeMatch[1].trim();
        const itemName = removeMatch[2].trim();
        const quantityToRemove = parseInt(removeMatch[3]) || 1;

        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (targetPlayer) {
          const character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
          if (character) {
            const inventory = await storage.getInventoryByCharacter(character.id);
            const item = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
            
            if (item) {
              const newQuantity = item.quantity - quantityToRemove;
              if (newQuantity <= 0) {
                await storage.deleteInventoryItem(item.id);
              } else {
                await storage.updateInventoryItem(item.id, { quantity: newQuantity });
              }
              broadcastToRoom(roomCode, { type: "inventory_update", playerId: targetPlayer.id });
            } else {
              // Item not found - notify the room
              const errorMessage: Message = {
                id: randomUUID(),
                roomId: room.id,
                playerName: "System",
                content: `Could not remove "${itemName}" from ${targetPlayerName}'s inventory - item not found.`,
                type: "system",
                timestamp: new Date().toISOString(),
              };
              broadcastToRoom(roomCode, { type: "message", message: errorMessage });
            }
          }
        }
      }

      // Parse and handle [HP: PlayerName | CurrentHP/MaxHP] tags
      const hpRegex = /\[HP:\s*([^|]+)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let hpMatch;
      while ((hpMatch = hpRegex.exec(dmResponse)) !== null) {
        const targetPlayerName = hpMatch[1].trim();
        const currentHp = parseInt(hpMatch[2]);
        const maxHp = parseInt(hpMatch[3]);

        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (targetPlayer) {
          let character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
          if (character) {
            await storage.updateCharacter(character.id, { currentHp, maxHp });
            console.log(`[HP Update] ${targetPlayerName}: ${currentHp}/${maxHp}`);
            broadcastToRoom(roomCode, { 
              type: "character_update", 
              playerId: targetPlayer.id,
              characterId: character.id,
              currentHp,
              maxHp
            });
          }
        }
      }

      // Parse and handle [DEATH_SAVES: PlayerName | Successes/Failures] tags
      const deathSavesRegex = /\[DEATH_SAVES:\s*([^|]+)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let deathSavesMatch;
      while ((deathSavesMatch = deathSavesRegex.exec(dmResponse)) !== null) {
        const targetPlayerName = deathSavesMatch[1].trim();
        const successes = parseInt(deathSavesMatch[2]);
        const failures = parseInt(deathSavesMatch[3]);

        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (targetPlayer) {
          const character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
          if (character) {
            await storage.updateCharacter(character.id, { 
              deathSaveSuccesses: successes, 
              deathSaveFailures: failures 
            });
            console.log(`[Death Saves] ${targetPlayerName}: ${successes} successes, ${failures} failures`);
            broadcastToRoom(roomCode, { 
              type: "character_update", 
              playerId: targetPlayer.id,
              characterId: character.id,
              deathSaveSuccesses: successes,
              deathSaveFailures: failures
            });
          }
        }
      }

      // Parse and handle [DEAD: PlayerName] tags
      const deadRegex = /\[DEAD:\s*([^\]]+)\s*\]/gi;
      let deadMatch;
      const newlyDeadPlayers: string[] = [];
      while ((deadMatch = deadRegex.exec(dmResponse)) !== null) {
        const targetPlayerName = deadMatch[1].trim();

        const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
        
        if (targetPlayer) {
          const character = await storage.getCharacterByPlayer(targetPlayer.id, room.id);
          if (character && !character.isDead) {
            await storage.updateCharacter(character.id, { isDead: true });
            console.log(`[DEAD] ${targetPlayerName} has died!`);
            newlyDeadPlayers.push(targetPlayerName);
            broadcastToRoom(roomCode, { 
              type: "character_update", 
              playerId: targetPlayer.id,
              characterId: character.id,
              isDead: true
            });
          }
        }
      }

      // Check for TPK (Total Party Kill) - all player characters dead
      if (newlyDeadPlayers.length > 0) {
        const allCharacters = await storage.getCharactersByRoom(room.id);
        const playerCharacters = allCharacters.filter(c => 
          players.some(p => p.id === c.playerId && !p.isHost)
        );
        
        // If we have player characters and all are dead, trigger TPK
        if (playerCharacters.length > 0 && playerCharacters.every(c => c.isDead)) {
          console.log(`[TPK] Total Party Kill in room ${roomCode}!`);
          
          // Send TPK message before ending game
          const tpkMessage: Message = {
            id: randomUUID(),
            roomId: room.id,
            playerName: "System",
            content: "TOTAL PARTY KILL! All adventurers have fallen. The adventure has ended. You can download your adventure as a PDF to remember this epic tale.",
            type: "system",
            timestamp: new Date().toISOString(),
          };
          
          const tpkHistory = [...(room.messageHistory || []), tpkMessage].slice(-100);
          await storage.updateRoom(room.id, { 
            messageHistory: tpkHistory, 
            isActive: false,
            lastActivityAt: new Date() 
          });
          
          broadcastToRoom(roomCode, { type: "message", message: tpkMessage });
          broadcastToRoom(roomCode, { type: "game_ended", reason: "tpk" });
        }
      }

      // Parse and handle [COMBAT_START] tag - auto-initiate combat
      if (/\[COMBAT_START\]/i.test(dmResponse)) {
        const existingCombat = roomCombatState.get(roomCode);
        if (!existingCombat || !existingCombat.isActive) {
          console.log(`[Combat] AI triggered COMBAT_START for room ${roomCode}`);
          
          const initiatives: InitiativeEntry[] = [];
          
          for (const player of players) {
            const character = await storage.getCharacterByPlayer(player.id, room.id);
            const characterName = character?.name || player.name;
            const stats = (character?.stats || {}) as Record<string, unknown>;
            const dexMod = typeof stats.dexterity === "number" 
              ? Math.floor((stats.dexterity - 10) / 2) 
              : 0;
            
            const roll = Math.floor(Math.random() * 20) + 1;
            const total = roll + dexMod;
            
            initiatives.push({
              playerId: player.id,
              playerName: player.name,
              characterName,
              roll,
              modifier: dexMod,
              total,
            });
          }
          
          const dmRoll = Math.floor(Math.random() * 20) + 1;
          const dmModifier = 2;
          initiatives.push({
            playerId: "DM",
            playerName: "Grok DM",
            characterName: "Enemies",
            roll: dmRoll,
            modifier: dmModifier,
            total: dmRoll + dmModifier,
          });
          
          initiatives.sort((a, b) => b.total - a.total || b.roll - a.roll);
          
          const combatState: CombatState = {
            isActive: true,
            currentTurnIndex: 0,
            initiatives,
          };
          
          roomCombatState.set(roomCode, combatState);
          
          const combatMessage: Message = {
            id: randomUUID(),
            roomId: room.id,
            playerName: "System",
            content: `Combat has begun! Initiative order: ${initiatives.map((i, idx) => `${idx + 1}. ${i.characterName} (${i.total})`).join(", ")}`,
            type: "system",
            timestamp: new Date().toISOString(),
          };
          
          const combatHistory = [...(room.messageHistory || []), combatMessage].slice(-100);
          await storage.updateRoom(room.id, { messageHistory: combatHistory, lastActivityAt: new Date() });
          
          broadcastToRoom(roomCode, { type: "message", message: combatMessage });
          broadcastToRoom(roomCode, { type: "combat_update", combat: combatState });
        }
      }
      
      // Parse and handle [COMBAT_END] tag - auto-end combat
      if (/\[COMBAT_END\]/i.test(dmResponse)) {
        const existingCombat = roomCombatState.get(roomCode);
        if (existingCombat && existingCombat.isActive) {
          console.log(`[Combat] AI triggered COMBAT_END for room ${roomCode}`);
          
          roomCombatState.delete(roomCode);
          
          const endMessage: Message = {
            id: randomUUID(),
            roomId: room.id,
            playerName: "System",
            content: "Combat has ended.",
            type: "system",
            timestamp: new Date().toISOString(),
          };
          
          const endHistory = [...(room.messageHistory || []), endMessage].slice(-100);
          await storage.updateRoom(room.id, { messageHistory: endHistory, lastActivityAt: new Date() });
          
          broadcastToRoom(roomCode, { type: "message", message: endMessage });
          broadcastToRoom(roomCode, { type: "combat_update", combat: null });
        }
      }

      const cleanedResponse = dmResponse
        .replace(/\[ITEM:\s*[^\]]+\]/gi, "")
        .replace(/\[REMOVE_ITEM:\s*[^\]]+\]/gi, "")
        .replace(/\[HP:\s*[^\]]+\]/gi, "")
        .replace(/\[DEATH_SAVES:\s*[^\]]+\]/gi, "")
        .replace(/\[DEAD:\s*[^\]]+\]/gi, "")
        .replace(/\[COMBAT_START\]/gi, "")
        .replace(/\[COMBAT_END\]/gi, "")
        .trim();

      const dmMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "Grok DM",
        content: cleanedResponse,
        type: "dm",
        timestamp: new Date().toISOString(),
      };

      const finalHistory = [...(room.messageHistory || []), dmMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: finalHistory, lastActivityAt: new Date() });

      broadcastToRoom(roomCode, { type: "message", message: dmMessage });
    } catch (error) {
      console.error("Batch DM response error:", error);
    }
  }

  function broadcastToRoom(roomCode: string, data: any) {
    const connections = roomConnections.get(roomCode);
    if (connections) {
      const message = JSON.stringify(data);
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  app.get("/api/rooms/public", async (req, res) => {
    try {
      const gameSystem = req.query.gameSystem as string | undefined;
      const publicRooms = await storage.getPublicRooms(gameSystem);
      
      const safeRooms = publicRooms.map(room => ({
        id: room.id,
        code: room.code,
        name: room.name,
        gameSystem: room.gameSystem,
        hostName: room.hostName,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
        lastActivityAt: room.lastActivityAt,
      }));
      
      res.json(safeRooms);
    } catch (error) {
      console.error("Error fetching public rooms:", error);
      res.status(500).json({ error: "Failed to fetch public rooms" });
    }
  });

  app.post("/api/rooms", async (req, res) => {
    try {
      const { name, gameSystem, hostName, isPublic, maxPlayers } = req.body;
      
      if (!name || !hostName) {
        return res.status(400).json({ error: "Name and host name are required" });
      }

      const room = await storage.createRoom({
        name,
        gameSystem: gameSystem || "dnd",
        hostName,
        code: "",
        isPublic: isPublic || false,
        maxPlayers: maxPlayers || 8,
      });

      const hostPlayer = await storage.createPlayer({
        roomId: room.id,
        name: hostName,
        isHost: true,
      });

      const startingScene = await generateStartingScene(room.gameSystem, room.name);
      
      const dmMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "Grok DM",
        content: startingScene,
        type: "dm",
        timestamp: new Date().toISOString(),
      };

      await storage.updateRoom(room.id, { 
        messageHistory: [dmMessage],
        currentScene: startingScene.slice(0, 200),
        lastActivityAt: new Date(),
      });

      res.status(201).json({ ...room, hostPlayer });
    } catch (error) {
      console.error("Room creation error:", error);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  app.get("/api/rooms/:code", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      const players = await storage.getPlayersByRoom(room.id);
      res.json({ ...room, players });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.post("/api/rooms/:code/join", async (req, res) => {
    try {
      const { playerName } = req.body;
      
      if (!playerName) {
        return res.status(400).json({ error: "Player name is required" });
      }

      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (!room.isActive) {
        return res.status(400).json({ error: "Room is no longer active" });
      }

      // Check player limit
      const existingPlayers = await storage.getPlayersByRoom(room.id);
      const maxPlayers = room.maxPlayers || 8;
      if (existingPlayers.length >= maxPlayers) {
        return res.status(400).json({ error: `Room is full (maximum ${maxPlayers} players)` });
      }

      const player = await storage.createPlayer({
        roomId: room.id,
        name: playerName,
        isHost: false,
      });

      const joinMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `${playerName} has joined the game!`,
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), joinMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(req.params.code.toUpperCase(), { type: "message", message: joinMessage });
      broadcastToRoom(req.params.code.toUpperCase(), { type: "player_joined", player });

      res.json({ room, player });
    } catch (error) {
      console.error("Join error:", error);
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  app.get("/api/rooms/:code/messages", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room.messageHistory || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/rooms/:code/end", async (req, res) => {
    try {
      const { hostName } = req.body;
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the host can end the game" });
      }

      await storage.updateRoom(room.id, { isActive: false, lastActivityAt: new Date() });

      const endMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: "The game has ended. Thank you for playing!",
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), endMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(req.params.code.toUpperCase(), { type: "message", message: endMessage });
      broadcastToRoom(req.params.code.toUpperCase(), { type: "game_ended" });

      res.json({ success: true });
    } catch (error) {
      console.error("End game error:", error);
      res.status(500).json({ error: "Failed to end game" });
    }
  });

  app.post("/api/rooms/:code/visibility", async (req, res) => {
    try {
      const { hostName, isPublic } = req.body;
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the host can change visibility" });
      }

      await storage.updateRoom(room.id, { isPublic: isPublic ?? false });
      
      res.json({ success: true, isPublic: isPublic ?? false });
    } catch (error) {
      console.error("Visibility toggle error:", error);
      res.status(500).json({ error: "Failed to update visibility" });
    }
  });

  app.post("/api/rooms/:code/leave", async (req, res) => {
    try {
      const { playerId, playerName } = req.body;
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      await storage.deletePlayer(playerId);

      // Check if room is now empty - if so, delete it completely
      const remainingPlayers = await storage.getPlayersByRoom(room.id);
      if (remainingPlayers.length === 0) {
        console.log(`Room ${room.code} is empty, deleting all data...`);
        await storage.deleteRoomWithAllData(room.id);
        roomConnections.delete(req.params.code.toUpperCase());
        res.json({ success: true, roomDeleted: true });
        return;
      }

      const leaveMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `${playerName} has left the game.`,
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), leaveMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(req.params.code.toUpperCase(), { type: "message", message: leaveMessage });
      broadcastToRoom(req.params.code.toUpperCase(), { type: "player_left", playerId, playerName });

      res.json({ success: true });
    } catch (error) {
      console.error("Leave game error:", error);
      res.status(500).json({ error: "Failed to leave game" });
    }
  });

  app.post("/api/rooms/:code/kick", async (req, res) => {
    try {
      const { hostName, playerId } = req.body;
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the host can kick players" });
      }

      // Verify player belongs to this room
      const roomPlayers = await storage.getPlayersByRoom(room.id);
      const playerToKick = roomPlayers.find(p => p.id === playerId);
      
      if (!playerToKick) {
        return res.status(404).json({ error: "Player not found in this room" });
      }

      if (playerToKick.isHost) {
        return res.status(400).json({ error: "Cannot kick the host" });
      }

      await storage.deletePlayer(playerId);

      const kickMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `${playerToKick.name} was kicked from the game.`,
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), kickMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory, lastActivityAt: new Date() });

      broadcastToRoom(req.params.code.toUpperCase(), { type: "message", message: kickMessage });
      broadcastToRoom(req.params.code.toUpperCase(), { type: "player_kicked", playerId, playerName: playerToKick.name });

      res.json({ success: true });
    } catch (error) {
      console.error("Kick player error:", error);
      res.status(500).json({ error: "Failed to kick player" });
    }
  });

  app.post("/api/dice/roll", async (req, res) => {
    try {
      const { expression } = req.body;
      
      if (!expression || typeof expression !== "string") {
        return res.status(400).json({ error: "Expression is required" });
      }

      const result = parseDiceExpression(expression);
      
      if (!result) {
        return res.status(400).json({ error: "Invalid dice expression" });
      }

      const roll = await storage.createDiceRoll({
        expression: result.expression,
        rolls: result.rolls,
        modifier: result.modifier,
        total: result.total,
      });

      res.json({
        id: roll.id,
        expression: result.expression,
        rolls: result.rolls,
        modifier: result.modifier,
        total: result.total,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to roll dice" });
    }
  });

  // Character routes
  app.get("/api/rooms/:code/characters", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const characters = await storage.getCharactersByRoom(room.id);
      res.json(characters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch characters" });
    }
  });

  app.get("/api/rooms/:code/characters/:playerId", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      const character = await storage.getCharacterByPlayer(req.params.playerId, room.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      console.error("Character fetch error:", error);
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  app.post("/api/rooms/:code/characters", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code.toUpperCase());
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      const { playerId, name, stats, notes } = req.body;
      if (!playerId || !name) {
        return res.status(400).json({ error: "Player ID and character name are required" });
      }

      const existingChar = await storage.getCharacterByPlayer(playerId, room.id);
      if (existingChar) {
        const updated = await storage.updateCharacter(existingChar.id, { name, stats, notes });
        return res.json(updated);
      }

      const character = await storage.createCharacter({
        playerId,
        roomId: room.id,
        name,
        gameSystem: room.gameSystem,
        stats: stats || {},
        notes: notes || null,
      });

      // Add default starter inventory for new characters
      const defaultItems = room.gameSystem === "dnd" 
        ? [
            { name: "Backpack", description: "A sturdy leather backpack", quantity: 1 },
            { name: "Rations", description: "Trail rations for a day", quantity: 5 },
            { name: "Waterskin", description: "Holds water for the journey", quantity: 1 },
            { name: "Torch", description: "Provides light for 1 hour", quantity: 2 },
            { name: "Rope (50 ft)", description: "Hempen rope", quantity: 1 },
          ]
        : room.gameSystem === "cyberpunk"
        ? [
            { name: "Agent", description: "Personal phone/computer device", quantity: 1 },
            { name: "Credchip", description: "Electronic payment chip", quantity: 1 },
            { name: "Flashlight", description: "Portable light source", quantity: 1 },
          ]
        : [
            { name: "Basic Supplies", description: "Starting gear", quantity: 1 },
          ];

      for (const item of defaultItems) {
        await storage.createInventoryItem({
          characterId: character.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          grantedBy: "Starting Equipment",
        });
      }

      res.status(201).json(character);
    } catch (error) {
      console.error("Character creation error:", error);
      res.status(500).json({ error: "Failed to create character" });
    }
  });

  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const { name, stats, notes } = req.body;
      const character = await storage.updateCharacter(req.params.id, { name, stats, notes });
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // Inventory routes
  app.get("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const items = await storage.getInventoryByCharacter(req.params.characterId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { name, description, quantity, grantedBy } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Item name is required" });
      }
      const item = await storage.createInventoryItem({
        characterId: req.params.characterId,
        name,
        description: description || null,
        quantity: quantity || 1,
        grantedBy: grantedBy || null,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add item" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInventoryItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Spells API endpoint
  app.get("/api/spells", async (req, res) => {
    try {
      const spellsData = await import("../shared/data/spells.json");
      const spells = spellsData.default || spellsData;
      
      const { search, level, school, class: charClass, concentration, ritual } = req.query;
      
      let filteredSpells = [...spells];
      
      // Filter by search term (name or description)
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        filteredSpells = filteredSpells.filter(spell => 
          spell.name.toLowerCase().includes(searchLower) ||
          spell.description.toLowerCase().includes(searchLower)
        );
      }
      
      // Filter by level (can be comma-separated: "0,1,2")
      if (level && typeof level === "string") {
        const levels = level.split(",").map(l => parseInt(l.trim()));
        filteredSpells = filteredSpells.filter(spell => levels.includes(spell.level));
      }
      
      // Filter by school
      if (school && typeof school === "string") {
        const schoolLower = school.toLowerCase();
        filteredSpells = filteredSpells.filter(spell => 
          spell.school.toLowerCase() === schoolLower
        );
      }
      
      // Filter by class
      if (charClass && typeof charClass === "string") {
        const classLower = charClass.toLowerCase();
        filteredSpells = filteredSpells.filter(spell => 
          spell.classes.some(c => c.toLowerCase() === classLower)
        );
      }
      
      // Filter by concentration
      if (concentration !== undefined) {
        const conc = concentration === "true";
        filteredSpells = filteredSpells.filter(spell => spell.concentration === conc);
      }
      
      // Filter by ritual
      if (ritual !== undefined) {
        const rit = ritual === "true";
        filteredSpells = filteredSpells.filter(spell => spell.ritual === rit);
      }
      
      res.json(filteredSpells);
    } catch (error) {
      console.error("Spells fetch error:", error);
      res.status(500).json({ error: "Failed to fetch spells" });
    }
  });

  // Get single spell by ID
  app.get("/api/spells/:id", async (req, res) => {
    try {
      const spellsData = await import("../shared/data/spells.json");
      const spells = spellsData.default || spellsData;
      
      const spell = spells.find((s: any) => s.id === req.params.id);
      if (!spell) {
        return res.status(404).json({ error: "Spell not found" });
      }
      res.json(spell);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spell" });
    }
  });

  // Generate PDF adventure recap
  app.get("/api/rooms/:code/pdf", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      
      const players = await storage.getPlayersByRoom(room.id);
      const characters = await storage.getCharactersByRoom(room.id);
      const messages = room.messageHistory || [];
      
      // Import pdf-lib
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      
      const pdfDoc = await PDFDocument.create();
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const courier = await pdfDoc.embedFont(StandardFonts.Courier);
      
      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 50;
      const lineHeight = 14;
      const maxWidth = pageWidth - margin * 2;
      
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;
      
      const addNewPage = () => {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      };
      
      const wrapText = (text: string, font: any, fontSize: number, maxW: number): string[] => {
        // First handle newlines by splitting into paragraphs, then wrap each
        const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
        const allLines: string[] = [];
        
        for (const paragraph of paragraphs) {
          if (!paragraph.trim()) {
            allLines.push(''); // Preserve empty lines as paragraph breaks
            continue;
          }
          
          const words = paragraph.split(' ');
          let currentLine = '';
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = font.widthOfTextAtSize(testLine, fontSize);
            
            if (width > maxW && currentLine) {
              allLines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          
          if (currentLine) {
            allLines.push(currentLine);
          }
        }
        
        return allLines;
      };
      
      const drawText = (text: string, font: any, fontSize: number, color = rgb(0, 0, 0)) => {
        const lines = wrapText(text, font, fontSize, maxWidth);
        
        for (const line of lines) {
          if (yPosition < margin + lineHeight) {
            addNewPage();
          }
          
          // Skip empty lines but still add spacing
          if (line.trim()) {
            currentPage.drawText(line, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font,
              color,
            });
          }
          
          yPosition -= lineHeight;
        }
      };
      
      // Title
      currentPage.drawText("Adventure Recap", {
        x: margin,
        y: yPosition,
        size: 24,
        font: timesRomanBold,
        color: rgb(0.4, 0.2, 0.1),
      });
      yPosition -= 36;
      
      // Game info
      drawText(`Game: ${room.name}`, timesRomanBold, 14);
      yPosition -= 4;
      
      const gameSystemLabels: Record<string, string> = {
        dnd5e: "D&D 5th Edition",
        pathfinder: "Pathfinder 2e",
        cyberpunk: "Cyberpunk RED",
        coc: "Call of Cthulhu",
        daggerheart: "Daggerheart",
        custom: "Custom System",
      };
      drawText(`System: ${gameSystemLabels[room.gameSystem] || room.gameSystem}`, timesRoman, 12);
      drawText(`Date: ${new Date().toLocaleDateString()}`, timesRoman, 12);
      drawText(`Room Code: ${room.code}`, courier, 10, rgb(0.5, 0.5, 0.5));
      yPosition -= 12;
      
      // Players section
      drawText("Party Members", timesRomanBold, 14);
      yPosition -= 4;
      
      if (players.length === 0) {
        drawText("  (No players recorded)", timesRoman, 11, rgb(0.5, 0.5, 0.5));
      } else {
        for (const player of players) {
          const character = characters.find(c => c.playerId === player.id);
          const charName = character?.name || player.name;
          const isDead = character?.isDead ? " [DECEASED]" : "";
          const hostBadge = player.isHost ? " (Host/DM)" : "";
          drawText(`  - ${charName}${hostBadge}${isDead}`, timesRoman, 11);
        }
      }
      yPosition -= 12;
      
      // Adventure log
      drawText("Adventure Log", timesRomanBold, 14);
      yPosition -= 8;
      
      if (messages.length === 0) {
        drawText("(No adventure recorded)", timesRoman, 11, rgb(0.5, 0.5, 0.5));
      } else {
        for (const msg of messages) {
          if (msg.type === "system" && msg.content?.includes("joined")) continue;
          
          const content = msg.content || "";
          const timestamp = msg.timestamp 
            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "";
          
          if (msg.type === "dm") {
            yPosition -= 4;
            drawText(`[DM] ${content}`, timesRoman, 11, rgb(0.3, 0.15, 0.05));
          } else if (msg.type === "roll") {
            const rollInfo = msg.diceResult 
              ? ` (${msg.diceResult.expression}: ${msg.diceResult.total})`
              : "";
            drawText(`[${timestamp}] ${msg.playerName || "Unknown"}${rollInfo}`, courier, 10, rgb(0.4, 0.4, 0.6));
          } else if (msg.type === "action") {
            drawText(`[${timestamp}] *${msg.playerName || "Unknown"} ${content.replace(/^\*|\*$/g, '')}*`, timesRoman, 11, rgb(0.3, 0.3, 0.3));
          } else if (msg.type === "system") {
            drawText(`--- ${content} ---`, timesRoman, 10, rgb(0.5, 0.5, 0.5));
          } else {
            drawText(`[${timestamp}] ${msg.playerName || "Unknown"}: ${content}`, timesRoman, 11);
          }
        }
      }
      
      // Footer on last page
      yPosition -= 24;
      if (yPosition < margin + 30) addNewPage();
      drawText("Generated by Grok DM - AI-Powered Dungeon Master", timesRoman, 9, rgb(0.6, 0.6, 0.6));
      
      const pdfBytes = await pdfDoc.save();
      
      const filename = `${room.name.replace(/[^a-zA-Z0-9]/g, '_')}_adventure_${room.code}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
      
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Periodic cleanup job: Delete stale inactive rooms (older than 24 hours)
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
  const STALE_ROOM_HOURS = 24; // Delete rooms inactive for 24+ hours
  
  async function cleanupStaleRooms() {
    try {
      const staleRooms = await storage.getStaleInactiveRooms(STALE_ROOM_HOURS);
      for (const room of staleRooms) {
        console.log(`Cleaning up stale room: ${room.code} (inactive since ${room.lastActivityAt})`);
        await storage.deleteRoomWithAllData(room.id);
        roomConnections.delete(room.code);
      }
      if (staleRooms.length > 0) {
        console.log(`Cleaned up ${staleRooms.length} stale room(s)`);
      }
    } catch (error) {
      console.error("Stale room cleanup error:", error);
    }
  }
  
  // Run cleanup on startup and then periodically
  cleanupStaleRooms();
  setInterval(cleanupStaleRooms, CLEANUP_INTERVAL_MS);

  return httpServer;
}
