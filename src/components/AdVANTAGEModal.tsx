import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Trophy, Clock, Music, TrendingUp, Medal, Loader2 } from "lucide-react";
import SafeImg from "./SafeImg";
import { usePlayer } from "@/contexts/PlayerContext";

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId?: number;
  groupName?: string;
}

export default function AdVANTAGEModal({ open, onClose, conversationId, groupName }: Props) {
  const { playTrack } = usePlayer();
  const ym = new Date().toISOString().slice(0, 7);

  const { data: myRecap, isLoading: loadingMyRecap } = trpc.vantage.myMonthlyRecap.useQuery(
    { yearMonth: ym },
    { enabled: open && !conversationId }
  );

  const { data: groupRecapData, isLoading: loadingGroup } = trpc.vantage.groupMonthlyRecap.useQuery(
    { conversationId: conversationId!, yearMonth: ym },
    { enabled: open && !!conversationId }
  );

  if (!open) return null;

  const isGroup = !!conversationId;
  const recapData = isGroup ? groupRecapData : null;
  const personalRecap = isGroup ? null : myRecap;
  const isLoading = isGroup ? loadingGroup : loadingMyRecap;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-card to-background rounded-3xl w-full max-w-lg mx-4 border border-border/40 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-600/20 p-6 pb-8">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors text-white">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">adVANTAGE</h2>
              <p className="text-sm text-white/70">
                {isGroup ? `Classifica ${groupName || "gruppo"}` : "Il tuo recap mensile"}
              </p>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-2">
            {new Date().toLocaleDateString("it-IT", { month: "long", year: "numeric" }).toUpperCase()}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isGroup && groupRecapData ? (
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                Classifica
              </h3>
              {groupRecapData.members.map((m, i) => {
                const isWinner = i === 0;
                return (
                  <div
                    key={m.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      isWinner ? "bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/20" : "bg-surface-1"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      isWinner ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" :
                      i === 1 ? "bg-zinc-400 text-white" :
                      i === 2 ? "bg-amber-700 text-white" :
                      "bg-surface-2 text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.totalMinutes} minuti · {m.totalTracks} brani</p>
                    </div>
                    {isWinner && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Music className="w-4 h-4 text-spotify-green" />
                Top 5 brani del gruppo
              </h3>
              {groupRecapData.groupTopTracks.map((t, i) => (
                <button
                  key={t.trackId}
                  onClick={() => playTrack({ id: t.trackId, title: t.title, artist: t.artist, thumbnail: t.thumbnail || "", type: "track" })}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-1 transition-colors text-left"
                >
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 shrink-0">
                    <SafeImg src={t.thumbnail || ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{t.playCount}x</span>
                </button>
              ))}
            </div>
          </div>
        ) : personalRecap ? (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/10">
                <Clock className="w-5 h-5 text-blue-400 mb-1" />
                <p className="text-2xl font-bold">{personalRecap.totalMinutes}</p>
                <p className="text-xs text-muted-foreground">minuti ascoltati</p>
              </div>
              <div className="bg-gradient-to-br from-spotify-green/10 to-green-600/5 rounded-xl p-4 border border-spotify-green/10">
                <Music className="w-5 h-5 text-spotify-green mb-1" />
                <p className="text-2xl font-bold">{personalRecap.totalTracks}</p>
                <p className="text-xs text-muted-foreground">brani ascoltati</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-spotify-green" />
                I tuoi top 5 brani
              </h3>
              <div className="space-y-1">
                {personalRecap.topTracks.map((t, i) => (
                  <button
                    key={t.trackId}
                    onClick={() => playTrack({ id: t.trackId, title: t.title, artist: t.artist, thumbnail: t.thumbnail || "", type: "track" })}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-1 transition-colors text-left"
                  >
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-2 shrink-0">
                      <SafeImg src={t.thumbnail || ""} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{t.playCount}x</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {personalRecap.totalMinutes >= 60
                  ? `Più di ${Math.floor(personalRecap.totalMinutes / 60)} ore di musica!`
                  : "Continua ad ascoltare per sbloccare il prossimo traguardo!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground text-sm">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nessun dato per questo mese</p>
            <p className="text-xs mt-1">Ascolta musica per vedere le tue statistiche!</p>
          </div>
        )}
      </div>
    </div>
  );
}