import { useTheme, type BackgroundStyle } from "../contexts/ThemeContext";

export default function AnimatedBackground() {
  const { bgStyle, scheme } = useTheme();

  if (bgStyle === "none") return null;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {bgStyle === "gradient" && (
        <div className="absolute inset-0 animate-gradient-shift">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 0% 20%, ${scheme.primary}33 0%, transparent 60%),
                radial-gradient(ellipse 60% 50% at 100% 40%, ${scheme.accent}33 0%, transparent 60%),
                radial-gradient(ellipse 70% 40% at 50% 80%, ${scheme.primary}22 0%, transparent 50%)
              `,
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `
                radial-gradient(ellipse 60% 50% at 20% 60%, ${scheme.accent}22 0%, transparent 50%),
                radial-gradient(ellipse 50% 60% at 80% 20%, ${scheme.primary}22 0%, transparent 50%)
              `,
            }}
          />
        </div>
      )}

      {bgStyle === "waves" && (
        <div className="absolute inset-0">
          <svg className="absolute bottom-0 w-full h-48 opacity-10" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={scheme.primary} />
                <stop offset="100%" stopColor={scheme.accent} />
              </linearGradient>
            </defs>
            <path
              fill="url(#wave-grad)"
              d="M0,160 C360,320 720,0 1080,160 C1260,240 1350,200 1440,160 L1440,320 L0,320 Z"
              className="animate-wave"
            />
            <path
              fill="url(#wave-grad)"
              d="M0,200 C360,80 720,280 1080,120 C1260,40 1350,80 1440,200 L1440,320 L0,320 Z"
              className="animate-wave"
              style={{ animationDelay: "-2s", opacity: 0.5 }}
            />
            <path
              fill="url(#wave-grad)"
              d="M0,240 C360,360 720,160 1080,240 C1260,280 1350,260 1440,240 L1440,320 L0,320 Z"
              className="animate-wave"
              style={{ animationDelay: "-4s", opacity: 0.3 }}
            />
          </svg>
        </div>
      )}

      {bgStyle === "particles" && <ParticlesEffect />}

      {bgStyle === "solid" && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${scheme.background} 0%, ${scheme.surface} 100%)`,
          }}
        />
      )}
    </div>
  );
}

function ParticlesEffect() {
  return (
    <div className="absolute inset-0">
      <svg className="w-full h-full opacity-20" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="dot-grad">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 30 }).map((_, i) => (
          <circle
            key={i}
            cx={Math.random() * 1000}
            cy={Math.random() * 800}
            r={Math.random() * 4 + 1}
            fill="currentColor"
            className="animate-float"
            style={{
              color: i % 2 === 0 ? "var(--spotify-green)" : "var(--spotify-purple)",
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 4 + 3}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
