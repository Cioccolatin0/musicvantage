import React, { useState, useEffect, useCallback } from "react";
import { X, Download, Smartphone, ArrowUp } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

function getDismissed(): boolean {
  try { return localStorage.getItem("pwa-install-dismissed") === "true"; } catch { return false; }
}

function setDismissed() {
  try { localStorage.setItem("pwa-install-dismissed", "true"); } catch {}
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    if (isStandalone() || getDismissed()) return;

    if (isIOS()) setPlatform("ios");
    else if (isAndroid()) setPlatform("android");
    else setPlatform("other");

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      setTimeout(() => setShowPopup(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // For iOS and desktop: show after a delay as fallback
    if (isIOS() || !isAndroid()) {
      fallbackTimer = setTimeout(() => {
        if (!deferredPrompt) {
          setShowPopup(true);
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPopup(false);
        setDismissed();
      }
      setDeferredPrompt(null);
    } else {
      // iOS or fallback: show tutorial
      setShowTutorial(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPopup(false);
    setDismissed();
  }, []);

  const handleTutorialClose = useCallback(() => {
    setShowTutorial(false);
    setShowPopup(false);
    setDismissed();
  }, []);

  if (!showPopup && !showTutorial) return null;

  return (
    <>
      {/* Install Banner */}
      {showPopup && !showTutorial && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] sm:left-auto sm:right-4 sm:w-80">
          <div className="bg-card border border-border/50 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
            <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-spotify-green/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-spotify-green" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">Installa MusicVantage</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aggiungi alla schermata home per un accesso rapido
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleInstall}
                    className="px-4 py-1.5 bg-spotify-green text-white text-xs font-semibold rounded-full hover:brightness-110 transition-all"
                  >
                    {deferredPrompt ? "Installa" : "Come fare?"}
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
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleTutorialClose}>
          <div className="bg-card border border-border/50 rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">Installa MusicVantage</h2>
              <button onClick={handleTutorialClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {platform === "ios" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-500 font-bold text-sm">1</span>
                  </div>
                  <p className="text-sm">Tocca il pulsante <strong>Condividi</strong> nella barra in basso</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-500 font-bold text-sm">2</span>
                  </div>
                  <p className="text-sm">Scorri e tocca <strong>"Aggiungi alla Schermata Home"</strong></p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-500 font-bold text-sm">3</span>
                  </div>
                  <p className="text-sm">Tocca <strong>"Aggiungi"</strong> in alto a destra</p>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-surface-2/50 border border-border/30">
                  <p className="text-xs text-muted-foreground text-center">
                    L'icona di MusicVantage apparirà nella tua schermata home come un'app normale!
                  </p>
                </div>
              </div>
            ) : platform === "android" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <span className="text-green-500 font-bold text-sm">1</span>
                  </div>
                  <p className="text-sm">Tocca i <strong>tre puntini</strong> in alto a destra</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <span className="text-green-500 font-bold text-sm">2</span>
                  </div>
                  <p className="text-sm">Tocca <strong>"Installa app"</strong> o <strong>"Aggiungi a schermata Home"</strong></p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <span className="text-green-500 font-bold text-sm">3</span>
                  </div>
                  <p className="text-sm">Conferma toccando <strong>"Installa"</strong></p>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-surface-2/50 border border-border/30">
                  <p className="text-xs text-muted-foreground text-center">
                    MusicVantage verrà installata come app sulla tua schermata home!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <span className="text-purple-500 font-bold text-sm">1</span>
                  </div>
                  <p className="text-sm">Clicca sull'icona <strong>Install</strong> nella barra dell'indirizzo</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-1/50">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <span className="text-purple-500 font-bold text-sm">2</span>
                  </div>
                  <p className="text-sm">Conferma l'installazione</p>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-surface-2/50 border border-border/30">
                  <p className="text-xs text-muted-foreground text-center">
                    MusicVantage apparirà nella tua barra delle applicazioni!
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleTutorialClose}
              className="w-full mt-5 py-2.5 bg-spotify-green text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
            >
              Ho capito!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
