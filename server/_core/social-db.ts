import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { MessageType, UserSettings, ListeningSession, MonthlyRecap, VantageStats, VantageLeaderboardEntry } from "../../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "../../local-beta-db.json");

// ====== Types ======

interface ProfileRecord {
  userId: number;
  photo: string | null;
  banner: string | null;
  bio: string | null;
  updatedAt: string;
}

interface FriendRequestRecord {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

interface ConversationRecord {
  id: number;
  participantIds: number[];
  type: "direct" | "group";
  name?: string;
  adminUserId?: number;
  updatedAt: string;
}

interface MessageRecord {
  id: number;
  conversationId: number;
  senderId: number;
  type: MessageType;
  content: string;
  musicTrackId: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  musicThumbnail: string | null;
  playlistId: number | null;
  playlistName: string | null;
  playlistTrackCount: number | null;
  voiceUrl: string | null;
  voiceDuration: number | null;
  createdAt: string;
}

interface NotificationRecord {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  data: string | null;
  read: boolean;
  createdAt: string;
}

interface SettingsRecord {
  userId: number;
  mixMode: boolean;
  mixModeBpmRange: number;
  mixModeEnergy: string;
}

interface ListeningSessionRecord {
  id: number;
  userId: number;
  trackId: string;
  trackTitle: string | null;
  trackArtist: string | null;
  trackThumbnail: string | null;
  secondsListened: number;
  trackDuration: number | null;
  date: string;
  createdAt: string;
}

interface MonthlyRecapRecord {
  id: number;
  userId: number;
  yearMonth: string;
  totalMinutes: number;
  totalTracks: number;
  topTracks: string;
  generatedAt: string;
}

interface SocialDb {
  profiles: ProfileRecord[];
  friendRequests: FriendRequestRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  notifications: NotificationRecord[];
  settings: SettingsRecord[];
  pushSubscriptions: PushSubscriptionRecord[];
  listeningSessions: ListeningSessionRecord[];
  monthlyRecaps: MonthlyRecapRecord[];
  listeningActivity: ListeningActivityRecord[];
  listenTogetherSessions: ListenTogetherSessionRecord[];
  reactions: ReactionRecord[];
}

interface PushSubscriptionRecord {
  userId: number;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

interface ListeningActivityRecord {
  userId: number;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail: string;
  startedAt: string;
}

interface ListenTogetherSessionRecord {
  id: number;
  code: string;
  creatorUserId: number;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail: string;
  isPlaying: boolean;
  currentTime: number;
  participants: number[];
  createdAt: string;
}

interface ReactionRecord {
  id: number;
  toUserId: number;
  fromUserId: number;
  trackId: string;
  emoji: string;
  createdAt: string;
}

// ====== Load/Save ======

let _cache: SocialDb | null = null;

function loadFull(): Record<string, any> {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveFull(data: Record<string, any>) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[SocialDB] Failed to save:", e);
  }
}

function load(): SocialDb {
  if (_cache) return _cache;
  const data = loadFull();
  _cache = {
    profiles: data.profiles || [],
    friendRequests: data.friendRequests || [],
    conversations: data.conversations || [],
    messages: data.messages || [],
    notifications: data.notifications || [],
    settings: data.settings || [],
    pushSubscriptions: data.pushSubscriptions || [],
    listeningSessions: data.listeningSessions || [],
    monthlyRecaps: data.monthlyRecaps || [],
    listeningActivity: data.listeningActivity || [],
    listenTogetherSessions: data.listenTogetherSessions || [],
    reactions: data.reactions || [],
  };
  return _cache;
}

function save() {
  const data = loadFull();
  data.profiles = _cache!.profiles;
  data.friendRequests = _cache!.friendRequests;
  data.conversations = _cache!.conversations;
  data.messages = _cache!.messages;
  data.notifications = _cache!.notifications;
  data.settings = _cache!.settings;
  data.pushSubscriptions = _cache!.pushSubscriptions;
  data.listeningSessions = _cache!.listeningSessions;
  data.monthlyRecaps = _cache!.monthlyRecaps;
  data.listeningActivity = _cache!.listeningActivity;
  data.listenTogetherSessions = _cache!.listenTogetherSessions;
  data.reactions = _cache!.reactions;
  saveFull(data);
  _cache = null;
}

let nextIds: Record<string, number> = {};

function getNextId(collection: string): number {
  if (!nextIds[collection]) {
    const db = load();
    const items = (db as any)[collection] as Array<{ id: number }> || [];
    nextIds[collection] = items.length > 0 ? Math.max(...items.map((i: any) => i.id)) + 1 : 1;
  }
  return nextIds[collection]++;
}

// ====== Helpers ======

function getUserName(userId: number): string {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, "../../users.json"), "utf-8"));
    const u = users.find((x: any) => x.id === userId);
    return u ? u.name : "Utente sconosciuto";
  } catch {
    return "Utente sconosciuto";
  }
}

