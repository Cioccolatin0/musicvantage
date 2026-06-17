import { useLocation } from "wouter";
import { Home } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="container py-24 text-center fade-in">
      <h1 className="text-7xl font-bold text-foreground mb-4">404</h1>
      <p className="text-muted-foreground mb-8 text-sm">Pagina non trovata</p>
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 hover:scale-105 shadow-lg shadow-green-500/20"
      >
        <Home className="w-4 h-4" />
        Torna alla home
      </button>
    </div>
  );
}
