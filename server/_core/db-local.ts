import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "../../local-beta-db.json");

interface PlaylistRecord {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  thumbnail: string | null;
  isPublic: number;
  createdAt: string;
  updatedAt: string;
}

interface PlaylistTrackRecord {
  id: number;
  playlistId: number;
  trackId: string;
  trackTitle: string | null;
  trackArtist: string | null;
  trackAlbum: string | null;
  trackThumbnail: string | null;
  trackDuration: number | null;
  addedAt: string;
}

interface FavoriteRecord {
  id: number;
  userId: number;
  trackId: string;
  trackTitle: string | null;
  trackArtist: string | null;
  trackThumbnail: string | null;
  trackDuration: number | null;
  addedAt: string;
}

interface ArtistFollowRecord {
  id: number;
  userId: number;
  artistId: string;
  artistName: string;
  artistThumbnail: string;
  followedAt: string;
}

interface HistoryRecord {
  id: number;
  userId: number;
  trackId: string;
  trackTitle: string | null;
  trackArtist: string | null;
  trackThumbnail: string | null;
  trackDuration: number | null;
  playedAt: string;
}

interface LocalDb {
  playlists: PlaylistRecord[];
  playlistTracks: PlaylistTrackRecord[];
  favorites: FavoriteRecord[];
  artistFollows: ArtistFollowRecord[];
  listeningHistory: HistoryRecord[];
  shareCodes?: ShareCodeRecord[];
  jamSessions?: JamSessionRecord[];
}

function getDefaultDb(): LocalDb {
  return {
    playlists: [],
    playlistTracks: [],
    favorites: [],
    artistFollows: [],
    listeningHistory: [],
    shareCodes: [],
    jamSessions: [],
  };
}

let _cache: LocalDb | null = null;

function load(): LocalDb {
  if (_cache) return _cache;
  let data: Partial<LocalDb> = {};
  try {
    if (fs.existsSync(DB_FILE)) {
      data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch {
    console.warn("[LocalDB] Corrupted DB file, starting fresh");
  }
  _cache = { ...getDefaultDb(), ...data };
  return _cache;
}

function save() {
  if (!_cache) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(_cache, null, 2));
  } catch (e) {
    console.error("[LocalDB] Failed to save:", e);
  }
}

let nextId: Record<string, number> = {};

function getNextId(collection: keyof LocalDb): number {
  if (!nextId[collection]) {
    const db = load();
    const items = db[collection] as Array<{ id: number }>;
    nextId[collection] = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
  }
  return nextId[collection]++;
}

