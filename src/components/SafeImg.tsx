import { useState, useMemo } from "react";

function proxyUrl(src: string): string {
  if (!src) return src;
  // Only proxy URLs from CORS-restricted hosts
  try {
    const u = new URL(src);
    if (u.hostname.endsWith("yt3.ggpht.com") || u.hostname.endsWith("yt3.googleusercontent.com") || u.hostname.endsWith("lh3.googleusercontent.com") || u.hostname.endsWith("i.scdn.co") || u.hostname.endsWith("mosaic.scdn.co") || u.hostname.endsWith("image-cdn-ak.spotify.com")) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }
  } catch {}
  return src;
}

export default function SafeImg({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const proxied = useMemo(() => proxyUrl(src || ""), [src]);

  if (!src || failed) {
    return (
      <div className={`${className || ""} bg-gradient-to-br from-spotify-green/30 to-spotify-purple/30 flex items-center justify-center`}>
        <MusicIcon />
      </div>
    );
  }
  return <img src={proxied} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
}

function MusicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
