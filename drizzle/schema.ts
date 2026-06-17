import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Playlists created by users
 */
export const playlists = mysqlTable("playlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  isPublic: int("isPublic").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = typeof playlists.$inferInsert;

/**
 * Tracks in playlists (many-to-many)
 */
export const playlistTracks = mysqlTable("playlistTracks", {
  id: int("id").autoincrement().primaryKey(),
  playlistId: int("playlistId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackAlbum: text("trackAlbum"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: int("trackDuration"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type InsertPlaylistTrack = typeof playlistTracks.$inferInsert;

/**
 * User favorite tracks
 */
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: int("trackDuration"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Listening history
 */
export const listeningHistory = mysqlTable("listeningHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: int("trackDuration"),
  playedAt: timestamp("playedAt").defaultNow().notNull(),
});

export type ListeningHistoryEntry = typeof listeningHistory.$inferSelect;
export type InsertListeningHistoryEntry = typeof listeningHistory.$inferInsert;