function getUserEmail(userId: number): string {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, "../../users.json"), "utf-8"));
    const u = users.find((x: any) => x.id === userId);
    return u ? u.email : "unknown";
  } catch {
    return "unknown";
  }
}

// ====== PROFILES ======

export function getProfile(userId: number) {
  const db = load();
  return db.profiles.find((p) => p.userId === userId) || null;
}

export function upsertProfile(userId: number, data: { photo?: string | null; banner?: string | null; bio?: string | null }) {
  const db = load();
  const existing = db.profiles.find((p) => p.userId === userId);
  if (existing) {
    if (data.photo !== undefined) existing.photo = data.photo;
    if (data.banner !== undefined) existing.banner = data.banner;
    if (data.bio !== undefined) existing.bio = data.bio;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.profiles.push({
      userId,
      photo: data.photo || null,
      banner: data.banner || null,
      bio: data.bio || null,
      updatedAt: new Date().toISOString(),
    });
  }
  save();
  return getProfile(userId);
}

// ====== FRIENDS ======

export function sendFriendRequest(fromUserId: number, toUserId: number) {
  if (fromUserId === toUserId) throw new Error("Non puoi aggiungere te stesso");
  const db = load();
  const existing = db.friendRequests.find(
    (r) =>
      (r.fromUserId === fromUserId && r.toUserId === toUserId) ||
      (r.fromUserId === toUserId && r.toUserId === fromUserId)
  );
  if (existing) {
    if (existing.status === "accepted") throw new Error("Sei già amico di questo utente");
    if (existing.status === "pending") throw new Error("Richiesta già inviata");
    if (existing.status === "rejected") {
      existing.status = "pending";
      existing.createdAt = new Date().toISOString();
      save();
      return existing;
    }
  }
  const record: FriendRequestRecord = {
    id: getNextId("friendRequests"),
    fromUserId,
    toUserId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.friendRequests.push(record);

  addNotification(toUserId, "friend_request", "Richiesta di amicizia", `${getUserName(fromUserId)} vuole diventare tuo amico`, { fromUserId });
  save();
  return record;
}

export function acceptFriendRequest(requestId: number, userId: number) {
  const db = load();
  const req = db.friendRequests.find((r) => r.id === requestId);
  if (!req) throw new Error("Richiesta non trovata");
  if (req.toUserId !== userId) throw new Error("Non autorizzato");
  req.status = "accepted";

  addNotification(req.fromUserId, "friend_accepted", "Richiesta accettata", `${getUserName(userId)} ha accettato la tua richiesta di amicizia`, { userId });
  save();

  const conv = getOrCreateConversation([req.fromUserId, req.toUserId]);
  return { request: req, conversation: conv };
}

export function rejectFriendRequest(requestId: number, userId: number) {
  const db = load();
  const req = db.friendRequests.find((r) => r.id === requestId);
  if (!req) throw new Error("Richiesta non trovata");
  if (req.toUserId !== userId) throw new Error("Non autorizzato");
  req.status = "rejected";
  save();
  return req;
}

export function cancelFriendRequest(requestId: number, userId: number) {
  const db = load();
  const idx = db.friendRequests.findIndex(
    (r) => r.id === requestId && r.fromUserId === userId && r.status === "pending"
  );
  if (idx === -1) throw new Error("Richiesta non trovata o già gestita");
  db.friendRequests.splice(idx, 1);
  save();
  return true;
}

export function getFriendRequests(userId: number) {
  const db = load();
  const pending = db.friendRequests.filter(
    (r) => r.toUserId === userId && r.status === "pending"
  );
  return pending.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    status: r.status,
    createdAt: r.createdAt,
    fromUser: { id: r.fromUserId, name: getUserName(r.fromUserId), email: getUserEmail(r.fromUserId) },
    toUser: { id: r.toUserId, name: getUserName(r.toUserId), email: getUserEmail(r.toUserId) },
  }));
}

