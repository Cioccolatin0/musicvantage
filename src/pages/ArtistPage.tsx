import React, { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePlayer } from "../contexts/PlayerContext";
import { useAuth } from "../hooks/useAuth";
import SafeImg from "../components/SafeImg";
import {
  ArrowLeft,
  Play,
  Shuffle,
  MoreHorizontal,
  ChevronRight,
  Plus,
  Heart,
  ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { Track, Artist, Album } from "@shared/types";

function formatCount(views?: string): string {
  if (!views) return "";
  const num = parseInt(views.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return views;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(".0", "")} miliardi`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(".0", "")} Milioni`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}.${String(num % 1000).padStart(3, "0")}`;
  return num.toLocaleString("it-IT");
}

function TrackRowMenu({ track, onClose }: { track: Track; onClose: () => void }) {
  const { user } = useAuth();
  const { addToQueue } = usePlayer();
  const utils = trpc.useUtils();
  const addToFavMutation = trpc.library.addToFavorites.useMutation({
    onSuccess: () => {
      toast.success("Aggiunto ai preferiti");
      utils.library.isFavorite.invalidate({ trackId: track.id });
      utils.library.favorites.invalidate();
    },
  });
  const { data: playlists = [] } = trpc.library.playlists.useQuery(undefined, {
    enabled: !!user,
  });
  const addTrackMutation = trpc.library.addTrackToPlaylist.useMutation({
    onSuccess: () => {
      toast.success("Brano aggiunto alla playlist");
      utils.library.playlistTracks.invalidate();
      onClose();
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl p-1.5 min-w-[200px] z-50 backdrop-blur-xl fade-in">
        <button
          onClick={() => { addToQueue(track); onClose(); }}
          className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-surface-1 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Aggiungi alla coda
        </button>
        {user && (
          <>
            <button
              onClick={() => { addToFavMutation.mutate({ trackId: track.id, trackTitle: track.title, trackArtist: track.artist, trackThumbnail: track.thumbnail, trackDuration: track.durationSeconds }); onClose(); }}
              className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm hover:bg-surface-1 rounded-lg transition-colors"
            >
              <Heart className="w-4 h-4" />
              Aggiungi ai preferiti
            </button>
            <div className="border-t border-border my-1" />
            <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Aggiungi a playlist</p>
            {playlists.slice(0, 5).map((pl) => (
              <button
                key={pl.id}
                onClick={() => { addTrackMutation.mutate({ playlistId: pl.id, trackId: track.id, trackTitle: track.title, trackArtist: track.artist, trackThumbnail: track.thumbnail, trackDuration: track.durationSeconds }); }}
                className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm hover:bg-surface-1 rounded-lg transition-colors truncate"
              >
                <ListPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{pl.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function PopularTrackRow({
  track,
  index,
  queue,
  isExpanded,
}: {
  track: Track;
  index: number;
  queue: Track[];
  isExpanded: boolean;
}) {
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const isActive = currentTrack?.id === track.id;
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isExpanded && index >= 5) return null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer group transition-colors relative ${
        isActive ? "bg-spotify-green/10" : "hover:bg-surface-1"
      }`}
      onClick={() => playTrack(track, queue)}
    >
      <div className="w-6 text-center shrink-0">
        {isActive && isPlaying ? (
          <span className="inline-flex gap-[3px] items-end h-3 justify-center">
            <span className="w-[3px] bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0s" }} />
            <span className="w-[3px] bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.15s" }} />
            <span className="w-[3px] bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.3s" }} />
          </span>
        ) : (
          <span className={`text-sm tabular-nums ${isActive ? "spotify-green" : "text-muted-foreground"}`}>
            {index + 1}
          </span>
        )}
      </div>

      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 relative">
        <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 rounded-md">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? "spotify-green" : "text-foreground"}`}>
          {track.title}
        </p>
      </div>

      {track.duration && (
        <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{track.duration}</span>
      )}

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1 shrink-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && <TrackRowMenu track={track} onClose={() => setMenuOpen(false)} />}
      </div>
    </div>
  );
}

function RelatedArtistCard({ artist }: { artist: Artist }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-1 hover:bg-surface-2 cursor-pointer transition-all group"
      onClick={() => navigate(`/artist/${artist.id}`)}
    >
      <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-border/10 group-hover:ring-spotify-green/30 transition-all shadow-lg">
        <SafeImg src={artist.thumbnail} alt={artist.name} className="w-full h-full object-cover" />
      </div>
      <p className="text-sm font-semibold text-foreground truncate w-full text-center group-hover:text-spotify-green transition-colors">
        {artist.name}
      </p>
    </div>
  );
}

