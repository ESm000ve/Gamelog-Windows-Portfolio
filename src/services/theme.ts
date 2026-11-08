import { appPlatform } from "../platform/platform";
export type ThemeMode = "dark" | "light" | "system";
export type AccentColor =
  "indigo" | "green" | "blue" | "orange" | "pink" | "gold" | "purple" | "red";

export interface AccentOption {
  id: AccentColor;
  name: string;
  hex: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: "indigo", name: "Indigo", hex: "var(--app-indigo)" },
  { id: "green", name: "Green", hex: "var(--app-green)" },
  { id: "blue", name: "Blue", hex: "var(--app-blue)" },
  { id: "orange", name: "Orange", hex: "var(--app-orange)" },
  { id: "pink", name: "Pink", hex: "var(--app-pink)" },
  { id: "gold", name: "Gold", hex: "var(--app-yellow)" },
  { id: "purple", name: "Purple", hex: "var(--app-purple)" },
  { id: "red", name: "Red", hex: "var(--app-red)" },
];

const THEME_KEY = "gamelog_theme_mode";
const ACCENT_KEY = "gamelog_accent_color";

export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  return stored || "system";
}

export function setStoredThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
}

export function getStoredAccentColor(): AccentColor {
  const stored = localStorage.getItem(ACCENT_KEY) as AccentColor | null;
  return stored || "blue";
}

export function setStoredAccentColor(color: AccentColor): void {
  localStorage.setItem(ACCENT_KEY, color);
  applyTheme(undefined, color);
}

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

export function applyTheme(mode?: ThemeMode, accent?: AccentColor): void {
  const targetMode = mode || getStoredThemeMode();
  const targetAccent = accent || getStoredAccentColor();

  // A MediaQueryList is its own event target. Remove the old listener from
  // that same instance before changing native appearance or registering again.
  if (window.matchMedia) mediaQuery ??= window.matchMedia("(prefers-color-scheme: light)");
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
    mediaListener = null;
  }

  let resolvedMode: "dark" | "light" = "dark";
  if (targetMode === "light") {
    resolvedMode = "light";
  } else if (targetMode === "system") {
    const isLight = mediaQuery?.matches;
    resolvedMode = isLight ? "light" : "dark";
  }

  document.documentElement.setAttribute("data-platform", appPlatform);
  document.documentElement.setAttribute("data-desktop", String(!!window.desktop?.isElectron));
  window.desktop?.setTheme?.(targetMode);
  document.documentElement.setAttribute("data-theme", resolvedMode);
  document.documentElement.style.colorScheme = resolvedMode;
  document.documentElement.setAttribute("data-accent", targetAccent);

  if (targetMode === "system" && mediaQuery) {
    const listener = () => {
      // Ignore an already queued event from a replaced subscription.
      if (mediaListener === listener) applyTheme("system", targetAccent);
    };
    mediaListener = listener;
    mediaQuery.addEventListener("change", listener);
  }
}