export function getSentRequests(userId: number) {
  const db = load();
  const sent = db.friendRequests.filter(
    (r) => r.fromUserId === userId && r.status === "pending"
  );
  return sent.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    status: r.status,
    createdAt: r.createdAt,
    fromUser: { id: r.fromUserId, name: getUserName(r.fromUserId), email: getUserEmail(r.fromUserId) },
    toUser: { id: r.toUserId, name: getUserName(r.toUserId), email: getUserEmail(r.toUserId) },
  }));
}

export function getFriends(userId: number) {
  const db = load();
  const accepted = db.friendRequests.filter(
    (r) => r.status === "accepted" && (r.fromUserId === userId || r.toUserId === userId)
  );
  return accepted.map((r) => {
    const friendId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
    return { id: friendId, name: getUserName(friendId), email: getUserEmail(friendId) };
  });
}

export function getFriendStatus(userId: number, otherUserId: number): string {
  if (userId === otherUserId) return "self";
  const db = load();
  const req = db.friendRequests.find(
    (r) =>
      (r.fromUserId === userId && r.toUserId === otherUserId) ||
      (r.fromUserId === otherUserId && r.toUserId === userId)
  );
  if (!req) return "none";
  if (req.status === "accepted") return "friends";
  if (req.status === "pending") {
    return req.fromUserId === userId ? "pending_sent" : "pending_received";
  }
  return "none";
}

export function removeFriend(userId: number, friendId: number) {
  const db = load();
  const idx = db.friendRequests.findIndex(
    (r) =>
      r.status === "accepted" &&
      ((r.fromUserId === userId && r.toUserId === friendId) ||
        (r.fromUserId === friendId && r.toUserId === userId))
  );
  if (idx === -1) throw new Error("Non siete amici");
  db.friendRequests.splice(idx, 1);
  save();
  return true;
}

// ====== CONVERSATIONS ======

export function getOrCreateConversation(participantIds: number[]) {
  const db = load();
  const sorted = [...participantIds].sort();
  let conv = db.conversations.find((c) => {
    const ps = [...c.participantIds].sort();
    return ps.length === sorted.length && ps.every((p, i) => p === sorted[i]);
  });
  if (!conv) {
    conv = {
      id: getNextId("conversations"),
      participantIds: sorted,
      type: sorted.length === 2 ? "direct" : "group",
      updatedAt: new Date().toISOString(),
    };
    db.conversations.push(conv);
    save();
  }
  return conv;
}

export function createGroupConversation(creatorId: number, name: string, participantIds: number[]) {
  const db = load();
  const allIds = [...new Set([creatorId, ...participantIds])];
  if (allIds.length < 2) throw new Error("Servono almeno 2 partecipanti");
  if (allIds.length > 10) throw new Error("Massimo 10 partecipanti");

  const conv: ConversationRecord = {
    id: getNextId("conversations"),
    participantIds: allIds,
    type: "group",
    name,
    adminUserId: creatorId,
    updatedAt: new Date().toISOString(),
  };
  db.conversations.push(conv);
  save();

  // Notify all participants
  for (const pid of allIds) {
    if (pid !== creatorId) {
      addNotification(pid, "new_message", `Aggiunto al gruppo "${name}"`, `${getUserName(creatorId)} ti ha aggiunto al gruppo`, { conversationId: conv.id });
    }
  }

  return conv;
}

export function addUserToGroupConversation(conversationId: number, requesterId: number, userIdToAdd: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");
  if (conv.adminUserId !== requesterId) throw new Error("Solo l'amministratore può aggiungere membri");
  if (conv.participantIds.includes(userIdToAdd)) throw new Error("Utente già nel gruppo");
  if (conv.participantIds.length >= 10) throw new Error("Massimo 10 partecipanti");

  conv.participantIds.push(userIdToAdd);
  save();

  addNotification(userIdToAdd, "new_message", `Aggiunto al gruppo "${conv.name || "Gruppo"}"`, `${getUserName(requesterId)} ti ha aggiunto al gruppo`, { conversationId });
  return conv;
}