export function createPlaylist(userId: number, data: { name: string; description?: string | null; thumbnail?: string | null }) {
  const db = load();
  const now = new Date().toISOString();
  const entry: PlaylistRecord = {
    id: getNextId("playlists"),
    userId,
    name: data.name,
    description: data.description ?? null,
    thumbnail: data.thumbnail ?? null,
    isPublic: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.playlists.push(entry);
  save();
  return { id: entry.id };
}

export function getUserPlaylists(userId: number) {
  const db = load();
  return db.playlists.filter((p) => p.userId === userId);
}

export function deletePlaylist(playlistId: number, userId: number) {
  const db = load();
  const idx = db.playlists.findIndex((p) => p.id === playlistId && p.userId === userId);
  if (idx === -1) return false;
  db.playlists.splice(idx, 1);
  db.playlistTracks = db.playlistTracks.filter((t) => t.playlistId !== playlistId);
  save();
  return true;
}

export function getPlaylistTracks(playlistId: number) {
  const db = load();
  return db.playlistTracks.filter((t) => t.playlistId === playlistId);
}

export function addTrackToPlaylist(
  playlistId: number,
  track: {
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackAlbum?: string | null;
    trackThumbnail?: string | null;
    trackDuration?: number | null;
  }
) {
  const db = load();
  const entry: PlaylistTrackRecord = {
    id: getNextId("playlistTracks"),
    playlistId,
    trackId: track.trackId,
    trackTitle: track.trackTitle ?? null,
    trackArtist: track.trackArtist ?? null,
    trackAlbum: track.trackAlbum ?? null,
    trackThumbnail: track.trackThumbnail ?? null,
    trackDuration: track.trackDuration ?? null,
    addedAt: new Date().toISOString(),
  };
  db.playlistTracks.push(entry);
  save();
  return { insertId: entry.id };
}

export function addTracksToPlaylist(
  playlistId: number,
  tracks: Array<{
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackAlbum?: string | null;
    trackThumbnail?: string | null;
    trackDuration?: number | null;
  }>
) {
  const db = load();
  const entries: PlaylistTrackRecord[] = tracks.map((track) => ({
    id: getNextId("playlistTracks"),
    playlistId,
    trackId: track.trackId,
    trackTitle: track.trackTitle ?? null,
    trackArtist: track.trackArtist ?? null,
    trackAlbum: track.trackAlbum ?? null,
    trackThumbnail: track.trackThumbnail ?? null,
    trackDuration: track.trackDuration ?? null,
    addedAt: new Date().toISOString(),
  }));
  db.playlistTracks.push(...entries);
  save();
  return { count: entries.length };
}

export function removeTrackFromPlaylist(trackId: string, playlistId: number) {
  const db = load();
  const idx = db.playlistTracks.findIndex(
    (t) => t.trackId === trackId && t.playlistId === playlistId
  );
  if (idx === -1) return false;
  db.playlistTracks.splice(idx, 1);
  save();
  return true;
}

export function updatePlaylist(
  playlistId: number,
  userId: number,
  data: { name?: string; description?: string | null; thumbnail?: string | null }
) {
  const db = load();
  const playlist = db.playlists.find((p) => p.id === playlistId && p.userId === userId);
  if (!playlist) return false;
  if (data.name !== undefined) playlist.name = data.name;
  if (data.description !== undefined) playlist.description = data.description;
  if (data.thumbnail !== undefined) playlist.thumbnail = data.thumbnail;
  playlist.updatedAt = new Date().toISOString();
  save();
  return true;
}

export function reorderPlaylistTracks(playlistId: number, trackIds: string[]) {
  const db = load();
  const tracks = db.playlistTracks.filter((t) => t.playlistId === playlistId);
  const trackMap = new Map(tracks.map((t) => [t.trackId, t]));
  const reordered = trackIds
    .map((id) => trackMap.get(id))
    .filter((t): t is PlaylistTrackRecord => !!t);
  const remaining = tracks.filter((t) => !trackIds.includes(t.trackId));
  const final = [...reordered, ...remaining];
  db.playlistTracks = db.playlistTracks.filter((t) => t.playlistId !== playlistId);
  db.playlistTracks.push(...final);
  save();
  return true;
}

export function addToFavorites(
  userId: number,
  track: {
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackThumbnail?: string | null;
    trackDuration?: number | null;
  }
) {
  const db = load();
  const entry: FavoriteRecord = {
    id: getNextId("favorites"),
    userId,
    trackId: track.trackId,
    trackTitle: track.trackTitle ?? null,
    trackArtist: track.trackArtist ?? null,
    trackThumbnail: track.trackThumbnail ?? null,
    trackDuration: track.trackDuration ?? null,
    addedAt: new Date().toISOString(),
  };
  db.favorites.push(entry);
  save();
  return { insertId: entry.id };
}

export function removeFromFavorites(userId: number, trackId: string) {
  const db = load();
  const idx = db.favorites.findIndex(
    (f) => f.userId === userId && f.trackId === trackId
  );
  if (idx === -1) return false;
  db.favorites.splice(idx, 1);
  save();
  return true;
}

export function getUserFavorites(userId: number) {
  const db = load();
  return db.favorites
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function isFavorite(userId: number, trackId: string) {
  const db = load();
  return db.favorites.some((f) => f.userId === userId && f.trackId === trackId);
}

// =============== ARTIST FOLLOWS ===============

export function followArtist(userId: number, artistId: string, artistName: string, artistThumbnail: string) {
  const db = load();
  const existing = db.artistFollows.find((f) => f.userId === userId && f.artistId === artistId);
  if (existing) return { followed: true };
  db.artistFollows.push({
    id: getNextId("artistFollows"),
    userId,
    artistId,
    artistName,
    artistThumbnail,
    followedAt: new Date().toISOString(),
  });
  save();
  return { followed: true };
}

export function unfollowArtist(userId: number, artistId: string) {
  const db = load();
  const idx = db.artistFollows.findIndex((f) => f.userId === userId && f.artistId === artistId);
  if (idx === -1) return { followed: false };
  db.artistFollows.splice(idx, 1);
  save();
  return { followed: false };
}

export function isFollowingArtist(userId: number, artistId: string) {
  const db = load();
  return db.artistFollows.some((f) => f.userId === userId && f.artistId === artistId);
}

export function getFollowedArtists(userId: number) {
  const db = load();
  return db.artistFollows
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.followedAt.localeCompare(a.followedAt));
}

export function addToListeningHistory(
  userId: number,
  track: {
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackThumbnail?: string | null;
    trackDuration?: number | null;
  }
) {
  const db = load();
  const entry: HistoryRecord = {
    id: getNextId("listeningHistory"),
    userId,
    trackId: track.trackId,
    trackTitle: track.trackTitle ?? null,
    trackArtist: track.trackArtist ?? null,
    trackThumbnail: track.trackThumbnail ?? null,
    trackDuration: track.trackDuration ?? null,
    playedAt: new Date().toISOString(),
  };
  db.listeningHistory.push(entry);
  save();
  return { insertId: entry.id };
}

export function getListeningHistory(userId: number, limit: number = 50) {
  const db = load();
  return db.listeningHistory
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, limit);
}

