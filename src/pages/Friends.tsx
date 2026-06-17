import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import SafeImg from "@/components/SafeImg";
import FriendActivitySection from "@/components/FriendActivitySection";
import {
  Users, UserPlus, UserCheck, UserX, Search, MessageCircle,
  Loader2, X, Check, Clock, ArrowLeft, Send, Ban
} from "lucide-react";
import { toast } from "sonner";

export default function Friends() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"friends" | "received" | "sent" | "search">("friends");

  const { data: friends = [], refetch: refetchFriends } = trpc.friends.list.useQuery(undefined, { enabled: !!user });
  const { data: received = [], refetch: refetchReceived } = trpc.friends.requests.useQuery(undefined, { enabled: !!user });
  const { data: sent = [], refetch: refetchSent } = trpc.friends.sentRequests.useQuery(undefined, { enabled: !!user });
  const { data: searchResults = [], refetch: refetchSearch } = trpc.friends.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 && !!user, staleTime: 30000 }
  );
  const { data: allUsers = [] } = trpc.friends.all.useQuery(undefined, { enabled: !!user && tab === "search" });
  const { data: friendActivity = [] } = trpc.social.friendActivity.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000,
  });

  const onlineFriendIds = new Set((friendActivity as any[]).map((a: any) => a.userId));

  const sendRequestMutation = trpc.friends.sendRequest.useMutation({
    onSuccess: () => { toast.success("Richiesta inviata!"); refetchSearch(); refetchSent(); },
    onError: (err) => toast.error(err.message),
  });

  const cancelMutation = trpc.friends.cancelRequest.useMutation({
    onSuccess: () => { toast.success("Richiesta annullata"); refetchSent(); },
    onError: (err) => toast.error(err.message),
  });

  const acceptMutation = trpc.friends.acceptRequest.useMutation({
    onSuccess: () => { toast.success("Amicizia accettata!"); refetchReceived(); refetchFriends(); },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.friends.rejectRequest.useMutation({
    onSuccess: () => { toast.success("Richiesta rifiutata"); refetchReceived(); },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.friends.remove.useMutation({
    onSuccess: () => { toast.success("Amico rimosso"); refetchFriends(); },
    onError: (err) => toast.error(err.message),
  });

  const createConvMutation = trpc.chat.getOrCreateConversation.useMutation({
    onSuccess: (data) => { navigate(`/chat/${data.id}`); },
  });

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Accedi per gestire gli amici</p>
      </div>
    );
  }

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-spotify-green" />
          Amici
        </h1>

        <FriendActivitySection />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setTab("search"); }}
            placeholder="Cerca utenti..."
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-spotify-green/30 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-1 rounded-xl w-fit flex-wrap">
          <button
            onClick={() => setTab("friends")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "friends" ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Amici ({friends.length})
          </button>
          <button
            onClick={() => setTab("received")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "received" ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Ricevute ({received.length})
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "sent" ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Inviate ({sent.length})
          </button>
          <button
            onClick={() => setTab("search")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "search" ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Cerca
          </button>
        </div>

        {/* Friends list */}
        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p>Nessun amico ancora</p>
                <p className="text-xs mt-1">Cerca utenti e invia una richiesta di amicizia</p>
              </div>
            ) : (
              friends.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 hover:border-spotify-green/30 transition-all">
                  <button onClick={() => navigate(`/profile/${f.id}`)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative w-10 h-10 rounded-full bg-spotify-green/20 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-spotify-green" />
                      {onlineFriendIds.has(f.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-spotify-green border-2 border-card animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => createConvMutation.mutate({ userId: f.id })}
                    className="p-2 rounded-lg text-muted-foreground hover:text-spotify-green hover:bg-spotify-green/10 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeMutation.mutate({ friendId: f.id })}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Received requests */}
        {tab === "received" && (
          <div className="space-y-2">
            {received.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p>Nessuna richiesta ricevuta</p>
              </div>
            ) : (
              received.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
                  <button onClick={() => navigate(`/profile/${r.fromUserId}`)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.fromUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.fromUser.email}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => acceptMutation.mutate({ requestId: r.id })}
                    className="p-2 rounded-lg text-spotify-green hover:bg-spotify-green/10 transition-colors"
                    title="Accetta"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate({ requestId: r.id })}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Rifiuta"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Sent requests */}
        {tab === "sent" && (
          <div className="space-y-2">
            {sent.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Send className="w-12 h-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p>Nessuna richiesta inviata</p>
                <p className="text-xs mt-1">Cerca utenti e invia richieste di amicizia</p>
              </div>
            ) : (
              sent.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
                  <button onClick={() => navigate(`/profile/${r.toUserId}`)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.toUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.toUser.email}</p>
                    </div>
                  </button>
                  <span className="text-[10px] text-muted-foreground bg-surface-1 px-2 py-1 rounded-full">
                    In attesa
                  </span>
                  <button
                    onClick={() => cancelMutation.mutate({ requestId: r.id })}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Annulla richiesta"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search results */}
        {tab === "search" && (
          <div className="space-y-2">
            {(searchQuery.length >= 2 ? searchResults : allUsers).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30 hover:border-spotify-green/30 transition-all">
                <button onClick={() => navigate(`/profile/${u.id}`)} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-1 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </button>
                <button
                  onClick={() => sendRequestMutation.mutate({ userId: u.id })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-spotify-green/10 text-spotify-green text-xs font-medium hover:bg-spotify-green/20 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Aggiungi
                </button>
              </div>
            ))}
            {(searchQuery.length >= 2 ? searchResults : allUsers).length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p>Nessun utente trovato</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
