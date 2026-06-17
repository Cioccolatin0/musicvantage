import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import { Share2, Music, Copy, Play, Eye, Loader2, Users, Plus, Trash2, UserPlus, Filter } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@shared/types";
import SafeImg from "../components/SafeImg";

function SharedPlaylistCard({ pl, onCopyLink, index }: { pl: any; onCopyLink: () => void; index: number }) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <div
      className="group cursor-pointer fade-in"
      style={{ animationDelay: `${index * 0.06}s` }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <div className={`relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-surface-1 to-surface-2 shadow-lg transition-all duration-500 ${isPressed ? "scale-95" : "group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-spotify-green/10"}`}>
        {pl.thumbnail ? (
          <SafeImg src={pl.thumbnail} alt={pl.name} className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify-green/20 via-spotify-purple/10 to-surface-1">
            <Music className="w-16 h-16 text-spotify-green/30 group-hover:text-spotify-green/50 transition-colors duration-500" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <div className="w-12 h-12 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-green-500/30">
            <Play className="w-5 h-5 text-black ml-0.5" fill="black" strokeWidth={0} />
          </div>
        </div>
        {pl.collaborative && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/90 text-white text-[10px] font-semibold backdrop-blur-sm">
              Collaborativa
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 px-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate group-hover:text-spotify-green transition-colors duration-200 flex-1">{pl.name}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{pl.trackCount || 0} brani</p>
      </div>
    </div>
  );
}

export default function SharedPlaylists() {
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [, navigate] = useLocation();
  const [joinCode, setJoinCode] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "private" | "collaborative">("all");

  const { data: playlists = [] } = trpc.library.playlists.useQuery(undefined, { enabled: !!user });
  const { data: shared = [], isLoading, refetch } = trpc.library.allSharedPlaylists.useQuery();

  const shareMutation = trpc.library.sharePlaylist.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/share/${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Link di condivisione copiato!");
      refetch();
    },
  });

  const shareCollabMutation = trpc.library.shareCollaborative.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/share/${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Link collaborativo copiato!");
      refetch();
    },
  });

  const filteredShared = shared.filter((pl: any) => {
    if (filter === "all") return true;
    if (filter === "public") return pl.isPublic === 1;
    if (filter === "private") return pl.isPublic === 0;
    if (filter === "collaborative") return pl.collaborative;
    return true;
  });

  return (
    <div className="container py-8 sm:py-12 space-y-8 fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Playlist condivise</h1>
        <p className="text-muted-foreground text-sm">Condividi le tue playlist o scopri quelle degli altri</p>
      </div>

      {user && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Share2 className="w-4 h-4 spotify-green" />
            Condividi una tua playlist
          </h2>
          {playlists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Non hai playlist da condividere</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playlists.map((pl) => (
                <div key={pl.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-1 hover:bg-surface-2 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{pl.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => shareMutation.mutate({ playlistId: pl.id })}
                      disabled={shareMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-spotify-green/10 text-spotify-green text-xs font-medium hover:bg-spotify-green/20 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Condividi
                    </button>
                    <button
                      onClick={() => shareCollabMutation.mutate({ playlistId: pl.id })}
                      disabled={shareCollabMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Collabora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 spotify-green" />
          Unisciti a una playlist condivisa
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Incolla il link o codice della playlist..."
            className="flex-1 bg-surface-1 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-spotify-green/40 transition-all"
          />
          <button
            onClick={() => {
              if (joinCode.trim()) {
                const code = joinCode.trim().split("/").pop() || joinCode.trim();
                navigate(`/share/${code}`);
              }
            }}
            disabled={!joinCode.trim()}
            className="px-5 py-2.5 rounded-xl bg-spotify-green text-black font-medium text-sm hover:bg-spotify-green/90 transition-all disabled:opacity-50"
          >
            Apri
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Music className="w-4 h-4 spotify-green" />
            Scopri playlist condivise
          </h2>
          <div className="flex items-center gap-1 bg-surface-1 rounded-xl p-1 border border-border/50">
            {(["all", "public", "private", "collaborative"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filter === f ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tutte" : f === "public" ? "Pubbliche" : f === "private" ? "Private" : "Collaborative"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin spotify-green" />
          </div>
        ) : filteredShared.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Share2 className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">Nessuna playlist condivisa al momento</p>
            <p className="text-xs mt-2">Condividi la tua prima playlist per iniziare!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredShared.map((pl: any, i: number) => (
              <div key={`${pl.shareCode}-${i}`} className="relative">
                <div onClick={() => navigate(`/share/${pl.shareCode}`)}>
                  <SharedPlaylistCard
                    pl={pl}
                    index={i}
                    onCopyLink={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/share/${pl.shareCode}`);
                      toast.success("Link copiato!");
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/share/${pl.shareCode}`);
                    toast.success("Link copiato!");
                  }}
                  className="absolute top-2 right-12 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-surface-2 text-white/80 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
