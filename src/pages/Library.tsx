import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import { useIsPWA } from "@/hooks/useIsPWA";
import SafeImg from "../components/SafeImg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Music, Heart, Clock, Loader2, Eye, Play, Link, ListMusic, CheckCircle2, AlertCircle, Download, Pause, HardDrive, Share2, Radio } from "lucide-react";
import { toast } from "sonner";
import { getDownloadedTracks, removeDownload, formatBytes, formatDownloadDate, type DownloadedTrack } from "@/lib/downloadManager";
import type { Track } from "@shared/types";

type Playlist = {
  id: number;
  name: string;
  description?: string | null;
  thumbnail?: string | null;
};

function PlaylistCard({ playlist, onClick, onDelete, index }: {
  playlist: Playlist;
  onClick: () => void;
  onDelete: () => void;
  index: number;
}) {
  return (
    <div
      className="group cursor-pointer fade-in"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-surface-1 to-surface-2 shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-spotify-green/10">
        {playlist.thumbnail ? (
          <SafeImg src={playlist.thumbnail} alt={playlist.name} className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-500" />
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
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/80 text-white/80 hover:text-white"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-3 px-1">
        <p className="font-semibold text-sm truncate group-hover:text-spotify-green transition-colors duration-200">{playlist.name}</p>
        {playlist.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{playlist.description}</p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-1">Playlist</p>
      </div>
    </div>
  );
}

export default function Library() {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [, navigate] = useLocation();
  const isPWA = useIsPWA();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrack[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  const loadDownloads = useCallback(async () => {
    if (!isPWA) return;
    setDownloadsLoading(true);
    try {
      const tracks = await getDownloadedTracks();
      setDownloadedTracks(tracks);
    } catch {} finally {
      setDownloadsLoading(false);
    }
  }, [isPWA]);

  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  const playDownloadedTrack = useCallback((track: DownloadedTrack, index: number) => {
    const queue: Track[] = downloadedTracks.map((t) => ({
      id: t.trackId,
      title: t.title,
      artist: t.artist,
      artistId: t.artistId,
      album: t.album,
      albumId: t.albumId,
      thumbnail: t.thumbnail,
      duration: t.duration,
      durationSeconds: t.durationSeconds,
      type: "track" as const,
    }));
    playTrack(queue[index], queue);
  }, [downloadedTracks, playTrack]);

  const handleRemoveDownload = useCallback(async (trackId: string) => {
    await removeDownload(trackId);
    loadDownloads();
    toast.success("Download rimosso");
  }, [loadDownloads]);

  const { data: playlists = [], isLoading: playlistsLoading, refetch: refetchPlaylists } = trpc.library.playlists.useQuery(undefined, { enabled: !!user });
  const { data: favorites = [], isLoading: favoritesLoading, refetch: refetchFavorites } = trpc.library.favorites.useQuery(undefined, { enabled: !!user });
  const { data: history = [], isLoading: historyLoading } = trpc.library.history.useQuery({ limit: 100 }, { enabled: !!user });
  const { data: sharedPlaylists = [], isLoading: sharedLoading } = trpc.library.allSharedPlaylists.useQuery();

  const createPlaylistMutation = trpc.library.createPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Playlist creata!");
      setNewPlaylistName("");
      setNewPlaylistDesc("");
      refetchPlaylists();
    },
    onError: (err) => { toast.error(`Errore: ${err.message}`); },
  });

  const deletePlaylistMutation = trpc.library.deletePlaylist.useMutation({
    onSuccess: () => { toast.success("Playlist eliminata"); refetchPlaylists(); },
    onError: (err) => toast.error(`Errore: ${err.message}`),
  });

  const removeFromFavoritesMutation = trpc.library.removeFromFavorites.useMutation({
    onSuccess: () => { refetchFavorites(); },
  });

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) { toast.error("Inserisci un nome per la playlist"); return; }
    setIsCreating(true);
    await createPlaylistMutation.mutateAsync({ name: newPlaylistName, description: newPlaylistDesc || undefined });
    setIsCreating(false);
  };

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-4">
          <Music className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <p className="text-muted-foreground text-sm">Accedi per accedere alla tua libreria</p>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12 space-y-8 fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">La tua Libreria</h1>
        <p className="text-muted-foreground text-sm">Playlist, brani preferiti e cronologia di ascolto</p>
      </div>

      <Tabs defaultValue={isPWA ? "downloads" : "playlists"} className="w-full">
        <TabsList className="inline-flex gap-1 p-1 bg-surface-1 rounded-xl border border-border/50 w-full sm:w-auto">
          <TabsTrigger value="playlists" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
            <Music className="w-4 h-4" />
            Playlist
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
            <Heart className="w-4 h-4" />
            Preferiti
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
            <Clock className="w-4 h-4" />
            Cronologia
          </TabsTrigger>
          {isPWA && (
            <TabsTrigger value="downloads" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
              <HardDrive className="w-4 h-4" />
              Download
            </TabsTrigger>
          )}
          <TabsTrigger value="shared" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
            <Share2 className="w-4 h-4" />
            Condivise
          </TabsTrigger>
          <TabsTrigger value="jam" className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-spotify-green data-[state=active]:text-black transition-all duration-200">
            <Radio className="w-4 h-4" />
            JAM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playlists" className="space-y-6 mt-8">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 bg-spotify-green text-black hover:bg-spotify-green/90 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200">
                  <Plus className="w-4 h-4" />
                  Nuova Playlist
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea una nuova playlist</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome della playlist"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Descrizione (opzionale)"
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  />
                  <Button
                    onClick={handleCreatePlaylist}
                    disabled={isCreating || !newPlaylistName.trim()}
                    className="w-full bg-spotify-green text-black hover:bg-spotify-green/90 py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Crea Playlist
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <ImportPlaylistDialog onImported={refetchPlaylists} />
          </div>

          {playlistsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin spotify-green" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Non hai ancora creato nessuna playlist</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {playlists.map((playlist, i) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  index={i}
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  onDelete={() => deletePlaylistMutation.mutate({ playlistId: playlist.id })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-8">
          {favoritesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin spotify-green" />
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Non hai ancora aggiunto brani ai preferiti</p>
            </div>
          ) : (
            <div className="space-y-1">
              {favorites.map((track, idx) => (
                <div
                  key={`${track.trackId}-${idx}`}
                  className="group flex items-center gap-4 p-3 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
                  onClick={() => {
                    playTrack({
                      id: track.trackId,
                      title: track.trackTitle || "Brano sconosciuto",
                      artist: track.trackArtist || "Artista sconosciuto",
                      thumbnail: track.trackThumbnail || "",
                      duration: track.trackDuration?.toString(),
                      type: "track",
                    });
                  }}
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md">
                    <SafeImg src={track.trackThumbnail} alt={track.trackTitle || ""} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{track.trackTitle}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{track.trackArtist}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromFavoritesMutation.mutate({ trackId: track.trackId }); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all duration-200 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-8">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin spotify-green" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Non hai ancora ascoltato nessun brano</p>
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((entry, idx) => (
                <div
                  key={`${entry.trackId}-${idx}`}
                  className="group flex items-center gap-4 p-3 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
                  onClick={() => {
                    playTrack({
                      id: entry.trackId,
                      title: entry.trackTitle || "Brano sconosciuto",
                      artist: entry.trackArtist || "Artista sconosciuto",
                      thumbnail: entry.trackThumbnail || "",
                      duration: entry.trackDuration?.toString(),
                      type: "track",
                    });
                  }}
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md">
                    <SafeImg src={entry.trackThumbnail} alt={entry.trackTitle || ""} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{entry.trackTitle}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.trackArtist}</p>
                  </div>
                  <div className="text-xs text-muted-foreground/70 tabular-nums whitespace-nowrap">
                    {new Date(entry.playedAt).toLocaleDateString("it-IT")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {isPWA && (
        <TabsContent value="downloads" className="mt-8">
          {downloadsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin spotify-green" />
            </div>
          ) : downloadedTracks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Download className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Nessun brano scaricato</p>
              <p className="text-xs mt-2">Scarica brani dal player o dalle schede per ascoltarli offline</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {downloadedTracks.length} brani · {formatBytes(downloadedTracks.reduce((s, t) => s + t.size, 0))}
                </p>
              </div>
              <div className="space-y-1">
                {downloadedTracks.map((track, idx) => {
                  const isCurrentTrack = currentTrack?.id === track.trackId;
                  return (
                    <div
                      key={track.trackId}
                      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
                      onClick={() => playDownloadedTrack(track, idx)}
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md relative">
                        <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                        {isCurrentTrack && isPlaying && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Pause className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${isCurrentTrack ? "text-spotify-green" : ""}`}>{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {isCurrentTrack && isPlaying && (
                          <span className="text-xs text-spotify-green font-medium">In riproduzione</span>
                        )}
                        <span className="text-xs text-muted-foreground/70 hidden sm:block">
                          {formatBytes(track.size)}
                        </span>
                        <span className="text-xs text-muted-foreground/50 hidden sm:block">
                          {formatDownloadDate(track.downloadedAt)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveDownload(track.trackId); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all duration-200 p-1"
                          title="Rimuovi download"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
        )}

        <TabsContent value="shared" className="mt-8">
          {sharedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin spotify-green" />
            </div>
          ) : sharedPlaylists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Share2 className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Nessuna playlist condivisa</p>
              <p className="text-xs mt-2">Le playlist condivise con te appariranno qui</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {sharedPlaylists.map((pl: any, i: number) => (
                <div
                  key={pl.id}
                  className="group cursor-pointer fade-in"
                  style={{ animationDelay: `${i * 0.06}s` }}
                  onClick={() => navigate(`/share/${pl.shareCode || pl.id}`)}
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-surface-1 to-surface-2 shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:shadow-xl">
                    {pl.thumbnail ? (
                      <SafeImg src={pl.thumbnail} alt={pl.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify-purple/20 via-spotify-green/10 to-surface-1">
                        <Share2 className="w-12 h-12 text-spotify-purple/30" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <div className="w-12 h-12 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-green-500/30">
                        <Play className="w-5 h-5 text-black ml-0.5" fill="black" strokeWidth={0} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 px-1">
                    <p className="font-semibold text-sm truncate group-hover:text-spotify-green transition-colors duration-200">{pl.name}</p>
                    {pl.ownerName && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">di {pl.ownerName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jam" className="mt-8">
          <div className="text-center py-12 text-muted-foreground">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">JAM Sessions</p>
            <p className="text-xs mt-2 mb-4">Crea o unisciti a una sessione di ascolto con i tuoi amici</p>
            <button
              onClick={() => navigate("/jam")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-spotify-green text-black font-medium text-sm hover:bg-spotify-green/90 transition-colors"
            >
              <Radio className="w-4 h-4" />
              Vai a JAM
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImportPlaylistDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "done" | "error">("idle");
  const [result, setResult] = useState<{ tracks: any[]; errors: string[]; total: number; found: number; playlistName?: string } | null>(null);
  const addTracksBatch = trpc.library.addTracksToPlaylist.useMutation();
  const createPl = trpc.library.createPlaylist.useMutation();
  const importMutation = trpc.music.importPlaylist.useMutation({
    onSuccess: async (data: any) => {
      const tracks = data?.tracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        setResult(data);
        setStatus("saving");
        try {
          const pl = await createPl.mutateAsync({
            name: data.playlistName || "Importate da Spotify",
            thumbnail: data.playlistThumbnail || undefined,
          });
          await addTracksBatch.mutateAsync({
            playlistId: pl.id,
            tracks: tracks.map((t: any) => ({
              trackId: t.id,
              trackTitle: t.title,
              trackArtist: t.artist,
              trackAlbum: t.album || undefined,
              trackThumbnail: t.thumbnail,
              trackDuration: t.durationSeconds || 0,
            })),
          });
          const playlistName = data.playlistName || "Importata";
          const errors = data.errors || [];
          const msg = errors.length > 0
            ? `${tracks.length} brani importati in "${playlistName}" (${errors.length} non trovati)`
            : `${tracks.length} brani importati in "${playlistName}"`;
          toast.success(msg);
          setOpen(false);
          setUrl("");
          setStatus("idle");
          setResult(null);
          onImported();
        } catch {
          setStatus("error");
        }
      } else {
        setStatus("error");
      }
    },
    onError: () => { setStatus("error"); },
  });

  const handleImport = () => {
    if (!url.trim()) return;
    setStatus("loading");
    setResult(null);
    importMutation.mutate({ url: url.trim() });
  };

  const platformIcon = (u: string) => {
    if (u.includes("spotify.com")) return "Spotify";
    if (u.includes("apple.com")) return "Apple Music";
    if (u.includes("amazon.")) return "Amazon Music";
    if (u.includes("youtube.com") || u.includes("music.youtube.com")) return "YouTube Music";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setUrl(""); setStatus("idle"); setResult(null); } }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border border-border/50 text-foreground hover:border-spotify-green/50 hover:text-spotify-green">
          <Link className="w-4 h-4" />
          Importa da link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa playlist da link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Incolla il link di una playlist da:</p>
            <p className="flex gap-3">
              <span className="px-2 py-0.5 rounded bg-surface-1">Spotify</span>
              <span className="px-2 py-0.5 rounded bg-surface-1">Apple Music</span>
              <span className="px-2 py-0.5 rounded bg-surface-1">Amazon Music</span>
              <span className="px-2 py-0.5 rounded bg-surface-1">YouTube Music</span>
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
              />
            </div>
            <button
              onClick={handleImport}
              disabled={status === "loading" || status === "saving" || !url.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-60"
            >
              {(status === "loading" || status === "saving") ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListMusic className="w-4 h-4" />}
              {status === "saving" ? "Salvataggio..." : "Importa"}
            </button>
          </div>

          {url && !result && status === "idle" && platformIcon(url) && (
            <p className="text-xs text-spotify-green flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {platformIcon(url)} rilevato
            </p>
          )}

          {status === "loading" && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Importazione in corso...</span>
            </div>
          )}

          {status === "saving" && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Salvataggio nella playlist...</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
              <span>{importMutation.error?.message || "Errore durante l'importazione. Verifica il link."}</span>
            </div>
          )}

          {status === "done" && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-spotify-green" />
                <span className="text-foreground font-medium">
                  {result.found} di {result.total} brani importati
                </span>
              </div>
              {result.tracks.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-surface-1 p-2">
                  {result.tracks.map((t: any, i: number) => (
                    <div key={t.id || i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                        <SafeImg src={t.thumbnail} alt={t.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
