import { trpc } from "@/lib/trpc";
import TrackCard from "../components/TrackCard";
import ArtistCard from "../components/ArtistCard";
import AlbumCard from "../components/AlbumCard";
import SafeImg from "../components/SafeImg";
import { useAuth } from "../hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import { useLocation } from "wouter";
import { Loader2, TrendingUp, Disc3, Users, Music2, Sparkles, Headphones, Radio, Share2, LogIn, UserPlus, ChevronDown, Clock, History, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-spotify-green/10 flex items-center justify-center">
        <Icon className="w-4 h-4 spotify-green" strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

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

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="relative group p-6 rounded-2xl bg-surface-1/50 border border-border/20 hover:border-spotify-green/30 hover:bg-surface-1 transition-all duration-500 fade-in-up">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-spotify-green/20 to-spotify-purple/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-6 h-6 spotify-green" strokeWidth={2} />
      </div>
      <h3 className="text-base font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-spotify-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}

function QuickPlayCard({ track, onClick }: { track: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-0 bg-surface-1/80 hover:bg-surface-2 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-spotify-green/5 text-left"
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 overflow-hidden">
        <SafeImg src={track.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      </div>
      <span className="px-3 text-sm font-semibold truncate">{track.title || track.trackTitle}</span>
    </button>
  );
}

function PersonalizedCard({ track, queue, onClick }: { track: any; queue: any[]; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-card hover:bg-surface-2 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 text-left fade-in hover:scale-[1.02]"
    >
      <div className="aspect-square overflow-hidden">
        <SafeImg src={track.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p className="text-sm font-bold truncate">{track.title || track.trackTitle}</p>
        <p className="text-xs text-white/70 truncate">{track.artist || track.trackArtist}</p>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
        <div className="w-10 h-10 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-green-500/30">
          <svg className="w-5 h-5 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { playTrack, currentTrack, listenTogetherSession: togetherSession } = usePlayer();
  const { data, isLoading, error } = trpc.music.home.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: personalized, isLoading: personalizedLoading } = trpc.music.personalizedHome.useQuery(undefined, {
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const buildTrackList = (tracks: any[]) =>
    tracks.map((t: any) => ({
      id: t.id || t.trackId,
      title: t.title || t.trackTitle || "Brano sconosciuto",
      artist: t.artist || t.trackArtist || "Artista sconosciuto",
      thumbnail: t.thumbnail || t.trackThumbnail || "",
      type: "track" as const,
    }));



  if (user) {
    return (
      <div className="space-y-10 sm:space-y-14 py-6 sm:py-10">
        <div className="fade-in">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1">
            Ciao, {user.name}
          </h1>
          <p className="text-muted-foreground text-sm">Cosa vuoi ascoltare oggi?</p>
        </div>

        {personalized && personalized.recentTracks.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.1s" }}>
            <SectionHeader icon={Clock} title="Riproduci di recente" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {personalized.recentTracks.slice(0, 5).map((track: any, i: number) => (
                <QuickPlayCard
                  key={track.trackId + i}
                  track={track}
                  onClick={() => {
                    const tl = buildTrackList(personalized.recentTracks);
                    playTrack(tl[i], tl);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {personalized && personalized.followedArtists && personalized.followedArtists.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.15s" }}>
            <SectionHeader icon={Users} title="I tuoi artisti" subtitle="Artisti che segui" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {personalized.followedArtists.map((fa: any) => (
                <ArtistCard key={fa.id} artist={{ id: fa.id, name: fa.name, thumbnail: fa.thumbnail, type: "artist" }} />
              ))}
            </div>
          </section>
        )}

        {personalized && personalized.mixTracks.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.2s" }}>
            <SectionHeader icon={Shuffle} title="In base al tuo gusto" subtitle="Mix personalizzato per te" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {personalized.mixTracks.slice(0, 12).map((track: any, i: number) => (
                <div key={track.id + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <PersonalizedCard
                    track={track}
                    queue={personalized.mixTracks}
                    onClick={() => {
                      const tl = buildTrackList(personalized.mixTracks);
                      playTrack(tl[i], tl);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {personalized && personalized.monthlyTracks.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.3s" }}>
            <SectionHeader icon={History} title="I tuoi preferiti del mese" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {personalized.monthlyTracks.slice(0, 12).map((track: any, i: number) => (
                <div key={track.trackId + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <PersonalizedCard
                    track={track}
                    queue={personalized.monthlyTracks}
                    onClick={() => {
                      const tl = buildTrackList(personalized.monthlyTracks);
                      playTrack(tl[i], tl);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {personalized && personalized.suggestions.length > 0 && (
          <section className="fade-in-up" style={{ animationDelay: "0.4s" }}>
            <SectionHeader icon={Sparkles} title="Scopri di più" subtitle="Suggeriti in base ai tuoi gusti" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {personalized.suggestions.slice(0, 12).map((track: any, i: number) => (
                <div key={track.id + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <TrackCard track={track} queue={personalized.suggestions} />
                </div>
              ))}
            </div>
          </section>
        )}

        {personalizedLoading && (
          <div className="space-y-10 sm:space-y-14">
            {[1, 2, 3].map((section) => (
              <section key={section}>
                <div className="h-5 w-40 skeleton rounded mb-6" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {data && (
          <div className="space-y-10 sm:space-y-14">
            {data.trending && data.trending.length > 0 && (
              <section className="fade-in-up" style={{ animationDelay: "0.5s" }}>
                <SectionHeader icon={TrendingUp} title="Tendenze" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {data.trending.slice(0, 12).map((track: any, i: number) => (
                    <div key={track.id + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <TrackCard track={track} queue={data.trending} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.newAlbums && data.newAlbums.length > 0 && (
              <section className="fade-in-up" style={{ animationDelay: "0.6s" }}>
                <SectionHeader icon={Disc3} title="Album recenti" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {data.newAlbums.slice(0, 12).map((album: any, i: number) => (
                    <div key={album.id + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <AlbumCard album={album} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.featuredArtists && data.featuredArtists.length > 0 && (
              <section className="fade-in-up" style={{ animationDelay: "0.7s" }}>
                <SectionHeader icon={Sparkles} title="Artisti consigliati" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {data.featuredArtists.slice(0, 12).map((artist: any, i: number) => (
                    <div key={artist.id + i} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                      <ArtistCard artist={artist} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <footer className="border-t border-border/20 py-8 text-center text-xs text-muted-foreground/40">
          MusicVantage &copy; {new Date().getFullYear()} &mdash; Tutti i diritti riservati
        </footer>
      </div>
    );
  }

  return (
    <div>
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-spotify-green/5 via-spotify-purple/5 to-background pointer-events-none" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-spotify-green/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-spotify-purple/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="relative container text-center py-24 sm:py-32 px-4">
          <div className="fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-spotify-green to-spotify-purple flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
              <Music2 className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
              <span className="gradient-text">MusicVantage</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              Ascolta milioni di brani, scopri nuovi artisti e crea la tua libreria musicale personale.
              Ovunque, sempre, gratuitamente.
            </p>
            <p className="text-sm text-muted-foreground/60 max-w-xl mx-auto mb-10">
              Streaming illimitato senza pubblicità. Iscriviti con un codice invito e inizia subito.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => navigate("/login?tab=register")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-spotify-green text-black font-bold text-base hover:bg-spotify-green/90 hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-green-500/25"
              >
                <UserPlus className="w-5 h-5" strokeWidth={2.5} />
                Registrati gratis
              </button>
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full border border-border/50 text-foreground font-semibold text-base hover:border-spotify-green hover:text-spotify-green hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <LogIn className="w-5 h-5" strokeWidth={2} />
                Accedi
              </button>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        </div>
      </section>

      <section className="container py-20 sm:py-28">
        <div className="text-center mb-14 fade-in">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Tutto ciò che ami della musica
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Un'esperienza musicale moderna, veloce e senza limiti.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={Headphones}
            title="Streaming illimitato"
            description="Ascolta tutta la musica che vuoi, senza pubblicità e senza limiti. Milioni di brani a portata di clic."
          />
          <FeatureCard
            icon={Radio}
            title="Scopri nuovi artisti"
            description="Esplora generi, artisti e album consigliati. La tua prossima canzone preferita è a un clic di distanza."
          />
          <FeatureCard
            icon={Share2}
            title="Accedi con invito"
            description="La piattaforma è su invito per garantire un'esperienza esclusiva. Chiedi un codice a chi è già iscritto."
          />
          <FeatureCard
            icon={Music2}
            title="Libreria personale"
            description="Crea playlist, salva i tuoi brani preferiti e tieni traccia della tua cronologia di ascolto."
          />
          <FeatureCard
            icon={TrendingUp}
            title="Tendenze in tempo reale"
            description="Scopri cosa ascoltano gli altri. Tieni il passo con le ultime novità musicali."
          />
          <FeatureCard
            icon={Sparkles}
            title="Qualità audio superiore"
            description="Ascolta i tuoi brani preferiti in alta qualità, con un player moderno e intuitivo."
          />
        </div>
      </section>

      {data && (
        <div className="container pb-20 sm:pb-28 space-y-12 sm:space-y-16">
          <div className="text-center fade-in mb-8">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Esplora ora
            </h2>
          </div>

          <section className="fade-in-up" style={{ animationDelay: "0.1s" }}>
            <SectionHeader icon={TrendingUp} title="Brani di tendenza" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {(data?.trending || []).slice(0, 12).map((track, i) => (
                <div key={track.id} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <TrackCard track={track} queue={data?.trending || []} />
                </div>
              ))}
            </div>
          </section>

          <section className="fade-in-up" style={{ animationDelay: "0.2s" }}>
            <SectionHeader icon={Disc3} title="Album recenti" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {(data?.newAlbums || []).slice(0, 12).map((album, i) => (
                <div key={album.id} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <AlbumCard key={album.id} album={album} />
                </div>
              ))}
            </div>
          </section>

          <section className="fade-in-up" style={{ animationDelay: "0.3s" }}>
            <SectionHeader icon={Sparkles} title="Artisti consigliati" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {(data?.featuredArtists || []).slice(0, 12).map((artist: any, i) => (
                <div key={artist.id} className="fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <ArtistCard key={artist.id} artist={artist} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {isLoading && (
        <div className="container pb-20 sm:pb-28 space-y-12 sm:space-y-16">
          <div className="text-center mb-8 fade-in">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Caricamento in corso...
            </h2>
            <p className="text-muted-foreground text-sm mt-2">Stiamo recuperando la musica per te</p>
          </div>
          {[1, 2, 3].map((section) => (
            <section key={section}>
              <div className="h-5 w-40 skeleton rounded mb-6" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {error && !isLoading && !data && (
        <div className="container pb-20 sm:pb-28 text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Music2 className="w-8 h-8 text-destructive" strokeWidth={2} />
          </div>
          <p className="text-muted-foreground text-sm mb-2">Impossibile caricare i contenuti musicali</p>
          <p className="text-xs text-muted-foreground/60">Riprova più tardi o contatta l'amministratore</p>
        </div>
      )}

      <section className="container py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-spotify-green/10 via-spotify-purple/10 to-background border border-border/20 p-12 sm:p-20 text-center fade-in-up">
          <div className="absolute top-0 right-0 w-64 h-64 bg-spotify-green/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-spotify-purple/10 rounded-full blur-[100px]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Pronto a iniziare?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Ottieni un codice invito da un amico già iscritto e unisciti alla community di MusicVantage.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => navigate("/login?tab=register")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-spotify-green text-black font-bold text-base hover:bg-spotify-green/90 hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl shadow-green-500/25"
              >
                <UserPlus className="w-5 h-5" strokeWidth={2.5} />
                Registrati ora
              </button>
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full border border-border/50 text-foreground font-semibold text-base hover:border-spotify-green hover:text-spotify-green hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <LogIn className="w-5 h-5" strokeWidth={2} />
                Accedi
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/20 py-8 text-center text-xs text-muted-foreground/40">
        MusicVantage &copy; {new Date().getFullYear()} &mdash; Tutti i diritti riservati
      </footer>
    </div>
  );
}
