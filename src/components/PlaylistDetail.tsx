import React from "react";
import { trpc } from "@/lib/trpc";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import SafeImg from "./SafeImg";
import { ArrowLeft, Play, Trash2, Music, Loader2, Plus } from "lucide-react";
import type { Track } from "@shared/types";

type PlaylistDetailProps = {
  playlistId: number;
  playlistName: string;
  onBack: () => void;
};

export default function PlaylistDetail({ playlistId, playlistName, onBack }: PlaylistDetailProps) {
  const { playTrack, addToQueue } = usePlayer();

  const { data: tracks = [], isLoading, refetch } = trpc.library.playlistTracks.useQuery(
    { playlistId }
  );

  const removeTrackMutation = trpc.library.removeTrackFromPlaylist.useMutation({
    onSuccess: () => { refetch(); },
  });

  const playAllTracks = () => {
    if (tracks.length === 0) return;
    const trackList: Track[] = tracks.map((t) => ({
      id: t.trackId,
      title: t.trackTitle || "Brano sconosciuto",
      artist: t.trackArtist || "Artista sconosciuto",
      thumbnail: t.trackThumbnail || "",
      duration: t.trackDuration?.toString(),
      type: "track" as const,
    }));
    playTrack(trackList[0], trackList);
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Indietro
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
        <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-spotify-green/40 to-spotify-purple/40 flex items-center justify-center shadow-xl">
          <Music className="w-16 h-16 text-white/50" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Playlist</p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{playlistName}</h1>
          {tracks.length > 0 && (
            <p className="text-sm text-muted-foreground">{tracks.length} brani</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={playAllTracks}
          disabled={tracks.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-green-500/20"
        >
          <Play className="w-4 h-4 fill-black" strokeWidth={0} />
          Riproduci tutto
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin spotify-green" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="w-12 h-12 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">Questa playlist è vuota</p>
          <p className="text-xs mt-2">Aggiungi brani dalla ricerca o dal player</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.map((track, idx) => {
            const trackData: Track = {
              id: track.trackId,
              title: track.trackTitle || "Brano sconosciuto",
              artist: track.trackArtist || "Artista sconosciuto",
              thumbnail: track.trackThumbnail || "",
              duration: track.trackDuration?.toString(),
              type: "track",
            };

            return (
              <div
                key={`${track.trackId}-${idx}`}
                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-card transition-all duration-200 cursor-pointer"
                onClick={() => {
                  const queue: Track[] = tracks.map((t) => ({
                    id: t.trackId,
                    title: t.trackTitle || "Brano sconosciuto",
                    artist: t.trackArtist || "Artista sconosciuto",
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
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-md">
                  <SafeImg src={track.trackThumbnail} alt={track.trackTitle || ""} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{track.trackTitle}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{track.trackArtist}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {track.trackDuration && (
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
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
    </div>
  );
}
