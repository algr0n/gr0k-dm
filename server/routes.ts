import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { generateDMResponse, generateStartingScene } from "./grok";
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
      await storage.updateRoom(room.id, { messageHistory: updatedHistory });

      broadcastToRoom(roomCode, { type: "message", message: chatMessage });

      if (!message.content.startsWith("/") || diceMatch) {
        try {
          const dmResponse = await generateDMResponse(
            message.content,
            { ...room, messageHistory: updatedHistory },
            playerName,
            diceResult
          );

          const dmMessage: Message = {
            id: randomUUID(),
            roomId: room.id,
            playerName: "Grok DM",
            content: dmResponse,
            type: "dm",
            timestamp: new Date().toISOString(),
          };

          const finalHistory = [...updatedHistory, dmMessage].slice(-100);
          await storage.updateRoom(room.id, { messageHistory: finalHistory });

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
      await storage.updateRoom(room.id, { messageHistory: updatedHistory });

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

      await storage.updateRoom(room.id, { isActive: false });

      const endMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: "The game has ended. Thank you for playing!",
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), endMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory });

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

      const leaveMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "System",
        content: `${playerName} has left the game.`,
        type: "system",
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...(room.messageHistory || []), leaveMessage].slice(-100);
      await storage.updateRoom(room.id, { messageHistory: updatedHistory });

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

  return httpServer;
}
