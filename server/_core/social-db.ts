import { query, queryOne, run } from "./pg";
import type { MessageType, UserSettings, ListeningSession, MonthlyRecap, VantageStats, VantageLeaderboardEntry } from "../../shared/types";

async function getUserName(userId: number): Promise<string> {
  try {
    const user = await queryOne('SELECT name FROM "localUsers" WHERE id = $1', [userId]);
    return user?.name || "Utente sconosciuto";
  } catch {
    return "Utente sconosciuto";
  }
}

async function getUserEmail(userId: number): Promise<string> {
  try {
    const user = await queryOne('SELECT email FROM "localUsers" WHERE id = $1', [userId]);
    return user?.email || "unknown";
  } catch {
    return "unknown";
  }
}

// ====== PROFILES ======

export async function getProfile(userId: number) {
  return queryOne('SELECT * FROM "profiles" WHERE "userId" = $1', [userId]);
}

export async function upsertProfile(userId: number, data: { photo?: string | null; banner?: string | null; bio?: string | null }) {
  const existing = await getProfile(userId);
  const ts = new Date().toISOString();
  if (existing) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.photo !== undefined) { sets.push(`photo = $${idx++}`); params.push(data.photo); }
    if (data.banner !== undefined) { sets.push(`banner = $${idx++}`); params.push(data.banner); }
    if (data.bio !== undefined) { sets.push(`bio = $${idx++}`); params.push(data.bio); }
    sets.push(`"updatedAt" = $${idx++}`); params.push(ts);
    params.push(userId);
    await run(`UPDATE "profiles" SET ${sets.join(", ")} WHERE "userId" = $${idx}`, params);
  } else {
    await run(
      'INSERT INTO "profiles" ("userId", photo, banner, bio, "updatedAt") VALUES ($1,$2,$3,$4,$5)',
      [userId, data.photo || null, data.banner || null, data.bio || null, ts]
    );
  }
  return getProfile(userId);
}

// ====== FRIENDS ======

export async function sendFriendRequest(fromUserId: number, toUserId: number) {
  if (fromUserId === toUserId) throw new Error("Non puoi aggiungere te stesso");
  const existing = await queryOne(
    'SELECT * FROM "friendRequests" WHERE ("fromUserId" = $1 AND "toUserId" = $2) OR ("fromUserId" = $2 AND "toUserId" = $1) LIMIT 1',
    [fromUserId, toUserId]
  );
  if (existing) {
    if (existing.status === "accepted") throw new Error("Sei già amico di questo utente");
    if (existing.status === "pending") throw new Error("Richiesta già inviata");
    if (existing.status === "rejected") {
      await run(
        'UPDATE "friendRequests" SET status = $1, "createdAt" = $2 WHERE id = $3',
        ["pending", new Date().toISOString(), existing.id]
      );
      return existing;
    }
  }
  const result = await run(
    'INSERT INTO "friendRequests" ("fromUserId", "toUserId", status, "createdAt") VALUES ($1,$2,$3,$4) RETURNING *',
    [fromUserId, toUserId, "pending", new Date().toISOString()]
  );
  const record = result.rows[0];
  const name = await getUserName(fromUserId);
  await addNotification(toUserId, "friend_request", "Richiesta di amicizia", `${name} vuole diventare tuo amico`, { fromUserId });
  return record;
}

export async function acceptFriendRequest(requestId: number, userId: number) {
  const req = await queryOne('SELECT * FROM "friendRequests" WHERE id = $1', [requestId]);
  if (!req) throw new Error("Richiesta non trovata");
  if (req.toUserId !== userId) throw new Error("Non autorizzato");
  await run('UPDATE "friendRequests" SET status = $1 WHERE id = $2', ["accepted", requestId]);
  const name = await getUserName(userId);
  await addNotification(req.fromUserId, "friend_accepted", "Richiesta accettata", `${name} ha accettato la tua richiesta di amicizia`, { userId });
  const conv = await getOrCreateConversation([req.fromUserId, req.toUserId]);
  return { request: req, conversation: conv };
}

export async function rejectFriendRequest(requestId: number, userId: number) {
  const req = await queryOne('SELECT * FROM "friendRequests" WHERE id = $1', [requestId]);
  if (!req) throw new Error("Richiesta non trovata");
  if (req.toUserId !== userId) throw new Error("Non autorizzato");
  await run('UPDATE "friendRequests" SET status = $1 WHERE id = $2', ["rejected", requestId]);
  return req;
}

export async function cancelFriendRequest(requestId: number, userId: number) {
  const result = await run(
    'DELETE FROM "friendRequests" WHERE id = $1 AND "fromUserId" = $2 AND status = $3',
    [requestId, userId, "pending"]
  );
  if (result.rowCount === 0) throw new Error("Richiesta non trovata o già gestita");
  return true;
}

