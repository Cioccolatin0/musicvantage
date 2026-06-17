import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/components/PushNotificationManager";
import { useLocation } from "wouter";
import {
  Settings, Music, Disc3, Sliders, Shuffle, ToggleLeft, ToggleRight,
  RefreshCw, Loader2, Save, ArrowLeft, Camera, User, Bell, BellOff, LogOut, Smartphone,
  MessageCircle, Users, Trophy, Shield, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const push = usePushNotifications();
  const [, navigate] = useLocation();
  const { data: settings, refetch: refetchSettings } = trpc.settings.get.useQuery(undefined, { enabled: !!user });
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => { toast.success("Impostazioni salvate!"); refetchSettings(); },
    onError: (err) => toast.error(err.message),
  });

  const [mixMode, setMixMode] = useState(false);
  const [bpmRange, setBpmRange] = useState(10);
  const [energy, setEnergy] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    if (settings) {
      setMixMode(settings.mixMode);
      setBpmRange(settings.mixModeBpmRange);
      setEnergy(settings.mixModeEnergy);
    }
  }, [settings]);

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <Settings className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Accedi per modificare le impostazioni</p>
      </div>
    );
  }

  const handleSaveMixMode = () => {
    updateSettings.mutate({ mixMode, mixModeBpmRange: bpmRange, mixModeEnergy: energy });
  };

  return (
    <div className="container py-8 sm:py-12 fade-in">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="w-7 h-7 text-spotify-green" />
          Impostazioni
        </h1>

        {/* Profile section */}
        <section className="bg-card rounded-2xl p-6 border border-border/30 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-spotify-green" />
            Profilo
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-1 flex items-center justify-center overflow-hidden">
              <User className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-1 text-sm hover:bg-surface-2 transition-colors">
              <Camera className="w-4 h-4" />
              Cambia foto profilo
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-1 text-sm hover:bg-surface-2 transition-colors">
              <Camera className="w-4 h-4" />
              Cambia banner
            </button>
          </div>
        </section>

        {/* Social navigation section */}
        <section className="bg-card rounded-2xl border border-border/30 overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social</h2>
          </div>
          <div className="divide-y divide-border/20">
            <button
              onClick={() => navigate("/chat")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-1 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Chat</p>
                <p className="text-xs text-muted-foreground">Messaggi e conversazioni</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate("/friends")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-1 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Amici</p>
                <p className="text-xs text-muted-foreground">Gestisci amicizie</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate("/notifications")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-1 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Notifiche</p>
                <p className="text-xs text-muted-foreground">Aggiornamenti e richieste</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate("/vantage")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-1 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-spotify-green/15 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-spotify-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">adVANTAGE</p>
                <p className="text-xs text-muted-foreground">Statistiche e classifiche</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate("/admin/invites")}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-1 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Gestione inviti</p>
                <p className="text-xs text-muted-foreground">Codici e accesso</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </section>

        {/* Notifications section */}
        <section className="bg-card rounded-2xl p-6 border border-border/30 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-spotify-green" />
            Notifiche
          </h2>

          {push.supported && (
            <div className={`p-4 rounded-xl border transition-all ${push.subscribed ? "border-spotify-green/30 bg-spotify-green/5" : "border-border/30"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${push.subscribed ? "bg-spotify-green/20" : "bg-surface-1"}`}>
                    {push.subscribed ? <Smartphone className="w-5 h-5 text-spotify-green" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Notifiche Push</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {push.subscribed
                        ? "Attive: ricevi notifiche sul dispositivo"
                        : push.permission === "denied"
                        ? "Bloccate dal browser. Abilita nelle impostazioni del browser."
                        : "Non attive: ricevi notifiche solo nell'app"}
                    </p>
                  </div>
                </div>
                {push.permission !== "denied" && (
                  <button
                    onClick={push.subscribed ? push.unsubscribe : push.requestPermission}
                    disabled={push.loading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      push.subscribed
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-spotify-green text-black hover:bg-spotify-green/90"
                    }`}
                  >
                    {push.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : push.subscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    {push.subscribed ? "Disattiva" : "Attiva"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground/60 bg-surface-1 rounded-xl p-3">
            <Bell className="w-3.5 h-3.5 inline mr-1.5" />
            Le notifiche ti avvisano in tempo reale su messaggi, richieste di amicizia e aggiornamenti, anche a browser chiuso (se le notifiche push sono attive).
          </div>
        </section>

        {/* Mix Mode section */}
        <section className="bg-card rounded-2xl p-6 border border-border/30 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-spotify-green" />
            Mix Mode
          </h2>
          <p className="text-sm text-muted-foreground">
            Quando attivo, le playlist vengono mixate automaticamente in base a BPM, energia e affinità musicale.
          </p>

          <div className={`p-4 rounded-xl border transition-all ${mixMode ? "border-spotify-green/30 bg-spotify-green/5" : "border-border/30"}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-sm">Mix automatico</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mixMode ? "Attivo: le playlist vengono mixate dinamicamente" : "Disattivo: riproduzione normale"}
                </p>
              </div>
              <button
                onClick={() => setMixMode(!mixMode)}
                className={`p-1.5 rounded-lg transition-colors ${mixMode ? "text-spotify-green" : "text-muted-foreground"}`}
              >
                {mixMode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>

            {mixMode && (
              <div className="space-y-4 mt-4 pt-4 border-t border-border/20">
                {/* BPM Range */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Range BPM</label>
                    <span className="text-sm text-spotify-green font-semibold">±{bpmRange} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={bpmRange}
                    onChange={(e) => setBpmRange(parseInt(e.target.value))}
                    className="w-full accent-spotify-green"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Preciso</span>
                    <span>Variato</span>
                  </div>
                </div>

                {/* Energy level */}
                <div>
                  <label className="text-sm font-medium block mb-2">Energia</label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as const).map((e) => (
                      <button
                        key={e}
                        onClick={() => setEnergy(e)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          energy === e
                            ? "bg-spotify-green text-black"
                            : "bg-surface-1 text-muted-foreground hover:bg-surface-2"
                        }`}
                      >
                        {e === "low" ? "Bassa" : e === "medium" ? "Media" : "Alta"}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  <Disc3 className="w-3 h-3 inline mr-1" />
                  I brani veranno riorganizzati in base a BPM simile e livello di energia, creando un flusso musicale coerente.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveMixMode}
            disabled={updateSettings.isPending}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-spotify-green text-black font-medium text-sm hover:bg-spotify-green/90 transition-colors disabled:opacity-60"
          >
            {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salva impostazioni Mix
          </button>
        </section>

        {/* Account section */}
        <section className="bg-card rounded-2xl p-6 border border-border/30 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LogOut className="w-5 h-5 text-red-400" />
            Account
          </h2>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors">
            <LogOut className="w-4 h-4" />
            Esci
          </button>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button onClick={onChange} className={`p-1 transition-colors ${enabled ? "text-spotify-green" : "text-muted-foreground"}`}>
        {enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
      </button>
    </div>
  );
}
