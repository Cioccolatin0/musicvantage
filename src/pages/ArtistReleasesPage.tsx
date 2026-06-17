import React, { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SafeImg from "../components/SafeImg";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import type { Album } from "@shared/types";

type TabKey = "album" | "singles" | "playlists";

function ReleaseRow({ album, showSubtitle }: { album: Album; showSubtitle?: boolean }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group hover:bg-surface-1 transition-colors"
      onClick={() => navigate(`/album/${album.id}`)}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-md relative">
        <SafeImg src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 rounded-lg">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
          {album.title}
        </p>
        {showSubtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {album.year ? `Singolo · ${album.year}` : "Singolo"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ArtistReleasesPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>("album");

  const { data: artist, isLoading } = trpc.music.artist.useQuery(
    { id: id || "" },
    { enabled: !!id, staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "album", label: "Album" },
    { key: "singles", label: "Singoli ed EP" },
    { key: "playlists", label: "Presente in" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin spotify-green" strokeWidth={2} />
          <p className="text-muted-foreground text-sm">Caricamento uscite...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
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

  const latestRelease = artist.albums?.[0] || artist.singles?.[0];

  return (
    <div className="fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(`/artist/${id}`)}
            className="w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center hover:bg-surface-2 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold truncate">{artist.name}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "bg-surface-1 text-foreground hover:bg-surface-2 border border-border/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 pb-32">
        {/* Latest Release */}
        {latestRelease && activeTab === "album" && (
          <section className="fade-in-up">
            <h2 className="text-lg font-bold mb-3">Ultima uscita</h2>
            <ReleaseRow album={latestRelease} showSubtitle />
          </section>
        )}

        {latestRelease && activeTab === "singles" && (
          <section className="fade-in-up">
            <h2 className="text-lg font-bold mb-3">Ultima uscita</h2>
            <ReleaseRow album={latestRelease} showSubtitle />
          </section>
        )}

        {/* Album Tab */}
        {activeTab === "album" && artist.albums && artist.albums.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-lg font-bold mb-3">Album</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {artist.albums.map((album, i) => (
                <div
                  key={album.id}
                  className="music-card flex flex-col rounded-xl overflow-hidden cursor-pointer bg-surface-1 transition-all duration-300 hover:bg-surface-2 group hover:shadow-xl fade-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg">
                    <SafeImg
                      src={album.thumbnail}
                      alt={album.title}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                      <div className="w-10 h-10 rounded-full bg-spotify-green flex items-center justify-center shadow-xl soft-glow transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
                      {album.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{album.artist || artist.name}</p>
                    {album.year && <p className="text-xs text-muted-foreground/50">{album.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Singles Tab */}
        {activeTab === "singles" && artist.singles && artist.singles.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-lg font-bold mb-3">Singoli ed EP</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {artist.singles.map((single, i) => (
                <div
                  key={single.id}
                  className="music-card flex flex-col rounded-xl overflow-hidden cursor-pointer bg-surface-1 transition-all duration-300 hover:bg-surface-2 group hover:shadow-xl fade-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => navigate(`/album/${single.id}`)}
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg">
                    <SafeImg
                      src={single.thumbnail}
                      alt={single.title}
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                      <div className="w-10 h-10 rounded-full bg-spotify-green flex items-center justify-center shadow-xl soft-glow transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
                      {single.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{single.artist || artist.name}</p>
                    {single.year && <p className="text-xs text-muted-foreground/50">{single.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Playlists / Presente in Tab */}
        {activeTab === "playlists" && (
          <section className="fade-in-up" style={{ animationDelay: "0.1s" }}>
            {artist.playlists && artist.playlists.length > 0 ? (
              <>
                <h2 className="text-lg font-bold mb-3">Presente in</h2>
                <div className="space-y-1">
                  {artist.playlists.map((pl) => (
                    <ReleaseRow key={pl.id} album={pl} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Nessuna playlist trovata per questo artista.</p>
              </div>
            )}
          </section>
        )}

        {/* Empty states */}
        {activeTab === "album" && (!artist.albums || artist.albums.length === 0) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Nessun album trovato.</p>
          </div>
        )}
        {activeTab === "singles" && (!artist.singles || artist.singles.length === 0) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Nessun singolo o EP trovato.</p>
          </div>
        )}
      </div>
    </div>
  );
}
