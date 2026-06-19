import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import type { Track } from "@shared/types";
import type { ListenTogetherSession } from "@shared/types";
import { useAuth } from "@/hooks/useAuth";

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

function audioProxyUrl(trackId: string): string {
  return `${import.meta.env.VITE_API_URL || ""}/api/audio-proxy/${trackId}`;
}

let audioUrlCache = new Map<string, string>();

async function resolveTrackUrl(trackId: string): Promise<string> {
  const cached = audioUrlCache.get(trackId);
  if (cached) return cached;
  const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/audio-url/${trackId}`);
  if (!res.ok) throw new Error(`Failed to resolve URL for ${trackId}`);
  const data = await res.json();
  if (data.url) {
    audioUrlCache.set(trackId, data.url);
    return data.url;
  }
  throw new Error(`No URL returned for ${trackId}`);
}

function prefetchAudioUrls(trackIds: string[]) {
  if (trackIds.length === 0) return;
  for (const id of trackIds) {
    if (!audioUrlCache.has(id)) {
      resolveTrackUrl(id).catch(() => {});
    }
  }
}

// Preload audio element for instant next-track playback
let preloadAudio: HTMLAudioElement | null = null;
let preloadedTrackId: string | null = null;

function ensurePreloadAudio(): HTMLAudioElement {
  if (!preloadAudio) {
    preloadAudio = new Audio();
    preloadAudio.preload = "auto";
  }
  return preloadAudio;
}

function preloadTrackAudio(trackId: string) {
  if (preloadedTrackId === trackId) return;
  const pa = ensurePreloadAudio();
  preloadedTrackId = trackId;
  const cached = audioUrlCache.get(trackId);
  if (cached) {
    pa.src = cached;
    pa.load();
  } else {
    resolveTrackUrl(trackId).then((url) => {
      if (preloadedTrackId === trackId) {
        pa.src = url;
        pa.load();
      }
    }).catch(() => {});
  }
}

let getCachedUser: () => { id: number } | null = () => null;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackStartTimeRef = useRef<number>(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const recordListening = trpc.vantage.recordListening.useMutation();
  const updateActivity = trpc.social.updateListeningActivity.useMutation();
  const updateTogetherTrack = trpc.listenTogether.updateTrack.useMutation();
  const toggleTogetherPlay = trpc.listenTogether.togglePlay.useMutation();
  const lastRecordRef = useRef<number>(0);

  getCachedUser = useCallback(() => user || null, [user]);

  const reportListening = useCallback((track: Track | null) => {
    if (!track || currentTrackIdRef.current !== track.id) return;
    const now = Date.now();
    const elapsed = (now - trackStartTimeRef.current) / 1000;
    if (elapsed >= 5 && (now - lastRecordRef.current) > 10000) {
      lastRecordRef.current = now;
      recordListening.mutate({
        trackId: track.id,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackThumbnail: track.thumbnail,
        secondsListened: Math.round(elapsed),
        trackDuration: track.durationSeconds,
      });
    }
  }, [recordListening]);

  const stateRef = useRef<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    isMuted: false,
    isQueueOpen: false,
    error: null,
    isShuffleOn: false,
    repeatMode: "off",
    originalQueue: [],
    isAutoplayEnabled: true,
    isAutoplaying: false,
    isNowPlayingOpen: false,
    isLyricsOpen: false,
    listenTogetherSession: null,
    isFollowingTogether: false,
  });
  const [state, setState] = useState<PlayerState>(stateRef.current);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayCallbackRef = useRef<((track: Track) => Promise<Track[]>) | null>(null);
  const isPlayingRef = useRef(false);
  const retriedTracksRef = useRef<Set<string>>(new Set());
  const isHandlingErrorRef = useRef(false);

  const updateState = useCallback((patch: Partial<PlayerState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // Store mutable callbacks in refs so the audio useEffect never re-runs
  const reportListeningRef = useRef(reportListening);
  reportListeningRef.current = reportListening;
  const updateActivityRef = useRef(updateActivity);
  updateActivityRef.current = updateActivity;
  const updateTogetherTrackRef = useRef(updateTogetherTrack);
  updateTogetherTrackRef.current = updateTogetherTrack;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        stateRef.current.currentTime = audio.currentTime;
        stateRef.current.duration = audio.duration || 0;
        setState((s) => ({ ...s, currentTime: audio.currentTime, duration: audio.duration || 0 }));
        if (stateRef.current.isPlaying && stateRef.current.currentTrack) {
          const elapsed = (Date.now() - trackStartTimeRef.current) / 1000;
          if (elapsed >= 30) {
            reportListeningRef.current(stateRef.current.currentTrack);
          }
          const dur = audio.duration || 0;
          if (dur > 0 && audio.currentTime >= dur * 0.25) {
            const s = stateRef.current;
            const nextTracks = s.queue.slice(s.queueIndex + 1, s.queueIndex + 5);
            if (nextTracks.length > 0) {
              prefetchAudioUrls(nextTracks.map((t) => t.id));
              preloadTrackAudio(nextTracks[0].id);
            }
          }
        }
      } catch {}
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const loadAudioTrack = useCallback((trackId: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    const applySrc = (url: string) => {
      if (currentTrackIdRef.current !== trackId) return;
      audio.src = url;
      audio.load();
      audio.play().catch(() => {});
    };

    // Check if next track was preloaded for instant playback
    if (preloadedTrackId === trackId && preloadAudio && preloadAudio.src) {
      const preloadUrl = preloadAudio.src;
      audio.src = preloadUrl;
      audio.load();
      audio.play().catch(() => {});
      isPlayingRef.current = true;
      preloadedTrackId = null;
      preloadAudio = null;
      const s = stateRef.current;
    const upcoming = s.queue.slice(s.queueIndex + 1, s.queueIndex + 3).map((t) => t.id);
      if (upcoming.length > 0) prefetchAudioUrls(upcoming);
      return;
    }

    const cached = audioUrlCache.get(trackId);
    if (cached) {
      applySrc(cached);
      isPlayingRef.current = true;
    } else {
      // Always use proxy URL - direct URLs don't work (YouTube validates IP)
      isPlayingRef.current = true;
      applySrc(audioProxyUrl(trackId));
    }

    const s = stateRef.current;
    // No prefetch - direct URLs don't work, proxy handles each track on demand
  }, []);

  // Initialize audio element ONCE - never re-run
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = stateRef.current.volume / 100;
    audioRef.current = audio;

    const onPlay = () => {
      isPlayingRef.current = true;
      stateRef.current.isPlaying = true;
      stateRef.current.isLoading = false;
      stateRef.current.error = null;
      setState((s) => ({ ...s, isPlaying: true, isLoading: false, error: null }));
      startTimer();
    };

    const onPause = () => {
      isPlayingRef.current = false;
      reportListeningRef.current(stateRef.current.currentTrack);
      stateRef.current.isPlaying = false;
      stateRef.current.isLoading = false;
      setState((s) => ({ ...s, isPlaying: false, isLoading: false }));
      stopTimer();
    };

    const onEnded = () => {
      isPlayingRef.current = false;
      reportListeningRef.current(stateRef.current.currentTrack);
      stopTimer();
      stateRef.current.isPlaying = false;
      setState((s) => ({ ...s, isPlaying: false }));
      const s = stateRef.current;

      if (s.repeatMode === "one") {
        if (audioRef.current && s.currentTrack) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else if (s.queueIndex < s.queue.length - 1) {
        let nextIdx = s.queueIndex + 1;
        let nextTrackItem = s.queue[nextIdx];
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
        loadAudioTrack(nextTrackItem.id);
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
        loadAudioTrack(firstTrack.id);
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
                ...prev,
                queue: newQueue,
                queueIndex: cur.queue.length,
                currentTrack: nextTrack,
                currentTime: 0,
                isLoading: true,
                isAutoplaying: false,
              }));
              loadAudioTrack(nextTrack.id);
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
    };

    const onWaiting = () => {
      stateRef.current.isLoading = true;
      setState((s) => ({ ...s, isLoading: true }));
    };

    const onError = () => {
      const a = audioRef.current;
      const trackId = currentTrackIdRef.current;
      if (!trackId || isHandlingErrorRef.current) return;
      isHandlingErrorRef.current = true;
      let errorMsg = "Errore riproduzione";
      if (a?.error?.code != null) {
        switch (a.error.code) {
          case MediaError.MEDIA_ERR_ABORTED: errorMsg = "Riproduzione interrotta"; break;
          case MediaError.MEDIA_ERR_NETWORK: errorMsg = "Errore di rete"; break;
          case MediaError.MEDIA_ERR_DECODE: errorMsg = "Formato audio non supportato"; break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = "Brano non disponibile"; break;
        }
      }
      console.error(`[Player] Audio error for ${trackId}:`, errorMsg);
      if (!retriedTracksRef.current.has(trackId)) {
        retriedTracksRef.current.add(trackId);
        setTimeout(() => {
          isHandlingErrorRef.current = false;
          if (audioRef.current && currentTrackIdRef.current === trackId) {
            console.log(`[Player] Retrying ${trackId}...`);
            audioRef.current.src = audioProxyUrl(trackId);
            audioRef.current.load();
            audioRef.current.play().catch(() => {});
          }
        }, 800);
      } else {
        if (a) { a.src = ""; a.load(); }
        stateRef.current.isLoading = false;
        stateRef.current.isPlaying = false;
        stateRef.current.error = errorMsg;
        setState((prev) => ({ ...prev, isLoading: false, isPlaying: false, error: errorMsg }));
        stopTimer();
      }
    };

    const onCanPlay = () => {
      stateRef.current.isLoading = false;
      setState((s) => ({ ...s, isLoading: false }));
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      stopTimer();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
      audio.src = "";
      audio.load();
      audioRef.current = null;
    };
  }, []); // Empty deps - runs ONCE

  const playTrack = useCallback(
    (track: Track, queue?: Track[]) => {
      isHandlingErrorRef.current = false;
      retriedTracksRef.current.delete(track.id);
      try {
        void utils.music.getLyrics.prefetch({
          videoId: track.id,
          title: track.title || "",
          artist: track.artist || "",
          album: track.album || "",
          duration: track.durationSeconds || 0,
        } as any);
      } catch {}
      const newQueue = queue || [track];
      const idx = newQueue.findIndex((t) => t.id === track.id);
      let finalQueue = newQueue;
      let finalIndex = idx >= 0 ? idx : 0;

      if (stateRef.current.isShuffleOn && newQueue.length > 1) {
        const shuffled = [...newQueue];
        const playingId = track.id;
        const others = shuffled.filter((t) => t.id !== playingId);
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
        currentTrack: track,
        queue: finalQueue,
        queueIndex: finalIndex,
        originalQueue: newQueue,
        error: null,
        isLoading: true,
        currentTime: 0,
      });
      updateActivity.mutate({
        trackId: track.id,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackThumbnail: track.thumbnail,
      });
      const sess = stateRef.current.listenTogetherSession;
      const cu = getCachedUser();
      if (sess && cu && sess.creatorUserId === cu.id) {
        updateTogetherTrack.mutate({
          code: sess.code,
          trackId: track.id,
          trackTitle: track.title,
          trackArtist: track.artist,
          trackThumbnail: track.thumbnail,
          currentTime: 0,
        });
      }
      // Pre-resolve track URL early so loadAudioTrack can use cache
      resolveTrackUrl(track.id).catch(() => {});
      loadAudioTrack(track.id);
    },
    [utils, updateState, reportListening, updateActivity, updateTogetherTrack, loadAudioTrack]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.currentTrack) return;
    if (stateRef.current.isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    const sess = stateRef.current.listenTogetherSession;
    const currentUser = getCachedUser();
    if (sess && currentUser && sess.creatorUserId === currentUser.id) {
      toggleTogetherPlay.mutate({
        code: sess.code,
        isPlaying: !stateRef.current.isPlaying,
        currentTime: stateRef.current.currentTime,
      });
    }
  }, [toggleTogetherPlay]);

  const broadcastActivity = useCallback((track: Track) => {
    updateActivity.mutate({
      trackId: track.id, trackTitle: track.title,
      trackArtist: track.artist, trackThumbnail: track.thumbnail,
    });
    const sess = stateRef.current.listenTogetherSession;
    const cu = getCachedUser();
    if (sess && cu && sess.creatorUserId === cu.id) {
      updateTogetherTrack.mutate({
        code: sess.code, trackId: track.id,
        trackTitle: track.title, trackArtist: track.artist,
        trackThumbnail: track.thumbnail, currentTime: 0,
      });
    }
  }, [updateActivity, updateTogetherTrack]);

  const next = useCallback(() => {
    const s = stateRef.current;
    reportListening(s.currentTrack);
    if (s.repeatMode === "one" && s.currentTrack) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    if (s.queueIndex < s.queue.length - 1) {
      const nextIdx = s.queueIndex + 1;
      const nextTrackItem = s.queue[nextIdx];
      broadcastActivity(nextTrackItem);
      updateState({ currentTrack: nextTrackItem, queueIndex: nextIdx, currentTime: 0, isLoading: true });
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = nextTrackItem.id;
      loadAudioTrack(nextTrackItem.id);
    } else if (s.repeatMode === "all" && s.queue.length > 0) {
      const firstTrack = s.queue[0];
      broadcastActivity(firstTrack);
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = firstTrack.id;
      updateState({ currentTrack: firstTrack, queueIndex: 0, currentTime: 0, isLoading: true });
      loadAudioTrack(firstTrack.id);
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
              queue: newQueue,
              queueIndex: cur.queue.length,
              currentTrack: nextTrack,
              currentTime: 0,
              isLoading: true,
              isAutoplaying: false,
            });
            loadAudioTrack(nextTrack.id);
          } else {
            updateState({ isAutoplaying: false });
          }
        })
        .catch(() => updateState({ isAutoplaying: false }));
    }
  }, [updateState, reportListening, broadcastActivity, loadAudioTrack]);

  const prev = useCallback(() => {
    const s = stateRef.current;
    reportListening(s.currentTrack);
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      updateState({ currentTime: 0 });
      return;
    }
    if (s.queueIndex > 0) {
      const prevIdx = s.queueIndex - 1;
      const prevTrackItem = s.queue[prevIdx];
      broadcastActivity(prevTrackItem);
      updateState({ currentTrack: prevTrackItem, queueIndex: prevIdx, currentTime: 0, isLoading: true });
      loadAudioTrack(prevTrackItem.id);
    }
  }, [updateState, reportListening, broadcastActivity, loadAudioTrack]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
        updateState({ currentTime: time });
      }
    },
    [updateState]
  );

  const setVolume = useCallback(
    (vol: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.volume = vol / 100;
        audio.muted = vol === 0;
      }
      updateState({ volume: vol, isMuted: vol === 0 });
    },
    [updateState]
  );

  const toggleMute = useCallback(() => {
    const newMuted = !stateRef.current.isMuted;
    const audio = audioRef.current;
    if (audio) {
      audio.muted = newMuted;
    }
    updateState({ isMuted: newMuted });
  }, [updateState]);

  const addToQueue = useCallback(
    (track: Track) => {
      updateState({ queue: [...stateRef.current.queue, track] });
    },
    [updateState]
  );

  const removeFromQueue = useCallback(
    (index: number) => {
      const s = stateRef.current;
      const newQueue = s.queue.filter((_, i) => i !== index);
      const newIdx = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      updateState({ queue: newQueue, queueIndex: newIdx });
    },
    [updateState]
  );

  const playFromQueue = useCallback(
    (index: number) => {
      const track = stateRef.current.queue[index];
      if (track) {
        isHandlingErrorRef.current = false;
        retriedTracksRef.current.delete(track.id);
        reportListening(stateRef.current.currentTrack);
        trackStartTimeRef.current = Date.now();
        currentTrackIdRef.current = track.id;
        broadcastActivity(track);
        updateState({ currentTrack: track, queueIndex: index, currentTime: 0, isLoading: true, error: null });
        loadAudioTrack(track.id);
      }
    },
    [updateState, reportListening, broadcastActivity, loadAudioTrack]
  );

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
      const shuffledQueue = currentTrackItem
        ? [currentTrackItem, ...others]
        : [...s.queue];
      updateState({
        isShuffleOn: true,
        queue: shuffledQueue,
        queueIndex: currentTrackItem ? 0 : s.queueIndex,
        originalQueue: s.originalQueue.length > 0 ? s.originalQueue : s.queue,
      });
    } else if (!newShuffle) {
      const restoredQueue = s.originalQueue.length > 0 ? s.originalQueue : s.queue;
      const currentTrackItem = s.currentTrack;
      const restoredIndex = restoredQueue.findIndex((t) => t.id === currentTrackItem?.id);
      updateState({
        isShuffleOn: false,
        queue: restoredQueue,
        queueIndex: restoredIndex >= 0 ? restoredIndex : 0,
        originalQueue: [],
      });
    } else {
      updateState({ isShuffleOn: newShuffle });
    }
  }, [updateState]);

  const toggleRepeat = useCallback(() => {
    const s = stateRef.current;
    const modes: RepeatMode[] = ["off", "all", "one"];
    const currentIdx = modes.indexOf(s.repeatMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    updateState({ repeatMode: nextMode });
  }, [updateState]);

  const toggleAutoplay = useCallback(() => {
    updateState({ isAutoplayEnabled: !stateRef.current.isAutoplayEnabled });
  }, [updateState]);

  const setAutoplayCallback = useCallback((cb: ((track: Track) => Promise<Track[]>) | null) => {
    autoplayCallbackRef.current = cb;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    audio.load();
    reportListening(stateRef.current.currentTrack);
    stopTimer();
    updateState({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      error: null,
    });
    currentTrackIdRef.current = null;
  }, [updateState, stopTimer, reportListening]);

  const openNowPlaying = useCallback(() => {
    updateState({ isNowPlayingOpen: true });
  }, [updateState]);

  const closeNowPlaying = useCallback(() => {
    updateState({ isNowPlayingOpen: false });
  }, [updateState]);

  const toggleLyrics = useCallback(() => {
    updateState({ isLyricsOpen: !stateRef.current.isLyricsOpen });
  }, [updateState]);

  const closeLyrics = useCallback(() => {
    updateState({ isLyricsOpen: false });
  }, [updateState]);

  const setListenTogetherSession = useCallback((session: ListenTogetherSession | null) => {
    updateState({ listenTogetherSession: session });
  }, [updateState]);

  const setFollowingTogether = useCallback((following: boolean) => {
    updateState({ isFollowingTogether: following });
  }, [updateState]);

  const preloadTrack = useCallback((trackId: string) => {
    preloadTrackAudio(trackId);
  }, []);

  // Broadcast activity when currentTrack changes
  useEffect(() => {
    const track = stateRef.current.currentTrack;
    if (!track) return;
    updateActivity.mutate({
      trackId: track.id,
      trackTitle: track.title,
      trackArtist: track.artist,
      trackThumbnail: track.thumbnail,
    });
    const sess = stateRef.current.listenTogetherSession;
    const currentUser = getCachedUser();
    if (sess && currentUser && sess.creatorUserId === currentUser.id) {
      updateTogetherTrack.mutate({
        code: sess.code,
        trackId: track.id,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackThumbnail: track.thumbnail,
        currentTime: 0,
      });
    }
    utils.music.getLyrics.prefetch({
      videoId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || "",
      duration: track.durationSeconds || 0,
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
    const audio = audioRef.current;
    if (!audio) return;
    const current = stateRef.current;
    if (followedSession.trackId !== current.currentTrack?.id) {
      const newTrack: Track = {
        id: followedSession.trackId,
        title: followedSession.trackTitle,
        artist: followedSession.trackArtist,
        thumbnail: followedSession.trackThumbnail,
        type: "track",
      };
      trackStartTimeRef.current = Date.now();
      currentTrackIdRef.current = newTrack.id;
      updateState({ currentTrack: newTrack, currentTime: 0, isLoading: true });
      loadAudioTrack(newTrack.id);
    } else if (followedSession.isPlaying !== current.isPlaying) {
      if (followedSession.isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }
  }, [followedSession, state.isFollowingTogether, updateState, loadAudioTrack]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        const audio = audioRef.current;
        if (!audio || !stateRef.current.currentTrack) return;
        if (stateRef.current.isPlaying) {
          audio.pause();
        } else {
          audio.play().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Clear listening activity on unmount
  const clearActivity = trpc.social.clearListeningActivity.useMutation();
  useEffect(() => {
    return () => {
      clearActivity.mutate(undefined);
    };
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        playTrack,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        toggleMute,
        addToQueue,
        removeFromQueue,
        playFromQueue,
        toggleQueue,
        clearQueue,
        toggleShuffle,
        toggleRepeat,
        toggleAutoplay,
        setAutoplayCallback,
        stop,
        openNowPlaying,
        closeNowPlaying,
        toggleLyrics,
        closeLyrics,
        setListenTogetherSession,
        setFollowingTogether,
        preloadTrack,
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
