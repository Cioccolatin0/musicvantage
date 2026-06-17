import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Music2, Home, Search, Library, Share2, Radio, LogOut, LogIn,
  UserPlus, Shield, Plus, ChevronLeft, ChevronRight,
  MessageCircle, Bell, Users, User, Settings, Trophy
} from "lucide-react";
import { useAuth, setCachedUser } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import ColorPicker from "./ColorPicker";
import { usePlayer } from "../contexts/PlayerContext";

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loc, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { data: playlists = [] } = trpc.library.playlists.useQuery(undefined, { enabled: !!user });
  const { currentTrack } = usePlayer();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setCachedUser(null);
      queryClient.setQueryData([["auth", "me"]], undefined);
      queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
      navigate("/");
    },
  });

  const navigateTo = (path: string) => {
    navigate(path);
    onClose();
  };

  const linkClass = (path: string) => {
    const isActive = loc === path || loc.startsWith(path + "/");
    return `flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-spotify-green/15 text-spotify-green shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-surface-1"
    }`;
  };

  const sidebarContent = (
    <div className={`flex flex-col h-full ${currentTrack ? "pb-16 sm:pb-20" : ""}`}>
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => { navigateTo("/"); setCollapsed(false); }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-spotify-green flex items-center justify-center shadow-lg shadow-green-500/20 shrink-0">
            <Music2 className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && <span className="font-bold text-base tracking-tight">MusicVantage</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-surface-1 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        <button onClick={() => navigateTo("/")} className={linkClass("/")}>
          <Home className="w-5 h-5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>Home</span>}
        </button>
        <button onClick={() => navigateTo("/search")} className={linkClass("/search")}>
          <Search className="w-5 h-5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>Cerca</span>}
        </button>
        <button onClick={() => navigateTo("/library")} className={linkClass("/library")}>
          <Library className="w-5 h-5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>Libreria</span>}
        </button>
        <button onClick={() => navigateTo("/shared")} className={linkClass("/shared")}>
          <Share2 className="w-5 h-5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>Playlist condivise</span>}
        </button>
        <button onClick={() => navigateTo("/jam")} className={linkClass("/jam")}>
          <Radio className="w-5 h-5 shrink-0" strokeWidth={2} />
          {!collapsed && <span>JAM</span>}
        </button>

        {user && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Social</p>
            </div>
            <button onClick={() => navigateTo("/chat")} className={linkClass("/chat")}>
              <MessageCircle className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Chat</span>}
            </button>
            <button onClick={() => navigateTo("/friends")} className={linkClass("/friends")}>
              <Users className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Amici</span>}
            </button>
            <button onClick={() => navigateTo("/notifications")} className={linkClass("/notifications") + " relative"}>
              <Bell className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Notifiche</span>}
            </button>
            <button onClick={() => navigateTo("/profile")} className={linkClass("/profile")}>
              <User className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Profilo</span>}
            </button>
            <button onClick={() => navigateTo("/settings")} className={linkClass("/settings")}>
              <Settings className="w-5 h-5 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Impostazioni</span>}
            </button>
          </>
        )}

        {user && !collapsed && (
          <>
            <div className="pt-4 pb-1">
              <div className="flex items-center justify-between px-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Le tue playlist</p>
                <button
                  onClick={() => navigateTo("/library")}
                  className="text-muted-foreground hover:text-spotify-green transition-colors p-1"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
            {playlists.length > 0 && (
              <div className="space-y-0.5">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => navigateTo(`/playlist/${pl.id}`)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200 truncate"
                  >
                    <div className="w-2 h-2 rounded-full bg-spotify-green/60 shrink-0" />
                    <span className="truncate">{pl.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border/20 space-y-1">
        {!collapsed && <ColorPicker />}
        {isLoading ? (
          !collapsed && <div className="px-3 py-2 text-xs text-muted-foreground/50 animate-pulse">Caricamento...</div>
        ) : user ? (
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate">
              <p className="font-medium text-foreground truncate">{user.name}</p>
              <p className="truncate">{user.email}</p>
            </div>
            <button
              onClick={() => navigateTo("/admin/invites")}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200"
            >
              <Shield className="w-4 h-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Gestione inviti</span>}
            </button>
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
            >
              <LogOut className="w-4 h-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Esci</span>}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => navigateTo("/login?tab=login")}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200"
            >
              <LogIn className="w-4 h-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Accedi</span>}
            </button>
            <button
              onClick={() => navigateTo("/login?tab=register")}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm hover:bg-opacity-10 transition-all duration-200"
              style={{ color: "var(--spotify-green)" }}
            >
              <UserPlus className="w-4 h-4 shrink-0" strokeWidth={2} />
              {!collapsed && <span>Registrati</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full bg-sidebar/80 backdrop-blur-xl border-r border-border/20 z-30 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