export async function getFriendRequests(userId: number) {
  const rows = await query('SELECT * FROM "friendRequests" WHERE "toUserId" = $1 AND status = $2', [userId, "pending"]);
  const result = [];
  for (const r of rows) {
    result.push({
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      status: r.status,
      createdAt: r.createdAt,
      fromUser: { id: r.fromUserId, name: await getUserName(r.fromUserId), email: await getUserEmail(r.fromUserId) },
      toUser: { id: r.toUserId, name: await getUserName(r.toUserId), email: await getUserEmail(r.toUserId) },
    });
  }
  return result;
}

export async function getSentRequests(userId: number) {
  const rows = await query('SELECT * FROM "friendRequests" WHERE "fromUserId" = $1 AND status = $2', [userId, "pending"]);
  const result = [];
  for (const r of rows) {
    result.push({
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      status: r.status,
      createdAt: r.createdAt,
      fromUser: { id: r.fromUserId, name: await getUserName(r.fromUserId), email: await getUserEmail(r.fromUserId) },
      toUser: { id: r.toUserId, name: await getUserName(r.toUserId), email: await getUserEmail(r.toUserId) },
    });
  }
  return result;
}

export async function getFriends(userId: number) {
  const rows = await query(
    'SELECT * FROM "friendRequests" WHERE status = $1 AND ("fromUserId" = $2 OR "toUserId" = $2)',
    ["accepted", userId]
  );
  const result = [];
  for (const r of rows) {
    const friendId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
    result.push({ id: friendId, name: await getUserName(friendId), email: await getUserEmail(friendId) });
  }
  return result;
}

export async function getFriendStatus(userId: number, otherUserId: number): Promise<string> {
  if (userId === otherUserId) return "self";
  const req = await queryOne(
    'SELECT * FROM "friendRequests" WHERE ("fromUserId" = $1 AND "toUserId" = $2) OR ("fromUserId" = $2 AND "toUserId" = $1) LIMIT 1',
    [userId, otherUserId]
  );
  if (!req) return "none";
  if (req.status === "accepted") return "friends";
  if (req.status === "pending") {
    return req.fromUserId === userId ? "pending_sent" : "pending_received";
  }
  return "none";
}

export async function removeFriend(userId: number, friendId: number) {
  const result = await run(
    'DELETE FROM "friendRequests" WHERE status = $1 AND (("fromUserId" = $2 AND "toUserId" = $3) OR ("fromUserId" = $3 AND "toUserId" = $2))',
    ["accepted", userId, friendId]
  );
  if (result.rowCount === 0) throw new Error("Non siete amici");
  return true;
}

// ====== CONVERSATIONS ======

export async function getOrCreateConversation(participantIds: number[]) {
  const sorted = [...participantIds].sort();
  const rows = await query('SELECT * FROM "conversations"');
  let conv = rows.find((c: any) => {
    const ps = [...c.participantIds].sort();
    return ps.length === sorted.length && ps.every((p: any, i: number) => p === sorted[i]);
  });
  if (!conv) {
    const result = await run(
      'INSERT INTO "conversations" ("participantIds", type, "updatedAt") VALUES ($1,$2,$3) RETURNING *',
      [sorted, sorted.length === 2 ? "direct" : "group", new Date().toISOString()]
    );
    conv = result.rows[0];
  }
  return conv;
}

export async function createGroupConversation(creatorId: number, name: string, participantIds: number[]) {
  const allIds = [...new Set([creatorId, ...participantIds])];
  if (allIds.length < 2) throw new Error("Servono almeno 2 partecipanti");
  if (allIds.length > 10) throw new Error("Massimo 10 partecipanti");

  const result = await run(
    'INSERT INTO "conversations" ("participantIds", type, name, "adminUserId", "updatedAt") VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [allIds, "group", name, creatorId, new Date().toISOString()]
  );
  const conv = result.rows[0];
  const creatorName = await getUserName(creatorId);

  for (const pid of allIds) {
    if (pid !== creatorId) {
      await addNotification(pid, "new_message", `Aggiunto al gruppo "${name}"`, `${creatorName} ti ha aggiunto al gruppo`, { conversationId: conv.id });
    }
  }

  return conv;
}

export async function addUserToGroupConversation(conversationId: number, requesterId: number, userIdToAdd: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");
  if (conv.adminUserId !== requesterId) throw new Error("Solo l'amministratore può aggiungere membri");
  if (conv.participantIds.includes(userIdToAdd)) throw new Error("Utente già nel gruppo");
  if (conv.participantIds.length >= 10) throw new Error("Massimo 10 partecipanti");

  const pids = [...conv.participantIds, userIdToAdd];
  await run('UPDATE "conversations" SET "participantIds" = $1 WHERE id = $2', [pids, conversationId]);
  const requesterName = await getUserName(requesterId);
  await addNotification(userIdToAdd, "new_message", `Aggiunto al gruppo "${conv.name || "Gruppo"}"`, `${requesterName} ti ha aggiunto al gruppo`, { conversationId });
  conv.participantIds = pids;
  return conv;
}