export function removeUserFromGroupConversation(conversationId: number, requesterId: number, userIdToRemove: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");
  if (conv.adminUserId !== requesterId) throw new Error("Solo l'amministratore può rimuovere membri");
  if (requesterId === userIdToRemove) throw new Error("Usa abbandona gruppo");

  conv.participantIds = conv.participantIds.filter((id) => id !== userIdToRemove);
  save();
  return conv;
}

export function leaveGroupConversation(conversationId: number, userId: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Conversazione non trovata");
  if (conv.type !== "group") throw new Error("Non è un gruppo");

  conv.participantIds = conv.participantIds.filter((id) => id !== userId);
  save();
  return conv;
}

export function closeConversation(conversationId: number, userId: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Conversazione non trovata");
  if (!conv.participantIds.includes(userId)) throw new Error("Non sei un partecipante");

  if (conv.type === "group") {
    conv.participantIds = conv.participantIds.filter((id) => id !== userId);
  } else {
    // For direct conversations, remove both participants
    conv.participantIds = conv.participantIds.filter((id) => id !== userId);
  }
  save();
  return conv;
}

export function getUserConversations(userId: number) {
  const db = load();
  const convs = db.conversations
    .filter((c) => c.participantIds.includes(userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return convs.map((c) => {
    const msgs = db.messages.filter((m) => m.conversationId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lastMsg = msgs.length > 0 ? formatMessage(msgs[0]) : null;
    return {
      id: c.id,
      participantIds: c.participantIds,
      type: c.type,
      name: c.name,
      adminUserId: c.adminUserId,
      updatedAt: c.updatedAt,
      lastMessage: lastMsg,
      participants: c.participantIds.map((pid) => ({
        id: pid,
        name: getUserName(pid),
        email: getUserEmail(pid),
        photo: getProfile(pid)?.photo || null,
      })),
    };
  });
}

export function getConversation(conversationId: number, userId: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return null;
  if (!conv.participantIds.includes(userId)) return null;
  return conv;
}

// ====== MESSAGES ======

export function sendMessage(
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
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Conversazione non trovata");
  if (!conv.participantIds.includes(senderId)) throw new Error("Non sei un partecipante");

  const msg: MessageRecord = {
    id: getNextId("messages"),
    conversationId,
    senderId,
    type,
    content,
    musicTrackId: extra?.musicData?.trackId || null,
    musicTitle: extra?.musicData?.title || null,
    musicArtist: extra?.musicData?.artist || null,
    musicThumbnail: extra?.musicData?.thumbnail || null,
    playlistId: extra?.playlistData?.playlistId || null,
    playlistName: extra?.playlistData?.name || null,
    playlistTrackCount: extra?.playlistData?.trackCount || null,
    voiceUrl: extra?.voiceUrl || null,
    voiceDuration: extra?.voiceDuration || null,
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  conv.updatedAt = msg.createdAt;
  save();

  const snippet = type === "text" ? content : type === "music" ? "🎵 Ha condiviso un brano" : type === "playlist" ? "📋 Ha condiviso una playlist" : type === "voice" ? "🎤 Ha inviato un vocale" : content;
  for (const pid of conv.participantIds) {
    if (pid !== senderId) {
      addNotification(pid, "new_message", `Nuovo messaggio da ${getUserName(senderId)}`, snippet, { conversationId, messageId: msg.id, senderId });
    }
  }

  return formatMessage(msg);
}

export function getMessages(conversationId: number, userId: number, limit = 50, beforeId?: number) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv || !conv.participantIds.includes(userId)) return [];

  let msgs = db.messages.filter((m) => m.conversationId === conversationId);
  msgs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (beforeId) {
    const idx = msgs.findIndex((m) => m.id === beforeId);
    if (idx >= 0) msgs = msgs.slice(idx + 1);
  }

  return msgs.slice(0, limit).reverse().map(formatMessage);
}

function formatMessage(m: MessageRecord) {
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
    senderName: getUserName(m.senderId),
  };
}

// ====== NOTIFICATIONS ======

export function addNotification(userId: number, type: string, title: string, body: string, data?: Record<string, unknown> | null) {
  const db = load();
  const notif: NotificationRecord = {
    id: getNextId("notifications"),
    userId,
    type,
    title,
    body,
    data: data ? JSON.stringify(data) : null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.push(notif);
  save();

  import("./push").then(({ sendPushNotification }) => {
    sendPushNotification(userId, title, body, { ...(data || {}), notificationId: notif.id, type });
  }).catch((err) => {
    console.error("[Push] Failed to send push notification:", err);
  });

  return notif;
}

export function getNotifications(userId: number, limit = 50) {
  const db = load();
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((n) => ({
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

export function getUnreadNotificationCount(userId: number) {
  const db = load();
  return db.notifications.filter((n) => n.userId === userId && !n.read).length;
}

export function markNotificationRead(notificationId: number, userId: number) {
  const db = load();
  const n = db.notifications.find((x) => x.id === notificationId && x.userId === userId);
  if (n) n.read = true;
  save();
  return n;
}

export function markAllNotificationsRead(userId: number) {
  const db = load();
  db.notifications.forEach((n) => {
    if (n.userId === userId) n.read = true;
  });
  save();
  return true;
}

// ====== SETTINGS ======

export function getSettings(userId: number): UserSettings {
  const db = load();
  const s = db.settings.find((x) => x.userId === userId);
  if (!s) return { mixMode: false, mixModeBpmRange: 10, mixModeEnergy: "medium" };
  return {
    mixMode: s.mixMode,
    mixModeBpmRange: s.mixModeBpmRange,
    mixModeEnergy: s.mixModeEnergy as "low" | "medium" | "high",
  };
}

export function updateSettings(userId: number, data: Partial<UserSettings>) {
  const db = load();
  let s = db.settings.find((x) => x.userId === userId);
  if (!s) {
    s = { userId, mixMode: false, mixModeBpmRange: 10, mixModeEnergy: "medium" };
    db.settings.push(s);
  }
  if (data.mixMode !== undefined) s.mixMode = data.mixMode;
  if (data.mixModeBpmRange !== undefined) s.mixModeBpmRange = data.mixModeBpmRange;
  if (data.mixModeEnergy !== undefined) s.mixModeEnergy = data.mixModeEnergy;
  save();
  return getSettings(userId);
}

// ====== PUBLIC PROFILE DATA ======

export function getPublicProfile(userId: number) {
  const prof = getProfile(userId);
  const db = load();

  const allFriends = db.friendRequests.filter(
    (r) => r.status === "accepted" && (r.fromUserId === userId || r.toUserId === userId)
  );

  return {
    id: userId,
    name: getUserName(userId),
    email: getUserEmail(userId),
    photo: prof?.photo || null,
    banner: prof?.banner || null,
    bio: prof?.bio || null,
    friendsCount: allFriends.length,
    createdAt: "",
  };
}

export function searchUsers(query: string, currentUserId: number) {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, "../../users.json"), "utf-8"));
    const q = query.toLowerCase();
    return users
      .filter((u: any) => u.id !== currentUserId && (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)))
      .map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
  } catch {
    return [];
  }
}

export function getAllUsers(currentUserId: number) {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, "../../users.json"), "utf-8"));
    return users
      .filter((u: any) => u.id !== currentUserId)
      .map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
  } catch {
    return [];
  }
}

