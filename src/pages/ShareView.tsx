import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import SafeImg from "../components/SafeImg";
import { Music, Play, Loader2, UserPlus, Plus, Trash2, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Track } from "@shared/types";

export default function ShareView() {
  const params = useParams();
  const [, navigate] = useLocation();
  const code = params?.code || "";
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [collabSearchQuery, setCollabSearchQuery] = useState("");
  const [debouncedCollabQuery, setDebouncedCollabQuery] = useState("");
  const collabTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (collabTimerRef.current) clearTimeout(collabTimerRef.current);
    collabTimerRef.current = setTimeout(() => {
      setDebouncedCollabQuery(collabSearchQuery.trim());
    }, 200);
    return () => { if (collabTimerRef.current) clearTimeout(collabTimerRef.current); };
  }, [collabSearchQuery]);

  const { data: sharedDetail, isLoading, refetch } = trpc.library.getSharedPlaylist.useQuery(
    { code },
    { enabled: !!code, refetchInterval: (query) => {
      if (!query.state.data) return false;
      return (query.state.data as any)?.collaborative ? 3000 : false;
    }}
  );

  const { data: collabSearchResults } = trpc.music.searchAll.useQuery(
    { query: debouncedCollabQuery },
    { enabled: debouncedCollabQuery.length >= 2, staleTime: 5 * 60 * 1000, placeholderData: (prev: any) => prev }
  );

  const joinCollabMutation = trpc.library.joinCollaborative.useMutation({
    onSuccess: () => {
      toast.success("Ora sei un collaboratore!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const addTrackMutation = trpc.library.addTrackToCollaborative.useMutation({
    onSuccess: () => { toast.success("Brano aggiunto!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const removeTrackMutation = trpc.library.removeTrackFromCollaborative.useMutation({
    onSuccess: () => { toast.success("Brano rimosso"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const isCollaborator = sharedDetail?.collaborative && user && sharedDetail.collaborators?.includes(user.id);

  if (isLoading) {
    return (
      <div className="container py-24 text-center fade-in">
        <Loader2 className="w-8 h-8 animate-spin spotify-green mx-auto" />
        <p className="text-muted-foreground text-sm mt-4">Caricamento playlist condivisa...</p>
      </div>
    );
  }

  if (!sharedDetail) {
    return (
      <div className="container py-24 text-center fade-in">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Music className="w-8 h-8 text-destructive" strokeWidth={2} />
        </div>
        <p className="text-muted-foreground text-sm mb-2">Playlist non trovata o codice non valido</p>
        <button onClick={() => navigate("/shared")} className="text-spotify-green hover:underline text-sm mt-2">
          Vai alle playlist condivise
        </button>
      </div>
    );
  }

  const { playlist, tracks, collaborative, collaborators } = sharedDetail;

  const buildTrackList = (): Track[] =>
    tracks.map((t: any) => ({
      id: t.trackId,
      title: t.trackTitle || "Brano sconosciuto",
      artist: t.trackArtist || "Artista sconosciuto",
      album: t.trackAlbum || undefined,
      thumbnail: t.trackThumbnail || "",
      duration: t.trackDuration?.toString(),
      type: "track" as const,
    }));

  const playAllTracks = () => {
    const tl = buildTrackList();
    if (tl.length === 0) return;
    playTrack(tl[0], tl);
  };

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <button
        onClick={() => navigate("/shared")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <span className="text-lg">&larr;</span>
        Torna alle playlist condivise
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 mb-8">
        <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-spotify-green/40 to-spotify-purple/40 flex items-center justify-center shadow-xl overflow-hidden shrink-0">
          {playlist.thumbnail ? (
            <SafeImg src={playlist.thumbnail} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-16 h-16 text-white/50" strokeWidth={1.5} />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Playlist condivisa</p>
            {collaborative && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-semibold uppercase tracking-wider">
                Collaborativa
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-muted-foreground">{playlist.description}</p>}
          <p className="text-sm text-muted-foreground">{tracks.length} brani</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={playAllTracks}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-green-500/20"
        >
          <Play className="w-4 h-4 fill-black" strokeWidth={0} />
          Riproduci tutto
        </button>

        {collaborative && user && !isCollaborator && (
          <button
            onClick={() => joinCollabMutation.mutate({ code })}
            disabled={joinCollabMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-500 text-white font-medium text-sm hover:bg-blue-500/90 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Unisciti come collaboratore
          </button>
        )}

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copiato!");
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all"
        >
          Condividi link
        </button>
      </div>

      {collaborative && isCollaborator && (
        <div className="mb-6 p-4 rounded-xl bg-surface-1 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aggiungi brani alla playlist</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={collabSearchQuery}
              onChange={(e) => setCollabSearchQuery(e.target.value)}
              placeholder="Cerca un brano da aggiungere..."
              className="flex-1 bg-surface-2 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            />
          </div>
          {debouncedCollabQuery.length >= 2 && collabSearchResults?.tracks && (
            <div className="max-h-48 overflow-y-auto rounded-xl bg-surface-2 border border-border/50 p-1 space-y-0.5">
              {collabSearchResults.tracks.slice(0, 8).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => {
                    addTrackMutation.mutate({
                      code,
                      trackId: t.id,
                      trackTitle: t.title,
                      trackArtist: t.artist,
                      trackAlbum: t.album || undefined,
                      trackThumbnail: t.thumbnail,
                      trackDuration: t.durationSeconds,
                    });
                  }}
                  disabled={addTrackMutation.isPending}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-1 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                    <SafeImg src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                  </div>
                  <Plus className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-0.5">
        {tracks.map((track: any, idx: number) => {
          const trackData: Track = {
            id: track.trackId,
            title: track.trackTitle || "Brano sconosciuto",
            artist: track.trackArtist || "Artista sconosciuto",
            album: track.trackAlbum || undefined,
            thumbnail: track.trackThumbnail || "",
            duration: track.trackDuration?.toString(),
            type: "track",
          };

          return (
            <div
              key={`${track.trackId}-${idx}`}
              className="group grid grid-cols-[2rem_1fr_4rem] sm:grid-cols-[3rem_1fr_8rem_6rem] items-center gap-4 px-4 py-2.5 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
              onClick={() => playTrack(trackData, buildTrackList())}
            >
              <span className="w-6 text-center text-sm text-muted-foreground group-hover:hidden tabular-nums">
                {idx + 1}
              </span>
              <Play className="w-4 h-4 hidden group-hover:block spotify-green" />

              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 shadow-md">
                  <SafeImg src={track.trackThumbnail} alt={track.trackTitle || ""} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{track.trackTitle}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{track.trackArtist}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 shrink-0">
                {track.trackDuration && (
                  <span className="text-xs text-muted-foreground/70 tabular-nums hidden sm:inline mr-2">
                    {Math.floor(track.trackDuration / 60)}:{(track.trackDuration % 60).toString().padStart(2, "0")}
                  </span>
                )}
                {collaborative && isCollaborator && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrackMutation.mutate({ code, trackId: track.trackId });
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