export async function removeUserFromGroupConversation(conversationId: number, requesterId: number, userIdToRemove: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");
  if (conv.adminUserId !== requesterId) throw new Error("Solo l'amministratore può rimuovere membri");
  if (requesterId === userIdToRemove) throw new Error("Usa abbandona gruppo");

  const pids = conv.participantIds.filter((id: number) => id !== userIdToRemove);
  await run('UPDATE "conversations" SET "participantIds" = $1 WHERE id = $2', [pids, conversationId]);
  conv.participantIds = pids;
  return conv;
}

export async function leaveGroupConversation(conversationId: number, userId: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");
  const pids = conv.participantIds.filter((id: number) => id !== userId);
  await run('UPDATE "conversations" SET "participantIds" = $1 WHERE id = $2', [pids, conversationId]);
  conv.participantIds = pids;
  return conv;
}

export async function closeConversation(conversationId: number, userId: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) throw new Error("Conversazione non trovata");
  if (!conv.participantIds.includes(userId)) throw new Error("Non sei un partecipante");

  let pids: number[];
  if (conv.type === "group") {
    pids = conv.participantIds.filter((id: number) => id !== userId);
  } else {
    pids = conv.participantIds.filter((id: number) => id !== userId);
  }
  await run('UPDATE "conversations" SET "participantIds" = $1 WHERE id = $2', [pids, conversationId]);
  conv.participantIds = pids;
  return conv;
}

export async function getUserConversations(userId: number) {
  const convs = await query('SELECT * FROM "conversations" WHERE $1 = ANY("participantIds") ORDER BY "updatedAt" DESC', [userId]);
  const result = [];
  for (const c of convs) {
    const msgs = await query('SELECT * FROM "messages" WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT 1', [c.id]);
    const lastMsg = msgs.length > 0 ? await formatMessage(msgs[0]) : null;
    const participants = [];
    for (const pid of c.participantIds) {
      const prof = await getProfile(pid);
      participants.push({
        id: pid,
        name: await getUserName(pid),
        email: await getUserEmail(pid),
        photo: prof?.photo || null,
      });
    }
    result.push({
      id: c.id,
      participantIds: c.participantIds,
      type: c.type,
      name: c.name,
      adminUserId: c.adminUserId,
      updatedAt: c.updatedAt,
      lastMessage: lastMsg,
      participants,
    });
  }
  return result;
}

export async function getConversation(conversationId: number, userId: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) return null;
  if (!conv.participantIds.includes(userId)) return null;
  return conv;
}

// ====== MESSAGES ======

