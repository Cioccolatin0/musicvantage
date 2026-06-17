import React from "react";
import { useLocation } from "wouter";
import { Disc3 } from "lucide-react";
import SafeImg from "./SafeImg";
import type { Album } from "@shared/types";

type Props = {
  album: Album;
};

export default function AlbumCard({ album }: Props) {
  const [, navigate] = useLocation();

  return (
    <div
      className="music-card flex flex-col rounded-xl overflow-hidden cursor-pointer bg-surface-1 transition-all duration-300 hover:bg-surface-2 group hover:shadow-xl"
      onClick={() => album.id && navigate(`/album/${album.id}`)}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg">
        <SafeImg
          src={album.thumbnail}
          alt={album.title}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-semibold truncate text-foreground group-hover:text-spotify-green transition-colors">
          {album.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
        {album.year && (
          <p className="text-xs text-muted-foreground/50">{album.year}</p>
        )}
      </div>
    </div>
  );
}
