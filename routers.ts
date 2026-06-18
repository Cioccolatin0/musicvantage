import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, getSessionSig } from "./server/_core/cookies";
import { systemRouter } from "./server/_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./server/_core/trpc";
import { z } from "zod";
import { broadcastActivity, getConnectedUserIds } from "./server/ws";
import * as db from "./db";
import * as localAuth from "./server/_core/localAuth";
import { callPythonWorker } from "./server/python-worker";
import { clearPythonWorkerCache, getPythonWorkerCacheSize } from "./server/python-worker";
import * as socialDb from "./server/_core/social-db";
import { getVapidPublicKey } from "./server/_core/push";

function isMixOrCompilation(title: string): boolean {
  const lower = title.toLowerCase();
  const mixKeywords = /\b(mix|playlist|best\s*of|greatest\s*hits|collection|megamix|full\s*album|live\s*set|dj\s*mix|nonstop|continuous\s*mix|nightcore|sped\s*up|slowed\s*down|8d\s*audio|loop|remix\s*202[0-9])\b/i;
  return mixKeywords.test(lower) || /^[^\-]+(\s*[-–|]\s*)?(mix|playlist|best\s*of)/i.test(lower);
}

const pythonCache = new Map<string, { data: unknown; expiry: number }>();
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const searchPrefixCache = new Map<string, { data: unknown; expiry: number }>();

async function callPython(action: string, args: Record<string, unknown>, cacheTtlMs: number = 0): Promise<unknown> {
  const cacheKey = `${action}:${JSON.stringify(args)}`;
  if (cacheTtlMs > 0) {
    const cached = pythonCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  }

  try {
    const result = await callPythonWorker(action, args, cacheTtlMs);
    if (cacheTtlMs > 0) {
      pythonCache.set(cacheKey, { data: result, expiry: Date.now() + cacheTtlMs });
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(msg);
  }
}

// Helper: parse duration strings like "3:06" or "1:02:15" or "3m 45s" to seconds
function parseDurationToSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.floor(v);
  if (typeof v !== "string") return null;
  const s = v.trim();

  // colon separated (HH:MM:SS or MM:SS)
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p.replace(/[^0-9]/g, "")));
    if (parts.every((n) => !Number.isNaN(n))) {
      let sec = 0;
      let mul = 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        sec += (parts[i] || 0) * mul;
        mul *= 60;
      }
      return sec;
    }
  }

  // patterns like "3m 45s", "2 min", "180s"
  const hMatch = s.match(/(\d+)\s*h/i);
  const mMatch = s.match(/(\d+)\s*m/i);
  const secMatch = s.match(/(\d+)\s*s/i);
  if (hMatch || mMatch || secMatch) {
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    const secs = secMatch ? parseInt(secMatch[1], 10) : 0;
    return hours * 3600 + mins * 60 + secs;
  }

  // plain number -> seconds
  const num = Number(s.replace(/[^0-9]/g, ""));
  if (!Number.isNaN(num) && String(num).length > 0) return Math.floor(num);

  return null;
}

function getTrackSeconds(t: any): number {
  if (!t) return Infinity;
  if (typeof t.durationSeconds === "number" && t.durationSeconds > 0) return t.durationSeconds;
  const parsed = parseDurationToSeconds(t.duration ?? t.durationSeconds ?? t.duration); 
  return parsed == null ? Infinity : parsed;
}

