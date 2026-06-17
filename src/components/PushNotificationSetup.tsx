import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "./PushNotificationManager";
import { Bell, X } from "lucide-react";

const NOTIF_PROMPT_KEY = "musicvantage_notif_prompted";

export default function PushNotificationSetup() {
  const { user } = useAuth();
  const { supported, permission, subscribed, requestPermission, subscribe } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!supported || !user) return;

    // Auto-subscribe if permission already granted but not subscribed
    if (permission === "granted" && !subscribed) {
      subscribe();
    }

    // Show prompt on first visit if permission is still default
    if (permission === "default") {
      const alreadyPrompted = localStorage.getItem(NOTIF_PROMPT_KEY);
      if (!alreadyPrompted) {
        const timer = setTimeout(() => setShowPrompt(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, supported, permission, subscribed]);

  const handleAllow = async () => {
    localStorage.setItem(NOTIF_PROMPT_KEY, "true");
    await requestPermission();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(NOTIF_PROMPT_KEY, "true");
    setShowPrompt(false);
  };

  if (!showPrompt || permission !== "default") return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] sm:left-auto sm:right-4 sm:w-96 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl p-4">
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-spotify-green/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-spotify-green" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Attiva le notifiche</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ricevi avvisi su messaggi, richieste di amicizia e aggiornamenti in tempo reale.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAllow}
                className="px-4 py-1.5 bg-spotify-green text-white text-xs font-semibold rounded-full hover:brightness-110 transition-all"
              >
                Attiva
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Non ora
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
