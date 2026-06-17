import React from "react";
import { useLocation } from "wouter";
import { User } from "lucide-react";
import SafeImg from "./SafeImg";
import type { Artist } from "@shared/types";

type Props = {
  artist: Artist;
};

export default function ArtistCard({ artist }: Props) {
  const [, navigate] = useLocation();

  return (
    <div
      className="music-card flex flex-col items-center gap-3 p-5 rounded-xl cursor-pointer bg-surface-1 transition-all duration-300 hover:bg-surface-2 group text-center hover:shadow-xl"
      onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
    >
      <div className="w-28 h-28 rounded-full overflow-hidden bg-surface-2 ring-2 ring-border/20 group-hover:ring-spotify-green/50 transition-all duration-300 shadow-md">
        <SafeImg
          src={artist.thumbnail}
          alt={artist.name}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
          {artist.name}
        </p>
        {artist.subscribers && (
          <p className="text-xs text-muted-foreground mt-1">{artist.subscribers}</p>
        )}
      </div>
    </div>
  );
}
