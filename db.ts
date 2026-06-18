import { ENV } from './server/_core/env';
import { query, queryOne, run } from './server/_core/pg';

function now(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

export async function ensureTables(): Promise<void> {
  const tables = [
    `CREATE TABLE IF NOT EXISTS "users" (
      id SERIAL PRIMARY KEY,
      "openId" TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      "loginMethod" TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "playlists" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      "isPublic" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "playlistTracks" (
      id SERIAL PRIMARY KEY,
      "playlistId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT,
      "trackArtist" TEXT,
      "trackAlbum" TEXT,
      "trackThumbnail" TEXT,
      "trackDuration" INTEGER,
      "addedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "favorites" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT,
      "trackArtist" TEXT,
      "trackThumbnail" TEXT,
      "trackDuration" INTEGER,
      "addedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "listeningHistory" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT,
      "trackArtist" TEXT,
      "trackThumbnail" TEXT,
      "trackDuration" INTEGER,
      "playedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "localUsers" (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "inviteCodes" (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      used_by TEXT,
      used_at TIMESTAMP,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "artistFollows" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "artistId" TEXT NOT NULL,
      "artistName" TEXT NOT NULL,
      "artistThumbnail" TEXT NOT NULL,
      "followedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE("userId", "artistId")
    )`,
    `CREATE TABLE IF NOT EXISTS "shareCodes" (
      id SERIAL PRIMARY KEY,
      "playlistId" INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      collaborative BOOLEAN NOT NULL DEFAULT FALSE,
      collaborators INTEGER[] NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "jamSessions" (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      "creatorUserId" INTEGER NOT NULL,
      "creatorName" TEXT NOT NULL,
      "durationMinutes" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      participants JSONB NOT NULL DEFAULT '[]',
      tracks JSONB NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "startedAt" TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "profiles" (
      "userId" INTEGER PRIMARY KEY,
      photo TEXT,
      banner TEXT,
      bio TEXT,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "friendRequests" (
      id SERIAL PRIMARY KEY,
      "fromUserId" INTEGER NOT NULL,
      "toUserId" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "conversations" (
      id SERIAL PRIMARY KEY,
      "participantIds" INTEGER[] NOT NULL,
      type TEXT NOT NULL DEFAULT 'direct',
      name TEXT,
      "adminUserId" INTEGER,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "messages" (
      id SERIAL PRIMARY KEY,
      "conversationId" INTEGER NOT NULL,
      "senderId" INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      "musicTrackId" TEXT,
      "musicTitle" TEXT,
      "musicArtist" TEXT,
      "musicThumbnail" TEXT,
      "playlistId" INTEGER,
      "playlistName" TEXT,
      "playlistTrackCount" INTEGER,
      "voiceUrl" TEXT,
      "voiceDuration" INTEGER,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "notifications" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "settings" (
      "userId" INTEGER PRIMARY KEY,
      "mixMode" BOOLEAN NOT NULL DEFAULT FALSE,
      "mixModeBpmRange" INTEGER NOT NULL DEFAULT 10,
      "mixModeEnergy" TEXT NOT NULL DEFAULT 'medium'
    )`,
    `CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      keys_json TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "listeningSessions" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT,
      "trackArtist" TEXT,
      "trackThumbnail" TEXT,
      "secondsListened" INTEGER NOT NULL,
      "trackDuration" INTEGER,
      date TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "monthlyRecaps" (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      "yearMonth" TEXT NOT NULL,
      "totalMinutes" INTEGER NOT NULL,
      "totalTracks" INTEGER NOT NULL,
      "topTracks" TEXT NOT NULL,
      "generatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "listeningActivity" (
      "userId" INTEGER PRIMARY KEY,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT NOT NULL,
      "trackArtist" TEXT NOT NULL,
      "trackThumbnail" TEXT NOT NULL,
      "startedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "listenTogetherSessions" (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      "creatorUserId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      "trackTitle" TEXT,
      "trackArtist" TEXT,
      "trackThumbnail" TEXT,
      "isPlaying" BOOLEAN NOT NULL DEFAULT TRUE,
      "currentTime" REAL NOT NULL DEFAULT 0,
      participants INTEGER[] NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "reactions" (
      id SERIAL PRIMARY KEY,
      "toUserId" INTEGER NOT NULL,
      "fromUserId" INTEGER NOT NULL,
      "trackId" TEXT NOT NULL,
      emoji TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ];
  for (const sql of tables) {
    await run(sql);
  }
  console.log("[PG] Tables ensured");
}

export async function upsertUser(user: any): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const role = user.role || (user.openId === ENV.ownerOpenId ? "admin" : "user");
  const ts = now();
  const existing = await queryOne('SELECT * FROM "users" WHERE "openId" = $1', [user.openId]);
  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (user.name !== undefined) { sets.push(`"name" = $${idx++}`); params.push(user.name ?? null); }
    if (user.email !== undefined) { sets.push(`"email" = $${idx++}`); params.push(user.email ?? null); }
    if (user.loginMethod !== undefined) { sets.push(`"loginMethod" = $${idx++}`); params.push(user.loginMethod ?? null); }
    sets.push(`"lastSignedIn" = $${idx++}`); params.push(ts);
    sets.push(`"updatedAt" = $${idx++}`); params.push(ts);
    if (user.role) { sets.push(`"role" = $${idx++}`); params.push(user.role); }
    params.push(user.openId);
    await run(`UPDATE "users" SET ${sets.join(", ")} WHERE "openId" = $${idx}`, params);
  } else {
    await run(
      'INSERT INTO "users" ("openId","name","email","loginMethod","role","createdAt","updatedAt","lastSignedIn") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [user.openId, user.name ?? null, user.email ?? null, user.loginMethod ?? null, role, ts, ts, ts]
    );
  }
}

export async function getUserByOpenId(openId: string) {
  return queryOne('SELECT * FROM "users" WHERE "openId" = $1 LIMIT 1', [openId]);
}

export async function createPlaylist(userId: number, data: any) {
  const ts = now();
  const result = await run(
    'INSERT INTO "playlists" ("userId","name","description","thumbnail","isPublic","createdAt","updatedAt") VALUES ($1,$2,$3,$4,0,$5,$6) RETURNING *',
    [userId, data.name, data.description ?? null, data.thumbnail ?? null, ts, ts]
  );
  return result.rows?.[0] || { id: result.rows?.[0]?.id };
}

export async function getUserPlaylists(userId: number) {
  return query('SELECT * FROM "playlists" WHERE "userId" = $1 ORDER BY "createdAt" DESC', [userId]);
}

export async function deletePlaylist(playlistId: number, userId: number) {
  await run('DELETE FROM "playlistTracks" WHERE "playlistId" = $1', [playlistId]);
  await run('DELETE FROM "playlists" WHERE "id" = $1 AND "userId" = $2', [playlistId, userId]);
  return true;
}

export async function addTrackToPlaylist(playlistId: number, track: any) {
  const result = await run(
    'INSERT INTO "playlistTracks" ("playlistId","trackId","trackTitle","trackArtist","trackAlbum","trackThumbnail","trackDuration","addedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [playlistId, track.trackId, track.trackTitle ?? null, track.trackArtist ?? null, track.trackAlbum ?? null, track.trackThumbnail ?? null, track.trackDuration ?? null, now()]
  );
  return result.rows?.[0] || { insertId: result.rows?.[0]?.id };
}

export async function addTracksToPlaylist(playlistId: number, tracks: any[]) {
  const ts = now();
  for (const track of tracks) {
    await run(
      'INSERT INTO "playlistTracks" ("playlistId","trackId","trackTitle","trackArtist","trackAlbum","trackThumbnail","trackDuration","addedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [playlistId, track.trackId, track.trackTitle ?? null, track.trackArtist ?? null, track.trackAlbum ?? null, track.trackThumbnail ?? null, track.trackDuration ?? null, ts]
    );
  }
  return { count: tracks.length };
}

export async function getPlaylistTracks(playlistId: number) {
  return query('SELECT * FROM "playlistTracks" WHERE "playlistId" = $1', [playlistId]);
}

export async function removeTrackFromPlaylist(trackId: string, playlistId: number) {
  await run('DELETE FROM "playlistTracks" WHERE "trackId" = $1 AND "playlistId" = $2', [trackId, playlistId]);
  return true;
}

export async function updatePlaylist(playlistId: number, userId: number, data: { name?: string; description?: string | null; thumbnail?: string | null }) {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`"name" = $${idx++}`); params.push(data.name); }
  if (data.description !== undefined) { sets.push(`"description" = $${idx++}`); params.push(data.description); }
  if (data.thumbnail !== undefined) { sets.push(`"thumbnail" = $${idx++}`); params.push(data.thumbnail); }
  if (sets.length === 0) return true;
  sets.push(`"updatedAt" = $${idx++}`);
  params.push(now());
  params.push(playlistId, userId);
  await run(`UPDATE "playlists" SET ${sets.join(", ")} WHERE "id" = $${idx} AND "userId" = $${idx + 1}`, params);
  return true;
}

export async function reorderPlaylistTracks(playlistId: number, trackIds: string[]) {
  const tracks = await getPlaylistTracks(playlistId);
  const trackMap = new Map(tracks.map((t: any) => [t.trackId, t]));
  const reordered = trackIds.map((id) => trackMap.get(id)).filter(Boolean);
  const remaining = tracks.filter((t: any) => !trackIds.includes(t.trackId));
  const final = [...reordered, ...remaining];
  await run('DELETE FROM "playlistTracks" WHERE "playlistId" = $1', [playlistId]);
  const ts = now();
  for (const t of final) {
    await run(
      'INSERT INTO "playlistTracks" ("playlistId","trackId","trackTitle","trackArtist","trackAlbum","trackThumbnail","trackDuration","addedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [playlistId, t.trackId, t.trackTitle ?? null, t.trackArtist ?? null, t.trackAlbum ?? null, t.trackThumbnail ?? null, t.trackDuration ?? null, ts]
    );
  }
  return true;
}

export async function addToFavorites(userId: number, track: any) {
  const result = await run(
    'INSERT INTO "favorites" ("userId","trackId","trackTitle","trackArtist","trackThumbnail","trackDuration","addedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [userId, track.trackId, track.trackTitle ?? null, track.trackArtist ?? null, track.trackThumbnail ?? null, track.trackDuration ?? null, now()]
  );
  return result.rows?.[0] || { insertId: result.rows?.[0]?.id };
}

export async function removeFromFavorites(userId: number, trackId: string) {
  await run('DELETE FROM "favorites" WHERE "userId" = $1 AND "trackId" = $2', [userId, trackId]);
  return true;
}

export async function getUserFavorites(userId: number) {
  return query('SELECT * FROM "favorites" WHERE "userId" = $1 ORDER BY "addedAt" DESC', [userId]);
}

export async function isFavorite(userId: number, trackId: string) {
  const row = await queryOne('SELECT 1 FROM "favorites" WHERE "userId" = $1 AND "trackId" = $2 LIMIT 1', [userId, trackId]);
  return !!row;
}

export async function addToListeningHistory(userId: number, track: any) {
  await run(
    'INSERT INTO "listeningHistory" ("userId","trackId","trackTitle","trackArtist","trackThumbnail","trackDuration","playedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [userId, track.trackId, track.trackTitle ?? null, track.trackArtist ?? null, track.trackThumbnail ?? null, track.trackDuration ?? null, now()]
  );
  return { insertId: 0 };
}

export async function getListeningHistory(userId: number, limit: number = 50) {
  return query('SELECT * FROM "listeningHistory" WHERE "userId" = $1 ORDER BY "playedAt" DESC LIMIT $2', [userId, limit]);
}

export async function followArtist(userId: number, artistId: string, artistName: string, artistThumbnail: string) {
  await run(
    'INSERT INTO "artistFollows" ("userId","artistId","artistName","artistThumbnail","followedAt") VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
    [userId, artistId, artistName, artistThumbnail, now()]
  );
  return { followed: true };
}

export async function unfollowArtist(userId: number, artistId: string) {
  await run('DELETE FROM "artistFollows" WHERE "userId" = $1 AND "artistId" = $2', [userId, artistId]);
  return { followed: false };
}

export async function isFollowingArtist(userId: number, artistId: string) {
  const row = await queryOne('SELECT 1 FROM "artistFollows" WHERE "userId" = $1 AND "artistId" = $2 LIMIT 1', [userId, artistId]);
  return !!row;
}

export async function getFollowedArtists(userId: number) {
  return query('SELECT * FROM "artistFollows" WHERE "userId" = $1 ORDER BY "followedAt" DESC', [userId]);
}

// ====== SHARE CODES ======

function generateCode(length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function generateShareCode(playlistId: number): Promise<string> {
  const existing = await queryOne('SELECT * FROM "shareCodes" WHERE "playlistId" = $1 AND collaborative = FALSE', [playlistId]);
  if (existing) return existing.code;
  const code = generateCode(8);
  await run('INSERT INTO "shareCodes" ("playlistId", code) VALUES ($1, $2)', [playlistId, code]);
  return code;
}

export async function getPlaylistByShareCode(code: string) {
  const share = await queryOne('SELECT * FROM "shareCodes" WHERE code = $1', [code]);
  if (!share) return null;
  const playlist = await queryOne('SELECT * FROM "playlists" WHERE id = $1', [share.playlistId]);
  if (!playlist) return null;
  const tracks = await getPlaylistTracks(playlist.id);
  return { playlist, tracks, collaborative: share.collaborative || false, collaborators: share.collaborators || [] };
}

export async function getAllSharedPlaylists() {
  const shares = await query('SELECT * FROM "shareCodes"');
  const result = [];
  for (const s of shares) {
    const pl = await queryOne('SELECT * FROM "playlists" WHERE id = $1', [s.playlistId]);
    if (!pl) continue;
    const trackCount = (await query('SELECT COUNT(*) as count FROM "playlistTracks" WHERE "playlistId" = $1', [pl.id]))[0]?.count || 0;
    result.push({
      ...pl,
      shareCode: s.code,
      trackCount,
      collaborative: s.collaborative || false,
      collaborators: s.collaborators || [],
    });
  }
  return result;
}

export async function generateCollaborativeCode(playlistId: number, userId: number, userName: string): Promise<string> {
  const code = generateCode(8);
  await run('INSERT INTO "shareCodes" ("playlistId", code, collaborative, collaborators) VALUES ($1, $2, TRUE, $3)', [playlistId, code, [userId]]);
  return code;
}

export async function addCollaborator(code: string, userId: number) {
  const share = await queryOne('SELECT * FROM "shareCodes" WHERE code = $1 AND collaborative = TRUE', [code]);
  if (!share) return false;
  const collaborators = share.collaborators || [];
  if (collaborators.includes(userId)) return true;
  collaborators.push(userId);
  await run('UPDATE "shareCodes" SET collaborators = $1 WHERE code = $2', [collaborators, code]);
  return true;
}

export async function addTrackToCollaborativePlaylist(code: string, track: any, userId: number, userName: string) {
  const share = await queryOne('SELECT * FROM "shareCodes" WHERE code = $1 AND collaborative = TRUE', [code]);
  if (!share || !(share.collaborators || []).includes(userId)) return null;
  const result = await run(
    'INSERT INTO "playlistTracks" ("playlistId","trackId","trackTitle","trackArtist","trackAlbum","trackThumbnail","trackDuration","addedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [share.playlistId, track.trackId, track.trackTitle ?? null, track.trackArtist ?? null, track.trackAlbum ?? null, track.trackThumbnail ?? null, track.trackDuration ?? null, now()]
  );
  return { insertId: result.rows?.[0]?.id };
}

export async function removeTrackFromCollaborativePlaylist(code: string, trackId: string, userId: number) {
  const share = await queryOne('SELECT * FROM "shareCodes" WHERE code = $1 AND collaborative = TRUE', [code]);
  if (!share || !(share.collaborators || []).includes(userId)) return false;
  await run('DELETE FROM "playlistTracks" WHERE "trackId" = $1 AND "playlistId" = $2', [trackId, share.playlistId]);
  return true;
}

// ====== JAM SESSIONS ======

function generateJamCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createJamSession(userId: number, userName: string, name: string, durationMinutes: number) {
  const code = generateJamCode();
  const ts = now();
  const participant = { userId, userName, joinedAt: ts };
  const result = await run(
    'INSERT INTO "jamSessions" (code, name, "creatorUserId", "creatorName", "durationMinutes", participants, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [code, name, userId, userName, durationMinutes, JSON.stringify([participant]), ts]
  );
  return result.rows?.[0] || null;
}

export async function joinJamSession(code: string, userId: number, userName: string) {
  const session = await queryOne('SELECT * FROM "jamSessions" WHERE code = $1 AND status != $2', [code, "ended"]);
  if (!session) return null;
  const participants = session.participants || [];
  if (participants.some((p: any) => p.userId === userId)) return session;
  participants.push({ userId, userName, joinedAt: now() });
  await run('UPDATE "jamSessions" SET participants = $1 WHERE code = $2', [JSON.stringify(participants), code]);
  session.participants = participants;
  return session;
}

export async function leaveJamSession(code: string, userId: number) {
  const session = await queryOne('SELECT * FROM "jamSessions" WHERE code = $1', [code]);
  if (!session) return false;
  let participants = session.participants || [];
  participants = participants.filter((p: any) => p.userId !== userId);
  const status = participants.length === 0 ? "ended" : session.status;
  await run('UPDATE "jamSessions" SET participants = $1, status = $2 WHERE code = $3', [JSON.stringify(participants), status, code]);
  return true;
}

export async function startJamSession(code: string) {
  const result = await run(
    'UPDATE "jamSessions" SET status = $1, "startedAt" = $2 WHERE code = $3 AND status = $4 RETURNING *',
    ["active", now(), code, "waiting"]
  );
  return result.rows?.[0] || null;
}

export async function getJamSession(code: string) {
  return queryOne('SELECT * FROM "jamSessions" WHERE code = $1', [code]);
}

export async function getUserJamSessions(userId: number) {
  const all = await query('SELECT * FROM "jamSessions" WHERE status != $1', ["ended"]);
  return all.filter((s: any) => (s.participants || []).some((p: any) => p.userId === userId));
}

export async function addTrackToJamSession(code: string, track: { trackId: string; trackTitle: string; trackArtist: string; trackThumbnail: string }, addedBy: number) {
  const session = await queryOne('SELECT * FROM "jamSessions" WHERE code = $1 AND status = $2', [code, "active"]);
  if (!session) return null;
  const tracks = session.tracks || [];
  tracks.push({ ...track, addedBy });
  await run('UPDATE "jamSessions" SET tracks = $1 WHERE code = $2', [JSON.stringify(tracks), code]);
  session.tracks = tracks;
  return session;
}

export async function endJamSession(code: string) {
  const result = await run('UPDATE "jamSessions" SET status = $1 WHERE code = $2 RETURNING *', ["ended", code]);
  return result.rows?.[0] || null;
}
