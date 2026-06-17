import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import SafeImg from "@/components/SafeImg";
import {
  User, Music, Heart, ListMusic, Clock, Play, Loader2,
  Users, Camera, MessageCircle, UserPlus, UserCheck, UserX,
  Settings, LogOut
} from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [, params] = useRoute("/profile/:userId?");
  const profileId = params?.userId ? parseInt(params.userId) : user?.id;
  const [, navigate] = useLocation();
  const isOwn = !params?.userId || profileId === user?.id;

  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(
    { userId: profileId || 0 },
    { enabled: !!profileId }
  );

  const { data: friendStatus } = trpc.friends.status.useQuery(
    { userId: profileId || 0 },
    { enabled: !!profileId && !!user && !isOwn }
  );

  const { data: playlists = [] } = trpc.library.playlists.useQuery(undefined, { enabled: !!user && isOwn });
  const { data: favorites = [] } = trpc.library.favorites.useQuery(undefined, { enabled: !!user && isOwn });
  const { data: history = [] } = trpc.library.history.useQuery({ limit: 20 }, { enabled: !!user && isOwn });

  const sendRequestMutation = trpc.friends.sendRequest.useMutation({
    onSuccess: () => { toast.success("Richiesta inviata!"); },
    onError: (err) => toast.error(err.message),
  });

  const createConvMutation = trpc.chat.getOrCreateConversation.useMutation({
    onSuccess: (data) => { navigate(`/chat/${data.id}`); },
  });

  if (profileLoading) {
    return (
      <div className="container py-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-24 text-center fade-in">
        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Profilo non trovato</p>
      </div>
    );
  }

  return (
    <div className="pb-24 fade-in">
      {/* Banner */}
      <div className="h-48 sm:h-64 bg-gradient-to-r from-spotify-green/30 via-spotify-purple/20 to-surface-1 relative">
        {profile.banner && (
          <SafeImg src={profile.banner} alt="" className="w-full h-full object-cover opacity-60" />
        )}
        {isOwn && (
          <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors">
            <Camera className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Profile info */}
      <div className="container max-w-4xl -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 px-4 sm:px-0">
          <div className="w-28 h-28 rounded-2xl bg-surface-1 border-4 border-background overflow-hidden shadow-xl shrink-0">
            {profile.photo ? (
              <SafeImg src={profile.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {profile.friendsCount} amici
            </p>
            {profile.bio && <p className="text-sm mt-2 text-muted-foreground/80">{profile.bio}</p>}
          </div>
          <div className="flex gap-2 pb-1">
            {!isOwn && user ? (
              <>
                {friendStatus === "none" && (
                  <button
                    onClick={() => sendRequestMutation.mutate({ userId: profileId! })}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-spotify-green text-black text-sm font-medium hover:bg-spotify-green/90 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Aggiungi
                  </button>
                )}
                {friendStatus === "pending_sent" && (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 text-muted-foreground text-sm">
                    <UserX className="w-4 h-4" />
                    Richiesta inviata
                  </span>
                )}
                {friendStatus === "pending_received" && (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-400 text-sm">
                    <UserCheck className="w-4 h-4" />
                    Richiesta ricevuta
                  </span>
                )}
                {friendStatus === "friends" && (
                  <button
                    onClick={() => createConvMutation.mutate({ userId: profileId! })}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-spotify-green text-black text-sm font-medium hover:bg-spotify-green/90 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Messaggio
                  </button>
                )}
              </>
            ) : isOwn ? (
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 text-foreground text-sm hover:bg-surface-2 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Modifica
              </button>
            ) : null}
          </div>
        </div>

        {/* Content tabs */}
        <div className="mt-8 px-4 sm:px-0 space-y-8">
          {isOwn && (
            <>
              {/* Recent listens */}
              <section>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-spotify-green" />
                  Ascoltati di recente
                </h2>
                <div className="space-y-1">
                  {history.slice(0, 10).map((entry: any, idx: number) => (
                    <TrackRow key={`${entry.trackId}-${idx}`} track={entry} />
                  ))}
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nessun ascolto recente</p>
                  )}
                </div>
              </section>

              {/* Top favorites */}
              <section>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Heart className="w-4 h-4 text-spotify-green" />
                  Brani preferiti
                </h2>
                <div className="space-y-1">
                  {favorites.slice(0, 10).map((fav: any, idx: number) => (
                    <TrackRow key={`fav-${idx}`} track={fav} />
                  ))}
                  {favorites.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nessun brano nei preferiti</p>
                  )}
                </div>
              </section>

              {/* Public playlists */}
              <section>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <ListMusic className="w-4 h-4 text-spotify-green" />
                  Le tue playlist
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map((pl: any) => (
                    <button
                      key={pl.id}
                      onClick={() => navigate(`/playlist/${pl.id}`)}
                      className="bg-card rounded-xl p-4 border border-border/50 hover:border-spotify-green/30 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-spotify-green/10 flex items-center justify-center mb-3">
                        <ListMusic className="w-6 h-6 text-spotify-green" />
                      </div>
                      <p className="font-semibold text-sm truncate">{pl.name}</p>
                      {pl.description && (
                        <p className="text-xs text-muted-foreground truncate mt-1">{pl.description}</p>
                      )}
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nessuna playlist</p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track }: { track: any }) {
  const { playTrack } = usePlayer();
  return (
    <button
      onClick={() => playTrack({
        id: track.trackId,
        title: track.trackTitle || "Brano",
        artist: track.trackArtist || "Artista",
        thumbnail: track.trackThumbnail || "",
        type: "track",
      })}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-card transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-2 shrink-0">
        <SafeImg src={track.trackThumbnail} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{track.trackTitle}</p>
        <p className="text-xs text-muted-foreground truncate">{track.trackArtist}</p>
      </div>
      <Play className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
