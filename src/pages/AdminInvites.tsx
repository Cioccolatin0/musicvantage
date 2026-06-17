import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { KeyRound, Plus, Copy, Check, Loader2, Clock, CheckCircle2, XCircle, Shield, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminInvites() {
  const { user } = useAuth();
  const [expiresDays, setExpiresDays] = useState(30);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: invites = [], isLoading, refetch } = trpc.auth.listInvites.useQuery(undefined, {
    enabled: !!user,
  });
  const generateMutation = trpc.auth.generateInvite.useMutation({
    onSuccess: () => {
      toast.success("Codice invito generato!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <div className="w-16 h-16 rounded-2xl bg-surface-1 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <p className="text-muted-foreground text-sm">Devi aver effettuato l'accesso per gestire gli inviti</p>
      </div>
    );
  }

  const copyToClipboard = (code: string) => {
    const link = `${window.location.origin}/login?tab=register&code=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedCode(code);
      toast.success("Link copiato!");
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const BASE_URL = window.location.origin;

  return (
    <div className="container py-8 sm:py-12 space-y-8 fade-in">
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-spotify-green/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 spotify-green" strokeWidth={2} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestione Inviti</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Genera codici invito per permettere a nuovi utenti di registrarsi
        </p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-sm">Genera nuovo codice invito</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              className="bg-surface-1 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-spotify-green/30 transition-all"
            >
              <option value={7}>7 giorni</option>
              <option value={14}>14 giorni</option>
              <option value={30}>30 giorni</option>
              <option value={60}>60 giorni</option>
              <option value={90}>90 giorni</option>
              <option value={365}>1 anno</option>
            </select>
          </div>
          <button
            onClick={() => generateMutation.mutate({ expiresInDays: expiresDays })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-spotify-green text-black font-medium text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-60 shadow-lg shadow-green-500/10"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" strokeWidth={2} />
            )}
            Genera invito
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Codici invito ({invites.length})
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin spotify-green" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">Nessun codice invito generato</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...invites].reverse().map((invite: any, i: number) => {
              const isUsed = !!invite.usedBy;
              const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
              const link = `${BASE_URL}/login?tab=register&code=${invite.code}`;

              return (
                <div
                  key={invite.code}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-all fade-in"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isUsed ? "bg-muted/30" : isExpired ? "bg-destructive/10" : "bg-spotify-green/10"
                    }`}>
                      {isUsed ? (
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      ) : isExpired ? (
                        <XCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <KeyRound className="w-4 h-4 spotify-green" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm tracking-wider">{invite.code}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(invite.createdAt).toLocaleDateString("it-IT")}
                        </span>
                        {invite.expiresAt && (
                          <span className={isExpired ? "text-destructive" : ""}>
                            Scade: {new Date(invite.expiresAt).toLocaleDateString("it-IT")}
                          </span>
                        )}
                        {isUsed && (
                          <span className="text-muted-foreground">
                            Usato da: {invite.usedBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isUsed && !isExpired && (
                    <button
                      onClick={() => copyToClipboard(invite.code)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 text-sm hover:border-spotify-green hover:text-spotify-green transition-all duration-200 shrink-0"
                    >
                      {copiedCode === invite.code ? (
                        <Check className="w-4 h-4 text-spotify-green" />
                      ) : (
                        <Copy className="w-4 h-4" strokeWidth={2} />
                      )}
                      {copiedCode === invite.code ? "Copiato!" : "Copia link"}
                    </button>
                  )}
                  {isUsed && (
                    <span className="text-xs text-muted-foreground italic shrink-0">Utilizzato</span>
                  )}
                  {isExpired && !isUsed && (
                    <span className="text-xs text-destructive italic shrink-0">Scaduto</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
