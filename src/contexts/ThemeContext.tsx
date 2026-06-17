import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type BackgroundStyle = "gradient" | "particles" | "waves" | "solid" | "none";

export type ColorScheme = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
};

const STORAGE_KEY = "musicstream-theme";
const COOKIE_KEY = "theme";

const DEFAULT_SCHEME: ColorScheme = {
  primary: "oklch(0.62 0.19 280)",
  accent: "oklch(0.70 0.18 330)",
  background: "oklch(0.05 0.01 270)",
  surface: "oklch(0.09 0.015 270)",
  card: "oklch(0.12 0.02 270)",
};

type ThemeContextType = {
  bgStyle: BackgroundStyle;
  setBgStyle: (style: BackgroundStyle) => void;
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
  themeName: string;
  setThemeName: (name: string) => void;
  resetToDefault: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function setThemeCookie(name: string) {
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(name)};path=/;max-age=31536000;SameSite=Lax`;
  } catch {}
}

function loadFromStorage(): { scheme: ColorScheme; bgStyle: BackgroundStyle } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveToStorage(scheme: ColorScheme, bgStyle: BackgroundStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scheme, bgStyle }));
  } catch {}
}

function loadThemeName(): string {
  try {
    return localStorage.getItem("musicstream-theme-name") || DEFAULT_NAME;
  } catch { return DEFAULT_NAME; }
}

function saveThemeName(name: string) {
  try { localStorage.setItem("musicstream-theme-name", name); } catch {}
}

function updateThemeLinks(name: string) {
  const link = document.querySelector<HTMLLinkElement>('#manifest-link');
  if (link) link.href = `/icons/${name}-manifest.json`;
  const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (apple) apple.href = `/icons/${name}-192.png`;
}

function applyColors(scheme: ColorScheme) {
  const root = document.documentElement;
  root.style.setProperty("--spotify-green", scheme.primary);
  root.style.setProperty("--spotify-purple", scheme.accent);
  root.style.setProperty("--background", scheme.background);
  root.style.setProperty("--card", scheme.card);
  root.style.setProperty("--surface-1", scheme.surface);
  root.style.setProperty("--surface-2", `oklch(from ${scheme.surface} l c h / 1.2)`);
  root.style.setProperty("--sidebar", scheme.background);
}

const DEFAULT_NAME = "aurora";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const saved = loadFromStorage();
  const [scheme, setSchemeState] = useState<ColorScheme>(saved?.scheme || DEFAULT_SCHEME);
  const [bgStyle, setBgStyleState] = useState<BackgroundStyle>(saved?.bgStyle || "gradient");
  const [themeName, setThemeNameState] = useState<string>(loadThemeName());

  useEffect(() => {
    setThemeCookie(themeName);
    updateThemeLinks(themeName);
    saveThemeName(themeName);
    window.dispatchEvent(new CustomEvent("theme-changed"));
  }, [themeName]);

  const setScheme = useCallback((s: ColorScheme) => {
    setSchemeState(s);
    applyColors(s);
    saveToStorage(s, bgStyle);
  }, [bgStyle]);

  const setBgStyle = useCallback((b: BackgroundStyle) => {
    setBgStyleState(b);
    saveToStorage(scheme, b);
  }, [scheme]);

  const setThemeName = useCallback((name: string) => {
    setThemeNameState(name);
  }, []);

  const resetToDefault = useCallback(() => {
    setSchemeState(DEFAULT_SCHEME);
    setBgStyleState("gradient");
    applyColors(DEFAULT_SCHEME);
    saveToStorage(DEFAULT_SCHEME, "gradient");
    setThemeNameState(DEFAULT_NAME);
  }, []);

  useEffect(() => {
    applyColors(scheme);
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ bgStyle, setBgStyle, scheme, setScheme, themeName, setThemeName, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const PRESET_COLORS: { name: string; scheme: ColorScheme }[] = [
  {
    name: "Aurora",
    scheme: {
      primary: "oklch(0.62 0.19 280)",
      accent: "oklch(0.70 0.18 330)",
      background: "oklch(0.05 0.01 270)",
      surface: "oklch(0.09 0.015 270)",
      card: "oklch(0.12 0.02 270)",
    },
  },
  {
    name: "Lava",
    scheme: {
      primary: "oklch(0.65 0.22 30)",
      accent: "oklch(0.60 0.20 60)",
      background: "oklch(0.05 0.01 30)",
      surface: "oklch(0.09 0.015 30)",
      card: "oklch(0.12 0.02 30)",
    },
  },
  {
    name: "Neon",
    scheme: {
      primary: "oklch(0.65 0.25 150)",
      accent: "oklch(0.60 0.20 180)",
      background: "oklch(0.04 0.01 150)",
      surface: "oklch(0.08 0.015 150)",
      card: "oklch(0.11 0.02 150)",
    },
  },
  {
    name: "Midnight",
    scheme: {
      primary: "oklch(0.60 0.15 260)",
      accent: "oklch(0.55 0.12 290)",
      background: "oklch(0.03 0.01 250)",
      surface: "oklch(0.07 0.015 250)",
      card: "oklch(0.10 0.02 250)",
    },
  },
  {
    name: "Sunset",
    scheme: {
      primary: "oklch(0.70 0.20 50)",
      accent: "oklch(0.65 0.22 10)",
      background: "oklch(0.06 0.015 350)",
      surface: "oklch(0.10 0.02 350)",
      card: "oklch(0.13 0.025 350)",
    },
  },
  {
    name: "Candy",
    scheme: {
      primary: "oklch(0.68 0.22 350)",
      accent: "oklch(0.65 0.20 310)",
      background: "oklch(0.06 0.015 340)",
      surface: "oklch(0.10 0.02 340)",
      card: "oklch(0.13 0.025 340)",
    },
  },
];
