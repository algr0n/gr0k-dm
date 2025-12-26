// Admin rooms helper routes (kept separate for clarity)
import type { Request, Response } from "express";
import { db } from "./db";
import { rooms, players } from "@shared/schema";
import { sql, eq, desc } from "drizzle-orm";
// storage is imported dynamically at runtime to avoid static export errors

// NOTE: This file is not directly used; the admin routes are registered in server/routes.ts
// This helper file documents intended implementations.

export async function registerAdminRoomRoutes(app: any, isAuthenticated: any, requireAdmin: any) {
  app.get("/api/admin/rooms", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const mod = (await import("./index")) as any;
      const storage = mod.storage;

      const results = await db.select({ room: rooms, playerCount: sql<number>`CAST(count(${players.id}) as INTEGER)` })
        .from(rooms)
        .leftJoin(players, eq(rooms.id, players.roomId))
        .groupBy(rooms.id)
        .orderBy(desc(rooms.updatedAt));

      const roomsWithMeta = await Promise.all(results.map(async (r: any) => {
        const allPlayers = await storage.getPlayersByRoom(r.room.id);
        const hostPlayer = allPlayers.find((p: any) => p.isHost);
        let hostName = null;
        try {
          if (hostPlayer) {
            const user = await storage.getUser(hostPlayer.userId);
            hostName = user ? (user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim()) : null;
          }
        } catch (err) {
          hostName = null;
        }
        return {
          ...r.room,
          playerCount: Number(r.playerCount) || 0,
          hostName,
        };
      }));

      res.json(roomsWithMeta);
    } catch (error) {
      console.error('[Admin Rooms] Error listing rooms:', error);
      res.status(500).json({ error: 'Failed to list rooms' });
    }
  });

  app.delete("/api/admin/rooms/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const mod = (await import("./index")) as any;
      const storage = mod.storage;

      const { id } = req.params;
      const room = await storage.getRoom(id);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      await storage.deleteRoomWithAllData(room.id);

      // cleanup caches
      try {
        const { storyCache } = await import("./cache/story-cache");
        storyCache.invalidate(room.id);
      } catch (err) { /* ignore */ }

      try {
        const { monsterCacheManager } = await import("./cache/monster-cache");
        monsterCacheManager.removeCache(room.id);
      } catch (err) { /* ignore */ }

      res.json({ success: true });
    } catch (err) {
      console.error('[Admin Rooms] Delete failed:', err);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });
}