// ====== PUSH SUBSCRIPTIONS ======

export function savePushSubscription(userId: number, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const db = load();
  const existing = db.pushSubscriptions.findIndex((s) => s.userId === userId && s.endpoint === subscription.endpoint);
  if (existing >= 0) {
    db.pushSubscriptions[existing].keys = subscription.keys;
    db.pushSubscriptions[existing].createdAt = new Date().toISOString();
  } else {
    db.pushSubscriptions.push({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString(),
    });
  }
  save();
  return true;
}

export function removePushSubscription(userId: number, endpoint: string) {
  const db = load();
  const idx = db.pushSubscriptions.findIndex((s) => s.userId === userId && s.endpoint === endpoint);
  if (idx >= 0) {
    db.pushSubscriptions.splice(idx, 1);
    save();
  }
  return true;
}

export function getPushSubscriptions(userId: number) {
  const db = load();
  return db.pushSubscriptions
    .filter((s) => s.userId === userId)
    .map((s) => ({ endpoint: s.endpoint, keys: s.keys }));
}

// ====== adVANTAGE / LISTENING STATS ======

export function recordListeningSession(
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
  const db = load();
  const today = new Date().toISOString().slice(0, 10);
  const session: ListeningSessionRecord = {
    id: getNextId("listeningSessions"),
    userId,
    trackId: data.trackId,
    trackTitle: data.trackTitle ?? null,
    trackArtist: data.trackArtist ?? null,
    trackThumbnail: data.trackThumbnail ?? null,
    secondsListened: data.secondsListened,
    trackDuration: data.trackDuration ?? null,
    date: today,
    createdAt: new Date().toISOString(),
  };
  db.listeningSessions.push(session);
  // Keep only last 90 days of raw sessions to save space
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  db.listeningSessions = db.listeningSessions.filter((s) => s.createdAt > cutoff);
  save();
  return session;
}

