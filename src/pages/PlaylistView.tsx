import React, { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import { useIsPWA } from "@/hooks/useIsPWA";
import { downloadTrack } from "@/lib/downloadManager";
import SafeImg from "../components/SafeImg";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Play, Trash2, Music, Loader2, Plus, Share2, Shuffle,
  Download, UserPlus, MoreHorizontal, Search, ArrowUpDown, PenLine,
  X, Check, Link, ListMusic, Camera
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@shared/types";

type SortMode = "custom" | "title" | "artist" | "date" | "duration";

export default function PlaylistView() {
  const params = useParams();
  const [, navigate] = useLocation();
  const playlistId = Number(params?.id);
  const { user } = useAuth();
  const { playTrack, addToQueue, isShuffleOn, toggleShuffle } = usePlayer();
  const isPWA = useIsPWA();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddTracks, setShowAddTracks] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [addTrackQuery, setAddTrackQuery] = useState("");
  const [debouncedAddTrackQuery, setDebouncedAddTrackQuery] = useState("");
  const addTrackTimerRef = useRef<ReturnType<typeof setTimeout>>();

  if (!playlistId) {
    return (
      <div className="container py-24 text-center fade-in">
        <p className="text-muted-foreground">Playlist non trovata</p>
        <button onClick={() => navigate("/library")} className="mt-4 text-spotify-green hover:underline text-sm">
          Torna alla libreria
        </button>
      </div>
    );
  }

  const { data: playlists = [], refetch: refetchPlaylists } = trpc.library.playlists.useQuery(undefined, { enabled: !!user });
  const playlist = playlists.find((p: any) => p.id === playlistId);

  const { data: tracks = [], isLoading, refetch } = trpc.library.playlistTracks.useQuery(
    { playlistId },
    { enabled: !!playlistId }
  );

  const removeTrackMutation = trpc.library.removeTrackFromPlaylist.useMutation({
    onSuccess: () => { refetch(); toast.success("Brano rimosso"); },
  });

  const shareMutation = trpc.library.sharePlaylist.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/share/${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Link di condivisione copiato!");
    },
  });

  const shareCollabMutation = trpc.library.shareCollaborative.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/share/${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Link collaborativo copiato!");
      setShowShareDialog(false);
    },
  });

  const updatePlaylistMutation = trpc.library.updatePlaylist.useMutation({
    onSuccess: () => {
      toast.success("Playlist aggiornata");
      refetchPlaylists();
      setShowEditDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePlaylistMutation = trpc.library.deletePlaylist.useMutation({
    onSuccess: () => {
      refetchPlaylists();
      toast.success("Playlist eliminata");
      navigate("/library");
    },
    onError: (err) => toast.error(`Errore eliminazione: ${err.message}`),
  });

  useEffect(() => {
    if (addTrackTimerRef.current) clearTimeout(addTrackTimerRef.current);
    addTrackTimerRef.current = setTimeout(() => {
      setDebouncedAddTrackQuery(addTrackQuery.trim());
    }, 200);
    return () => { if (addTrackTimerRef.current) clearTimeout(addTrackTimerRef.current); };
  }, [addTrackQuery]);

  const { data: searchResults } = trpc.music.searchAll.useQuery(
    { query: debouncedAddTrackQuery },
    { enabled: debouncedAddTrackQuery.length >= 2 && showAddTracks, staleTime: 5 * 60 * 1000, placeholderData: (prev: any) => prev }
  );

  const addTrackMutation = trpc.library.addTrackToPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Brano aggiunto");
      refetch();
    },
  });

  const addTracksBatchMutation = trpc.library.addTracksToPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Brani aggiunti");
      refetch();
    },
  });

  const getTrackAlbum = (t: any) => t.trackAlbum || "";

  const filteredTracks = useMemo(() => {
    let list = [...tracks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t: any) =>
        (t.trackTitle || "").toLowerCase().includes(q) ||
        (t.trackArtist || "").toLowerCase().includes(q) ||
        (t.trackAlbum || "").toLowerCase().includes(q)
      );
    }
    if (sortMode === "title") list.sort((a: any, b: any) => (a.trackTitle || "").localeCompare(b.trackTitle || ""));
    else if (sortMode === "artist") list.sort((a: any, b: any) => (a.trackArtist || "").localeCompare(b.trackArtist || ""));
    else if (sortMode === "date") list.sort((a: any, b: any) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    else if (sortMode === "duration") list.sort((a: any, b: any) => (a.trackDuration || 0) - (b.trackDuration || 0));
    return list;
  }, [tracks, searchQuery, sortMode]);

  const totalDuration = useMemo(() => {
    const totalSec = tracks.reduce((sum: number, t: any) => sum + (t.trackDuration || 0), 0);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) return `${hours} ore ${mins} min`;
    return `${mins} min`;
  }, [tracks]);

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

  const mixPlayTracks = () => {
    const tl = buildTrackList();
    if (tl.length === 0) return;
    if (!isShuffleOn) toggleShuffle();
    playTrack(tl[0], tl);
  };

  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  const handleDownload = async (trackId: string, title: string) => {
    if (isPWA) {
      // Use download manager for PWA offline storage
      setDownloadingTrackId(trackId);
      try {
        await downloadTrack({ id: trackId, title, artist: "", thumbnail: "" });
        toast.success("Brano salvato per ascolto offline");
      } catch {
        toast.error("Impossibile scaricare il brano");
      } finally {
        setDownloadingTrackId(null);
      }
    } else {
      // Direct download for web
      try {
        const data = await (trpc.music.audioUrl as any).fetch({ videoId: trackId });
        if (data?.url) {
          const a = document.createElement("a");
          a.href = data.url;
          a.download = `${title}.mp3`;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success("Download avviato");
        }
      } catch {
        toast.error("Impossibile scaricare il brano");
      }
    }
  };

  const handleDownloadAll = async () => {
    for (const track of tracks.slice(0, 5)) {
      await handleDownload(track.trackId, track.trackTitle || "track");
    }
  };

  const handleEditSave = () => {
    if (!editName.trim()) {
      toast.error("Il nome non può essere vuoto");
      return;
    }
    updatePlaylistMutation.mutate({
      playlistId,
      name: editName.trim(),
      description: editDesc.trim() || null,
      thumbnail: editThumbnail.trim() || null,
    });
  };

  const openEditDialog = () => {
    setEditName(playlist?.name || "");
    setEditDesc(playlist?.description || "");
    setEditThumbnail(playlist?.thumbnail || "");
    setShowEditDialog(true);
    setShowMoreMenu(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  if (!playlist) {
    return (
      <div className="container py-24 text-center fade-in">
        <Loader2 className="w-8 h-8 animate-spin spotify-green mx-auto" />
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <button
        onClick={() => navigate("/library")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna alla libreria
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 mb-8">
        <div className="relative group w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-spotify-green/40 to-spotify-purple/40 flex items-center justify-center shadow-xl overflow-hidden shrink-0">
          {playlist.thumbnail ? (
            <SafeImg src={playlist.thumbnail} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-16 h-16 text-white/50" strokeWidth={1.5} />
          )}
          <button
            onClick={openEditDialog}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <div className="flex flex-col items-center gap-1 text-white">
              <Camera className="w-6 h-6" />
              <span className="text-xs font-medium">Cambia foto</span>
            </div>
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Playlist</p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-muted-foreground">{playlist.description}</p>}
          <p className="text-sm text-muted-foreground">{tracks.length} brani{tracks.length > 0 ? `, ${totalDuration}` : ""}</p>
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

        <button
          onClick={mixPlayTracks}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all disabled:opacity-50"
        >
          <Shuffle className="w-4 h-4" />
          Mixa
        </button>

        <button
          onClick={() => { if (tracks.length > 0) handleDownloadAll(); }}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all disabled:opacity-50"
          title="Scarica tutti"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setShowShareDialog(true); setShowMoreMenu(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all"
          title="Aggiungi collaboratore"
        >
          <UserPlus className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 backdrop-blur-xl py-1 overflow-hidden">
                <button
                  onClick={openEditDialog}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors text-left"
                >
                  <PenLine className="w-4 h-4" />
                  Modifica playlist
                </button>
                <button
                  onClick={() => {
                    shareMutation.mutate({ playlistId });
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors text-left"
                >
                  <Share2 className="w-4 h-4" />
                  Condividi (sola lettura)
                </button>
                <button
                  onClick={() => {
                    shareMutation.mutate({ playlistId });
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 transition-colors text-left"
                >
                  <Link className="w-4 h-4" />
                  Copia link playlist
                </button>
                <div className="h-px bg-border/50 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-destructive/10 text-red-400 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina playlist
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setShowAddTracks(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all"
        >
          <Plus className="w-4 h-4" />
          Aggiungi
        </button>

        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-1 border border-border/50 text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortMode === "custom" ? "Ordinamento personalizzato" :
             sortMode === "title" ? "Per titolo" :
             sortMode === "artist" ? "Per artista" :
             sortMode === "date" ? "Per data" : "Per durata"}
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute left-0 top-full mt-2 z-50 w-52 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 backdrop-blur-xl py-1 overflow-hidden">
                {([
                  ["custom", "Ordinamento personalizzato"],
                  ["title", "Per titolo"],
                  ["artist", "Per artista"],
                  ["date", "Per data di aggiunta"],
                  ["duration", "Per durata"],
                ] as [SortMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                      sortMode === mode ? "text-spotify-green bg-surface-2" : "hover:bg-surface-2"
                    }`}
                  >
                    {sortMode === mode && <Check className="w-4 h-4 spotify-green" />}
                    <span className={sortMode === mode ? "" : "ml-7"}>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca nella playlist..."
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-9 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-spotify-green/30 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-[3rem_1fr_1fr_8rem_6rem] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 mb-1">
        <span className="text-center">#</span>
        <span>Titolo</span>
        <span>Album</span>
        <span>Aggiunto il</span>
        <span className="text-right">Durata</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin spotify-green" />
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">{searchQuery ? "Nessun risultato trovato" : "Questa playlist è vuota"}</p>
          {!searchQuery && <p className="text-xs mt-2">Aggiungi brani dalla ricerca o dal player</p>}
        </div>
      ) : (
        <div className="space-y-0.5">
          {filteredTracks.map((track: any, idx: number) => {
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
                className="group grid grid-cols-[2rem_1fr_4rem] sm:grid-cols-[3rem_1fr_1fr_8rem_6rem] items-center gap-4 px-4 py-2.5 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
                onClick={() => {
                  const queue = filteredTracks.map((t: any) => ({
                    id: t.trackId,
                    title: t.trackTitle || "Brano sconosciuto",
                    artist: t.trackArtist || "Artista sconosciuto",
                    album: t.trackAlbum || undefined,
                    thumbnail: t.trackThumbnail || "",
                    duration: t.trackDuration?.toString(),
                    type: "track" as const,
                  }));
                  playTrack(trackData, queue);
                }}
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

                <span className="text-xs text-muted-foreground truncate hidden sm:block">
                  {getTrackAlbum(track)}
                </span>

                <span className="text-xs text-muted-foreground/70 hidden sm:block">
                  {formatDate(track.addedAt)}
                </span>

                <div className="flex items-center justify-end gap-1 shrink-0">
                  {track.trackDuration && (
                    <span className="text-xs text-muted-foreground/70 tabular-nums hidden sm:inline mr-2">
                      {Math.floor(track.trackDuration / 60)}:{(track.trackDuration % 60).toString().padStart(2, "0")}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); addToQueue(trackData); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-spotify-green transition-all duration-200 p-1"
                    title="Aggiungi alla coda"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(track.trackId, track.trackTitle || "track"); }}
                    disabled={downloadingTrackId === track.trackId}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-spotify-green transition-all duration-200 p-1 disabled:opacity-50"
                    title="Scarica"
                  >
                    {downloadingTrackId === track.trackId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTrackMutation.mutate({ playlistId, trackId: track.trackId }); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all duration-200 p-1"
                    title="Rimuovi dalla playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome della playlist"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrizione</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Aggiungi una descrizione (opzionale)"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL immagine di copertina</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-2">
                  {editThumbnail ? (
                    <img src={editThumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <Music className="w-5 h-5 m-auto text-muted-foreground/50" style={{ margin: "14px auto" }} />
                  )}
                </div>
                <Input
                  value={editThumbnail}
                  onChange={(e) => setEditThumbnail(e.target.value)}
                  placeholder="https://esempio.com/immagine.jpg"
                  className="flex-1"
                />
              </div>
              {editThumbnail && (
                <button
                  onClick={() => setEditThumbnail("")}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1 ml-[3.75rem]"
                >
                  Rimuovi immagine
                </button>
              )}
            </div>
            <button
              onClick={handleEditSave}
              disabled={updatePlaylistMutation.isPending || !editName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green/90 transition-all disabled:opacity-50"
            >
              {updatePlaylistMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salva
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTracks} onOpenChange={setShowAddTracks}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aggiungi brani</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={addTrackQuery}
                onChange={(e) => setAddTrackQuery(e.target.value)}
                placeholder="Cerca brani da aggiungere..."
                className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-spotify-green/30 transition-all"
              />
            </div>
            {debouncedAddTrackQuery.length >= 2 && searchResults?.tracks && (
              <div className="max-h-80 overflow-y-auto space-y-0.5">
                {searchResults.tracks.slice(0, 15).map((t: any) => {
                  const alreadyInPlaylist = tracks.some((pt: any) => pt.trackId === t.id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-1 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                        <SafeImg src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                      </div>
                      {alreadyInPlaylist ? (
                        <span className="text-xs text-muted-foreground px-2">Già presente</span>
                      ) : (
                        <button
                          onClick={() => addTrackMutation.mutate({
                            playlistId,
                            trackId: t.id,
                            trackTitle: t.title,
                            trackArtist: t.artist,
                            trackAlbum: t.album || undefined,
                            trackThumbnail: t.thumbnail,
                            trackDuration: t.durationSeconds || 0,
                          })}
                          disabled={addTrackMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-spotify-green/10 text-spotify-green text-xs font-medium hover:bg-spotify-green/20 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Aggiungi
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {debouncedAddTrackQuery.length >= 2 && (!searchResults?.tracks || searchResults.tracks.length === 0) && (
              <p className="text-center text-sm text-muted-foreground py-6">Nessun risultato</p>
            )}
            {debouncedAddTrackQuery.length < 2 && (
              <p className="text-center text-xs text-muted-foreground py-6">Cerca per aggiungere brani alla playlist</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Condividi playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Scegli come condividere la tua playlist</p>
            <button
              onClick={() => {
                shareMutation.mutate({ playlistId });
                setShowShareDialog(false);
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-1 hover:bg-surface-2 transition-colors text-left"
            >
              <Share2 className="w-5 h-5 spotify-green shrink-0" />
              <div>
                <p className="text-sm font-medium">Lettura sola</p>
                <p className="text-xs text-muted-foreground">Chiunque con il codice può visualizzare la playlist</p>
              </div>
            </button>
            <button
              onClick={() => shareCollabMutation.mutate({ playlistId })}
              disabled={shareCollabMutation.isPending}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-1 hover:bg-surface-2 transition-colors text-left"
            >
              <UserPlus className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">Collaborativa</p>
                <p className="text-xs text-muted-foreground">I collaboratori possono aggiungere e rimuovere brani</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler eliminare <span className="font-semibold text-foreground">{playlist?.name}</span>? Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  deletePlaylistMutation.mutate({ playlistId });
                  setShowDeleteConfirm(false);
                }}
                disabled={deletePlaylistMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletePlaylistMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Elimina
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
