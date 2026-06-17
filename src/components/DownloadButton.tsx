import React, { useState, useEffect, useCallback } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { downloadTrack, removeDownload, isDownloaded } from "@/lib/downloadManager";
import { useIsPWA } from "@/hooks/useIsPWA";
import { toast } from "sonner";
import type { Track } from "@shared/types";

type Props = {
  track: Track;
  size?: "sm" | "md";
  onStatusChange?: (trackId: string, downloaded: boolean) => void;
};

export default function DownloadButton({ track, size = "sm", onStatusChange }: Props) {
  const isPWA = useIsPWA();
  const [status, setStatus] = useState<"idle" | "downloading" | "downloaded" | "error">("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPWA) return;
    isDownloaded(track.id).then((downloaded) => {
      setStatus(downloaded ? "downloaded" : "idle");
    });
  }, [track.id, isPWA]);

  const handleDownload = useCallback(async () => {
    if (status === "downloading") return;
    setStatus("downloading");
    setProgress(0);
    try {
      await downloadTrack(track, (pct) => setProgress(pct));
      setStatus("downloaded");
      onStatusChange?.(track.id, true);
      toast.success("Brano salvato per ascolto offline");
    } catch (e) {
      setStatus("error");
      const msg = e instanceof Error ? e.message : "Errore download";
      console.error("[Download]", msg, e);
      toast.error(msg);
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [track, status, onStatusChange]);

  const handleRemove = useCallback(async () => {
    await removeDownload(track.id);
    setStatus("idle");
    setProgress(0);
    onStatusChange?.(track.id, false);
  }, [track.id, onStatusChange]);

  if (!isPWA) return null;

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  if (status === "downloading") {
    return (
      <button
        className="relative text-spotify-green cursor-wait p-1"
        title={`Download in corso... ${progress}%`}
        disabled
      >
        <Loader2 className={`${iconSize} animate-spin`} strokeWidth={2} />
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono">
          {progress}%
        </span>
      </button>
    );
  }

  if (status === "downloaded") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        className="text-spotify-green hover:text-red-400 transition-colors p-1"
        title="Rimuovi download"
      >
        <CheckCircle2 className={iconSize} strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleDownload(); }}
      className="text-muted-foreground hover:text-spotify-green transition-colors p-1"
      title="Scarica per ascolto offline"
    >
      <Download className={iconSize} strokeWidth={2} />
    </button>
  );
}
