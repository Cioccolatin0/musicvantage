import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell, UserPlus, MessageCircle, Heart, CheckCheck,
  Loader2, Check, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data = { items: [], unread: 0 }, refetch } = trpc.notifications.list.useQuery(
    { limit: 100 },
    { enabled: !!user, refetchInterval: 5000 }
  );

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { refetch(); toast.success("Tutte lette"); },
  });

  const acceptRequestMutation = trpc.friends.acceptRequest.useMutation({
    onSuccess: () => { refetch(); toast.success("Amicizia accettata!"); },
  });

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Accedi per vedere le notifiche</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request": return <UserPlus className="w-5 h-5 text-blue-400" />;
      case "friend_accepted": return <Heart className="w-5 h-5 text-red-400" />;
      case "new_message": return <MessageCircle className="w-5 h-5 text-spotify-green" />;
      default: return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="w-7 h-7 text-spotify-green" />
            Notifiche
            {data.unread > 0 && (
              <span className="text-sm bg-spotify-green text-black px-2 py-0.5 rounded-full font-semibold">
                {data.unread}
              </span>
            )}
          </h1>
          {data.unread > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-1.5 text-xs text-spotify-green hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Leggi tutte
            </button>
          )}
        </div>

        <div className="space-y-2">
          {data.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Nessuna notifica</p>
            </div>
          ) : (
            data.items.map((notif: any) => (
              <div
                key={notif.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  notif.read
                    ? "bg-card border-border/20 opacity-70"
                    : "bg-surface-1 border-spotify-green/20"
                }`}
              >
                <div className="mt-0.5">{getIcon(notif.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.read ? "" : "font-medium"}`}>{notif.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                    {new Date(notif.createdAt).toLocaleDateString("it-IT", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.read && (
                    <button
                      onClick={() => markReadMutation.mutate({ notificationId: notif.id })}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {notif.type === "friend_request" && !notif.read && (
                    <button
                      onClick={() => {
                        acceptRequestMutation.mutate({ requestId: notif.data?.requestId || notif.data?.fromUserId });
                        markReadMutation.mutate({ notificationId: notif.id });
                      }}
                      className="p-1.5 rounded-lg text-spotify-green hover:bg-spotify-green/10 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {notif.type === "new_message" && (
                    <button
                      onClick={() => navigate(`/chat/${notif.data?.conversationId}`)}
                      className="p-1.5 rounded-lg text-spotify-green hover:bg-spotify-green/10 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
