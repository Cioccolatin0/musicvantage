export type Track = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: string;
  durationSeconds?: number;
  thumbnail: string;
  type: "track";
};

export type Artist = {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
  type: "artist";
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  thumbnail: string;
  type: "album";
};

export type ArtistDetail = {
  id: string;
  name: string;
  description?: string;
  views?: string;
  subscribers?: string;
  thumbnail: string;
  topSongs: Track[];
  albums: Album[];
  singles: Album[];
  relatedArtists?: Artist[];
  videos?: Track[];
  playlists?: Album[];
};

export type AlbumDetail = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  description?: string;
  trackCount?: number;
  duration?: string;
  thumbnail: string;
  tracks: Track[];
};

// =========== SOCIAL / CHAT TYPES ===========

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  photo?: string | null;
  banner?: string | null;
  bio?: string | null;
  createdAt: string;
};

export type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

export type FriendRequest = {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  fromUser: { id: number; name: string; email: string };
  toUser: { id: number; name: string; email: string };
};

export type Conversation = {
  id: number;
  participantIds: number[];
  lastMessage?: Message | null;
  updatedAt: string;
  participants: Array<{ id: number; name: string; email: string; photo?: string | null }>;
};

export type MessageType = "text" | "music" | "playlist" | "voice";

export type Message = {
  id: number;
  conversationId: number;
  senderId: number;
  type: MessageType;
  content: string;
  musicData?: {
    trackId: string;
    title: string;
    artist: string;
    thumbnail: string;
  } | null;
  playlistData?: {
    playlistId: number;
    name: string;
    trackCount: number;
  } | null;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
  createdAt: string;
  senderName: string;
};

export type Notification = {
  id: number;
  userId: number;
  type: "friend_request" | "friend_accepted" | "new_message" | "new_follower" | "vantage_winner" | "vantage_recap";
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export type UserSettings = {
  mixMode: boolean;
  mixModeBpmRange: number;
  mixModeEnergy: "low" | "medium" | "high";
};

// =========== adVANTAGE / MINI-GAME TYPES ===========

export type ListeningSession = {
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
};

export type MonthlyRecap = {
  id: number;
  userId: number;
  yearMonth: string;
  totalMinutes: number;
  totalTracks: number;
  topTracks: Array<{
    trackId: string;
    title: string;
    artist: string;
    thumbnail: string | null;
    playCount: number;
  }>;
  generatedAt: string;
};

export type VantageLeaderboardEntry = {
  userId: number;
  name: string;
  totalMinutes: number;
  totalTracks: number;
  rank: number;
};

export type VantageStats = {
  totalMinutes: number;
  totalTracks: number;
  dailyMinutes: number;
  weeklyMinutes: number;
  monthlyMinutes: number;
};

// =========== SOCIAL ACTIVITY / REACTIONS / LISTEN TOGETHER ===========

export type Reaction = {
  fromUserId: number;
  fromName: string;
  emoji: string;
};

export type FriendActivityItem = {
  userId: number;
  name: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail: string;
  startedAt: string;
  reactions: Reaction[];
};

export type ListenTogetherSession = {
  id: number;
  code: string;
  creatorUserId: number;
  creatorName: string;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail: string;
  isPlaying: boolean;
  currentTime: number;
  participants: { id: number; name: string }[];
  createdAt: string;
};
