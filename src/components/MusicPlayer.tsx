import React, { useCallback, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Loader2,
  Heart,
  Plus,
  ChevronUp,
  ChevronDown,
  Shuffle,
  Repeat,
  Repeat1,
  Zap,
  Mic2,
  RadioTower,
  Search,
  X,
  Check,
} from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { trpc } from "../lib/trpc";
import { useAuth, getCachedUser } from "../hooks/useAuth";
import SafeImg from "./SafeImg";
import DownloadButton from "./DownloadButton";
import { toast } from "sonner";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FavoriteButton({ track }: any) {
  const { user } = useAuth();
  const { data: isFav } = trpc.library.isFavorite.useQuery({ trackId: track.id }, { enabled: !!user });
  const utils = trpc.useUtils();
  const addToFavMutation = trpc.library.addToFavorites.useMutation({
    onSuccess: () => {
      toast.success("Aggiunto ai preferiti!");
      utils.library.isFavorite.invalidate({ trackId: track.id });
    },
  });
  const removeFromFavMutation = trpc.library.removeFromFavorites.useMutation({
    onSuccess: () => {
      toast.success("Rimosso dai preferiti");
      utils.library.isFavorite.invalidate({ trackId: track.id });
    },
  });

  if (!user) return null;

  return (
    <button
      onClick={() => {
        if (isFav) removeFromFavMutation.mutate({ trackId: track.id });
        else addToFavMutation.mutate({ trackId: track.id, trackTitle: track.title, trackArtist: track.artist, trackThumbnail: track.thumbnail, trackDuration: track.durationSeconds });
      }}
      className={`transition-all duration-200 ${isFav ? "text-red-500 hover:text-red-400 scale-110" : "text-muted-foreground hover:text-spotify-green"}`}
    >
      <Heart className="w-4 h-4" strokeWidth={2} fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}

function PlaylistButton({ track }: any) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const utils = trpc.useContext();

  const summary = trpc.library.playlistsSummary.useQuery(
    { trackId: track?.id },
    { enabled: isOpen && !!user && !!track?.id }
  );
  const fallback = trpc.library.playlists.useQuery(undefined, {
    enabled: isOpen && !!user && summary.isFetched && summary.data?.length === 0,
  });

  const playlists: any[] = (summary.data?.length ? summary.data : fallback.data?.map((p: any) => ({ ...p, trackCount: 0, hasTrack: false })) ?? []);

  const addMutation = trpc.library.addTrackToPlaylist.useMutation({
    onSuccess: () => { toast.success("Brano aggiunto!"); utils.library.playlistsSummary.invalidate(); },
  });
  const removeMutation = trpc.library.removeTrackFromPlaylist.useMutation({
    onSuccess: () => { toast.success("Brano rimosso"); utils.library.playlistsSummary.invalidate(); },
  });
  const createMutation = trpc.library.createPlaylist.useMutation({
    onSuccess: (data: any) => {
      setShowCreate(false); setNewName(""); toast.success("Playlist creata!");
      utils.library.playlistsSummary.invalidate();
      setTimeout(() => {
        addMutation.mutate({ playlistId: data.id, trackId: track.id, trackTitle: track.title, trackArtist: track.artist, trackThumbnail: track.thumbnail, trackDuration: track.durationSeconds });
      }, 100);
    },
  });

  if (!user) return null;

  const contained = playlists.filter((pl: any) => pl.hasTrack);
  const recent = playlists.filter((pl: any) => !pl.hasTrack);
  const filtered = [...contained, ...recent].filter((pl: any) =>
    !search || pl.name.toLowerCase().includes(search.toLowerCase())
  );

  const togglePlaylist = (pl: any) => {
    if (pl.hasTrack) {
      removeMutation.mutate({ playlistId: pl.id, trackId: track.id });
    } else {
      addMutation.mutate({ playlistId: pl.id, trackId: track.id, trackTitle: track.title, trackArtist: track.artist, trackThumbnail: track.thumbnail, trackDuration: track.durationSeconds });
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setIsOpen(!isOpen)} className="text-muted-foreground hover:text-spotify-green transition-colors">
        <Plus className="w-4 h-4" strokeWidth={2} />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm mx-4 border border-border/30 shadow-2xl overflow-hidden flex flex-col max-h-[75vh] mt-[10vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 pb-2">
              <h3 className="text-base font-bold mb-3">Aggiungi alla playlist</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Trova una playlist"
                  className="w-full bg-surface-1 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 pb-2">
              {showCreate ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome playlist"
                    className="flex-1 bg-surface-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMutation.mutate({ name: newName.trim() }); }}
                  />
                  <button
                    onClick={() => { if (newName.trim()) createMutation.mutate({ name: newName.trim() }); }}
                    disabled={!newName.trim() || createMutation.isPending}
                    className="px-4 py-2.5 rounded-xl bg-spotify-green text-black text-sm font-medium"
                  >
                    Crea
                  </button>
                  <button onClick={() => { setShowCreate(false); setNewName(""); }} className="text-muted-foreground p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-1 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-1 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="text-sm font-medium">Nuova playlist</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
              {contained.length > 0 && !search && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">Salvato in</p>
              )}
              {contained.map((pl: any) => (
                <PlaylistRow key={pl.id} pl={pl} onToggle={() => togglePlaylist(pl)} />
              ))}

              {contained.length > 0 && recent.length > 0 && !search && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1">Aggiunti di recente</p>
              )}
              {(search ? filtered : recent).map((pl: any) => (
                <PlaylistRow key={pl.id} pl={pl} onToggle={() => togglePlaylist(pl)} />
              ))}

              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">{search ? "Nessuna playlist trovata" : "Nessuna playlist"}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/20 shrink-0">
              <button onClick={() => setIsOpen(false)} className="px-5 py-2 rounded-full text-sm font-medium hover:bg-surface-1 transition-colors">
                Annulla
              </button>
              <button onClick={() => setIsOpen(false)} className="px-5 py-2 rounded-full bg-spotify-green text-black text-sm font-bold hover:bg-spotify-green/90 transition-colors">
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaylistRow({ pl, onToggle }: { pl: any; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-1 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-surface-2">
        {pl.thumbnail ? (
          <SafeImg src={pl.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <ListMusic className="w-5 h-5 m-auto text-muted-foreground/50" style={{ margin: "10px auto" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{pl.name}</p>
        <p className="text-xs text-muted-foreground">{pl.trackCount ?? 0} brani</p>
      </div>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${pl.hasTrack ? "bg-spotify-green" : "border-2 border-muted-foreground/40"}`}>
        {pl.hasTrack && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
      </div>
    </button>
  );
}

export default function MusicPlayer() {
  const {
    currentTrack, isPlaying, isLoading, currentTime, duration, volume, isMuted,
    queue, queueIndex, togglePlay, next, prev, seek, setVolume, toggleMute, toggleQueue, error,
    isShuffleOn, repeatMode, toggleShuffle, toggleRepeat,
    isAutoplayEnabled, isAutoplaying, toggleAutoplay,
    openNowPlaying, toggleLyrics,
    listenTogetherSession, isFollowingTogether, setListenTogetherSession, setFollowingTogether,
  } = usePlayer();

  const [, navigate] = useLocation();
  const joinTogetherMutation = trpc.listenTogether.join.useMutation({
    onSuccess: (data: any) => {
      setListenTogetherSession(data);
      setFollowingTogether(true);
      toast.success("Ti sei unito alla sessione!");
    },
    onError: (err) => toast.error(err.message),
  });

  const [expanded, setExpanded] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const goToArtist = useCallback((track: any) => {
    if (track.artistId) {
      navigate(`/artist/${track.artistId}`);
    } else if (track.artist) {
      navigate(`/search?q=${encodeURIComponent(track.artist)}`);
    }
  }, [navigate]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      let x: number;
      if ("touches" in e) x = e.touches[0].clientX - rect.left;
      else x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      seek(pct * duration);
    },
    [seek, duration]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX > 0) prev();
        else next();
      }
      touchStartRef.current = null;
    },
    [next, prev]
  );

  useEffect(() => { setExpanded(false); }, [currentTrack?.id]);

  if (!currentTrack) return null;

  return (
    <div
      className={`fixed left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/20 transition-all duration-300 lg:bottom-0 bottom-16 ${expanded ? "h-auto" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="progress-bar cursor-pointer mx-0"
        style={{ borderRadius: 0, height: "2px" }}
        onClick={handleSeek}
        onTouchEnd={handleSeek as any}
      >
        <div className="progress-fill" style={{ width: `${progress}%`, borderRadius: 0 }} />
      </div>

      {expanded && (
        <div className="sm:hidden px-4 pt-4 pb-2">
          <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-xl bg-surface-2">
              <SafeImg src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold truncate max-w-[280px]">{currentTrack.title}</p>
              <p
                className="text-sm text-muted-foreground truncate max-w-[280px] hover:text-foreground transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); goToArtist(currentTrack); }}
              >
                {currentTrack.artist}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <FavoriteButton track={currentTrack} />
              <PlaylistButton track={currentTrack} />
              <DownloadButton track={currentTrack} size="md" />
            </div>
          </div>
        </div>
      )}

      <div className="container flex items-center gap-2 sm:gap-4 h-16 sm:h-20">
        <div
          className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-56 md:w-72 shrink-0 cursor-pointer"
          onClick={openNowPlaying}
        >
          {!expanded && (
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-lg">
              <SafeImg src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0 hidden sm:block">
            <p
              className="text-sm font-medium truncate hover:text-spotify-green transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); currentTrack.albumId && navigate(`/album/${currentTrack.albumId}`); }}
            >
              {currentTrack.title}
            </p>
            <p
              className="text-xs text-muted-foreground truncate hover:text-foreground transition-colors cursor-pointer mt-0.5"
              onClick={(e) => { e.stopPropagation(); goToArtist(currentTrack); }}
            >
              {currentTrack.artist}
            </p>
          </div>
          <div className="sm:hidden ml-auto">
            {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={toggleShuffle}
              className={`transition-colors hidden sm:block ${isShuffleOn ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Shuffle className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              onClick={toggleShuffle}
              className={`transition-colors sm:hidden ${isShuffleOn ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Shuffle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            <button
              onClick={prev}
              disabled={queueIndex <= 0}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 hidden sm:block"
            >
              <SkipBack className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              onClick={prev}
              disabled={queueIndex <= 0}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 sm:hidden"
            >
              <SkipBack className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-spotify-green flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-70 soft-glow"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" strokeWidth={2} />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2} />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-0.5" strokeWidth={2} />
              )}
            </button>

            <button
              onClick={next}
              disabled={!isAutoplayEnabled && queueIndex >= queue.length - 1}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 hidden sm:block"
            >
              <SkipForward className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              onClick={next}
              disabled={!isAutoplayEnabled && queueIndex >= queue.length - 1}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 sm:hidden"
            >
              <SkipForward className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              onClick={toggleRepeat}
              className={`transition-colors hidden sm:block relative ${repeatMode !== "off" ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
            >
              {repeatMode === "one" ? <Repeat1 className="w-4 h-4" strokeWidth={2} /> : <Repeat className="w-4 h-4" strokeWidth={2} />}
            </button>
            <button
              onClick={toggleRepeat}
              className={`transition-colors sm:hidden relative ${repeatMode !== "off" ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
            >
              {repeatMode === "one" ? <Repeat1 className="w-3.5 h-3.5" strokeWidth={2} /> : <Repeat className="w-3.5 h-3.5" strokeWidth={2} />}
            </button>
          </div>

          {!expanded && (
            <div className="hidden sm:flex items-center gap-2 w-full max-w-md">
              <span className="text-[11px] text-muted-foreground w-8 text-right shrink-0 tabular-nums">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 progress-bar cursor-pointer" onClick={handleSeek}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground w-8 shrink-0 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-destructive truncate max-w-xs">{error}</p>}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <FavoriteButton track={currentTrack} />
            <PlaylistButton track={currentTrack} />
            <DownloadButton track={currentTrack} size="sm" />
          </div>
          <button
            onClick={toggleLyrics}
            className="text-muted-foreground hover:text-spotify-green transition-colors"
            title="Mostra testo"
          >
            <Mic2 className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            onClick={toggleAutoplay}
            className={`transition-all relative ${isAutoplayEnabled ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"} ${isAutoplaying ? "animate-pulse" : ""}`}
            title={isAutoplayEnabled ? "Autoplay attivo - suona brani simili a fine coda" : "Autoplay disattivato"}
          >
            <Zap className="w-4 h-4" strokeWidth={2} fill={isAutoplayEnabled ? "currentColor" : "none"} />
          </button>
          <button
            onClick={toggleMute}
            className="text-muted-foreground hover:text-spotify-green transition-colors hidden sm:block"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" strokeWidth={2} /> : <Volume2 className="w-4 h-4" strokeWidth={2} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 hidden sm:block"
          />
          <button
            onClick={toggleQueue}
            className="text-muted-foreground hover:text-spotify-green transition-colors relative"
          >
            <ListMusic className="w-5 h-5" strokeWidth={2} />
            {queue.length > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-spotify-green text-[9px] text-white flex items-center justify-center font-bold shadow-sm">
                {queue.length}
              </span>
            )}
          </button>
          {listenTogetherSession ? (
            <div className="relative group">
              <button
                onClick={() => { setListenTogetherSession(null); setFollowingTogether(false); }}
                className="text-spotify-green hover:text-spotify-green/80 transition-colors"
                title="In sessione Ascolta Insieme"
              >
                <RadioTower className="w-5 h-5" fill="currentColor" />
              </button>
              <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-2xl p-3 z-50 w-64 hidden group-hover:block">
                <p className="text-xs font-medium mb-1">Ascolta Insieme</p>
                <p className="text-[10px] text-muted-foreground mb-2">Codice: {listenTogetherSession.code}</p>
                {!isFollowingTogether && listenTogetherSession.creatorUserId !== (() => { const u = getCachedUser(); return u?.id; })() && (
                  <button
                    onClick={() => setFollowingTogether(true)}
                    className="w-full text-xs bg-spotify-green text-black font-medium py-1.5 rounded-lg hover:bg-spotify-green/90"
                  >
                    Segui riproduzione
                  </button>
                )}
                {isFollowingTogether && (
                  <button
                    onClick={() => setFollowingTogether(false)}
                    className="w-full text-xs bg-surface-1 text-muted-foreground font-medium py-1.5 rounded-lg hover:text-foreground"
                  >
                    Ferma follow
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowJoinInput(!showJoinInput)}
                className="text-muted-foreground hover:text-spotify-green transition-colors"
                title="Unisciti a 'Ascolta Insieme'"
              >
                <RadioTower className="w-5 h-5" />
              </button>
              {showJoinInput && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowJoinInput(false)} />
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-2xl p-3 z-50">
                    <p className="text-xs font-medium mb-2">Inserisci codice</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="CODICE"
                        className="w-20 bg-surface-1 border border-border rounded-lg px-2 py-1.5 text-xs uppercase outline-none"
                        maxLength={6}
                      />
                      <button
                        onClick={() => {
                          if (joinCode.length >= 4) {
                            joinTogetherMutation.mutate({ code: joinCode });
                            setShowJoinInput(false);
                            setJoinCode("");
                          }
                        }}
                        className="text-xs bg-spotify-green text-black font-medium px-3 py-1.5 rounded-lg hover:bg-spotify-green/90"
                      >
                        Unisciti
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
