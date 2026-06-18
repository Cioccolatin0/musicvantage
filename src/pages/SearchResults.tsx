import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import TrackCard from "../components/TrackCard";
import ArtistCard from "../components/ArtistCard";
import AlbumCard from "../components/AlbumCard";
import SafeImg from "../components/SafeImg";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLocation } from "wouter";
import { Music2, Users, Disc3, Search, Loader2, Sparkles, Play } from "lucide-react";

function prefetchAudioUrls(trackIds: string[]) {
  if (trackIds.length === 0) return;
  const apiBase = import.meta.env.VITE_API_URL || "";
  for (let i = 0; i < trackIds.length; i += 10) {
    const batch = trackIds.slice(i, i + 10);
    fetch(`${apiBase}/api/prefetch-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoIds: batch }),
    }).catch(() => {});
  }
}

type Tab = "all" | "tracks" | "artists" | "albums";

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-surface-1">
      <div className="aspect-square skeleton rounded-lg" />
      <div className="p-3 space-y-2">
        <div className="h-3 skeleton rounded w-3/4" />
        <div className="h-2.5 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}

export default function SearchResults() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const query = params.get("q") || "";
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const searchAll = trpc.music.searchAll.useQuery(
    { query },
    {
      enabled: query.length > 0,
      staleTime: 2 * 60 * 1000,
      keepPreviousData: true,
      retry: 1,
    }
  );
  // Fetch songs-only immediately to show tracks fast, keep full search for artists/albums
  const searchSongs = trpc.music.search.useQuery(
    { query, filter: "songs" },
    { enabled: query.length > 0, staleTime: 60 * 1000, keepPreviousData: true, retry: 1 }
  );

  const noDataYet = !searchSongs.data && !searchAll.data;
  const initialLoading = (searchSongs.isFetching || searchAll.isFetching) && noDataYet;
  const error = searchAll.error || searchSongs.error;

  const searchSongsRaw = searchSongs.data?.tracks || searchAll.data?.tracks || [];
  const artists = searchAll.data?.artists || [];
  const albums = searchAll.data?.albums || [];

  // Deduplicate tracks by id to avoid showing the same song twice
  const tracks = (() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const t of searchSongsRaw) {
      const key = t.id || `${t.title}-${t.artist}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  })();

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "all", label: "Tutti", icon: Sparkles, count: (tracks?.length || 0) + (artists?.length || 0) + (albums?.length || 0) },
    { id: "tracks", label: "Brani", icon: Music2, count: tracks?.length },
    { id: "artists", label: "Artisti", icon: Users, count: artists?.length },
    { id: "albums", label: "Album", icon: Disc3, count: albums?.length },
  ];

  // Prefetch audio URLs for top tracks when search results arrive (instant playback)
  useEffect(() => {
    if (tracks.length > 0) {
      const ids = tracks.slice(0, 10).map((t) => t.id);
      prefetchAudioUrls(ids);
    }
  }, [tracks.slice(0, 5).map((t) => t.id).join(",")]);

  // Decide if we should show a prominent artist banner
  const { playTrack } = usePlayer();
  const [, navigate] = useLocation();

  function deduceTopArtistFromTracks(tracks: any[], q: string | null) {
    if (!tracks || tracks.length === 0) return null;
    const counts = new Map<string, { name: string; id: string | null; thumb?: string; count: number }>();
    for (const t of tracks) {
      const rawArtist = (t.artist || "").split(",")[0].trim();
      const id = t.artistId || rawArtist.toLowerCase();
      const key = String(id || rawArtist).toLowerCase();
      const entry = counts.get(key) || { name: rawArtist, id: t.artistId || null, thumb: t.thumbnail || undefined, count: 0 };
      entry.count++;
      if (!entry.thumb && t.thumbnail) entry.thumb = t.thumbnail;
      counts.set(key, entry);
    }
    let best: { name: string; id: string | null; thumb?: string; count: number } | null = null;
    for (const v of counts.values()) {
      if (!best || v.count > best.count) best = v;
    }
    if (!best) return null;
    const qn = (q || "").toLowerCase();
    const nameLower = (best.name || "").toLowerCase();
    const qualifiesByName = qn && nameLower.includes(qn);
    const majority = best.count >= Math.max(2, Math.ceil(tracks.length / 2));
    if (qualifiesByName || majority) return best;
    return null;
  }

  const topArtistFromSearch = artists && artists.length > 0 ? artists[0] : null;
  const deducedArtist = deduceTopArtistFromTracks(tracks, query);
  const topArtist = topArtistFromSearch || deducedArtist;

  async function playTopArtist(artist: any) {
    const name = (artist?.name || "").trim();
    if (!name) return;
    // find tracks that match artist in current results
    let artistTracks = (tracks || []).filter((t: any) => (t.artist || "").toLowerCase().includes(name.toLowerCase()));
    if (!artistTracks || artistTracks.length === 0) {
      // fall back to an explicit songs-only search
      try {
        const result = await (trpc.music.search as any).fetch({ query: name, filter: "songs" });
        artistTracks = result?.tracks || [];
      } catch (_) {
        artistTracks = [];
      }
    }
    const queue = artistTracks.map((t: any) => ({
      id: t.id,
      title: t.title || t.trackTitle || "Brano sconosciuto",
      artist: t.artist || t.trackArtist || "Artista sconosciuto",
      thumbnail: t.thumbnail || t.trackThumbnail || "",
      duration: t.duration || t.durationSeconds || 0,
      type: "track" as const,
    }));
    if (queue.length > 0) {
      playTrack(queue[0], queue);
    } else if (tracks && tracks.length > 0) {
      // fallback to first available track
      playTrack(tracks[0], tracks);
    }
  }

  if (!query) {
    return (
      <div className="container py-24 text-center fade-in">
        <div className="w-20 h-20 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-6">
          <Search className="w-10 h-10 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Inizia a cercare</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Digita nella barra di ricerca per trovare brani, artisti e album
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12 space-y-8">
      <div className="space-y-2 fade-in">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Risultati per</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">"{query}"</h1>
      </div>

      {topArtist && (
        <div className="flex items-center gap-6 mt-4 p-4 rounded-xl bg-surface-1 border border-border/20">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-surface-2">
            <SafeImg src={topArtist.thumbnail || topArtist.thumb} alt={topArtist.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Artista in evidenza</p>
            <h2 className="text-xl sm:text-2xl font-bold truncate">{topArtist.name}</h2>
            {topArtist.subscribers && <p className="text-sm text-muted-foreground mt-1 truncate">{topArtist.subscribers}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void playTopArtist(topArtist)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-spotify-green text-black font-semibold"
              >
                <Play className="w-4 h-4" />
                Ascolta
              </button>
              {topArtist.id && (
                <button
                  onClick={() => {
                    if (topArtist === topArtistFromSearch) {
                      navigate(`/artist/${topArtist.id}`);
                    } else {
                      navigate(`/search?q=${encodeURIComponent(topArtist.name)}`);
                    }
                  }}
                  className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:border-spotify-green hover:text-spotify-green"
                >
                  Vai all'artista
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 border-b border-border/20 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 -mb-px ${
                isActive
                  ? "border-spotify-green text-spotify-green"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs ml-1 tabular-nums ${isActive ? "text-spotify-green" : "text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {initialLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground fade-in">
          <p className="text-sm">Impossibile caricare i risultati. Riprova più tardi.</p>
        </div>
      ) : (
        <>
          {activeTab === "all" && (
            <div className="space-y-12 fade-in">
              {tracks && tracks.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                    <Music2 className="w-4 h-4 spotify-green" strokeWidth={2} />
                    Brani
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {tracks.slice(0, 15).map((track: any) => (
                      <TrackCard key={track.id} track={track} queue={tracks} />
                    ))}
                  </div>
                </section>
              )}

              {artists && artists.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                    <Users className="w-4 h-4 spotify-green" strokeWidth={2} />
                    Artisti
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {artists.slice(0, 10).map((artist: any) => (
                      <ArtistCard key={artist.id || artist.name} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {albums && albums.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
                    <Disc3 className="w-4 h-4 spotify-green" strokeWidth={2} />
                    Album
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {albums.slice(0, 10).map((album: any) => (
                      <AlbumCard key={album.id} album={album} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "tracks" && tracks && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 fade-in">
              {tracks.slice(0, 30).map((track: any) => (
                <TrackCard key={track.id} track={track} queue={tracks} />
              ))}
            </div>
          )}

          {activeTab === "artists" && artists && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 fade-in">
              {artists.map((artist: any) => (
                <ArtistCard key={artist.id || artist.name} artist={artist} />
              ))}
            </div>
          )}

          {activeTab === "albums" && albums && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 fade-in">
              {albums.map((album: any) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
