import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import AdVANTAGEModal from "@/components/AdVANTAGEModal";
import { Trophy, Clock, Music, TrendingUp, Zap, Loader2, Flame } from "lucide-react";

export default function VantagePage() {
  const { user } = useAuth();
  const [showRecap, setShowRecap] = useState(false);

  const { data: stats, isLoading } = trpc.vantage.myStats.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Accedi per vedere le tue statistiche adVANTAGE</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 sm:p-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">adVANTAGE</h1>
          <p className="text-sm text-muted-foreground">Le tue statistiche di ascolto</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl p-4 border border-amber-500/10">
              <Clock className="w-5 h-5 text-amber-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalMinutes}</p>
              <p className="text-xs text-muted-foreground">totale minuti</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/10">
              <Music className="w-5 h-5 text-blue-400 mb-1" />
              <p className="text-2xl font-bold">{stats.totalTracks}</p>
              <p className="text-xs text-muted-foreground">totale brani</p>
            </div>
            <div className="bg-gradient-to-br from-spotify-green/10 to-green-600/5 rounded-xl p-4 border border-spotify-green/10">
              <Flame className="w-5 h-5 text-spotify-green mb-1" />
              <p className="text-2xl font-bold">{stats.dailyMinutes}</p>
              <p className="text-xs text-muted-foreground">oggi (min)</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/10">
              <TrendingUp className="w-5 h-5 text-purple-400 mb-1" />
              <p className="text-2xl font-bold">{stats.weeklyMinutes}</p>
              <p className="text-xs text-muted-foreground">questa settimana</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl p-5 border border-amber-500/15 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <p className="font-semibold">Questo mese: <span className="text-amber-400">{stats.monthlyMinutes} minuti</span></p>
            </div>
            {stats.monthlyMinutes >= 60 && (
              <p className="text-sm text-muted-foreground">
                {Math.floor(stats.monthlyMinutes / 60)} ore e {stats.monthlyMinutes % 60} minuti di musica ascoltata!
              </p>
            )}
            <button
              onClick={() => setShowRecap(true)}
              className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
            >
              Vedi recap completo
            </button>
          </div>

          <div className="bg-surface-1 rounded-xl p-4 border border-border/30">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Come funziona</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Nei gruppi, chi ascolta pi&ugrave; musica vince la classifica mensile</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-spotify-green shrink-0 mt-0.5" />
                <span>Ogni mese viene generato un recap adVANTAGE con i tuoi top 5 brani</span>
              </li>
              <li className="flex items-start gap-2">
                <Flame className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span>Pi&ugrave; ascolti, pi&ugrave; sali in classifica nel gruppo!</span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-muted-foreground text-sm">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Ancora nessun dato</p>
          <p className="text-xs mt-1">Inizia ad ascoltare musica per vedere le statistiche!</p>
        </div>
      )}

      <AdVANTAGEModal open={showRecap} onClose={() => setShowRecap(false)} />
    </div>
  );
}