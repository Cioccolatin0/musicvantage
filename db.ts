import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { InsertUser, users, playlists, playlistTracks, favorites, listeningHistory, InsertPlaylist, InsertPlaylistTrack, InsertFavorite, InsertListeningHistoryEntry } from "./drizzle/schema";
import { ENV } from './server/_core/env';
import * as localDb from "./server/_core/db-local";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "openId" varchar(64) NOT NULL UNIQUE,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "role" varchar(16) NOT NULL DEFAULT 'user',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "lastSignedIn" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlists" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "thumbnail" text,
  "isPublic" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlistTracks" (
  "id" serial PRIMARY KEY,
  "playlistId" integer NOT NULL,
  "trackId" varchar(255) NOT NULL,
  "trackTitle" text,
  "trackArtist" text,
  "trackAlbum" text,
  "trackThumbnail" text,
  "trackDuration" integer,
  "addedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "favorites" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "trackId" varchar(255) NOT NULL,
  "trackTitle" text,
  "trackArtist" text,
  "trackThumbnail" text,
  "trackDuration" integer,
  "addedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "listeningHistory" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "trackId" varchar(255) NOT NULL,
  "trackTitle" text,
  "trackArtist" text,
  "trackThumbnail" text,
  "trackDuration" integer,
  "playedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "localUsers" (
  "id" serial PRIMARY KEY,
  "email" varchar(320) NOT NULL UNIQUE,
  "name" text NOT NULL,
  "passwordHash" text NOT NULL,
  "salt" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inviteCodes" (
  "id" serial PRIMARY KEY,
  "code" varchar(32) NOT NULL UNIQUE,
  "usedBy" varchar(320),
  "usedAt" timestamp,
  "createdBy" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "expiresAt" timestamp
);
`;

export async function ensureTables(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn("[Database] Cannot create tables: DATABASE_URL not set");
    return;
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(CREATE_TABLES_SQL);
    await pool.end();
    console.log("[Database] Tables ensured (PostgreSQL)");
  } catch (error) {
    console.error("[Database] Failed to create tables:", error);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Playlist queries
export async function createPlaylist(userId: number, data: InsertPlaylist) {
  const db = await getDb();
  if (!db) return localDb.createPlaylist(userId, data);

  const result = await db.insert(playlists).values({ ...data, userId }).returning({ id: playlists.id });
  return result[0];
}

export async function getUserPlaylists(userId: number) {
  const db = await getDb();
  if (!db) return localDb.getUserPlaylists(userId);
  
  return await db.select().from(playlists).where(eq(playlists.userId, userId));
}

export async function deletePlaylist(playlistId: number, userId: number) {
  const db = await getDb();
  if (!db) return localDb.deletePlaylist(playlistId, userId);
  
  await db.delete(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
  return true;
}

export async function addTrackToPlaylist(playlistId: number, track: InsertPlaylistTrack) {
  const db = await getDb();
  if (!db) return localDb.addTrackToPlaylist(playlistId, track);
  
  return await db.insert(playlistTracks).values({ ...track, playlistId });
}

export async function addTracksToPlaylist(playlistId: number, tracks: InsertPlaylistTrack[]) {
  const db = await getDb();
  if (!db) return localDb.addTracksToPlaylist(playlistId, tracks as any);
  
  await db.insert(playlistTracks).values(tracks.map(t => ({ ...t, playlistId })));
  return { count: tracks.length };
}

export async function getPlaylistTracks(playlistId: number) {
  const db = await getDb();
  if (!db) return localDb.getPlaylistTracks(playlistId);
  
  return await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));
}

export async function removeTrackFromPlaylist(trackId: string, playlistId: number) {
  const db = await getDb();
  if (!db) return localDb.removeTrackFromPlaylist(trackId, playlistId);
  
  await db.delete(playlistTracks).where(and(eq(playlistTracks.trackId, trackId), eq(playlistTracks.playlistId, playlistId)));
  return true;
}

export async function updatePlaylist(playlistId: number, userId: number, data: { name?: string; description?: string | null; thumbnail?: string | null }) {
  const db = await getDb();
  if (!db) return localDb.updatePlaylist(playlistId, userId, data);
  
  const sets: Record<string, unknown> = {};
  if (data.name !== undefined) sets.name = data.name;
  if (data.description !== undefined) sets.description = data.description;
  if (data.thumbnail !== undefined) sets.thumbnail = data.thumbnail;
  if (Object.keys(sets).length === 0) return true;
  
  await db.update(playlists).set(sets).where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
  return true;
}

export async function reorderPlaylistTracks(playlistId: number, trackIds: string[]) {
  const db = await getDb();
  if (!db) return localDb.reorderPlaylistTracks(playlistId, trackIds);
  
  return true;
}

// Favorites queries
export async function addToFavorites(userId: number, track: InsertFavorite) {
  const db = await getDb();
  if (!db) return localDb.addToFavorites(userId, track);
  
  return await db.insert(favorites).values({ ...track, userId });
}

export async function removeFromFavorites(userId: number, trackId: string) {
  const db = await getDb();
  if (!db) return localDb.removeFromFavorites(userId, trackId);
  
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)));
  return true;
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return localDb.getUserFavorites(userId);
  
  return await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.addedAt));
}

export async function isFavorite(userId: number, trackId: string) {
  const db = await getDb();
  if (!db) return localDb.isFavorite(userId, trackId);
  
  const result = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.trackId, trackId))).limit(1);
  return result.length > 0;
}

// Listening history queries
export async function addToListeningHistory(userId: number, track: InsertListeningHistoryEntry) {
  const db = await getDb();
  if (!db) return localDb.addToListeningHistory(userId, track);
  
  return await db.insert(listeningHistory).values({ ...track, userId });
}

export async function getListeningHistory(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return localDb.getListeningHistory(userId, limit);
  
  return await db.select().from(listeningHistory).where(eq(listeningHistory.userId, userId)).orderBy(desc(listeningHistory.playedAt)).limit(limit);
}

// Artist follow queries
export async function followArtist(userId: number, artistId: string, artistName: string, artistThumbnail: string) {
  return localDb.followArtist(userId, artistId, artistName, artistThumbnail);
}

export async function unfollowArtist(userId: number, artistId: string) {
  return localDb.unfollowArtist(userId, artistId);
}

export async function isFollowingArtist(userId: number, artistId: string) {
  return localDb.isFollowingArtist(userId, artistId);
}

export async function getFollowedArtists(userId: number) {
  return localDb.getFollowedArtists(userId);
}