// Determine if an album looks like a compilation/toplist/playlist/irrelevant item
function isIrrelevantAlbum(a: any): boolean {
  if (!a) return false;
  const title = (a.title || "").toLowerCase();
  const artist = (a.artist || "").toLowerCase();

  // Artist-level filter
  if (/^various artists$/.test(artist)) return true;

  // Common irrelevant keywords for albums
  const irr = /(various artists|various|compilation|compilations|mixtape|mixtapes|top\s*\d+|top\s*hits|greatest hits|best\s*of|hits|soundtrack|karaoke|kids|children|'s\s*kids|instrumental|background|sleep|study|meditation|relax|hour|one hour|continuous mix|nonstop|mix|playlist)/i;
  if (irr.test(title) || irr.test(artist)) return true;

  return false;
}

// Simple query match for albums: ensure album title/artist contains the query substring
function albumMatchesQuery(a: any, q?: string) {
  if (!q || q.trim().length === 0) return true;
  const qq = q.toLowerCase().trim();
  const hay = ((a.title || "") + " " + (a.artist || "")).toLowerCase();
  return hay.includes(qq);
}

function withMaxDuration(data: { tracks?: any[]; artists?: any[]; albums?: any[] }, maxSeconds = 300, query?: string) {
  if (!data) return { tracks: [], artists: data?.artists || [], albums: data?.albums || [] };
  const tracks = Array.isArray(data.tracks) ? data.tracks.filter((t) => getTrackSeconds(t) <= maxSeconds) : [];
  const albums = Array.isArray(data.albums)
    ? data.albums.filter((a) => !isIrrelevantAlbum(a) && albumMatchesQuery(a, query))
    : [];
  return { tracks, artists: data.artists || [], albums };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ?? null),

    // Return the first unused invite code when no users exist (first-run setup)
    defaultInvite: publicProcedure.query(async () => {
      try {
        const users = await localAuth.getUsers?.() ?? [];
        if (users.length > 0) return { code: null };
        const codes = await localAuth.getInviteCodes();
        const unused = codes.find((c) => !c.usedBy);
        return { code: unused?.code ?? null };
      } catch {
        return { code: null };
      }
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return { success: true } as const;
    }),

    // Validate invite code
    validateInvite: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return await localAuth.validateInviteCode(input.code);
      }),

    // Register with invite code
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(2).max(50),
        password: z.string().min(6).max(100),
        inviteCode: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await localAuth.registerUser(input.email, input.name, input.password, input.inviteCode);

        const sessionPayload = Buffer.from(
          JSON.stringify({ userId: user.id, email: user.email, name: user.name, sig: getSessionSig(user.id, user.email) })
        ).toString("base64");

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionPayload, cookieOptions);
        return { id: user.id, email: user.email, name: user.name };
      }),

    // Login with email + password
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await localAuth.loginUser(input.email, input.password);

        const sessionPayload = Buffer.from(
          JSON.stringify({ userId: user.id, email: user.email, name: user.name, sig: getSessionSig(user.id, user.email) })
        ).toString("base64");

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionPayload, cookieOptions);
        return { id: user.id, email: user.email, name: user.name };
      }),

    // Generate invite code (protected - owners/admins only)
    generateInvite: protectedProcedure
      .input(z.object({
        expiresInDays: z.number().min(1).max(365).optional().default(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const userEmail = ctx.user?.email || ctx.user?.openId || "unknown";
        const code = await localAuth.generateInviteCode(userEmail, input.expiresInDays);
        return code;
      }),

    // List invite codes (protected)
    listInvites: protectedProcedure
      .query(async () => {
        return await localAuth.getInviteCodes();
      }),
  }),

  music: router({
    // Search tracks, artists, albums
    search: publicProcedure
      .input(
        z.object({
          query: z.string().min(1),
          filter: z.enum(["songs", "artists", "albums"]).optional(),
        })
      )
      .query(async ({ input }) => {
        const result = await callPython("search", {
          query: input.query,
          filter: input.filter,
        }, 5 * 60 * 1000) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
        // enforce max duration 5 minutes on tracks and filter albums by query
        const filtered = withMaxDuration(result, 300, input.query);
        if (filtered.tracks) filtered.tracks = filtered.tracks.slice(0, 25);
        return filtered as { tracks: Track[]; artists: Artist[]; albums: Album[] };
      }),

    // Fast unified search - single call for songs + artists + albums
    searchAll: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        console.log(`[tRPC] music.searchAll called with query="${input.query}"`);
        const q = input.query.toLowerCase().trim();
        const cacheKey = `searchAll:${q}`;

        // Exact match cache - return filtered result if available
        const cached = pythonCache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return withMaxDuration(cached.data as { tracks?: Track[]; artists?: Artist[]; albums?: Album[] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
        }

        // Prefix match: if user typed "beatl", check if "beatles" is cached
        // Use best (longest) prefix match for most accurate results
        let bestPrefixMatch: { data: unknown; expiry: number } | null = null;
        let bestPrefixLen = 0;
        for (const [key, val] of searchPrefixCache.entries()) {
          if (key.length > q.length && key.startsWith(q) && val.expiry > Date.now()) {
            if (key.length > bestPrefixLen) {
              bestPrefixLen = key.length;
              bestPrefixMatch = val;
            }
          }
        }
        if (bestPrefixMatch) {
          return withMaxDuration(bestPrefixMatch.data as { tracks?: Track[]; artists?: Artist[]; albums?: Album[] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
        }

        // If a shorter cached query is a prefix of q and returned 0 results,
        // don't bother querying Python - extensions will also be empty
        for (const [key, val] of searchPrefixCache.entries()) {
          if (q.startsWith(key) && val.expiry > Date.now()) {
            const d = val.data as any;
            const totalResults = (d?.tracks?.length || 0) + (d?.artists?.length || 0);
            if (totalResults === 0) {
              return withMaxDuration({ tracks: [], artists: [], albums: [] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
            }
          }
        }

        const result = await callPython("search_all", { query: input.query }, SEARCH_CACHE_TTL) as {
          tracks: Track[]; artists: Artist[]; albums: Album[];
        };
        pythonCache.set(cacheKey, { data: result, expiry: Date.now() + SEARCH_CACHE_TTL });

        // Log result sizes for debugging search issues and show top artist if present
        try {
          const t = Array.isArray(result.tracks) ? result.tracks.length : 0;
          const a = Array.isArray(result.artists) ? result.artists.length : 0;
          const al = Array.isArray(result.albums) ? result.albums.length : 0;
          const topArtist = Array.isArray(result.artists) && result.artists[0] ? result.artists[0].name : null;
          console.log(`[tRPC] music.searchAll result for "${input.query}": tracks=${t} artists=${a} albums=${al} topArtist=${topArtist}`);
        } catch (e) {
          /* ignore logging errors */
        }

        // Store in prefix cache so shorter prefixes can find this result
        searchPrefixCache.set(q, { data: result, expiry: Date.now() + SEARCH_CACHE_TTL });

        // Trim prefix cache if too large
        if (searchPrefixCache.size > 400) {
          const firstKey = searchPrefixCache.keys().next().value;
          if (firstKey) searchPrefixCache.delete(firstKey);
        }

        // Attempt to detect if the query is an artist name and promote that artist to the top
        // Work on a shallow copy so we don't mutate the cached raw result
        const processed: { tracks?: Track[]; artists?: any[]; albums?: any[] } = {
          tracks: Array.isArray(result.tracks) ? result.tracks : [],
          artists: Array.isArray(result.artists) ? result.artists.slice() : [],
          albums: Array.isArray(result.albums) ? result.albums : [],
        };

        let promotedArtist: any = null;
        try {
          const qn = q;

          // 1) Check existing artist list for a close match and move to front
          if (processed.artists && processed.artists.length > 0) {
            const idx = processed.artists.findIndex((a: any) => {
              const name = (a?.name || "").toLowerCase().trim();
              return name === qn || (qn.length > 2 && name.includes(qn));
            });
            if (idx > 0) {
              const [a] = processed.artists.splice(idx, 1);
              processed.artists.unshift(a);
              promotedArtist = a;
            }
          }

          // 2) If nothing found, try to deduce an artist from the track list
          if (!promotedArtist && processed.tracks && processed.tracks.length > 0) {
            const counts = new Map<string, { name: string; count: number; thumb?: string }>();
            for (const t of processed.tracks) {
              const raw = (t?.artist || t?.trackArtist || "").toString();
              if (!raw) continue;
              // split on common featuring / separators and take the primary artist
              const main = raw.split(/,|feat\.|featuring|ft\.|\&| x | vs | vs\.| - |:/i)[0].trim();
              if (!main) continue;
              const key = main.toLowerCase();
              const cur = counts.get(key) || { name: main, count: 0, thumb: t?.thumbnail || t?.trackThumbnail };
              cur.count++;
              if (!cur.thumb && (t?.thumbnail || t?.trackThumbnail)) cur.thumb = t.thumbnail || t.trackThumbnail;
              counts.set(key, cur);
            }

            let best: { name: string; count: number; thumb?: string } | null = null;
            for (const v of counts.values()) {
              if (!best || v.count > best.count) best = v;
            }

            if (best) {
              const qualifiesByName = qn.length > 0 && best.name.toLowerCase().includes(qn);
              const majority = best.count >= Math.max(2, Math.ceil(processed.tracks.length / 2));
              if (qualifiesByName || majority) {
                // If artist already exists in the artists array, promote it
                const exists = processed.artists.findIndex((a: any) => (a?.name || "").toLowerCase().trim() === best!.name.toLowerCase().trim());
                if (exists === -1) {
                  // Insert a lightweight artist object constructed from track data
                  processed.artists.unshift({ id: null, name: best.name, thumbnail: best.thumb || null });
                } else if (exists > 0) {
                  const [a] = processed.artists.splice(exists, 1);
                  processed.artists.unshift(a);
                }
                promotedArtist = processed.artists[0];
              }
            }
          }
        } catch (e) {
          // non-fatal
        }

        if (promotedArtist) {
          try {
            console.log(`[tRPC] music.searchAll promotedArtist for "${input.query}": ${promotedArtist.name || promotedArtist.id || "unknown"}`);
          } catch (_) {}
        }

        // filter tracks to max 5 minutes and filter albums using the query
        return withMaxDuration(processed, 300, q);
      }),

    // Suggestions endpoint: returns cached results for autocomplete
    searchSuggestions: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        console.log(`[tRPC] music.searchSuggestions called with query="${input.query}"`);
        const q = input.query.toLowerCase().trim();
        const cacheKey = `searchAll:${q}`;

        // Check exact cache first - return filtered
        const cached = pythonCache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          return withMaxDuration(cached.data as { tracks?: Track[]; artists?: Artist[]; albums?: Album[] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
        }

        // Smart prefix cache: if ANY longer cached query starts with q, return it
        // e.g. if "shiva" is cached and query is "shiv", use shiva's results
        let bestPrefixMatch: { data: unknown; expiry: number } | null = null;
        let bestPrefixLen = 0;
        for (const [key, val] of searchPrefixCache.entries()) {
          if (key.length > q.length && key.startsWith(q) && val.expiry > Date.now()) {
            if (key.length > bestPrefixLen) {
              bestPrefixLen = key.length;
              bestPrefixMatch = val;
            }
          }
        }
        if (bestPrefixMatch) {
          return withMaxDuration(bestPrefixMatch.data as { tracks?: Track[]; artists?: Artist[]; albums?: Album[] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
        }

        // If a shorter cached query is a prefix of q and returned 0 results,
        // don't bother querying Python - extensions will also be empty
        for (const [key, val] of searchPrefixCache.entries()) {
          if (q.startsWith(key) && val.expiry > Date.now()) {
            const d = val.data as any;
            const totalResults = (d?.tracks?.length || 0) + (d?.artists?.length || 0);
            if (totalResults === 0) {
              // Parent query had no results, this extension likely won't either
              return withMaxDuration({ tracks: [], artists: [], albums: [] }, 300, q) as { tracks: Track[]; artists: Artist[]; albums: Album[] };
            }
          }
        }

        // Fall through to lightweight search (2 API calls instead of 5)
        const result = await callPython("search_quick", { query: input.query }, SEARCH_CACHE_TTL) as {
          tracks: Track[]; artists: Artist[]; albums: Album[];
        };
        pythonCache.set(cacheKey, { data: result, expiry: Date.now() + SEARCH_CACHE_TTL });
        searchPrefixCache.set(q, { data: result, expiry: Date.now() + SEARCH_CACHE_TTL });

        try {
          const t = Array.isArray(result.tracks) ? result.tracks.length : 0;
          const a = Array.isArray(result.artists) ? result.artists.length : 0;
          const al = Array.isArray(result.albums) ? result.albums.length : 0;
          console.log(`[tRPC] music.searchSuggestions result for "${input.query}": tracks=${t} artists=${a} albums=${al}`);
        } catch (_) {}

        // Trim prefix cache if too large
        if (searchPrefixCache.size > 400) {
          const firstKey = searchPrefixCache.keys().next().value;
          if (firstKey) searchPrefixCache.delete(firstKey);
        }

        return withMaxDuration(result, 300);
      }),

    // Ultra-fast suggestions: returns text-only suggestions from YouTube autocomplete (single POST, ~200ms)
    searchSuggestionsFast: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await callPython("search_suggestions_fast", { query: input.query }, 10 * 60 * 1000) as { suggestions: string[] };
        return result;
      }),

    // Prefetch endpoint: fire background searches to warm cache
    searchPrefetch: publicProcedure
      .input(z.object({ queries: z.array(z.string()).min(1).max(10) }))
      .mutation(async ({ input }) => {
        // Fire-and-forget: don't await, just warm the cache in background
        callPython("prefetch", { queries: input.queries }, 0).catch(() => {});
        return { ok: true };
      }),

    searchVideos: publicProcedure
      .input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(20).optional() }))
      .query(async ({ input }) => {
        const result = await callPython("search_videos", {
          query: input.query,
          limit: input.limit || 6,
        }, 30 * 1000);
        return result as { id: string; title: string; artist: string; thumbnail: string; duration: string; viewCount: string; type: string }[];
      }),

    getLyrics: publicProcedure
      .input(z.object({ videoId: z.string().min(1), title: z.string().optional(), artist: z.string().optional(), album: z.string().optional(), duration: z.number().optional() }))
      .query(async ({ input }) => {
        // Cache lyrics for a long duration - lyrics rarely change and this
        // avoids re-fetching them on every track change which causes long delays
        const LYRICS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
        const result = await callPython("get_lyrics", {
          videoId: input.videoId,
          title: input.title || "",
          artist: input.artist || "",
          album: input.album || "",
          duration: input.duration || 0,
        }, LYRICS_CACHE_TTL);
        return result as { lyrics: string | { text: string; start: number; duration: number }[] | null; source: string | null; hasTimestamps: boolean };
      }),

    home: publicProcedure.query(async () => {
      const result = await callPython("home", {}, 5 * 60 * 1000) as {
        trending: Track[];
        newAlbums: Album[];
        featuredArtists: Artist[];
      };
      // Filter out irrelevant albums (compilations, top lists, kids, etc.)
      const newAlbums = Array.isArray(result.newAlbums) ? result.newAlbums.filter((a) => !isIrrelevantAlbum(a)) : [];
      return { trending: result.trending || [], newAlbums, featuredArtists: result.featuredArtists || [] };
    }),

    personalizedHome: protectedProcedure.query(async ({ ctx }) => {
      const history = await db.getListeningHistory(ctx.user.id, 200);
      const playlists = await db.getUserPlaylists(ctx.user.id);
      const followedArtists = await db.getFollowedArtists(ctx.user.id);
      const userFavorites = await db.getUserFavorites(ctx.user.id);

      // Build weighted artist map: favorites count as 3x, history as 1x
      const artistCounts = new Map<string, number>();
      for (const h of history) {
        const artist = h.trackArtist || "Unknown";
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      }
      for (const fav of userFavorites) {
        const artist = fav.trackArtist || "Unknown";
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 3);
      }
      const topArtists = [...artistCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([artist]) => artist);

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentTracks = history.filter((h) => h.playedAt >= oneWeekAgo);
      const monthlyTracks = history.filter((h) => h.playedAt >= oneMonthAgo);

      const playlistTrackIds = new Set<string>();
      for (const pl of playlists) {
        const tracks = await db.getPlaylistTracks(pl.id);
        for (const t of tracks) playlistTrackIds.add(t.trackId);
      }

      const seenIds = new Set<string>();
      const allResults: Track[] = [];

      // Collect top 3 unique track+artist pairs from history
      const usedHistoryPairs = new Set<string>();
      const historyPairs: { title: string; artist: string }[] = [];
      for (const h of history) {
        const key = `${h.trackTitle}|${h.trackArtist}`;
        if (!usedHistoryPairs.has(key) && h.trackTitle && h.trackArtist) {
          usedHistoryPairs.add(key);
          historyPairs.push({ title: h.trackTitle, artist: h.trackArtist });
        }
        if (historyPairs.length >= 3) break;
      }

      // Collect unique favorite artists for searches
      const favArtistSet = new Set<string>();
      for (const fav of userFavorites) {
        if (fav.trackArtist) favArtistSet.add(fav.trackArtist);
      }
      const favArtists = [...favArtistSet].slice(0, 8);

      // Parallel searches: history pairs + followed artists + favorites + top artists + home fallback
      const searchPromises: Promise<unknown>[] = [];

      for (const pair of historyPairs) {
        searchPromises.push(
          callPython("search", { query: `${pair.title} ${pair.artist}`, filter: "songs" }, 5 * 60 * 1000)
        );
      }

      // Boost followed artists - search their names
      for (const fa of followedArtists.slice(0, 5)) {
        searchPromises.push(
          callPython("search", { query: fa.artistName, filter: "songs" }, 5 * 60 * 1000)
        );
      }

      // Boost favorite artists - heavier weight by searching more of them
      for (const favArtist of favArtists.slice(0, 8)) {
        if (!followedArtists.some((f) => f.artistName.toLowerCase() === favArtist.toLowerCase())) {
          searchPromises.push(
            callPython("search", { query: favArtist, filter: "songs" }, 5 * 60 * 1000)
          );
        }
      }

      // Also search by favorite track titles + artists for similar songs
      const favTitlePairs = new Set<string>();
      for (const fav of userFavorites.slice(0, 5)) {
        if (fav.trackTitle && fav.trackArtist) {
          const key = `${fav.trackTitle}|${fav.trackArtist}`;
          if (!favTitlePairs.has(key)) {
            favTitlePairs.add(key);
            searchPromises.push(
              callPython("search", { query: `${fav.trackTitle} ${fav.trackArtist}`, filter: "songs" }, 5 * 60 * 1000)
            );
          }
        }
      }

      for (const artist of topArtists.slice(0, 3)) {
        if (!followedArtists.some((f) => f.artistName.toLowerCase() === artist.toLowerCase()) && !favArtists.some((a) => a.toLowerCase() === artist.toLowerCase())) {
          searchPromises.push(
            callPython("search", { query: artist, filter: "songs" }, 5 * 60 * 1000)
          );
        }
      }

      // Home fallback in parallel too
      searchPromises.push(callPython("home", {}, 5 * 60 * 1000));

      const settledResults = await Promise.allSettled(searchPromises);

      // Track which results came from followed artists or favorites
      const followedTracks: Track[] = [];
      const favoriteTracks: Track[] = [];

      const favArtistLower = new Set(favArtists.map((a) => a.toLowerCase()));

      for (const result of settledResults) {
        if (result.status === "rejected") continue;
        const data = result.value as Record<string, unknown>;
        let items: Track[] = [];
        if (Array.isArray(data.tracks)) {
          items = data.tracks as Track[];
        } else if (Array.isArray(data.trending)) {
          items = data.trending as Track[];
        }
        for (const t of items) {
          if (!seenIds.has(t.id) && !playlistTrackIds.has(t.id) && !isMixOrCompilation(t.title)) {
            seenIds.add(t.id);
            allResults.push(t);
            if (followedArtists.some((f) => t.artist?.toLowerCase().includes(f.artistName.toLowerCase()))) {
              followedTracks.push(t);
            } else if (t.artist && favArtistLower.has(t.artist.toLowerCase())) {
              favoriteTracks.push(t);
            }
          }
        }
      }

      // Prioritize: followed artists > favorites > rest
      const rest = allResults.filter(
        (t) => !followedTracks.some((ft) => ft.id === t.id) && !favoriteTracks.some((ft) => ft.id === t.id)
      );
      const prioritized = [...followedTracks, ...favoriteTracks, ...rest];

      const half = Math.ceil(prioritized.length / 2);
      const mixTracks = prioritized.slice(0, half);
      const suggestions = prioritized.slice(half, half + 15);

      return {
        mixTracks: mixTracks.slice(0, 20),
        recentTracks: recentTracks.slice(0, 10),
        monthlyTracks: monthlyTracks.slice(0, 10),
        suggestions: suggestions.slice(0, 10),
        topArtists,
        followedArtists: followedArtists.slice(0, 5).map((f) => ({ id: f.artistId, name: f.artistName, thumbnail: f.artistThumbnail })),
      };
    }),

    artist: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const result = await callPython("artist", { id: input.id }, 10 * 60 * 1000) as ArtistDetail;
        // Filter artist albums/singles for relevancy
        if (Array.isArray(result.albums)) result.albums = result.albums.filter((a) => !isIrrelevantAlbum(a));
        if (Array.isArray(result.singles)) result.singles = result.singles.filter((a) => !isIrrelevantAlbum(a));
        return result as ArtistDetail;
      }),

    album: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const result = await callPython("album", { id: input.id }, 10 * 60 * 1000);
        return result as AlbumDetail;
      }),

    audioUrl: publicProcedure
      .input(z.object({ videoId: z.string() }))
      .query(async ({ input }) => {
        const result = await callPython("audio_url", { videoId: input.videoId });
        return result as { url: string; videoId: string };
      }),

    importPlaylist: publicProcedure
      .input(z.object({ url: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await callPython("import_playlist", { url: input.url }) as Record<string, unknown>;
        if (result.error) throw new Error(result.error as string);
        return result as { tracks: Track[]; errors: string[]; total: number; found: number; playlistName?: string; playlistThumbnail?: string };
      }),

    similarTracks: protectedProcedure
      .input(z.object({ artists: z.array(z.string()), trackTitle: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const seen = new Set<string>();
        const allTrackResults: Track[] = [];

        // Fetch user favorites for similarity boost
        const userFavorites = await db.getUserFavorites(ctx.user.id);
        const favArtistSet = new Set<string>();
        for (const fav of userFavorites) {
          if (fav.trackArtist) favArtistSet.add(fav.trackArtist.toLowerCase());
        }

        // Build parallel queries
        const queryPromises: Promise<unknown>[] = [];

        if (input.trackTitle) {
          for (const artist of input.artists.slice(0, 3)) {
            queryPromises.push(
              callPython("search", { query: `${input.trackTitle} ${artist}`, filter: "songs" }, 5 * 60 * 1000)
            );
          }
        }
        for (const artist of input.artists.slice(0, 5)) {
          queryPromises.push(
            callPython("search", { query: artist, filter: "songs" }, 5 * 60 * 1000)
          );
        }

        // Search favorite artists that are similar to the current track's artists
        const inputArtistsLower = input.artists.map((a) => a.toLowerCase());
        for (const favArtist of favArtistSet) {
          if (!inputArtistsLower.some((a) => favArtist.includes(a) || a.includes(favArtist))) {
            // Only add searches for favorites that are somewhat related
            // (skip completely unrelated artists to avoid noise)
          }
        }

        // Add searches for top favorite artists to get more similar content
        const favArtistCounts = new Map<string, number>();
        for (const fav of userFavorites) {
          if (fav.trackArtist) {
            favArtistCounts.set(fav.trackArtist, (favArtistCounts.get(fav.trackArtist) || 0) + 1);
          }
        }
        const topFavArtists = [...favArtistCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([artist]) => artist);

        for (const favArtist of topFavArtists) {
          if (!input.artists.some((a) => a.toLowerCase() === favArtist.toLowerCase())) {
            queryPromises.push(
              callPython("search", { query: favArtist, filter: "songs" }, 5 * 60 * 1000)
            );
          }
        }

        // Add home fallback
        queryPromises.push(callPython("home", {}, 5 * 60 * 1000));

        const settledResults = await Promise.allSettled(queryPromises);

        // Separate tracks by whether they match favorite artists
        const favoriteArtistTracks: Track[] = [];
        const otherTracks: Track[] = [];

        for (const result of settledResults) {
          if (result.status === "rejected") continue;
          const data = result.value as Record<string, unknown>;
          const items: Track[] = [];
          if (Array.isArray(data.tracks)) items.push(...data.tracks as Track[]);
          if (Array.isArray(data.trending)) items.push(...data.trending as Track[]);
          for (const t of items) {
            if (!seen.has(t.id) && !isMixOrCompilation(t.title)) {
              seen.add(t.id);
              if (t.artist && favArtistSet.has(t.artist.toLowerCase())) {
                favoriteArtistTracks.push(t);
              } else {
                otherTracks.push(t);
              }
            }
          }
        }

        // Prioritize tracks from favorite artists
        allTrackResults.push(...favoriteArtistTracks, ...otherTracks);

        // If not enough tracks, do fallback genre searches
        if (allTrackResults.length < 10) {
          const fallbackPromises = ["pop music 2025", "rock hits", "hip hop", "electronic", "r&b"]
            .map((q) =>
              callPython("search", { query: q, filter: "songs" }, 5 * 60 * 1000)
            );
          const fbResults = await Promise.allSettled(fallbackPromises);
          for (const fb of fbResults) {
            if (fb.status === "rejected") continue;
            const fbData = fb.value as Record<string, unknown>;
            const fbTracks: Track[] = [];
            if (Array.isArray(fbData.tracks)) fbTracks.push(...fbData.tracks as Track[]);
            for (const t of fbTracks) {
              if (!seen.has(t.id) && !isMixOrCompilation(t.title)) {
                seen.add(t.id);
                allTrackResults.push(t);
              }
            }
          }
        }

        return allTrackResults;
      }),
  }),

  // Admin utilities (protected): cache invalidation and basic status
  admin: router({
    // Clear server-side caches and ask the python worker to remove its disk cache
    clearCaches: protectedProcedure.mutation(async () => {
      try {
        pythonCache.clear();
      } catch (_) {}
      try {
        searchPrefixCache.clear();
      } catch (_) {}

      // Ask python worker to clear its on-disk search cache if present. Fire-and-forget style.
      try {
        await callPython("clear_search_cache", {}, 0);
      } catch (_) {}

      // Also clear node-side pythonWorkerCache if any
      try {
        clearPythonWorkerCache();
      } catch (_) {}

      return { ok: true };
    }),

    // Return sizes of in-memory caches for diagnostics
    cacheStatus: protectedProcedure.query(async () => {
      return {
        pythonCacheSize: pythonCache.size,
        searchPrefixCacheSize: searchPrefixCache.size,
        pythonWorkerCacheSize: getPythonWorkerCacheSize(),
      };
    }),
  }),

  // Library routes (playlists, favorites, history)
  library: router({
    // Get user playlists
    playlists: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPlaylists(ctx.user.id);
    }),

    // Get user playlists with track counts
    playlistsSummary: protectedProcedure
      .input(z.object({ trackId: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        try {
          const playlists = await db.getUserPlaylists(ctx.user.id);
          const result: any[] = [];
          for (const pl of playlists) {
            try {
              const tracks = await db.getPlaylistTracks(pl.id);
              const trackCount = Array.isArray(tracks) ? tracks.length : 0;
              const hasTrack = input.trackId && Array.isArray(tracks) ? tracks.some((t: any) => t.trackId === input.trackId) : false;
              result.push({ ...pl, trackCount, hasTrack });
            } catch {
              result.push({ ...pl, trackCount: 0, hasTrack: false });
            }
          }
          return result;
        } catch (e) {
          console.error("[playlistsSummary] error:", e);
          return [];
        }
      }),

    // Create playlist
    createPlaylist: protectedProcedure
      .input(z.object({ name: z.string(), description: z.string().optional(), thumbnail: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createPlaylist(ctx.user.id, {
          name: input.name,
          description: input.description || undefined,
          thumbnail: input.thumbnail || undefined,
        } as any);
      }),

    // Delete playlist
    deletePlaylist: protectedProcedure
      .input(z.object({ playlistId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deletePlaylist(input.playlistId, ctx.user.id);
      }),

    // Update playlist (name, description, thumbnail)
    updatePlaylist: protectedProcedure
      .input(z.object({
        playlistId: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        thumbnail: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.updatePlaylist(input.playlistId, ctx.user.id, {
          name: input.name,
          description: input.description,
          thumbnail: input.thumbnail,
        });
      }),

    // Reorder playlist tracks
    reorderPlaylistTracks: protectedProcedure
      .input(z.object({
        playlistId: z.number(),
        trackIds: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.reorderPlaylistTracks(input.playlistId, input.trackIds);
      }),

    // Get playlist tracks
    playlistTracks: protectedProcedure
      .input(z.object({ playlistId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPlaylistTracks(input.playlistId);
      }),

    // Add track to playlist
    addTrackToPlaylist: protectedProcedure
      .input(z.object({
        playlistId: z.number(),
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackAlbum: z.string().optional(),
        trackThumbnail: z.string().optional(),
        trackDuration: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.addTrackToPlaylist(input.playlistId, {
          trackId: input.trackId,
          trackTitle: input.trackTitle,
          trackArtist: input.trackArtist,
          trackAlbum: input.trackAlbum || undefined,
          trackThumbnail: input.trackThumbnail || undefined,
          trackDuration: input.trackDuration || undefined,
        } as any);
      }),

    // Remove track from playlist
    removeTrackFromPlaylist: protectedProcedure
      .input(z.object({ playlistId: z.number(), trackId: z.string() }))
      .mutation(async ({ input }) => {
        return await db.removeTrackFromPlaylist(input.trackId, input.playlistId);
      }),

    // Batch add tracks to playlist
    addTracksToPlaylist: protectedProcedure
      .input(z.object({
        playlistId: z.number(),
        tracks: z.array(z.object({
          trackId: z.string(),
          trackTitle: z.string(),
          trackArtist: z.string(),
          trackAlbum: z.string().optional(),
          trackThumbnail: z.string().optional(),
          trackDuration: z.number().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        return await db.addTracksToPlaylist(input.playlistId, input.tracks.map(t => ({
          trackId: t.trackId,
          trackTitle: t.trackTitle,
          trackArtist: t.trackArtist,
          trackAlbum: t.trackAlbum || undefined,
          trackThumbnail: t.trackThumbnail || undefined,
          trackDuration: t.trackDuration || undefined,
        })) as any);
      }),

    // Get user favorites
    favorites: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserFavorites(ctx.user.id);
    }),

    // Add to favorites
    addToFavorites: protectedProcedure
      .input(z.object({
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string().optional(),
        trackDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.addToFavorites(ctx.user.id, {
          trackId: input.trackId,
          trackTitle: input.trackTitle,
          trackArtist: input.trackArtist,
          trackThumbnail: input.trackThumbnail || undefined,
          trackDuration: input.trackDuration || undefined,
        } as any);
      }),

    // Remove from favorites
    removeFromFavorites: protectedProcedure
      .input(z.object({ trackId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.removeFromFavorites(ctx.user.id, input.trackId);
      }),

    // Check if track is favorite
    isFavorite: protectedProcedure
      .input(z.object({ trackId: z.string() }))
      .query(async ({ ctx, input }) => {
        return await db.isFavorite(ctx.user.id, input.trackId);
      }),

    // Follow an artist
    followArtist: protectedProcedure
      .input(z.object({ artistId: z.string(), artistName: z.string(), artistThumbnail: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.followArtist(ctx.user.id, input.artistId, input.artistName, input.artistThumbnail);
      }),

    // Unfollow an artist
    unfollowArtist: protectedProcedure
      .input(z.object({ artistId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.unfollowArtist(ctx.user.id, input.artistId);
      }),

    // Check if following an artist
    isFollowingArtist: protectedProcedure
      .input(z.object({ artistId: z.string() }))
      .query(async ({ ctx, input }) => {
        return await db.isFollowingArtist(ctx.user.id, input.artistId);
      }),

    // Get all followed artists
    followedArtists: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getFollowedArtists(ctx.user.id);
      }),

    // Get listening history
    history: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        return await db.getListeningHistory(ctx.user.id, input.limit);
      }),

    // Add to listening history
    addToHistory: protectedProcedure
      .input(z.object({
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string().optional(),
        trackDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.addToListeningHistory(ctx.user.id, {
          trackId: input.trackId,
          trackTitle: input.trackTitle,
          trackArtist: input.trackArtist,
          trackThumbnail: input.trackThumbnail || undefined,
          trackDuration: input.trackDuration || undefined,
        } as any);
      }),

    // Share playlist - generate share code
    sharePlaylist: protectedProcedure
      .input(z.object({ playlistId: z.number() }))
      .mutation(async ({ input }) => {
        const code = await db.generateShareCode(input.playlistId);
        return { code };
      }),

    // Get shared playlist by code
    getSharedPlaylist: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return await db.getPlaylistByShareCode(input.code);
      }),

    // List all shared playlists
    allSharedPlaylists: publicProcedure
      .query(async () => {
        return await db.getAllSharedPlaylists();
      }),

    // Share playlist as collaborative
    shareCollaborative: protectedProcedure
      .input(z.object({ playlistId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const code = await db.generateCollaborativeCode(input.playlistId, ctx.user.id, ctx.user.name || "Anonimo");
        return { code };
      }),

    // Add collaborator to collaborative playlist
    joinCollaborative: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await db.addCollaborator(input.code, ctx.user.id);
        if (!ok) throw new Error("Codice non valido o playlist non collaborativa");
        return { success: true };
      }),

    // Add track to collaborative playlist
    addTrackToCollaborative: protectedProcedure
      .input(z.object({
        code: z.string(),
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackAlbum: z.string().optional(),
        trackThumbnail: z.string().optional(),
        trackDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.addTrackToCollaborativePlaylist(
          input.code,
          {
            trackId: input.trackId,
            trackTitle: input.trackTitle,
            trackArtist: input.trackArtist,
            trackAlbum: input.trackAlbum || undefined,
            trackThumbnail: input.trackThumbnail || null,
            trackDuration: input.trackDuration || null,
          },
          ctx.user.id,
          ctx.user.name || "Anonimo"
        );
        if (!result) throw new Error("Non sei un collaboratore di questa playlist");
        return result;
      }),

    // Remove track from collaborative playlist
    removeTrackFromCollaborative: protectedProcedure
      .input(z.object({ code: z.string(), trackId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await db.removeTrackFromCollaborativePlaylist(input.code, input.trackId, ctx.user.id);
        if (!ok) throw new Error("Non puoi rimuovere brani da questa playlist");
        return { success: true };
      }),
  }),

  // JAM sessions
  jam: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(50),
        durationMinutes: z.number().min(10).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createJamSession(
          ctx.user.id,
          ctx.user.name || "Anonimo",
          input.name,
          input.durationMinutes
        );
      }),

    join: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.joinJamSession(
          input.code,
          ctx.user.id,
          ctx.user.name || "Anonimo"
        );
        if (!session) throw new Error("JAM non trovata o già terminata");
        return session;
      }),

    leave: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.leaveJamSession(input.code, ctx.user.id);
      }),

    start: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input }) => {
        const session = await db.startJamSession(input.code);
        if (!session) throw new Error("Impossibile avviare la JAM");
        return session;
      }),

    get: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return await db.getJamSession(input.code);
      }),

    mySessions: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserJamSessions(ctx.user.id);
      }),

    addTrack: protectedProcedure
      .input(z.object({
        code: z.string(),
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.addTrackToJamSession(
          input.code,
          {
            trackId: input.trackId,
            trackTitle: input.trackTitle,
            trackArtist: input.trackArtist,
            trackThumbnail: input.trackThumbnail,
          },
          ctx.user.id
        );
      }),

    end: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ input }) => {
        return await db.endJamSession(input.code);
      }),
  }),

  // =========== PROFILES ===========
  profile: router({
    get: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return socialDb.getPublicProfile(input.userId);
      }),

    update: protectedProcedure
      .input(z.object({
        photo: z.string().optional(),
        banner: z.string().optional(),
        bio: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.upsertProfile(ctx.user.id, input);
      }),

    myProfile: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getPublicProfile(ctx.user.id);
      }),
  }),

  // =========== FRIENDS ===========
  friends: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        return socialDb.searchUsers(input.query, ctx.user.id);
      }),

    all: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getAllUsers(ctx.user.id);
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getFriends(ctx.user.id);
      }),

    requests: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getFriendRequests(ctx.user.id);
      }),

    sentRequests: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getSentRequests(ctx.user.id);
      }),

    sendRequest: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.sendFriendRequest(ctx.user.id, input.userId);
      }),

    cancelRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.cancelFriendRequest(input.requestId, ctx.user.id);
      }),

    acceptRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.acceptFriendRequest(input.requestId, ctx.user.id);
      }),

    rejectRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.rejectFriendRequest(input.requestId, ctx.user.id);
      }),

    status: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        return socialDb.getFriendStatus(ctx.user.id, input.userId);
      }),

    remove: protectedProcedure
      .input(z.object({ friendId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.removeFriend(ctx.user.id, input.friendId);
      }),
  }),

  // =========== CHAT ===========
  chat: router({
    conversations: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getUserConversations(ctx.user.id);
      }),

    getOrCreateConversation: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.getOrCreateConversation([ctx.user.id, input.userId]);
      }),

    messages: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        limit: z.number().default(50),
        beforeId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return socialDb.getMessages(input.conversationId, ctx.user.id, input.limit, input.beforeId);
      }),

    send: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        type: z.enum(["text", "music", "playlist", "voice"]),
        content: z.string(),
        musicData: z.object({
          trackId: z.string(),
          title: z.string(),
          artist: z.string(),
          thumbnail: z.string(),
        }).optional(),
        playlistData: z.object({
          playlistId: z.number(),
          name: z.string(),
          trackCount: z.number(),
        }).optional(),
        voiceUrl: z.string().optional(),
        voiceDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.sendMessage(
          input.conversationId,
          ctx.user.id,
          input.type,
          input.content,
          {
            musicData: input.musicData || null,
            playlistData: input.playlistData || null,
            voiceUrl: input.voiceUrl || null,
            voiceDuration: input.voiceDuration || null,
          }
        );
      }),

    createGroup: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(50),
        participantIds: z.array(z.number()).min(1).max(9),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.createGroupConversation(ctx.user.id, input.name, input.participantIds);
      }),

    addUserToGroup: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.addUserToGroupConversation(input.conversationId, ctx.user.id, input.userId);
      }),

    removeUserFromGroup: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.removeUserFromGroupConversation(input.conversationId, ctx.user.id, input.userId);
      }),

    leaveGroup: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.leaveGroupConversation(input.conversationId, ctx.user.id);
      }),

    close: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.closeConversation(input.conversationId, ctx.user.id);
      }),
  }),

  // =========== NOTIFICATIONS ===========
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        const notifs = await socialDb.getNotifications(ctx.user.id, input.limit);
        const unread = await socialDb.getUnreadNotificationCount(ctx.user.id);
        return { items: notifs, unread };
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getUnreadNotificationCount(ctx.user.id);
      }),

    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.markNotificationRead(input.notificationId, ctx.user.id);
      }),

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        return socialDb.markAllNotificationsRead(ctx.user.id);
      }),
  }),

  // =========== SETTINGS ===========
  settings: router({
    get: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getSettings(ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        mixMode: z.boolean().optional(),
        mixModeBpmRange: z.number().min(1).max(50).optional(),
        mixModeEnergy: z.enum(["low", "medium", "high"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.updateSettings(ctx.user.id, input);
      }),
  }),

  // =========== adVANTAGE / MINI-GAME ===========
  vantage: router({
    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getUserVantageStats(ctx.user.id);
      }),

    recordListening: protectedProcedure
      .input(z.object({
        trackId: z.string(),
        trackTitle: z.string().optional(),
        trackArtist: z.string().optional(),
        trackThumbnail: z.string().optional(),
        secondsListened: z.number().min(1).max(3600),
        trackDuration: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.recordListeningSession(ctx.user.id, input);
      }),

    groupLeaderboard: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify user is in conversation
        const conv = await socialDb.getConversation(input.conversationId, ctx.user.id);
        if (!conv) throw new Error("Conversazione non trovata");
        return await socialDb.getGroupLeaderboard(input.conversationId);
      }),

    myMonthlyRecap: protectedProcedure
      .input(z.object({ yearMonth: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return socialDb.getOrGenerateMonthlyRecap(ctx.user.id, input.yearMonth);
      }),

    groupMonthlyRecap: protectedProcedure
      .input(z.object({ conversationId: z.number(), yearMonth: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const conv = await socialDb.getConversation(input.conversationId, ctx.user.id);
        if (!conv) throw new Error("Conversazione non trovata");
        return socialDb.getMonthlyRecapForGroup(input.conversationId, input.yearMonth);
      }),

    notifyGroupWinner: protectedProcedure
      .input(z.object({ conversationId: z.number(), yearMonth: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const conv = await socialDb.getConversation(input.conversationId, ctx.user.id);
        if (!conv) throw new Error("Conversazione non trovata");
        return await socialDb.notifyGroupMonthlyWinner(input.conversationId, input.yearMonth);
      }),
  }),

  // =========== PUSH NOTIFICATIONS ===========
  push: router({
    vapidPublicKey: publicProcedure
      .query(() => {
        return getVapidPublicKey();
      }),

    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.savePushSubscription(ctx.user.id, input);
      }),

    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.removePushSubscription(ctx.user.id, input.endpoint);
      }),
  }),

  // =========== SOCIAL ===========
  social: router({
    friendActivity: protectedProcedure
      .query(async ({ ctx }) => {
        const activity = await socialDb.getFriendActivity(ctx.user.id);
        const connectedUserIds = getConnectedUserIds();
        return (activity as any[]).filter((a) => connectedUserIds.includes(a.userId));
      }),

    updateListeningActivity: protectedProcedure
      .input(z.object({
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await socialDb.updateListeningActivity(ctx.user.id, {
          id: input.trackId,
          title: input.trackTitle,
          artist: input.trackArtist,
          thumbnail: input.trackThumbnail,
        });
        broadcastActivity(ctx.user.id, {
          trackId: input.trackId,
          trackTitle: input.trackTitle,
          trackArtist: input.trackArtist,
          trackThumbnail: input.trackThumbnail,
        });
        return { success: true };
      }),

    clearListeningActivity: protectedProcedure
      .mutation(async ({ ctx }) => {
        await socialDb.clearListeningActivity(ctx.user.id);
        broadcastActivity(ctx.user.id, null);
        return { success: true };
      }),

    addReaction: protectedProcedure
      .input(z.object({
        toUserId: z.number(),
        trackId: z.string(),
        emoji: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.addReaction(input.toUserId, ctx.user.id, input.trackId, input.emoji);
      }),

    getReactions: protectedProcedure
      .input(z.object({
        toUserId: z.number(),
        trackId: z.string(),
      }))
      .query(async ({ input }) => {
        return socialDb.getReactionsForTrack(input.toUserId, input.trackId);
      }),
  }),

  // =========== LISTEN TOGETHER ===========
  listenTogether: router({
    create: protectedProcedure
      .input(z.object({
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await socialDb.createListenTogetherSession(ctx.user.id, {
          id: input.trackId,
          title: input.trackTitle,
          artist: input.trackArtist,
          thumbnail: input.trackThumbnail,
        });
        return await socialDb.getListenTogetherSession(session.code);
      }),

    join: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await socialDb.joinListenTogetherSession(input.code, ctx.user.id);
        return await socialDb.getListenTogetherSession(input.code);
      }),

    leave: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await socialDb.leaveListenTogetherSession(input.code, ctx.user.id);
        return { success: true };
      }),

    get: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return socialDb.getListenTogetherSession(input.code);
      }),

    updateTrack: protectedProcedure
      .input(z.object({
        code: z.string(),
        trackId: z.string(),
        trackTitle: z.string(),
        trackArtist: z.string(),
        trackThumbnail: z.string(),
        currentTime: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.updateListenTogetherTrack(input.code, ctx.user.id, {
          id: input.trackId,
          title: input.trackTitle,
          artist: input.trackArtist,
          thumbnail: input.trackThumbnail,
        }, input.currentTime);
      }),

    togglePlay: protectedProcedure
      .input(z.object({
        code: z.string(),
        isPlaying: z.boolean(),
        currentTime: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return socialDb.updateListenTogetherPlayState(input.code, ctx.user.id, input.isPlaying, input.currentTime);
      }),

    mySessions: protectedProcedure
      .query(async ({ ctx }) => {
        return socialDb.getUserListenTogetherSessions(ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;

// Types
export type Track = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration?: string;
  durationSeconds?: number;
  thumbnail: string;
  type: "track";
};

export type Artist = {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
  type: "artist";
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  thumbnail: string;
  type: "album";
};

export type ArtistDetail = {
  id: string;
  name: string;
  description?: string;
  views?: string;
  subscribers?: string;
  thumbnail: string;
  topSongs: Track[];
  albums: Album[];
  singles: Album[];
  relatedArtists?: Artist[];
  videos?: Track[];
  playlists?: Album[];
};

export type AlbumDetail = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  description?: string;
  trackCount?: number;
  duration?: string;
  thumbnail: string;
  tracks: Track[];
};
