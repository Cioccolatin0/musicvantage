import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Trophy, Medal, TrendingUp, Loader2, Zap, Bell } from "lucide-react";
import { toast } from "sonner";
import AdVANTAGEModal from "./AdVANTAGEModal";

interface Props {
  conversationId: number;
  groupName?: string;
}

export default function GroupLeaderboard({ conversationId, groupName }: Props) {
  const [showRecap, setShowRecap] = useState(false);
  const notifyMutation = trpc.vantage.notifyGroupWinner.useMutation({
    onSuccess: (data: any) => {
      if (data) toast.success(`Notifica inviata a tutti! ${data.winner.name} vince questo mese!`);
      else toast.error("Nessun dato per questo mese");
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: leaderboard, isLoading, refetch } = trpc.vantage.groupLeaderboard.useQuery(
    { conversationId },
    { enabled: !!conversationId, refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="p-4 text-center">
        <Zap className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">Nessun dato ancora</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">Ascolta musica per scalare la classifica!</p>
      </div>
    );
  }

  const winner = leaderboard[0];

  return (
    <>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            adVANTAGE
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => notifyMutation.mutate({ conversationId })}
              className="text-[10px] text-muted-foreground hover:text-foreground p-1 rounded hover:bg-surface-1 transition-colors"
              title="Notifica vincitore mensile"
            >
              <Bell className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowRecap(true)}
              className="text-[10px] text-spotify-green hover:underline flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              Recap
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 rounded-xl p-3 border border-amber-500/15">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-amber-400">{winner.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {winner.totalMinutes} min · {winner.totalTracks} brani
              </p>
            </div>
            <span className="text-[10px] font-bold text-amber-400/80">#1</span>
          </div>
        </div>

        {leaderboard.slice(1).map((entry, i) => (
          <div key={entry.userId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-1 transition-colors">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i === 0 ? "bg-zinc-400 text-white" :
              i === 1 ? "bg-amber-700 text-white" :
              "bg-surface-2 text-muted-foreground"
            }`}>
              {entry.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{entry.name}</p>
              <p className="text-[10px] text-muted-foreground">{entry.totalMinutes} min</p>
            </div>
          </div>
        ))}
      </div>

      <AdVANTAGEModal
        open={showRecap}
        onClose={() => setShowRecap(false)}
        conversationId={conversationId}
        groupName={groupName}
      />
    </>
  );
}