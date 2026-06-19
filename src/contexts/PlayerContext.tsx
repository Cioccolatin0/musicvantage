import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { Track } from "@shared/types";
import type { ListenTogetherSession } from "@shared/types";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isQueueOpen: boolean;
  error: string | null;
  isShuffleOn: boolean;
  repeatMode: RepeatMode;
  originalQueue: Track[];
  isAutoplayEnabled: boolean;
  isAutoplaying: boolean;
  isNowPlayingOpen: boolean;
  isLyricsOpen: boolean;
  listenTogetherSession: ListenTogetherSession | null;
  isFollowingTogether: boolean;
};

type PlayerActions = {
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playFromQueue: (index: number) => void;
  toggleQueue: () => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleAutoplay: () => void;
  setAutoplayCallback: (cb: ((track: Track) => Promise<Track[]>) | null) => void;
  stop: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  toggleLyrics: () => void;
  closeLyrics: () => void;
  setListenTogetherSession: (session: ListenTogetherSession | null) => void;
  setFollowingTogether: (following: boolean) => void;
  preloadTrack: (trackId: string) => void;
};

const PlayerContext = createContext<(PlayerState & PlayerActions) | null>(null);

let getCachedUser: () => { id: number } | null = () => null;

let ytApiPromise: Promise<void> | null = null;
function loadYtApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return ytApiPromise;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackStartTimeRef = useRef<number>(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const recordListening = trpc.vantage.recordListening.useMutation();
  const updateActivity = trpc.social.updateListeningActivity.useMutation();
  const updateTogetherTrack = trpc.listenTogether.updateTrack.useMutation();
  const toggleTogetherPlay = trpc.listenTogether.togglePlay.useMutation();
  const lastRecordRef = useRef<number>(0);
  const isPlayerReadyRef = useRef(false);
  const pendingTrackRef = useRef<string | null>(null);
  const isHandlingErrorRef = useRef(false);
  const retriedTracksRef = useRef<Set<string>>(new Set());

  getCachedUser = useCallback(() => user || null, [user]);

  const reportListening = useCallback((track: Track | null) => {
    if (!track || currentTrackIdRef.current !== track.id) return;
    const now = Date.now();
    const elapsed = (now - trackStartTimeRef.current) / 1000;
    if (elapsed >= 5 && (now - lastRecordRef.current) > 10000) {
      lastRecordRef.current = now;
      recordListening.mutate({
        trackId: track.id, trackTitle: track.title, trackArtist: track.artist,
        trackThumbnail: track.thumbnail, secondsListened: Math.round(elapsed),
        trackDuration: track.durationSeconds,
      });
    }
  }, [recordListening]);

  const stateRef = useRef<PlayerState>({
    currentTrack: null, queue: [], queueIndex: -1, isPlaying: false, isLoading: false,
    currentTime: 0, duration: 0, volume: 80, isMuted: false, isQueueOpen: false,
    error: null, isShuffleOn: false, repeatMode: "off", originalQueue: [],
    isAutoplayEnabled: true, isAutoplaying: false, isNowPlayingOpen: false,
    isLyricsOpen: false, listenTogetherSession: null, isFollowingTogether: false,
  });
  const [state, setState] = useState<PlayerState>(stateRef.current);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayCallbackRef = useRef<((track: Track) => Promise<Track[]>) | null>(null);
  const isPlayingRef = useRef(false);

  const updateState = useCallback((patch: Partial<PlayerState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const reportListeningRef = useRef(reportListening);
  reportListeningRef.current = reportListening;
  const updateActivityRef = useRef(updateActivity);
  updateActivityRef.current = updateActivity;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      try {
        const ct = player.getCurrentTime() || 0;
        const dur = player.getDuration() || 0;
        stateRef.current.currentTime = ct;
        stateRef.current.duration = dur;
        setState((s) => ({ ...s, currentTime: ct, duration: dur }));
        if (stateRef.current.isPlaying && stateRef.current.currentTrack) {
          const elapsed = (Date.now() - trackStartTimeRef.current) / 1000;
          if (elapsed >= 30) reportListeningRef.current(stateRef.current.currentTrack);
        }
      } catch {}
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const loadYtTrack = useCallback((trackId: string) => {
    const player = playerRef.current;
    if (!player || typeof player.loadVideoById !== "function") {
      pendingTrackRef.current = trackId;
      return;
    }
    isHandlingErrorRef.current = false;
    retriedTracksRef.current.delete(trackId);
    try { player.loadVideoById(trackId); }
    catch { try { player.cueVideoById(trackId); player.playVideo(); } catch {} }
  }, []);

  const advanceToEnd = useCallback((s: PlayerState) => {
    if (s.repeatMode === "one" && s.currentTrack) {
      const player = playerRef.current;
      if (player) { player.seekTo(0, true); player.playVideo(); }
    } else if (s.queueIndex < s.queue.length - 1) {
      const nextIdx = s.queueIndex + 1;
      const nextTrackItem = s.queue[nextIdx];
      updateActivityRef.current.mutate({
        trackId: nextTrackItem.id, trackTitle: nextTrackItem.title,
        trackArtist: nextTrackItem.artist, trackThumbnail: nextTrackItem.thumbnail,
      });
      stateRef.current.currentTrack = nextTrackItem;
      stateRef.current.queueIndex = nextIdx;
      stateRef.current.currentTime = 0;
      stateRef.current.isLoading = true;
      setState((prev) => ({ ...prev, currentTrack: nextTrackItem, queueIndex: nextIdx, currentTime: 0, isLoading: true }));
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = nextTrackItem.id;
      loadYtTrack(nextTrackItem.id);
    } else if (s.repeatMode === "all" && s.queue.length > 0) {
      const firstTrack = s.queue[0];
      updateActivityRef.current.mutate({
        trackId: firstTrack.id, trackTitle: firstTrack.title,
        trackArtist: firstTrack.artist, trackThumbnail: firstTrack.thumbnail,
      });
      stateRef.current.currentTrack = firstTrack;
      stateRef.current.queueIndex = 0;
      stateRef.current.currentTime = 0;
      stateRef.current.isLoading = true;
      setState((prev) => ({ ...prev, currentTrack: firstTrack, queueIndex: 0, currentTime: 0, isLoading: true }));
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = firstTrack.id;
      loadYtTrack(firstTrack.id);
    } else if (s.isAutoplayEnabled && s.currentTrack && autoplayCallbackRef.current) {
      stateRef.current.isAutoplaying = true;
      setState((prev) => ({ ...prev, isAutoplaying: true }));
      autoplayCallbackRef.current(s.currentTrack)
        .then((tracks) => {
          if (tracks.length > 0) {
            const cur = stateRef.current;
            const newQueue = [...cur.queue, ...tracks];
            const nextTrack = tracks[0];
            updateActivityRef.current.mutate({
              trackId: nextTrack.id, trackTitle: nextTrack.title,
              trackArtist: nextTrack.artist, trackThumbnail: nextTrack.thumbnail,
            });
            trackStartTimeRef.current = Date.now();
            currentTrackIdRef.current = nextTrack.id;
            stateRef.current.queue = newQueue;
            stateRef.current.queueIndex = cur.queue.length;
            stateRef.current.currentTrack = nextTrack;
            stateRef.current.currentTime = 0;
            stateRef.current.isLoading = true;
            stateRef.current.isAutoplaying = false;
            setState((prev) => ({
              ...prev, queue: newQueue, queueIndex: cur.queue.length,
              currentTrack: nextTrack, currentTime: 0, isLoading: true, isAutoplaying: false,
            }));
            loadYtTrack(nextTrack.id);
          } else {
            stateRef.current.isAutoplaying = false;
            setState((prev) => ({ ...prev, isAutoplaying: false }));
          }
        })
        .catch(() => {
          stateRef.current.isAutoplaying = false;
          setState((prev) => ({ ...prev, isAutoplaying: false }));
        });
    }
  }, [loadYtTrack]);

  const broadcastActivity = useCallback((track: Track) => {
    updateActivity.mutate({
      trackId: track.id, trackTitle: track.title,
      trackArtist: track.artist, trackThumbnail: track.thumbnail,
    });
  }, [updateActivity]);

  const playTrack = useCallback(
    (track: Track, queue?: Track[]) => {
      isHandlingErrorRef.current = false;
      retriedTracksRef.current.delete(track.id);
      try {
        void utils.music.getLyrics.prefetch({
          videoId: track.id, title: track.title || "", artist: track.artist || "",
          album: track.album || "", duration: track.durationSeconds || 0,
        } as any);
      } catch {}
      const newQueue = queue || [track];
      const idx = newQueue.findIndex((t) => t.id === track.id);
      let finalQueue = newQueue;
      let finalIndex = idx >= 0 ? idx : 0;

      if (stateRef.current.isShuffleOn && newQueue.length > 1) {
        const shuffled = [...newQueue];
        const others = shuffled.filter((t) => t.id !== track.id);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        finalQueue = [track, ...others];
        finalIndex = 0;
      }

      reportListening(stateRef.current.currentTrack);
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = track.id;
      updateState({
        currentTrack: track, queue: finalQueue, queueIndex: finalIndex,
        originalQueue: newQueue, error: null, isLoading: true, currentTime: 0,
      });
      updateActivity.mutate({
        trackId: track.id, trackTitle: track.title,
        trackArtist: track.artist, trackThumbnail: track.thumbnail,
      });
      const sess = stateRef.current.listenTogetherSession;
      const cu = getCachedUser();
      if (sess && cu && sess.creatorUserId === cu.id) {
        updateTogetherTrack.mutate({
          code: sess.code, trackId: track.id, trackTitle: track.title,
          trackArtist: track.artist, trackThumbnail: track.thumbnail, currentTime: 0,
        });
      }
      loadYtTrack(track.id);
    },
    [utils, updateState, reportListening, updateActivity, updateTogetherTrack, loadYtTrack]
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player || !stateRef.current.currentTrack) return;
    if (stateRef.current.isPlaying) player.pauseVideo();
    else player.playVideo();
    const sess = stateRef.current.listenTogetherSession;
    const currentUser = getCachedUser();
    if (sess && currentUser && sess.creatorUserId === currentUser.id) {
      toggleTogetherPlay.mutate({
        code: sess.code, isPlaying: !stateRef.current.isPlaying, currentTime: stateRef.current.currentTime,
      });
    }
  }, [toggleTogetherPlay]);

  const next = useCallback(() => {
    const s = stateRef.current;
    reportListening(s.currentTrack);
    if (s.repeatMode === "one" && s.currentTrack) {
      const player = playerRef.current;
      if (player) { player.seekTo(0, true); player.playVideo(); }
      return;
    }
    if (s.queueIndex < s.queue.length - 1) {
      const nextIdx = s.queueIndex + 1;
      const nextTrackItem = s.queue[nextIdx];
      broadcastActivity(nextTrackItem);
      updateState({ currentTrack: nextTrackItem, queueIndex: nextIdx, currentTime: 0, isLoading: true });
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = nextTrackItem.id;
      loadYtTrack(nextTrackItem.id);
    } else if (s.repeatMode === "all" && s.queue.length > 0) {
      const firstTrack = s.queue[0];
      broadcastActivity(firstTrack);
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = firstTrack.id;
      updateState({ currentTrack: firstTrack, queueIndex: 0, currentTime: 0, isLoading: true });
      loadYtTrack(firstTrack.id);
    } else if (s.isAutoplayEnabled && s.currentTrack && autoplayCallbackRef.current) {
      updateState({ isAutoplaying: true });
      autoplayCallbackRef.current(s.currentTrack)
        .then((tracks) => {
          if (tracks.length > 0) {
            const cur = stateRef.current;
            const newQueue = [...cur.queue, ...tracks];
            const nextTrack = tracks[0];
            broadcastActivity(nextTrack);
            updateState({
              queue: newQueue, queueIndex: cur.queue.length, currentTrack: nextTrack,
              currentTime: 0, isLoading: true, isAutoplaying: false,
            });
            loadYtTrack(nextTrack.id);
          } else {
            updateState({ isAutoplaying: false });
          }
        })
        .catch(() => updateState({ isAutoplaying: false }));
    }
  }, [updateState, reportListening, broadcastActivity, loadYtTrack]);

  const prev = useCallback(() => {
    const s = stateRef.current;
    reportListening(s.currentTrack);
    const player = playerRef.current;
    if (player && typeof player.getCurrentTime === "function" && player.getCurrentTime() > 3) {
      player.seekTo(0, true);
      updateState({ currentTime: 0 });
      return;
    }
    if (s.queueIndex > 0) {
      const prevIdx = s.queueIndex - 1;
      const prevTrackItem = s.queue[prevIdx];
      broadcastActivity(prevTrackItem);
      updateState({ currentTrack: prevTrackItem, queueIndex: prevIdx, currentTime: 0, isLoading: true });
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = prevTrackItem.id;
      loadYtTrack(prevTrackItem.id);
    }
  }, [updateState, reportListening, broadcastActivity, loadYtTrack]);

  const seek = useCallback((time: number) => {
    const player = playerRef.current;
    if (player && typeof player.seekTo === "function") {
      player.seekTo(time, true);
      updateState({ currentTime: time });
    }
  }, [updateState]);

  const setVolume = useCallback((vol: number) => {
    const player = playerRef.current;
    if (player && typeof player.setVolume === "function") {
      player.setVolume(vol);
      if (vol === 0) player.mute();
      else if (player.isMuted()) player.unMute();
    }
    updateState({ volume: vol, isMuted: vol === 0 });
  }, [updateState]);

  const toggleMute = useCallback(() => {
    const newMuted = !stateRef.current.isMuted;
    const player = playerRef.current;
    if (player) { if (newMuted) player.mute(); else player.unMute(); }
    updateState({ isMuted: newMuted });
  }, [updateState]);

  const addToQueue = useCallback((track: Track) => {
    updateState({ queue: [...stateRef.current.queue, track] });
  }, [updateState]);

  const removeFromQueue = useCallback((index: number) => {
    const s = stateRef.current;
    const newQueue = s.queue.filter((_, i) => i !== index);
    const newIdx = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
    updateState({ queue: newQueue, queueIndex: newIdx });
  }, [updateState]);

  const playFromQueue = useCallback((index: number) => {
    const track = stateRef.current.queue[index];
    if (track) {
      isHandlingErrorRef.current = false;
      retriedTracksRef.current.delete(track.id);
      reportListening(stateRef.current.currentTrack);
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = track.id;
      broadcastActivity(track);
      updateState({ currentTrack: track, queueIndex: index, currentTime: 0, isLoading: true, error: null });
      loadYtTrack(track.id);
    }
  }, [updateState, reportListening, broadcastActivity, loadYtTrack]);

  const toggleQueue = useCallback(() => {
    updateState({ isQueueOpen: !stateRef.current.isQueueOpen });
  }, [updateState]);

  const clearQueue = useCallback(() => {
    updateState({ queue: [], queueIndex: -1 });
  }, [updateState]);

  const toggleShuffle = useCallback(() => {
    const s = stateRef.current;
    const newShuffle = !s.isShuffleOn;
    if (newShuffle && s.queue.length > 1) {
      const currentTrackItem = s.currentTrack;
      const others = s.queue.filter((t) => t.id !== currentTrackItem?.id);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      updateState({
        isShuffleOn: true, queue: currentTrackItem ? [currentTrackItem, ...others] : [...s.queue],
        queueIndex: currentTrackItem ? 0 : s.queueIndex,
        originalQueue: s.originalQueue.length > 0 ? s.originalQueue : s.queue,
      });
    } else if (!newShuffle) {
      const restoredQueue = s.originalQueue.length > 0 ? s.originalQueue : s.queue;
      const restoredIndex = restoredQueue.findIndex((t) => t.id === s.currentTrack?.id);
      updateState({
        isShuffleOn: false, queue: restoredQueue,
        queueIndex: restoredIndex >= 0 ? restoredIndex : 0, originalQueue: [],
      });
    } else {
      updateState({ isShuffleOn: newShuffle });
    }
  }, [updateState]);

  const toggleRepeat = useCallback(() => {
    const s = stateRef.current;
    const modes: RepeatMode[] = ["off", "all", "one"];
    updateState({ repeatMode: modes[(modes.indexOf(s.repeatMode) + 1) % modes.length] });
  }, [updateState]);

  const toggleAutoplay = useCallback(() => {
    updateState({ isAutoplayEnabled: !stateRef.current.isAutoplayEnabled });
  }, [updateState]);

  const setAutoplayCallback = useCallback((cb: ((track: Track) => Promise<Track[]>) | null) => {
    autoplayCallbackRef.current = cb;
  }, []);

  const stop = useCallback(() => {
    const player = playerRef.current;
    if (player && typeof player.stopVideo === "function") player.stopVideo();
    reportListening(stateRef.current.currentTrack);
    stopTimer();
    updateState({
      currentTrack: null, queue: [], queueIndex: -1, isPlaying: false,
      isLoading: false, currentTime: 0, error: null,
    });
    currentTrackIdRef.current = null;
  }, [updateState, stopTimer, reportListening]);

  const openNowPlaying = useCallback(() => updateState({ isNowPlayingOpen: true }), [updateState]);
  const closeNowPlaying = useCallback(() => updateState({ isNowPlayingOpen: false }), [updateState]);
  const toggleLyrics = useCallback(() => updateState({ isLyricsOpen: !stateRef.current.isLyricsOpen }), [updateState]);
  const closeLyrics = useCallback(() => updateState({ isLyricsOpen: false }), [updateState]);
  const setListenTogetherSession = useCallback((session: ListenTogetherSession | null) => updateState({ listenTogetherSession: session }), [updateState]);
  const setFollowingTogether = useCallback((following: boolean) => updateState({ isFollowingTogether: following }), [updateState]);
  const preloadTrack = useCallback((_trackId: string) => {}, []);

  // Initialize YouTube IFrame API
  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      await loadYtApi();
      if (destroyed) return;

      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.appendChild(container);
      containerRef.current = container;

      const playerDiv = document.createElement("div");
      playerDiv.id = `yt-player-${Date.now()}`;
      container.appendChild(playerDiv);

      new window.YT.Player(playerDiv, {
        height: "1", width: "1",
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0,
          iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (destroyed) return;
            isPlayerReadyRef.current = true;
            playerRef.current = event.target;
            if (pendingTrackRef.current) {
              loadYtTrack(pendingTrackRef.current);
              pendingTrackRef.current = null;
            }
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            const ytState = event.data;

            if (ytState === window.YT?.PlayerState?.PLAYING) {
              isPlayingRef.current = true;
              stateRef.current.isPlaying = true;
              stateRef.current.isLoading = false;
              stateRef.current.error = null;
              setState((s) => ({ ...s, isPlaying: true, isLoading: false, error: null }));
              startTimer();
            } else if (ytState === window.YT?.PlayerState?.PAUSED) {
              isPlayingRef.current = false;
              reportListeningRef.current(stateRef.current.currentTrack);
              stateRef.current.isPlaying = false;
              stateRef.current.isLoading = false;
              setState((s) => ({ ...s, isPlaying: false, isLoading: false }));
              stopTimer();
            } else if (ytState === window.YT?.PlayerState?.ENDED) {
              isPlayingRef.current = false;
              reportListeningRef.current(stateRef.current.currentTrack);
              stopTimer();
              stateRef.current.isPlaying = false;
              setState((s) => ({ ...s, isPlaying: false }));
              advanceToEnd(stateRef.current);
            } else if (ytState === window.YT?.PlayerState?.BUFFERING) {
              stateRef.current.isLoading = true;
              setState((s) => ({ ...s, isLoading: true }));
            } else if (ytState === window.YT?.PlayerState?.UNSTARTED) {
              stateRef.current.isLoading = true;
              setState((s) => ({ ...s, isLoading: true }));
            }
          },
          onError: (event: any) => {
            if (destroyed) return;
            const trackId = currentTrackIdRef.current;
            if (!trackId) return;
            console.error(`[Player] YouTube error ${event.data} for ${trackId}`);
            if (!retriedTracksRef.current.has(trackId)) {
              retriedTracksRef.current.add(trackId);
              setTimeout(() => {
                if (currentTrackIdRef.current === trackId && playerRef.current) loadYtTrack(trackId);
              }, 1000);
            } else {
              stateRef.current.isLoading = false;
              stateRef.current.isPlaying = false;
              stateRef.current.error = "Errore riproduzione";
              setState((prev) => ({ ...prev, isLoading: false, isPlaying: false, error: "Errore riproduzione" }));
              stopTimer();
            }
          },
        },
      });
    };

    init();

    return () => {
      destroyed = true;
      stopTimer();
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try { playerRef.current.destroy(); } catch {}
      }
      if (containerRef.current) { containerRef.current.remove(); containerRef.current = null; }
      playerRef.current = null;
      isPlayerReadyRef.current = false;
    };
  }, []);

  // Broadcast activity when currentTrack changes
  useEffect(() => {
    const track = stateRef.current.currentTrack;
    if (!track) return;
    updateActivity.mutate({
      trackId: track.id, trackTitle: track.title,
      trackArtist: track.artist, trackThumbnail: track.thumbnail,
    });
    const sess = stateRef.current.listenTogetherSession;
    const currentUser = getCachedUser();
    if (sess && currentUser && sess.creatorUserId === currentUser.id) {
      updateTogetherTrack.mutate({
        code: sess.code, trackId: track.id, trackTitle: track.title,
        trackArtist: track.artist, trackThumbnail: track.thumbnail, currentTime: 0,
      });
    }
    utils.music.getLyrics.prefetch({
      videoId: track.id, title: track.title, artist: track.artist,
      album: track.album || "", duration: track.durationSeconds || 0,
    });
  }, [state.currentTrack?.id]);

  // Poll listen together session when following
  const { data: followedSession } = trpc.listenTogether.get.useQuery(
    { code: state.listenTogetherSession?.code || "" },
    { enabled: state.isFollowingTogether && !!state.listenTogetherSession?.code, refetchInterval: 5000 }
  );

  useEffect(() => {
    if (!followedSession || !state.isFollowingTogether) return;
    const currentUser = getCachedUser();
    if (!currentUser || followedSession.creatorUserId === currentUser.id) return;
    const current = stateRef.current;
    if (followedSession.trackId !== current.currentTrack?.id) {
      const newTrack: Track = {
        id: followedSession.trackId, title: followedSession.trackTitle,
        artist: followedSession.trackArtist, thumbnail: followedSession.trackThumbnail, type: "track",
      };
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = newTrack.id;
      updateState({ currentTrack: newTrack, currentTime: 0, isLoading: true });
      loadYtTrack(newTrack.id);
    } else if (followedSession.isPlaying !== current.isPlaying) {
      const player = playerRef.current;
      if (player) {
        if (followedSession.isPlaying) player.playVideo();
        else player.pauseVideo();
      }
    }
  }, [followedSession, state.isFollowingTogether, updateState, loadYtTrack]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        const player = playerRef.current;
        if (!player || !stateRef.current.currentTrack) return;
        if (stateRef.current.isPlaying) player.pauseVideo();
        else player.playVideo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const clearActivity = trpc.social.clearListeningActivity.useMutation();
  useEffect(() => () => { clearActivity.mutate(undefined); }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state, playTrack, togglePlay, next, prev, seek, setVolume, toggleMute,
        addToQueue, removeFromQueue, playFromQueue, toggleQueue, clearQueue,
        toggleShuffle, toggleRepeat, toggleAutoplay, setAutoplayCallback, stop,
        openNowPlaying, closeNowPlaying, toggleLyrics, closeLyrics,
        setListenTogetherSession, setFollowingTogether, preloadTrack,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
