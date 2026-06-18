import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function useFriendActivityWs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!user || wsRef.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;
    const url = `${proto}//${wsHost}/ws?userId=${user.id}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "activity") {
          queryClient.setQueryData(["social.friendActivity"], (old: any[] = []) => {
            if (msg.activity) {
              const existing = old.find((a: any) => a.userId === msg.userId);
              if (existing) {
                return old.map((a: any) =>
                  a.userId === msg.userId
                    ? { ...a, trackId: msg.activity.trackId, trackTitle: msg.activity.trackTitle, trackArtist: msg.activity.trackArtist, trackThumbnail: msg.activity.trackThumbnail, startedAt: new Date().toISOString() }
                    : a
                );
              }
              return [...old, { userId: msg.userId, trackId: msg.activity.trackId, trackTitle: msg.activity.trackTitle, trackArtist: msg.activity.trackArtist, trackThumbnail: msg.activity.trackThumbnail, startedAt: new Date().toISOString() }];
            }
            return old;
          });
        } else if (msg.type === "stopped") {
          queryClient.setQueryData(["social.friendActivity"], (old: any[] = []) => {
            return old.filter((a: any) => a.userId !== msg.userId);
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [user, queryClient]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}
