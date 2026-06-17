import React from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import TrackCard from "../components/TrackCard";
import SafeImg from "../components/SafeImg";
import { ArrowLeft, Play, Plus, Disc3, Loader2, Clock } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { useAuth } from "../hooks/useAuth";

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { playTrack, addToQueue } = usePlayer();

  const { data: album, isLoading, error } = trpc.music.album.useQuery(
    { id: id || "" },
    { enabled: !!id, staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const handlePlayAll = () => {
    if (album?.tracks?.length) {
      playTrack(album.tracks[0], album.tracks);
    }
  };

  const handleAddAllToQueue = () => {
    if (album?.tracks) {
      album.tracks.forEach((t) => addToQueue(t));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin spotify-green" strokeWidth={2} />
          <p className="text-muted-foreground text-sm">Caricamento album...</p>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="container py-24 text-center fade-in">
        <p className="text-muted-foreground">Album non trovato.</p>
        <button onClick={() => navigate("/")} className="mt-4 text-sm text-spotify-green hover:text-spotify-green/80 transition-colors font-medium">
          Torna alla home
        </button>
      </div>
    );
  }

  const totalDuration = album.tracks?.reduce((acc: number, t: any) => acc + (t.durationSeconds || 0), 0) || 0;
  const formattedDuration = totalDuration > 0
    ? `${Math.floor(totalDuration / 60)} min ${totalDuration % 60} sec`
    : album.duration;

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <button
        onClick={() => window.history.length > 1 ? window.history.back() : navigate("/")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Indietro
      </button>

      <div className="flex flex-col sm:flex-row gap-8 mb-12">
        <div className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shrink-0 shadow-2xl mx-auto sm:mx-0">
          <SafeImg src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex flex-col justify-end gap-3 text-center sm:text-left">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Album</p>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">{album.title}</h1>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => album.artistId && navigate(`/artist/${album.artistId}`)}
              className="text-muted-foreground hover:text-spotify-green transition-colors text-sm font-medium w-fit mx-auto sm:mx-0"
            >
              {album.artist}
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center sm:justify-start">
              {album.year && <span>{album.year}</span>}
              {album.trackCount && (
                <><span className="opacity-50">·</span><span>{album.trackCount} brani</span></>
              )}
              {formattedDuration && (
                <><span className="opacity-50">·</span><span><Clock className="w-3 h-3 inline mr-0.5" />{formattedDuration}</span></>
              )}
            </div>
          </div>

          {album.description && (
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
              {album.description.slice(0, 200)}{album.description.length > 200 ? "..." : ""}
            </p>
          )}

          <div className="flex items-center gap-3 justify-center sm:justify-start mt-3">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-8 py-3 rounded-full bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
            >
              <Play className="w-4 h-4 fill-black" strokeWidth={0} />
              Riproduci tutto
            </button>
            <button
              onClick={handleAddAllToQueue}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-border text-sm font-medium hover:border-spotify-green hover:text-spotify-green transition-all duration-200"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Aggiungi alla coda
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <h2 className="text-base font-bold text-foreground">Tracklist</h2>
        <div className="space-y-1">
          {album.tracks.map((track, idx) => (
            <TrackCard
              key={track.id || idx}
              track={track}
              queue={album.tracks}
              index={idx}
              showIndex
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}