// =============== SHARED PLAYLISTS ===============

interface ShareCodeRecord {
  playlistId: number;
  code: string;
  createdAt: string;
  collaborative?: boolean;
  collaborators?: number[];
}

interface CollaborativeTrackRecord {
  trackId: string;
  trackTitle: string | null;
  trackArtist: string | null;
  trackThumbnail: string | null;
  trackDuration: number | null;
  addedAt: string;
  addedByUserId: number;
  addedByName: string;
}

function generateCode(length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generateShareCode(playlistId: number): string {
  const db = load();
  if (!db.shareCodes) db.shareCodes = [];
  const existing = db.shareCodes.find((s) => s.playlistId === playlistId && !s.collaborative);
  if (existing) return existing.code;

  const code = generateCode(8);
  db.shareCodes.push({ playlistId, code, createdAt: new Date().toISOString() });
  save();
  return code;
}

export function generateCollaborativeCode(playlistId: number, userId: number, userName: string): string {
  const db = load();
  if (!db.shareCodes) db.shareCodes = [];

  const code = generateCode(8);
  db.shareCodes.push({
    playlistId,
    code,
    createdAt: new Date().toISOString(),
    collaborative: true,
    collaborators: [userId],
  });
  save();
  return code;
}

export function addCollaborator(code: string, userId: number) {
  const db = load();
  const share = db.shareCodes?.find((s) => s.code === code && s.collaborative);
  if (!share) return false;
  if (!share.collaborators) share.collaborators = [];
  if (share.collaborators.includes(userId)) return true;
  share.collaborators.push(userId);
  save();
  return true;
}

export function getPlaylistByShareCode(code: string) {
  const db = load();
  const share = db.shareCodes?.find((s) => s.code === code);
  if (!share) return null;
  const playlist = db.playlists.find((p) => p.id === share.playlistId);
  if (!playlist) return null;
  const tracks = db.playlistTracks.filter((t) => t.playlistId === playlist.id);
  return { playlist, tracks, collaborative: share.collaborative || false, collaborators: share.collaborators || [] };
}

export function addTrackToCollaborativePlaylist(
  code: string,
  track: {
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackAlbum?: string | null;
    trackThumbnail?: string | null;
    trackDuration?: number | null;
  },
  userId: number,
  userName: string
) {
  const db = load();
  const share = db.shareCodes?.find((s) => s.code === code && s.collaborative);
  if (!share) return null;
  if (!share.collaborators?.includes(userId)) return null;

  const entry: PlaylistTrackRecord = {
    id: getNextId("playlistTracks"),
    playlistId: share.playlistId,
    trackId: track.trackId,
    trackTitle: track.trackTitle ?? null,
    trackArtist: track.trackArtist ?? null,
    trackAlbum: track.trackAlbum ?? null,
    trackThumbnail: track.trackThumbnail ?? null,
    trackDuration: track.trackDuration ?? null,
    addedAt: new Date().toISOString(),
  };
  db.playlistTracks.push(entry);
  save();
  return { insertId: entry.id };
}

export function removeTrackFromCollaborativePlaylist(code: string, trackId: string, userId: number) {
  const db = load();
  const share = db.shareCodes?.find((s) => s.code === code && s.collaborative);
  if (!share) return false;
  if (!share.collaborators?.includes(userId)) return false;

  const idx = db.playlistTracks.findIndex(
    (t) => t.trackId === trackId && t.playlistId === share.playlistId
  );
  if (idx === -1) return false;
  db.playlistTracks.splice(idx, 1);
  save();
  return true;
}

export function getAllSharedPlaylists() {
  const db = load();
  if (!db.shareCodes) return [];
  return db.shareCodes
    .map((s) => {
      const pl = db.playlists.find((p) => p.id === s.playlistId);
      if (!pl) return null;
      const trackCount = db.playlistTracks.filter((t) => t.playlistId === pl.id).length;
      return {
        ...pl,
        shareCode: s.code,
        trackCount,
        collaborative: s.collaborative || false,
        collaborators: s.collaborators || [],
      };
    })
    .filter(Boolean);
}

// =============== JAM SESSIONS ===============

interface JamParticipant {
  userId: number;
  userName: string;
  joinedAt: string;
}

interface JamSessionRecord {
  id: number;
  code: string;
  name: string;
  creatorUserId: number;
  creatorName: string;
  durationMinutes: number;
  status: "waiting" | "active" | "ended";
  participants: JamParticipant[];
  tracks: Array<{
    trackId: string;
    trackTitle: string;
    trackArtist: string;
    trackThumbnail: string;
    addedBy: number;
  }>;
  createdAt: string;
  startedAt: string | null;
}

function generateJamCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createJamSession(
  userId: number,
  userName: string,
  name: string,
  durationMinutes: number
): JamSessionRecord {
  const db = load();
  if (!db.jamSessions) db.jamSessions = [];
  const code = generateJamCode();
  const now = new Date().toISOString();
  const session: JamSessionRecord = {
    id: getNextId("jamSessions"),
    code,
    name,
    creatorUserId: userId,
    creatorName: userName,
    durationMinutes,
    status: "waiting",
    participants: [{ userId, userName, joinedAt: now }],
    tracks: [],
    createdAt: now,
    startedAt: null,
  };
  db.jamSessions.push(session);
  save();
  return session;
}

export function joinJamSession(code: string, userId: number, userName: string) {
  const db = load();
  const session = db.jamSessions?.find((s) => s.code === code && s.status !== "ended");
  if (!session) return null;
  if (session.participants.some((p) => p.userId === userId)) return session;
  session.participants.push({ userId, userName, joinedAt: new Date().toISOString() });
  save();
  return session;
}

export function leaveJamSession(code: string, userId: number) {
  const db = load();
  const session = db.jamSessions?.find((s) => s.code === code);
  if (!session) return false;
  session.participants = session.participants.filter((p) => p.userId !== userId);
  if (session.participants.length === 0) {
    session.status = "ended";
  }
  save();
  return true;
}

export function startJamSession(code: string) {
  const db = load();
  const session = db.jamSessions?.find((s) => s.code === code);
  if (!session || session.status !== "waiting") return null;
  session.status = "active";
  session.startedAt = new Date().toISOString();
  save();
  return session;
}

export function getJamSession(code: string) {
  const db = load();
  return db.jamSessions?.find((s) => s.code === code) || null;
}

export function getUserJamSessions(userId: number) {
  const db = load();
  return (db.jamSessions || []).filter(
    (s) => s.status !== "ended" && s.participants.some((p) => p.userId === userId)
  );
}

export function addTrackToJamSession(
  code: string,
  track: { trackId: string; trackTitle: string; trackArtist: string; trackThumbnail: string },
  addedBy: number
) {
  const db = load();
  const session = db.jamSessions?.find((s) => s.code === code);
  if (!session || session.status !== "active") return null;
  if (!session.tracks) session.tracks = [];
  session.tracks.push({ ...track, addedBy });
  save();
  return session;
}

export function endJamSession(code: string) {
  const db = load();
  const session = db.jamSessions?.find((s) => s.code === code);
  if (!session) return null;
  session.status = "ended";
  save();
  return session;
}


