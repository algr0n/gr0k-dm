import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { generateDMResponse, generateBatchedDMResponse, generateStartingScene, generateCombatDMTurn, type CharacterInfo, type BatchedMessage, type DroppedItemInfo, getTokenUsage } from "./grok";
import { insertRoomSchema, insertCharacterSchema, insertInventoryItemSchema, insertSavedCharacterSchema, updateUserProfileSchema, type Message, type Character, type InventoryItem } from "@shared/schema";
import { setupAuth, isAuthenticated, getSession } from "./auth";
import passport from "passport";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  playerName?: string;
}

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

// Track dropped items per room (items on the ground that players can pick up)
interface DroppedItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  location: string; // e.g., "on the goblin's body"
}

const roomDroppedItems = new Map<string, DroppedItem[]>();

// Starting items by D&D class
const dndStartingItems: Record<string, string[]> = {
  fighter: ["longsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  wizard: ["quarterstaff", "dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  rogue: ["shortsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  cleric: ["mace", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  ranger: ["longbow", "shortsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  paladin: ["longsword", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  barbarian: ["greataxe", "handaxe", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  bard: ["rapier", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  druid: ["quarterstaff", "dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  monk: ["quarterstaff", "dart", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
  sorcerer: ["dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  warlock: ["dagger", "backpack", "component-pouch", "rations-1-day", "waterskin", "torch"],
  default: ["dagger", "backpack", "bedroll", "rations-1-day", "waterskin", "torch"],
};

// Helper function to grant starting items to a new room character
async function grantStartingItems(
  roomCharacterId: string,
  gameSystem: string,
  characterClass: string | null | undefined
): Promise<void> {
  if (gameSystem === "dnd") {
    const classKey = (characterClass || "default").toLowerCase();
    const itemIds = dndStartingItems[classKey] || dndStartingItems.default;
    
    for (const itemId of itemIds) {
      try {
        await storage.addToRoomInventory({
          roomCharacterId,
          itemId,
          quantity: itemId === "rations-1-day" ? 5 : itemId === "torch" ? 5 : 1,
          grantedBy: "Starting Equipment",
        });
      } catch (error) {
        console.error(`Failed to add starting item ${itemId}:`, error);
      }
    }
  }
  // Cyberpunk items would go here when added to the items table
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ noServer: true });
  const sessionMiddleware = getSession();

  // Handle WebSocket upgrade manually to avoid conflicts with Vite HMR
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url?.split("?")[0];
    
    // Skip Vite HMR connections
    if (pathname === "/vite-hmr") {
      return; // Let Vite handle this
    }
    
    // Create mock request/response for session parsing
    const mockReq = request as any;
    const mockRes = { 
      setHeader: () => {}, 
      end: () => {},
      getHeader: () => undefined 
    } as any;
    
    // Parse session to get authenticated user
    sessionMiddleware(mockReq, mockRes, () => {
      passport.initialize()(mockReq, mockRes, () => {
        passport.session()(mockReq, mockRes, async () => {
          const user = mockReq.user as Express.User | undefined;
          
          // Reject unauthenticated connections
          if (!user?.id) {
            console.log("[WebSocket] Rejecting unauthenticated connection");
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
          
          const userId = user.id;
          const playerName = user.username || user.email || "Player";
          
          // Verify user is a member of the room by userId
          const urlParams = new URLSearchParams(request.url?.split("?")[1]);
          const roomCode = urlParams.get("room") || urlParams.get("roomCode");
          
          if (roomCode) {
            const room = await storage.getRoomByCode(roomCode);
            if (room) {
              const players = await storage.getPlayersByRoom(room.id);
              const isRoomMember = players.some(p => p.userId === userId);
              if (!isRoomMember) {
                console.log("[WebSocket] User not a member of room:", roomCode, userId);
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.destroy();
                return;
              }
            }
          }
          
          wss.handleUpgrade(request, socket, head, (ws) => {
            (ws as AuthenticatedWebSocket).userId = userId;
            (ws as AuthenticatedWebSocket).playerName = playerName;
            wss.emit("connection", ws, request);
          });
        });
      });
    });
  });

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    const urlParams = new URLSearchParams(req.url?.split("?")[1]);
    const roomCode = urlParams.get("room") || urlParams.get("roomCode");

    if (!roomCode) {
      ws.close(1008, "Room code required");
      return;
    }

    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, new Set());
    }
    roomConnections.get(roomCode)!.add(ws);

    const playerName = ws.playerName || "Anonymous";

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "chat" || message.type === "action") {
          // Queue the message for batch processing
          await queueMessage(roomCode, {
            type: message.type,
            playerName: playerName,
            content: message.content,
            timestamp: Date.now(),
          });
        } else if (message.type === "get_combat_state") {
          // Send current combat state
          const combatState = roomCombatState.get(roomCode);
          if (combatState) {
            ws.send(JSON.stringify({ type: "combat_update", combat: combatState }));
          }
        }
      } catch (error) {
        console.error("[WebSocket] Message parsing error:", error);
      }
    });

    ws.on("close", () => {
      roomConnections.get(roomCode)?.delete(ws);
      if (roomConnections.get(roomCode)?.size === 0) {
        roomConnections.delete(roomCode);
        messageQueue.delete(roomCode);
        roomCombatState.delete(roomCode);
        roomDroppedItems.delete(roomCode);
      }
    });
  });

  function broadcastToRoom(roomCode: string, message: any) {
    const connections = roomConnections.get(roomCode);
    if (connections) {
      const payload = JSON.stringify(message);
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  async function queueMessage(roomCode: string, msg: QueuedMessage) {
    if (!messageQueue.has(roomCode)) {
      messageQueue.set(roomCode, []);
    }
    messageQueue.get(roomCode)!.push(msg);

    // Broadcast individual message immediately for real-time feel
    broadcastToRoom(roomCode, {
      type: msg.type,
      playerName: msg.playerName,
      content: msg.content,
      timestamp: msg.timestamp,
      diceResult: msg.diceResult,
    });

    if (batchTimers.has(roomCode)) {
      clearTimeout(batchTimers.get(roomCode)!);
    }

    batchTimers.set(
      roomCode,
      setTimeout(() => processBatch(roomCode), BATCH_DELAY_MS)
    );
  }

  async function processBatch(roomCode: string) {
    const queue = messageQueue.get(roomCode);
    if (!queue || queue.length === 0) return;

    // Take up to MAX_BATCH_SIZE messages
    const batch = queue.splice(0, Math.min(MAX_BATCH_SIZE, queue.length));
    messageQueue.set(roomCode, queue); // Update queue

    const room = await storage.getRoomByCode(roomCode);
    if (!room) return;

    // Get characters for context
    const characters = await storage.getCharactersByRoom(room.id);
    const characterInfos: CharacterInfo[] = characters.map((char) => ({
      name: char.characterName,
      race: char.race || "unknown",
      class: char.class || "unknown",
      level: char.level,
      currentHp: char.currentHp,
      maxHp: char.maxHp,
      ac: char.ac,
      initiativeModifier: char.initiativeModifier,
      backstory: char.backstory || "",
      skills: char.skills as string[],
      spells: char.spells as string[],
    }));

    // Prepare batched messages
    const batchedMessages: BatchedMessage[] = batch.map((msg) => ({
      playerName: msg.playerName,
      content: msg.content,
      type: msg.type,
      diceResult: msg.diceResult,
    }));

    try {
      // Generate batched DM response
      const dmResponse = await generateBatchedDMResponse(
        batchedMessages,
        room,
        undefined, // playerCount
        characterInfos
      );

      // Send DM response
      const dmMessage: Message = {
        id: randomUUID(),
        roomId: room.id,
        playerName: "DM",
        content: dmResponse,
        type: "dm",
        timestamp: Date.now().toString(),
      };

      broadcastToRoom(roomCode, dmMessage);

      // Update room history
      const updatedHistory = [
        ...room.messageHistory,
        ...batch.map((msg) => ({
          id: randomUUID(),
          roomId: room.id,
          playerName: msg.playerName,
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp.toString(),
          diceResult: msg.diceResult,
        })),
        dmMessage,
      ];

      await storage.updateRoom(room.id, {
        messageHistory: updatedHistory,
        lastActivityAt: new Date(),
      });

      console.log(`Processed batch of ${batch.length} messages for room ${roomCode}`);
    } catch (error) {
      console.error(`Batch processing error for room ${roomCode}:`, error);
      broadcastToRoom(roomCode, {
        type: "system",
        content: "The DM is pondering... please try again.",
      });
    }
  }

  // Auth setup - uses Replit Auth
  await setupAuth(app);

  // Auth routes - get current user
  app.get("/api/auth/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const userId = req.user!.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile update route
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const parseResult = updateUserProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid profile data", details: parseResult.error.flatten() });
      }
      
      const { username, customProfileImageUrl } = parseResult.data;
      
      const updates: { username?: string; customProfileImageUrl?: string | null } = {};
      if (username !== undefined) {
        updates.username = username;
      }
      if (customProfileImageUrl !== undefined) {
        updates.customProfileImageUrl = customProfileImageUrl;
      }
      
      const user = await storage.updateUserProfile(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Profile image upload URL
  app.post("/api/profile/upload-url", isAuthenticated, async (req, res) => {
    try {
      if (!process.env.PRIVATE_OBJECT_DIR) {
        return res.status(503).json({ 
          error: "Image uploads not configured",
          message: "Profile picture uploads are not available. Object storage needs to be set up."
        });
      }
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Profile image update (after upload completes)
  app.put("/api/profile/image", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageUrl,
        {
          owner: userId,
          visibility: "public",
        }
      );

      const user = await storage.updateUserProfile(userId, { customProfileImageUrl: objectPath });
      res.json({ objectPath, user });
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ error: "Failed to update profile image" });
    }
  });

  // Serve uploaded objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      const { ObjectNotFoundError } = await import("./objectStorage");
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Saved characters routes (requires authentication)
  app.get("/api/saved-characters", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const characters = await storage.getSavedCharactersByUser(userId);
      res.json(characters);
    } catch (error) {
      console.error("Error fetching saved characters:", error);
      res.status(500).json({ error: "Failed to fetch saved characters" });
    }
  });

  app.post("/api/saved-characters", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const parsed = insertSavedCharacterSchema.parse({ ...req.body, userId });
      const character = await storage.createSavedCharacter(parsed);
      res.json(character);
    } catch (error) {
      console.error("Error creating saved character:", error);
      res.status(400).json({ error: "Invalid character data" });
    }
  });

  app.get("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const character = await storage.getSavedCharacter(id);
      if (!character || character.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  app.patch("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const existing = await storage.getSavedCharacter(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      const character = await storage.updateSavedCharacter(id, req.body);
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  app.delete("/api/saved-characters/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const existing = await storage.getSavedCharacter(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Character not found" });
      }
      await storage.deleteSavedCharacter(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // Room creation
  app.post("/api/rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Host";
      
      const parsed = insertRoomSchema.parse({ ...req.body, hostName: playerName });
      const room = await storage.createRoom(parsed);
      
      // Create host player
      const hostPlayer = await storage.createPlayer({
        roomId: room.id,
        userId: userId,
        name: playerName,
        isHost: true,
      });
      
      res.json({ ...room, hostPlayer });
    } catch (error) {
      res.status(400).json({ error: "Invalid room data" });
    }
  });

  // Join room
  app.post("/api/rooms/:code/join", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      const existingPlayers = await storage.getPlayersByRoom(room.id);
      if (existingPlayers.length >= room.maxPlayers) {
        return res.status(400).json({ error: "Room is full" });
      }

      const existingPlayer = existingPlayers.find((p) => p.userId === userId);
      if (existingPlayer) {
        return res.status(400).json({ error: "You have already joined this room" });
      }

      const player = await storage.createPlayer({
        roomId: room.id,
        userId: userId,
        name: playerName,
        isHost: existingPlayers.length === 0,
      });

      // If savedCharacterId provided, create a room character instance
      let roomCharacter = null;
      if (savedCharacterId) {
        const savedCharacter = await storage.getSavedCharacter(savedCharacterId);
        if (!savedCharacter) {
          return res.status(404).json({ error: "Character not found" });
        }
        
        // Validate ownership
        if (savedCharacter.userId !== userId) {
          return res.status(403).json({ error: "You do not own this character" });
        }
        
        // Validate game system match
        if (savedCharacter.gameSystem !== room.gameSystem) {
          return res.status(400).json({ error: "Character game system does not match room" });
        }
        
        roomCharacter = await storage.createRoomCharacter({
          roomId: room.id,
          savedCharacterId: savedCharacterId,
          userId: savedCharacter.userId,
          playerName: playerName,
          currentHp: savedCharacter.maxHp,
          isAlive: true,
          experience: 0,
          temporaryHp: 0,
          gold: 0,
        });
        
        // Grant starting items based on game system and class
        await grantStartingItems(roomCharacter.id, room.gameSystem, savedCharacter.class);
      }

      await storage.updateRoomActivity(room.id);

      broadcastToRoom(code, {
        type: "system",
        content: `${playerName} has joined the adventure!`,
      });

      res.json({ room, player, roomCharacter });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  // Join room with character (for host after room creation)
  app.post("/api/rooms/:code/join-with-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      if (!savedCharacterId) {
        return res.status(400).json({ error: "savedCharacterId is required" });
      }

      const savedCharacter = await storage.getSavedCharacter(savedCharacterId);
      if (!savedCharacter) {
        return res.status(404).json({ error: "Saved character not found" });
      }
      
      // Validate ownership
      if (savedCharacter.userId !== userId) {
        return res.status(403).json({ error: "You do not own this character" });
      }
      
      // Validate game system match
      if (savedCharacter.gameSystem !== room.gameSystem) {
        return res.status(400).json({ error: "Character game system does not match room" });
      }

      // Create room character instance
      const roomCharacter = await storage.createRoomCharacter({
        roomId: room.id,
        savedCharacterId: savedCharacterId,
        userId: savedCharacter.userId,
        playerName: playerName,
        currentHp: savedCharacter.maxHp,
        isAlive: true,
        experience: 0,
        temporaryHp: 0,
        gold: 0,
      });

      // Grant starting items based on game system and class
      await grantStartingItems(roomCharacter.id, room.gameSystem, savedCharacter.class);

      res.json({ roomCharacter });
    } catch (error) {
      console.error("Error joining room with character:", error);
      res.status(500).json({ error: "Failed to join room with character" });
    }
  });

  // Switch to a new character when current one is dead
  app.post("/api/rooms/:code/switch-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { savedCharacterId } = req.body;
      const userId = req.user!.id;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      const playerName = user.username || user.email || "Player";

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      // Get current room character
      const currentRoomCharacter = await storage.getRoomCharacterByUserInRoom(userId, room.id);
      if (!currentRoomCharacter) {
        return res.status(404).json({ error: "No current character in this room" });
      }

      // Only allow switching if character is dead
      if (currentRoomCharacter.isAlive) {
        return res.status(400).json({ error: "Cannot switch character while current character is alive" });
      }

      // Validate the new character
      const savedCharacter = await storage.getSavedCharacter(savedCharacterId);
      if (!savedCharacter) {
        return res.status(404).json({ error: "Saved character not found" });
      }

      if (savedCharacter.userId !== userId) {
        return res.status(403).json({ error: "You do not own this character" });
      }

      if (savedCharacter.gameSystem !== room.gameSystem) {
        return res.status(400).json({ error: "Character game system does not match room" });
      }

      // Delete the old room character and its status effects
      await storage.deleteStatusEffectsByRoomCharacter(currentRoomCharacter.id);
      await storage.deleteRoomCharacter(currentRoomCharacter.id);

      // Create new room character instance
      const roomCharacter = await storage.createRoomCharacter({
        roomId: room.id,
        savedCharacterId: savedCharacterId,
        userId: userId,
        playerName: playerName,
        currentHp: savedCharacter.maxHp,
        isAlive: true,
        experience: 0,
        temporaryHp: 0,
        gold: 0,
      });

      res.json({ roomCharacter, savedCharacter });
    } catch (error) {
      console.error("Error switching character:", error);
      res.status(500).json({ error: "Failed to switch character" });
    }
  });

  // Get current player's room character with saved character data
  app.get("/api/rooms/:code/my-character", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.user!.id;

      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const roomCharacter = await storage.getRoomCharacterByUserInRoom(userId, room.id);
      if (!roomCharacter) {
        return res.status(404).json({ error: "No character in this room" });
      }

      const savedCharacter = await storage.getSavedCharacter(roomCharacter.savedCharacterId);
      if (!savedCharacter) {
        return res.status(404).json({ error: "Saved character not found" });
      }

      const statusEffects = await storage.getStatusEffectsByRoomCharacter(roomCharacter.id);

      res.json({
        roomCharacter,
        savedCharacter,
        statusEffects,
      });
    } catch (error) {
      console.error("Error fetching my character:", error);
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  // Get all room characters in a room (for DM and player views)
  app.get("/api/rooms/:code/room-characters", async (req, res) => {
    try {
      const { code } = req.params;
      
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const roomCharacters = await storage.getRoomCharactersByRoom(room.id);
      
      // Fetch saved character data for each room character
      const charactersWithData = await Promise.all(
        roomCharacters.map(async (rc) => {
          const savedCharacter = await storage.getSavedCharacter(rc.savedCharacterId);
          const statusEffects = await storage.getStatusEffectsByRoomCharacter(rc.id);
          return {
            roomCharacter: rc,
            savedCharacter,
            statusEffects,
          };
        })
      );

      res.json(charactersWithData);
    } catch (error) {
      console.error("Error fetching room characters:", error);
      res.status(500).json({ error: "Failed to fetch room characters" });
    }
  });

  // Get room info
  app.get("/api/rooms/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const players = await storage.getPlayersByRoom(room.id);
      const characters = await storage.getCharactersByRoom(room.id);

      // Return room data merged with players and characters for frontend compatibility
      res.json({ ...room, players, characters });
    } catch (error) {
      console.error("Error getting room info:", error);
      res.status(500).json({ error: "Failed to get room info" });
    }
  });

  // Update room
  app.patch("/api/rooms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const room = await storage.updateRoom(id, updates);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  // End room
  app.post("/api/rooms/:code/end", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      await storage.updateRoom(room.id, { isActive: false });

      broadcastToRoom(code, {
        type: "system",
        content: "The adventure has ended. Thanks for playing!",
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to end room" });
    }
  });

  // Get public rooms
  app.get("/api/rooms/public", async (req, res) => {
    try {
      const { gameSystem } = req.query;
      const rooms = await storage.getPublicRooms(gameSystem as string | undefined);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to get public rooms" });
    }
  });

  // Character creation
  app.post("/api/characters", async (req, res) => {
    try {
      const parsed = insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(parsed);
      res.json(character);
    } catch (error) {
      res.status(400).json({ error: "Invalid character data" });
    }
  });

  // Update character
  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const character = await storage.updateCharacter(id, updates);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // Inventory management
  app.post("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const parsed = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem({ ...parsed, characterId });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid inventory item" });
    }
  });

  // Handle player messages via HTTP (fallback or for non-WS clients)
  app.post("/api/rooms/:code/messages", async (req, res) => {
    try {
      const { code } = req.params;
      const { playerName, content } = req.body;

      const room = await storage.getRoomByCode(code);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Room not found or inactive" });
      }

      // Check for dice roll
      let diceResult;
      if (content.startsWith("/roll ")) {
        const expression = content.slice(6).trim();
        diceResult = parseDiceExpression(expression);
        if (diceResult) {
          await storage.createDiceRoll({
            roomId: room.id,
            playerId: "", // TODO: Add playerId if available
            expression: diceResult.expression,
            rolls: diceResult.rolls,
            modifier: diceResult.modifier,
            total: diceResult.total,
            purpose: "player roll",
          });
        }
      }

      const msgType = diceResult ? "roll" : content.startsWith("/me ") ? "action" : "chat";
      const msgContent = msgType === "action" ? content.slice(4) : content;

      // Queue for batching
      await queueMessage(code, {
        playerName,
        content: msgContent,
        type: msgType,
        diceResult,
        timestamp: Date.now(),
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Combat management
  app.post("/api/rooms/:code/combat/start", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const players = await storage.getPlayersByRoom(room.id);
      const characters = await storage.getCharactersByRoom(room.id);

      const initiatives: InitiativeEntry[] = [];
      for (const char of characters) {
        const player = players.find((p) => p.id === char.playerId);
        if (!player) continue;

        // Simulate initiative roll: d20 + modifier
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + char.initiativeModifier;

        initiatives.push({
          playerId: player.id,
          playerName: player.name,
          characterName: char.characterName,
          roll,
          modifier: char.initiativeModifier,
          total,
        });
      }

      // Sort by total descending
      initiatives.sort((a, b) => b.total - a.total);

      roomCombatState.set(code, {
        isActive: true,
        currentTurnIndex: 0,
        initiatives,
      });

      // Broadcast initiative order
      broadcastToRoom(code, {
        type: "system",
        content: "Combat begins! Initiative order:",
        initiatives: initiatives.map((entry) => `${entry.characterName} (${entry.total})`),
      });

      // Generate starting combat scene if needed
      const startingScene = await generateStartingScene(room.gameSystem, room.name);
      broadcastToRoom(code, {
        type: "dm",
        content: startingScene,
      });

      res.json({ success: true, initiatives });
    } catch (error) {
      res.status(500).json({ error: "Failed to start combat" });
    }
  });

  app.post("/api/rooms/:code/combat/turn", async (req, res) => {
    try {
      const { code } = req.params;
      const state = roomCombatState.get(code);
      if (!state || !state.isActive) {
        return res.status(400).json({ error: "No active combat" });
      }

      const current = state.initiatives[state.currentTurnIndex];
      broadcastToRoom(code, {
        type: "system",
        content: `It's ${current.characterName}'s (${current.playerName}) turn!`,
      });

      // If it's an enemy turn (assuming enemies are after players), generate AI turn
      if (state.currentTurnIndex >= state.initiatives.length / 2) { // Simple heuristic
        const room = await storage.getRoomByCode(code);
        if (room) {
          const enemyActions = await generateCombatDMTurn(room);
          broadcastToRoom(code, {
            type: "dm",
            content: enemyActions,
          });
        }
      }

      // Advance turn
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.initiatives.length;

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process turn" });
    }
  });

  // Dropped items interaction
  app.post("/api/rooms/:code/items/drop", async (req, res) => {
    try {
      const { code } = req.params;
      const { item }: { item: DroppedItemInfo } = req.body;

      if (!roomDroppedItems.has(code)) {
        roomDroppedItems.set(code, []);
      }

      const droppedId = randomUUID();
      roomDroppedItems.get(code)!.push({ ...item, id: droppedId });

      broadcastToRoom(code, {
        type: "system",
        content: `An item has been dropped: ${item.name} (${item.quantity}) at ${item.location}`,
      });

      res.json({ success: true, droppedId });
    } catch (error) {
      res.status(500).json({ error: "Failed to drop item" });
    }
  });

  app.post("/api/rooms/:code/items/pickup", async (req, res) => {
    try {
      const { code } = req.params;
      const { droppedId, characterId } = req.body;

      const droppedList = roomDroppedItems.get(code);
      if (!droppedList) return res.status(404).json({ error: "No dropped items" });

      const itemIndex = droppedList.findIndex((i) => i.id === droppedId);
      if (itemIndex === -1) return res.status(404).json({ error: "Item not found" });

      const item = droppedList[itemIndex];
      droppedList.splice(itemIndex, 1);

      // Add to character inventory
      await storage.addToInventory({
        characterId,
        itemId: item.name.toLowerCase().replace(/\s/g, "-"), // Approximate ID
        quantity: item.quantity,
      });

      broadcastToRoom(code, {
        type: "system",
        content: `Item picked up: ${item.name} (${item.quantity})`,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to pickup item" });
    }
  });

  // Token usage stats (for admin/debug)
  app.get("/api/stats/token-usage/:roomId", async (req, res) => {
    try {
      const { roomId } = req.params;
      const usage = getTokenUsage(roomId);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to get token usage" });
    }
  });

  // Generate PDF adventure log
  app.get("/api/rooms/:code/export-pdf", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const PDFDocument = require("pdfkit");
      const pdfDoc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      // Title page
      pdfDoc.fontSize(28).text(room.name, { align: "center" });
      pdfDoc.fontSize(16).text(`Game System: ${room.gameSystem.toUpperCase()}`, { align: "center" });
      pdfDoc.fontSize(14).text(`Hosted by: ${room.hostName}`, { align: "center" });
      pdfDoc.moveDown(2);

      // Adventure log
      pdfDoc.fontSize(20).text("Adventure Log");
      pdfDoc.moveDown();

      for (const msg of room.messageHistory) {
        const color = msg.type === "dm" ? "rgb(0.2, 0.5, 0.8)" : "rgb(0.1, 0.1, 0.1)";
        pdfDoc.fontSize(12).fillColor(color).text(`${msg.playerName}: ${msg.content}`);
        if (msg.diceResult) {
          pdfDoc.fillColor("rgb(0.5, 0.5, 0.5)").text(`[Roll: ${msg.diceResult.total}]`);
        }
        pdfDoc.moveDown(0.5);
      }

      // Characters section
      const characters = await storage.getCharactersByRoom(room.id);
      pdfDoc.addPage().fontSize(20).fillColor("black").text("Characters");
      for (const char of characters) {
        pdfDoc.fontSize(14).text(char.characterName);
        pdfDoc.fontSize(12).text(`Race: ${char.race} | Class: ${char.class} | Level: ${char.level}`);
        pdfDoc.moveDown();
      }

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

  // DM Controls API - Update room character stats
  app.patch("/api/room-characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode, ...updates } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can modify character stats" });
      }

      const roomCharacter = await storage.getRoomCharacter(id);
      if (!roomCharacter || roomCharacter.roomId !== room.id) {
        return res.status(404).json({ error: "Character not found in this room" });
      }

      const updatedCharacter = await storage.updateRoomCharacter(id, updates);
      
      // Broadcast update to room
      broadcastToRoom(roomCode, {
        type: "character_update",
        roomCharacterId: id,
        updates,
      });

      res.json(updatedCharacter);
    } catch (error) {
      console.error("Error updating room character:", error);
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  // DM Controls API - Add status effect
  app.post("/api/room-characters/:id/status-effects", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode, name, description, duration, isPredefined = true } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can apply status effects" });
      }

      const roomCharacter = await storage.getRoomCharacter(id);
      if (!roomCharacter || roomCharacter.roomId !== room.id) {
        return res.status(404).json({ error: "Character not found in this room" });
      }

      const effect = await storage.createStatusEffect({
        roomCharacterId: id,
        name,
        description,
        duration,
        isPredefined,
        appliedByDm: true,
      });

      // Broadcast update to room
      broadcastToRoom(roomCode, {
        type: "status_effect_added",
        roomCharacterId: id,
        effect,
      });

      res.json(effect);
    } catch (error) {
      console.error("Error adding status effect:", error);
      res.status(500).json({ error: "Failed to add status effect" });
    }
  });

  // DM Controls API - Remove status effect
  app.delete("/api/status-effects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { hostName, roomCode } = req.body;

      // Verify the room exists and requester is host
      const room = await storage.getRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      if (room.hostName !== hostName) {
        return res.status(403).json({ error: "Only the DM can remove status effects" });
      }

      await storage.deleteStatusEffect(id);

      // Broadcast update to room
      broadcastToRoom(roomCode, {
        type: "status_effect_removed",
        effectId: id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing status effect:", error);
      res.status(500).json({ error: "Failed to remove status effect" });
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

  // Items API
  app.get("/api/items", async (req, res) => {
    try {
      const { search, category, rarity } = req.query as { 
        search?: string; 
        category?: typeof itemCategoryEnum.enumValues[number]; 
        rarity?: typeof itemRarityEnum.enumValues[number]; 
      };

      let result;
      if (search) {
        result = await storage.searchItems(search);
      } else {
        result = await storage.getItems(category, rarity);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getItem(id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Character Inventory API
  app.get("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const inventory = await storage.getInventoryWithDetails(characterId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/characters/:characterId/inventory", async (req, res) => {
    try {
      const { characterId } = req.params;
      const { itemId, quantity = 1, equipped = false, notes, attunementSlot = false } = req.body;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const insert: InsertInventoryItem = {
        characterId,
        itemId,
        quantity,
        equipped,
        notes,
        attunementSlot,
      };

      const added = await storage.addToInventory(insert);
      res.json(added);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Room Character Inventory API (items acquired during gameplay)
  app.get("/api/room-characters/:roomCharacterId/inventory", isAuthenticated, async (req, res) => {
    try {
      const { roomCharacterId } = req.params;
      const inventory = await storage.getRoomInventoryByCharacter(roomCharacterId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/room-characters/:roomCharacterId/inventory", isAuthenticated, async (req, res) => {
    try {
      const { roomCharacterId } = req.params;
      const { itemId, name, quantity = 1, grantedBy } = req.body;
      
      // If name provided, look up the item by name
      let resolvedItemId = itemId;
      if (!itemId && name) {
        const foundItems = await storage.searchItems(name);
        if (foundItems.length > 0) {
          resolvedItemId = foundItems[0].id;
        } else {
          return res.status(404).json({ error: "Item not found" });
        }
      }
      
      if (!resolvedItemId) {
        return res.status(400).json({ error: "itemId or name is required" });
      }
      
      const insert = { roomCharacterId, itemId: resolvedItemId, quantity, grantedBy };
      const added = await storage.addToRoomInventory(insert);
      res.json(added);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/room-characters/:roomCharacterId/inventory/:itemId", isAuthenticated, async (req, res) => {
    try {
      const { itemId } = req.params;
      await storage.deleteRoomInventoryItem(itemId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return httpServer;
}