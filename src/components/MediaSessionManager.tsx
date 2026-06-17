import { useEffect, useRef } from "react";
import { usePlayer } from "../contexts/PlayerContext";

export default function MediaSessionManager() {
  const {
    currentTrack, isPlaying, currentTime, duration,
    togglePlay, next, prev, seek,
  } = usePlayer();
  const seekRef = useRef(seek);
  seekRef.current = seek;

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    if (currentTrack) {
      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || "",
        artwork: currentTrack.thumbnail ? [
          { src: currentTrack.thumbnail, sizes: "512x512", type: "image/jpeg" },
          { src: currentTrack.thumbnail, sizes: "256x256", type: "image/jpeg" },
          { src: currentTrack.thumbnail, sizes: "128x128", type: "image/jpeg" },
        ] : [],
      });
    }

    ms.setActionHandler("play", () => togglePlay());
    ms.setActionHandler("pause", () => togglePlay());
    ms.setActionHandler("previoustrack", () => prev());
    ms.setActionHandler("nexttrack", () => next());
    ms.setActionHandler("seekbackward", (details) => {
      const offset = (details as any).seekOffset || 10;
      seekRef.current(Math.max(0, currentTime - offset));
    });
    ms.setActionHandler("seekforward", (details) => {
      const offset = (details as any).seekOffset || 10;
      seekRef.current(Math.min(duration, currentTime + offset));
    });
    ms.setActionHandler("seekto", (details) => {
      const time = (details as any).seekTime;
      if (typeof time === "number") seekRef.current(time);
    });

    return () => {
      ms.metadata = null;
      const actions: MediaSessionAction[] = [
        "play", "pause", "previoustrack", "nexttrack",
        "seekbackward", "seekforward", "seekto",
      ];
      actions.forEach((a) => { try { ms.setActionHandler(a, null); } catch {} });
    };
  }, [currentTrack, isPlaying, currentTime, duration, togglePlay, next, prev, seek]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  return null;
}
