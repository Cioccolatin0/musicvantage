import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Music2, Mail, Lock, User, KeyRound, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { setCachedUser } from "../hooks/useAuth";

function TabButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: React.ElementType; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
        active
          ? "bg-spotify-green text-black shadow-lg shadow-green-500/20"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-1"
      }`}
    >
      <Icon className="w-4 h-4" strokeWidth={2.5} />
      {label}
    </button>
  );
}

function LoginForm() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setCachedUser(data);
      utils.auth.me.setData(undefined, data);
      toast.success("Accesso effettuato!");
      navigate("/");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Inserisci email e password");
      return;
    }
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Email</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-60 shadow-lg shadow-green-500/20"
      >
        {loginMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" strokeWidth={2} />
        )}
        Accedi
      </button>
    </form>
  );
}

function RegisterForm({ initialCode }: { initialCode: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const { data: inviteStatus, isLoading: validatingInvite } = trpc.auth.validateInvite.useQuery(
    { code: inviteCode },
    { enabled: inviteCode.length > 0 }
  );

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setCachedUser(data);
      utils.auth.me.setData(undefined, data);
      toast.success("Registrazione completata!");
      navigate("/");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password || !inviteCode.trim()) {
      setError("Compila tutti i campi");
      return;
    }
    if (inviteStatus && !inviteStatus.valid) {
      setError(inviteStatus.message || "Codice invito non valido");
      return;
    }
    registerMutation.mutate({
      email: email.trim(),
      name: name.trim(),
      password,
      inviteCode: inviteCode.trim().toUpperCase(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Codice invito</label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            className={`w-full bg-surface-1 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-200 ${
              inviteStatus?.valid
                ? "border-spotify-green/50 focus:ring-2 focus:ring-spotify-green/30"
                : inviteCode && !validatingInvite && !inviteStatus?.valid
                ? "border-destructive/50 focus:ring-2 focus:ring-destructive/30"
                : "border-border/50 focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50"
            }`}
            autoComplete="off"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {validatingInvite ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : inviteStatus?.valid ? (
              <CheckCircle2 className="w-4 h-4 text-spotify-green" />
            ) : inviteCode && !inviteStatus?.valid ? (
              <AlertCircle className="w-4 h-4 text-destructive" />
            ) : null}
          </div>
        </div>
        {inviteStatus?.valid && (
          <p className="text-xs text-spotify-green mt-1">Codice invito valido</p>
        )}
        {inviteCode && !validatingInvite && inviteStatus && !inviteStatus.valid && (
          <p className="text-xs text-destructive mt-1">{inviteStatus.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Nome</label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Il tuo nome"
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Email</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caratteri"
            className="w-full bg-surface-1 border border-border/50 rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-spotify-green/30 focus:border-spotify-green/50 transition-all duration-200"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={registerMutation.isPending || !inviteStatus?.valid}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-spotify-green text-black font-bold text-sm hover:bg-spotify-green/90 transition-all duration-200 disabled:opacity-60 shadow-lg shadow-green-500/20"
      >
        {registerMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" strokeWidth={2} />
        )}
        Registrati
      </button>
    </form>
  );
}

export default function AuthPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tabFromUrl = params.get("tab") || "login";
  const codeFromUrl = params.get("code") || "";

  const [tab, setTab] = useState<"login" | "register">(tabFromUrl === "register" ? "register" : "login");
  const [, navigate] = useLocation();

  useEffect(() => {
    if (tabFromUrl === "register" || codeFromUrl) {
      setTab("register");
    }
  }, [tabFromUrl, codeFromUrl]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <button onClick={() => navigate("/")} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-spotify-green to-spotify-purple flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-500/20 hover:scale-105 transition-transform duration-200">
            <Music2 className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">
            {tab === "login" ? "Bentornato" : "Crea account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "login"
              ? "Accedi per ascoltare la tua musica"
              : "Inserisci il codice invito per registrarti"}
          </p>
        </div>

        <div className="flex gap-2 p-1 rounded-xl bg-surface-1 mb-6">
          <TabButton
            active={tab === "login"}
            icon={LogIn}
            label="Accedi"
            onClick={() => {
              setTab("login");
              navigate("/login", { replace: true });
            }}
          />
          <TabButton
            active={tab === "register"}
            icon={UserPlus}
            label="Registrati"
            onClick={() => {
              setTab("register");
              navigate("/login?tab=register", { replace: true });
            }}
          />
        </div>

        {tab === "login" ? <LoginForm /> : <RegisterForm initialCode={codeFromUrl} />}
      </div>
    </div>
  );
}
