import { useLocation } from "wouter";
import { Home, Search, Library, Settings } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/search", icon: Search, label: "Ricerca" },
  { path: "/library", icon: Library, label: "Libreria" },
  { path: "/settings", icon: Settings, label: "Impostazioni" },
];

export default function MobileBottomNav() {
  const [loc, navigate] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return loc === "/";
    return loc === path || loc.startsWith(path + "/");
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/20 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors duration-200 ${
                active
                  ? "text-spotify-green"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon
                className={`w-5 h-5 ${active ? "stroke-[2.5]" : "stroke-[1.75]"}`}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
