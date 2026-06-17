import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MusicPlayer from "./MusicPlayer";
import MobileBottomNav from "./MobileBottomNav";
import QueueDrawer from "./QueueDrawer";
import NowPlayingPanel from "./NowPlayingPanel";
import LyricsView from "./LyricsView";
import { usePlayer } from "../contexts/PlayerContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentTrack, isLyricsOpen, isNowPlayingOpen } = usePlayer();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar open={false} onClose={() => {}} />
        <div className="hidden lg:block w-64 shrink-0" />
        <main className="flex-1 min-h-0 flex">
          <div
            className={`flex-1 min-h-0 flex flex-col ${
              currentTrack
                ? "pb-[128px] lg:pb-[88px]"
                : "pb-16 lg:pb-0"
            }`}
          >
            {isLyricsOpen && currentTrack ? (
              <LyricsView />
            ) : (
              children
            )}
          </div>
          {isNowPlayingOpen && <NowPlayingPanel />}
        </main>
      </div>
      <QueueDrawer />
      {currentTrack && <MusicPlayer />}
      <MobileBottomNav />
    </div>
  );
}
