import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  isPublic: integer("isPublic").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = typeof playlists.$inferInsert;

export const playlistTracks = pgTable("playlistTracks", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlistId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackAlbum: text("trackAlbum"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: integer("trackDuration"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type InsertPlaylistTrack = typeof playlistTracks.$inferInsert;

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: integer("trackDuration"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

export const listeningHistory = pgTable("listeningHistory", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  trackId: varchar("trackId", { length: 255 }).notNull(),
  trackTitle: text("trackTitle"),
  trackArtist: text("trackArtist"),
  trackThumbnail: text("trackThumbnail"),
  trackDuration: integer("trackDuration"),
  playedAt: timestamp("playedAt").defaultNow().notNull(),
});

export type ListeningHistoryEntry = typeof listeningHistory.$inferSelect;
export type InsertListeningHistoryEntry = typeof listeningHistory.$inferInsert;