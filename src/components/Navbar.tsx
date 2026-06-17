import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, Loader2, Bell, MessageCircle, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SafeImg from "./SafeImg";
import { useAuth } from "@/hooks/useAuth";

const DEBOUNCE_MS = 80;

export default function Navbar() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [fastDebouncedQuery, setFastDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const fastTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const utils = trpc.useContext();

  const firePrefetch = useCallback((queries: string[]) => {
    fetch("/api/trpc/music.searchPrefetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { queries } }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Fast debounce (50ms) for instant text suggestions
  useEffect(() => {
    if (fastTimerRef.current) clearTimeout(fastTimerRef.current);
    fastTimerRef.current = setTimeout(() => {
      setFastDebouncedQuery(query.trim());
    }, 25);
    return () => { if (fastTimerRef.current) clearTimeout(fastTimerRef.current); };
  }, [query]);

  // Slow debounce (150ms) for full track results
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Tier 1: Ultra-fast text suggestions (~200ms from YouTube autocomplete API)
  const { data: fastSuggestions, isFetching: fastFetching } = trpc.music.searchSuggestionsFast.useQuery(
    { query: fastDebouncedQuery },
    {
      enabled: fastDebouncedQuery.length >= 2,
      staleTime: 5 * 60 * 1000,
      retry: 0,
    }
  );

  // Tier 2: Full track results with thumbnails (~1-2s from search_quick)
  const { data: fullSuggestions, isFetching: fullFetching } = trpc.music.searchSuggestions.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2,
      staleTime: 5 * 60 * 1000,
      retry: 0,
      keepPreviousData: true,
    }
  );

  // Background prefetch: as user types, prefetch next-char extensions in Python
  useEffect(() => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    if (debouncedQuery.length < 3) return;

    prefetchTimerRef.current = setTimeout(() => {
      const q = debouncedQuery.toLowerCase();
      const nextChars = ["a","e","i","o","u","b","r","s","t","l","n"];
      const prefetchQueries = nextChars.map((c: string) => q + c);
      firePrefetch(prefetchQueries.slice(0, 3));
      for (const pq of prefetchQueries.slice(0, 2)) {
        utils.music.searchSuggestions.fetch({ query: pq }).catch(() => {});
      }
    }, 200);
    return () => { if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current); };
  }, [debouncedQuery, firePrefetch]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    firePrefetch(["fedez", "gianna", "mahmood", "ultimo", "blinding lights", "taylor swift"]);
  }, [firePrefetch]);

  const hasFastSuggestions = fastSuggestions?.suggestions?.length > 0;
  const hasFullSuggestions = fullSuggestions?.tracks && fullSuggestions.tracks.length > 0;
  const showDropdown = focused && fastDebouncedQuery.length >= 2 && (fastFetching || fullFetching || hasFastSuggestions || hasFullSuggestions);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
    }
  };

  const goToSearch = useCallback((q: string) => {
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setFocused(false);
    setQuery(q);
  }, [navigate]);

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-border/20 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center gap-2 h-14 px-3 lg:pl-[16rem]">
          <button
            onClick={() => navigate("/settings")}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center">
              <User className="w-4 h-4" strokeWidth={2} />
            </div>
          </button>

          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto relative">
            <div
              className={`relative flex items-center rounded-xl transition-all duration-300 ${
                focused
                  ? "bg-surface-2 ring-2 ring-[var(--spotify-green)]/40 shadow-lg"
                  : "bg-surface-1 hover:bg-surface-2"
              }`}
            >
              <Search className="absolute left-3 sm:left-4 w-4 h-4 text-muted-foreground" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={handleFocus}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                placeholder="Cosa vuoi ascoltare?"
                className="w-full bg-transparent pl-10 sm:pl-12 pr-9 sm:pr-11 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setDebouncedQuery(""); setFastDebouncedQuery(""); inputRef.current?.focus(); }}
                  className="absolute right-2.5 sm:right-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
            </div>

            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-card border border-border/50 shadow-2xl overflow-hidden fade-in">
                <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
                  {/* Show full track cards if available, otherwise show fast text suggestions */}
                  {hasFullSuggestions ? (
                    fullSuggestions.tracks!.slice(0, 5).map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); goToSearch(t.title); }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-1 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                          <SafeImg src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
                        </div>
                      </button>
                    ))
                  ) : hasFastSuggestions ? (
                    fastSuggestions.suggestions!.slice(0, 6).map((s: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); goToSearch(s); }}
                        onMouseEnter={() => {
                          utils.music.searchSuggestions.fetch({ query: s }).catch(() => {});
                          firePrefetch([s]);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-1 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                          <Search className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s}</p>
                        </div>
                      </button>
                    ))
                  ) : fastFetching ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); goToSearch(query); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-spotify-green font-medium hover:bg-surface-1 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Cerca "{query}"
                  </button>
                </div>
              </div>
            )}
          </form>

          {user && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => navigate("/chat")}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
              >
                <MessageCircle className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                onClick={() => navigate("/notifications")}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
              >
                <Bell className="w-5 h-5" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
