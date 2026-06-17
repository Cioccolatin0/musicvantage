import React, { useMemo, useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Loader2,
  Heart,
  ExternalLink,
  Music2,
  Mic2,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronDown,
  ListMusic,
  Radio,
} from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import SafeImg from "./SafeImg";
import { toast } from "sonner";
import type { Track } from "@shared/types";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FavoriteButton({ track }: { track: Track }) {
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
      <Heart className="w-5 h-5" strokeWidth={2} fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}

function AudioRoutePicker() {
  const [showPicker, setShowPicker] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const handleClick = async () => {
    // Check if selectAudioOutput is available (Chrome 110+)
    if (typeof navigator !== "undefined" && (navigator as any).mediaDevices?.selectAudioOutput) {
      try {
        await (navigator as any).mediaDevices.selectAudioOutput();
        return;
      } catch {}
    }
    // On iOS, show instructions to use Control Center
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchstart" in window);
    if (iOS) {
      setIsIOS(true);
      setShowPicker(true);
    } else {
      // Try setSinkId via AudioContext as fallback
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        // @ts-ignore
        if (ctx.setSinkId) {
          await ctx.setSinkId();
        }
        osc.stop();
        ctx.close();
      } catch {
        setIsIOS(false);
        setShowPicker(true);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="text-muted-foreground hover:text-foreground transition-colors p-1"
        title="Dispositivo audio"
      >
        <Radio className="w-4 h-4" />
      </button>
      {showPicker && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowPicker(false)} />
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-5 w-72 max-w-[90vw]">
            <h4 className="text-sm font-bold mb-2">
              {isIOS ? "Dispositivo audio" : "Seleziona uscita audio"}
            </h4>
            {isIOS ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Per cambiare dispositivo audio su iPhone/iPad:
                </p>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Apri il <strong className="text-foreground">Centro di controllo</strong> (swipe dal alto a destra)</li>
                  <li>Tocca l'icona <strong className="text-foreground">AirPlay</strong> (cerchio con triangolo)</li>
                  <li>Seleziona altoparlante, auricolari o Bluetooth</li>
                </ol>
                <button
                  onClick={() => setShowPicker(false)}
                  className="w-full py-2 rounded-xl bg-surface-1 text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Ho capito
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Se il tuo browser supporta la selezione dell'uscita audio, dovrebbe essersi aperto un menu nativo.
                </p>
                <button
                  onClick={() => setShowPicker(false)}
                  className="w-full py-2 rounded-xl bg-surface-1 text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function NowPlayingPanel() {
  const {
    currentTrack, isPlaying, isLoading, isNowPlayingOpen, closeNowPlaying,
    togglePlay, next, prev, playTrack, queue, queueIndex, isLyricsOpen, toggleLyrics,
    currentTime, duration, seek, isShuffleOn, repeatMode, toggleShuffle, toggleRepeat,
    toggleQueue, volume, setVolume, isMuted, toggleMute, preloadTrack,
  } = usePlayer();
  const [, navigate] = useLocation();
  const progressRef = useRef<HTMLDivElement>(null);

  const { data: relatedData } = trpc.music.searchAll.useQuery(
    { query: currentTrack?.artist || "" },
    { enabled: isNowPlayingOpen && !!currentTrack?.artist, staleTime: 5 * 60 * 1000 }
  );

  const { data: relatedVideos } = trpc.music.searchVideos.useQuery(
    { query: currentTrack?.artist ? `${currentTrack.artist} official video` : "", limit: 6 },
    { enabled: isNowPlayingOpen && !!currentTrack?.artist }
  );

  const relatedTracks = useMemo(() => {
    if (!relatedData?.tracks || !currentTrack) return [];
    return relatedData.tracks.filter((t: Track) => t.id !== currentTrack.id).slice(0, 8);
  }, [relatedData, currentTrack]);

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

  const handleRelatedPlay = (track: Track) => {
    const relatedQueue = relatedTracks.length > 0 ? [track, ...relatedTracks.filter((t: Track) => t.id !== track.id)] : [track];
    playTrack(track, relatedQueue);
  };

  if (!isNowPlayingOpen || !currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // --- DESKTOP SIDEBAR (lg+) ---
  const desktopPanel = (
    <div
      className="hidden lg:flex w-[340px] shrink-0 bg-background border-l border-border/30 flex-col overflow-hidden"
      style={{ paddingBottom: currentTrack ? "88px" : "0" }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/20 shrink-0">
        <h3 className="font-bold text-sm">In riproduzione</h3>
        <button
          onClick={closeNowPlaying}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-3">
          <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-2xl bg-surface-2 relative group">
            <SafeImg src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
            <button
              onClick={togglePlay}
              className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
            >
              <div className="w-14 h-14 rounded-full bg-spotify-green/90 flex items-center justify-center shadow-xl backdrop-blur-sm hover:scale-105 transition-transform">
                {isLoading ? (
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 text-white" fill="white" />
                ) : (
                  <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold truncate">{currentTrack.title}</p>
              <p
                className="text-sm text-muted-foreground truncate hover:text-foreground transition-colors cursor-pointer mt-0.5"
                onClick={() => { closeNowPlaying(); if (currentTrack.artistId) navigate(`/artist/${currentTrack.artistId}`); }}
              >
                {currentTrack.artist}
              </p>
              {currentTrack.album && (
                <p
                  className="text-xs text-muted-foreground/70 truncate hover:text-foreground transition-colors cursor-pointer mt-0.5"
                  onClick={() => { closeNowPlaying(); if (currentTrack.albumId) navigate(`/album/${currentTrack.albumId}`); }}
                >
                  {currentTrack.album}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <FavoriteButton track={currentTrack} />
              <a
                href={`https://www.youtube.com/watch?v=${currentTrack.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Apri su YouTube"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <AudioRoutePicker />
            </div>
          </div>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center justify-center gap-6">
            <button onClick={prev} disabled={queueIndex <= 0} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
              <SkipBack className="w-5 h-5" fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-background animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6 text-background" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 text-background ml-0.5" fill="currentColor" />
              )}
            </button>
            <button onClick={next} disabled={queueIndex >= queue.length - 1} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3">
          <button
            onClick={toggleLyrics}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isLyricsOpen
                ? "bg-spotify-green/15 text-spotify-green ring-1 ring-spotify-green/30"
                : "bg-surface-1 hover:bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic2 className="w-4 h-4" />
            Testo
          </button>
        </div>

        {relatedTracks.length > 0 && (
          <div className="px-3 pb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Brani simili</h4>
            <div className="space-y-0.5">
              {relatedTracks.map((track: Track) => (
                <div key={track.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-1 cursor-pointer group transition-all duration-200" onClick={() => handleRelatedPlay(track)} onMouseEnter={() => preloadTrack(track.id)}>
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative shadow-md">
                    <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 rounded-lg">
                      <Play className="w-4 h-4 text-white" fill="white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
                  </div>
                  {track.duration && <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{track.duration}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {relatedVideos && relatedVideos.length > 0 && (
          <div className="px-3 pb-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Video musicali correlati</h4>
            <div className="space-y-0.5">
              {relatedVideos.map((video: any) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-1 cursor-pointer group transition-all duration-200"
                  onClick={() => {
                    const videoTrack: Track = { id: video.id, title: video.title, artist: video.artist || "", thumbnail: video.thumbnail, duration: video.duration, durationSeconds: 0, type: "track" };
                    playTrack(videoTrack, [videoTrack]);
                  }}
                >
                  <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative shadow-md">
                    <SafeImg src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 rounded-lg">
                      <Play className="w-4 h-4 text-white" fill="white" />
                    </div>
                    {video.duration && <span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/80 text-white px-1 rounded-sm font-medium">{video.duration}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{video.artist}</p>
                    {video.viewCount && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{video.viewCount}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {relatedTracks.length === 0 && (!relatedVideos || relatedVideos.length === 0) && currentTrack.artist && (
          <div className="px-5 pb-5">
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50 py-6">
              <Music2 className="w-8 h-8" strokeWidth={1.5} />
              <p className="text-xs">Nessun brano simile trovato</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- MOBILE FULL-SCREEN ---
  const mobilePanel = (
    <div className="lg:hidden fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <button
          onClick={closeNowPlaying}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-xl hover:bg-surface-1"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In riproduzione</p>
        <button
          onClick={toggleQueue}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2 rounded-xl hover:bg-surface-1 relative"
        >
          <ListMusic className="w-5 h-5" />
          {queue.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-spotify-green text-[8px] text-white flex items-center justify-center font-bold">
              {queue.length}
            </span>
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        {/* Album Art */}
        <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-2xl bg-surface-2 mb-6">
          <SafeImg src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
        </div>

        {/* Track Info */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold truncate">{currentTrack.title}</p>
              <p
                className="text-base text-muted-foreground truncate hover:text-foreground transition-colors cursor-pointer mt-0.5"
                onClick={() => { closeNowPlaying(); if (currentTrack.artistId) navigate(`/artist/${currentTrack.artistId}`); }}
              >
                {currentTrack.artist}
              </p>
              {currentTrack.album && (
                <p
                  className="text-sm text-muted-foreground/60 truncate hover:text-foreground transition-colors cursor-pointer mt-0.5"
                  onClick={() => { closeNowPlaying(); if (currentTrack.albumId) navigate(`/album/${currentTrack.albumId}`); }}
                >
                  {currentTrack.album}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 pt-1">
              <FavoriteButton track={currentTrack} />
              <a
                href={`https://www.youtube.com/watch?v=${currentTrack.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <AudioRoutePicker />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div
            ref={progressRef}
            className="progress-bar cursor-pointer"
            onClick={handleSeek}
            onTouchEnd={handleSeek as any}
          >
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <button
            onClick={toggleShuffle}
            className={`transition-colors ${isShuffleOn ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Shuffle className="w-5 h-5" strokeWidth={2} />
          </button>
          <button
            onClick={prev}
            disabled={queueIndex <= 0}
            className="text-foreground transition-colors disabled:opacity-30"
          >
            <SkipBack className="w-7 h-7" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center active:scale-95 transition-all duration-200 disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-background animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 text-background" fill="currentColor" />
            ) : (
              <Play className="w-8 h-8 text-background ml-1" fill="currentColor" />
            )}
          </button>
          <button
            onClick={next}
            disabled={queueIndex >= queue.length - 1}
            className="text-foreground transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-7 h-7" fill="currentColor" />
          </button>
          <button
            onClick={toggleRepeat}
            className={`transition-colors relative ${repeatMode !== "off" ? "text-spotify-green" : "text-muted-foreground hover:text-foreground"}`}
          >
            {repeatMode === "one" ? <Repeat1 className="w-5 h-5" strokeWidth={2} /> : <Repeat className="w-5 h-5" strokeWidth={2} />}
          </button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={toggleLyrics}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isLyricsOpen
                ? "bg-spotify-green/15 text-spotify-green ring-1 ring-spotify-green/30"
                : "bg-surface-1 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic2 className="w-4 h-4" />
            Testo
          </button>
        </div>

        {/* Related Tracks */}
        {relatedTracks.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Brani simili</h4>
            <div className="space-y-1">
              {relatedTracks.slice(0, 5).map((track: Track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-1 cursor-pointer group transition-all duration-200"
                  onClick={() => handleRelatedPlay(track)}
                  onMouseEnter={() => preloadTrack(track.id)}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative shadow-md">
                    <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 rounded-lg">
                      <Play className="w-4 h-4 text-white" fill="white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
                  </div>
                  {track.duration && <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{track.duration}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {desktopPanel}
      {isNowPlayingOpen && mobilePanel}
    </>
  );
}