export function getUserVantageStats(userId: number): VantageStats {
  const db = load();
  const sessions = db.listeningSessions.filter((s) => s.userId === userId);
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const totalSeconds = sessions.reduce((acc, s) => acc + s.secondsListened, 0);
  const dailySessions = sessions.filter((s) => s.date === today);
  const weeklySessions = sessions.filter((s) => s.date >= weekAgo);
  const monthlySessions = sessions.filter((s) => s.date >= monthAgo);

  return {
    totalMinutes: Math.round(totalSeconds / 60),
    totalTracks: sessions.length,
    dailyMinutes: Math.round(dailySessions.reduce((acc, s) => acc + s.secondsListened, 0) / 60),
    weeklyMinutes: Math.round(weeklySessions.reduce((acc, s) => acc + s.secondsListened, 0) / 60),
    monthlyMinutes: Math.round(monthlySessions.reduce((acc, s) => acc + s.secondsListened, 0) / 60),
  };
}

export function getGroupLeaderboard(conversationId: number): VantageLeaderboardEntry[] {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return [];

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const userIds = conv.participantIds;

  const entries: VantageLeaderboardEntry[] = userIds.map((userId) => {
    const sessions = db.listeningSessions.filter(
      (s) => s.userId === userId && s.date >= monthAgo
    );
    const totalSeconds = sessions.reduce((acc, s) => acc + s.secondsListened, 0);
    return {
      userId,
      name: getUserName(userId),
      totalMinutes: Math.round(totalSeconds / 60),
      totalTracks: sessions.length,
      rank: 0,
    };
  });

  entries.sort((a, b) => b.totalMinutes - a.totalMinutes);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

export function getOrGenerateMonthlyRecap(userId: number, yearMonth?: string): MonthlyRecap | null {
  const db = load();
  const ym = yearMonth || new Date().toISOString().slice(0, 7);

  let existing = db.monthlyRecaps.find((r) => r.userId === userId && r.yearMonth === ym);
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

  // Generate new recap
  const monthStart = new Date(ym + "-01T00:00:00.000Z");
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const sessions = db.listeningSessions.filter(
    (s) => s.userId === userId && s.date >= monthStartStr && s.date < monthEndStr
  );

  if (sessions.length === 0) return null;

  const totalSeconds = sessions.reduce((acc, s) => acc + s.secondsListened, 0);
  
  // Count plays per track
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

  const recap: MonthlyRecapRecord = {
    id: getNextId("monthlyRecaps"),
    userId,
    yearMonth: ym,
    totalMinutes: Math.round(totalSeconds / 60),
    totalTracks: sessions.length,
    topTracks: JSON.stringify(topTracks),
    generatedAt: new Date().toISOString(),
  };
  db.monthlyRecaps.push(recap);
  save();

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

export function notifyGroupMonthlyWinner(conversationId: number, yearMonth?: string) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv || conv.type !== "group") return null;

  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  const memberRecaps = conv.participantIds
    .map((userId) => getOrGenerateMonthlyRecap(userId, ym))
    .filter(Boolean) as MonthlyRecap[];

  if (memberRecaps.length === 0) return null;
  memberRecaps.sort((a, b) => b.totalMinutes - a.totalMinutes);
  const winner = memberRecaps[0];
  const winnerName = getUserName(winner.userId);
  const groupName = conv.name || "Gruppo";

  for (const pid of conv.participantIds) {
    if (pid === winner.userId) {
      addNotification(
        pid,
        "vantage_winner",
        `Hai vinto adVANTAGE! 🏆`,
        `Sei il primo in classifica in "${groupName}" con ${winner.totalMinutes} minuti ascoltati questo mese!`,
        { conversationId, yearMonth: ym, totalMinutes: winner.totalMinutes }
      );
    } else {
      const userRecap = memberRecaps.find((r) => r.userId === pid);
      addNotification(
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

export function getMonthlyRecapForGroup(conversationId: number, yearMonth?: string) {
  const db = load();
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (!conv) return null;

  // Get recap for each user in group
  const recaps = conv.participantIds
    .map((userId) => getOrGenerateMonthlyRecap(userId, yearMonth))
    .filter(Boolean) as MonthlyRecap[];

  // Sort by total minutes descending
  recaps.sort((a, b) => b.totalMinutes - a.totalMinutes);

  // Top 5 tracks across all group members
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

  return {
    groupTopTracks,
    members: recaps.map((r) => ({
      userId: r.userId,
      name: getUserName(r.userId),
      totalMinutes: r.totalMinutes,
      totalTracks: r.totalTracks,
    })),
  };
}

// ====== LISTENING ACTIVITY ======

export function updateListeningActivity(userId: number, track: { id: string; title: string; artist: string; thumbnail: string }) {
  const db = load();
  const existing = db.listeningActivity.find((a) => a.userId === userId);
  if (existing) {
    existing.trackId = track.id;
    existing.trackTitle = track.title;
    existing.trackArtist = track.artist;
    existing.trackThumbnail = track.thumbnail;
    existing.startedAt = new Date().toISOString();
  } else {
    db.listeningActivity.push({
      userId,
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      trackThumbnail: track.thumbnail,
      startedAt: new Date().toISOString(),
    });
  }
  save();
}

export function clearListeningActivity(userId: number) {
  const db = load();
  const idx = db.listeningActivity.findIndex((a) => a.userId === userId);
  if (idx >= 0) {
    db.listeningActivity.splice(idx, 1);
    save();
  }
}

export function getFriendActivity(userId: number) {
  const db = load();
  const friends = getFriends(userId);
  const friendIds = new Set(friends.map((f) => f.id));
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return db.listeningActivity
    .filter((a) => friendIds.has(a.userId) && a.startedAt >= fiveMinutesAgo)
    .map((a) => ({
      userId: a.userId,
      name: getUserName(a.userId),
      trackId: a.trackId,
      trackTitle: a.trackTitle,
      trackArtist: a.trackArtist,
      trackThumbnail: a.trackThumbnail,
      startedAt: a.startedAt,
      reactions: db.reactions.filter((r) => r.toUserId === a.userId && r.trackId === a.trackId).map((r) => ({
        fromUserId: r.fromUserId,
        fromName: getUserName(r.fromUserId),
        emoji: r.emoji,
      })),
    }));
}

export function getOnlineFriendIds(userId: number): number[] {
  const db = load();
  const friends = getFriends(userId);
  const friendIds = friends.map((f) => f.id);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  return db.listeningActivity
    .filter((a) => friendIds.includes(a.userId) && a.startedAt >= twoMinutesAgo)
    .map((a) => a.userId);
}

// ====== LISTEN TOGETHER ======

function generateTogetherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createListenTogetherSession(
  creatorId: number,
  track: { id: string; title: string; artist: string; thumbnail: string }
) {
  const db = load();
  const existing = db.listenTogetherSessions.find((s) => s.creatorUserId === creatorId && s.participants.length < 10);
  if (existing) {
    existing.trackId = track.id;
    existing.trackTitle = track.title;
    existing.trackArtist = track.artist;
    existing.trackThumbnail = track.thumbnail;
    existing.isPlaying = true;
    existing.currentTime = 0;
    save();
    return existing;
  }

  const session = {
    id: getNextId("listenTogetherSessions"),
    code: generateTogetherCode(),
    creatorUserId: creatorId,
    trackId: track.id,
    trackTitle: track.title,
    trackArtist: track.artist,
    trackThumbnail: track.thumbnail,
    isPlaying: true,
    currentTime: 0,
    participants: [creatorId],
    createdAt: new Date().toISOString(),
  };
  db.listenTogetherSessions.push(session);
  save();
  return session;
}

export function joinListenTogetherSession(code: string, userId: number) {
  const db = load();
  const session = db.listenTogetherSessions.find((s) => s.code === code);
  if (!session) throw new Error("Sessione non trovata");
  if (session.participants.includes(userId)) return session;
  if (session.participants.length >= 10) throw new Error("Sessione piena (max 10)");
  session.participants.push(userId);
  save();
  return session;
}

export function leaveListenTogetherSession(code: string, userId: number) {
  const db = load();
  const session = db.listenTogetherSessions.find((s) => s.code === code);
  if (!session) return null;
  session.participants = session.participants.filter((p) => p !== userId);
  if (session.participants.length === 0) {
    const idx = db.listenTogetherSessions.findIndex((s) => s.code === code);
    db.listenTogetherSessions.splice(idx, 1);
  }
  save();
  return session;
}

export function updateListenTogetherTrack(
  code: string,
  userId: number,
  track: { id: string; title: string; artist: string; thumbnail: string },
  currentTime: number
) {
  const db = load();
  const session = db.listenTogetherSessions.find((s) => s.code === code);
  if (!session) throw new Error("Sessione non trovata");
  if (session.creatorUserId !== userId) throw new Error("Solo il creatore può cambiare brano");
  session.trackId = track.id;
  session.trackTitle = track.title;
  session.trackArtist = track.artist;
  session.trackThumbnail = track.thumbnail;
  session.currentTime = currentTime;
  session.isPlaying = true;
  save();
  return session;
}

export function updateListenTogetherPlayState(code: string, userId: number, isPlaying: boolean, currentTime: number) {
  const db = load();
  const session = db.listenTogetherSessions.find((s) => s.code === code);
  if (!session) throw new Error("Sessione non trovata");
  if (session.creatorUserId !== userId) throw new Error("Solo il creatore può controllare la riproduzione");
  session.isPlaying = isPlaying;
  session.currentTime = currentTime;
  save();
  return session;
}

export function getListenTogetherSession(code: string) {
  const db = load();
  const s = db.listenTogetherSessions.find((s) => s.code === code);
  if (!s) return null;
  return {
    ...s,
    creatorName: getUserName(s.creatorUserId),
    participants: s.participants.map((p) => ({ id: p, name: getUserName(p) })),
  };
}

export function getUserListenTogetherSessions(userId: number) {
  const db = load();
  return db.listenTogetherSessions
    .filter((s) => s.participants.includes(userId))
    .map((s) => ({
      ...s,
      creatorName: getUserName(s.creatorUserId),
      participants: s.participants.map((p) => ({ id: p, name: getUserName(p) })),
    }));
}

// ====== REACTIONS ======

export function addReaction(toUserId: number, fromUserId: number, trackId: string, emoji: string) {
  const db = load();
  const existing = db.reactions.find(
    (r) => r.toUserId === toUserId && r.fromUserId === fromUserId && r.trackId === trackId
  );
  if (existing) {
    existing.emoji = emoji;
  } else {
    db.reactions.push({
      id: getNextId("reactions"),
      toUserId,
      fromUserId,
      trackId,
      emoji,
      createdAt: new Date().toISOString(),
    });
  }
  save();
  addNotification(toUserId, "reaction", `Reazione da ${getUserName(fromUserId)}`, `${getUserName(fromUserId)} ha reagito a "${getTrackTitle(trackId)}" con ${emoji}`, { fromUserId, trackId, emoji });
  return true;
}

function getTrackTitle(trackId: string): string {
  const db = load();
  const activity = db.listeningActivity.find((a) => a.trackId === trackId);
  return activity?.trackTitle || trackId;
}

export function getReactionsForTrack(toUserId: number, trackId: string) {
  const db = load();
  return db.reactions
    .filter((r) => r.toUserId === toUserId && r.trackId === trackId)
    .map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromName: getUserName(r.fromUserId),
      emoji: r.emoji,
      createdAt: r.createdAt,
    }));
}
