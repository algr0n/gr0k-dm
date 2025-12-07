import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { generateDMResponse, generateStartingScene, type CharacterInfo } from "./grok";
import { insertRoomSchema, insertCharacterSchema, insertInventoryItemSchema, type Message, type Character, type InventoryItem } from "@shared/schema";

const roomConnections = new Map<string, Set<WebSocket>>();

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

      if (!message.content.startsWith("/") || diceMatch) {
        try {
          // Get player count, characters, and current player's inventory for AI context
          const players = await storage.getPlayersByRoom(room.id);
          const playerCount = players.length;
          
          // Get all characters in the room
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
          
          // Find current player and get their inventory
          const currentPlayer = players.find(p => p.name === playerName);
          let playerInventory: { name: string; quantity: number }[] = [];
          if (currentPlayer) {
            const character = await storage.getCharacterByPlayer(currentPlayer.id, room.id);
            if (character) {
              const items = await storage.getInventoryByCharacter(character.id);
              playerInventory = items.map(item => ({ name: item.name, quantity: item.quantity }));
            }
          }

          let dmResponse = await generateDMResponse(
            message.content,
            { ...room, messageHistory: updatedHistory },
            playerName,
            diceResult,
            playerCount,
            playerInventory,
            partyCharacters
          );

          // Parse and handle [ITEM: PlayerName | ItemName | Quantity] tags
          const itemMatches = dmResponse.matchAll(/\[ITEM:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(\d+)\s*\]/gi);
          for (const match of itemMatches) {
            const targetPlayerName = match[1].trim();
            const itemName = match[2].trim();
            const quantity = parseInt(match[3]) || 1;

            // Find the target player
            const players = await storage.getPlayersByRoom(room.id);
            const targetPlayer = players.find(p => p.name.toLowerCase() === targetPlayerName.toLowerCase());
            
            if (targetPlayer) {
              // Get or create character for target player
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

              // Add item to inventory
              await storage.createInventoryItem({
                characterId: character.id,
                name: itemName,
                description: null,
                quantity,
                grantedBy: "Grok DM",
              });

              // Notify player of inventory update
              broadcastToRoom(roomCode, { type: "inventory_update", playerId: targetPlayer.id });
            }
          }

          // Remove the [ITEM:...] tags from the displayed message
          const cleanedResponse = dmResponse.replace(/\[ITEM:\s*[^\]]+\]/gi, "").trim();

          const dmMessage: Message = {
            id: randomUUID(),
            roomId: room.id,
            playerName: "Grok DM",
            content: cleanedResponse,
            type: "dm",
            timestamp: new Date().toISOString(),
          };

          const finalHistory = [...updatedHistory, dmMessage].slice(-100);
          await storage.updateRoom(room.id, { messageHistory: finalHistory, lastActivityAt: new Date() });

          broadcastToRoom(roomCode, { type: "message", message: dmMessage });
        } catch (error) {
          console.error("DM response error:", error);
        }
      }
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

  app.post("/api/rooms", async (req, res) => {
    try {
      const { name, gameSystem, hostName } = req.body;
      
      if (!name || !hostName) {
        return res.status(400).json({ error: "Name and host name are required" });
      }

      const room = await storage.createRoom({
        name,
        gameSystem: gameSystem || "dnd",
        hostName,
        code: "",
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

      // Check player limit (max 8 players per room)
      const existingPlayers = await storage.getPlayersByRoom(room.id);
      if (existingPlayers.length >= 8) {
        return res.status(400).json({ error: "Room is full (maximum 8 players)" });
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
