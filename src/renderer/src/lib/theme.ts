import type { ResolvedTheme, ThemePreference } from "../../../shared/types";

import type { AccentColor } from "../../../shared/settings";

export function applyAccent(accent: AccentColor): void {
  document.documentElement.dataset.accent = accent;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Mirrors the preference so dev:web (which has no preload bridge and so no
 * settings.json) still themes correctly before its first paint.
 */
export function mirrorPreference(preference: ThemePreference, resolved: ResolvedTheme): void {
  try {
    localStorage.setItem("tally:theme", preference === "system" ? resolved : preference);
  } catch {
    // Storage can be unavailable; the in-memory preference still applies.
  }
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export const THEME_ORDER: readonly ThemePreference[] = ["dark", "light", "system"];

export function nextTheme(current: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length] ?? "system";
}
