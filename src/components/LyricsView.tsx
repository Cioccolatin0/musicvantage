import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { usePlayer } from "../contexts/PlayerContext";
import { trpc } from "../lib/trpc";
import { Music2, Crosshair } from "lucide-react";

interface TimedLine {
  text: string;
  start: number;
  duration: number;
}

function extractColor(img: HTMLImageElement): [number, number, number] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [80, 80, 60];
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.15 && max > 40) {
      r += pr; g += pg; b += pb;
      count++;
    }
  }
  if (count > 0) {
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
  } else {
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
  }
  return [r, g, b];
}

export default function LyricsView() {
  const { currentTrack, currentTime, isLyricsOpen, duration } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const [bgColor, setBgColor] = useState<[number, number, number]>([80, 80, 60]);
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: lyricsData, isLoading } = trpc.music.getLyrics.useQuery(
    {
      videoId: currentTrack?.id || "",
      title: currentTrack?.title || "",
      artist: currentTrack?.artist || "",
      album: currentTrack?.album || "",
      duration: currentTrack?.durationSeconds || 0,
    },
    { enabled: isLyricsOpen, staleTime: 60 * 60 * 1000 }
  );

  const timedLines = useMemo((): TimedLine[] => {
    if (!lyricsData?.lyrics) return [];
    if (lyricsData.hasTimestamps && Array.isArray(lyricsData.lyrics)) {
      return (lyricsData.lyrics as { text: string; start: number; duration: number }[]).map(
        (l) => ({ text: l.text, start: l.start, duration: l.duration || 0 })
      );
    }
    if (typeof lyricsData.lyrics === "string" && lyricsData.lyrics) {
      const lines = lyricsData.lyrics.split("\n").filter((l: string) => l.trim());
      if (lines.length === 0) return [];
      const totalDuration = duration || currentTrack?.durationSeconds || 180;
      const avgDur = totalDuration / lines.length;
      return lines.map((text: string, i: number) => ({
        text,
        start: i * avgDur,
        duration: avgDur,
      }));
    }
    return [];
  }, [lyricsData, currentTrack, duration]);

  const activeIndex = useMemo(() => {
    if (timedLines.length === 0) return -1;
    const adjusted = currentTime + 0.2;
    for (let i = timedLines.length - 1; i >= 0; i--) {
      if (adjusted >= timedLines[i].start) return i;
    }
    return 0;
  }, [timedLines, currentTime]);

  const scrollToActive = useCallback(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeLineRef.current;
      const containerH = container.clientHeight;
      const elTop = el.offsetTop;
      const elH = el.clientHeight;
      const scrollTarget = elTop - containerH / 2 + elH / 2;
      container.scrollTo({ top: scrollTarget, behavior: "smooth" });
      setUserScrolled(false);
    }
  }, []);

  useEffect(() => {
    if (!userScrolled) {
      scrollToActive();
    }
  }, [activeIndex, userScrolled, scrollToActive]);

  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current || !activeLineRef.current) return;
      const container = containerRef.current;
      const el = activeLineRef.current;
      const containerH = container.clientHeight;
      const elTop = el.offsetTop;
      const elH = el.clientHeight;
      const activeCenter = elTop + elH / 2;
      const viewCenter = container.scrollTop + containerH / 2;
      const dist = Math.abs(activeCenter - viewCenter);
      setUserScrolled(dist > containerH * 0.3);
    }, 100);
  }, []);

  const onThumbLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.complete && img.naturalWidth > 0) {
      try {
        const [r, g, b] = extractColor(img);
        const dr = Math.round(r * 0.45);
        const dg = Math.round(g * 0.45);
        const db = Math.round(b * 0.45);
        setBgColor([dr, dg, db]);
      } catch {}
    }
  }, []);

  if (!isLyricsOpen || !currentTrack) return null;

  const [cr, cg, cb] = bgColor;
  const bg = `rgb(${cr}, ${cg}, ${cb})`;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl relative"
      style={{ background: bg }}
    >
      <img
        src={currentTrack.thumbnail}
        alt=""
        crossOrigin="anonymous"
        onLoad={onThumbLoad}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="hidden"
      />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-8 md:px-12 lg:px-16 pb-8 pt-6 scroll-smooth"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        ) : timedLines.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="h-[35vh]" />
            {timedLines.map((line, i) => {
              const isActive = i === activeIndex;
              const isPast = i < activeIndex;
              return (
                <p
                  key={i}
                  ref={isActive ? activeLineRef : undefined}
                  className="transition-all duration-300 ease-out cursor-pointer select-none py-1"
                  style={{
                    fontSize: isActive ? "2.25rem" : "1.75rem",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive
                      ? "rgba(255,255,255,1)"
                      : isPast
                        ? `rgba(255,255,255,0.30)`
                        : `rgba(255,255,255,0.55)`,
                    lineHeight: "1.3",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {line.text}
                </p>
              );
            })}
            <div className="h-[40vh]" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/30">
            <Music2 className="w-12 h-12" strokeWidth={1} />
            <p className="text-sm">Testo non disponibile</p>
          </div>
        )}
      </div>

      {userScrolled && (
        <button
          onClick={scrollToActive}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 backdrop-blur-md text-white text-sm font-medium hover:bg-white/25 transition-all duration-200 shadow-lg z-10"
        >
          <Crosshair className="w-4 h-4" />
          Sincronizza
        </button>
      )}
    </div>
  );
}
