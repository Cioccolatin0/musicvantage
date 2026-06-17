import React from "react";
import { X, Trash2, Music2 } from "lucide-react";
import SafeImg from "./SafeImg";
import { usePlayer } from "../contexts/PlayerContext";

export default function QueueDrawer() {
  const { isQueueOpen, queue, queueIndex, currentTrack, toggleQueue, removeFromQueue, playFromQueue, clearQueue } = usePlayer();

  if (!isQueueOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggleQueue} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-background/95 backdrop-blur-xl border-l border-border/30 flex flex-col shadow-2xl"
        style={{ bottom: currentTrack ? "88px" : "0" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <div>
            <h3 className="font-bold text-sm">Coda di riproduzione</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{queue.length} brani</p>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
                title="Svuota coda"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleQueue}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Music2 className="w-10 h-10 opacity-20" strokeWidth={1.5} />
              <p className="text-sm">La coda è vuota</p>
            </div>
          ) : (
            <div className="space-y-1">
              {queue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-200 ${
                    idx === queueIndex
                      ? "bg-spotify-green/10 ring-1 ring-spotify-green/20"
                      : "hover:bg-surface-1"
                  }`}
                  onClick={() => playFromQueue(idx)}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 relative shadow-md">
                    <SafeImg src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                    {idx === queueIndex && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                        <div className="flex gap-0.5 items-end h-3">
                          <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0s" }} />
                          <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.15s" }} />
                          <span className="w-0.5 bg-spotify-green rounded-sm equalizer-bar" style={{ animationDelay: "0.3s" }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${idx === queueIndex ? "spotify-green" : "text-foreground"}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {track.duration && (
                      <span className="text-xs text-muted-foreground/70 tabular-nums">{track.duration}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all duration-200 p-1 rounded-lg hover:bg-destructive/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
