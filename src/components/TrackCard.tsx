import React, { useState } from "react";
import { Play, Plus, Heart, ListPlus, Maximize2 } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import SafeImg from "./SafeImg";
import DownloadButton from "./DownloadButton";
import type { Track } from "@shared/types";

type Props = {
  track: Track;
  queue?: Track[];
  index?: number;
  showIndex?: boolean;
  compact?: boolean;
};

function FavoriteButton({ track, size = "sm" }: { track: Track; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const { data: isFav } = trpc.library.isFavorite.useQuery(
    { trackId: track.id },
    { enabled: !!user }
  );
  const utils = trpc.useUtils();
  const addToFavMutation = trpc.library.addToFavorites.useMutation({
    onSuccess: () => {
      toast.success("Aggiunto ai preferiti");
      utils.library.isFavorite.invalidate({ trackId: track.id });
      utils.library.favorites.invalidate();
    },
  });
  const removeFromFavMutation = trpc.library.removeFromFavorites.useMutation({
    onSuccess: () => {
      toast.success("Rimosso dai preferiti");
      utils.library.isFavorite.invalidate({ trackId: track.id });
      utils.library.favorites.invalidate();
    },
  });

  if (!user) return null;

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isFav) {
          removeFromFavMutation.mutate({ trackId: track.id });
        } else {
          addToFavMutation.mutate({
            trackId: track.id,
            trackTitle: track.title,
            trackArtist: track.artist,
            trackThumbnail: track.thumbnail,
            trackDuration: track.durationSeconds,
          });
        }
      }}
      className={`transition-all duration-200 ${
        isFav
          ? "text-red-500 hover:text-red-400 scale-110"
          : "text-muted-foreground hover:text-red-400"
      }`}
      title={isFav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
    >
      <Heart className={iconSize} strokeWidth={2} fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}

function PlaylistDropdown({ track, size = "sm" }: { track: Track; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { data: playlists = [] } = trpc.library.playlists.useQuery(undefined, {
    enabled: !!user && isOpen,
  });
  const utils = trpc.useUtils();
  const addTrackMutation = trpc.library.addTrackToPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Brano aggiunto alla playlist");
      utils.library.playlistTracks.invalidate();
      setIsOpen(false);
    },
  });

  if (!user) return null;

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-muted-foreground hover:text-spotify-green transition-colors"
        title="Aggiungi alla playlist"
      >
        <ListPlus className={iconSize} strokeWidth={2} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-2xl p-1.5 min-w-[180px] z-50 max-h-48 overflow-y-auto backdrop-blur-xl">
            {playlists.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">
                Nessuna playlist. Creane una nella Libreria.
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => {
                    addTrackMutation.mutate({
                      playlistId: pl.id,
                      trackId: track.id,
                      trackTitle: track.title,
                      trackArtist: track.artist,
                      trackThumbnail: track.thumbnail,
                      trackDuration: track.durationSeconds,
                    });
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-1 rounded-lg transition-colors"
                >
                  {pl.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

let _hoverTimer: ReturnType<typeof setTimeout> | null = null;

export default function TrackCard({ track, queue, index, showIndex, compact }: Props) {
  const { playTrack, addToQueue, currentTrack, isPlaying, openNowPlaying, preloadTrack } = usePlayer();
  const isActive = currentTrack?.id === track.id;

  const handlePlay = () => {
    playTrack(track, queue || [track]);
  };

  const handleHover = () => {
    if (!isActive) {
      preloadTrack(track.id);
      if (_hoverTimer) clearTimeout(_hoverTimer);
      _hoverTimer = setTimeout(() => {
        const apiBase = import.meta.env.VITE_API_URL || "";
        fetch(`${apiBase}/api/prefetch-audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIds: [track.id] }),
        }).catch(() => {});
      }, 400);
    }
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-200 ${
          isActive ? "bg-spotify-green/10 ring-1 ring-spotify-green/20" : "hover:bg-surface-1"
        }`}
        onClick={handlePlay}
        onMouseEnter={handleHover}
      >
        {showIndex && (
          <span className={`w-6 text-center text-xs shrink-0 font-mono ${isActive ? "spotify-green" : "text-muted-foreground"}`}>
            {isActive && isPlaying ? (
              <span className="inline-flex gap-0.5 items-end h-3">
                <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0s" }} />
                <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.15s" }} />
                <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.3s" }} />
              </span>
            ) : (
              index !== undefined ? index + 1 : ""
            )}
          </span>
        )}
        <div
          className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative shadow-md cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handlePlay(); openNowPlaying(); }}
        >
          <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 rounded-lg">
            <Maximize2 className="w-4 h-4 text-white drop-shadow-lg" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "spotify-green" : "text-foreground"}`}>
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FavoriteButton track={track} size="sm" />
          <PlaylistDropdown track={track} size="sm" />
          <DownloadButton track={track} size="sm" />
          {track.duration && (
            <span className="text-xs text-muted-foreground/70 tabular-nums">{track.duration}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:spotify-green transition-all duration-200 p-1"
            title="Aggiungi alla coda"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`music-card flex flex-col rounded-xl overflow-hidden cursor-pointer group bg-surface-1 transition-all duration-300 ${
        isActive ? "bg-surface-2 ring-1 ring-spotify-green/30 shadow-lg shadow-green-500/5" : "hover:shadow-xl"
      }`}
      onClick={handlePlay}
      onMouseEnter={handleHover}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg">
        <SafeImg
          src={track.thumbnail}
          alt={track.title}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-spotify-green/90 flex items-center justify-center soft-glow shadow-lg transform group-hover:scale-110 transition-transform duration-300">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" strokeWidth={2} />
          </div>
        </div>
        {isActive && isPlaying && (
          <div className="absolute bottom-3 right-3 flex gap-0.5 items-end h-4">
            <span className="w-1 bg-spotify-green rounded-full equalizer-bar" style={{ animationDelay: "0s" }} />
            <span className="w-1 bg-spotify-green rounded-full equalizer-bar" style={{ animationDelay: "0.15s" }} />
            <span className="w-1 bg-spotify-green rounded-full equalizer-bar" style={{ animationDelay: "0.3s" }} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${isActive ? "spotify-green" : "text-foreground"}`}>
            {track.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <FavoriteButton track={track} size="md" />
            <PlaylistDropdown track={track} size="md" />
            <DownloadButton track={track} size="md" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        {track.duration && (
          <p className="text-xs text-muted-foreground/50">{track.duration}</p>
        )}
      </div>
    </div>
  );
}