function PlaylistCard({ album, isVideo }: { album: Album; isVideo?: boolean }) {
  const [, navigate] = useLocation();
  const { playTrack } = usePlayer();

  const handleClick = () => {
    if (isVideo && album.id) {
      playTrack({
        id: album.id,
        title: album.title,
        artist: album.artist,
        thumbnail: album.thumbnail,
        type: "track",
      });
    } else {
      navigate(`/album/${album.id}`);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 cursor-pointer group"
      onClick={handleClick}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-2 shadow-lg">
        <SafeImg src={album.thumbnail} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {isVideo && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-12 h-12 text-white fill-white drop-shadow-lg" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
          <div className="w-10 h-10 rounded-full bg-spotify-green flex items-center justify-center shadow-xl soft-glow transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-spotify-green transition-colors">
          {album.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {album.artist || ""}
        </p>
      </div>
    </div>
  );
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const { user } = useAuth();

  const { data: artist, isLoading, error } = trpc.music.artist.useQuery(
    { id: id || "" },
    { enabled: !!id, staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const { data: isFollowingData } = trpc.library.isFollowingArtist.useQuery(
    { artistId: id || "" },
    { enabled: !!user && !!id }
  );
  const utils = trpc.useUtils();
  const followMutation = trpc.library.followArtist.useMutation({
    onSuccess: () => {
      utils.library.isFollowingArtist.invalidate({ artistId: id || "" });
      utils.library.followedArtists.invalidate();
    },
  });
  const unfollowMutation = trpc.library.unfollowArtist.useMutation({
    onSuccess: () => {
      utils.library.isFollowingArtist.invalidate({ artistId: id || "" });
      utils.library.followedArtists.invalidate();
    },
  });

  const [showAllTracks, setShowAllTracks] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleFollow = useCallback(() => {
    if (!id) return;
    if (!user) {
      toast.error("Devi effettuare il login per seguire artisti");
      return;
    }
    if (isFollowingData) {
      unfollowMutation.mutate({ artistId: id });
      toast.success("Artista non seguito");
    } else {
      followMutation.mutate({
        artistId: id,
        artistName: artist!.name,
        artistThumbnail: artist!.thumbnail,
      });
      toast.success("Artista seguito");
    }
  }, [id, user, artist, isFollowingData, followMutation, unfollowMutation]);

  const handlePlayAll = useCallback(() => {
    if (!artist?.topSongs?.length) return;
    playTrack(artist.topSongs[0], artist.topSongs);
  }, [artist, playTrack]);

  const handleShufflePlay = useCallback(() => {
    if (!artist?.topSongs?.length) return;
    const shuffled = [...artist.topSongs].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  }, [artist, playTrack]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  }, [navigate]);

  const topTracksToShow = showAllTracks ? artist?.topSongs : artist?.topSongs?.slice(0, 5);
  const hasMoreTracks = (artist?.topSongs?.length || 0) > 5;
  const latestRelease = artist?.albums?.[0] || artist?.singles?.[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-spotify-green border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Caricamento artista...</p>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Artista non trovato.</p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-spotify-green hover:text-spotify-green/80 transition-colors font-medium"
          >
            Torna alla home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in overflow-x-hidden">
      {/* Sticky Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-background/95 backdrop-blur-xl border-b border-border/50 translate-y-0"
            : "-translate-y-full"
        }`}
        style={{ top: "var(--navbar-height, 0px)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3 max-w-screen-2xl mx-auto">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center hover:bg-surface-2 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold truncate">{artist.name}</h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="relative h-[280px] sm:h-[340px] md:h-[400px] overflow-hidden">
          <SafeImg
            src={artist.thumbnail}
            alt={artist.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-background" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 md:p-8">
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-2 text-white drop-shadow-lg">
            {artist.name}
          </h1>

          <div className="flex items-center gap-2 mt-1 md:mt-2">
            <span className="text-sm text-white/80 font-medium">
              {artist.subscribers || artist.views ? (
                <>
                  {artist.subscribers && <span>{artist.subscribers} ascoltatori mensili</span>}
                  {artist.subscribers && artist.views && <span className="mx-1">·</span>}
                  {artist.views && <span>{formatCount(artist.views)} visualizzazioni</span>}
                </>
              ) : (
                <span>Artista</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-4 sm:px-6 md:px-8 py-4 flex items-center justify-between">
        <button
          onClick={handleShufflePlay}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shuffle className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFollow}
            className={`px-5 py-1.5 rounded-full text-sm font-bold border transition-all ${
              isFollowingData
                ? "bg-spotify-green border-spotify-green text-black"
                : "border-white/40 text-white hover:border-white/70"
            }`}
          >
            {isFollowingData ? "Seguito" : "Segui"}
          </button>

          <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayAll}
            className="w-12 h-12 rounded-full bg-spotify-green hover:bg-spotify-green/90 flex items-center justify-center transition-all soft-glow shadow-lg hover:scale-105 active:scale-95"
          >
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </button>
        </div>
      </div>

      <div className="px-0 sm:px-2 md:px-4 space-y-8 pb-32">
        {/* Popular Section */}
        {artist.topSongs?.length > 0 && (
          <section className="fade-in-up">
            <div className="px-4 sm:px-6 md:px-8 flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Popolare</h2>
            </div>
            <div>
              {topTracksToShow?.map((track, idx) => (
                <PopularTrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  queue={artist.topSongs}
                  isExpanded={showAllTracks}
                />
              ))}
            </div>
            {hasMoreTracks && (
              <div className="px-4 sm:px-6 md:px-8 mt-3">
                <button
                  onClick={() => setShowAllTracks(!showAllTracks)}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllTracks ? "Mostra meno" : "Mostra altro"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Latest Release */}
        {latestRelease && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Ultima uscita</h2>
            </div>
            <div
              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group hover:bg-surface-1 transition-colors"
              onClick={() => latestRelease.id && navigate(`/album/${latestRelease.id}`)}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-md">
                <SafeImg
                  src={latestRelease.thumbnail}
                  alt={latestRelease.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
                  {latestRelease.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {latestRelease.year ? `Singolo · ${latestRelease.year}` : "Singolo"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Discography Link */}
        {(artist.albums?.length > 0 || artist.singles?.length > 0) && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Discografia</h2>
              <button
                onClick={() => navigate(`/artist/${id}/releases`)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Mostra tutto <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {artist.albums?.slice(0, 5).map((album, i) => (
                <PlaylistCard key={album.id || `album-${i}`} album={album} />
              ))}
              {artist.singles?.slice(0, 5).map((single, i) => (
                <PlaylistCard key={single.id || `single-${i}`} album={single} />
              ))}
            </div>
          </section>
        )}

        {/* Related Playlists / Con ARTIST */}
        {artist.playlists && artist.playlists.length > 0 && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.2s" }}>
            <h2 className="text-xl font-bold mb-3">Con {artist.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {artist.playlists.map((pl) => (
                <PlaylistCard key={pl.id} album={pl} />
              ))}
            </div>
          </section>
        )}

        {/* Music Videos */}
        {artist.videos && artist.videos.length > 0 && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.25s" }}>
            <h2 className="text-xl font-bold mb-3">Video musicali</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {artist.videos.map((video) => (
                <PlaylistCard
                  key={video.id}
                  album={{
                    id: video.id,
                    title: video.title,
                    artist: video.artist,
                    thumbnail: video.thumbnail,
                    type: "album",
                  }}
                  isVideo
                />
              ))}
            </div>
          </section>
        )}

        {/* About / Informazioni */}
        {artist.description && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.3s" }}>
            <h2 className="text-xl font-bold mb-3">Informazioni</h2>
            <div
              className={`relative rounded-xl overflow-hidden bg-surface-1 p-4 cursor-pointer transition-all ${
                bioExpanded ? "" : "max-h-[140px]"
              }`}
              onClick={() => setBioExpanded(!bioExpanded)}
            >
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {artist.description}
              </p>
              {!bioExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-surface-1 to-transparent pointer-events-none" />
              )}
            </div>
            <button
              onClick={() => setBioExpanded(!bioExpanded)}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mt-2 flex items-center gap-1"
            >
              {bioExpanded ? "Mostra meno" : "Altro"}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${bioExpanded ? "rotate-90" : ""}`} />
            </button>
          </section>
        )}

        {/* Fans Also Like */}
        {artist.relatedArtists && artist.relatedArtists.length > 0 && (
          <section className="fade-in-up px-4 sm:px-6 md:px-8" style={{ animationDelay: "0.35s" }}>
            <h2 className="text-xl font-bold mb-3">I fan apprezzano anche</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {artist.relatedArtists.map((ra) => (
                <RelatedArtistCard key={ra.id} artist={ra} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
