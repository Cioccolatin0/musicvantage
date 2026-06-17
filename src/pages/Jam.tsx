import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  Radio, Music, Users, Play, Plus, LogIn, Loader2,
  Timer, Copy, Check, X, PlayCircle, PauseCircle,
  SkipForward, SkipBack, Sparkles, Disc3, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@shared/types";
import SafeImg from "../components/SafeImg";

export default function Jam() {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, next, prev, queue } = usePlayer();
  const utils = trpc.useUtils();
  const [, setRefresh] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [jamName, setJamName] = useState("");
  const [duration, setDuration] = useState(30);
  const [joinCode, setJoinCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: mySessions = [], refetch: refetchSessions } = trpc.jam.mySessions.useQuery(undefined, { enabled: !!user });
  const { data: session, refetch: refetchSession } = trpc.jam.get.useQuery(
    { code: activeCode || "" },
    { enabled: !!activeCode, refetchInterval: 5000 }
  );

  const createMutation = trpc.jam.create.useMutation({
    onSuccess: (data) => {
      setActiveCode(data.code);
      setShowCreate(false);
      setJamName("");
      toast.success("JAM creata! Codice: " + data.code);
      refetchSessions();
    },
  });

  const joinMutation = trpc.jam.join.useMutation({
    onSuccess: (data) => {
      setActiveCode(data.code);
      setJoinCode("");
      toast.success("Sei entrato nella JAM!");
      refetchSessions();
    },
  });

  const startMutation = trpc.jam.start.useMutation({
    onSuccess: () => {
      toast.success("JAM iniziata!");
      refetchSession();
    },
  });

  const leaveMutation = trpc.jam.leave.useMutation({
    onSuccess: () => {
      setActiveCode(null);
      toast.success("Sei uscito dalla JAM");
      refetchSessions();
    },
  });

  const endMutation = trpc.jam.end.useMutation({
    onSuccess: () => {
      setActiveCode(null);
      toast.success("JAM terminata");
      refetchSessions();
    },
  });

  const generateJamPlaylist = async () => {
    if (!session || !user) return;
    setGenerating(true);

    try {
      const allTracks: Track[] = [];
      const seen = new Set<string>();

      // 1. Get user's favorites and history
      const favs = await utils.library.favorites.fetch();
      const hist = await utils.library.history.fetch({ limit: 50 });

      // Collect artist names
      const artistNames: string[] = [];

      for (const t of [...(favs || []), ...(hist || [])]) {
        if (!seen.has(t.trackId)) {
          seen.add(t.trackId);
          allTracks.push({
            id: t.trackId,
            title: t.trackTitle || "Brano",
            artist: t.trackArtist || "Artista",
            thumbnail: t.trackThumbnail || "",
            type: "track",
          });
        }
        if (t.trackArtist && !artistNames.includes(t.trackArtist)) {
          artistNames.push(t.trackArtist);
        }
      }

      // 2. Search similar tracks by artist names via backend
      if (artistNames.length > 0) {
        const similar = await utils.client.music.similarTracks.query({ artists: artistNames });
        for (const t of similar || []) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            allTracks.push(t);
          }
        }
      }

      // 3. Shuffle and limit to a good amount
      const shuffled = allTracks.sort(() => Math.random() - 0.5);

      if (shuffled.length === 0) {
        toast.error("Nessun brano disponibile");
        setGenerating(false);
        return;
      }

      playTrack(shuffled[0], shuffled);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (session?.status === "active") {
      generateJamPlaylist();
    }
  }, [session?.status]);

  useEffect(() => {
    const interval = setInterval(() => setRefresh((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-4">
          <Radio className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <p className="text-muted-foreground text-sm">Accedi per creare o partecipare a una JAM</p>
      </div>
    );
  }

  const isCreator = session?.creatorUserId === user.id;

  if (activeCode && session) {
    const elapsed = session.startedAt
      ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      : 0;
    const totalSeconds = session.durationMinutes * 60;
    const remaining = Math.max(0, totalSeconds - elapsed);

    return (
      <div className="container py-8 sm:py-12 space-y-8 fade-in">
        <button
          onClick={() => setActiveCode(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
          Esci dalla JAM
        </button>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--spotify-green)] to-[var(--spotify-purple)] flex items-center justify-center mx-auto shadow-2xl">
            <Radio className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{session.name}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {session.participants.length} partecipanti
            </span>
            <span className="flex items-center gap-1.5">
              <Timer className="w-4 h-4" />
              {session.status === "active"
                ? `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")} rimanenti`
                : `${session.durationMinutes} minuti`}
            </span>
            <span className="flex items-center gap-1.5">
              <Disc3 className="w-4 h-4" />
              Codice: <strong style={{ color: "var(--spotify-green)" }}>{session.code}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          {session.status === "waiting" && isCreator && (
            <button
              onClick={() => startMutation.mutate({ code: session.code })}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
              style={{ backgroundColor: "var(--spotify-green)", color: "black" }}
            >
              <Play className="w-4 h-4 fill-black" strokeWidth={0} />
              Avvia JAM
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(session.code);
              setCopied(true);
              toast.success("Codice copiato!");
              setTimeout(() => setCopied(false), 3000);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 text-sm font-medium hover:border-[var(--spotify-green)] hover:text-[var(--spotify-green)] transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiato!" : "Copia codice"}
          </button>
          {session.status === "active" && (
            <button
              onClick={generateJamPlaylist}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all"
              style={{ backgroundColor: "var(--spotify-purple)", color: "white", opacity: generating ? 0.7 : 1 }}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Generazione..." : "Rigenera playlist"}
            </button>
          )}
          {isCreator && session.status !== "ended" && (
            <button
              onClick={() => endMutation.mutate({ code: session.code })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all"
            >
              <X className="w-4 h-4" />
              Termina JAM
            </button>
          )}
          {!isCreator && session.status !== "ended" && (
            <button
              onClick={() => leaveMutation.mutate({ code: session.code })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all"
            >
              <X className="w-4 h-4" />
              Esci
            </button>
          )}
        </div>

        {session.status === "waiting" && (
          <div className="text-center py-8">
            <div className="animate-pulse-soft">
              <Radio className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--spotify-green)" }} />
            </div>
            <p className="text-muted-foreground">In attesa che il creatore avvii la JAM...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Condividi il codice <strong style={{ color: "var(--spotify-green)" }}>{session.code}</strong> con i tuoi amici!
            </p>
          </div>
        )}

        {session.status === "active" && (
          <>
            {currentTrack && (
              <div className="border border-border/50 rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--card)" }}>
                <h3 className="font-semibold flex items-center gap-2">
                  <Music className="w-4 h-4" style={{ color: "var(--spotify-green)" }} />
                  Ora in riproduzione
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-2 shadow-lg">
                    <SafeImg src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{currentTrack.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={prev} className="text-muted-foreground hover:text-foreground p-1">
                      <SkipBack className="w-5 h-5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                      style={{ backgroundColor: "var(--spotify-green)" }}
                    >
                      {isPlaying ? (
                        <PauseCircle className="w-6 h-6 text-white" strokeWidth={2} />
                      ) : (
                        <PlayCircle className="w-6 h-6 text-white" strokeWidth={2} />
                      )}
                    </button>
                    <button onClick={next} className="text-muted-foreground hover:text-foreground p-1">
                      <SkipForward className="w-5 h-5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {generating && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--spotify-green)" }} />
                <p className="text-sm text-muted-foreground">Generazione della playlist JAM in corso...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Sto mescolando i generi di tutti i partecipanti
                </p>
              </div>
            )}

            {queue.length > 0 && !generating && (
              <div className="border border-border/50 rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card)" }}>
                <h3 className="font-semibold flex items-center gap-2">
                  <Disc3 className="w-4 h-4" style={{ color: "var(--spotify-green)" }} />
                  Playlist JAM ({queue.length} brani)
                </h3>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {queue.map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-1 transition-colors"
                    >
                      <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                        <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="border border-border/50 rounded-2xl p-6" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "var(--spotify-green)" }} />
            Partecipanti ({session.participants.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {session.participants.map((p: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-1 text-sm"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--spotify-green)" }}>
                  <Users className="w-3 h-3 text-white" strokeWidth={2.5} />
                </div>
                {p.userName}
                {p.userId === session.creatorUserId && (
                  <span className="text-[10px] font-semibold ml-1" style={{ color: "var(--spotify-green)" }}>CREATOR</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12 space-y-8 fade-in">
      <div className="text-center space-y-4 pb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--spotify-green)] to-[var(--spotify-purple)] flex items-center justify-center mx-auto shadow-2xl" style={{ boxShadow: "0 0 30px color-mix(in srgb, var(--spotify-green) 30%, transparent)" }}>
          <Radio className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">JAM</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Crea una sessione di ascolto condivisa! L'app mescolerà i generi musicali di tutti i partecipanti
          in una playlist unica. Durata: da 10 minuti a 2 ore.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="border border-border/50 rounded-2xl p-8 text-center transition-all duration-200 hover:shadow-lg group"
          style={{ backgroundColor: "var(--card)" }}
        >
          <Plus className="w-10 h-10 mx-auto mb-4 group-hover:scale-110 transition-transform" strokeWidth={2} style={{ color: "var(--spotify-green)" }} />
          <h3 className="font-bold text-lg mb-2">Crea una JAM</h3>
          <p className="text-sm text-muted-foreground">Avvia una nuova sessione e invita i tuoi amici</p>
        </button>

        <div className="border border-border/50 rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: "var(--card)" }}>
          <LogIn className="w-10 h-10 text-muted-foreground mx-auto" strokeWidth={1.5} />
          <h3 className="font-bold text-lg">Unisciti a una JAM</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Codice JAM..."
              className="flex-1 bg-surface-1 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--spotify-green)]/40 transition-all uppercase"
            />
            <button
              onClick={() => {
                if (joinCode.trim()) {
                  joinMutation.mutate({ code: joinCode.trim() });
                }
              }}
              disabled={!joinCode.trim() || joinMutation.isPending}
              className="px-5 py-2.5 rounded-xl text-black font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
              style={{ backgroundColor: "var(--spotify-green)" }}
            >
              {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entra"}
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="max-w-md mx-auto border border-border/50 rounded-2xl p-6 space-y-4 fade-in" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="font-bold text-lg">Nuova JAM</h3>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Nome della sessione</label>
            <input
              type="text"
              value={jamName}
              onChange={(e) => setJamName(e.target.value)}
              placeholder="Es: Serata hip hop..."
              className="w-full bg-surface-1 border border-border/50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--spotify-green)]/40 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Durata: {duration} minuti</label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>10 min</span>
              <span>2 ore</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (!jamName.trim()) { toast.error("Inserisci un nome"); return; }
              createMutation.mutate({ name: jamName, durationMinutes: duration });
            }}
            disabled={createMutation.isPending || !jamName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold hover:opacity-90 transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--spotify-green)" }}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
            Crea JAM
          </button>
        </div>
      )}

      {mySessions.length > 0 && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <h2 className="font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4" style={{ color: "var(--spotify-green)" }} />
            Le tue JAM attive
          </h2>
          <div className="grid gap-4">
            {mySessions.map((s: any) => (
              <div
                key={s.code}
                className="border border-border/50 rounded-xl p-5 flex items-center justify-between hover:border-[var(--spotify-green)]/30 transition-all cursor-pointer"
                style={{ backgroundColor: "var(--card)" }}
                onClick={() => setActiveCode(s.code)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.status === "active" ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: s.status === "active" ? "var(--spotify-green)" : "oklch(0.7 0.15 80)" }}
                  />
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {s.participants.length} partecipanti &middot; {s.durationMinutes} min &middot; Codice: {s.code}
                    </p>
                  </div>
                </div>
                <Play className="w-5 h-5 text-muted-foreground hover:text-[var(--spotify-green)]" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
