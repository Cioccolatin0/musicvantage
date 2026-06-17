import { useEffect, useRef } from "react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { usePlayer } from "@/contexts/PlayerContext";
import type { AppRouter } from "../../routers";
import type { Track } from "@shared/types";

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export default function AutoplayManager() {
  const { setAutoplayCallback } = usePlayer();
  const seenTrackIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAutoplayCallback(async (finishedTrack: Track) => {
      const artists = [finishedTrack.artist].filter(Boolean);
      const title = finishedTrack.title || "";

      try {
        const tracks = await client.music.similarTracks.query({
          artists: artists.length > 0 ? artists : [title],
          trackTitle: title || undefined,
        });
        if (!Array.isArray(tracks)) return [];

        const fresh = tracks.filter((t) => {
          if (seenTrackIds.current.has(t.id)) return false;
          seenTrackIds.current.add(t.id);
          return true;
        });

        if (fresh.length === 0) {
          const fallbackQuery = title.split(" ").slice(0, 3).join(" ");
          if (fallbackQuery) {
            try {
              const fallbackTracks = await client.music.similarTracks.query({
                artists: [fallbackQuery],
              });
              if (Array.isArray(fallbackTracks)) {
                for (const t of fallbackTracks) {
                  if (!seenTrackIds.current.has(t.id)) {
                    seenTrackIds.current.add(t.id);
                    fresh.push(t);
                  }
                }
              }
            } catch {}
          }
        }

        if (seenTrackIds.current.size > 200) {
          seenTrackIds.current = new Set(
            [...seenTrackIds.current].slice(-100)
          );
        }

        return fresh.slice(0, 15);
      } catch {
        return [];
      }
    });
  }, [setAutoplayCallback]);

  return null;
}