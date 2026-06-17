import { useState } from "react";
import { useTheme, PRESET_COLORS, type BackgroundStyle } from "../contexts/ThemeContext";
import { Palette, RefreshCw, Check } from "lucide-react";

export default function ColorPicker() {
  const { scheme, setScheme, bgStyle, setBgStyle, setThemeName, resetToDefault } = useTheme();
  const [open, setOpen] = useState(false);

  const bgOptions: { label: string; value: BackgroundStyle }[] = [
    { label: "Gradiente", value: "gradient" },
    { label: "Particelle", value: "particles" },
    { label: "Onde", value: "waves" },
    { label: "Sfondo singolo", value: "solid" },
    { label: "Nessuno", value: "none" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all duration-200"
      >
        <Palette className="w-4 h-4 shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left">Personalizza</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scheme.primary }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scheme.accent }} />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full left-0 mb-2 w-72 p-4 rounded-2xl border border-border/30 shadow-2xl z-50 fade-in"
            style={{ backgroundColor: "var(--card)" }}
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
                  Tema colore
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => { setScheme(preset.scheme); setThemeName(preset.name.toLowerCase()); }}
                      className="p-2 rounded-xl border border-border/30 hover:border-[var(--spotify-green)]/50 transition-all text-center relative group"
                    >
                      <div className="flex gap-1 justify-center mb-1.5">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.scheme.primary }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.scheme.accent }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{preset.name}</span>
                      {scheme.primary === preset.scheme.primary && (
                        <Check className="w-3 h-3 absolute top-1 right-1" style={{ color: "var(--spotify-green)" }} strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
                  Sfondo
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {bgOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBgStyle(opt.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        bgStyle === opt.value
                          ? "text-black"
                          : "text-muted-foreground hover:text-foreground border border-border/30"
                      }`}
                      style={bgStyle === opt.value ? { backgroundColor: "var(--spotify-green)" } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={resetToDefault}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Ripristina default
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