export async function sendMessage(
  conversationId: number,
  senderId: number,
  type: MessageType,
  content: string,
  extra?: {
    musicData?: { trackId: string; title: string; artist: string; thumbnail: string } | null;
    playlistData?: { playlistId: number; name: string; trackCount: number } | null;
    voiceUrl?: string | null;
    voiceDuration?: number | null;
  }
) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) throw new Error("Conversazione non trovata");
  if (!conv.participantIds.includes(senderId)) throw new Error("Non sei un partecipante");

  const result = await run(
    `INSERT INTO "messages" ("conversationId","senderId",type,content,"musicTrackId","musicTitle","musicArtist","musicThumbnail","playlistId","playlistName","playlistTrackCount","voiceUrl","voiceDuration","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      conversationId, senderId, type, content,
      extra?.musicData?.trackId || null, extra?.musicData?.title || null, extra?.musicData?.artist || null, extra?.musicData?.thumbnail || null,
      extra?.playlistData?.playlistId || null, extra?.playlistData?.name || null, extra?.playlistData?.trackCount || null,
      extra?.voiceUrl || null, extra?.voiceDuration || null,
      new Date().toISOString(),
    ]
  );
  const msg = result.rows[0];
  await run('UPDATE "conversations" SET "updatedAt" = $1 WHERE id = $2', [msg.createdAt, conversationId]);

  const snippet = type === "text" ? content : type === "music" ? "Ha condiviso un brano" : type === "playlist" ? "Ha condiviso una playlist" : type === "voice" ? "Ha inviato un vocale" : content;
  const senderName = await getUserName(senderId);
  for (const pid of conv.participantIds) {
    if (pid !== senderId) {
      await addNotification(pid, "new_message", `Nuovo messaggio da ${senderName}`, snippet, { conversationId, messageId: msg.id, senderId });
    }
  }

  return formatMessage(msg);
}

export async function getMessages(conversationId: number, userId: number, limit = 50, beforeId?: number) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv || !conv.participantIds.includes(userId)) return [];

  let msgs: any[];
  if (beforeId) {
    const before = await queryOne('SELECT "createdAt" FROM "messages" WHERE id = $1', [beforeId]);
    if (before) {
      msgs = await query(
        'SELECT * FROM "messages" WHERE "conversationId" = $1 AND "createdAt" < $2 ORDER BY "createdAt" DESC LIMIT $3',
        [conversationId, before.createdAt, limit]
      );
    } else {
      msgs = await query(
        'SELECT * FROM "messages" WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
        [conversationId, limit]
      );
    }
  } else {
    msgs = await query(
      'SELECT * FROM "messages" WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
      [conversationId, limit]
    );
  }

  msgs.reverse();
  const result = [];
  for (const m of msgs) {
    result.push(await formatMessage(m));
  }
  return result;
}

async function formatMessage(m: any) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    content: m.content,
    musicData: m.musicTrackId ? {
      trackId: m.musicTrackId,
      title: m.musicTitle || "",
      artist: m.musicArtist || "",
      thumbnail: m.musicThumbnail || "",
    } : null,
    playlistData: m.playlistId ? {
      playlistId: m.playlistId,
      name: m.playlistName || "",
      trackCount: m.playlistTrackCount || 0,
    } : null,
    voiceUrl: m.voiceUrl,
    voiceDuration: m.voiceDuration,
    createdAt: m.createdAt,
    senderName: await getUserName(m.senderId),
  };
}

// ====== NOTIFICATIONS ======

export async function addNotification(userId: number, type: string, title: string, body: string, data?: Record<string, unknown> | null) {
  const result = await run(
    'INSERT INTO "notifications" ("userId", type, title, body, data, "createdAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [userId, type, title, body, data ? JSON.stringify(data) : null, new Date().toISOString()]
  );
  const notif = result.rows[0];

  import("./push").then(({ sendPushNotification }) => {
    sendPushNotification(userId, title, body, { ...(data || {}), notificationId: notif.id, type });
  }).catch((err) => {
    console.error("[Push] Failed to send push notification:", err);
  });

  return notif;
}

export async function getNotifications(userId: number, limit = 50) {
  const rows = await query(
    'SELECT * FROM "notifications" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
    [userId, limit]
  );
  return rows.map((n: any) => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ? JSON.parse(n.data) : null,
    read: n.read,
    createdAt: n.createdAt,
  }));
}

export async function getUnreadNotificationCount(userId: number) {
  const row = await queryOne('SELECT COUNT(*) as count FROM "notifications" WHERE "userId" = $1 AND read = FALSE', [userId]);
  return parseInt(row?.count || "0", 10);
}

export async function markNotificationRead(notificationId: number, userId: number) {
  await run('UPDATE "notifications" SET read = TRUE WHERE id = $1 AND "userId" = $2', [notificationId, userId]);
  return true;
}

export async function markAllNotificationsRead(userId: number) {
  await run('UPDATE "notifications" SET read = TRUE WHERE "userId" = $1', [userId]);
  return true;
}

// ====== SETTINGS ======

export async function getSettings(userId: number): Promise<UserSettings> {
  const s = await queryOne('SELECT * FROM "settings" WHERE "userId" = $1', [userId]);
  if (!s) return { mixMode: false, mixModeBpmRange: 10, mixModeEnergy: "medium" };
  return {
    mixMode: s.mixMode,
    mixModeBpmRange: s.mixModeBpmRange,
    mixModeEnergy: s.mixModeEnergy as "low" | "medium" | "high",
  };
}

export async function updateSettings(userId: number, data: Partial<UserSettings>) {
  const existing = await queryOne('SELECT * FROM "settings" WHERE "userId" = $1', [userId]);
  if (!existing) {
    await run(
      'INSERT INTO "settings" ("userId", "mixMode", "mixModeBpmRange", "mixModeEnergy") VALUES ($1,$2,$3,$4)',
      [userId, data.mixMode ?? false, data.mixModeBpmRange ?? 10, data.mixModeEnergy ?? "medium"]
    );
  } else {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.mixMode !== undefined) { sets.push(`"mixMode" = $${idx++}`); params.push(data.mixMode); }
    if (data.mixModeBpmRange !== undefined) { sets.push(`"mixModeBpmRange" = $${idx++}`); params.push(data.mixModeBpmRange); }
    if (data.mixModeEnergy !== undefined) { sets.push(`"mixModeEnergy" = $${idx++}`); params.push(data.mixModeEnergy); }
    if (sets.length > 0) {
      params.push(userId);
      await run(`UPDATE "settings" SET ${sets.join(", ")} WHERE "userId" = $${idx}`, params);
    }
  }
  return getSettings(userId);
}

// ====== PUBLIC PROFILE DATA ======

export async function getPublicProfile(userId: number) {
  const prof = await getProfile(userId);
  const friendRows = await query(
    'SELECT * FROM "friendRequests" WHERE status = $1 AND ("fromUserId" = $2 OR "toUserId" = $2)',
    ["accepted", userId]
  );

  return {
    id: userId,
    name: await getUserName(userId),
    email: await getUserEmail(userId),
    photo: prof?.photo || null,
    banner: prof?.banner || null,
    bio: prof?.bio || null,
    friendsCount: friendRows.length,
    createdAt: "",
  };
}

export async function searchUsers(queryStr: string, currentUserId: number) {
  try {
    const q = queryStr.toLowerCase();
    const rows = await query(
      'SELECT id, email, name FROM "localUsers" WHERE id != $1 AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2)',
      [currentUserId, `%${q}%`]
    );
    return rows.map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
  } catch {
    return [];
  }
}

export async function getAllUsers(currentUserId: number) {
  try {
    const rows = await query(
      'SELECT id, email, name FROM "localUsers" WHERE id != $1 ORDER BY name',
      [currentUserId]
    );
    return rows.map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
  } catch {
    return [];
  }
}

// ====== PUSH SUBSCRIPTIONS ======

export async function savePushSubscription(userId: number, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const existing = await queryOne(
    'SELECT * FROM "pushSubscriptions" WHERE "userId" = $1 AND endpoint = $2',
    [userId, subscription.endpoint]
  );
  if (existing) {
    await run(
      'UPDATE "pushSubscriptions" SET keys_json = $1, "createdAt" = $2 WHERE id = $3',
      [JSON.stringify(subscription.keys), new Date().toISOString(), existing.id]
    );
  } else {
    await run(
      'INSERT INTO "pushSubscriptions" ("userId", endpoint, keys_json, "createdAt") VALUES ($1,$2,$3,$4)',
      [userId, subscription.endpoint, JSON.stringify(subscription.keys), new Date().toISOString()]
    );
  }
  return true;
}

export async function removePushSubscription(userId: number, endpoint: string) {
  await run('DELETE FROM "pushSubscriptions" WHERE "userId" = $1 AND endpoint = $2', [userId, endpoint]);
  return true;
}

export async function getPushSubscriptions(userId: number) {
  const rows = await query('SELECT * FROM "pushSubscriptions" WHERE "userId" = $1', [userId]);
  return rows.map((s: any) => ({
    endpoint: s.endpoint,
    keys: JSON.parse(s.keys_json),
  }));
}

// ====== adVANTAGE / LISTENING STATS ======

export async function recordListeningSession(
  userId: number,
  data: {
    trackId: string;
    trackTitle?: string | null;
    trackArtist?: string | null;
    trackThumbnail?: string | null;
    secondsListened: number;
    trackDuration?: number | null;
  }
) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await run(
    'INSERT INTO "listeningSessions" ("userId","trackId","trackTitle","trackArtist","trackThumbnail","secondsListened","trackDuration",date,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [userId, data.trackId, data.trackTitle ?? null, data.trackArtist ?? null, data.trackThumbnail ?? null, data.secondsListened, data.trackDuration ?? null, today, new Date().toISOString()]
  );
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await run('DELETE FROM "listeningSessions" WHERE "createdAt" < $1', [cutoff]);
  return result.rows[0];
}

export async function getUserVantageStats(userId: number): Promise<VantageStats> {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const totalRow = await queryOne('SELECT COALESCE(SUM("secondsListened"), 0) as total FROM "listeningSessions" WHERE "userId" = $1', [userId]);
  const totalSessions = await queryOne('SELECT COUNT(*) as count FROM "listeningSessions" WHERE "userId" = $1', [userId]);
  const dailyRow = await queryOne('SELECT COALESCE(SUM("secondsListened"), 0) as total FROM "listeningSessions" WHERE "userId" = $1 AND date = $2', [userId, today]);
  const weeklyRow = await queryOne('SELECT COALESCE(SUM("secondsListened"), 0) as total FROM "listeningSessions" WHERE "userId" = $1 AND date >= $2', [userId, weekAgo]);
  const monthlyRow = await queryOne('SELECT COALESCE(SUM("secondsListened"), 0) as total FROM "listeningSessions" WHERE "userId" = $1 AND date >= $2', [userId, monthAgo]);

  return {
    totalMinutes: Math.round(parseInt(totalRow?.total || "0") / 60),
    totalTracks: parseInt(totalSessions?.count || "0"),
    dailyMinutes: Math.round(parseInt(dailyRow?.total || "0") / 60),
    weeklyMinutes: Math.round(parseInt(weeklyRow?.total || "0") / 60),
    monthlyMinutes: Math.round(parseInt(monthlyRow?.total || "0") / 60),
  };
}

export async function getGroupLeaderboard(conversationId: number): Promise<VantageLeaderboardEntry[]> {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) return [];

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const userIds = conv.participantIds;

  const entries: VantageLeaderboardEntry[] = [];
  for (const userId of userIds) {
    const row = await queryOne(
      'SELECT COALESCE(SUM("secondsListened"), 0) as total, COUNT(*) as count FROM "listeningSessions" WHERE "userId" = $1 AND date >= $2',
      [userId, monthAgo]
    );
    entries.push({
      userId,
      name: await getUserName(userId),
      totalMinutes: Math.round(parseInt(row?.total || "0") / 60),
      totalTracks: parseInt(row?.count || "0"),
      rank: 0,
    });
  }

  entries.sort((a, b) => b.totalMinutes - a.totalMinutes);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

export async function getOrGenerateMonthlyRecap(userId: number, yearMonth?: string): Promise<MonthlyRecap | null> {
  const ym = yearMonth || new Date().toISOString().slice(0, 7);

  const existing = await queryOne(
    'SELECT * FROM "monthlyRecaps" WHERE "userId" = $1 AND "yearMonth" = $2',
    [userId, ym]
  );
  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      yearMonth: existing.yearMonth,
      totalMinutes: existing.totalMinutes,
      totalTracks: existing.totalTracks,
      topTracks: JSON.parse(existing.topTracks),
      generatedAt: existing.generatedAt,
    };
  }

  const monthStart = new Date(ym + "-01T00:00:00.000Z");
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const sessions = await query(
    'SELECT * FROM "listeningSessions" WHERE "userId" = $1 AND date >= $2 AND date < $3',
    [userId, monthStartStr, monthEndStr]
  );

  if (sessions.length === 0) return null;

  const totalSeconds = sessions.reduce((acc: number, s: any) => acc + s.secondsListened, 0);

  const trackCounts = new Map<string, { count: number; title: string; artist: string; thumbnail: string | null }>();
  for (const s of sessions) {
    const key = s.trackId;
    const existingTrack = trackCounts.get(key) || { count: 0, title: s.trackTitle || "", artist: s.trackArtist || "", thumbnail: s.trackThumbnail || null };
    existingTrack.count++;
    trackCounts.set(key, existingTrack);
  }

  const topTracks = [...trackCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([trackId, info]) => ({
      trackId,
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      playCount: info.count,
    }));

  const result = await run(
    'INSERT INTO "monthlyRecaps" ("userId","yearMonth","totalMinutes","totalTracks","topTracks","generatedAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [userId, ym, Math.round(totalSeconds / 60), sessions.length, JSON.stringify(topTracks), new Date().toISOString()]
  );
  const recap = result.rows[0];

  return {
    id: recap.id,
    userId: recap.userId,
    yearMonth: recap.yearMonth,
    totalMinutes: recap.totalMinutes,
    totalTracks: recap.totalTracks,
    topTracks,
    generatedAt: recap.generatedAt,
  };
}

export async function notifyGroupMonthlyWinner(conversationId: number, yearMonth?: string) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv || conv.type !== "group") return null;

  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  const memberRecaps: MonthlyRecap[] = [];
  for (const userId of conv.participantIds) {
    const recap = await getOrGenerateMonthlyRecap(userId, ym);
    if (recap) memberRecaps.push(recap);
  }

  if (memberRecaps.length === 0) return null;
  memberRecaps.sort((a, b) => b.totalMinutes - a.totalMinutes);
  const winner = memberRecaps[0];
  const winnerName = await getUserName(winner.userId);
  const groupName = conv.name || "Gruppo";

  for (const pid of conv.participantIds) {
    if (pid === winner.userId) {
      await addNotification(
        pid,
        "vantage_winner",
        `Hai vinto adVANTAGE!`,
        `Sei il primo in classifica in "${groupName}" con ${winner.totalMinutes} minuti ascoltati questo mese!`,
        { conversationId, yearMonth: ym, totalMinutes: winner.totalMinutes }
      );
    } else {
      const userRecap = memberRecaps.find((r) => r.userId === pid);
      await addNotification(
        pid,
        "vantage_recap",
        `adVANTAGE: ${winnerName} vince in "${groupName}"`,
        `${winnerName} ha ascoltato ${winner.totalMinutes} minuti questo mese${userRecap ? `, tu ne hai ascoltati ${userRecap.totalMinutes}` : ""}`,
        { conversationId, yearMonth: ym, winnerUserId: winner.userId, winnerMinutes: winner.totalMinutes }
      );
    }
  }

  return { winner: { ...winner, name: winnerName }, groupName };
}

export async function getMonthlyRecapForGroup(conversationId: number, yearMonth?: string) {
  const conv = await queryOne('SELECT * FROM "conversations" WHERE id = $1', [conversationId]);
  if (!conv) return null;

  const recaps: MonthlyRecap[] = [];
  for (const userId of conv.participantIds) {
    const recap = await getOrGenerateMonthlyRecap(userId, yearMonth);
    if (recap) recaps.push(recap);
  }

  recaps.sort((a, b) => b.totalMinutes - a.totalMinutes);

  const allTrackCounts = new Map<string, { count: number; title: string; artist: string; thumbnail: string | null }>();
  for (const r of recaps) {
    for (const t of r.topTracks) {
      const existingTrack = allTrackCounts.get(t.trackId) || { count: 0, title: t.title, artist: t.artist, thumbnail: t.thumbnail };
      existingTrack.count += t.playCount;
      allTrackCounts.set(t.trackId, existingTrack);
    }
  }
  const groupTopTracks = [...allTrackCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([trackId, info]) => ({
      trackId,
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      playCount: info.count,
    }));

  const members = [];
  for (const r of recaps) {
    members.push({
      userId: r.userId,
      name: await getUserName(r.userId),
      totalMinutes: r.totalMinutes,
      totalTracks: r.totalTracks,
    });
  }

  return {
    groupTopTracks,
    members,
  };
}

// ====== LISTENING ACTIVITY ======

export async function updateListeningActivity(userId: number, track: { id: string; title: string; artist: string; thumbnail: string }) {
  const existing = await queryOne('SELECT * FROM "listeningActivity" WHERE "userId" = $1', [userId]);
  const ts = new Date().toISOString();
  if (existing) {
    await run(
      'UPDATE "listeningActivity" SET "trackId" = $1, "trackTitle" = $2, "trackArtist" = $3, "trackThumbnail" = $4, "startedAt" = $5 WHERE "userId" = $6',
      [track.id, track.title, track.artist, track.thumbnail, ts, userId]
    );
  } else {
    await run(
      'INSERT INTO "listeningActivity" ("userId","trackId","trackTitle","trackArtist","trackThumbnail","startedAt") VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, track.id, track.title, track.artist, track.thumbnail, ts]
    );
  }
}

export async function clearListeningActivity(userId: number) {
  await run('DELETE FROM "listeningActivity" WHERE "userId" = $1', [userId]);
}

export async function getFriendActivity(userId: number) {
  const friends = await getFriends(userId);
  const friendIds = friends.map((f) => f.id);
  if (friendIds.length === 0) return [];

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const rows = await query(
    'SELECT * FROM "listeningActivity" WHERE "userId" = ANY($1) AND "startedAt" >= $2',
    [friendIds, fiveMinutesAgo]
  );

  const result = [];
  for (const a of rows) {
    const reactions = await query(
      'SELECT * FROM "reactions" WHERE "toUserId" = $1 AND "trackId" = $2',
      [a.userId, a.trackId]
    );
    const reactionList = [];
    for (const r of reactions) {
      reactionList.push({
        fromUserId: r.fromUserId,
        fromName: await getUserName(r.fromUserId),
        emoji: r.emoji,
      });
    }
    result.push({
      userId: a.userId,
      name: await getUserName(a.userId),
      trackId: a.trackId,
      trackTitle: a.trackTitle,
      trackArtist: a.trackArtist,
      trackThumbnail: a.trackThumbnail,
      startedAt: a.startedAt,
      reactions: reactionList,
    });
  }
  return result;
}

export async function getOnlineFriendIds(userId: number): Promise<number[]> {
  const friends = await getFriends(userId);
  const friendIds = friends.map((f) => f.id);
  if (friendIds.length === 0) return [];

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const rows = await query(
    'SELECT DISTINCT "userId" FROM "listeningActivity" WHERE "userId" = ANY($1) AND "startedAt" >= $2',
    [friendIds, twoMinutesAgo]
  );
  return rows.map((r: any) => r.userId);
}

// ====== LISTEN TOGETHER ======

function generateTogetherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createListenTogetherSession(
  creatorId: number,
  track: { id: string; title: string; artist: string; thumbnail: string }
) {
  const existing = await queryOne(
    'SELECT * FROM "listenTogetherSessions" WHERE "creatorUserId" = $1 AND array_length("participants", 1) < 10',
    [creatorId]
  );
  if (existing) {
    await run(
      'UPDATE "listenTogetherSessions" SET "trackId" = $1, "trackTitle" = $2, "trackArtist" = $3, "trackThumbnail" = $4, "isPlaying" = TRUE, "currentTime" = 0 WHERE id = $5',
      [track.id, track.title, track.artist, track.thumbnail, existing.id]
    );
    existing.trackId = track.id;
    existing.trackTitle = track.title;
    existing.trackArtist = track.artist;
    existing.trackThumbnail = track.thumbnail;
    return existing;
  }

  const result = await run(
    'INSERT INTO "listenTogetherSessions" (code, "creatorUserId", "trackId", "trackTitle", "trackArtist", "trackThumbnail", participants) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [generateTogetherCode(), creatorId, track.id, track.title, track.artist, track.thumbnail, [creatorId]]
  );
  return result.rows[0];
}

export async function joinListenTogetherSession(code: string, userId: number) {
  const session = await queryOne('SELECT * FROM "listenTogetherSessions" WHERE code = $1', [code]);
  if (!session) throw new Error("Sessione non trovata");
  if (session.participants.includes(userId)) return session;
  if (session.participants.length >= 10) throw new Error("Sessione piena (max 10)");
  const pids = [...session.participants, userId];
  await run('UPDATE "listenTogetherSessions" SET participants = $1 WHERE code = $2', [pids, code]);
  session.participants = pids;
  return session;
}

export async function leaveListenTogetherSession(code: string, userId: number) {
  const session = await queryOne('SELECT * FROM "listenTogetherSessions" WHERE code = $1', [code]);
  if (!session) return null;
  let pids = session.participants.filter((p: number) => p !== userId);
  if (pids.length === 0) {
    await run('DELETE FROM "listenTogetherSessions" WHERE code = $1', [code]);
    return null;
  }
  await run('UPDATE "listenTogetherSessions" SET participants = $1 WHERE code = $2', [pids, code]);
  return session;
}

export async function updateListenTogetherTrack(
  code: string,
  userId: number,
  track: { id: string; title: string; artist: string; thumbnail: string },
  currentTime: number
) {
  const session = await queryOne('SELECT * FROM "listenTogetherSessions" WHERE code = $1', [code]);
  if (!session) throw new Error("Sessione non trovata");
  if (session.creatorUserId !== userId) throw new Error("Solo il creatore può cambiare brano");
  await run(
    'UPDATE "listenTogetherSessions" SET "trackId" = $1, "trackTitle" = $2, "trackArtist" = $3, "trackThumbnail" = $4, "currentTime" = $5, "isPlaying" = TRUE WHERE code = $6',
    [track.id, track.title, track.artist, track.thumbnail, currentTime, code]
  );
  session.trackId = track.id;
  session.trackTitle = track.title;
  session.trackArtist = track.artist;
  session.trackThumbnail = track.thumbnail;
  return session;
}

export async function updateListenTogetherPlayState(code: string, userId: number, isPlaying: boolean, currentTime: number) {
  const session = await queryOne('SELECT * FROM "listenTogetherSessions" WHERE code = $1', [code]);
  if (!session) throw new Error("Sessione non trovata");
  if (session.creatorUserId !== userId) throw new Error("Solo il creatore può controllare la riproduzione");
  await run(
    'UPDATE "listenTogetherSessions" SET "isPlaying" = $1, "currentTime" = $2 WHERE code = $3',
    [isPlaying, currentTime, code]
  );
  return session;
}

export async function getListenTogetherSession(code: string) {
  const s = await queryOne('SELECT * FROM "listenTogetherSessions" WHERE code = $1', [code]);
  if (!s) return null;
  return {
    ...s,
    creatorName: await getUserName(s.creatorUserId),
    participants: await Promise.all(s.participants.map(async (p: number) => ({ id: p, name: await getUserName(p) }))),
  };
}

export async function getUserListenTogetherSessions(userId: number) {
  const rows = await query('SELECT * FROM "listenTogetherSessions" WHERE $1 = ANY(participants)', [userId]);
  const result = [];
  for (const s of rows) {
    result.push({
      ...s,
      creatorName: await getUserName(s.creatorUserId),
      participants: await Promise.all(s.participants.map(async (p: number) => ({ id: p, name: await getUserName(p) }))),
    });
  }
  return result;
}

// ====== REACTIONS ======

export async function addReaction(toUserId: number, fromUserId: number, trackId: string, emoji: string) {
  const existing = await queryOne(
    'SELECT * FROM "reactions" WHERE "toUserId" = $1 AND "fromUserId" = $2 AND "trackId" = $3',
    [toUserId, fromUserId, trackId]
  );
  if (existing) {
    await run('UPDATE "reactions" SET emoji = $1 WHERE id = $2', [emoji, existing.id]);
  } else {
    await run(
      'INSERT INTO "reactions" ("toUserId","fromUserId","trackId",emoji) VALUES ($1,$2,$3,$4)',
      [toUserId, fromUserId, trackId, emoji]
    );
  }
  const fromName = await getUserName(fromUserId);
  const trackTitle = await getTrackTitle(trackId);
  await addNotification(toUserId, "reaction", `Reazione da ${fromName}`, `${fromName} ha reagito a "${trackTitle}" con ${emoji}`, { fromUserId, trackId, emoji });
  return true;
}

async function getTrackTitle(trackId: string): Promise<string> {
  const activity = await queryOne('SELECT "trackTitle" FROM "listeningActivity" WHERE "trackId" = $1', [trackId]);
  return activity?.trackTitle || trackId;
}

export async function getReactionsForTrack(toUserId: number, trackId: string) {
  const rows = await query(
    'SELECT * FROM "reactions" WHERE "toUserId" = $1 AND "trackId" = $2',
    [toUserId, trackId]
  );
  const result = [];
  for (const r of rows) {
    result.push({
      id: r.id,
      fromUserId: r.fromUserId,
      fromName: await getUserName(r.fromUserId),
      emoji: r.emoji,
      createdAt: r.createdAt,
    });
  }
  return result;
}
