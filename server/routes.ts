import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { parseDiceExpression } from "./dice";
import { getBotStatus, updateBotStatus, sendMessageToChannel } from "./discord";
import { insertCharacterSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Bot status endpoint
  app.get("/api/bot/status", async (_req, res) => {
    try {
      const status = await updateBotStatus();
      res.json(status);
    } catch (error) {
      res.json(getBotStatus());
    }
  });

  // Characters endpoints
  app.get("/api/characters", async (_req, res) => {
    try {
      const characters = await storage.getAllCharacters();
      res.json(characters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch characters" });
    }
  });

  app.get("/api/characters/:id", async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch character" });
    }
  });

  app.post("/api/characters", async (req, res) => {
    try {
      const validatedData = insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(validatedData);
      res.status(201).json(character);
    } catch (error) {
      console.error("Character creation error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid character data", details: error });
      }
      res.status(500).json({ error: "Failed to create character" });
    }
  });

  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const character = await storage.updateCharacter(req.params.id, req.body);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      res.status(500).json({ error: "Failed to update character" });
    }
  });

  app.delete("/api/characters/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCharacter(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // Sessions endpoints
  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Get session messages
  app.get("/api/sessions/:id/messages", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session.messageHistory || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send message to Discord channel
  app.post("/api/sessions/:id/messages", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const { content, username } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Message content is required" });
      }

      await sendMessageToChannel(session.discordChannelId, content, username);

      const newMessage = {
        id: randomUUID(),
        role: "user" as const,
        content,
        timestamp: new Date().toISOString(),
        discordUsername: username ? `[Web] ${username}` : "[Web]",
      };

      const currentHistory = session.messageHistory || [];
      const updatedHistory = [...currentHistory, newMessage];
      await storage.updateSession(session.id, { messageHistory: updatedHistory.slice(-50) });

      res.json(newMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message to Discord" });
    }
  });

  // Delete session
  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Dice rolling endpoints
  app.get("/api/dice/history", async (_req, res) => {
    try {
      const rolls = await storage.getRecentDiceRolls(20);
      res.json(rolls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dice history" });
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

  return httpServer;
}
